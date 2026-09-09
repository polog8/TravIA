/* TravIA — acces aux services ouverts.
   Deux services sont interroges depuis le navigateur, sans cle d'API :
     - Nominatim (OpenStreetMap) pour geocoder un lieu absent du referentiel ;
     - OSRM pour mesurer un itineraire routier reel, points de passage compris.
   Toute erreur ou indisponibilite bascule silencieusement sur le modele
   interne ; l'origine de la donnee est ensuite affichee dans les resultats. */
(function (global) {
  'use strict';

  var T = global.TravIA || (global.TravIA = {});

  var NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  var OSRM = 'https://router.project-osrm.org/route/v1/driving/';

  function withTimeout(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 7000);
    return fetch(url, {
      signal: ctrl ? ctrl.signal : undefined,
      headers: { 'Accept': 'application/json' }
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  /* Geocodage d'une chaine libre. Renvoie [] si le service est injoignable. */
  function geocode(query) {
    var url = NOMINATIM + '?q=' + encodeURIComponent(query) +
      '&format=jsonv2&limit=5&addressdetails=1&accept-language=fr';
    return withTimeout(url, 7000).then(function (rows) {
      return (rows || []).map(function (r) {
        var addr = r.address || {};
        var label = r.display_name.split(',').slice(0, 2).join(',').trim();
        return {
          label: label,
          detail: r.display_name,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          country: addr.country || '',
          cc: (addr.country_code || '').toUpperCase()
        };
      });
    }).catch(function () { return []; });
  }

  /* Reduit une trace a un nombre de points raisonnable pour l'affichage. */
  function simplify(coords, maxPoints) {
    if (coords.length <= maxPoints) return coords;
    var step = coords.length / maxPoints;
    var out = [];
    for (var i = 0; i < coords.length; i += step) out.push(coords[Math.floor(i)]);
    out.push(coords[coords.length - 1]);
    return out;
  }

  function nearestIndex(coords, target) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < coords.length; i++) {
      var dx = coords[i][0] - target[0], dy = coords[i][1] - target[1];
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /* Itineraire routier reel, avec sa geometrie. points = [{lat, lon}, ...]. */
  function route(points) {
    if (!points || points.length < 2) return Promise.resolve(null);
    var coords = points.map(function (p) { return p.lon.toFixed(5) + ',' + p.lat.toFixed(5); }).join(';');
    var url = OSRM + coords + '?overview=full&geometries=geojson&alternatives=false&steps=false';
    return withTimeout(url, 10000).then(function (data) {
      if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) return null;
      var r = data.routes[0];
      var line = (r.geometry && r.geometry.coordinates) || [];

      /* decoupage de la trace aux points de passage */
      var cuts = [0];
      (data.waypoints || []).slice(1, -1).forEach(function (w) {
        cuts.push(nearestIndex(line, w.location));
      });
      cuts.push(Math.max(0, line.length - 1));

      return {
        distanceKm: r.distance / 1000,
        durationMin: r.duration / 60,
        legs: (r.legs || []).map(function (l, i) {
          var slice = line.length ? line.slice(cuts[i], cuts[i + 1] + 1) : [];
          return {
            distanceKm: l.distance / 1000,
            durationMin: l.duration / 60,
            coords: simplify(slice, 260).map(function (c) { return { lat: c[1], lon: c[0] }; })
          };
        })
      };
    }).catch(function () { return null; });
  }

  /* ----------------------------------------------- horaires ferroviaires ----
     Interroge l'API ouverte v6.db.transport.rest, passerelle publique vers le
     systeme horaire de la Deutsche Bahn. Elle couvre les grands reseaux
     europeens, sans cle ni compte. Les tarifs ne sont renvoyes que sur une
     partie des relations ; a defaut, le prix du modele est conserve et
     signale comme tel. Tout echec bascule sur le modele interne. */

  var RAIL_API = 'https://v6.db.transport.rest';
  var stopCache = {};

  function railStopId(name, lat, lon) {
    var key = name + '|' + lat.toFixed(2) + ',' + lon.toFixed(2);
    if (stopCache[key] !== undefined) return Promise.resolve(stopCache[key]);
    var url = RAIL_API + '/locations?query=' + encodeURIComponent(name) +
      '&results=6&stops=true&addresses=false&poi=false&linesOfStops=false';
    return withTimeout(url, 8000).then(function (rows) {
      if (!Array.isArray(rows) || !rows.length) { stopCache[key] = null; return null; }
      var best = null, bestD = Infinity;
      rows.forEach(function (r) {
        if (!r || !r.id || !r.location) return;
        var dLat = r.location.latitude - lat, dLon = (r.location.longitude - lon) * 0.7;
        var d = dLat * dLat + dLon * dLon;
        if (d < bestD) { bestD = d; best = r; }
      });
      /* au-dela d'environ 60 km, la gare trouvee n'est pas celle demandee */
      var out = best && bestD < 0.5 ? { id: best.id, name: best.name } : null;
      stopCache[key] = out;
      return out;
    }).catch(function () { stopCache[key] = null; return null; });
  }

  function isoLocal(d) {
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    off = Math.abs(off);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':00' +
      sign + p(Math.floor(off / 60)) + ':' + p(off % 60);
  }

  /* Renvoie { offers, source } ou { error }. */
  function railJourneys(fromStation, toStation, when, results) {
    if (!fromStation || !toStation) return Promise.resolve({ error: 'gare inconnue' });
    return Promise.all([
      railStopId(fromStation.name, fromStation.lat, fromStation.lon),
      railStopId(toStation.name, toStation.lat, toStation.lon)
    ]).then(function (stops) {
      if (!stops[0] || !stops[1]) return { error: 'gares non reconnues par le service' };
      var url = RAIL_API + '/journeys?from=' + encodeURIComponent(stops[0].id) +
        '&to=' + encodeURIComponent(stops[1].id) +
        '&departure=' + encodeURIComponent(isoLocal(when)) +
        '&results=' + (results || 6) +
        '&stopovers=false&remarks=false&language=fr';
      return withTimeout(url, 12000).then(function (data) {
        if (!data || !Array.isArray(data.journeys) || !data.journeys.length) {
          return { error: 'aucun trajet renvoye' };
        }
        var offers = data.journeys.map(function (j) {
          return normalizeJourney(j, stops[0], stops[1]);
        }).filter(Boolean);
        return offers.length ? { offers: offers, source: 'v6.db.transport.rest' }
                             : { error: 'trajets illisibles' };
      });
    }).catch(function (e) {
      return { error: (e && e.message) || 'service injoignable' };
    });
  }

  function normalizeJourney(j, fromStop, toStop) {
    var legs = (j.legs || []).filter(function (l) { return l && !l.walking; });
    if (!legs.length) return null;
    var first = legs[0], last = legs[legs.length - 1];
    var dep = new Date(first.plannedDeparture || first.departure);
    var arr = new Date(last.plannedArrival || last.arrival);
    if (isNaN(dep) || isNaN(arr) || arr <= dep) return null;

    var lines = [];
    legs.forEach(function (l) {
      var n = l.line && (l.line.name || l.line.fahrtNr);
      if (n && lines.indexOf(n) < 0) lines.push(n);
    });
    var operator = lines.slice(0, 3).join(' + ') || 'Train';
    var company = (first.line && first.line.operator && first.line.operator.name) || 'Operateur ferroviaire';

    return {
      operator: operator,
      company: company,
      depart: dep,
      arrivee: arr,
      durationMin: Math.round((arr - dep) / 60000),
      transfers: legs.length - 1,
      price: j.price && typeof j.price.amount === 'number' ? j.price.amount : null,
      currency: (j.price && j.price.currency) || 'EUR',
      fromLabel: (first.origin && first.origin.name) || fromStop.name,
      toLabel: (last.destination && last.destination.name) || toStop.name,
      products: legs.map(function (l) { return l.line && l.line.product; })
    };
  }

  T.providers = {
    geocode: geocode,
    route: route,
    railJourneys: railJourneys,
    available: typeof fetch === 'function'
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
