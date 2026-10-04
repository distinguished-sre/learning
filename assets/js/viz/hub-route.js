/* Карта курсов на главной (_includes/hub-route.html): три линии, темы как станции, пересадки между курсами.
   Данные берёт из <script class="hr-data"> рядом, прогресс читает из localStorage (ключи done, lt:done, mon:done,
   только чтение). Без внешних библиотек. На страницах без [data-hub-route] ничего не делает. */
(function () {
  'use strict';
  var host = document.querySelector('[data-hub-route]');
  if (!host) return;
  var dataEl = host.querySelector('.hr-data');
  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!data || !data.courses || !data.courses.length) return;

  var ROW = 48, TOP = 100, BOTTOM = 30, MIN_W = 860;
  var SIDE = { devops: 'left', monitoring: 'mid', 'load-tester': 'right' };
  var XPOS = { devops: 0.3, monitoring: 0.5, 'load-tester': 0.7 };
  var STORE_KEY = { devops: 'done', 'load-tester': 'lt:done', monitoring: 'mon:done' };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
    return many;
  }
  function lessonsText(n) { return n + ' ' + plural(n, 'урок', 'урока', 'уроков'); }
  function hours(t) { var v = parseFloat(String(t || '').replace(',', '.')); return isNaN(v) ? 0 : v; }

  /* ---------- прогресс: только чтение localStorage ---------- */
  function readDone(key) {
    var set = {};
    try {
      var raw = localStorage.getItem(STORE_KEY[key]);
      var arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) arr.forEach(function (id) { set[String(id)] = 1; });
    } catch (e) {}
    return set;
  }
  var byKey = {}, stations = {};
  data.courses.forEach(function (c) {
    byKey[c.key] = c;
    var done = readDone(c.key);
    c.lessonsTotal = 0; c.doneTotal = 0; c.hoursTotal = 0;
    c.topics.forEach(function (t) {
      t.course = c;
      t.key = c.key + ':' + t.n;
      t.done = t.lessons.filter(function (id) { return done[id]; }).length;
      t.xfers = [];
      c.lessonsTotal += t.lessons.length;
      c.doneTotal += t.done;
      c.hoursTotal += hours(t.time);
      stations[t.key] = t;
    });
  });
  (data.links || []).forEach(function (l) {
    var a = stations[l.a], b = stations[l.b];
    if (!a || !b) return;
    a.xfers.push({ to: b, label: l.label });
    b.xfers.push({ to: a, label: l.label });
  });

  function progressClass(t) {
    if (!t.course.doneTotal) return '';
    if (t.done >= t.lessons.length && t.lessons.length) return 'is-done';
    if (t.done > 0) return 'is-part';
    return '';
  }
  function tipText(t, withTitle) {
    var parts = [];
    if (withTitle) parts.push('Тема ' + t.n + '. ' + t.title);
    parts.push(lessonsText(t.lessons.length) + ', ' + t.time);
    if (t.course.doneTotal) parts.push('пройдено ' + t.done + ' из ' + t.lessons.length);
    t.xfers.forEach(function (x) { parts.push('Пересадка (' + x.label + '): ' + x.to.course.name + ', тема ' + x.to.n + ' «' + x.to.title + '»'); });
    return parts.join('. ');
  }

  /* ---------- списки: прогресс и пересадки добавляем к статичной версии ---------- */
  data.courses.forEach(function (c) {
    var p = host.querySelector('[data-progress-for="' + c.key + '"]');
    if (p && c.doneTotal) { p.textContent = 'пройдено ' + c.doneTotal + ' из ' + c.lessonsTotal; p.hidden = false; }
    c.topics.forEach(function (t) {
      var li = host.querySelector('.hr-static li[data-topic="' + t.key + '"]');
      if (!li) return;
      var cls = progressClass(t);
      if (cls) { li.classList.add(cls); li.style.setProperty('--p', Math.round(100 * t.done / t.lessons.length) + '%'); }
    });
  });

  /* ---------- схема ---------- */
  var map = el('div', 'hr-map');
  var canvas = el('div', 'hr-canvas');
  canvas.setAttribute('role', 'group');
  canvas.setAttribute('aria-label', 'Схема курсов: три линии, темы как станции, пунктир между линиями это пересадки, где один курс ссылается на другой');
  map.appendChild(canvas);
  var legend = el('div', 'hr-legend');
  legend.appendChild(el('span', 'hr-lg-xfer', 'пересадка: тема ссылается на тему другого курса'));
  var anyProgress = data.courses.some(function (c) { return c.doneTotal > 0; });
  if (anyProgress) {
    legend.appendChild(el('span', 'hr-lg-done', 'тема пройдена'));
    legend.appendChild(el('span', 'hr-lg-part', 'пройдена часть уроков'));
  }
  map.appendChild(legend);
  host.insertBefore(map, host.firstChild);
  host.classList.add('has-map');

  var tip = el('div', 'hr-tip');
  tip.setAttribute('aria-hidden', 'true');
  var lastW = 0, animated = false;

  function monRows(count, maxRows) {
    /* Мониторинг начинается с темы Linux и Docker (стенд из load-tester 5 или DevOps 4): станции между 5.5 и предпоследним рядом. */
    var first = 5.5, last = Math.max(first + count - 1, maxRows - 1.5);
    if (count === 1) return [first];
    var step = (last - first) / (count - 1);
    var rows = [];
    for (var i = 0; i < count; i++) rows.push(first + step * i);
    return rows;
  }

  function build() {
    var W = Math.max(MIN_W, host.clientWidth || 0);
    lastW = W;
    var maxRows = 0;
    data.courses.forEach(function (c) { if (SIDE[c.key] !== 'mid') maxRows = Math.max(maxRows, c.topics.length); });
    var H = TOP + maxRows * ROW + BOTTOM;
    canvas.innerHTML = '';
    canvas.style.height = H + 'px';
    canvas.style.minWidth = MIN_W + 'px';
    var labelW = Math.round(W * XPOS.devops - 34), midW = Math.min(260, Math.round(W * 0.22));

    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
    canvas.appendChild(svg);
    var y = function (row) { return TOP + (row - 1) * ROW + ROW / 2; };

    data.courses.forEach(function (c) {
      var side = SIDE[c.key] || 'right';
      var x = Math.round(W * (XPOS[c.key] || 0.5));
      var rows = side === 'mid' ? monRows(c.topics.length, maxRows) : c.topics.map(function (t, i) { return i + 1; });
      c.topics.forEach(function (t, i) { t.x = x; t.y = Math.round(y(rows[i])); t.side = side; });

      var y1 = c.topics[0].y, y2 = c.topics[c.topics.length - 1].y;
      if (side === 'mid') {
        var lead = svgEl('path', { d: 'M' + x + ' ' + (TOP - 12) + ' V' + (y1 - 16), 'class': 'hr-rail-lead hr-c-' + c.key });
        svg.appendChild(lead);
        var leadLabel = el('span', 'hr-rail-lead-label', 'старт после Linux и Docker из любого курса');
        leadLabel.style.left = x + 'px';
        leadLabel.style.top = Math.round(y(2.75)) + 'px';
        canvas.appendChild(leadLabel);
      }
      var rail = svgEl('path', { d: 'M' + x + ' ' + y1 + ' V' + y2, 'class': 'hr-rail hr-c-' + c.key });
      rail.style.setProperty('--hr-len', (y2 - y1 + 10));
      svg.appendChild(rail);

      var head = el('div', 'hr-head side-' + side + ' hr-c-' + c.key);
      head.style.left = (side === 'left' ? x + 7 : side === 'right' ? x - 7 : x) + 'px';
      var name = el('a', 'hr-head-name', c.name);
      name.href = c.home;
      head.appendChild(name);
      head.appendChild(el('p', 'hr-head-meta', c.topics.length + ' ' + plural(c.topics.length, 'тема', 'темы', 'тем') + ' · ' + lessonsText(c.lessonsTotal) + ' · ≈' + Math.round(c.hoursTotal) + ' ч'));
      if (c.doneTotal) {
        var pr = el('p', 'hr-head-progress');
        pr.appendChild(el('span', '', 'пройдено ' + c.doneTotal + ' из ' + c.lessonsTotal));
        var bar = el('span', 'hr-head-bar');
        var fill = el('i');
        fill.style.setProperty('--p', Math.round(100 * c.doneTotal / c.lessonsTotal) + '%');
        bar.appendChild(fill);
        pr.appendChild(bar);
        head.appendChild(pr);
      }
      canvas.appendChild(head);

      var ol = el('ol', 'hr-col');
      ol.setAttribute('aria-label', c.name + ': темы');
      c.topics.forEach(function (t, i) {
        var li = el('li');
        li.style.left = (side === 'left' ? t.x - labelW : side === 'mid' ? t.x - midW / 2 : t.x) + 'px';
        li.style.width = (side === 'mid' ? midW : labelW) + 'px';
        li.style.top = t.y + 'px';
        li.style.setProperty('--i', i);
        var a = el('a', 'hr-st side-' + side + ' hr-c-' + c.key + (t.xfers.length ? ' is-xfer' : ''));
        var cls = progressClass(t);
        if (cls) { a.classList.add(cls); a.style.setProperty('--p', Math.round(100 * t.done / t.lessons.length) + '%'); }
        a.href = t.url;
        a.setAttribute('aria-label', tipText(t, true));
        a.appendChild(el('span', 'hr-dot'));
        a.appendChild(el('span', 'hr-st-label', t.title));
        a.addEventListener('mouseenter', function () { showTip(t); });
        a.addEventListener('mouseleave', hideTip);
        a.addEventListener('focus', function () { showTip(t); });
        a.addEventListener('blur', hideTip);
        li.appendChild(a);
        ol.appendChild(li);
      });
      canvas.appendChild(ol);
    });

    (data.links || []).forEach(function (l) {
      var a = stations[l.a], b = stations[l.b];
      if (!a || !b || a.x === undefined || b.x === undefined) return;
      if (a.x > b.x) { var tmp = a; a = b; b = tmp; }
      var r = 13;
      var line = svgEl('line', { x1: a.x + r, y1: a.y, x2: b.x - r, y2: b.y, 'class': 'hr-xfer' });
      svg.appendChild(line);
      var pill = el('span', 'hr-pill', l.label);
      canvas.appendChild(pill);
      /* пересадка с центральной линией: ярлык ближе к боковой станции (но не на её кружке),
         чтобы не закрывать подписи в центре */
      var cx = (a.x + b.x) / 2, half = pill.offsetWidth / 2 + 24;
      if (b.side === 'mid') cx = Math.max(a.x + (b.x - a.x) * 0.38, a.x + half);
      else if (a.side === 'mid') cx = Math.min(a.x + (b.x - a.x) * 0.62, b.x - half);
      var k = (cx - a.x) / (b.x - a.x);
      pill.style.left = Math.round(cx) + 'px';
      pill.style.top = Math.round(a.y + (b.y - a.y) * k) + 'px';
    });

    canvas.appendChild(tip);
    /* повторная сборка (изменилась ширина): без анимации появления */
    canvas.classList.remove('is-animated');
    canvas.classList.toggle('is-settled', animated);
  }

  function showTip(t) {
    tip.innerHTML = '';
    tip.className = 'hr-tip hr-c-' + t.course.key;
    tip.appendChild(el('b', '', 'Тема ' + t.n + '. ' + t.title));
    tip.appendChild(el('div', 'hr-tip-meta', lessonsText(t.lessons.length) + ' · ' + t.time));
    if (t.course.doneTotal) tip.appendChild(el('div', 'hr-tip-progress', 'пройдено ' + t.done + ' из ' + t.lessons.length));
    t.xfers.forEach(function (x) {
      var d = el('div', 'hr-tip-xfer hr-c-' + x.to.course.key);
      d.appendChild(el('i'));
      d.appendChild(document.createTextNode(x.label + ': ' + x.to.course.name + ', тема ' + x.to.n));
      tip.appendChild(d);
    });
    var W = canvas.clientWidth || lastW;
    tip.style.left = '0px'; tip.style.top = '0px';
    tip.classList.add('is-on');
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = Math.min(Math.max(8, t.x - tw / 2), W - tw - 8);
    var top = t.y - th - 16;
    if (top < 4) top = t.y + 18;
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }
  function hideTip() { tip.classList.remove('is-on'); }
  canvas.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });

  build();

  /* появление при первом показе, если движение не отключено */
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) {
        animated = true; canvas.classList.add('is-animated'); io.disconnect();
        /* после появления итоговое состояние задаём статично, без зависимости от анимации */
        setTimeout(function () { canvas.classList.remove('is-animated'); canvas.classList.add('is-settled'); }, 1800);
      }
    }, { threshold: 0.15 });
    io.observe(canvas);
  }

  var timer = null;
  function onResize() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var W = Math.max(MIN_W, host.clientWidth || 0);
      if (W !== lastW) { animated = animated || canvas.classList.contains('is-animated'); build(); }
    }, 120);
  }
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(host); else window.addEventListener('resize', onResize);
})();
