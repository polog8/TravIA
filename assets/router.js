/* TravIA — recherche du meilleur itineraire.
   Combine les trois modes sur les segments demandes et, sur une relation
   directe, teste l'insertion d'un point de correspondance pour trouver les
   trajets mixtes (train puis voiture, voiture puis avion, etc.). */
(function (global) {
  'use strict';

  var T = global.TravIA || (global.TravIA = {});
  var MIN = 60000;
  var MODES = ['car', 'train', 'plane'];
  var LABELS = { car: 'Voiture', train: 'Train', plane: 'Avion' };

  /* Service retenu pour un segment et un mode donnes.
     strategy : 'early' pour le premier depart possible, 'cheap' pour le moins
     cher parmi les departs restants. */
  function serviceFor(leg, mode, strategy) {
    if (mode === 'car') {
      if (!leg.car.available) return null;
      var c = leg.car;
      return {
        mode: 'car', operator: 'Vehicule personnel',
        depart: c.depart, arrivee: c.arrivee, durationMin: c.durationMin,
        price: c.costPerPerson, co2: c.co2PerPerson,
        accessMin: 0, egressMin: 0, transfers: 0, distanceKm: c.distanceKm
      };
    }
    var res = leg[mode];
    if (!res.available || !res.offers.length) return null;
    var o = res.offers[0];
    if (strategy === 'cheap') {
      res.offers.forEach(function (x) { if (x.pricePerPerson < o.pricePerPerson) o = x; });
    }
    return {
      mode: mode, operator: o.operator, company: o.company, offer: o,
      depart: o.depart, arrivee: o.arrivee, durationMin: o.durationMin,
      price: o.pricePerPerson, co2: o.co2PerPerson,
      accessMin: o.accessMin || 0, egressMin: o.egressMin || 0,
      transfers: o.transfers || 0, distanceKm: o.distanceKm,
      fromLabel: o.fromLabel, toLabel: o.toLabel
    };
  }

  function doorStart(service) {
    return new Date(service.depart.getTime() - service.accessMin * MIN);
  }
  function doorEnd(service) {
    return new Date(service.arrivee.getTime() + service.egressMin * MIN);
  }

  /* Enchaine une suite de modes sur une suite de points. Renvoie null des
     qu'un segment n'est pas praticable avec le mode demande. */
  function chain(points, modes, dep, opts, now, strategy, holds) {
    var t = new Date(dep.getTime());
    var steps = [];
    for (var i = 0; i < points.length - 1; i++) {
      var leg = T.engine.computeLeg(points[i], points[i + 1], t, opts, now);
      var svc = serviceFor(leg, modes[i], strategy);
      if (!svc) return null;
      svc.from = points[i];
      svc.to = points[i + 1];
      steps.push(svc);
      /* battement a la correspondance : on change de mode ou de gare */
      var buffer = (i + 1 < points.length - 1 && modes[i] !== modes[i + 1]) ? 15 : 0;
      t = new Date(doorEnd(svc).getTime() + (buffer + ((holds && holds[i + 1]) || 0) * 60) * MIN);
    }
    var start = doorStart(steps[0]);
    var end = doorEnd(steps[steps.length - 1]);
    var price = 0, co2 = 0, transfers = 0, travel = 0;
    steps.forEach(function (s) {
      price += s.price; co2 += s.co2; transfers += s.transfers;
      travel += s.durationMin + s.accessMin + s.egressMin;
    });
    return {
      steps: steps,
      modes: modes.slice(),
      depart: start,
      arrivee: end,
      durationMin: Math.round((end - start) / MIN),
      travelMin: Math.round(travel),
      price: Math.round(price * 100) / 100,
      co2: Math.round(co2 * 10) / 10,
      transfers: transfers
    };
  }

  /* Points de correspondance plausibles entre deux lieux : villes du
     referentiel qui allongent peu le trajet et disposent d'une desserte. */
  function hubCandidates(a, b, limit) {
    var direct = T.engine.haversine(a, b);
    if (direct < 220) return [];
    var out = [];
    T.PLACES.forEach(function (h) {
      if (h.id === a.id || h.id === b.id) return;
      if (h.weight < 3) return;
      if (!T.engine.hasRail(h) && !h.air.length) return;
      var d = T.engine.haversine(a, h) + T.engine.haversine(h, b);
      var detour = d / direct;
      if (detour > 1.22) return;
      if (T.engine.haversine(a, h) < 60 || T.engine.haversine(h, b) < 60) return;
      out.push({ place: h, detour: detour, score: detour - h.weight * 0.06 });
    });
    out.sort(function (x, y) { return x.score - y.score; });
    return out.slice(0, limit || 12).map(function (o) { return o.place; });
  }

  function combos(count, modes) {
    var out = [[]];
    for (var i = 0; i < count; i++) {
      var next = [];
      out.forEach(function (seq) {
        modes.forEach(function (m) { next.push(seq.concat([m])); });
      });
      out = next;
    }
    return out;
  }

  function signature(opt) {
    return opt.modes.join('-') + '|' + opt.steps.map(function (s) {
      return s.to.id + ':' + s.operator;
    }).join('|') + '|' + opt.depart.getTime();
  }

  /* Recherche principale.
     points : lieux deja resolus et ancres ; modes : modes autorises. */
  function search(points, dep, opts, now, allowed, holds) {
    var modes = MODES.filter(function (m) { return allowed[m]; });
    if (!modes.length || points.length < 2) return [];
    var options = [], seen = {};

    function add(opt, via) {
      if (!opt) return;
      opt.via = via || null;
      var sig = signature(opt);
      if (seen[sig]) return;
      seen[sig] = true;
      options.push(opt);
    }

    /* 1. itineraires directs sur les points demandes */
    var legCount = points.length - 1;
    var sequences = legCount <= 5 ? combos(legCount, modes) : [modes.map(function () { return modes[0]; })];
    sequences.forEach(function (seq) {
      add(chain(points, seq, dep, opts, now, 'early', holds));
      add(chain(points, seq, dep, opts, now, 'cheap', holds));
    });

    /* 2. sur une relation directe, itineraires mixtes par un point de
          correspondance intermediaire */
    if (points.length === 2 && modes.length > 1) {
      hubCandidates(points[0], points[1], 12).forEach(function (hub) {
        var pts = [points[0], hub, points[1]];
        combos(2, modes).forEach(function (seq) {
          if (seq[0] === seq[1]) return;   /* sans changement de mode, l'arret n'apporte rien */
          add(chain(pts, seq, dep, opts, now, 'early', null), hub);
          add(chain(pts, seq, dep, opts, now, 'cheap', null), hub);
        });
      });
    }

    return options;
  }

  function rank(options, criterion) {
    var key = criterion === 'price' ? 'price' : criterion === 'co2' ? 'co2' : 'durationMin';
    return options.slice().sort(function (a, b) {
      if (a[key] !== b[key]) return a[key] - b[key];
      if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
      return a.depart - b.depart;
    });
  }

  /* Ne garde qu'une option par combinaison de modes et de correspondance :
     la meilleure selon le critere, pour eviter une liste repetitive. */
  function condense(options, criterion, limit, dep) {
    if (!options.length) return [];
    /* on reste dans la journee demandee : un depart le lendemain n'est pas une
       reponse a la question posee */
    if (dep) {
      var horizon = dep.getTime() + 14 * 3600000;
      var sameDay = options.filter(function (o) { return o.depart.getTime() <= horizon; });
      if (sameDay.length) options = sameDay;
    }
    /* elagage : on ecarte les combinaisons nettement hors jeu, qui allongent
       la liste sans rien apporter */
    var bestDur = Infinity, bestPrice = Infinity;
    options.forEach(function (o) {
      if (o.durationMin < bestDur) bestDur = o.durationMin;
      if (o.price < bestPrice) bestPrice = o.price;
    });
    var durCap = Math.min(bestDur * 1.9, bestDur + 420);
    var priceCap = bestPrice * 3 + 20;
    var kept = options.filter(function (o) {
      return o.durationMin <= durCap + 30 && o.price <= priceCap;
    });
    if (!kept.length) kept = options;
    options = kept;

    /* Representant de chaque combinaison : a resultat comparable (a la
       demi-heure, aux dix euros), on retient le depart le plus tot. */
    function bucket(o) {
      if (criterion === 'price') return Math.round(o.price / 10);
      if (criterion === 'co2') return Math.round(o.co2 / 2);
      return Math.round(o.durationMin / 30);
    }
    var byShape = {};
    options.slice().sort(function (a, b) {
      var ba = bucket(a), bb = bucket(b);
      if (ba !== bb) return ba - bb;
      return a.depart - b.depart;
    }).forEach(function (o) {
      var shape = o.modes.join('-') + '|' + (o.via ? o.via.id : '');
      if (!byShape[shape]) byShape[shape] = o;
    });
    var list = Object.keys(byShape).map(function (k) { return byShape[k]; });
    return rank(list, criterion).slice(0, limit || 12);
  }

  function describe(opt) {
    if (!opt.via) {
      if (opt.modes.length === 1) return LABELS[opt.modes[0]] + ' direct';
      return opt.modes.map(function (m) { return LABELS[m]; }).join(', puis ');
    }
    return LABELS[opt.modes[0]] + ' jusqu a ' + opt.via.name + ', puis ' + LABELS[opt.modes[1]].toLowerCase();
  }

  T.router = {
    search: search,
    rank: rank,
    condense: condense,
    describe: describe,
    hubCandidates: hubCandidates,
    serviceFor: serviceFor,
    labels: LABELS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
