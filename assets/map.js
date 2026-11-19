/* Concept: the map of Pushcha. Loads the pre-built SVG (tools/build-map.py) into the page, so its colours
   follow the theme (style.css). Its three zones show their lines on hover (an SVG <title>); no status, and
   what a click on a zone does is not decided yet.
   Zoom (owner, 2026-11-19): the + / − / whole-map buttons, two fingers, Ctrl + wheel (a trackpad pinch sends
   the same), a double click. Zoomed in, the map is dragged with one finger or the mouse. A plain wheel and,
   at rest, one finger still scroll the page. Zoom only changes the SVG viewBox: nothing is loaded.
   Markers (owner, 2026-11-19): meetings, problems, initiatives and news at their landmark (data/places.json);
   tap one to see what is there. map.html#<item id> opens the map on that item («На мапі» on other pages). */
(function () {
  'use strict';
  var MAX = 6;          // closest zoom: a block of the grid then fills most of a phone screen
  var STEP = 1.6;       // one press of + or −

  function button(cls, label, path) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('aria-label', label);
    b.title = label;
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 18 18');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path);
    s.appendChild(p);
    b.appendChild(s);
    return b;
  }

  function zoomable(box, svg) {
    var vb = svg.viewBox.baseVal;
    var home = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    var z = 1, cx = home.x + home.w / 2, cy = home.y + home.h / 2;

    var bar = document.createElement('div');
    bar.className = 'map-zoom';
    var plus = button('map-zoom-in', 'Наблизити', 'M9 3v12M3 9h12');
    var minus = button('map-zoom-out', 'Віддалити', 'M3 9h12');
    var whole = button('map-zoom-home', 'Уся мапа', 'M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4');
    bar.appendChild(plus);
    bar.appendChild(minus);
    bar.appendChild(whole);
    box.appendChild(bar);

    function apply() {
      var w = home.w / z, h = home.h / z;
      cx = Math.min(Math.max(cx, home.x + w / 2), home.x + home.w - w / 2);
      cy = Math.min(Math.max(cy, home.y + h / 2), home.y + home.h - h / 2);
      svg.setAttribute('viewBox', [cx - w / 2, cy - h / 2, w, h].map(function (v) { return v.toFixed(2); }).join(' '));
      svg.style.setProperty('--mz', (1 / Math.sqrt(z)).toFixed(3));
      box.classList.toggle('is-zoomed', z > 1.001);
      plus.disabled = z >= MAX - 0.001;
      minus.disabled = whole.disabled = z <= 1.001;
    }

    // a point on the screen → map units (the SVG keeps its aspect, so one scale fits both axes)
    function toMap(clientX, clientY) {
      var r = svg.getBoundingClientRect();
      var w = home.w / z;
      return { x: cx - w / 2 + (clientX - r.left) / r.width * w, y: cy - home.h / z / 2 + (clientY - r.top) / r.height * home.h / z };
    }

    // zoom by f, keeping the map point under (clientX, clientY) where it is
    function zoomAt(f, clientX, clientY) {
      var nz = Math.min(Math.max(z * f, 1), MAX);
      if (nz === z) return;
      var p = clientX == null ? { x: cx, y: cy } : toMap(clientX, clientY);
      cx = p.x - (p.x - cx) * z / nz;
      cy = p.y - (p.y - cy) * z / nz;
      z = nz;
      apply();
    }

    function panBy(dxPx, dyPx) {
      var r = svg.getBoundingClientRect();
      cx -= dxPx / r.width * home.w / z;
      cy -= dyPx / r.height * home.h / z;
      apply();
    }

    plus.addEventListener('click', function () { zoomAt(STEP); });
    minus.addEventListener('click', function () { zoomAt(1 / STEP); });
    whole.addEventListener('click', function () { z = 1; apply(); });

    svg.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;          // a plain wheel scrolls the page
      e.preventDefault();
      var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-d * 0.004), e.clientX, e.clientY);   // one wheel notch ≈ ×1.5; a pinch, smoothly
    }, { passive: false });

    svg.addEventListener('dblclick', function (e) {
      e.preventDefault();
      zoomAt(STEP, e.clientX, e.clientY);
    });

    // fingers and the mouse: one pointer drags (when zoomed in), two pinch
    var pts = {};
    var pinch = null;
    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; }

    // The pointer is captured only once it really moves, so a tap on a marker stays a plain click;
    // a click right after a drag is swallowed, so dragging never opens a marker.
    var dragged = false;
    svg.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && (e.button !== 0 || z <= 1.001)) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
      dragged = false;
      var l = list();
      if (l.length === 2) pinch = mid(l[0], l[1]);
    });
    svg.addEventListener('pointermove', function (e) {
      var p = pts[e.pointerId];
      if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      var l = list();
      if (l.length === 1 && z <= 1.001) return;      // at rest one finger scrolls the page
      if (!dragged && Math.abs(p.x - p.x0) + Math.abs(p.y - p.y0) < 5 && l.length < 2) return;
      if (!dragged) {
        dragged = true;
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* not capturable: fine */ }
      }
      if (l.length >= 2 && pinch) {
        var m = mid(l[0], l[1]);
        if (pinch.d > 0) zoomAt(m.d / pinch.d, m.x, m.y);
        panBy(m.x - pinch.x, m.y - pinch.y);
        pinch = m;
        e.preventDefault();
      } else if (l.length === 1) {
        box.classList.add('is-dragging');
        panBy(dx, dy);
        e.preventDefault();
      }
    });
    function up(e) {
      delete pts[e.pointerId];
      var l = list();
      pinch = l.length === 2 ? mid(l[0], l[1]) : null;
      if (!l.length) box.classList.remove('is-dragging');
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('click', function (e) {
      if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
    }, true);

    apply();
    return {
      // show one place: zoom to `nz` with (x, y) in the middle, or keep the zoom if it is already closer
      focus: function (x, y, nz) { z = Math.max(z, Math.min(MAX, nz)); cx = x; cy = y; apply(); }
    };
  }

  /* ---------- what is happening where (owner, 2026-11-19) ----------
     Meetings ahead, problems, initiatives and news that name a landmark ("spot" → data/places.json) become markers.
     Never on the map: gossip (unverified), the help board (vulnerable people: district level only), a meeting whose
     address is for participants only. One marker per landmark; its colour is the most important thing there. */
  var KINDS = {
    problem: { word: 'Проблема', rank: 0 },
    event: { word: 'Зустріч', rank: 1 },
    initiative: { word: 'Ініціатива', rank: 2 },
    news: { word: 'Новина', rank: 3 },
    solved: { word: 'Проблема', rank: 4 }
  };
  var NS = 'http://www.w3.org/2000/svg';
  var SPOT_GAP = 28;    // map units between two marker centres, at least (a marker is 24 across)

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ddmm(ms) { var d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { return d; }, function () { return null; });
  }

  function collect(places, events, posts) {
    var PH = window.PH, now = Date.now();
    var byId = {};
    ((places && places.places) || []).forEach(function (p) {
      if (p && p.id && typeof p.lat === 'number' && typeof p.lon === 'number') byId[p.id] = p;
    });
    var items = [];
    function add(kind, x, label, href) {
      if (!x.spot || !byId[x.spot]) return;
      items.push({ id: x.id, kind: kind, spot: x.spot, title: x.title, label: label, href: href });
    }
    var E = PH.prepEvents(events, now);
    ['today', 'week', 'later'].forEach(function (g) {
      E.groups[g].forEach(function (ev) {
        if (ev.isPrivate) return;
        add('event', ev, PH.dayLabel(ev.occ.start, now).split(',')[0] + ' · ' + hhmm(ev.occ.start), 'events.html#' + ev.id);
      });
    });
    var P = PH.prepPosts(posts, now);
    P.problems.forEach(function (p) {
      add(p.state === 'вирішено' ? 'solved' : 'problem', p, p.state + ' · ' + ddmm(p.day), 'news.html#' + p.id);
    });
    P.initiatives.forEach(function (n) { add('initiative', n, ddmm(n.day), 'news.html#' + n.id); });
    P.news.forEach(function (n) { add('news', n, ddmm(n.day), 'news.html#' + n.id); });
    items.sort(function (a, b) { return KINDS[a.kind].rank - KINDS[b.kind].rank; });
    var spots = {};
    items.forEach(function (it) {
      var s = spots[it.spot] || (spots[it.spot] = { id: it.spot, place: byId[it.spot], items: [] });
      s.items.push(it);
    });
    return { items: items, spots: spots };
  }

  function markers(svg, data, onPick) {
    var k = (svg.getAttribute('data-geo') || '').split(' ').map(Number);   // lon/lat → map units (tools/build-map.py)
    if (k.length !== 6 || k.some(isNaN)) return {};
    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'm-spots');
    var made = {};
    // positions; two landmarks closer than a marker (a stop and the café beside it) are pushed apart a little
    var pos = {};
    var ids = Object.keys(data.spots);
    ids.forEach(function (id) {
      var p = data.spots[id].place;
      pos[id] = { x: k[0] * p.lon + k[1] * p.lat + k[2], y: k[3] * p.lon + k[4] * p.lat + k[5] };
    });
    for (var pass = 0; pass < 4; pass++) {
      ids.forEach(function (a, i) {
        ids.slice(i + 1).forEach(function (b) {
          var dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y, d = Math.hypot(dx, dy) || 0.01;
          if (d >= SPOT_GAP) return;
          var push = (SPOT_GAP - d) / 2;
          pos[a].x -= dx / d * push; pos[a].y -= dy / d * push;
          pos[b].x += dx / d * push; pos[b].y += dy / d * push;
        });
      });
    }
    ids.forEach(function (id) {
      var s = data.spots[id];
      var x = pos[id].x, y = pos[id].y;
      var top = s.items[0].kind;                      // the most important thing here sets the colour
      var m = document.createElementNS(NS, 'g');
      m.setAttribute('class', 'm-spot m-spot-' + top);
      m.setAttribute('tabindex', '0');
      m.setAttribute('role', 'button');
      m.setAttribute('aria-label', s.place.name + ': ' + s.items.length + ' ' + (s.items.length === 1 ? 'запис' : s.items.length < 5 ? 'записи' : 'записів'));
      // CSSOM, not an attribute: the marker keeps its size while the map zooms (--mz, set by zoomable)
      m.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) scale(var(--mz, 1))';
      var hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('r', '22'); hit.setAttribute('class', 'm-spot-hit');
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '12'); dot.setAttribute('class', 'm-spot-dot');
      m.appendChild(hit); m.appendChild(dot);
      if (s.items.length > 1) {
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('class', 'm-spot-n'); t.setAttribute('y', '0.5');
        t.textContent = String(s.items.length);
        m.appendChild(t);
      }
      m.addEventListener('click', function () { onPick(id, false); });
      m.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id, false); }
      });
      layer.appendChild(m);
      made[id] = { el: m, x: x, y: y };
    });
    svg.appendChild(layer);
    return made;
  }

  function spotsUI(box, svg, view) {
    var cardBox = document.getElementById('spot-card');
    var listBox = document.getElementById('spot-list');
    if (!cardBox || !listBox) return;
    Promise.all([getJSON('data/places.json'), getJSON('data/events.json'), getJSON('data/posts.json')]).then(function (r) {
      var data = collect(r[0], r[1], r[2]);
      var made = {};
      var itemSpot = {};
      data.items.forEach(function (it) { itemSpot[it.id] = it.spot; });

      function pick(id, zoom, itemId) {
        var s = data.spots[id];
        if (!s) return;
        Object.keys(made).forEach(function (k) { made[k].el.classList.toggle('is-on', k === id); });
        cardBox.textContent = '';
        cardBox.appendChild(node('p', 'micro', s.place.name));
        var ul = node('ul', 'spot-items');
        s.items.forEach(function (it) {
          var a = node('a', 'spot-item' + (it.id === itemId ? ' is-picked' : ''));
          a.href = it.href;
          a.appendChild(node('span', 'micro spot-kind-' + it.kind, KINDS[it.kind].word + ' · ' + it.label));
          a.appendChild(node('span', 'item-title', it.title));
          var li = node('li');
          li.appendChild(a);
          ul.appendChild(li);
        });
        cardBox.appendChild(ul);
        cardBox.hidden = false;
        if (zoom && made[id]) view.focus(made[id].x, made[id].y, 2.5);
      }

      made = markers(svg, data, pick);

      listBox.textContent = '';
      if (!data.items.length) listBox.appendChild(node('li', 'muted', 'Поки на мапі нічого немає.'));
      data.items.forEach(function (it) {
        var a = node('a', 'row');
        a.href = '#' + it.id;                       // the same link other pages use: map.html#<id>
        a.appendChild(node('span', 'micro spot-kind-' + it.kind, KINDS[it.kind].word + ' · ' + it.label + ' · ' + data.spots[it.spot].place.name));
        a.appendChild(node('span', 'item-title', it.title));
        var li = node('li', 'item');
        li.appendChild(a);
        listBox.appendChild(li);
      });

      // map.html#<item id>: the place of that item, zoomed in, with the item marked (from «На мапі» on other pages)
      function fromHash() {
        var id = decodeURIComponent(location.hash.slice(1));
        if (!id || !itemSpot[id]) return;
        pick(itemSpot[id], true, id);
        box.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
      window.addEventListener('hashchange', fromHash);
      fromHash();
    });
  }

  function boot() {
    var box = document.getElementById('map');
    fetch('assets/map.svg').then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      box.textContent = '';
      var svg = document.importNode(doc.documentElement, true);
      box.appendChild(svg);
      var view = zoomable(box, svg);
      spotsUI(box, svg, view);
    }, function () { box.textContent = 'Не вдалося завантажити мапу.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
