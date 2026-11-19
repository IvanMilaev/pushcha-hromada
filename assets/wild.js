/* «Дика Пуща» — four home-page concepts from the owner's Pinterest board wild-nature.
   Same live data as the real home page (status, coffee, news); only the aesthetic changes.
   1 Значок   — national-park badge: colour blocks on mocha, pine pictogram, chunky caps (pin 1)
   2 Туман    — misty forest, words spread across the width, water as a zigzag (pin 2)
   3 Пари     — full-width colour bands, one job each, a hills-and-ponds mark (pin 3)
   4 Плакат   — grainy paper poster, huge rugged caps, notice-board lines in mono (pin 4)
   The choice lives in the URL hash (#1 … #4). */
(function () {
  'use strict';
  var PH = window.PH;
  var GEN = { water: 'води', power: 'світла', heating: 'тепла', connectivity: 'зв’язку' };
  var NOM = { water: 'вода', power: 'світло', heating: 'тепло', connectivity: 'зв’язок' };
  var NAME = { water: 'Вода', power: 'Світло', heating: 'Тепло', connectivity: 'Зв’язок' };
  var WD = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота'];
  var CONCEPTS = {
    1: ['Значок', 'Колірні блоки на темному, сосна-піктограма, грубі великі літери. Як значок національного парку.'],
    2: ['Туман', 'Туманний ліс на весь перший екран, слова розкладені по ширині, вода — зигзагом. Тихо й атмосферно.'],
    3: ['Пари', 'Сторінка — це стрічки на всю ширину, кожна своєї пари кольорів і з однією справою. Знак: пагорби і ставки.'],
    4: ['Плакат', 'Зернистий папір, величезні грубі літери, нижче — рядки як на дошці оголошень у парку.']
  };

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ddmm(ms) { var d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function list(w) { return w.length < 2 ? w.join('') : w.slice(0, -1).join(', ') + ' і ' + w[w.length - 1]; }

  // h('div.cls', [children]) — children are strings or nodes; null is skipped.
  function h(sel, kids, attrs) {
    var p = sel.split('.');
    var n = document.createElement(p[0] || 'div');
    if (p.length > 1) n.className = p.slice(1).join(' ');
    (kids || []).forEach(function (k) { if (k != null && k !== '') n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    if (attrs) Object.keys(attrs).forEach(function (a) { n.setAttribute(a, attrs[a]); });
    return n;
  }
  function icon(href, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', href);
    s.appendChild(u);
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    return s;
  }
  var SVC_ICON = { water: 'assets/icons.svg#i-water', power: 'assets/icons.svg#i-power', heating: 'assets/icons.svg#i-heating', connectivity: 'assets/icons.svg#i-connectivity' };
  function a(href, kids, cls) { var n = h('a' + (cls ? '.' + cls : ''), kids); n.href = href; return n; }

  /* ---------- one model for all four concepts ---------- */
  function model(status, events, posts, now) {
    var p = PH.prepStatus(status, now);
    var no = [], yes = [], stale = [], unknown = [];
    var services = p.items.map(function (it) {
      var cls = it.stale ? 'stale' : it.state === 'є' ? 'ok' : it.state === 'немає' ? 'no' : 'unknown';
      ({ stale: stale, ok: yes, no: no, unknown: unknown })[cls].push(it.key);
      return { key: it.key, name: NAME[it.key], cls: cls, word: it.stale ? 'не підтверджено' : it.state };
    });
    var sub = [];
    if (yes.length && no.length) sub.push(cap(list(yes.map(function (k) { return NOM[k]; }))) + ' є.');
    if (stale.length) sub.push(cap(list(stale.map(function (k) { return NOM[k]; }))) + ' — не підтверджено.');
    if (unknown.length) sub.push(cap(list(unknown.map(function (k) { return NOM[k]; }))) + ' — невідомо.');
    var water = p.items.filter(function (it) { return it.key === 'water'; })[0];
    var needWater = water && (water.state !== 'є' || water.stale) && p.points.length;
    var E = PH.prepEvents(events, now);
    var c = E.coffee && E.coffee.occ ? E.coffee : null;
    var newest = Math.max.apply(null, p.items.map(function (it) { return it.ms || 0; }));
    return {
      day: WD[new Date(now).getDay()], date: ddmm(now), time: hhmm(now),
      headline: no.length ? 'Немає ' + list(no.map(function (k) { return GEN[k]; })) + '.' : 'Усе працює.',
      sub: sub.join(' '),
      updated: newest ? 'оновлено ' + PH.ageText(newest, now) : '',
      services: services,
      point: needWater ? { name: p.points[0].name, place: p.points[0].place, hours: p.points[0].hours, more: p.points.length - 1 } : null,
      coffee: c ? { day: cap(PH.dayLabel(c.occ.start, now).split(',')[0]), time: hhmm(c.occ.start), place: c.isPrivate ? 'адреса — учасникам' : c.place, id: c.id } : null,
      news: PH.prepPosts(posts, now).news.slice(0, 3).map(function (n) { return { id: n.id, date: ddmm(n.day), title: n.title }; })
    };
  }

  /* ---------- 1 · Значок ---------- */
  function c1(m) {
    return h('div', [
      h('header.c1-top', [h('span.c1-brand', [icon('assets/wild-icons.svg#w-pine', 'c1-pine'), 'Пуща']), h('span.c1-time', [m.day + ' · ' + m.time])]),
      h('h1.c1-h1', [m.headline]),
      h('p.c1-sub', [m.sub]),
      m.point ? a('status.html#h-water', ['Де взяти воду', icon('assets/icons.svg#i-chevron')], 'c1-act') : null,
      h('div.c1-grid', m.services.map(function (s) {
        return h('div.c1-tile.is-' + s.cls, [icon(SVC_ICON[s.key], 'c1-ico'), h('span.c1-name', [s.name]), h('span.c1-word', [s.word])]);
      })),
      h('p.c1-upd', [m.updated]),
      m.coffee ? a('events.html#' + m.coffee.id, [
        h('span.c1-ribbon', [icon('assets/wild-icons.svg#w-pine', 'c1-rp'), h('span', ['Кава з сусідами']), icon('assets/wild-icons.svg#w-pine', 'c1-rp')]),
        h('span.c1-when', [m.coffee.day + ' · ' + m.coffee.time + ' · ' + m.coffee.place])
      ], 'c1-coffee') : null,
      h('section.c1-paper', [h('h2.c1-h2', ['Новини'])].concat(m.news.map(function (n) {
        return a('news.html#' + n.id, [h('span.c1-date', [n.date]), h('span', [n.title])], 'c1-news');
      })))
    ]);
  }

  /* ---------- 2 · Туман ---------- */
  function c2(m) {
    var water = m.services.filter(function (s) { return s.key === 'water'; })[0];
    return h('div', [
      h('section.c2-hero', [
        h('p.c2-spread', [h('span', ['Пуща']), h('span', [m.day]), h('span', [m.time])]),
        h('h1.c2-h1', [m.headline]),
        water.cls === 'no' ? icon('assets/wild-icons.svg#w-zigzag', 'c2-zig') : icon('assets/wild-icons.svg#w-moon', 'c2-zig'),
        h('p.c2-spread.c2-low', m.services.filter(function (s) { return s.key !== 'water'; }).map(function (s) {
          return h('span.is-' + s.cls, [s.name + (s.cls === 'ok' ? ' є' : s.cls === 'no' ? ' — ні' : ' ?')]);
        }))
      ]),
      h('section.c2-body', [
        m.point ? a('status.html#h-water', [h('span.c2-label', ['Де взяти воду']), h('span.c2-big', [m.point.name.replace(' (приклад)', '')]),
          h('span.c2-meta', [m.point.place + (m.point.hours ? ' · ' + m.point.hours : '') + (m.point.more > 0 ? ' · ще ' + m.point.more : '')])], 'c2-row') : null,
        m.coffee ? a('events.html#' + m.coffee.id, [h('span.c2-label', [m.coffee.day + ' · ' + m.coffee.time]), h('span.c2-big', ['Кава з сусідами']),
          h('span.c2-meta', [m.coffee.place])], 'c2-row') : null,
        h('h2.c2-label.c2-sec', ['Новини'])
      ].concat(m.news.map(function (n) { return a('news.html#' + n.id, [h('span.c2-label', [n.date]), h('span.c2-title', [n.title])], 'c2-row'); }))
        .concat([h('p.c2-meta.c2-upd', [m.sub + ' ' + cap(m.updated) + '.'])]))
    ]);
  }

  /* ---------- 3 · Пари ---------- */
  function c3(m) {
    function band(cls, kids) { return h('section.c3-band.' + cls, [h('div.c3-in', kids)]); }
    return h('div', [
      band('c3-forest', [h('p.c3-brand', [icon('assets/wild-icons.svg#w-mark', 'c3-mark'), 'Пуща-громада']), h('h1.c3-h1', [m.headline]), h('p.c3-sub', [m.sub])]),
      m.point ? band('c3-orange', [h('p.c3-label', ['Де взяти воду']), a('status.html#h-water', [h('span.c3-big', [m.point.name.replace(' (приклад)', '')]),
        h('span.c3-meta', [m.point.place + (m.point.hours ? ' · ' + m.point.hours : '')]), h('span.c3-more', [m.point.more > 0 ? 'Ще ' + m.point.more + ' місця →' : 'Детальніше →'])], 'c3-link')]) : null,
      band('c3-ink', [h('p.c3-label', ['Зараз · ' + m.updated])].concat(m.services.map(function (s) {
        return h('p.c3-svc.is-' + s.cls, [h('span', [s.name]), h('span.c3-word', [s.word])]);
      }))),
      m.coffee ? band('c3-sky', [h('p.c3-label', [m.coffee.day + ' · ' + m.coffee.time]), a('events.html#' + m.coffee.id, [h('span.c3-big', ['Кава з сусідами']), h('span.c3-meta', [m.coffee.place])], 'c3-link')]) : null,
      band('c3-mist', [h('p.c3-label', ['Новини'])].concat(m.news.map(function (n) {
        return a('news.html#' + n.id, [h('span.c3-date', [n.date]), h('span', [n.title])], 'c3-news');
      })))
    ]);
  }

  /* ---------- 4 · Плакат ---------- */
  function c4(m) {
    return h('div.c4-paper', [
      h('p.c4-mono', ['Пуща-Водиця: ' + m.day + ', ' + m.date + ', ' + m.time + '. Вода, світло, тепло, зв’язок.']),
      h('p.c4-kicker', ['Стан на зараз…']),
      h('h1.c4-h1', [m.headline]),
      h('div.c4-board', m.services.map(function (s) {
        return h('p.c4-line.is-' + s.cls, [h('span', [s.name]), h('span.c4-dots'), h('span.c4-word', [s.word])]);
      })),
      m.point ? a('status.html#h-water', ['Де взяти воду →'], 'c4-act') : null,
      m.coffee ? h('p.c4-mono.c4-gap', ['Кава з сусідами: ' + m.coffee.day.toLowerCase() + ', ' + m.coffee.time + ', ' + m.coffee.place + '.']) : null,
      h('div.c4-news', [h('p.c4-kicker', ['Новини'])].concat(m.news.map(function (n) {
        return a('news.html#' + n.id, [h('span.c4-mono', [n.date]), h('span', [n.title])], 'c4-item');
      }))),
      h('p.c4-mono.c4-gap', [cap(m.updated) + '. Тестові дані.'])
    ]);
  }

  var RENDER = { 1: c1, 2: c2, 3: c3, 4: c4 };
  var state = { c: '1', m: null };

  function draw() {
    document.body.className = 'wild c' + state.c;
    $('c-name').textContent = state.c + ' · ' + CONCEPTS[state.c][0];
    $('c-why').textContent = CONCEPTS[state.c][1];
    Array.prototype.forEach.call(document.querySelectorAll('.w-switch button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-c') === state.c ? 'true' : 'false');
    });
    var stage = $('stage');
    stage.textContent = '';
    if (state.m) stage.appendChild(RENDER[state.c](state.m));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', { 1: '#3B3735', 2: '#B7A3D2', 3: '#496A4E', 4: '#2E3A7A' }[state.c]);
  }
  function fromHash() { var c = location.hash.slice(1); state.c = CONCEPTS[c] ? c : '1'; }

  function boot() {
    fromHash();
    Array.prototype.forEach.call(document.querySelectorAll('.w-switch button'), function (b) {
      b.addEventListener('click', function () { history.replaceState(null, '', '#' + b.getAttribute('data-c')); fromHash(); draw(); window.scrollTo(0, 0); });
    });
    window.addEventListener('hashchange', function () { fromHash(); draw(); });
    draw();
    var get = function (u) { return fetch(u).then(function (r) { return r.json(); }).then(null, function () { return null; }); };
    Promise.all([get('data/status.json'), get('data/events.json'), get('data/posts.json')]).then(function (r) {
      var now = Date.now();
      state.m = model(r[0], r[1], r[2], now);
      draw();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
