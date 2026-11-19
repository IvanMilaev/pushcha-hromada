/* Design lab: five presentations of the same news (A–E) and a low-data mode.
   Low data: no <img> is created at all — each picture becomes a colour field of its own tone,
   so nothing extra is downloaded. State lives in the URL hash: #a … #e, plus "-lite" (e.g. #c-lite). */
(function () {
  'use strict';
  var PH = window.PH;

  // Placeholder pictures for the sample news. In real data this would be an "image" + "tint" pair per post.
  var PIC = {
    'N-001': ['img/news/cafe.svg', 'sage'],
    'N-002': ['img/news/theatre.svg', 'coral'],
    'N-003': ['img/news/books.svg', 'marine'],
    'N-004': ['img/news/bakery.svg', 'sun'],
    'N-005': ['img/news/street-library.svg', 'ever'],
    'N-006': ['img/news/cleanup.svg', 'cream']
  };
  var VARIANTS = {
    a: ['A · Список з мініатюрою', 'Як зараз, але праворуч маленька картинка. Найспокійніший: читаєш заголовки, картинка лише підказує тему.'],
    b: ['B · Головна новина і список', 'Найсвіжіша новина — великою картинкою з першим реченням, решта — тихим списком без картинок. Є ієрархія: одне важливе, решта другорядне.'],
    c: ['C · Плитка', 'Дві колонки квадратних картинок з короткими підписами, як дошка в Pinterest. Багато новин видно одразу; найкраще, коли є справжні фото.'],
    d: ['D · Журнал, без картинок', 'Лише типографіка: велика дата, заголовок, перше речення. Найлегший, працює однаково при будь-якому зв’язку.'],
    e: ['E · Картки', 'Кожна новина — окрема картка з картинкою, заголовком і першим реченням. Звично з соцмереж, але найважчий і найщільніший.']
  };

  var MON = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];
  function $(id) { return document.getElementById(id); }
  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ddmm(ms) { var d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
  function first(text) { var m = text.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : text).trim(); }

  var state = { v: 'a', lite: false, news: [] };

  function pic(n, cls) {
    var p = PIC[n.id] || ['', 'ever'];
    if (state.lite || !p[0]) return node('span', 'pic ph t-' + p[1] + (cls ? ' ' + cls : ''));
    var img = node('img', 'pic' + (cls ? ' ' + cls : ''));
    img.src = p[0]; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.width = 600; img.height = 450;
    return img;
  }
  function link(n, cls) { var a = node('a', cls); a.href = 'news.html#' + n.id; return a; }

  var render = {
    // A: label + title on the left, a small square picture on the right; hairlines between.
    a: function (box) {
      var ul = node('ul', 'list va');
      state.news.forEach(function (n) {
        var a = link(n, 'va-row');
        add(a, add(node('span', 'va-text'), node('span', 'micro', ddmm(n.day)), node('span', 'item-title', n.title)), pic(n, 'va-pic'));
        ul.appendChild(add(node('li'), a));
      });
      box.appendChild(ul);
    },
    // B: one lead story with a wide picture and its first sentence; the rest as a quiet text list.
    b: function (box) {
      var lead = state.news[0];
      var a = link(lead, 'vb-lead');
      add(a, pic(lead, 'vb-pic'), node('span', 'micro', ddmm(lead.day) + ' · ' + lead.source),
        node('span', 'vb-title', lead.title), node('span', 'vb-ex', first(lead.text)));
      box.appendChild(a);
      var ul = node('ul', 'list vb-rest');
      state.news.slice(1).forEach(function (n) {
        ul.appendChild(add(node('li'), add(link(n, 'row'), node('span', 'micro', ddmm(n.day)), node('span', 'item-title', n.title))));
      });
      box.appendChild(ul);
    },
    // C: two-column tiles — square picture, small date, title; no card fill, space does the separating.
    c: function (box) {
      var g = node('div', 'vc-grid');
      state.news.forEach(function (n) {
        g.appendChild(add(link(n, 'vc-tile'), pic(n, 'vc-pic'), node('span', 'micro', ddmm(n.day)), node('span', 'vc-title', n.title)));
      });
      box.appendChild(g);
    },
    // D: typographic journal — a big day number is the only large thing per item; no pictures at all.
    d: function (box) {
      var ul = node('ul', 'vd');
      state.news.forEach(function (n) {
        var d = new Date(n.day);
        var a = link(n, 'vd-row');
        add(a, add(node('span', 'vd-date'), node('span', 'vd-day', String(d.getDate())), node('span', 'micro', MON[d.getMonth()])),
          add(node('span', 'vd-text'), node('span', 'vd-title', n.title), node('span', 'vd-ex', first(n.text)), node('span', 'micro', n.source)));
        ul.appendChild(add(node('li'), a));
      });
      box.appendChild(ul);
    },
    // E: classic cards on the Evergreen surface — picture, label, title, first sentence.
    e: function (box) {
      var g = node('div', 've-cards');
      state.news.forEach(function (n) {
        g.appendChild(add(link(n, 've-card'), pic(n, 've-pic'),
          add(node('span', 've-body'), node('span', 'micro', ddmm(n.day) + ' · ' + n.source), node('span', 've-title', n.title), node('span', 've-ex', first(n.text))))
        );
      });
      box.appendChild(g);
    }
  };

  function draw() {
    var box = $('variant');
    box.textContent = '';
    box.className = 'v-' + state.v;
    $('v-name').textContent = VARIANTS[state.v][0] + (state.lite ? ' · слабкий зв’язок' : '');
    $('v-why').textContent = VARIANTS[state.v][1];
    Array.prototype.forEach.call(document.querySelectorAll('.lab-switch button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-v') === state.v ? 'true' : 'false');
    });
    $('lite').setAttribute('aria-pressed', state.lite ? 'true' : 'false');
    if (state.news.length) render[state.v](box);
  }
  function fromHash() {
    var h = location.hash.slice(1).split('-');
    state.v = VARIANTS[h[0]] ? h[0] : 'a';
    state.lite = h[1] === 'lite';
  }
  function toHash() { history.replaceState(null, '', '#' + state.v + (state.lite ? '-lite' : '')); draw(); }

  function boot() {
    fromHash();
    Array.prototype.forEach.call(document.querySelectorAll('.lab-switch button'), function (b) {
      b.addEventListener('click', function () { state.v = b.getAttribute('data-v'); toHash(); });
    });
    $('lite').addEventListener('click', function () { state.lite = !state.lite; toHash(); });
    window.addEventListener('hashchange', function () { fromHash(); draw(); });
    draw();
    fetch('data/posts.json').then(function (r) { return r.json(); }).then(function (raw) {
      state.news = PH.prepPosts(raw, Date.now()).news;
      draw();
    }, function () { $('variant').textContent = 'Не вдалося завантажити новини.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
