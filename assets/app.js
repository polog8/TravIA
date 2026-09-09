/* TravIA — interface et orchestration.
   Deux vues sur le meme itineraire : un comparateur segment par segment et une
   recherche du meilleur trajet tous modes confondus, correspondances comprises. */
(function (global) {
  'use strict';

  var T = global.TravIA;
  var E = T.engine;
  var R = T.router;
  var doc = global.document;

  /* ------------------------------------------------------------- utilitaires */

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function shortHost(url) {
    return String(url).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  function fmtDur(min) {
    if (min == null) return '—';
    var m = Math.round(min);
    var h = Math.floor(m / 60);
    return h ? h + ' h ' + pad(m % 60) : m + ' min';
  }
  function fmtPrice(v) {
    if (v == null) return '—';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  }
  function fmtKm(v) { return v == null ? '—' : Math.round(v).toLocaleString('fr-FR') + ' km'; }
  function fmtCo2(v) { return v == null ? '—' : (v < 10 ? v.toFixed(1) : Math.round(v).toString()).replace('.', ',') + ' kg'; }
  function fmtClock(d, ref) {
    var s = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (ref) {
      var days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
        new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) / 86400000);
      if (days > 0) s += '<span class="time__day">+' + days + '</span>';
    }
    return s;
  }
  function fmtDate(d) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
  }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  var MODES = {
    car: { key: 'car', label: 'Voiture' },
    train: { key: 'train', label: 'Train' },
    plane: { key: 'plane', label: 'Avion' }
  };
  var MODE_ORDER = ['car', 'train', 'plane'];

  /* ------------------------------------------------------------------- etat */

  function newDirection() {
    return { places: null, route: null, routeStatus: 'none', legs: null, picks: [], expanded: {}, best: null };
  }

  var state = {
    stops: [],
    opts: Object.assign({}, T.DEFAULTS),
    modes: { car: true, train: true, plane: true },
    roundTrip: false,
    out: newDirection(),
    back: newDirection(),
    tab: 'compare',
    criterion: 'duration',
    bestOpen: {},
    computed: false,
    busy: false
  };

  /* horaires ferroviaires reels : cache des reponses et diagnostic par segment */
  var liveRail = { cache: {}, status: {} };

  var uid = 0;
  function newStop(query) {
    return { uid: ++uid, query: query || '', place: null, anchor: null, hold: 0 };
  }
  function stopPlace(stop) {
    return stop.place ? E.anchorPlace(stop.place, stop.anchor) : null;
  }

  /* ------------------------------------------------- saisie des points ----- */

  var stopsBox = $('#stops');

  function renderStops() {
    stopsBox.innerHTML = '';
    state.stops.forEach(function (stop, i) {
      var isFirst = i === 0, isLast = i === state.stops.length - 1;
      var row = el('div', 'stop' + (!isFirst && !isLast ? ' stop--via' : ''));

      row.appendChild(el('span', 'stop__key', isFirst ? 'D' : isLast ? 'A' : String(i)));

      var field = el('div', 'stop__field');
      var input = doc.createElement('input');
      input.type = 'text';
      input.value = stop.query;
      input.placeholder = isFirst ? 'Ville, gare, aeroport ou adresse'
        : isLast ? 'Destination' : 'Point de passage';
      input.setAttribute('aria-label', isFirst ? 'Depart' : isLast ? 'Arrivee' : 'Etape ' + i);
      input.autocomplete = 'off';
      field.appendChild(input);
      row.appendChild(field);
      attachAutocomplete(input, field, stop);

      var extra = el('div', 'stop__extra');
      if (!isFirst && !isLast) {
        var hold = doc.createElement('input');
        hold.type = 'number';
        hold.className = 'stop__hold';
        hold.min = '0'; hold.max = '96'; hold.step = '1';
        hold.value = stop.hold || 0;
        hold.title = 'Duree de l arret sur place, en heures';
        hold.setAttribute('aria-label', 'Duree de l arret a cette etape, en heures');
        hold.addEventListener('change', function () {
          stop.hold = Math.max(0, parseInt(hold.value, 10) || 0);
          persist();
        });
        extra.appendChild(hold);
        extra.appendChild(el('span', 'stop__unit', 'h'));
      }
      if (state.stops.length > 2) {
        var del = el('button', 'stop__del', '×');
        del.type = 'button';
        del.title = 'Supprimer ce point';
        del.setAttribute('aria-label', 'Supprimer ce point');
        del.addEventListener('click', function () {
          state.stops.splice(i, 1);
          renderStops();
          persist();
        });
        extra.appendChild(del);
      }
      row.appendChild(extra);
      stopsBox.appendChild(row);
      if (!isLast) stopsBox.appendChild(el('div', 'stop__spacer'));
    });
  }

  /* Propositions locales : la ville, puis sa gare et ses aeroports. Les
     resultats de rue ne sont interroges que si la saisie ressemble a une
     adresse. */
  function localMatches(q) {
    var out = [], seen = {};
    function push(entry) {
      var key = entry.label + '|' + entry.place.id;
      if (seen[key]) return;
      seen[key] = true;
      out.push(entry);
    }
    /* villes correspondantes, avec leurs gares et leurs aeroports */
    E.searchPlaces(q, 4).forEach(function (p) {
      push({
        kind: 'local', place: p, anchor: { type: 'city' },
        label: p.name, sub: p.country + ' — centre-ville'
      });
      (p.rail || []).forEach(function (st) {
        push({
          kind: 'local', place: p, anchor: { type: 'rail', station: st.name },
          label: st.name,
          sub: 'Gare — ' + p.name + (st.hsr ? ', grande vitesse' : '') + ', acces ' + st.accessMin + ' min'
        });
      });
      p.air.forEach(function (a) {
        push({
          kind: 'local', place: p, anchor: { type: 'air', iata: a.iata },
          label: a.name + ' (' + a.iata + ')',
          sub: 'Aeroport — ' + p.name + ', acces ' + a.transferMin + ' min'
        });
      });
    });
    /* gares et aeroports dont le nom correspond directement */
    E.searchStations(q, 5).forEach(function (r) {
      push({
        kind: 'local', place: r.place, anchor: { type: 'rail', station: r.station.name },
        label: r.station.name,
        sub: 'Gare — ' + r.place.name + (r.station.hsr ? ', grande vitesse' : '')
      });
    });
    E.searchAirports(q, 4).forEach(function (r) {
      push({
        kind: 'local', place: r.place, anchor: { type: 'air', iata: r.airport.iata },
        label: r.airport.name + ' (' + r.airport.iata + ')',
        sub: 'Aeroport — ' + r.place.name
      });
    });
    return out.slice(0, 12);
  }

  function looksLikeAddress(q) {
    return /\d/.test(q) || q.indexOf(',') > -1 || q.trim().split(/\s+/).length >= 3;
  }

  function attachAutocomplete(input, field, stop) {
    var drop = null, items = [], cursor = -1, remoteTimer = null, localTimer = null;

    function close() {
      if (drop) { drop.remove(); drop = null; }
      items = []; cursor = -1;
    }
    function open(list) {
      close();
      if (!list.length) return;
      items = list;
      drop = el('ul', 'stop__drop');
      drop.setAttribute('role', 'listbox');
      list.forEach(function (it, idx) {
        var li = el('li');
        li.setAttribute('role', 'option');
        li.innerHTML = esc(it.label) + '<span class="ac-sub">' + esc(it.sub) +
          (it.kind === 'remote' ? ' <span class="ac-remote">OpenStreetMap</span>' : '') + '</span>';
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); choose(idx); });
        drop.appendChild(li);
      });
      field.appendChild(drop);
    }
    function highlight(n) {
      if (!drop) return;
      cursor = n;
      Array.prototype.forEach.call(drop.children, function (li, i) {
        li.setAttribute('aria-selected', i === n ? 'true' : 'false');
      });
    }
    function choose(idx) {
      var it = items[idx];
      if (!it) return;
      if (it.kind === 'local') {
        stop.place = it.place;
        stop.anchor = it.anchor;
        stop.query = it.label;
      } else {
        stop.place = E.buildCustomPlace(it.label, it.lat, it.lon, { country: it.country, cc: it.cc });
        stop.anchor = null;
        stop.query = it.label;
      }
      input.value = stop.query;
      close();
      persist();
    }
    function search() {
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      var list = localMatches(q);
      open(list);
      var wantRemote = state.opts.useLive && T.providers.available && q.length >= 3 &&
        (looksLikeAddress(q) || !list.length);
      if (!wantRemote) return;
      clearTimeout(remoteTimer);
      remoteTimer = setTimeout(function () {
        if (input.value.trim() !== q) return;
        T.providers.geocode(q).then(function (rows) {
          if (input.value.trim() !== q) return;
          var extra = rows.slice(0, 5).map(function (r) {
            return {
              kind: 'remote', label: r.label,
              sub: r.detail.split(',').slice(-3).join(',').trim(),
              lat: r.lat, lon: r.lon, country: r.country, cc: r.cc
            };
          }).filter(function (r) {
            return !list.some(function (l) { return E.normalize(l.label) === E.normalize(r.label); });
          });
          if (extra.length) open(list.concat(extra));
        });
      }, 480);
    }

    input.addEventListener('input', function () {
      stop.query = input.value;
      stop.place = null;
      stop.anchor = null;
      clearTimeout(localTimer);
      localTimer = setTimeout(search, 130);
    });
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2 && !stop.place) search(); });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
    input.addEventListener('keydown', function (ev) {
      if (!drop) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); highlight((cursor + 1) % items.length); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); highlight((cursor - 1 + items.length) % items.length); }
      else if (ev.key === 'Enter' && cursor >= 0) { ev.preventDefault(); choose(cursor); }
      else if (ev.key === 'Escape') close();
    });
  }

  /* --------------------------------------------------------- options ------- */

  function readOptions() {
    var o = state.opts;
    o.passengers = Math.max(1, parseInt($('#passengers').value, 10) || 1);
    o.fuel = $('#fuel').value;
    o.consumption = parseFloat($('#consumption').value) || T.DEFAULTS.consumption;
    o.fuelPrice = parseFloat($('#fuelPrice').value) || T.DEFAULTS.fuelPrice;
    o.kwhPer100 = parseFloat($('#kwhPer100').value) || T.DEFAULTS.kwhPer100;
    o.kwhPrice = parseFloat($('#kwhPrice').value) || T.DEFAULTS.kwhPrice;
    /* les voyageurs partagent le vehicule : le cout par personne suit leur nombre */
    o.occupants = o.passengers;
    o.tolls = $('#tollProfile').value !== 'non';
    o.includeWear = $('#includeWear').checked;
    o.railClass = $('#railClass').value;
    o.railCard = $('#railCard').value;
    o.railTransferMin = parseInt($('#railTransferMin').value, 10);
    if (isNaN(o.railTransferMin)) o.railTransferMin = T.DEFAULTS.railTransferMin;
    o.checkinMin = parseInt($('#checkinMin').value, 10) || T.DEFAULTS.checkinMin;
    o.disembarkMin = parseInt($('#disembarkMin').value, 10) || T.DEFAULTS.disembarkMin;
    o.hold = $('#hold').checked;
    o.useLive = $('#useLive').checked;
    o.liveRail = $('#liveRail').checked;
    state.modes.car = $('#modeCar').checked;
    state.modes.train = $('#modeTrain').checked;
    state.modes.plane = $('#modePlane').checked;
    state.roundTrip = $('#roundTrip').checked;
  }

  function dateFrom(dateInput, timeInput, fallbackTime) {
    var d = dateInput.value;
    if (!d) return null;
    var t = timeInput.value || fallbackTime;
    var parts = d.split('-'), tp = t.split(':');
    return new Date(+parts[0], +parts[1] - 1, +parts[2], +tp[0], +tp[1]);
  }
  function departureDate() { return dateFrom($('#date'), $('#time'), '08:00'); }
  function returnDate() { return dateFrom($('#returnDate'), $('#returnTime'), '17:00'); }

  function persist() {
    try {
      global.localStorage.setItem('travia.form', JSON.stringify({
        stops: state.stops.map(function (s) {
          return {
            query: s.query,
            id: s.place && !s.place.custom ? s.place.id : null,
            lat: s.place && s.place.custom ? s.place.lat : null,
            lon: s.place && s.place.custom ? s.place.lon : null,
            anchor: s.anchor, hold: s.hold
          };
        }),
        date: $('#date').value, time: $('#time').value,
        roundTrip: $('#roundTrip').checked,
        returnDate: $('#returnDate').value, returnTime: $('#returnTime').value,
        passengers: $('#passengers').value,
        modes: state.modes, opts: state.opts, tab: state.tab
      }));
    } catch (e) { /* stockage indisponible : sans consequence */ }
  }

  function restore() {
    var raw;
    try { raw = global.localStorage.getItem('travia.form'); } catch (e) { raw = null; }
    if (!raw) return false;
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { return false; }
    if (!saved || !saved.stops || saved.stops.length < 2) return false;
    state.stops = saved.stops.map(function (s) {
      var stop = newStop(s.query);
      stop.hold = s.hold || 0;
      stop.anchor = s.anchor || null;
      if (s.id) stop.place = E.placeById(s.id);
      else if (s.lat != null) stop.place = E.buildCustomPlace(s.query, s.lat, s.lon, null);
      return stop;
    });
    if (saved.time) $('#time').value = saved.time;
    if (saved.passengers) $('#passengers').value = saved.passengers;
    if (saved.returnTime) $('#returnTime').value = saved.returnTime;
    if (saved.roundTrip) { $('#roundTrip').checked = true; $('#returnFields').hidden = false; }
    if (saved.modes) {
      $('#modeCar').checked = saved.modes.car !== false;
      $('#modeTrain').checked = saved.modes.train !== false;
      $('#modePlane').checked = saved.modes.plane !== false;
    }
    if (saved.tab === 'best') state.tab = 'best';
    if (saved.opts) {
      var o = saved.opts;
      if (o.fuel) $('#fuel').value = o.fuel;
      if (o.consumption) $('#consumption').value = o.consumption;
      if (o.fuelPrice) $('#fuelPrice').value = o.fuelPrice;
      if (o.kwhPer100) $('#kwhPer100').value = o.kwhPer100;
      if (o.kwhPrice) $('#kwhPrice').value = o.kwhPrice;
      $('#tollProfile').value = o.tolls === false ? 'non' : 'oui';
      $('#includeWear').checked = !!o.includeWear;
      if (o.railClass) $('#railClass').value = o.railClass;
      if (o.railCard) $('#railCard').value = o.railCard;
      if (o.railTransferMin != null) $('#railTransferMin').value = o.railTransferMin;
      if (o.checkinMin) $('#checkinMin').value = o.checkinMin;
      if (o.disembarkMin) $('#disembarkMin').value = o.disembarkMin;
      $('#hold').checked = !!o.hold;
      $('#useLive').checked = o.useLive !== false;
      $('#liveRail').checked = o.liveRail !== false;
    }
    return true;
  }

  /* ------------------------------------------------- resolution des lieux --- */

  function resolveStops() {
    var jobs = state.stops.map(function (stop) {
      if (stop.place) return Promise.resolve(stop.place);
      var q = (stop.query || '').trim();
      if (!q) return Promise.resolve(null);
      var local = E.searchPlaces(q, 1)[0];
      if (local) { stop.place = local; stop.anchor = { type: 'city' }; return Promise.resolve(local); }
      if (!state.opts.useLive || !T.providers.available) return Promise.resolve(null);
      return T.providers.geocode(q).then(function (rows) {
        if (!rows.length) return null;
        stop.place = E.buildCustomPlace(rows[0].label, rows[0].lat, rows[0].lon,
          { country: rows[0].country, cc: rows[0].cc });
        stop.anchor = null;
        return stop.place;
      });
    });
    return Promise.all(jobs);
  }

  function fetchRoute(places) {
    if (!state.opts.useLive || !T.providers.available || !state.modes.car) {
      return Promise.resolve({ route: null, status: state.modes.car ? 'off' : 'none' });
    }
    return T.providers.route(places).then(function (r) {
      var ok = r && r.legs && r.legs.length === places.length - 1;
      return { route: ok ? r : null, status: ok ? 'live' : 'fallback' };
    });
  }

  /* --------------------------------------------------------- calcul --------- */

  function modeAvailable(leg, mode) {
    if (!state.modes[mode]) return false;
    if (mode === 'car') return leg.car.available;
    return leg[mode].available;
  }

  function defaultMode(leg) {
    var best = null, bestDur = Infinity;
    MODE_ORDER.forEach(function (m) {
      if (!state.modes[m]) return;
      var d = E.legDuration(leg, m, state.opts);
      if (d != null && d < bestDur) { bestDur = d; best = m; }
    });
    return best;
  }

  function offersFor(leg, mode) {
    if (mode === 'train') return leg.train.available ? leg.train.offers : [];
    if (mode === 'plane') return leg.plane.available ? leg.plane.offers : [];
    return [];
  }

  /* Recalcule les segments d'une direction en chainant les horaires. */
  function computeLegs(dir, startDate, holds) {
    var places = dir.places;
    var now = new Date();
    var t = new Date(startDate.getTime());
    var legs = [];
    for (var i = 0; i < places.length - 1; i++) {
      var measured = dir.route && dir.route.legs[i] ? dir.route.legs[i] : null;
      var leg = E.computeLeg(places[i], places[i + 1], t, state.opts, now, measured);
      leg.index = i;

      var pick = dir.picks[i] || (dir.picks[i] = { mode: null, offer: -1 });
      if (!pick.mode || !modeAvailable(leg, pick.mode)) {
        pick.mode = defaultMode(leg);
        pick.offer = -1;
      }
      /* horaires reels deja obtenus pour ce segment : ils remplacent le modele */
      leg.liveKey = railKey(leg);
      var live = leg.liveKey && liveRail.cache[leg.liveKey];
      if (live && live !== 'pending' && live.length) E.applyLiveRail(leg, live, state.opts);

      var offers = offersFor(leg, pick.mode);
      if (pick.mode && pick.mode !== 'car') {
        if (pick.offer < 0 || pick.offer >= offers.length) pick.offer = 0;
      }
      leg.pick = pick;
      leg.chosen = pick.mode === 'car' ? leg.car : offers[pick.offer];
      legs.push(leg);

      if (leg.chosen) {
        var arrive = pick.mode === 'car'
          ? new Date(t.getTime() + leg.car.durationMin * 60000)
          : new Date(leg.chosen.arrivee.getTime() + (leg.chosen.egressMin || 0) * 60000);
        t = new Date(arrive.getTime() + ((holds[i + 1] || 0) * 3600000));
      } else {
        t = new Date(t.getTime() + 3600000);
      }
    }
    return legs;
  }

  /* Cle stable d'un segment ferroviaire : gares retenues et heure demandee. */
  function railKey(leg) {
    if (!leg.train.available || !leg.train.offers.length) return null;
    var o = leg.train.offers[0];
    if (!o.fromStation || !o.toStation) return null;
    return [o.fromStation.name, o.toStation.name, leg.depart.toISOString().slice(0, 13)].join('|');
  }

  /* Lance les recherches d'horaires reels, puis redessine a leur arrivee. */
  function fetchLiveRail(legs) {
    if (!state.opts.useLive || !state.opts.liveRail || !T.providers.available) return;
    var started = false;
    legs.slice(0, 3).forEach(function (leg) {
      var key = leg.liveKey;
      if (!key || liveRail.cache[key] !== undefined) return;
      var first = leg.train.offers[0];
      liveRail.cache[key] = 'pending';
      liveRail.status[key] = { state: 'pending', label: leg.from.name + ' — ' + leg.to.name };
      started = true;
      T.providers.railJourneys(first.fromStation, first.toStation, leg.depart, 6).then(function (res) {
        if (res && res.offers && res.offers.length) {
          liveRail.cache[key] = res.offers;
          liveRail.status[key] = {
            state: 'ok', label: leg.from.name + ' — ' + leg.to.name,
            detail: res.offers.length + ' trajets releves', source: res.source
          };
        } else {
          liveRail.cache[key] = null;
          liveRail.status[key] = {
            state: 'ko', label: leg.from.name + ' — ' + leg.to.name,
            detail: (res && res.error) || 'aucun resultat'
          };
        }
        render();
      });
    });
    if (started) renderRailStatus();
  }

  function renderRailStatus() {
    var box = $('#railStatus');
    if (!box) return;
    var keys = Object.keys(liveRail.status);
    if (!keys.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = keys.map(function (k) {
      var st = liveRail.status[k];
      var text = st.state === 'pending' ? 'recherche des horaires reels'
        : st.state === 'ok' ? st.detail + ' — source ' + st.source
        : 'horaires reels indisponibles (' + st.detail + '), repli sur le modele';
      return '<span class="rail-status rail-status--' + st.state + '">' +
        esc(st.label) + ' : ' + esc(text) + '</span>';
    }).join('');
  }

  function itineraryTotals(legs) {
    var out = {};
    MODE_ORDER.forEach(function (m) {
      var okAll = legs.every(function (l) { return modeAvailable(l, m); });
      if (!okAll) {
        var blocked = legs.filter(function (l) { return !modeAvailable(l, m); })[0];
        out[m] = {
          available: false,
          reason: !state.modes[m] ? 'Mode non retenu dans la comparaison'
            : (m === 'car' ? blocked.car.reason : blocked[m].reason)
        };
        return;
      }
      var dur = 0, price = 0, co2 = 0, km = 0;
      legs.forEach(function (l) {
        dur += E.legDuration(l, m, state.opts);
        price += E.legPrice(l, m, state.opts);
        co2 += E.legCo2(l, m);
        km += m === 'car' ? l.car.distanceKm : (m === 'train' ? l.train.distanceKm : l.plane.distanceKm);
      });
      out[m] = { available: true, durationMin: dur, price: price, co2: co2, km: km };
    });
    return out;
  }

  /* ---------------------------------------------------------- rendu --------- */

  var results = $('#results'), bestPanel = $('#best');

  function badge(text, kind) {
    return '<span class="badge' + (kind ? ' badge--' + kind : '') + '">' + esc(text) + '</span>';
  }

  function renderComparison(legs, totals) {
    var avail = MODE_ORDER.filter(function (m) { return totals[m].available; });
    var bestDur = null, bestPrice = null, bestCo2 = null;
    avail.forEach(function (m) {
      if (bestDur === null || totals[m].durationMin < totals[bestDur].durationMin) bestDur = m;
      if (bestPrice === null || totals[m].price < totals[bestPrice].price) bestPrice = m;
      if (bestCo2 === null || totals[m].co2 < totals[bestCo2].co2) bestCo2 = m;
    });

    var multi = state.opts.passengers > 1;
    var rows = MODE_ORDER.map(function (m) {
      var t = totals[m];
      if (!t.available) {
        return '<tr class="mode-row mode-row--' + m + ' mode-row--off"><td><span class="mode-name">' +
          MODES[m].label + '</span></td><td colspan="' + (multi ? 4 : 3) + '">' +
          esc(t.reason || 'Indisponible sur cet itineraire') + '</td></tr>';
      }
      return '<tr class="mode-row mode-row--' + m + '">' +
        '<td><span class="mode-name">' + MODES[m].label + '</span>' +
        '<span class="mode-sub">' + fmtKm(t.km) +
        (m === 'car' && state.opts.passengers > 1 ? ' — frais partages entre ' + state.opts.passengers + ' voyageurs' : '') + '</span></td>' +
        '<td class="num">' + fmtDur(t.durationMin) + (m === bestDur ? '<span class="flag flag--best">le plus rapide</span>' : '') + '</td>' +
        '<td class="num">' + fmtPrice(Math.round(t.price * 100) / 100) + (m === bestPrice ? '<span class="flag flag--best">le moins cher</span>' : '') + '</td>' +
        '<td class="num">' + fmtCo2(t.co2) + (m === bestCo2 ? '<span class="flag flag--best">le plus sobre</span>' : '') + '</td>' +
        (multi ? '<td class="num">' + fmtPrice(Math.round(t.price * state.opts.passengers * 100) / 100) + '</td>' : '') +
        '</tr>';
    }).join('');

    var maxDur = 0, maxPrice = 0;
    avail.forEach(function (m) {
      maxDur = Math.max(maxDur, totals[m].durationMin);
      maxPrice = Math.max(maxPrice, totals[m].price);
    });
    function barSet(caption, key, format, max) {
      return '<div class="bars__caption">' + caption + '</div>' + avail.map(function (m) {
        var v = totals[m][key];
        return '<div class="bar"><span class="bar__label">' + MODES[m].label + '</span>' +
          '<span class="bar__track"><span class="bar__fill bar__fill--' + m + '" style="width:' +
          Math.max(2, (v / max) * 100).toFixed(1) + '%"></span>' +
          '<span class="bar__value">' + format(v) + '</span></span></div>';
      }).join('');
    }

    return '<section class="rsection">' +
      '<div class="rsection__head"><h2>Comparaison des modes</h2>' +
      '<span class="rsection__note">Duree porte a porte, hors attente entre segments — prix par voyageur</span></div>' +
      '<div class="table-scroll"><table class="grid"><thead><tr>' +
      '<th>Mode</th><th class="num">Duree la plus courte</th><th class="num">Prix le plus bas</th>' +
      '<th class="num">CO<sub>2</sub> / voyageur</th>' +
      (multi ? '<th class="num">Total ' + state.opts.passengers + ' voyageurs</th>' : '') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (avail.length > 1 ? '<div class="bars">' + barSet('Duree', 'durationMin', fmtDur, maxDur) +
        barSet('Prix par voyageur', 'price', function (v) { return fmtPrice(Math.round(v)); }, maxPrice) + '</div>' : '') +
      '</section>';
  }

  function carPanel(leg) {
    var c = leg.car;
    if (!c.available) return '<p class="unavailable">' + esc(c.reason) + '</p>';
    var items = c.breakdown.map(function (b) {
      return '<li><span>' + esc(b.label) + '</span><strong>' + fmtPrice(b.value) + '</strong></li>';
    }).join('');
    return '<div class="table-scroll"><table class="grid"><thead><tr>' +
      '<th>Trajet</th><th class="num">Depart</th><th class="num">Arrivee</th><th class="num">Distance</th>' +
      '<th class="num">Conduite</th><th class="num">Cout par personne</th></tr></thead><tbody><tr>' +
      '<td><span class="op-name">Vehicule personnel</span><span class="op-sub">' +
      (c.source === 'osrm' ? 'Itineraire mesure via OSRM' : 'Distance estimee') +
      (c.ferry ? ' — ' + esc(c.ferry) : '') + '</span></td>' +
      '<td class="num time">' + fmtClock(c.depart, c.depart) + '</td>' +
      '<td class="num time">' + fmtClock(c.arrivee, c.depart) + '</td>' +
      '<td class="num">' + fmtKm(c.distanceKm) + '</td>' +
      '<td class="num">' + fmtDur(c.driveMin) + (c.breaksMin ? ' <span class="flag">+ ' + c.breaksMin + ' min de pause</span>' : '') + '</td>' +
      '<td class="num">' + fmtPrice(c.costPerPerson) + '</td></tr></tbody></table></div>' +
      '<ul class="breakdown">' + items +
      '<li><span>Total du vehicule' + (c.occupants > 1 ? ' (partage a ' + c.occupants + ')' : '') + '</span><strong>' + fmtPrice(c.costTotal) + '</strong></li>' +
      '<li><span>Emissions par personne</span><strong>' + fmtCo2(c.co2PerPerson) + '</strong></li></ul>' +
      (c.peak ? '<p class="rsection__note">Depart en heure de pointe : une majoration de temps a ete appliquee.</p>' : '');
  }

  function offersPanel(dirKey, dir, leg, mode) {
    var res = leg[mode];
    if (!res.available) return '<p class="unavailable">' + esc(res.reason) + '</p>';
    var ref = leg.depart;
    var key = leg.index + ':' + mode;
    var expanded = dir.expanded[key];
    var shown = expanded ? res.offers : res.offers.slice(0, 8);
    if (!expanded && leg.pick.offer >= shown.length && res.offers[leg.pick.offer]) {
      shown = res.offers.slice(0, leg.pick.offer + 1);
    }
    var rows = shown.map(function (o, idx) {
      var picked = leg.pick.mode === mode && leg.pick.offer === idx;
      var tags = '';
      if (o === res.cheapest) tags += '<span class="flag flag--best">prix mini</span>';
      if (o === res.fastest && o !== res.cheapest) tags += '<span class="flag flag--best">plus rapide</span>';
      if (o.night) tags += '<span class="flag">de nuit</span>';
      if (o.generic) tags += '<span class="flag">estimation generique</span>';
      var sub = mode === 'train'
        ? esc(o.company + ' — ' + o.klass)
        : esc(o.company + ' — vol ' + o.code);
      var link = (o.transfers ? o.transfers + (mode === 'train' ? ' correspondance' + (o.transfers > 1 ? 's' : '') : ' escale' + (o.transfers > 1 ? 's' : '')) : 'direct');
      if (o.source === 'reel') tags += '<span class="src-tag">horaire reel</span>';
      if (o.source === 'reel' && o.priceSource === 'estime') tags += '<span class="src-tag src-tag--model">prix estime</span>';
      return '<tr class="' + (picked ? 'picked' : '') + '">' +
        '<td><input type="radio" class="offer-pick" name="pick-' + dirKey + '-' + leg.index + '" ' +
        'data-dir="' + dirKey + '" data-leg="' + leg.index + '" data-mode="' + mode + '" data-offer="' + idx + '"' + (picked ? ' checked' : '') +
        ' aria-label="Retenir ' + esc(o.operator) + ' au depart de ' + hhmm(o.depart) + '"></td>' +
        '<td><span class="op-name">' + esc(o.operator) + '</span><span class="op-sub">' + sub + '</span>' +
        '<span class="op-sub">' + esc(o.fromLabel) + ' vers ' + esc(o.toLabel) + '</span></td>' +
        '<td class="num time">' + fmtClock(o.depart, ref) + '</td>' +
        '<td class="num time">' + fmtClock(o.arrivee, ref) + '</td>' +
        '<td class="num">' + fmtDur(o.durationMin) + '<span class="op-sub">' + fmtDur(o.doorToDoorMin) + ' porte a porte — ' + link + '</span></td>' +
        '<td class="num">' + fmtPrice(o.pricePerPerson) + tags +
        (state.opts.passengers > 1 ? '<span class="op-sub">' + fmtPrice(o.price) + ' au total</span>' : '') +
        '<span class="op-sub"><a href="' + esc(o.url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(shortHost(o.url)) + '</a></span></td>' +
        '</tr>';
    }).join('');

    var accessNote = mode === 'train'
      ? 'Acces aux gares compte pour ' + res.offers[0].accessMin + ' min au depart et ' + res.offers[0].egressMin + ' min a l arrivee.'
      : 'Porte a porte : ' + res.offers[0].accessMin + ' min avant le vol (acces et enregistrement) et ' + res.offers[0].egressMin + ' min apres.';

    var more = res.offers.length > shown.length
      ? '<button type="button" class="btn btn--ghost more" data-dir="' + dirKey + '" data-leg="' + leg.index + '" data-mode="' + mode + '">' +
        'Afficher les ' + (res.offers.length - shown.length) + ' autres departs</button>'
      : '';

    return '<div class="table-scroll"><table class="grid"><thead><tr>' +
      '<th><span class="sr">Choix</span></th><th>Compagnie et points d arret</th><th class="num">Depart</th><th class="num">Arrivee</th>' +
      '<th class="num">Duree</th><th class="num">Prix / voyageur</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' + more +
      '<p class="rsection__note" style="margin-top:10px">' + esc(accessNote) +
      ' Distance retenue : ' + fmtKm(res.distanceKm) + '. Tarifs estimes par le modele, a verifier aupres de la compagnie.</p>';
  }

  /* Deroule concret du trajet retenu : ce que recouvrent les minutes annoncees. */
  function timeline(leg, mode, service) {
    if (!service) return '';
    var steps = E.itinerarySteps(leg, mode, service, state.opts);
    if (!steps.length) return '';
    var total = mode === 'car' ? service.durationMin
      : (service.doorToDoorMin || service.durationMin);
    var rows = steps.map(function (st) {
      return '<li class="tl__row tl__row--' + st.kind + '">' +
        '<span class="tl__time">' + (st.start ? hhmm(st.start) : '') + '</span>' +
        '<span class="tl__mark" aria-hidden="true"></span>' +
        '<span class="tl__body"><b>' + esc(st.label) + '</b>' +
        '<span>' + (st.min ? fmtDur(st.min) : '') +
        (st.detail ? (st.min ? ' — ' : '') + esc(st.detail) : '') + '</span></span>' +
        '</li>';
    }).join('');
    var last = steps[steps.length - 1];
    return '<section class="tl">' +
      '<h4 class="tl__head">Deroule du trajet retenu' +
      '<span>' + fmtDur(total) + ' porte a porte, arrivee a ' + (last.end ? hhmm(last.end) : '—') + '</span></h4>' +
      '<ol class="tl__list">' + rows +
      '<li class="tl__row tl__row--end"><span class="tl__time">' + (last.end ? hhmm(last.end) : '') + '</span>' +
      '<span class="tl__mark" aria-hidden="true"></span>' +
      '<span class="tl__body"><b>Arrivee ' + esc(leg.to.name) + '</b></span></li>' +
      '</ol></section>';
  }

  function legCard(dirKey, dir, leg, holds) {
    var tabs = MODE_ORDER.map(function (m) {
      var enabled = state.modes[m];
      var ok = enabled && modeAvailable(leg, m);
      var dur = ok ? E.legDuration(leg, m, state.opts) : null;
      var price = ok ? E.legPrice(leg, m, state.opts) : null;
      var selected = leg.pick.mode === m;
      return '<button type="button" class="tab tab--' + m + '" role="tab" data-dir="' + dirKey + '" data-leg="' + leg.index + '" data-mode="' + m + '"' +
        ' aria-selected="' + (selected ? 'true' : 'false') + '"' + (ok ? '' : ' disabled') + '>' +
        '<span class="tab__name">' + MODES[m].label + '</span>' +
        '<span class="tab__main">' + (ok ? fmtDur(dur) : (enabled ? 'indisponible' : 'non compare')) + '</span>' +
        '<span class="tab__sub">' + (ok ? 'a partir de ' + fmtPrice(Math.round(price * 100) / 100) : '&nbsp;') + '</span>' +
        '</button>';
    }).join('');

    var body = leg.pick.mode === 'car' ? carPanel(leg)
      : leg.pick.mode ? offersPanel(dirKey, dir, leg, leg.pick.mode)
      : '<p class="unavailable">Aucun mode disponible sur ce segment avec les options retenues.</p>';
    if (leg.chosen && leg.pick.mode) body += timeline(leg, leg.pick.mode, leg.chosen);

    var holdHours = holds[leg.index + 1] || 0;

    return '<article class="leg">' +
      '<div class="leg__head"><h3 class="leg__title">' + (leg.index + 1) + '. ' +
      esc(leg.from.name) + ' — ' + esc(leg.to.name) + '</h3>' +
      '<span class="leg__meta">' + fmtKm(leg.geoKm) + ' a vol d oiseau — depart le ' + fmtDate(leg.depart) + ' vers ' + hhmm(leg.depart) +
      (holdHours ? ' — arret de ' + holdHours + ' h a l etape' : '') + '</span></div>' +
      '<div class="leg__tabs" role="tablist">' + tabs + '</div>' +
      '<div class="leg__body">' + body + '</div>' +
      '</article>';
  }

  function tripSummary(legs, holds) {
    var travel = 0, price = 0, co2 = 0, ok = true, path = [];
    legs.forEach(function (l) {
      if (!l.chosen) { ok = false; return; }
      if (l.pick.mode === 'car') {
        travel += l.car.durationMin; price += l.car.costPerPerson; co2 += l.car.co2PerPerson;
      } else {
        travel += l.chosen.durationMin + (l.chosen.accessMin || 0) + (l.chosen.egressMin || 0);
        price += l.chosen.pricePerPerson; co2 += l.chosen.co2PerPerson;
      }
      path.push(MODES[l.pick.mode].label);
    });
    if (!ok) return null;
    var first = legs[0], last = legs[legs.length - 1];
    var start = first.pick.mode === 'car' ? first.car.depart
      : new Date(first.chosen.depart.getTime() - (first.chosen.accessMin || 0) * 60000);
    var arrival = last.pick.mode === 'car' ? last.car.arrivee
      : new Date(last.chosen.arrivee.getTime() + (last.chosen.egressMin || 0) * 60000);
    var dur = (arrival - start) / 60000;
    var hold = 0;
    legs.forEach(function (l, i) { if (i > 0) hold += (holds[i] || 0) * 60; });
    return {
      path: path, travel: travel, dur: dur, hold: hold,
      wait: Math.max(0, dur - travel - hold),
      price: Math.round(price * 100) / 100, co2: co2,
      start: start, arrival: arrival
    };
  }

  function totalBar(sum, label) {
    if (!sum) return '';
    return '<div class="total"><div class="total__set">' +
      '<div class="total__item"><span class="total__key">' + (label || 'Itineraire retenu') + '</span><span class="total__path">' +
      sum.path.join(' puis ') + (sum.wait > 4 ? ' — ' + fmtDur(sum.wait) + ' d attente' : '') +
      (sum.hold ? ' — ' + fmtDur(sum.hold) + ' sur place' : '') + '</span></div>' +
      '<div class="total__item"><span class="total__key">Duree de bout en bout</span><span class="total__val">' + fmtDur(sum.dur) + '</span></div>' +
      '<div class="total__item"><span class="total__key">Dont transport</span><span class="total__val">' + fmtDur(sum.travel) + '</span></div>' +
      '<div class="total__item"><span class="total__key">Prix par voyageur</span><span class="total__val">' + fmtPrice(sum.price) + '</span></div>' +
      '<div class="total__item"><span class="total__key">CO<sub>2</sub> par voyageur</span><span class="total__val">' + fmtCo2(sum.co2) + '</span></div>' +
      '<div class="total__item"><span class="total__key">Arrivee</span><span class="total__val">' + fmtDate(sum.arrival) + ' ' + hhmm(sum.arrival) + '</span></div>' +
      '</div></div>';
  }

  function directionBlock(dirKey, dir, legs, holds, title, startDate) {
    var totals = itineraryTotals(legs);
    var sum = tripSummary(legs, holds);
    var head = '<div class="direction-head"><h2>' + esc(title) + '</h2>' +
      '<span>' + fmtDate(startDate) + ', depart vers ' + hhmm(startDate) + '</span></div>';
    return '<div class="direction">' + head +
      renderComparison(legs, totals) +
      '<section class="rsection"><div class="rsection__head"><h2>Segments et offres</h2>' +
      '<span class="rsection__note">Choisissez un mode et un depart par segment</span></div>' +
      legs.map(function (l) { return legCard(dirKey, dir, l, holds); }).join('') + '</section>' +
      totalBar(sum, 'Itineraire retenu') + '</div>';
  }

  /* ------------------------------------------------------ meilleur trajet --- */

  function optionRow(dirKey, opt, index, criterion) {
    var open = state.bestOpen[dirKey] === index;
    var chain = opt.steps.map(function (s, i) {
      return (i ? '<span class="opt__arrow">›</span>' : '') +
        '<span class="opt__seg opt__seg--' + s.mode + '">' + MODES[s.mode].label + '</span>' +
        '<span class="opt__arrow">' + esc(s.to.name) + '</span>';
    }).join('');

    var detail = '';
    if (open) {
      var rows = opt.steps.map(function (s) {
        return '<tr><td><span class="op-name">' + MODES[s.mode].label + '</span>' +
          '<span class="op-sub">' + esc(s.operator) + '</span></td>' +
          '<td><span class="op-sub">' + esc(s.from.name) + ' vers ' + esc(s.to.name) + '</span>' +
          (s.fromLabel ? '<span class="op-sub">' + esc(s.fromLabel) + ' — ' + esc(s.toLabel) + '</span>' : '') + '</td>' +
          '<td class="num time">' + fmtClock(s.depart, opt.depart) + '</td>' +
          '<td class="num time">' + fmtClock(s.arrivee, opt.depart) + '</td>' +
          '<td class="num">' + fmtDur(s.durationMin) + '</td>' +
          '<td class="num">' + fmtPrice(s.price) + '</td></tr>';
      }).join('');
      var mixed = opt.steps.some(function (s) { return s.mode === 'car'; }) && opt.steps.length > 1;
      var deroule = opt.steps.map(function (s) {
        var pseudoLeg = { from: s.from, to: s.to, depart: s.depart };
        return timeline(pseudoLeg, s.mode, s);
      }).join('');
      detail = '<div class="opt__detail"><div class="table-scroll"><table class="grid"><thead><tr>' +
        '<th>Mode</th><th>Segment</th><th class="num">Depart</th><th class="num">Arrivee</th>' +
        '<th class="num">Duree</th><th class="num">Prix</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        deroule +
        '<p class="rsection__note" style="margin-top:10px">' +
        (mixed ? 'Un segment en voiture au milieu d un trajet suppose un vehicule disponible sur place (location ou covoiturage), non compte dans le prix. ' : '') +
        'Temps total hors attente avant le premier depart. ' +
        '<button type="button" class="btn btn--ghost apply-opt" data-dir="' + dirKey + '" data-index="' + index + '">Reprendre cet itineraire dans le comparateur</button></p></div>';
    }

    return '<article class="opt' + (index === 0 ? ' opt--best' : '') + '">' +
      '<button type="button" class="opt__head" data-dir="' + dirKey + '" data-index="' + index + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="opt__rank">' + (index + 1) + '</span>' +
      '<span><span class="opt__label">' + esc(R.describe(opt)) + '</span>' +
      '<span class="opt__chain">' + chain + '</span></span>' +
      '<span class="opt__figs">' +
      '<span class="opt__fig"><b>' + fmtDur(opt.durationMin) + '</b><span>duree</span></span>' +
      '<span class="opt__fig"><b>' + fmtPrice(Math.round(opt.price)) + '</b><span>par voyageur</span></span>' +
      '<span class="opt__fig"><b>' + hhmm(opt.depart) + ' › ' + hhmm(opt.arrivee) + '</b><span>' + fmtCo2(opt.co2) + ' CO<sub>2</sub></span></span>' +
      '</span></button>' + detail + '</article>';
  }

  function bestBlock(dirKey, dir, title, startDate) {
    var list = dir.best || [];
    if (!list.length) {
      return '<div class="direction"><div class="direction-head"><h2>' + esc(title) + '</h2></div>' +
        '<p class="unavailable">Aucun itineraire praticable entre ces deux lieux avec les modes retenus.</p></div>';
    }
    var ranked = R.condense(list, state.criterion, 10, startDate);
    return '<div class="direction"><div class="direction-head"><h2>' + esc(title) + '</h2>' +
      '<span>' + ranked.length + ' itineraires retenus sur ' + list.length + ' combinaisons evaluees</span></div>' +
      ranked.map(function (o, i) { return optionRow(dirKey, o, i, state.criterion); }).join('') + '</div>';
  }

  function renderBest() {
    var dep = departureDate();
    var html = '<div class="sortbar"><span>Classer par</span>' +
      [['duration', 'duree'], ['price', 'prix'], ['co2', 'emissions']].map(function (c) {
        return '<button type="button" class="sort-btn" data-criterion="' + c[0] + '" aria-pressed="' +
          (state.criterion === c[0] ? 'true' : 'false') + '">' + c[1] + '</button>';
      }).join('') +
      '<span class="rsection__note">Voiture, train, avion et combinaisons avec une correspondance — horaires du modele</span></div>';

    html += bestBlock('out', state.out, state.roundTrip ? 'Aller' : 'Itineraires possibles', dep);
    if (state.roundTrip && state.back.best) {
      html += bestBlock('back', state.back, 'Retour', returnDate());
    }
    bestPanel.innerHTML = html;

    all('.sort-btn', bestPanel).forEach(function (b) {
      b.addEventListener('click', function () {
        state.criterion = b.getAttribute('data-criterion');
        state.bestOpen = {};
        renderBest();
        renderMap();
      });
    });
    all('.opt__head', bestPanel).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-dir'), i = +b.getAttribute('data-index');
        state.bestOpen[d] = state.bestOpen[d] === i ? -1 : i;
        renderBest();
        renderMap();
      });
    });
    all('.apply-opt', bestPanel).forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        applyOption(b.getAttribute('data-dir'), +b.getAttribute('data-index'));
      });
    });
  }

  /* Reprend un itineraire propose dans le comparateur : le point de
     correspondance devient une etape et les modes sont preselectionnes. */
  function applyOption(dirKey, index) {
    var dir = state[dirKey];
    var ranked = R.condense(dir.best || [], state.criterion, 10,
      dirKey === 'out' ? departureDate() : returnDate());
    var opt = ranked[index];
    if (!opt) return;
    if (opt.via) {
      /* la correspondance n'est cherchee que sur une relation a deux points :
         l'etape s'insere donc entre le depart et l'arrivee, dans les deux sens */
      var hub = newStop(opt.via.name);
      hub.place = opt.via;
      hub.anchor = { type: 'city' };
      state.stops.splice(state.stops.length - 1, 0, hub);
      renderStops();
      persist();
      state.out.picks = [];
      state.back.picks = [];
      state.tab = 'compare';
      syncTabs();
      run(null, { dir: dirKey, modes: opt.modes });
      return;
    }
    dir.picks = opt.modes.map(function (m) { return { mode: m, offer: -1 }; });
    state.tab = 'compare';
    syncTabs();
    render();
    renderMap();
  }

  /* ------------------------------------------------------------- carte ----- */

  function mapSegments() {
    if (state.tab === 'best') {
      /* la carte suit l'itineraire aller, celui que la liste met en avant */
      var dirKey = 'out';
      var dir = state[dirKey];
      if (!dir.best || !dir.best.length) return null;
      var ranked = R.condense(dir.best, state.criterion, 10, departureDate());
      var idx = state.bestOpen[dirKey];
      var opt = ranked[idx >= 0 ? idx : 0] || ranked[0];
      if (!opt) return null;
      return opt.steps.map(function (s) {
        var path = s.mode === 'plane' ? null : (E.networkPath(s.from, s.to) || {}).nodes;
        return { from: s.from, to: s.to, mode: s.mode, path: path };
      });
    }
    var legs = state.out.legs;
    if (!legs || !legs.length) return previewSegments();
    var route = state.out.route;
    return legs.map(function (l, i) {
      var mode = l.pick.mode || 'car';
      var path = null, measured = false;
      if (mode === 'car' && route && route.legs[i] && route.legs[i].coords && route.legs[i].coords.length > 2) {
        path = route.legs[i].coords;      /* trace routiere reelle */
        measured = true;
      } else if (mode !== 'plane') {
        path = (E.networkPath(l.from, l.to) || {}).nodes;
      }
      return { from: l.from, to: l.to, mode: mode, path: path, measured: measured };
    });
  }

  /* Avant tout calcul, la carte situe deja les points saisis. */
  function previewSegments() {
    var places = state.stops.map(stopPlace).filter(Boolean);
    if (places.length < 2) return null;
    var segs = [];
    for (var i = 0; i < places.length - 1; i++) {
      segs.push({
        from: places[i], to: places[i + 1], mode: 'pending',
        path: (E.networkPath(places[i], places[i + 1]) || {}).nodes
      });
    }
    return segs;
  }

  function renderMap() {
    var segs = mapSegments();
    var fig = $('#map');
    if (!segs) { fig.hidden = true; return; }
    fig.hidden = false;
    T.map.render($('#mapCanvas'), $('#mapLegend'), segs);
  }

  /* ------------------------------------------------------------- rendu ----- */

  function holdsFor(dirKey) {
    var holds = state.stops.map(function (s) { return s.hold || 0; });
    return dirKey === 'back' ? holds.slice().reverse() : holds;
  }

  function render() {
    if (!state.computed) return;
    var dep = departureDate();
    state.out.legs = computeLegs(state.out, dep, holdsFor('out'));

    var routeBadge = state.out.routeStatus === 'live'
      ? badge('Route mesuree — OSRM', 'live')
      : state.out.routeStatus === 'fallback'
        ? badge('Service OSRM injoignable — distances estimees', 'model')
        : state.out.routeStatus === 'off'
          ? badge('Distances routieres estimees', 'model')
          : '';

    var html = '<div class="badges">' + routeBadge +
      badge('Horaires et tarifs : modele TravIA', 'model') +
      badge(state.stops.length + ' points, ' + state.out.legs.length + ' segment' + (state.out.legs.length > 1 ? 's' : '') +
        (state.roundTrip ? ', aller-retour' : ''), '') +
      badge('Calcule le ' + new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }), '') +
      '</div><div class="rail-status-bar" id="railStatus" hidden></div>';

    html += directionBlock('out', state.out, state.out.legs, holdsFor('out'),
      state.roundTrip ? 'Aller' : 'Itineraire', dep);

    var sumOut = tripSummary(state.out.legs, holdsFor('out'));
    var sumBack = null;
    if (state.roundTrip && state.back.places) {
      state.back.legs = computeLegs(state.back, returnDate(), holdsFor('back'));
      html += directionBlock('back', state.back, state.back.legs, holdsFor('back'), 'Retour', returnDate());
      sumBack = tripSummary(state.back.legs, holdsFor('back'));
    }
    if (sumOut && sumBack) {
      html += '<div class="total"><div class="total__set">' +
        '<div class="total__item"><span class="total__key">Aller-retour</span><span class="total__path">' +
        sumOut.path.join(' puis ') + ' — retour ' + sumBack.path.join(' puis ') + '</span></div>' +
        '<div class="total__item"><span class="total__key">Transport cumule</span><span class="total__val">' +
        fmtDur(sumOut.travel + sumBack.travel) + '</span></div>' +
        '<div class="total__item"><span class="total__key">Prix par voyageur</span><span class="total__val">' +
        fmtPrice(Math.round((sumOut.price + sumBack.price) * 100) / 100) + '</span></div>' +
        '<div class="total__item"><span class="total__key">CO<sub>2</sub> par voyageur</span><span class="total__val">' +
        fmtCo2(sumOut.co2 + sumBack.co2) + '</span></div>' +
        (state.opts.passengers > 1 ? '<div class="total__item"><span class="total__key">Total ' + state.opts.passengers +
          ' voyageurs</span><span class="total__val">' +
          fmtPrice(Math.round((sumOut.price + sumBack.price) * state.opts.passengers * 100) / 100) + '</span></div>' : '') +
        '</div></div>';
    }

    results.innerHTML = html;
    renderRailStatus();
    fetchLiveRail((state.out.legs || []).concat(state.back.legs || []));

    all('.tab', results).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var d = btn.getAttribute('data-dir'), i = +btn.getAttribute('data-leg');
        state[d].picks[i] = { mode: btn.getAttribute('data-mode'), offer: -1 };
        render();
        renderMap();
      });
    });
    all('.more', results).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var d = btn.getAttribute('data-dir');
        state[d].expanded[btn.getAttribute('data-leg') + ':' + btn.getAttribute('data-mode')] = true;
        render();
      });
    });
    all('.offer-pick', results).forEach(function (input) {
      input.addEventListener('change', function () {
        var d = input.getAttribute('data-dir'), i = +input.getAttribute('data-leg');
        state[d].picks[i] = { mode: input.getAttribute('data-mode'), offer: +input.getAttribute('data-offer') };
        render();
        renderMap();
      });
    });

    renderBest();
    renderMap();
  }

  function syncTabs() {
    var compare = state.tab === 'compare';
    $('#tabCompare').setAttribute('aria-selected', compare ? 'true' : 'false');
    $('#tabBest').setAttribute('aria-selected', compare ? 'false' : 'true');
    results.hidden = !compare;
    bestPanel.hidden = compare;
    try { global.history.replaceState(null, '', compare ? '#comparateur' : '#meilleur-itineraire'); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------- pilotage --- */

  var note = $('#formNote');
  function setNote(msg, isError) {
    note.innerHTML = msg || '';
    note.className = 'form-note' + (isError ? ' form-note--error' : '');
  }

  function run(ev, forced) {
    if (ev) ev.preventDefault();
    if (state.busy) return;
    readOptions();
    persist();

    if (!state.modes.car && !state.modes.train && !state.modes.plane) {
      setNote('Selectionnez au moins un mode de transport.', true);
      return;
    }
    if (!$('#date').value) { setNote('Indiquez une date de depart.', true); return; }
    if (state.roundTrip && !$('#returnDate').value) {
      setNote('Indiquez une date de retour, ou decochez le retour.', true);
      return;
    }
    var dep = departureDate(), ret = state.roundTrip ? returnDate() : null;
    if (ret && ret <= dep) {
      setNote('Le retour doit etre posterieur a l aller.', true);
      return;
    }

    var btn = $('#compute');
    state.busy = true;
    btn.disabled = true;
    setNote('<span class="spinner"></span>Resolution des lieux et calcul en cours');

    resolveStops().then(function (raw) {
      var missing = [];
      raw.forEach(function (p, i) {
        if (!p) missing.push(state.stops[i].query || ('point ' + (i + 1)));
      });
      if (missing.length) {
        throw new Error('Lieu introuvable : ' + missing.join(', ') + '. Choisissez une proposition dans la liste.');
      }
      var places = state.stops.map(stopPlace);
      state.out = newDirection();
      state.back = newDirection();
      state.out.places = places;
      if (state.roundTrip) state.back.places = places.slice().reverse();
      return fetchRoute(places);
    }).then(function (res) {
      state.out.route = res.route;
      state.out.routeStatus = res.status;
      if (state.roundTrip && state.back.places) {
        state.back.routeStatus = res.status;
        state.back.route = res.route
          ? { distanceKm: res.route.distanceKm, durationMin: res.route.durationMin, legs: res.route.legs.slice().reverse() }
          : null;
      }
      if (forced && forced.modes) {
        state[forced.dir || 'out'].picks = forced.modes.map(function (m) {
          return { mode: m, offer: -1 };
        });
      }

      var now = new Date();
      state.out.best = R.search(state.out.places, departureDate(), state.opts, now, state.modes,
        state.stops.map(function (s) { return s.hold || 0; }));
      if (state.roundTrip) {
        state.back.best = R.search(state.back.places, returnDate(), state.opts, now, state.modes,
          state.stops.map(function (s) { return s.hold || 0; }).reverse());
      }

      state.computed = true;
      render();
      setNote(state.out.routeStatus === 'live'
        ? 'Distances routieres mesurees sur OpenStreetMap. Tarifs et horaires estimes.'
        : 'Tarifs, horaires et distances estimes par le modele.');
      var panel = state.tab === 'compare' ? results : bestPanel;
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      setNote(esc(err.message || 'Le calcul a echoue.'), true);
    }).then(function () {
      state.busy = false;
      btn.disabled = false;
    });
  }

  /* ------------------------------------------------------------ initialisation */

  function fillCards() {
    var sel = $('#railCard');
    Object.keys(T.RAIL_CARDS).forEach(function (k) {
      var opt = doc.createElement('option');
      opt.value = k;
      opt.textContent = T.RAIL_CARDS[k].label;
      sel.appendChild(opt);
    });
  }

  function syncFuelFields() {
    var electric = $('#fuel').value === 'electrique';
    $('#consField').hidden = electric;
    $('#priceField').hidden = electric;
    $('#kwhField').hidden = !electric;
    $('#kwhPriceField').hidden = !electric;
  }

  function initTheme() {
    var saved;
    try { saved = global.localStorage.getItem('travia.theme'); } catch (e) { saved = null; }
    if (saved) doc.documentElement.setAttribute('data-theme', saved);
    $('#themeToggle').addEventListener('click', function () {
      var current = doc.documentElement.getAttribute('data-theme');
      var isDark = current ? current === 'dark'
        : global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = isDark ? 'light' : 'dark';
      doc.documentElement.setAttribute('data-theme', next);
      try { global.localStorage.setItem('travia.theme', next); } catch (e) { /* ignore */ }
    });
  }

  function init() {
    fillCards();
    initTheme();

    if (T.STANDALONE) {
      var live = $('#useLive');
      live.checked = false;
      live.disabled = true;
      if (live.nextSibling) {
        live.nextSibling.textContent = ' Version autonome : distances et durees calculees par le modele interne, sans appel aux services en ligne.';
      }
    }

    var d = new Date();
    d.setDate(d.getDate() + 21);
    var iso = function (x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
    $('#date').value = iso(d);
    $('#date').min = new Date().toISOString().slice(0, 10);
    var r = new Date(d.getTime() + 3 * 86400000);
    $('#returnDate').value = iso(r);
    $('#returnDate').min = $('#date').min;

    if (!restore()) {
      state.stops = [newStop('Paris'), newStop('Marseille')];
      state.stops[0].place = E.placeById('paris');
      state.stops[0].anchor = { type: 'city' };
      state.stops[1].place = E.placeById('marseille');
      state.stops[1].anchor = { type: 'city' };
    }
    renderStops();
    syncFuelFields();

    if (global.location.hash === '#meilleur-itineraire') state.tab = 'best';
    syncTabs();
    renderMap();

    $('#addStop').addEventListener('click', function () {
      state.stops.splice(state.stops.length - 1, 0, newStop(''));
      renderStops();
      var inputs = stopsBox.querySelectorAll('input[type="text"]');
      inputs[state.stops.length - 2].focus();
    });
    $('#reverse').addEventListener('click', function () {
      state.stops.reverse();
      renderStops();
      persist();
    });
    $('#roundTrip').addEventListener('change', function () {
      $('#returnFields').hidden = !this.checked;
      persist();
    });
    $('#modeAny').addEventListener('click', function () {
      $('#modeCar').checked = true;
      $('#modeTrain').checked = true;
      $('#modePlane').checked = true;
      state.tab = 'best';
      syncTabs();
      persist();
      run(null);
    });
    $('#tabCompare').addEventListener('click', function () {
      state.tab = 'compare'; syncTabs(); renderMap(); persist();
    });
    $('#tabBest').addEventListener('click', function () {
      state.tab = 'best'; syncTabs(); renderMap(); persist();
    });
    $('#fuel').addEventListener('change', syncFuelFields);
    $('#tripForm').addEventListener('submit', run);

    setNote('Referentiel : ' + T.PLACES.length + ' villes, ' + T.RAIL_OPERATORS.length +
      ' operateurs ferroviaires, ' + T.AIRLINES.length + ' compagnies aeriennes.');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

  T.app = { state: state, run: run, render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
