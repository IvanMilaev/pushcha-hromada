/* Home page «Пуща-Водиця» (owner, 2026-11-19): a board of tiles — news, problems, initiatives, gossip —
   like the brand sheet on the owner's board wild-nature. Colour by importance, not by kind: small tiles are
   neutral (a state word that matters is coloured), the two wide tiles — freshest news, lead initiative — carry a
   block colour, the coffee meeting is moss, and a missing service is a wide maple tile above the title.
   Every tile is one link to the full item (news.html, status.html, events.html). Reuses window.PH (app.js). */
(function () {
  'use strict';
  var PH = window.PH;
  var GEN = { water: 'води', power: 'світла', heating: 'тепла', connectivity: 'зв’язку' };
  var NOM = { water: 'вода', power: 'світло', heating: 'тепло', connectivity: 'зв’язок' };
  var SAMPLE = 'ТЕСТОВІ ДАНІ (приклад)';      // the same first line as every shared text in app.js

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ddmm(ms) { var d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function list(words) {
    if (words.length < 2) return words.join('');
    return words.slice(0, -1).join(', ') + ' і ' + words[words.length - 1];
  }
  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { return d; }, function () { return null; });
  }
  function pine(cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', 'assets/icons.svg#i-pine');
    s.appendChild(u);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', cls);
    return s;
  }

  /* One tile: a link with a small kind label, then an optional big word, a title and one meta line. */
  function tile(o) {
    var a = node('a', 'bt bt-' + o.kind + (o.wide ? ' bt-wide' : ''));
    a.href = o.href;
    var kind = node('span', 'bt-kind', o.label);
    if (o.state) {                                   // a state word that matters gets its colour (style.css)
      kind.appendChild(document.createTextNode(' · '));
      kind.appendChild(node('span', o.stateCls || '', o.state));
    }
    a.appendChild(kind);
    if (o.pic) a.appendChild(o.pic);
    if (o.picNote) a.appendChild(node('span', 'bt-pic-note', o.picNote));
    if (o.big) a.appendChild(node('span', 'bt-big', o.big));
    if (o.title) a.appendChild(node('span', 'bt-title', o.title));
    if (o.text) a.appendChild(node('span', 'bt-text', o.text));
    if (o.meta) a.appendChild(node('span', 'bt-meta', o.meta));
    if (o.mark) a.appendChild(pine('bt-mark'));
    if (!o.mapId) return a;
    // «На мапі»: a second link can't sit inside the tile link, so both go in a box, the map button in the corner
    var box = node('div', 'bt-box' + (o.wide ? ' bt-wide' : ''));
    var m = node('a', 'bt-map');
    m.href = 'map.html#' + encodeURIComponent(o.mapId);
    m.setAttribute('aria-label', 'Показати на мапі: ' + (o.title || o.label));
    m.title = 'На мапі';
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 18 18');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M9 16.5s5.5-5 5.5-9a5.5 5.5 0 0 0-11 0c0 4 5.5 9 5.5 9zM9 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z');
    s.appendChild(p);
    m.appendChild(s);
    box.appendChild(a);
    box.appendChild(m);
    return box;
  }

  function picture(n) {
    if (!n.image || PH.liteMode()) {
      var ph = node('span', 'bt-pic ph t-' + n.tint);
      ph.setAttribute('aria-hidden', 'true');
      return ph;
    }
    var img = node('img', 'bt-pic');
    img.src = n.image; img.alt = n.imageAlt; img.decoding = 'async';
    img.width = 600; img.height = 450;
    return img;
  }

  /* ---------- the status: a sentence, as before; a tile instead of the whole first screen ---------- */
  function statusTile(p, now) {
    var no = [], yes = [], stale = [], unknown = [];
    p.items.forEach(function (it) {
      if (it.stale) stale.push(it.key);
      else if (it.state === 'немає') no.push(it.key);
      else if (it.state === 'є') yes.push(it.key);
      else unknown.push(it.key);
    });
    var newest = Math.max.apply(null, p.items.map(function (it) { return it.ms || 0; }));
    var age = newest ? 'оновлено ' + PH.ageText(newest, now) : '';
    var parts = [];
    if (yes.length) parts.push(cap(list(yes.map(function (k) { return NOM[k]; }))) + ' є.');
    if (stale.length) parts.push(cap(list(stale.map(function (k) { return NOM[k]; }))) + ' — не підтверджено.');
    if (unknown.length) parts.push(cap(list(unknown.map(function (k) { return NOM[k]; }))) + ' — невідомо.');
    if (no.length) {
      var water = no.indexOf('water') >= 0 && p.points.length;
      return tile({ kind: 'alarm', wide: true, href: water ? 'status.html#h-water' : 'status.html',
        label: 'Стан' + (age ? ' · ' + age : ''), big: 'Немає ' + list(no.map(function (k) { return GEN[k]; })),
        text: parts.join(' '), meta: water ? 'Де взяти воду →' : 'Детальніше про стан →' });
    }
    return tile({ kind: 'status', href: 'status.html', label: 'Стан' + (age ? ' · ' + age : ''),
      title: stale.length || unknown.length ? 'Усе, що відомо, працює.' : 'Усе працює.',
      text: parts.filter(function (s) { return !/ є\.$/.test(s); }).join(' '), meta: 'Вода, світло, тепло, зв’язок →' });
  }

  function newsTile(n, wide) {
    return tile({ kind: 'news', wide: wide, href: 'news.html#' + n.id, label: 'Новина · ' + ddmm(n.day),
      pic: wide && n.image ? picture(n) : null,     // no empty colour field when a lead news has no picture
      picNote: wide && n.image && n.imageNote && !PH.liteMode() ? 'Фото: ' + n.imageNote : '', title: n.title, meta: wide ? 'Джерело: ' + n.source : '',
      mapId: n.spot ? n.id : '' });
  }
  function problemTile(p, wide) {
    return tile({ kind: 'problem', wide: wide, href: 'news.html#' + p.id, label: 'Проблема', state: p.state,
      stateCls: p.state === 'нова' ? 'bt-st-no' : '',
      title: p.title, text: wide ? p.text : '', meta: p.place, mapId: p.spot ? p.id : '' });
  }
  function initiativeTile(n, wide) {
    return tile({ kind: 'initiative', wide: wide, href: 'news.html#' + n.id, label: 'Ініціатива', title: n.title,
      text: wide ? n.text : '', meta: 'Як долучитися: ' + n.join, mark: wide, mapId: n.spot ? n.id : '' });
  }
  function gossipTile(g) {
    // the rule from CLAUDE.md: unverified is labelled as such, on the tile itself
    return tile({ kind: 'gossip', href: 'news.html#' + g.id,
      label: 'Плітка', state: g.state === 'кажуть' ? 'не перевірено' : g.state,
      stateCls: g.state === 'кажуть' ? 'bt-st-stale' : '',
      big: 'Кажуть…', text: g.text.replace(/^кажуть,?\s*(що\s*)?/i, '') });
  }
  function coffeeTile(E, now) {
    var c = E.coffee;
    if (!c || !c.occ) return null;
    return tile({ kind: 'coffee', href: 'events.html#' + c.id, label: 'Кава з сусідами',
      big: hhmm(c.occ.start), title: cap(PH.dayLabel(c.occ.start, now).split(',')[0]),
      meta: c.isPrivate ? 'адреса — учасникам' : c.place, mark: true, mapId: c.spot ? c.id : '' });
  }
  /* The owner's own photos of Pushcha (owner, 2026-11-20): two wide tiles, two different photos picked at random on
     every visit. Not a link: a photo is just a look at the place. The figcaption describes it, so the picture itself
     has an empty alt (no double reading). Skipped in the low-data mode; a photo that cannot load (offline, not yet
     cached) takes its tile away with it. */
  function pickPhotos(list, n) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.slice(0, n);
  }
  function photoTile(ph, lazy) {
    var f = node('figure', 'bt bt-wide bt-photo');
    var img = node('img', 'bt-photo-img');
    img.src = ph.file; img.alt = ''; img.width = ph.w; img.height = ph.h; img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    img.onerror = function () { if (f.parentNode) f.parentNode.removeChild(f); };
    f.appendChild(img);
    var caption = node('figcaption', 'bt-photo-cap');
    caption.appendChild(node('span', 'bt-kind', 'Фото Пущі' + (ph.month ? ' · ' + ph.month : '')));
    caption.appendChild(node('span', 'bt-text', ph.alt));
    f.appendChild(caption);
    return f;
  }
  function addTile(wide) {
    var a = tile({ kind: 'add', wide: wide, href: 'add.html', label: 'Розкажіть сусідам', big: '+',
      title: 'Новина, проблема, ініціатива чи плітка' });
    return a;
  }

  /* ---------- the board: a fixed rhythm of wide and small tiles; the grid fills gaps (dense) ---------- */
  function board(p, E, P, now, photos) {
    var box = $('bento');
    var pics = photos && photos.photos && !PH.liteMode() ? pickPhotos(photos.photos.filter(function (x) { return x.file && x.alt; }), 2) : [];
    box.textContent = '';
    var tiles = [];
    var alarm = p && p.items.some(function (it) { return !it.stale && it.state === 'немає'; });
    // the alarm sits above the title, on its own (owner, 2026-11-19)
    var alarmBox = $('alarm');
    alarmBox.textContent = '';
    if (alarm) alarmBox.appendChild(statusTile(p, now));
    alarmBox.hidden = !alarm;
    var gossip = P.gossip.filter(function (g) { return g.state !== 'не підтвердилось'; });
    var openProblems = P.problems.filter(function (x) { return x.state !== 'вирішено'; });
    if (P.news[0]) tiles.push(newsTile(P.news[0], true));
    if (openProblems[0]) tiles.push(problemTile(openProblems[0], false));
    if (gossip[0]) tiles.push(gossipTile(gossip[0]));
    if (P.initiatives[0]) tiles.push(initiativeTile(P.initiatives[0], true));
    if (P.news[1]) tiles.push(newsTile(P.news[1], false));
    if (openProblems[1]) tiles.push(problemTile(openProblems[1], false));
    if (pics[0]) tiles.push(photoTile(pics[0], false));
    // four news (owner, 2026-11-19: room for the ОСН, ГО and district reports among the openings)
    if (P.news[2]) tiles.push(newsTile(P.news[2], false));
    if (P.news[3]) tiles.push(newsTile(P.news[3], false));
    if (P.initiatives[1]) tiles.push(initiativeTile(P.initiatives[1], false));
    if (gossip[1]) tiles.push(gossipTile(gossip[1]));
    if (pics[1]) tiles.push(photoTile(pics[1], true));
    if (p && !alarm) tiles.push(statusTile(p, now));
    var coffee = E && coffeeTile(E, now);
    if (coffee) tiles.push(coffee);
    var small = tiles.filter(function (t) { return !t.classList.contains('bt-wide'); }).length;
    tiles.push(addTile(small % 2 === 0));          // fills the last gap, or the whole last row
    tiles.forEach(function (t) { box.appendChild(t); });
    if (!p && !P.ok) box.insertBefore(node('p', 'notice', 'Не вдалося завантажити дані. Спробуйте пізніше.'), box.firstChild);
    return { alarm: alarm, news: P.news.slice(0, 4), problems: openProblems.slice(0, 2), initiatives: P.initiatives.slice(0, 2), gossip: gossip.slice(0, 2) };
  }

  /* ---------- share: the board as plain text for a chat ---------- */
  function share(shown, p, sample, now) {
    $('share').onclick = function () {
      var lines = [];
      if (sample) lines.push(SAMPLE);
      lines.push('Що в Пущі, ' + ddmm(now) + ':');
      if (p && shown.alarm) {
        var no = p.items.filter(function (it) { return !it.stale && it.state === 'немає'; }).map(function (it) { return GEN[it.key]; });
        lines.push('— Немає ' + list(no) + '.');
      }
      shown.news.forEach(function (n) { lines.push('— Новина: ' + n.title); });
      shown.problems.forEach(function (x) { lines.push('— Проблема (' + x.state + '): ' + x.title); });
      shown.initiatives.forEach(function (n) { lines.push('— Ініціатива: ' + n.title + '. ' + n.join); });
      shown.gossip.forEach(function (g) { lines.push('— Кажуть, не перевірено: ' + g.text.replace(/^кажуть,?\s*(що\s*)?/i, '')); });
      lines.push(location.href.split('#')[0].replace(/index\.html$/, ''));
      var text = lines.join('\n');
      if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
      var fb = $('copy-feedback');
      var done = function () { fb.textContent = 'Скопійовано. Вставте в чат.'; };
      var fail = function () { var box = $('copy-box'); box.hidden = false; box.value = text; box.focus(); box.select(); fb.textContent = 'Виділіть текст і скопіюйте.'; };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fail); else fail();
    };
  }

  // «Пуща-Водиця» is fitted to the column by app.js (fitTitles), like every page title.
  function boot() {
    var now = Date.now();
    Promise.all([getJSON('data/status.json'), getJSON('data/events.json'), getJSON('data/posts.json'), getJSON('data/photos.json')]).then(function (r) {
      var p = r[0] ? PH.prepStatus(r[0], now) : null;
      var E = r[1] ? PH.prepEvents(r[1], now) : null;
      var P = PH.prepPosts(r[2], now);
      var shown = board(p, E, P, now, r[3]);
      share(shown, p, P.sample, now);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
