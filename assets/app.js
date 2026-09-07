/* TravIA — interface et orchestration.
   Enchaine : saisie des points -> resolution des lieux -> mesure routiere
   optionnelle -> calcul des trois modes -> rendu comparatif. */
(function (global) {
  'use strict';

  var T = global.TravIA;
  var E = T.engine;
  var doc = global.document;

  /* ------------------------------------------------------------- utilitaires */

  function $(sel, root) { return (root || doc).querySelector(sel); }
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

  var MODES = {
    car: { key: 'car', label: 'Voiture', short: 'VO' },
    train: { key: 'train', label: 'Train', short: 'TR' },
    plane: { key: 'plane', label: 'Avion', short: 'AV' }
  };
  var MODE_ORDER = ['car', 'train', 'plane'];

  /* ------------------------------------------------------------------- etat */

  var state = {
    stops: [],
    opts: Object.assign({}, T.DEFAULTS),
    modes: { car: true, train: true, plane: true },
    resolved: null,
    route: null,
    routeStatus: 'none',
    picks: [],
    expanded: {},
    busy: false
  };

  var uid = 0;
  function newStop(query) {
    return { uid: ++uid, query: query || '', place: null, hold: 0 };
  }

  /* ------------------------------------------------- saisie des points ----- */

  var stopsBox = $('#stops');

  function renderStops() {
    stopsBox.innerHTML = '';
    state.stops.forEach(function (stop, i) {
      var isFirst = i === 0, isLast = i === state.stops.length - 1;
      var row = el('div', 'stop' + (!isFirst && !isLast ? ' stop--via' : ''));

      var key = el('span', 'stop__key', isFirst ? 'D' : isLast ? 'A' : String(i));
      row.appendChild(key);

      var field = el('div', 'stop__field');
      var input = doc.createElement('input');
      input.type = 'text';
      input.value = stop.query;
      input.placeholder = isFirst ? 'Ville, gare ou adresse de depart'
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

  function localMatches(q) {
    return E.searchPlaces(q, 7).map(function (p) {
      var sub = [];
      if (p.rail) sub.push('gare');
      if (p.air.length) sub.push(p.air.map(function (a) { return a.iata; }).join(' / '));
      return { kind: 'local', place: p, label: p.name, sub: p.country + (sub.length ? ' — ' + sub.join(', ') : '') };
    });
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
        stop.query = it.place.name;
      } else {
        stop.place = E.buildCustomPlace(it.label, it.lat, it.lon, { country: it.country, cc: it.cc });
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
      if (state.opts.useLive && q.length >= 3 && T.providers.available) {
        clearTimeout(remoteTimer);
        remoteTimer = setTimeout(function () {
          var current = input.value.trim();
          if (current !== q) return;
          T.providers.geocode(q).then(function (rows) {
            if (input.value.trim() !== q) return;
            var extra = rows.slice(0, 4).map(function (r) {
              return { kind: 'remote', label: r.label, sub: r.detail.split(',').slice(-3).join(',').trim(), lat: r.lat, lon: r.lon, country: r.country, cc: r.cc };
            }).filter(function (r) {
              return !list.some(function (l) { return E.normalize(l.label) === E.normalize(r.label); });
            });
            if (extra.length) open(list.concat(extra));
          });
        }, 520);
      }
    }

    input.addEventListener('input', function () {
      stop.query = input.value;
      stop.place = null;
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
    o.occupants = Math.max(1, parseInt($('#occupants').value, 10) || 1);
    o.tolls = $('#tolls').checked;
    o.includeWear = $('#includeWear').checked;
    o.railClass = $('#railClass').value;
    o.railCard = $('#railCard').value;
    o.railTransferMin = parseInt($('#railTransferMin').value, 10);
    if (isNaN(o.railTransferMin)) o.railTransferMin = T.DEFAULTS.railTransferMin;
    o.checkinMin = parseInt($('#checkinMin').value, 10) || T.DEFAULTS.checkinMin;
    o.disembarkMin = parseInt($('#disembarkMin').value, 10) || T.DEFAULTS.disembarkMin;
    o.hold = $('#hold').checked;
    o.useLive = $('#useLive').checked;
    state.modes.car = $('#modeCar').checked;
    state.modes.train = $('#modeTrain').checked;
    state.modes.plane = $('#modePlane').checked;
  }

  function departureDate() {
    var d = $('#date').value, t = $('#time').value || '08:00';
    var parts = d.split('-'), tp = t.split(':');
    return new Date(+parts[0], +parts[1] - 1, +parts[2], +tp[0], +tp[1]);
  }

  function persist() {
    try {
      global.localStorage.setItem('travia.form', JSON.stringify({
        stops: state.stops.map(function (s) { return { query: s.query, id: s.place && !s.place.custom ? s.place.id : null, lat: s.place && s.place.custom ? s.place.lat : null, lon: s.place && s.place.custom ? s.place.lon : null, hold: s.hold }; }),
        date: $('#date').value, time: $('#time').value,
        passengers: $('#passengers').value,
        modes: state.modes, opts: state.opts
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
      if (s.id) stop.place = E.placeById(s.id);
      else if (s.lat != null) stop.place = E.buildCustomPlace(s.query, s.lat, s.lon, null);
      return stop;
    });
    if (saved.time) $('#time').value = saved.time;
    if (saved.passengers) $('#passengers').value = saved.passengers;
    if (saved.modes) {
      $('#modeCar').checked = saved.modes.car !== false;
      $('#modeTrain').checked = saved.modes.train !== false;
      $('#modePlane').checked = saved.modes.plane !== false;
    }
    if (saved.opts) {
      var o = saved.opts;
      if (o.fuel) $('#fuel').value = o.fuel;
      if (o.consumption) $('#consumption').value = o.consumption;
      if (o.fuelPrice) $('#fuelPrice').value = o.fuelPrice;
      if (o.kwhPer100) $('#kwhPer100').value = o.kwhPer100;
      if (o.kwhPrice) $('#kwhPrice').value = o.kwhPrice;
      if (o.occupants) $('#occupants').value = o.occupants;
      $('#tolls').checked = o.tolls !== false;
      $('#includeWear').checked = !!o.includeWear;
      if (o.railClass) $('#railClass').value = o.railClass;
      if (o.railCard) $('#railCard').value = o.railCard;
      if (o.railTransferMin != null) $('#railTransferMin').value = o.railTransferMin;
      if (o.checkinMin) $('#checkinMin').value = o.checkinMin;
      if (o.disembarkMin) $('#disembarkMin').value = o.disembarkMin;
      $('#hold').checked = !!o.hold;
      $('#useLive').checked = o.useLive !== false;
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
      if (local) { stop.place = local; return Promise.resolve(local); }
      if (!state.opts.useLive || !T.providers.available) return Promise.resolve(null);
      return T.providers.geocode(q).then(function (rows) {
        if (!rows.length) return null;
        stop.place = E.buildCustomPlace(rows[0].label, rows[0].lat, rows[0].lon,
          { country: rows[0].country, cc: rows[0].cc });
        return stop.place;
      });
    });
    return Promise.all(jobs);
  }

  /* --------------------------------------------------------- calcul --------- */

  function fetchRoute(places) {
    if (!state.opts.useLive || !T.providers.available || !state.modes.car) {
      state.routeStatus = state.modes.car ? 'off' : 'none';
      return Promise.resolve(null);
    }
    return T.providers.route(places).then(function (r) {
      state.routeStatus = r ? 'live' : 'fallback';
      return r;
    });
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

  /* Recalcule tous les segments en chainant les horaires selon les choix. */
  function computeAll() {
    var places = state.resolved;
    var now = new Date();
    var t = departureDate();
    var legs = [];
    for (var i = 0; i < places.length - 1; i++) {
      var measured = state.route && state.route.legs && state.route.legs[i] ? state.route.legs[i] : null;
      var leg = E.computeLeg(places[i], places[i + 1], t, state.opts, now, measured);
      leg.index = i;

      var pick = state.picks[i] || (state.picks[i] = { mode: null, offer: 0 });
      if (!pick.mode || !modeAvailable(leg, pick.mode)) {
        pick.mode = defaultMode(leg);
        pick.offer = -1;
      }
      var offers = offersFor(leg, pick.mode);
      if (pick.mode && pick.mode !== 'car') {
        /* par defaut, le premier depart possible apres l'arrivee sur place :
           c'est le choix qui minimise l'attente en correspondance */
        if (pick.offer < 0 || pick.offer >= offers.length) pick.offer = 0;
      }
      leg.pick = pick;
      leg.chosen = pick.mode === 'car' ? leg.car : offers[pick.offer];
      legs.push(leg);

      if (leg.chosen) {
        var arrive = pick.mode === 'car'
          ? new Date(t.getTime() + leg.car.durationMin * 60000)
          : new Date(leg.chosen.arrivee.getTime() + (leg.chosen.egressMin || 0) * 60000);
        t = new Date(arrive.getTime() + (state.stops[i + 1].hold || 0) * 3600000);
      } else {
        t = new Date(t.getTime() + 3600000);
      }
    }
    return legs;
  }

  function modeAvailable(leg, mode) {
    if (!state.modes[mode]) return false;
    if (mode === 'car') return leg.car.available;
    return leg[mode].available;
  }

  /* Meilleur total par mode sur l'ensemble de l'itineraire. */
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

  var results = $('#results');

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
        '<span class="mode-sub">' + fmtKm(t.km) + (m === 'car' && state.opts.occupants > 1 ? ' — cout partage a ' + state.opts.occupants : '') + '</span></td>' +
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

  function offersPanel(leg, mode) {
    var res = leg[mode];
    if (!res.available) return '<p class="unavailable">' + esc(res.reason) + '</p>';
    var ref = leg.depart;
    var expanded = state.expanded[leg.index + ':' + mode];
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
      return '<tr class="' + (picked ? 'picked' : '') + '">' +
        '<td><input type="radio" class="offer-pick" name="pick-' + leg.index + '" ' +
        'data-leg="' + leg.index + '" data-mode="' + mode + '" data-offer="' + idx + '"' + (picked ? ' checked' : '') +
        ' aria-label="Retenir ' + esc(o.operator) + ' au depart de ' + pad(o.depart.getHours()) + 'h' + pad(o.depart.getMinutes()) + '"></td>' +
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
      ? '<button type="button" class="btn btn--ghost more" data-leg="' + leg.index + '" data-mode="' + mode + '">' +
        'Afficher les ' + (res.offers.length - shown.length) + ' autres departs</button>'
      : '';

    return '<div class="table-scroll"><table class="grid"><thead><tr>' +
      '<th><span class="sr">Choix</span></th><th>Compagnie et points d arret</th><th class="num">Depart</th><th class="num">Arrivee</th>' +
      '<th class="num">Duree</th><th class="num">Prix / voyageur</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' + more +
      '<p class="rsection__note" style="margin-top:10px">' + esc(accessNote) +
      ' Distance retenue : ' + fmtKm(res.distanceKm) + '. Tarifs estimes par le modele, a verifier aupres de la compagnie.</p>';
  }

  function legCard(leg) {
    var tabs = MODE_ORDER.map(function (m) {
      var enabled = state.modes[m];
      var ok = enabled && modeAvailable(leg, m);
      var dur = ok ? E.legDuration(leg, m, state.opts) : null;
      var price = ok ? E.legPrice(leg, m, state.opts) : null;
      var selected = leg.pick.mode === m;
      return '<button type="button" class="tab tab--' + m + '" role="tab" data-leg="' + leg.index + '" data-mode="' + m + '"' +
        ' aria-selected="' + (selected ? 'true' : 'false') + '"' + (ok ? '' : ' disabled') + '>' +
        '<span class="tab__name">' + MODES[m].label + '</span>' +
        '<span class="tab__main">' + (ok ? fmtDur(dur) : (enabled ? 'indisponible' : 'non compare')) + '</span>' +
        '<span class="tab__sub">' + (ok ? 'a partir de ' + fmtPrice(Math.round(price * 100) / 100) : '&nbsp;') + '</span>' +
        '</button>';
    }).join('');

    var body = leg.pick.mode === 'car' ? carPanel(leg)
      : leg.pick.mode ? offersPanel(leg, leg.pick.mode)
      : '<p class="unavailable">Aucun mode disponible sur ce segment avec les options retenues.</p>';

    var hold = state.stops[leg.index + 1] && leg.index + 1 < state.stops.length - 1;

    return '<article class="leg">' +
      '<div class="leg__head"><h3 class="leg__title">' + (leg.index + 1) + '. ' +
      esc(leg.from.name) + ' — ' + esc(leg.to.name) + '</h3>' +
      '<span class="leg__meta">' + fmtKm(leg.geoKm) + ' a vol d oiseau — depart le ' + fmtDate(leg.depart) + ' vers ' + pad(leg.depart.getHours()) + ':' + pad(leg.depart.getMinutes()) +
      (hold ? ' — arret de ' + (state.stops[leg.index + 1].hold || 0) + ' h a l etape' : '') + '</span></div>' +
      '<div class="leg__tabs" role="tablist">' + tabs + '</div>' +
      '<div class="leg__body">' + body + '</div>' +
      '</article>';
  }

  function totalBar(legs) {
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
    if (!ok) return '';

    /* duree reelle de bout en bout : du depart du premier segment a l'arrivee
       du dernier, attentes entre correspondances comprises */
    var first = legs[0];
    var start = first.pick.mode === 'car' ? first.car.depart
      : new Date(first.chosen.depart.getTime() - (first.chosen.accessMin || 0) * 60000);
    var last = legs[legs.length - 1];
    var arrival = last.pick.mode === 'car' ? last.car.arrivee
      : new Date(last.chosen.arrivee.getTime() + (last.chosen.egressMin || 0) * 60000);
    var dur = (arrival - start) / 60000;
    var hold = 0;
    legs.forEach(function (l, i) { if (i > 0) hold += (state.stops[i].hold || 0) * 60; });
    var wait = Math.max(0, dur - travel - hold);

    return '<div class="total"><div class="total__set">' +
      '<div class="total__item"><span class="total__key">Itineraire retenu</span><span class="total__path">' +
      path.join(' puis ') + (wait > 4 ? ' — ' + fmtDur(wait) + ' d attente' : '') +
      (hold ? ' — ' + fmtDur(hold) + ' sur place' : '') + '</span></div>' +
      '<div class="total__item"><span class="total__key">Duree de bout en bout</span><span class="total__val">' + fmtDur(dur) + '</span></div>' +
      '<div class="total__item"><span class="total__key">Dont transport</span><span class="total__val">' + fmtDur(travel) + '</span></div>' +
      '<div class="total__item"><span class="total__key">Prix par voyageur</span><span class="total__val">' + fmtPrice(Math.round(price * 100) / 100) + '</span></div>' +
      '<div class="total__item"><span class="total__key">CO<sub>2</sub> par voyageur</span><span class="total__val">' + fmtCo2(co2) + '</span></div>' +
      '<div class="total__item"><span class="total__key">Arrivee</span><span class="total__val">' + fmtDate(arrival) + ' ' + pad(arrival.getHours()) + ':' + pad(arrival.getMinutes()) + '</span></div>' +
      '</div></div>';
  }

  function render() {
    var legs = computeAll();
    state.legs = legs;
    var totals = itineraryTotals(legs);

    var routeBadge = state.routeStatus === 'live'
      ? badge('Route mesuree — OSRM', 'live')
      : state.routeStatus === 'fallback'
        ? badge('Service OSRM injoignable — distances estimees', 'model')
        : state.routeStatus === 'off'
          ? badge('Distances routieres estimees', 'model')
          : '';

    var html = '<div class="badges">' + routeBadge +
      badge('Horaires et tarifs : modele TravIA', 'model') +
      badge(state.stops.length + ' points, ' + legs.length + ' segment' + (legs.length > 1 ? 's' : ''), '') +
      badge('Calcule le ' + new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }), '') +
      '</div>';

    html += renderComparison(legs, totals);
    html += '<section class="rsection"><div class="rsection__head"><h2>Segments et offres</h2>' +
      '<span class="rsection__note">Choisissez un mode et un depart par segment</span></div>' +
      legs.map(legCard).join('') + '</section>';
    html += totalBar(legs);

    results.innerHTML = html;

    Array.prototype.forEach.call(results.querySelectorAll('.tab'), function (btn) {
      btn.addEventListener('click', function () {
        var i = +btn.getAttribute('data-leg');
        state.picks[i] = { mode: btn.getAttribute('data-mode'), offer: -1 };
        render();
      });
    });
    Array.prototype.forEach.call(results.querySelectorAll('.more'), function (btn) {
      btn.addEventListener('click', function () {
        state.expanded[btn.getAttribute('data-leg') + ':' + btn.getAttribute('data-mode')] = true;
        render();
      });
    });
    Array.prototype.forEach.call(results.querySelectorAll('.offer-pick'), function (input) {
      input.addEventListener('change', function () {
        var i = +input.getAttribute('data-leg');
        state.picks[i] = { mode: input.getAttribute('data-mode'), offer: +input.getAttribute('data-offer') };
        render();
      });
    });
  }

  /* ------------------------------------------------------------- pilotage --- */

  var note = $('#formNote');
  function setNote(msg, isError) {
    note.innerHTML = msg || '';
    note.className = 'form-note' + (isError ? ' form-note--error' : '');
  }

  function run(ev) {
    if (ev) ev.preventDefault();
    if (state.busy) return;
    readOptions();
    persist();

    if (!state.modes.car && !state.modes.train && !state.modes.plane) {
      setNote('Selectionnez au moins un mode de transport.', true);
      return;
    }
    if (!$('#date').value) { setNote('Indiquez une date de depart.', true); return; }

    var btn = $('#compute');
    state.busy = true;
    btn.disabled = true;
    setNote('<span class="spinner"></span>Resolution des lieux et calcul en cours');

    resolveStops().then(function (places) {
      var missing = [];
      places.forEach(function (p, i) {
        if (!p) missing.push(state.stops[i].query || ('point ' + (i + 1)));
      });
      if (missing.length) {
        throw new Error('Lieu introuvable : ' + missing.join(', ') + '. Choisissez une proposition dans la liste.');
      }
      state.resolved = places;
      state.picks = [];
      return fetchRoute(places);
    }).then(function (route) {
      state.route = route && route.legs && route.legs.length === state.resolved.length - 1 ? route : null;
      if (route && !state.route) state.routeStatus = 'fallback';
      render();
      setNote(state.routeStatus === 'live'
        ? 'Distances routieres mesurees sur OpenStreetMap. Tarifs et horaires estimes.'
        : 'Tarifs, horaires et distances estimes par le modele.');
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    /* version autonome en un seul fichier : les appels reseau sont bloques */
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
    $('#date').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    $('#date').min = new Date().toISOString().slice(0, 10);

    if (!restore()) {
      state.stops = [newStop('Paris'), newStop('Marseille')];
      state.stops[0].place = E.placeById('paris');
      state.stops[1].place = E.placeById('marseille');
    }
    renderStops();
    syncFuelFields();

    $('#addStop').addEventListener('click', function () {
      state.stops.splice(state.stops.length - 1, 0, newStop(''));
      renderStops();
      var inputs = stopsBox.querySelectorAll('input');
      inputs[state.stops.length - 2].focus();
    });
    $('#reverse').addEventListener('click', function () {
      state.stops.reverse();
      renderStops();
      persist();
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
