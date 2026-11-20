/* Pushcha hromada prototype — shared logic and page renderers.
   Classic script (no modules) so it runs on old Android browsers.
   Pure functions are exposed on window.PH and tested by tools/test-logic.mjs. */
(function (root) {
  'use strict';

  var STATES = ['є', 'немає', 'невідомо'];
  var ITEMS = [
    ['water', 'Вода'],
    ['power', 'Світло'],
    ['heating', 'Опалення'],
    ['connectivity', 'Зв’язок']
  ];
  var SYMBOL = { 'є': '✓', 'немає': '✕', 'невідомо': '?' };
  var STATE_CLASS = { 'є': 'st-yes', 'немає': 'st-no', 'невідомо': 'st-unknown' };
  var MIN = 60000;
  var HOUR = 60 * MIN;
  var DAY = 24 * HOUR;
  var SAMPLE_NEWEST_AGE = 10 * MIN; // sample mode: newest item looks 10 min old
  var CLOCK_SKEW = 5 * MIN;         // tolerate small clock differences

  /* ---------------- pure logic ---------------- */

  function normState(s) {
    s = typeof s === 'string' ? s.trim().toLowerCase() : '';
    return STATES.indexOf(s) >= 0 ? s : 'невідомо';
  }

  function parseTime(s) {
    if (typeof s !== 'string' || !s) return null;
    var ms = Date.parse(s);
    return isNaN(ms) ? null : ms;
  }

  function ageText(ms, now) {
    if (ms == null) return 'час невідомий';
    var d = now - ms;
    if (d < -CLOCK_SKEW) return 'час у майбутньому';
    if (d < MIN) return 'щойно';
    if (d < HOUR) return Math.floor(d / MIN) + ' хв тому';
    if (d < DAY) return Math.floor(d / HOUR) + ' год тому';
    return Math.floor(d / DAY) + ' дн тому';
  }

  function isStale(ms, now, hours) {
    if (ms == null) return true;
    if (ms - now > CLOCK_SKEW) return true; // future time = typo, not "just now"
    return now - ms > hours * HOUR;
  }

  /* Sample mode only: shift every time so the newest one is 10 minutes ago.
     Gaps between items are kept, so a deliberately old item stays stale. */
  function computeShift(raw, now) {
    if (!raw || raw.sample !== true || raw.sample_time_shift !== true) return 0;
    var times = [];
    var items = raw.items || {};
    ITEMS.forEach(function (it) { if (items[it[0]]) times.push(parseTime(items[it[0]].updated_at)); });
    if (raw.event) times.push(parseTime(raw.event.updated_at));
    (raw.water_points || []).forEach(function (p) { times.push(parseTime(p && p.updated_at)); });
    times = times.filter(function (t) { return t != null; });
    if (!times.length) return 0;
    return (now - SAMPLE_NEWEST_AGE) - Math.max.apply(null, times);
  }

  function str(v, fallback) {
    return typeof v === 'string' && v.trim() ? v.trim() : fallback;
  }

  /* Turn raw status.json (or null if broken) into what the page shows. */
  function prepStatus(raw, now) {
    var ok = !!(raw && typeof raw === 'object' && raw.items && typeof raw.items === 'object');
    var shift = ok ? computeShift(raw, now) : 0;
    var hours = ok && typeof raw.stale_after_hours === 'number' && raw.stale_after_hours > 0 ? raw.stale_after_hours : 6;
    function t(s) { var ms = parseTime(s); return ms == null ? null : ms + shift; }

    var items = ITEMS.map(function (it) {
      var src = ok && raw.items[it[0]] ? raw.items[it[0]] : {};
      var ms = t(src.updated_at);
      return {
        key: it[0],
        label: it[1],
        state: normState(src.state),
        ms: ms,
        stale: isStale(ms, now, hours),
        source: str(src.verified_by, 'джерело не вказано'),
        note: str(src.note, '')
      };
    });

    var event = null;
    if (ok && raw.event && str(raw.event.title, '')) {
      var ems = t(raw.event.updated_at);
      event = {
        title: str(raw.event.title, ''),
        text: str(raw.event.text, ''),
        ms: ems,
        stale: isStale(ems, now, hours),
        source: str(raw.event.verified_by, 'джерело не вказано')
      };
    }

    var points = (ok && Array.isArray(raw.water_points) ? raw.water_points : [])
      .filter(function (p) { return p && str(p.name, ''); })
      .map(function (p) {
        var pms = t(p.updated_at);
        return {
          name: str(p.name, ''),
          place: str(p.place, ''),
          hours: str(p.hours, ''),
          offers: Array.isArray(p.offers) ? p.offers.filter(function (o) { return typeof o === 'string'; }) : [],
          ms: pms,
          stale: isStale(pms, now, hours),
          source: str(p.verified_by, 'джерело не вказано')
        };
      });

    return { ok: ok, sample: !ok || raw.sample === true, staleHours: hours, items: items, event: event, points: points };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
  function fmtClock(ms) { var d = new Date(ms); return fmtDate(d) + ' о ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function itemLine(it, now) {
    if (it.stale) {
      return it.label + ': не підтверджено' + (it.ms != null ? ', востаннє «' + it.state + '» ' + ageText(it.ms, now) : '');
    }
    return it.label + ': ' + it.state + ' (оновлено ' + ageText(it.ms, now) + ', ' + it.source + ')';
  }

  /* Plain text for Viber/Telegram — see specs/001-mvp-prototype/contracts/share-text.md */
  function shareText(p, now, url) {
    var lines = [];
    if (p.sample) lines.push('ТЕСТОВІ ДАНІ (не справжній стан)');
    lines.push('Пуща-Водиця зараз, ' + fmtClock(now));
    p.items.forEach(function (it) { lines.push(itemLine(it, now)); });
    if (p.event) {
      lines.push('Подія: ' + p.event.title + (p.event.text ? '. ' + p.event.text : '') + (p.event.stale ? ' (не підтверджено)' : ''));
    }
    if (p.points.length) {
      lines.push('Де взяти воду:');
      p.points.forEach(function (w) {
        lines.push('- ' + [w.name, w.place, w.hours].filter(Boolean).join(', ') + (w.stale ? ' (не підтверджено)' : ''));
      });
    }
    if (url) lines.push('Детальніше: ' + url);
    return lines.join('\n');
  }

  /* Help board: dates are YYYY-MM-DD, local days. */
  function parseDay(s) {
    var m = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  }

  function startOfDay(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  function prepHelp(raw, now) {
    var ok = !!(raw && Array.isArray(raw.entries));
    var expire = ok && typeof raw.expire_after_days === 'number' ? raw.expire_after_days : 14;
    var today = startOfDay(now);
    var entries = ok ? raw.entries.filter(function (e) {
      return e && (e.type === 'need' || e.type === 'offer') && str(e.text, '') && parseDay(e.date) != null;
    }) : [];
    var shiftDays = 0;
    if (ok && raw.sample === true && raw.sample_time_shift === true && entries.length) {
      var newest = Math.max.apply(null, entries.map(function (e) { return parseDay(e.date); }));
      shiftDays = Math.round((today - newest) / DAY);
    }
    var list = entries.map(function (e) {
      var d = new Date(parseDay(e.date));
      d.setDate(d.getDate() + shiftDays);
      return {
        type: e.type,
        category: str(e.category, 'інше'),
        text: str(e.text, ''),
        district: str(e.district, 'район не вказано'),
        day: d.getTime()
      };
    }).filter(function (e) {
      return Math.round((today - e.day) / DAY) <= expire;
    }).sort(function (a, b) { return b.day - a.day; });

    return {
      ok: ok,
      sample: !ok || raw.sample === true,
      moderator: ok ? str(raw.moderator_telegram, '').replace(/^@/, '') : '',
      need: list.filter(function (e) { return e.type === 'need'; }),
      offer: list.filter(function (e) { return e.type === 'offer'; })
    };
  }

  var TEMPLATE = [
    'Привіт! Хочу додати оголошення на сайт «Пуща-громада».',
    'Тип: потрібна допомога / можу допомогти',
    'Категорія: генератор / Starlink / транспорт / медична допомога / допомога літнім / вода / інше',
    'Коротко: ',
    'Район або орієнтир (без адреси): ',
    'Як зі мною зв’язатися: тут, у Telegram'
  ].join('\n');

  function telegramLink(moderator, text, siteUrl) {
    if (moderator && /^[A-Za-z0-9_]{4,32}$/.test(moderator)) {
      return 'https://t.me/' + moderator + '?text=' + encodeURIComponent(text);
    }
    return 'https://t.me/share/url?url=' + encodeURIComponent(siteUrl) + '&text=' + encodeURIComponent(text);
  }

  /* ---------------- v2: dates, events, posts (pure) ---------------- */

  var WD_FULL = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'п\u2019ятниця', 'субота'];
  var WD_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MONTH_SHORT = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];
  // "every <weekday>" by ISO weekday 1..7
  var WD_EVERY = ['', 'щопонеділка', 'щовівторка', 'щосереди', 'щочетверга', 'щоп\u2019ятниці', 'щосуботи', 'щонеділі'];
  var WD_ON = ['', 'у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у п\u2019ятницю', 'у суботу', 'у неділю'];
  var ICS_DAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  var EVENT_KINDS = ['кава', 'толока', 'кіно', 'театр', 'вечірка', 'клуб', 'інше'];
  var GOSSIP_STATES = ['кажуть', 'підтвердилось', 'не підтвердилось'];
  var PROBLEM_STATES = ['нова', 'у роботі', 'вирішено'];
  var SOLVED_DAYS = 14;     // a solved problem stays visible this long, so neighbours see it was fixed
  // News pictures: a local file, and a tone shown instead of it on a weak connection.
  var IMAGE_PATH = /^img\/[a-z0-9_\/-]+\.(svg|jpg|jpeg|png|webp)$/;
  var TINTS = ['sage', 'coral', 'marine', 'sun', 'ever', 'cream'];
  var ALARM_RULE = 'Під час повітряної тривоги — до укриття. Подія на паузі до відбою.';

  function parseLocal(s) {
    var m = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  }

  // Calendar-day arithmetic in local time (safe across daylight-saving changes).
  function addDays(ms, n) { var d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
  function isoDay(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function isoWeekday(ms) { return new Date(ms).getDay() || 7; }
  function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }

  function dayLabel(ms, now) {
    var diff = daysBetween(now, ms);
    if (diff === 0) return 'сьогодні';
    if (diff === 1) return 'завтра';
    if (diff === -1) return 'вчора';
    return WD_FULL[new Date(ms).getDay()] + ', ' + fmtDate(new Date(ms));
  }

  function whenText(start, end, now) {
    if (daysBetween(start, end) === 0) return dayLabel(start, now) + ', ' + hhmm(start) + '–' + hhmm(end);
    return dayLabel(start, now) + ', ' + hhmm(start) + ' — ' + dayLabel(end, now) + ', ' + hhmm(end);
  }

  // Sample data only: whole-day shift so the demo stays current (research R4).
  function dayShift(raw, now) {
    if (!raw || raw.sample !== true || raw.sample_shift_days !== true) return 0;
    var a = parseDay(raw.anchor);
    return a == null ? 0 : daysBetween(a, now);
  }

  function repeatLabel(rep) {
    if (!rep) return '';
    var days = rep.weekly;
    if (rep.every > 1) return 'раз на ' + rep.every + ' тижні, ' + days.map(function (d) { return WD_ON[d]; }).join(', ');
    return days.map(function (d) { return WD_EVERY[d]; }).join(', ');
  }

  // Next occurrence of an event that has not ended yet. For one-off events it is the event itself.
  function nextOccurrence(ev, now) {
    if (!ev.repeat) return { start: ev.start, end: ev.end, skipped: null };
    var dur = ev.end - ev.start;
    var rep = ev.repeat;
    var firstDay = startOfDay(ev.start);
    var firstWeek = addDays(firstDay, 1 - isoWeekday(firstDay));
    var t = new Date(ev.start);
    var from = Math.max(firstDay, startOfDay(now));
    var skipped = null;
    for (var i = 0; i <= 56; i++) {
      var day = addDays(from, i);
      if (rep.until != null && day > rep.until) break;
      if (rep.weekly.indexOf(isoWeekday(day)) < 0) continue;
      var weekNo = Math.round(daysBetween(firstWeek, addDays(day, 1 - isoWeekday(day))) / 7);
      if (weekNo % rep.every !== 0) continue;
      var d = new Date(day);
      d.setHours(t.getHours(), t.getMinutes(), 0, 0);
      var s = d.getTime();
      if (s + dur < now) continue;
      if (ev.cancelled.indexOf(isoDay(day)) >= 0) { if (skipped == null) skipped = s; continue; }
      return { start: s, end: s + dur, skipped: skipped };
    }
    return null;
  }

  function prepEvents(raw, now) {
    var ok = !!(raw && Array.isArray(raw.events));
    var shift = ok ? dayShift(raw, now) : 0;
    var pastDays = ok && typeof raw.past_days === 'number' ? raw.past_days : 30;
    var today = startOfDay(now);
    var weekEnd = addDays(today, 8 - isoWeekday(today)); // start of next Monday
    var groups = { today: [], week: [], later: [], past: [] };
    var all = [];
    var incomplete = 0;
    (ok ? raw.events : []).forEach(function (e) {
      var start = e ? parseLocal(e.starts) : null;
      if (!e || !str(e.id, '') || !str(e.title, '') || start == null) { incomplete++; return; }
      var rep = null;
      if (e.repeat && typeof e.repeat === 'object') {
        var days = (Array.isArray(e.repeat.weekly) ? e.repeat.weekly : []).filter(function (d) { return d >= 1 && d <= 7; });
        rep = { weekly: days.length ? days : [isoWeekday(start)], every: e.repeat.every >= 1 ? Math.floor(e.repeat.every) : 1, until: null };
      }
      var sh = rep ? 7 * Math.floor(shift / 7) : shift; // keep weekdays for recurring events
      start = addDays(start, sh);
      var end = parseLocal(e.ends);
      end = end == null ? start + 2 * HOUR : addDays(end, sh);
      if (end <= start) end = start + 2 * HOUR;
      if (rep && parseDay(e.repeat.until) != null) rep.until = addDays(parseDay(e.repeat.until), sh);
      var ev = {
        id: e.id.trim(),
        kind: EVENT_KINDS.indexOf(e.kind) >= 0 ? e.kind : 'інше',
        title: e.title.trim(),
        text: str(e.text, ''),
        start: start,
        end: end,
        repeat: rep,
        cancelled: (Array.isArray(e.cancelled) ? e.cancelled : [])
          .map(parseDay).filter(function (d) { return d != null; })
          .map(function (d) { return isoDay(addDays(d, sh)); }),
        isPrivate: e.place_private === true,
        place: e.place_private === true ? '' : str(e.place, ''),
        spot: e.place_private === true ? '' : str(e.spot, ''),   // a landmark id in places.json; never for a private place
        organiser: str(e.organiser, ''),
        org: str(e.org, ''),
        bring: (Array.isArray(e.bring) ? e.bring : []).filter(function (b) { return typeof b === 'string' && b.trim(); }),
        alarm: str(e.alarm, ''),
        contact: str(e.contact, '')
      };
      ev.occ = nextOccurrence(ev, now);
      all.push(ev);
      if (!ev.occ) return; // recurring with nothing in the next 8 weeks: paused
      if (ev.occ.end < now) {
        if (now - ev.occ.end <= pastDays * DAY) groups.past.push(ev);
      } else if (ev.occ.start < addDays(today, 1)) {
        groups.today.push(ev);
      } else if (ev.occ.start < weekEnd) {
        groups.week.push(ev);
      } else {
        groups.later.push(ev);
      }
    });
    function asc(a, b) { return a.occ.start - b.occ.start || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0); }
    groups.today.sort(asc); groups.week.sort(asc); groups.later.sort(asc);
    groups.past.sort(function (a, b) { return b.occ.start - a.occ.start; });
    var coffee = all.filter(function (ev) { return ev.kind === 'кава' && ev.repeat; })
      .sort(function (a, b) { return (a.occ ? a.occ.start : Infinity) - (b.occ ? b.occ.start : Infinity); })[0] || null;
    return { ok: ok, sample: !ok || raw.sample === true, groups: groups, all: all, coffee: coffee, incomplete: incomplete };
  }

  function prepPosts(raw, now) {
    var ok = !!(raw && Array.isArray(raw.posts));
    var shift = ok ? dayShift(raw, now) : 0;
    var gossipDays = ok && typeof raw.gossip_days === 'number' ? raw.gossip_days : 7;
    var news = [], gossip = [], problems = [], initiatives = [], incomplete = 0;
    (ok ? raw.posts : []).forEach(function (p) {
      var day = p ? parseDay(p.date) : null;
      if (!p || !str(p.id, '') || !str(p.text, '') || day == null) { incomplete++; return; }
      day = addDays(day, shift);
      if (p.kind === 'news') {
        if (!str(p.title, '') || !str(p.source, '') || !str(p.verified_by, '')) { incomplete++; return; }
        // A picture is optional; only a local file under img/ is accepted, never another site.
        var image = IMAGE_PATH.test(str(p.image, '')) ? p.image.trim() : '';
        news.push({ id: p.id.trim(), title: p.title.trim(), text: p.text.trim(), day: day,
          source: p.source.trim(), verifiedBy: p.verified_by.trim(), event: str(p.event, ''), org: str(p.org, ''),
          image: image, imageAlt: image ? str(p.image_alt, '') : '',
          imageNote: image ? str(p.image_note, '') : '',   // e.g. "згенероване зображення": shown next to the picture
          spot: str(p.spot, ''),
          tint: TINTS.indexOf(p.tint) >= 0 ? p.tint : 'ever' });
      } else if (p.kind === 'gossip') {
        var age = daysBetween(day, now);
        if (age > gossipDays) return; // expired
        var text = p.text.trim();
        if (!/^кажуть/i.test(text)) text = 'Кажуть, що ' + text.charAt(0).toLowerCase() + text.slice(1);
        gossip.push({ id: p.id.trim(), text: text, day: Math.min(day, startOfDay(now)),
          state: GOSSIP_STATES.indexOf(p.state) >= 0 ? p.state : 'кажуть', confirmedBy: str(p.confirmed_by, '') });
      } else if (p.kind === 'problem') {
        // A problem is a fact about the area, so it needs a source and who checked it, like news.
        if (!str(p.title, '') || !str(p.source, '') || !str(p.verified_by, '')) { incomplete++; return; }
        var pstate = PROBLEM_STATES.indexOf(p.state) >= 0 ? p.state : 'нова';
        if (pstate === 'вирішено' && daysBetween(day, now) > SOLVED_DAYS) return; // solved long ago: off the page
        problems.push({ id: p.id.trim(), title: p.title.trim(), text: p.text.trim(), day: day, place: str(p.place, ''),
          spot: str(p.spot, ''), state: pstate, source: p.source.trim(), verifiedBy: p.verified_by.trim() });
      } else if (p.kind === 'initiative') {
        if (!str(p.title, '') || !str(p.who, '') || !str(p.join, '')) { incomplete++; return; }
        initiatives.push({ id: p.id.trim(), title: p.title.trim(), text: p.text.trim(), day: day, who: p.who.trim(),
          join: p.join.trim(), event: str(p.event, ''), org: str(p.org, ''), spot: str(p.spot, '') });
      } else {
        incomplete++;
      }
    });
    function newest(a, b) { return b.day - a.day || (a.id < b.id ? 1 : -1); }
    // open problems first (newest first), solved ones after them
    function problemOrder(a, b) { return (a.state === 'вирішено') - (b.state === 'вирішено') || newest(a, b); }
    news.sort(newest); gossip.sort(newest); problems.sort(problemOrder); initiatives.sort(newest);
    return { ok: ok, sample: !ok || raw.sample === true, news: news, gossip: gossip, problems: problems,
      initiatives: initiatives, incomplete: incomplete };
  }

  function gossipTag(state) { return state === 'кажуть' ? 'кажуть, не перевірено' : state; }

  /* Calendar file (RFC 5545). Times are local with TZID=Europe/Kyiv; the device is assumed to be in Kyiv. */
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    var out = [], cur = '', bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      var code = line.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF) { c += line.charAt(++i); }
      var b = code < 0x80 ? 1 : code < 0x800 ? 2 : code >= 0xD800 && code <= 0xDBFF ? 4 : 3;
      if (bytes + b > 75) { out.push(cur); cur = ' ' + c; bytes = 1 + b; } else { cur += c; bytes += b; }
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function icsLocal(ms) { var d = new Date(ms); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'; }
  function icsUtc(ms) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

  function icsText(ev, occ, url, now) {
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pushcha hromada//prototype//UK', 'CALSCALE:GREGORIAN',
      // Calendar apps use their own time-zone database for Europe/Kyiv; this block is required by RFC 5545.
      'BEGIN:VTIMEZONE', 'TZID:Europe/Kyiv',
      'BEGIN:STANDARD', 'DTSTART:19701025T040000', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:19700329T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'UID:' + ev.id + '@pushcha-hromada.example',
      'DTSTAMP:' + icsUtc(now),
      'DTSTART;TZID=Europe/Kyiv:' + icsLocal(occ.start),
      'DTEND;TZID=Europe/Kyiv:' + icsLocal(occ.end)
    ];
    if (ev.repeat) {
      var rule = 'RRULE:FREQ=WEEKLY';
      if (ev.repeat.every > 1) rule += ';INTERVAL=' + ev.repeat.every;
      rule += ';BYDAY=' + ev.repeat.weekly.map(function (d) { return ICS_DAY[d]; }).join(',');
      if (ev.repeat.until != null) rule += ';UNTIL=' + icsUtc(addDays(ev.repeat.until, 1) - 1000);
      lines.push(rule);
      var t = new Date(occ.start);
      var ex = ev.cancelled.map(parseDay).filter(function (d) { return d != null && d >= startOfDay(occ.start); })
        .map(function (d) { var x = new Date(d); x.setHours(t.getHours(), t.getMinutes(), 0, 0); return icsLocal(x.getTime()); });
      if (ex.length) lines.push('EXDATE;TZID=Europe/Kyiv:' + ex.join(','));
    }
    lines.push('SUMMARY:' + icsEscape(ev.title));
    lines.push('LOCATION:' + icsEscape(ev.isPrivate ? 'адреса — учасникам' : ev.place));
    lines.push('DESCRIPTION:' + icsEscape([ev.text, ALARM_RULE, url].filter(Boolean).join('\n')));
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }

  var SAMPLE_LINE = 'ТЕСТОВІ ДАНІ';   // a shared text leaves the site and its banner, so it keeps its own mark

  function eventShareText(ev, now, url, orgName, sample) {
    var occ = ev.occ || { start: ev.start, end: ev.end };
    var lines = [];
    if (sample) lines.push(SAMPLE_LINE);
    lines.push(ev.title + ' — ' + whenText(occ.start, occ.end, now) + (ev.repeat ? ' (' + repeatLabel(ev.repeat) + ')' : ''));
    lines.push('Де: ' + (ev.isPrivate ? 'адреса — учасникам, напишіть організатору' : ev.place || 'уточнюється'));
    var who = [ev.organiser, orgName].filter(Boolean).join(', ');
    if (who) lines.push('Хто: ' + who);
    if (ev.bring.length) lines.push('Взяти: ' + ev.bring.join(', '));
    lines.push('Під час тривоги — до укриття, подія на паузі.');
    if (url) lines.push('Детальніше: ' + url);
    return lines.join('\n');
  }

  function postShareText(p, url, sample) {
    var lines = [];
    if (sample) lines.push(SAMPLE_LINE);
    if (p.join) {                                   // an initiative
      lines.push('Ініціатива: ' + p.title + ' — ' + fmtDate(new Date(p.day)));
      lines.push(p.text);
      lines.push('Хто: ' + p.who + '. Як долучитися: ' + p.join);
    } else if (p.verifiedBy && p.state) {           // a problem
      lines.push('Проблема (' + p.state + '): ' + p.title + ' — ' + fmtDate(new Date(p.day)));
      lines.push(p.text);
      if (p.place) lines.push('Де: ' + p.place);
      lines.push('Джерело: ' + p.source + '. Перевірив: ' + p.verifiedBy);
    } else if (p.state) {
      lines.push(capital(gossipTag(p.state)) + ' (' + fmtDate(new Date(p.day)) + '): ' + p.text.replace(/^кажуть,?\s*(що\s*)?/i, ''));
    } else {
      lines.push(p.title + ' — ' + fmtDate(new Date(p.day)));
      lines.push(p.text);
      lines.push('Джерело: ' + p.source + '. Перевірив: ' + p.verifiedBy);
    }
    if (url) lines.push(url);
    return lines.join('\n');
  }

  /* ---------------- browser helpers ---------------- */

  function el(tag, cls, children) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    (children || []).forEach(function (c) {
      if (c == null || c === '') return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function $(id) { return document.getElementById(id); }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var fromCache = r.headers.get('X-PH-From-Cache') === '1';
      return r.json().then(function (data) { return { data: data, fromCache: fromCache }; });
    });
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* Copy text; if the browser refuses, show it in a box to copy by hand. */
  function copyText(text, feedback, box, onDone) {
    function done(ok) {
      if (onDone) onDone(ok);
      if (ok) {
        if (box) box.hidden = true;
        feedback.textContent = 'Скопійовано. Вставте в чат.';
      } else {
        feedback.textContent = 'Не вийшло скопіювати автоматично. Виділіть текст нижче й скопіюйте.';
        if (box) { box.hidden = false; box.value = text; box.focus(); box.select(); }
      }
    }
    if (navigator.clipboard && root.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacyCopy(text)); });
    } else {
      done(legacyCopy(text));
    }
  }

  function pageUrl() { return String(location.href).split('#')[0]; }

  function storeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  /* ---------------- page: home ---------------- */

  function renderHome() {
    var state = { raw: null, fromCache: false, failed: false };

    function draw() {
      var now = Date.now();
      var p = prepStatus(state.failed ? null : state.raw, now);
      state.prepared = p;

      var tiles = $('tiles');
      clear(tiles);
      p.items.forEach(function (it) {
        var word = it.stale ? 'не підтверджено' : it.state;
        var sym = it.stale ? '?' : SYMBOL[it.state];
        var meta = it.stale
          ? (it.ms != null ? 'востаннє: «' + it.state + '», ' + ageText(it.ms, now) : 'час оновлення невідомий')
          : 'оновлено ' + ageText(it.ms, now);
        var symEl = el('span', '', [sym + ' ']);
        symEl.setAttribute('aria-hidden', 'true');
        tiles.appendChild(el('li', 'tile ' + (it.stale ? 'st-stale' : STATE_CLASS[it.state]), [
          el('span', 'tile-name', [it.label]),
          el('span', 'tile-state', [symEl, word]),
          el('span', 'tile-meta', [meta]),
          el('span', 'tile-meta', ['джерело: ' + it.source]),
          it.note ? el('span', 'tile-note', [it.note]) : null
        ]));
      });

      var ev = $('event');
      clear(ev);
      if (p.event) {
        ev.appendChild(el('h3', '', [p.event.title]));
        if (p.event.text) ev.appendChild(el('p', '', [p.event.text]));
        ev.appendChild(el('p', 'card-meta', [
          (p.event.stale ? 'не підтверджено · востаннє ' : 'оновлено ') + ageText(p.event.ms, now) + ' · джерело: ' + p.event.source
        ]));
      } else {
        ev.appendChild(el('p', 'muted', ['Зараз особливих подій немає.']));
      }

      var wl = $('water-list');
      clear(wl);
      $('water-empty').hidden = p.points.length > 0;
      p.points.forEach(function (w) {
        wl.appendChild(el('li', '', [
          el('h3', '', [w.name]),
          el('p', '', [[w.place, w.hours].filter(Boolean).join(' · ')]),
          w.offers.length ? el('p', 'small', ['Є: ' + w.offers.join(', ')]) : null,
          el('p', 'card-meta', [(w.stale ? 'не підтверджено · востаннє ' : 'оновлено ') + ageText(w.ms, now) + ' · джерело: ' + w.source])
        ]));
      });

      var notice = $('status-notice');
      var meta = $('status-meta');
      var last = storeGet('ph-status-fetched');
      if (state.failed) {
        notice.hidden = false;
        notice.textContent = 'Не вдалося прочитати стан. Показуємо «невідомо». Спробуйте оновити сторінку пізніше.';
      } else if (state.fromCache || navigator.onLine === false) {
        notice.hidden = false;
        notice.textContent = 'Немає зв’язку — показано останні збережені дані.';
      } else {
        notice.hidden = true;
      }
      meta.textContent = last ? 'Дані отримано ' + fmtClock(+last) + '.' : '';
    }

    function load() {
      return fetchJSON('data/status.json').then(function (res) {
        state.raw = res.data;
        state.fromCache = res.fromCache;
        state.failed = false;
        if (!res.fromCache) storeSet('ph-status-fetched', String(Date.now()));
      }, function () {
        state.failed = !state.raw;
        state.fromCache = !!state.raw;
      }).then(draw);
    }

    load();
    setInterval(draw, 60000);
    root.addEventListener('online', load);
    root.addEventListener('offline', draw);

    $('copy-btn').addEventListener('click', function () {
      var p = state.prepared || prepStatus(null, Date.now());
      copyText(shareText(p, Date.now(), pageUrl()), $('copy-feedback'), $('copy-box'));
    });
  }

  /* ---------------- page: help board ---------------- */

  function renderHelp() {
    function fill(listId, items, emptyText) {
      var ul = $(listId);
      clear(ul);
      if (!items.length) { ul.appendChild(el('li', 'muted', [emptyText])); return; }
      items.forEach(function (e) {
        // Short entries stay open: the same label + text pair as news and events, nothing more.
        ul.appendChild(el('li', 'item item-flat', [
          el('span', 'micro', [e.category + ' · ' + fmtDate(new Date(e.day))]),
          el('p', 'item-title', [e.text]),
          el('p', 'card-meta', [e.district])
        ]));
      });
    }
    fetchJSON('data/help.json').then(function (res) {
      var h = prepHelp(res.data, Date.now());
      fill('need-list', h.need, 'Поки немає оголошень.');
      fill('offer-list', h.offer, 'Поки немає оголошень.');
    }, function () {
      fill('need-list', [], 'Не вдалося завантажити оголошення.');
      fill('offer-list', [], 'Не вдалося завантажити оголошення.');
    }).then(function () {
      var target = location.hash && document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    });
  }

  /* ---------------- page: add ---------------- */

  var TEMPLATES = {
    help: {
      title: 'Прохання або пропозиція допомоги',
      rules: 'Без точних адрес, документів і діагнозів. Модератор з’єднає вас напряму.',
      text: TEMPLATE
    },
    news: {
      title: 'Новина',
      rules: 'Будь-що про Пущу-Водицю: відкриття, вистава, новий клуб. Обов’язково — звідки відомо. Без реклами, цін і знижок.',
      text: ['Привіт! Хочу додати новину на сайт «Пуща-громада».', 'Що сталося: ', 'Де (орієнтир, без адреси): ', 'Коли: ',
        'Звідки відомо (джерело): ', 'Як зі мною зв’язатися: тут, у Telegram'].join('\n')
    },
    gossip: {
      title: 'Плітка',
      rules: 'Лише добрі чутки про місця, події й відкриття. Ніколи — про конкретних людей, війну, здоров’я чи небезпеку. ' +
        'Про небезпеку пишіть модератору як про сигнал, не як плітку. Плітка буде позначена «кажуть, не перевірено» і зникне через 7 днів.',
      text: ['Привіт! Кажуть, що… ', 'Де чули (орієнтир): '].join('\n')
    },
    problem: {
      title: 'Проблема',
      rules: 'Що зламалося чи заважає: сміття, яма, забруднений ставок. Місце — орієнтир, без адреси. ' +
        'Не пишіть, яка лінія, підстанція чи труба пошкоджена, і нічого про обстріли. Про небезпеку для людей — одразу в екстрені служби.',
      text: ['Привіт! Хочу повідомити про проблему в Пущі.', 'Що не так: ', 'Де (орієнтир, без адреси): ', 'Відколи: ',
        'Кому вже повідомили (якщо знаєте): ', 'Як зі мною зв’язатися: тут, у Telegram'].join('\n')
    },
    initiative: {
      title: 'Ініціатива',
      rules: 'Що ви хочете зробити разом із сусідами і як долучитися. Організатор — роль або організація, без приватних телефонів. ' +
        'Збір грошей — лише після перевірки модератором.',
      text: ['Привіт! Хочу запропонувати ініціативу для сусідів.', 'Що робимо: ', 'Навіщо: ', 'Як долучитися: ',
        'Хто організовує (роль або організація): ', 'Як зв’язатися: тут, у Telegram'].join('\n')
    },
    event: {
      title: 'Подія',
      rules: 'Місце — орієнтир або «адреса — учасникам». Організатор — роль або організація, без приватних телефонів.',
      text: ['Привіт! Хочу додати подію на сайт «Пуща-громада».', 'Що: ', 'Коли (дата, час, до котрої): ',
        'Де (орієнтир або «адреса — учасникам»): ', 'Хто організовує (роль або організація): ', 'Що взяти: ',
        'Як зв’язатися: тут, у Telegram'].join('\n')
    }
  };

  function renderAdd() {
    var tg = $('tg-btn');
    var note = $('tg-note');
    var moderator = '';
    var current = 'help';
    function select(type) {
      if (!TEMPLATES[type]) type = 'help';
      current = type;
      var t = TEMPLATES[type];
      $('type-title').textContent = t.title;
      $('type-rules').textContent = t.rules;
      $('template').textContent = t.text;
      tg.href = telegramLink(moderator, t.text, siteBase());
      note.hidden = !!moderator;
      Array.prototype.forEach.call(document.querySelectorAll('[data-type]'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-type') === type ? 'true' : 'false');
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-type]'), function (b) {
      b.addEventListener('click', function () { select(b.getAttribute('data-type')); });
    });
    root.addEventListener('hashchange', function () { select(location.hash.slice(1)); });
    select(location.hash.slice(1));
    fetchJSON('data/help.json').then(function (res) {
      moderator = prepHelp(res.data, Date.now()).moderator;
      select(current);
    }, function () { /* keep share link */ });
    $('copy-template').addEventListener('click', function () {
      copyText(TEMPLATES[current].text, $('copy-feedback'), $('copy-box'));
    });
  }

  /* ---------------- v2 pages: home blocks, events, news, about ---------------- */

  function siteBase() { return String(location.origin + location.pathname).replace(/[^\/]*$/, ''); }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function link(href, text, cls) { var a = el('a', cls || '', [text]); a.href = href; return a; }
  function button(label, cls, onClick) {
    var b = el('button', cls || 'btn btn-ghost', [label]);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function load(url) { return fetchJSON(url).then(function (r) { return r; }, function () { return null; }); }
  function orgMap(res) {
    var m = {};
    if (res && res.data && Array.isArray(res.data.orgs)) {
      res.data.orgs.forEach(function (o) { if (o && str(o.id, '') && str(o.name, '')) m[o.id] = o; });
    }
    return m;
  }
  function offlineNote(res) {
    var n = $('offline-note');
    if (n) n.hidden = !((res && res.fromCache) || navigator.onLine === false);
  }
  /* One list item for news, gossip and events: a small label and a title; everything else opens on tap.
     Two text styles at rest (label, title), so a long list reads calmly instead of flickering. */
  function foldItem(id, label, labelCls, title, body) {
    var sum = el('summary', '', [el('span', 'micro' + (labelCls ? ' ' + labelCls : ''), [label]), el('span', 'item-title', [title])]);
    var li = el('li', 'item', [el('details', '', [sum, el('div', 'item-body', body)])]);
    if (id) li.id = id;
    return li;
  }

  /* Weak connection: no pictures at all — each becomes a field of its tone, so nothing extra is downloaded.
     On when the phone asks to save data or the network is 2G, or when the person turns pictures off. */
  function liteMode() {
    var pref = storeGet('ph-pictures');
    if (pref === 'off') return true;
    if (pref === 'on') return false;
    var c = typeof navigator !== 'undefined' && navigator.connection;
    return !!(c && (c.saveData || /2g/.test(c.effectiveType || '')));
  }
  function newsPicture(n, cls) {
    if (!n.image || liteMode()) {
      var ph = el('span', 'pic ph t-' + n.tint + (cls ? ' ' + cls : ''), []);
      ph.setAttribute('aria-hidden', 'true');
      return ph;
    }
    var img = el('img', 'pic' + (cls ? ' ' + cls : ''), []);
    img.src = n.image; img.alt = n.imageAlt; img.decoding = 'async';
    img.width = 600; img.height = 450;
    return img;
  }
  function firstSentence(t) { var m = t.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t).trim(); }

  // The lead news: picture, label, a larger title and the first sentence; tap opens the rest.
  function leadItem(n, body) {
    var sum = el('summary', '', [
      newsPicture(n, 'lead-pic'),
      n.imageNote && !liteMode() ? el('span', 'pic-note', ['Фото: ' + n.imageNote]) : null,
      el('span', 'micro', [fmtDate(new Date(n.day)) + ' · ' + n.source]),
      el('span', 'lead-title', [n.title]),
      el('span', 'lead-ex', [firstSentence(n.text)])
    ]);
    var li = el('li', 'item lead-news', [el('details', '', [sum, el('div', 'item-body', body)])]);
    li.id = n.id;
    return li;
  }

  // «Картинки: вимкнути / увімкнути» at the end of the news page.
  function picturesToggle() {
    var b = $('pictures-btn');
    if (!b) return;
    function label() { b.textContent = liteMode() ? 'Показувати картинки' : 'Без картинок (економія трафіку)'; }
    b.addEventListener('click', function () {
      storeSet('ph-pictures', liteMode() ? 'on' : 'off');
      label();
      renderNews();
    });
    label();
  }

  function focusHash() {
    Array.prototype.forEach.call(document.querySelectorAll('.is-target'), function (n) { n.classList.remove('is-target'); });
    var t = location.hash && document.getElementById(location.hash.slice(1));
    if (t && t.tagName === 'LI') {
      t.classList.add('is-target');
      var d = t.querySelector('details');
      if (d) d.open = true;
    }
    if (t) t.scrollIntoView();
  }
  if (typeof document !== 'undefined') root.addEventListener('hashchange', focusHash);

  /* «Поділитися»: the phone's share sheet (Telegram, Viber…) when available, otherwise copy.
     Feedback appears on the button itself, so it is seen even far down a long list. */
  function shareOrCopy(text, btn) {
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () { /* closed by the person */ });
      return;
    }
    var label = btn.textContent;
    copyText(text, $('copy-feedback'), $('copy-box'), function (ok) {
      if (!ok) return;
      btn.textContent = 'Скопійовано ✓';
      setTimeout(function () { btn.textContent = label; }, 2000);
    });
  }

  function applyTheme(theme) {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F3F1E0' : '#232E29');
  }

  // The ◐ button in the top line of every page (#theme-btn). The label names the theme it switches to.
  function themeToggle() {
    var current = storeGet('ph-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current);
    var b = $('theme-btn');
    if (!b) return;
    function label() { b.setAttribute('aria-label', current === 'light' ? 'Темна тема' : 'Світла тема'); }
    b.addEventListener('click', function () {
      current = current === 'light' ? 'dark' : 'light';
      storeSet('ph-theme', current);
      applyTheme(current);
      label();
    });
    label();
  }

  function downloadIcs(ev, sample) {
    var now = Date.now();
    var url = siteBase() + 'events.html#' + ev.id;
    var fb = $('copy-feedback');
    try {
      var blob = new Blob([icsText(ev, ev.occ || { start: ev.start, end: ev.end }, url, now)], { type: 'text/calendar;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ev.id + '.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
      if (fb) fb.textContent = 'Збережено файл календаря ' + ev.id + '.ics. Відкрийте його, щоб додати подію.';
    } catch (e) {
      copyText(eventShareText(ev, now, url, '', sample), fb, $('copy-box'));
    }
  }

  function eventItem(ev, now, orgs, sample, active) {
    var occ = ev.occ;
    var org = orgs[ev.org];
    var d = new Date(occ.start);
    var url = siteBase() + 'events.html#' + ev.id;
    var label = WD_SHORT[d.getDay()] + ' ' + fmtDate(d) + ' · ' + hhmm(occ.start) + ' · ' + ev.kind;
    var who = (ev.organiser || org) ? el('p', '', ['Хто: ', ev.organiser, ev.organiser && org ? ', ' : '',
      org ? link('about.html#' + ev.org, org.name) : null]) : null;
    var place = ev.isPrivate
      ? el('p', '', ['Де: адреса — учасникам, напишіть організатору ', ev.contact ? link(ev.contact, 'у Telegram') : link('add.html#event', 'через модератора')])
      : el('p', '', ['Де: ' + (ev.place || 'уточнюється')]);
    var body = [
      ev.text ? el('p', '', [ev.text]) : null,
      el('p', '', [capital(whenText(occ.start, occ.end, now)) + (ev.repeat ? ' · ' + repeatLabel(ev.repeat) : '')]),
      place,
      who,
      occ.skipped ? el('p', 'notice', [capital(dayLabel(occ.skipped, now)) + ' скасовано. Наступна: ' + dayLabel(occ.start, now) + '.']) : null,
      ev.bring.length ? el('p', '', ['Взяти: ' + ev.bring.join(', ')]) : null,
      active ? el('p', 'alarm', [ev.alarm ? ALARM_RULE + ' ' + ev.alarm : ALARM_RULE]) : null,
      active ? el('div', 'actions', [
        button('У календар', 'btn-small', function () { downloadIcs(ev, sample); }),
        button('Поділитися', 'btn-small', function () {
          shareOrCopy(eventShareText(ev, Date.now(), url, org ? org.name : '', sample), this);
        }),
        mapLink(ev)
      ]) : null
    ];
    var li = foldItem(ev.id, label, '', ev.title, body);
    if (!active) li.classList.add('is-past');
    else if (ev.kind === 'кава' && ev.repeat) li.classList.add('is-coffee');   // moss, as on the home page
    return li;
  }

  // «На мапі»: opens map.html on this item's landmark (only when the item names one; never for a private place)
  function mapLink(x) {
    return x && x.spot ? link('map.html#' + encodeURIComponent(x.id), 'На мапі', 'btn-small') : null;
  }

  function renderEvents() {
    Promise.all([load('data/events.json'), load('data/orgs.json')]).then(function (r) {
      var now = Date.now();
      var res = r[0];
      var orgs = orgMap(r[1]);
      var E = prepEvents(res && res.data, now);
      [['today', 'ev-today', 'Сьогодні нічого не заплановано.'], ['week', 'ev-week', 'До кінця тижня — нічого.'],
        ['later', 'ev-later', 'Поки нічого.'], ['past', 'ev-past', 'Минулих подій немає.']].forEach(function (g) {
        var ul = $(g[1]);
        clear(ul);
        if (!res) { ul.appendChild(el('li', 'muted', ['Не вдалося завантажити події.'])); return; }
        var items = E.groups[g[0]];
        if (!items.length) { ul.appendChild(el('li', 'muted', [g[2]])); return; }
        items.forEach(function (ev) { ul.appendChild(eventItem(ev, now, orgs, E.sample, g[0] !== 'past')); });
      });
      offlineNote(res);
      focusHash();
    });
  }

  function renderNews() {
    Promise.all([load('data/posts.json'), load('data/events.json'), load('data/orgs.json')]).then(function (r) {
      var now = Date.now();
      var res = r[0];
      var P = prepPosts(res && res.data, now);
      var orgs = orgMap(r[2]);
      var evTitles = {};
      if (r[1] && r[1].data && Array.isArray(r[1].data.events)) {
        r[1].data.events.forEach(function (e) { if (e && e.id && e.title) evTitles[e.id] = e.title; });
      }
      var newsUl = $('news-list');
      var gUl = $('gossip-list');
      clear(newsUl); clear(gUl);
      if (!res) {
        newsUl.appendChild(el('li', 'muted', ['Не вдалося завантажити новини.']));
        gUl.appendChild(el('li', 'muted', ['Не вдалося завантажити плітки.']));
      } else {
        if (!P.news.length) newsUl.appendChild(el('li', 'muted', ['Поки новин немає.']));
        // Variant B: the freshest news leads (picture, title, first sentence); the rest is a quiet list.
        P.news.forEach(function (n, i) {
          var url = siteBase() + 'news.html#' + n.id;
          var org = orgs[n.org];
          var links = [];
          if (n.event && evTitles[n.event]) links.push('Подія: ', link('events.html#' + n.event, evTitles[n.event]));
          if (org) links.push(links.length ? ' · ' : '', link('about.html#' + n.org, org.name));
          var body = [
            el('p', '', [n.text]),
            el('p', 'meta', ['Джерело: ' + n.source + ' · перевірив: ' + n.verifiedBy]),
            links.length ? el('p', 'meta', links) : null,
            el('div', 'actions', [button('Поділитися', 'btn-small', function () {
              shareOrCopy(postShareText(n, url, P.sample), this);
            }), mapLink(n)])
          ];
          newsUl.appendChild(i === 0 ? leadItem(n, body) : foldItem(n.id, fmtDate(new Date(n.day)), '', n.title, body));
        });
        if (!P.gossip.length) gUl.appendChild(el('li', 'muted', ['Ніхто нічого не каже. Поки що.']));
        P.gossip.forEach(function (g) {
          var url = siteBase() + 'news.html#' + g.id;
          // Gossip is short: the rumour itself is the title. The label carries its state in colour.
          var li = foldItem(g.id, gossipTag(g.state) + ' · ' + fmtDate(new Date(g.day)),
            'g-' + (g.state === 'кажуть' ? 'open' : g.state === 'підтвердилось' ? 'yes' : 'no'), g.text, [
              g.state === 'підтвердилось' && g.confirmedBy ? el('p', '', [link('news.html#' + g.confirmedBy, 'Читати новину')]) : null,
              el('div', 'actions', [button('Поділитися', 'btn-small', function () {
                shareOrCopy(postShareText(g, url, P.sample), this);
              })])
            ]);
          if (g.state === 'не підтвердилось') li.classList.add('is-past');
          gUl.appendChild(li);
        });
      }
      // Problems and initiatives (owner, 2026-11-19: the home page is tiles of news, problems, initiatives, gossip)
      var prUl = $('problem-list'), inUl = $('initiative-list');
      if (prUl && inUl) {
        clear(prUl); clear(inUl);
        if (!res) {
          prUl.appendChild(el('li', 'muted', ['Не вдалося завантажити.']));
        } else {
          if (!P.problems.length) prUl.appendChild(el('li', 'muted', ['Відкритих проблем немає.']));
          P.problems.forEach(function (p) {
            var url = siteBase() + 'news.html#' + p.id;
            var li = foldItem(p.id, p.state + ' · ' + fmtDate(new Date(p.day)), 'pr-' + PROBLEM_STATES.indexOf(p.state), p.title, [
              el('p', '', [p.text]),
              p.place ? el('p', 'meta', ['Де: ' + p.place]) : null,
              el('p', 'meta', ['Джерело: ' + p.source + ' · перевірив: ' + p.verifiedBy]),
              el('div', 'actions', [button('Поділитися', 'btn-small', function () {
                shareOrCopy(postShareText(p, url, P.sample), this);
              }), mapLink(p)])
            ]);
            if (p.state === 'вирішено') li.classList.add('is-past');
            prUl.appendChild(li);
          });
          if (!P.initiatives.length) inUl.appendChild(el('li', 'muted', ['Поки ініціатив немає. Маєте ідею? Напишіть модератору.']));
          P.initiatives.forEach(function (n) {
            var url = siteBase() + 'news.html#' + n.id;
            var org = orgs[n.org];
            var links = [];
            if (n.event && evTitles[n.event]) links.push('Подія: ', link('events.html#' + n.event, evTitles[n.event]));
            if (org) links.push(links.length ? ' · ' : '', link('about.html#' + n.org, org.name));
            inUl.appendChild(foldItem(n.id, fmtDate(new Date(n.day)), '', n.title, [
              el('p', '', [n.text]),
              el('p', '', [el('b', '', ['Як долучитися: ']), n.join]),
              el('p', 'meta', ['Хто: ' + n.who]),
              links.length ? el('p', 'meta', links) : null,
              el('div', 'actions', [button('Поділитися', 'btn-small', function () {
                shareOrCopy(postShareText(n, url, P.sample), this);
              }), mapLink(n)])
            ]));
          });
        }
      }
      offlineNote(res);
      focusHash();
    });
  }

  function renderHomeExtras() {
    Promise.all([load('data/events.json'), load('data/posts.json')]).then(function (r) {
      var now = Date.now();
      var E = prepEvents(r[0] && r[0].data, now);
      var c = E.coffee;
      var box = $('coffee');
      clear(box);
      if (!r[0]) {
        box.appendChild(el('p', 'muted', ['Не вдалося завантажити події.']));
      } else if (!c || !c.occ) {
        box.appendChild(el('p', '', ['Кава з сусідами на паузі. Хочете провести? ', link('add.html#event', 'Напишіть модератору'), '.']));
      } else {
        box.appendChild(el('p', 'coffee-day', [capital(dayLabel(c.occ.start, now)) + ' · ' + repeatLabel(c.repeat)]));
        box.appendChild(el('p', 'coffee-time', [hhmm(c.occ.start)]));
        box.appendChild(el('p', 'coffee-where', [c.isPrivate ? 'адреса — учасникам' : c.place]));
        if (c.organiser) box.appendChild(el('p', 'card-meta', ['Зустрічає: ' + c.organiser]));
        if (c.occ.skipped) box.appendChild(el('p', 'notice', [capital(dayLabel(c.occ.skipped, now)) + ' скасовано.']));
        if (c.text) box.appendChild(el('p', '', [c.text]));
        box.appendChild(el('div', 'ev-actions', [
          button('У календар', 'btn', function () { downloadIcs(c, E.sample); }),
          link('events.html#' + c.id, 'Детальніше', 'btn btn-ghost')
        ]));
      }
      var todays = E.groups.today.filter(function (ev) { return ev !== c; }).slice(0, 3);
      $('today-block').hidden = !todays.length;
      var tl = $('today-list');
      clear(tl);
      todays.forEach(function (ev) {
        tl.appendChild(el('li', '', [
          el('span', 'card-meta', [hhmm(ev.occ.start) + '–' + hhmm(ev.occ.end)]),
          link('events.html#' + ev.id, ev.title),
          el('span', 'card-meta', [ev.isPrivate ? 'адреса — учасникам' : ev.place])
        ]));
      });

      var P = prepPosts(r[1] && r[1].data, now);
      var nl = $('home-news');
      clear(nl);
      if (!r[1]) nl.appendChild(el('li', 'muted', ['Не вдалося завантажити новини.']));
      else if (!P.news.length) nl.appendChild(el('li', 'muted', ['Поки новин немає.']));
      P.news.slice(0, 3).forEach(function (n) {
        nl.appendChild(el('li', '', [link('news.html#' + n.id, n.title), el('span', 'card-meta', [fmtDate(new Date(n.day)) + ' · ' + n.source])]));
      });
      var g = P.gossip.filter(function (x) { return x.state === 'кажуть'; })[0];
      var gl = $('home-gossip');
      gl.hidden = !g;
      if (g) {
        clear(gl);
        gl.appendChild(el('span', 'tag', ['кажуть, не перевірено']));
        gl.appendChild(el('span', 'gossip-text', [' ' + g.text + ' ']));
        gl.appendChild(link('news.html#gossip', 'Усі плітки'));
      }
    });
  }

  function renderAbout() {
    load('data/orgs.json').then(function (res) {
      var ul = $('partners');
      if (!ul) return;
      clear(ul);
      var orgs = res && res.data && Array.isArray(res.data.orgs) ? res.data.orgs : [];
      if (!orgs.length) { ul.appendChild(el('li', 'muted', ['Список партнерів поки порожній.'])); return; }
      orgs.forEach(function (o) {
        if (!o || !str(o.id, '') || !str(o.name, '')) return;
        var li = el('li', '', [
          el('span', 'tag', [str(o.kind, 'інше')]),
          el('b', '', [o.name]),
          el('p', '', [str(o.what, '')]),
          str(o.contact, '') ? el('p', 'card-meta', ['Контакт: ' + o.contact]) : null
        ]);
        li.id = o.id;
        ul.appendChild(li);
      });
      focusHash();
    });
  }

  /* ---------------- boot ---------------- */

  root.PH = {
    normState: normState,
    parseTime: parseTime,
    ageText: ageText,
    isStale: isStale,
    computeShift: computeShift,
    prepStatus: prepStatus,
    shareText: shareText,
    prepHelp: prepHelp,
    telegramLink: telegramLink,
    TEMPLATE: TEMPLATE,
    TEMPLATES: TEMPLATES,
    parseLocal: parseLocal,
    dayShift: dayShift,
    dayLabel: dayLabel,
    repeatLabel: repeatLabel,
    nextOccurrence: nextOccurrence,
    prepEvents: prepEvents,
    prepPosts: prepPosts,
    liteMode: function () { return typeof document !== 'undefined' && liteMode(); },
    icsText: icsText,
    eventShareText: eventShareText,
    postShareText: postShareText
  };

  if (typeof document === 'undefined') return; // loaded by tests

  /* Every page title runs exactly the width of the content (owner, 2026-11-19: one look for the whole site).
     Measure the word at one size and scale to the column; the face differs per phone, so it is measured.
     A short word (ЩЕ) would grow huge, so the size stops at TITLE_MAX. */
  var TITLE_MAX = 96;
  function fitTitles() {
    var hs = Array.prototype.slice.call(document.querySelectorAll('.fit-title'));
    if (!hs.length) return;
    function fit() {
      hs.forEach(function (h) {
        var span = h.firstElementChild;
        if (!span) return;
        h.style.fontSize = '100px';
        var w = span.getBoundingClientRect().width;
        var room = h.clientWidth;
        if (w > 0 && room > 0) h.style.fontSize = Math.min(TITLE_MAX, Math.floor(100 * room / w * 10) / 10) + 'px';
      });
    }
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    var t = null;
    root.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 100); });
  }

  function boot() {
    var page = document.body.getAttribute('data-page');
    themeToggle();
    fitTitles();
    if (page === 'home') { renderHome(); if ($('coffee')) renderHomeExtras(); }
    else if (page === 'help') renderHelp();
    else if (page === 'add') renderAdd();
    else if (page === 'events') renderEvents();
    else if (page === 'news') { renderNews(); picturesToggle(); }
    else if (page === 'about') renderAbout();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode unavailable */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(this);
