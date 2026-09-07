/* TravIA — moteur d'estimation des trajets.
   Le module est deterministe : pour un meme itineraire, une meme date et les
   memes hypotheses, il renvoie toujours les memes horaires et les memes prix.
   Chaque resultat porte l'origine de la donnee (mesuree ou estimee). */
(function (global) {
  'use strict';

  var T = global.TravIA || (global.TravIA = {});
  var MIN = 60000;

  /* ------------------------------------------------------------------ outils */

  function haversine(a, b) {
    var R = 6371;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLon = (b.lon - a.lon) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /* generateur pseudo-aleatoire deterministe (mulberry32) */
  function rand(seedStr) {
    var s = hash(seedStr);
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v, n) { var f = Math.pow(10, n || 0); return Math.round(v * f) / f; }

  function normalize(s) {
    return (s || '').toString().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* ------------------------------------------------- recherche de lieux ----- */

  function searchPlaces(query, limit) {
    var q = normalize(query);
    if (!q) return [];
    var out = [];
    T.PLACES.forEach(function (p) {
      var name = normalize(p.name), country = normalize(p.country);
      var score = -1;
      if (name === q) score = 0;
      else if (name.indexOf(q) === 0) score = 1;
      else if (name.indexOf(q) > -1) score = 2;
      else if (country.indexOf(q) === 0) score = 4;
      else if (p.air.some(function (a) { return a.iata.toLowerCase() === q; })) score = 1;
      if (score >= 0) out.push({ place: p, score: score - p.weight * 0.1 });
    });
    out.sort(function (a, b) { return a.score - b.score; });
    return out.slice(0, limit || 8).map(function (o) { return o.place; });
  }

  function placeById(id) {
    for (var i = 0; i < T.PLACES.length; i++) if (T.PLACES[i].id === id) return T.PLACES[i];
    return null;
  }

  /* ------------------------------------------- continuite terrestre --------- */

  function landLink(a, b) {
    if (a === b) return { same: true, car: null, rail: true };
    for (var i = 0; i < T.LAND_LINKS.length; i++) {
      var l = T.LAND_LINKS[i];
      if ((l.a === a && l.b === b) || (l.a === b && l.b === a)) {
        return { same: false, car: l.car, rail: l.rail };
      }
    }
    return null;
  }

  /* ------------------------------------------- cheminement sur reseau -------
     Une distance a vol d'oiseau sous-estime fortement les relations en
     baionnette (Paris - Nice passe par la vallee du Rhone). On calcule donc le
     plus court chemin dans un graphe reliant chaque ville a ses voisines et aux
     grandes villes proches ; la longueur obtenue sert de plancher aux distances
     routieres et ferroviaires. */

  var NODES = null, ADJ = null, PATH_CACHE = {};

  function linkAllowed(a, b) {
    if (a.land === b.land) return true;
    var l = landLink(a.land, b.land);
    return !!(l && l.rail);
  }

  function buildNetwork() {
    if (ADJ) return;
    NODES = T.PLACES.slice();
    ADJ = NODES.map(function () { return []; });
    NODES.forEach(function (a, i) {
      var ds = [];
      NODES.forEach(function (b, j) {
        if (i === j || !linkAllowed(a, b)) return;
        ds.push({ j: j, d: haversine(a, b) });
      });
      ds.sort(function (x, y) { return x.d - y.d; });
      var keep = ds.slice(0, 5);
      ds.forEach(function (e) {
        if (e.d <= 550 && NODES[e.j].weight >= 4 && keep.indexOf(e) < 0) keep.push(e);
      });
      keep.forEach(function (e) {
        ADJ[i].push(e);
        ADJ[e.j].push({ j: i, d: e.d });
      });
    });
  }

  /* voisins d'un point quelconque, utilises comme portes d'entree du graphe */
  function gateways(place) {
    buildNetwork();
    var idx = NODES.indexOf(place);
    if (idx > -1) return [{ j: idx, d: 0 }];
    var ds = [];
    NODES.forEach(function (b, j) {
      if (linkAllowed(place, b)) ds.push({ j: j, d: haversine(place, b) });
    });
    ds.sort(function (x, y) { return x.d - y.d; });
    return ds.slice(0, 3);
  }

  /* Plus court chemin, en kilometres, ou null si les deux points ne sont pas
     relies par voie terrestre. */
  function networkPathKm(from, to) {
    var key = from.id + '>' + to.id;
    if (PATH_CACHE[key] !== undefined) return PATH_CACHE[key];
    buildNetwork();
    var starts = gateways(from), ends = {};
    gateways(to).forEach(function (g) { ends[g.j] = g.d; });
    if (!starts.length || !Object.keys(ends).length) return (PATH_CACHE[key] = null);

    var n = NODES.length;
    var dist = new Array(n), seen = new Array(n);
    for (var i = 0; i < n; i++) { dist[i] = Infinity; seen[i] = false; }
    starts.forEach(function (g) { dist[g.j] = Math.min(dist[g.j], g.d); });

    var best = Infinity;
    for (var step = 0; step < n; step++) {
      var u = -1, bd = Infinity;
      for (var k = 0; k < n; k++) if (!seen[k] && dist[k] < bd) { bd = dist[k]; u = k; }
      if (u < 0) break;
      seen[u] = true;
      if (ends[u] !== undefined) best = Math.min(best, dist[u] + ends[u]);
      if (bd > best) break;
      ADJ[u].forEach(function (e) {
        var nd = dist[u] + e.d;
        if (nd < dist[e.j]) dist[e.j] = nd;
      });
    }
    var out = isFinite(best) ? best : null;
    PATH_CACHE[key] = out;
    return out;
  }

  /* -------------------------------------------------- facteurs tarifaires --- */

  function leadFactor(depDate, now) {
    var days = (depDate.getTime() - (now || new Date()).getTime()) / 86400000;
    if (days < 0) return 1;
    if (days < 1) return 2.15;
    if (days < 3) return 1.85;
    if (days < 7) return 1.55;
    if (days < 14) return 1.28;
    if (days < 30) return 1.08;
    if (days < 60) return 0.92;
    return 0.84;
  }

  function dowFactor(d) {
    switch (d.getDay()) {
      case 0: return 1.12;  /* dimanche */
      case 5: return 1.14;  /* vendredi */
      case 6: return 0.94;  /* samedi */
      case 2: case 3: return 0.95;
      default: return 1;
    }
  }

  function seasonFactor(d) {
    var m = d.getMonth(), day = d.getDate();
    if (m === 6 || m === 7) return 1.18;
    if (m === 11 && day >= 18) return 1.16;
    if (m === 4 || m === 5 || m === 8) return 1.04;
    if (m === 0 || m === 1 || m === 10) return 0.93;
    return 1;
  }

  function hourFactor(hours) {
    if (hours >= 6.5 && hours < 9) return 1.16;
    if (hours >= 17 && hours < 20) return 1.15;
    if (hours >= 10 && hours < 15) return 0.9;
    if (hours < 6.5 || hours >= 21) return 0.82;
    return 1;
  }

  function trafficWeight(a, b) {
    return clamp((a.weight + b.weight) / 8, 0.35, 1.25);
  }

  /* ----------------------------------------------------------- voiture ------ */

  function detourFactor(km) {
    if (km < 40) return 1.38;
    if (km < 150) return 1.26;
    if (km < 500) return 1.19;
    if (km < 1200) return 1.17;
    return 1.15;
  }

  /* vitesse moyenne effective, calee sur les temps de parcours observes
     (Paris - Lyon 465 km en 4 h 40, Paris - Marseille 775 km en 7 h 20) */
  function roadSpeed(km) {
    if (km < 25) return 34;
    if (km < 80) return 62;
    if (km < 200) return 82;
    if (km < 500) return 101;
    if (km < 1000) return 105;
    return 107;
  }

  /* measured : mesure routiere reelle {distanceKm, durationMin} fournie par OSRM.
     Elle remplace le modele de distance et de temps de conduite ; les couts,
     les pauses et les emissions restent calcules a partir de cette mesure. */
  function estimateCar(from, to, dep, opts, measured) {
    var link = landLink(from.land, to.land);
    if (!link && !measured) {
      return { available: false, reason: 'Aucune continuite routiere entre ' + from.country + ' et ' + to.country + '.' };
    }
    var geo = haversine(from, to);
    var distance, driveMin, peak = false;
    var h = dep.getHours() + dep.getMinutes() / 60;

    if (measured && measured.distanceKm > 0) {
      distance = measured.distanceKm;
      driveMin = measured.durationMin;
    } else {
      distance = geo * detourFactor(geo);
      var pathKm = networkPathKm(from, to);
      if (pathKm) distance = Math.max(distance, pathKm * 1.09);
      driveMin = distance / roadSpeed(distance) * 60;
      /* trafic aux heures de pointe sur les trajets courts et moyens */
      peak = ((h >= 7 && h < 9.5) || (h >= 16.5 && h < 19)) && dep.getDay() > 0 && dep.getDay() < 6;
      if (peak) driveMin *= distance < 150 ? 1.22 : 1.07;
    }

    var breaksMin = driveMin > 150 ? Math.floor(driveMin / 120) * 15 : 0;
    var ferry = link.car;
    var totalMin = driveMin + breaksMin + (ferry ? ferry.extraMin : 0);

    var energyCost, energyLabel;
    if (opts.fuel === 'electrique') {
      energyCost = distance / 100 * opts.kwhPer100 * opts.kwhPrice;
      energyLabel = round(distance / 100 * opts.kwhPer100, 0) + ' kWh';
    } else {
      energyCost = distance / 100 * opts.consumption * opts.fuelPrice;
      energyLabel = round(distance / 100 * opts.consumption, 1) + ' L';
    }
    var tollFree = ['GB', 'BE', 'NL', 'DE', 'DK', 'SE', 'FI', 'LU', 'IE'];
    var tollShare = (tollFree.indexOf(from.cc) > -1 && tollFree.indexOf(to.cc) > -1) ? 0.12 : opts.motorwayShare;
    var tollCost = opts.tolls && distance > 40 ? distance * tollShare * opts.tollRate : 0;
    var wearCost = opts.includeWear ? distance * opts.wearPerKm : 0;
    var ferryCost = ferry ? ferry.extraCost : 0;
    var total = energyCost + tollCost + wearCost + ferryCost;
    var occupants = Math.max(1, opts.occupants || 1);

    var co2 = distance * (T.CO2[opts.fuel] || T.CO2.essence) / 1000; /* kg par vehicule */

    return {
      available: true,
      mode: 'car',
      source: measured ? 'osrm' : 'estime',
      distanceKm: round(distance, 0),
      durationMin: Math.round(totalMin),
      driveMin: Math.round(driveMin),
      breaksMin: breaksMin,
      depart: new Date(dep.getTime()),
      arrivee: new Date(dep.getTime() + Math.round(totalMin) * MIN),
      costTotal: round(total, 2),
      costPerPerson: round(total / occupants, 2),
      occupants: occupants,
      co2Total: round(co2, 1),
      co2PerPerson: round(co2 / occupants, 1),
      breakdown: [
        { label: opts.fuel === 'electrique' ? 'Recharge (' + energyLabel + ')' : 'Carburant (' + energyLabel + ')', value: round(energyCost, 2) },
        { label: 'Peages', value: round(tollCost, 2) },
        { label: 'Usure et entretien', value: round(wearCost, 2) },
        { label: ferry ? ferry.label : 'Traversee', value: round(ferryCost, 2) }
      ].filter(function (b) { return b.value > 0; }),
      peak: peak,
      ferry: ferry ? ferry.label : null
    };
  }

  /* ------------------------------------------------------------- train ------ */

  function railEligible(op, from, to) {
    var a = from.cc, b = to.cc;
    var mA = op.markets.indexOf(a) > -1, mB = op.markets.indexOf(b) > -1;
    /* certains operateurs n'exploitent que des relations internationales */
    if (op.intlOnly && a === b) return false;
    if (a === b) return mA && mB ? 'home' : false;
    var iA = (op.intl || []).indexOf(a) > -1, iB = (op.intl || []).indexOf(b) > -1;
    if ((mA && (mB || iB)) || (mB && (mA || iA))) return 'home';
    /* relation entre deux pays desservis sans passer par le marche d'origine :
       possible, mais avec correspondance et une offre plus rare */
    if (iA && iB) return 'transit';
    return false;
  }

  /* vitesse commerciale moyenne des relations interieures a grande vitesse */
  var DOMESTIC_HSR = { FR: 228, ES: 225, IT: 210, JP: 230, CN: 245, MA: 195, DE: 150, GB: 145, CH: 110, SE: 165, PL: 140 };

  /* vitesse moyenne des grands corridors transfrontaliers, calee sur les
     horaires publies (Paris - Bruxelles 1 h 22, Paris - Milan 6 h 50, etc.) */
  var CORRIDOR = {
    'BE|FR': 215, 'BE|NL': 175, 'FR|GB': 170, 'BE|GB': 180, 'GB|NL': 160, 'FR|NL': 145,
    'DE|FR': 140, 'CH|FR': 148, 'ES|FR': 148, 'FR|IT': 105, 'CH|IT': 115, 'AT|IT': 110,
    'DE|IT': 110, 'AT|DE': 140, 'CH|DE': 135, 'AT|CH': 115, 'DE|NL': 140, 'DE|PL': 115,
    'AT|HU': 130, 'AT|CZ': 110, 'CZ|DE': 110, 'CZ|PL': 100, 'ES|PT': 95, 'DE|DK': 125,
    'DK|SE': 145, 'NO|SE': 105, 'FR|LU': 155, 'BE|LU': 105, 'HU|RO': 85, 'CA|US': 95
  };

  /* Coefficient lie a la geometrie du reseau : plein regime au depart du noeud
     central ou le long d'un meme axe, penalite sur les transversales. */
  function axisFactor(from, to) {
    var hub = T.RAIL_HUBS[from.cc];
    if (!hub) return 1;
    if (from.id === hub || to.id === hub) return 1;
    var a = T.RAIL_AXES[from.id], b = T.RAIL_AXES[to.id];
    if (a && b && a === b) return 0.85;
    return 0.62;
  }

  function railSpeed(op, from, to, km) {
    if (op.night) return 78;
    if (from.cc === to.cc) {
      var classic = km > 400 ? 105 : 92;
      if (!op.hsr) return classic;
      var vHigh = DOMESTIC_HSR[from.cc] || 160;
      if (from.rail.hsr && to.rail.hsr) return vHigh * axisFactor(from, to);
      if (from.rail.hsr || to.rail.hsr) {
        /* une partie du parcours seulement est apte a la grande vitesse */
        var share = Math.min(0.5, km / 700);
        return vHigh * share + classic * (1 - share);
      }
      return classic;
    }
    var pair = [from.cc, to.cc].sort().join('|');
    var c = CORRIDOR[pair];
    if (c) return op.hsr ? c : c * 0.85;
    return op.hsr ? 125 : 92;
  }

  function railTransfers(op, from, to, km) {
    if (from.cc === to.cc) return km > 900 && !op.hsr ? 1 : 0;
    if (op.border) return 0;
    var direct = (op.markets.indexOf(from.cc) > -1 && op.markets.indexOf(to.cc) > -1);
    if (direct) return 0;
    if (km < 1000) return 1;
    if (km < 1900) return 2;
    return 3;
  }

  /* grille de departs d'un operateur, en heures decimales */
  function departureGrid(op, seedKey, weight) {
    var count, start, end;
    if (op.night) { count = 1; start = 20.75; end = 22.25; }
    else {
      count = clamp(Math.round(op.freq * weight), 2, 14);
      start = op.hsr ? 6.2 : 5.6;
      end = 21.4;
    }
    var grid = [];
    var span = end - start;
    for (var i = 0; i < count; i++) {
      var jitter = (rand(seedKey + '|g' + i) - 0.5) * (span / count) * 0.75;
      var t = start + (count === 1 ? span / 2 : span * i / (count - 1)) + jitter;
      grid.push(clamp(t, 0.2, 23.6));
    }
    return grid.sort(function (a, b) { return a - b; });
  }

  /* Date correspondant a une heure decimale, le jour du depart ou le lendemain. */
  function slotDate(dep, h, nextDay) {
    return new Date(dep.getFullYear(), dep.getMonth(), dep.getDate() + (nextDay ? 1 : 0),
                    0, Math.round(h * 60));
  }

  function priceRound(p) {
    if (p < 40) return round(Math.round(p * 2) / 2, 2);
    if (p < 200) return Math.round(p);
    return Math.round(p / 5) * 5;
  }

  function railOffers(from, to, dep, opts, now) {
    if (!from.rail || !to.rail) {
      var who = !from.rail ? from.name : to.name;
      return { available: false, reason: 'Pas de desserte ferroviaire identifiee pour ' + who + '.' };
    }
    var link = landLink(from.land, to.land);
    if (!link || (!link.same && !link.rail)) {
      return { available: false, reason: 'Aucune liaison ferroviaire continue entre ' + from.country + ' et ' + to.country + '.' };
    }
    var geo = haversine(from, to);
    if (geo < 15) return { available: false, reason: 'Distance trop courte pour un trajet ferroviaire interurbain.' };
    var km = geo * (geo < 300 ? 1.22 : 1.12);
    var pathKm = networkPathKm(from, to);
    if (pathKm) km = Math.max(km, pathKm * 1.05);
    var weight = trafficWeight(from, to);
    var classFactor = opts.railClass === '1re' ? 1.52 : 1;
    var card = T.RAIL_CARDS[opts.railCard] || T.RAIL_CARDS.aucune;
    var lead = leadFactor(dep, now), dow = dowFactor(dep), season = seasonFactor(dep);
    var offers = [];

    T.RAIL_OPERATORS.forEach(function (op) {
      var kind = railEligible(op, from, to);
      if (!kind) return;
      var transit = kind === 'transit';
      if (op.night && km < 650) return;
      if (!op.hsr && km > 600 && !op.night) return;   /* pas de service classique de bout en bout */
      if (op.lowcost && km < 120) return;

      var speed = railSpeed(op, from, to, km);
      var transfers = railTransfers(op, from, to, km) + (transit ? 1 : 0);
      var stops = clamp(Math.round(km / (op.hsr ? 280 : 110)), 0, 12);
      /* 8 minutes forfaitaires : acceleration, approche et manoeuvres en gare */
      var rideMin = km / speed * 60 + 8 + stops * (op.hsr ? 3 : 2) + transfers * (km > 900 ? 55 : 40);
      if (op.night) rideMin = Math.max(rideMin, 470);

      var seedKey = from.id + '>' + to.id + '|' + op.id + '|' + dep.toDateString();
      var grid = departureGrid({ freq: op.freq * (transit ? 0.3 : 1), hsr: op.hsr, night: op.night },
                               seedKey, weight);
      var laterToday = grid.some(function (g) { return slotDate(dep, g, false) >= dep; });

      var accessMin = from.rail.accessMin != null ? from.rail.accessMin : opts.railTransferMin;
      var egressMin = to.rail.accessMin != null ? to.rail.accessMin : opts.railTransferMin;

      grid.forEach(function (h, i) {
        var d = slotDate(dep, h, false);
        if (d < dep) {
          if (op.night || laterToday) return;  /* un depart plus tardif existe le jour meme */
          d = slotDate(dep, h, true);
        }
        var jitter = 0.86 + rand(seedKey + '|p' + i) * 0.42;
        var yieldFactor = op.lowcost ? 0.95 : 1;
        var price = (op.base + op.perKm * km) * classFactor * lead * dow * season *
                    hourFactor(h) * jitter * yieldFactor * card.factor;
        if (op.night) price = Math.max(price, 49);
        price = Math.max(price, op.lowcost ? 10 : 12);
        var duration = Math.round(rideMin * (0.97 + rand(seedKey + '|d' + i) * 0.09));
        offers.push({
          mode: 'train',
          operator: op.name,
          company: op.company,
          url: op.url,
          klass: opts.railClass === '1re' ? (op.classes[1] || op.classes[0]) : op.classes[0],
          depart: d,
          arrivee: new Date(d.getTime() + duration * MIN),
          durationMin: duration,
          transfers: transfers,
          night: !!op.night,
          pricePerPerson: priceRound(price),
          price: priceRound(price) * Math.max(1, opts.passengers),
          distanceKm: round(km, 0),
          co2PerPerson: round(km * (op.hsr ? T.CO2.railHsr : T.CO2.railRegional) / 1000, 1),
          fromLabel: from.rail.station,
          toLabel: to.rail.station,
          accessMin: accessMin,
          egressMin: egressMin,
          doorToDoorMin: duration + accessMin + egressMin
        });
      });
    });

    if (!offers.length) {
      return { available: false, reason: 'Aucun operateur ferroviaire identifie sur cette relation.' };
    }
    offers.sort(function (a, b) { return a.depart - b.depart; });
    return { available: true, mode: 'train', source: 'estime', distanceKm: round(km, 0), offers: offers.slice(0, 24) };
  }

  /* ------------------------------------------------------------- avion ------ */

  function pickAirport(place, airline) {
    if (!place.air.length) return null;
    var hub = place.air.filter(function (a) { return airline && airline.hubs.indexOf(a.iata) > -1; })[0];
    if (hub) return hub;
    if (airline && airline.lowAirport) {
      var low = place.air.filter(function (a) { return a.kind === 'lowcost'; })[0];
      if (low) return low;
    }
    return place.air.slice().sort(function (a, b) { return a.transferMin - b.transferMin; })[0];
  }

  var BASE_CC = null;
  function baseCountries(al) {
    if (!BASE_CC) {
      BASE_CC = {};
      T.PLACES.forEach(function (p) {
        p.air.forEach(function (a) { BASE_CC[a.iata] = p.cc; });
      });
    }
    var out = {};
    al.hubs.forEach(function (h) { if (BASE_CC[h]) out[BASE_CC[h]] = true; });
    return out;
  }

  function airlineServes(al, from, to, km) {
    if (km > al.range) return null;
    var hubA = from.air.some(function (a) { return al.hubs.indexOf(a.iata) > -1; });
    var hubB = to.air.some(function (a) { return al.hubs.indexOf(a.iata) > -1; });
    var mA = al.markets.indexOf(from.cc) > -1, mB = al.markets.indexOf(to.cc) > -1;
    if (al.type === 'low') {
      /* une low-cost ne dessert que les pays de son reseau */
      if (!(mA && mB)) return null;
      if (hubA || hubB) return { stops: 0 };
      if (from.cc === to.cc) return null;   /* interieur sans base sur place */
      /* point a point sans base aux deux extremites : seulement si la compagnie
         est implantee dans l'un des deux pays et si la relation porte du trafic */
      var bases = baseCountries(al);
      if (!(bases[from.cc] || bases[to.cc])) return null;
      return from.weight + to.weight >= 6 ? { stops: 0 } : null;
    }
    if (hubA || hubB) return { stops: 0 };
    if (mA || mB) return { stops: 1 };
    return null;
  }

  function flightOffers(from, to, dep, opts, now) {
    if (!from.air.length || !to.air.length) {
      var who = !from.air.length ? from.name : to.name;
      return { available: false, reason: 'Pas d aeroport commercial identifie pour ' + who + '.' };
    }
    var geo = haversine(from, to);
    if (geo < 200) return { available: false, reason: 'Distance trop courte pour une liaison aerienne (moins de 200 km).' };
    var km = geo * 1.04 + 55;
    var weight = trafficWeight(from, to);
    var lead = leadFactor(dep, now), dow = dowFactor(dep), season = seasonFactor(dep);
    var offers = [];

    T.AIRLINES.forEach(function (al) {
      var serve = airlineServes(al, from, to, km);
      if (!serve) return;
      var apA = pickAirport(from, al), apB = pickAirport(to, al);
      if (!apA || !apB) return;

      var flightKm = km * (serve.stops ? 1.18 : 1);
      var blockMin = 28 + flightKm / (flightKm > 2500 ? 830 : 720) * 60;
      var layover = serve.stops ? 80 + Math.round(rand(al.id + from.id + to.id) * 45) : 0;
      var airMin = blockMin + layover + (serve.stops ? 22 : 0);

      var seedKey = from.id + '>' + to.id + '|' + al.id + '|' + dep.toDateString();
      var count = clamp(Math.round((al.type === 'low' ? 3 : 5) * weight - serve.stops), 1, 7);
      var grid = departureGrid({ freq: count, hsr: true }, seedKey, 1);
      var laterToday = grid.some(function (g) { return slotDate(dep, g, false) >= dep; });

      grid.forEach(function (h, i) {
        var d = slotDate(dep, h, false);
        if (d < dep) {
          if (laterToday) return;
          d = slotDate(dep, h, true);
        }
        var jitter = 0.8 + rand(seedKey + '|p' + i) * 0.55;
        var price = (al.base + al.perKm * flightKm) * lead * dow * season * hourFactor(h) * jitter;
        if (serve.stops) price *= 0.9;
        var bag = opts.hold ? (al.bag || 0) : 0;
        price = Math.max(price, al.type === 'low' ? 14 : 39) + bag;
        var duration = Math.round(airMin * (0.97 + rand(seedKey + '|d' + i) * 0.08));

        var accessMin = apA.transferMin + opts.checkinMin;
        var egressMin = opts.disembarkMin + apB.transferMin;
        offers.push({
          mode: 'plane',
          operator: al.name,
          company: al.name,
          code: al.code + ' ' + (1000 + Math.floor(rand(seedKey + '|n' + i) * 8000)),
          url: al.url,
          depart: d,
          arrivee: new Date(d.getTime() + duration * MIN),
          durationMin: duration,
          doorToDoorMin: duration + accessMin + egressMin,
          transfers: serve.stops,
          pricePerPerson: priceRound(price),
          price: priceRound(price) * Math.max(1, opts.passengers),
          bagIncluded: !opts.hold || al.bag === 0,
          bagFee: bag,
          distanceKm: round(flightKm, 0),
          co2PerPerson: round(flightKm * (flightKm > 1500 ? T.CO2.airLong : T.CO2.airShort) / 1000, 1),
          fromLabel: apA.iata + ' ' + apA.name,
          toLabel: apB.iata + ' ' + apB.name,
          accessMin: accessMin,
          egressMin: egressMin,
          klass: al.type === 'low' ? 'Economique (sans bagage)' : 'Economique'
        });
      });
    });

    if (!offers.length) {
      /* relation non couverte par les compagnies du referentiel : estimation
         generique avec correspondance, signalee comme telle */
      var apA2 = pickAirport(from, null), apB2 = pickAirport(to, null);
      var blockMin2 = 28 + km * 1.2 / 780 * 60 + 95;
      var d2 = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate(), 9, 30);
      if (d2 < dep) d2 = new Date(d2.getTime() + 86400000);
      var price2 = priceRound((60 + km * 1.2 * 0.092) * lead * dow * season);
      offers.push({
        mode: 'plane', operator: 'Vol avec correspondance', company: 'Compagnies en partage de code',
        code: '--', url: 'https://www.google.com/travel/flights',
        depart: d2, arrivee: new Date(d2.getTime() + Math.round(blockMin2) * MIN),
        durationMin: Math.round(blockMin2), doorToDoorMin: Math.round(blockMin2) + apA2.transferMin + opts.checkinMin + opts.disembarkMin + apB2.transferMin,
        transfers: 1, pricePerPerson: price2, price: price2 * Math.max(1, opts.passengers),
        bagIncluded: true, bagFee: 0, distanceKm: round(km * 1.2, 0),
        co2PerPerson: round(km * 1.2 * T.CO2.airLong / 1000, 1),
        fromLabel: apA2.iata + ' ' + apA2.name, toLabel: apB2.iata + ' ' + apB2.name,
        accessMin: apA2.transferMin + opts.checkinMin, egressMin: opts.disembarkMin + apB2.transferMin,
        klass: 'Economique', generic: true
      });
    }
    offers.sort(function (a, b) { return a.depart - b.depart; });
    return { available: true, mode: 'plane', source: 'estime', distanceKm: round(km, 0), offers: offers.slice(0, 24) };
  }

  /* --------------------------------------------- synthese d'un segment ------ */

  function bestOf(offers, key) {
    return offers.slice().sort(function (a, b) { return a[key] - b[key]; })[0];
  }

  function summarizeOffers(res, opts, doorToDoor) {
    if (!res.available) return res;
    var offers = res.offers;
    var cheapest = bestOf(offers, 'pricePerPerson');
    var fastest = bestOf(offers, doorToDoor ? 'doorToDoorMin' : 'durationMin');
    var prices = offers.map(function (o) { return o.pricePerPerson; });
    res.priceMin = Math.min.apply(null, prices);
    res.priceMax = Math.max.apply(null, prices);
    res.cheapest = cheapest;
    res.fastest = fastest;
    res.co2PerPerson = cheapest.co2PerPerson;
    return res;
  }

  /* Calcule les trois modes pour un segment donne. */
  function computeLeg(from, to, dep, opts, now, measured) {
    var car = estimateCar(from, to, dep, opts, measured);
    var train = railOffers(from, to, dep, opts, now);
    var plane = flightOffers(from, to, dep, opts, now);
    if (train.available) summarizeOffers(train, opts, true);
    if (plane.available) summarizeOffers(plane, opts, true);
    return {
      from: from, to: to, depart: dep,
      geoKm: round(haversine(from, to), 0),
      car: car, train: train, plane: plane
    };
  }

  /* Duree porte a porte retenue pour comparer les modes. */
  function legDuration(leg, mode, opts) {
    if (mode === 'car') return leg.car.available ? leg.car.durationMin : null;
    if (mode === 'train') return leg.train.available ? leg.train.fastest.doorToDoorMin : null;
    if (!leg.plane.available) return null;
    return leg.plane.fastest.doorToDoorMin;
  }

  function legPrice(leg, mode, opts) {
    if (mode === 'car') return leg.car.available ? leg.car.costPerPerson : null;
    if (mode === 'train') return leg.train.available ? leg.train.priceMin : null;
    return leg.plane.available ? leg.plane.priceMin : null;
  }

  function legCo2(leg, mode) {
    if (mode === 'car') return leg.car.available ? leg.car.co2PerPerson : null;
    if (mode === 'train') return leg.train.available ? leg.train.co2PerPerson : null;
    return leg.plane.available ? leg.plane.co2PerPerson : null;
  }

  /* Construit un lieu a partir d'un point geocode : rattachement a la gare et
     a l'aeroport les plus proches du referentiel, avec le temps d'acces routier. */
  function buildCustomPlace(name, lat, lon, meta) {
    var pt = { lat: lat, lon: lon };
    var nearest = null, nearestD = Infinity, railHost = null, railD = Infinity, airHost = null, airD = Infinity;
    T.PLACES.forEach(function (p) {
      var d = haversine(pt, p);
      if (d < nearestD) { nearestD = d; nearest = p; }
      if (p.rail && d < railD) { railD = d; railHost = p; }
      if (p.air.length && d < airD) { airD = d; airHost = p; }
    });
    if (!nearest) return null;

    function accessMinutes(km) {
      var road = km * detourFactor(km);
      return Math.round(road / roadSpeed(road) * 60) + 10;
    }
    var place = {
      id: 'pt:' + round(lat, 4) + ',' + round(lon, 4),
      name: name,
      country: (meta && meta.country) || nearest.country,
      cc: (meta && meta.cc) || nearest.cc,
      lat: lat, lon: lon,
      weight: nearestD < 12 ? nearest.weight : 2,
      land: nearest.land,
      custom: true,
      nearest: nearest.name,
      rail: null,
      air: []
    };
    if (nearestD < 12) {
      place.rail = nearest.rail;
      place.air = nearest.air;
      return place;
    }
    if (railHost && railD < 170) {
      place.rail = {
        station: railHost.rail.station,
        hsr: railHost.rail.hsr,
        accessMin: accessMinutes(railD),
        host: railHost.name
      };
    }
    if (airHost && airD < 220) {
      var extra = accessMinutes(airD);
      place.air = airHost.air.map(function (a) {
        return { iata: a.iata, name: a.name + ' (via ' + airHost.name + ')', transferMin: a.transferMin + extra, kind: a.kind };
      });
    }
    return place;
  }

  T.engine = {
    buildCustomPlace: buildCustomPlace,
    haversine: haversine,
    rand: rand,
    hash: hash,
    normalize: normalize,
    searchPlaces: searchPlaces,
    placeById: placeById,
    estimateCar: estimateCar,
    railOffers: railOffers,
    flightOffers: flightOffers,
    computeLeg: computeLeg,
    legDuration: legDuration,
    legPrice: legPrice,
    legCo2: legCo2,
    leadFactor: leadFactor,
    round: round,
    priceRound: priceRound
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
