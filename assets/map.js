/* TravIA — carte schematique de l'itineraire.
   Trace SVG sans fond de carte externe : les villes du referentiel servent de
   reperes geographiques, les segments prennent la couleur de leur mode. */
(function (global) {
  'use strict';

  var T = global.TravIA || (global.TravIA = {});
  var W = 340;

  function project(pts, width, height, pad) {
    var lats = pts.map(function (p) { return p.lat; });
    var lons = pts.map(function (p) { return p.lon; });
    var latMin = Math.min.apply(null, lats), latMax = Math.max.apply(null, lats);
    var lonMin = Math.min.apply(null, lons), lonMax = Math.max.apply(null, lons);
    var latMid = (latMin + latMax) / 2;
    var k = Math.cos(latMid * Math.PI / 180);

    var spanLon = Math.max((lonMax - lonMin) * k, 0.25);
    var spanLat = Math.max(latMax - latMin, 0.25);
    /* marge relative pour que les libelles tiennent dans le cadre */
    var mx = spanLon * 0.18, my = spanLat * 0.18;
    var x0 = lonMin * k - mx, x1 = lonMax * k + mx;
    var y0 = latMin - my, y1 = latMax + my;

    var sx = (width - pad * 2) / (x1 - x0);
    var sy = (height - pad * 2) / (y1 - y0);
    var s = Math.min(sx, sy);
    var ox = pad + ((width - pad * 2) - (x1 - x0) * s) / 2;
    var oy = pad + ((height - pad * 2) - (y1 - y0) * s) / 2;

    return {
      scale: s, k: k,
      at: function (p) {
        return {
          x: ox + (p.lon * k - x0) * s,
          y: oy + (y1 - p.lat) * s
        };
      },
      /* kilometres par pixel, pour l'echelle */
      kmPerPx: 111.32 / s,
      bounds: { latMin: y0, latMax: y1, lonMin: x0 / k, lonMax: x1 / k }
    };
  }

  function polyline(proj, pts) {
    return pts.map(function (p) {
      var q = proj.at(p);
      return q.x.toFixed(1) + ',' + q.y.toFixed(1);
    }).join(' ');
  }

  /* arc leger pour les segments aeriens */
  function arc(proj, a, b) {
    var p = proj.at(a), q = proj.at(b);
    var mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    var dx = q.x - p.x, dy = q.y - p.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var off = Math.min(28, len * 0.14);
    return 'M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) +
      ' Q' + (mx - dy / len * off).toFixed(1) + ' ' + (my + dx / len * off).toFixed(1) +
      ' ' + q.x.toFixed(1) + ' ' + q.y.toFixed(1);
  }

  function niceScale(km) {
    var steps = [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= km) return steps[i];
    return steps[steps.length - 1];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* segments : [{ from, to, mode, path }] — path est la suite de villes
     traversees pour les modes terrestres, sinon null. */
  function render(canvas, legend, segments) {
    if (!segments || !segments.length) {
      canvas.innerHTML = '';
      legend.innerHTML = '';
      return;
    }
    var pts = [];
    segments.forEach(function (s) {
      pts.push(s.from, s.to);
      if (s.path) s.path.forEach(function (p) { pts.push(p); });
    });

    var spanLat = Math.max.apply(null, pts.map(function (p) { return p.lat; })) -
                  Math.min.apply(null, pts.map(function (p) { return p.lat; }));
    var spanLon = Math.max.apply(null, pts.map(function (p) { return p.lon; })) -
                  Math.min.apply(null, pts.map(function (p) { return p.lon; }));
    var ratio = spanLat / Math.max(spanLon * 0.7, 0.2);
    var H = Math.round(Math.max(190, Math.min(320, W * Math.max(0.55, Math.min(1.05, ratio)))));
    var proj = project(pts, W, H, 16);

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Carte de l itineraire">'];

    /* reperes : villes du referentiel visibles dans le cadre */
    var b = proj.bounds, dots = 0;
    T.PLACES.forEach(function (p) {
      if (dots > 70) return;
      if (p.lat < b.latMin || p.lat > b.latMax || p.lon < b.lonMin || p.lon > b.lonMax) return;
      var q = proj.at(p);
      dots++;
      svg.push('<circle class="map-dot" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="1.6"/>');
    });

    /* segments */
    segments.forEach(function (s) {
      if (s.mode === 'plane') {
        svg.push('<path class="map-route map-route--plane" d="' + arc(proj, s.from, s.to) + '"/>');
      } else {
        var chain = (s.path && s.path.length > 1) ? s.path : [s.from, s.to];
        svg.push('<polyline class="map-route map-route--' + s.mode + '" points="' + polyline(proj, chain) + '"/>');
      }
    });

    /* points de l'itineraire */
    var stops = [segments[0].from].concat(segments.map(function (s) { return s.to; }));
    stops.forEach(function (p, i) {
      var q = proj.at(p);
      var last = i === stops.length - 1;
      var end = i === 0 || last;
      if (end) {
        svg.push('<rect class="map-stop map-stop--end" x="' + (q.x - 3.5).toFixed(1) + '" y="' +
          (q.y - 3.5).toFixed(1) + '" width="7" height="7"/>');
      } else {
        svg.push('<circle class="map-stop" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="3.2"/>');
      }
      var right = q.x < W * 0.62;
      svg.push('<text class="map-label' + (end ? ' map-label--end' : '') + '" x="' +
        (q.x + (right ? 7 : -7)).toFixed(1) + '" y="' + (q.y + 3.4).toFixed(1) + '"' +
        (right ? '' : ' text-anchor="end"') + '>' + esc(p.name) + '</text>');
    });

    /* echelle */
    var target = niceScale(proj.kmPerPx * 70);
    var px = target / proj.kmPerPx;
    var by = H - 11, bx = 14;
    svg.push('<line class="map-scale" x1="' + bx + '" y1="' + by + '" x2="' + (bx + px).toFixed(1) + '" y2="' + by + '"/>');
    svg.push('<line class="map-scale" x1="' + bx + '" y1="' + (by - 3) + '" x2="' + bx + '" y2="' + (by + 3) + '"/>');
    svg.push('<line class="map-scale" x1="' + (bx + px).toFixed(1) + '" y1="' + (by - 3) + '" x2="' + (bx + px).toFixed(1) + '" y2="' + (by + 3) + '"/>');
    svg.push('<text class="map-scale-text" x="' + (bx + px + 5).toFixed(1) + '" y="' + (by + 3.2) + '">' +
      target.toLocaleString('fr-FR') + ' km</text>');

    svg.push('</svg>');
    canvas.innerHTML = svg.join('');

    var used = {};
    segments.forEach(function (s) { used[s.mode] = true; });
    var names = { car: 'Voiture', train: 'Train', plane: 'Avion', pending: 'Itineraire a calculer' };
    var measured = segments.some(function (s) { return s.measured; });
    legend.innerHTML = Object.keys(names).filter(function (m) { return used[m]; }).map(function (m) {
      return '<span class="map__key map__key--' + m + '"><span class="map__swatch"></span>' + names[m] + '</span>';
    }).join('') + '<span class="map__key">' +
      (measured ? 'Trace routier mesure sur OpenStreetMap' : 'Trace schematique, villes du referentiel en repere') +
      '</span>';
  }

  T.map = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
