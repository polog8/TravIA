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

  /* Itineraire routier reel. points = [{lat, lon}, ...] dans l'ordre du trajet. */
  function route(points) {
    if (!points || points.length < 2) return Promise.resolve(null);
    var coords = points.map(function (p) { return p.lon.toFixed(5) + ',' + p.lat.toFixed(5); }).join(';');
    var url = OSRM + coords + '?overview=false&alternatives=false&steps=false';
    return withTimeout(url, 8000).then(function (data) {
      if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) return null;
      var r = data.routes[0];
      return {
        distanceKm: r.distance / 1000,
        durationMin: r.duration / 60,
        legs: (r.legs || []).map(function (l) {
          return { distanceKm: l.distance / 1000, durationMin: l.duration / 60 };
        })
      };
    }).catch(function () { return null; });
  }

  T.providers = { geocode: geocode, route: route, available: typeof fetch === 'function' };
})(typeof globalThis !== 'undefined' ? globalThis : this);
