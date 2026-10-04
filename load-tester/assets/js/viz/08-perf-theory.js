/* Виджеты темы 8 «Теория производительности»: регистрируются через window.LTViz.
   Имена с префиксом perf-. Модели упрощены для объяснения, это не измерения учебного сервиса.

   perf-little: закон Литтла на примере помещения (кафе, зал ожидания, пул).
     data-rate   сколько приходит в минуту (1-40, по умолчанию 6)
     data-time   сколько секунд каждый проводит внутри (5-180, по умолчанию 60)
     data-place  как называть помещение (по умолчанию «кафе»)
   perf-open-closed: открытая и закрытая модели нагрузки при замедлении сервера.
     data-rate   открытая модель: запросов в секунду приходит независимо от ответов (по умолчанию 8)
     data-users  закрытая модель: пользователей, каждый ждёт ответа и думает (по умолчанию 10)
     data-slow   во сколько раз сервер замедляется на отрезке 20-40 с (по умолчанию 3)
   perf-mix: пересчёт «сессий в пиковый час» в RPS по операциям.
     data-sessions  сессий в пиковый час (по умолчанию 2400)
     data-peak      множитель пика минуты к среднему часа (по умолчанию 1.5)
     data-growth    запас на рост (по умолчанию 2)
     data-ops       JSON-массив {"name","per"} - сколько таких операций делает одна сессия
     data-limit     JSON {"имя операции": предел в RPS} - метка предела (необязательно) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt, lerp = L.lerp;

  var css = [
    '.perf-lg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;font-size:.85rem;color:var(--muted)}',
    '.perf-lg span{display:inline-flex;align-items:center;gap:6px}',
    '.perf-lg i{display:inline-block;width:12px;height:4px;border-radius:2px;background:currentColor}',
    '.perf-lg .a{color:var(--red)}.perf-lg .b{color:var(--blue)}.perf-lg .c{color:var(--yellow)}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('perf-viz-style')) return;
    var s = document.createElement('style'); s.id = 'perf-viz-style'; s.textContent = css; document.head.appendChild(s);
  }
  function legend(host, items) {
    var d = html('div', undefined, 'perf-lg');
    items.forEach(function (it) { var s = html('span', undefined, it[0]); s.appendChild(html('i')); s.appendChild(document.createTextNode(it[1])); d.appendChild(s); });
    return d;
  }
  // Детерминированный генератор: при перезапуске картинка та же, при reduced motion кадр стабилен.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- perf-little ---------- */
  L.widgets['perf-little'] = function (host) {
    injectStyle();
    var rate = num(host.dataset.rate, 6, 1, 40), stay = num(host.dataset.time, 60, 5, 180);
    var place = host.dataset.place || 'кафе';
    var SPEED = 8, WINDOW = 240; // секунда на экране = 8 секунд жизни помещения; график хранит 240 с
    var v = L.setup(host, host.dataset.title || 'Закон Литтла: сколько людей внутри');
    var rand = rng(7), clock, nextIn, people, slots, hist, histT, geo = {}, hoverT = null;
    function reset() { clock = 0; nextIn = 0.5; people = []; slots = []; hist = []; histT = 0; rand = rng(7); }
    function inside() { return people.length; }
    function step(dt) {
      clock += dt; nextIn -= dt;
      while (nextIn <= 0) {
        var slot = 0; while (slots[slot]) slot++;
        var p = { t0: clock + nextIn, out: clock + nextIn + stay * (0.7 + 0.6 * rand()), slot: slot };
        slots[slot] = p; people.push(p);
        nextIn += 60 / rate * (0.5 + rand());
      }
      people = people.filter(function (p) { if (p.out <= clock) { slots[p.slot] = null; return false; } return true; });
      histT += dt; while (histT >= 1) { histT -= 1; hist.push({ t: Math.floor(clock - histT), n: people.length }); if (hist.length > WINDOW) hist.shift(); }
    }
    function run(sec) { while (sec > 0) { var d = Math.min(0.5, sec); step(d); sec -= d; } }
    function expected() { return rate / 60 * stay; }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640));
      var exp = expected(), dots = Math.max(20, Math.ceil(exp * 1.8)), step_ = 17;
      var cols = Math.max(4, Math.floor((W0 - 24) / step_)), rows = Math.ceil(dots / cols);
      var roomTop = 30, roomH = rows * step_ + 14, chartTop = roomTop + roomH + 56, chartH = 150;
      var H = chartTop + chartH + 36, W = v.canvas(H);
      v.label(8, 18, 'Внутри: ' + inside(), 'primary', 'start');
      v.label(W - 8, 18, 'приходит ' + fmt(rate, 0) + ' в минуту, остаётся ' + fmt(stay, 0) + ' с', 'muted small', 'end');
      v.add('rect', { x: 4, y: roomTop, width: W - 8, height: roomH, rx: 10, class: 'box' });
      people.forEach(function (p) {
        var cx = 4 + 12 + (p.slot % cols) * step_ + 2, cy = roomTop + 14 + Math.floor(p.slot / cols) * step_;
        var age = (clock - p.t0) / (p.out - p.t0);
        v.add('circle', { cx: cx, cy: cy, r: 6, class: (age > 0.85 ? 'warning' : 'response') + ' fill' });
      });
      v.label(8, roomTop + roomH + 20, 'Синие точки: сидят в ' + place + ', жёлтые: скоро уйдут.', 'muted small', 'start');
      // график: сколько внутри по времени
      var left = 40, right = W - 12, top = chartTop, bottom = chartTop + chartH;
      var yMax = Math.max(4, Math.ceil(exp * 1.7 / 2) * 2);
      var t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - WINDOW + 1), span = Math.max(30, t1 - t0);
      function X(t) { return left + (t - t0) / span * (right - left); }
      function Y(n) { return bottom - Math.min(n, yMax) / yMax * (bottom - top); }
      geo = { left: left, right: right, t0: t0, span: span };
      for (var g = 0; g <= 4; g++) {
        v.add('line', { x1: left, x2: right, y1: Y(yMax * g / 4), y2: Y(yMax * g / 4), class: 'grid' });
        v.label(left - 6, Y(yMax * g / 4) + 5, fmt(yMax * g / 4, 0), 'muted small', 'end');
      }
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.label(left, top - 8, 'сколько внутри', 'muted small', 'start');
      v.label((left + right) / 2, bottom + 20, 'время, секунд от начала показа', 'muted small');
      v.add('line', { x1: left, x2: right, y1: Y(exp), y2: Y(exp), class: 'warning marker' });
      v.label(right - 4, Y(exp) - 6, 'по формуле: ' + fmt(exp, 1), 'warning halo small', 'end');
      if (hist.length > 1) {
        v.add('polyline', { points: hist.map(function (h) { return X(h.t) + ',' + Y(h.n); }).join(' '), class: 'response stroke' });
      }
      if (hoverT !== null) {
        v.add('line', { x1: X(hoverT), x2: X(hoverT), y1: top, y2: bottom, class: 'muted marker' });
      }
    }
    function describe() {
      var exp = expected();
      v.explain('В среднем раз в <b>' + fmt(60 / rate, 1) + ' с</b> в ' + esc(place) + ' заходит человек (<b>' + fmt(rate, 0) + ' в минуту</b>) и сидит около <b>' + fmt(stay, 0) + ' с</b>. ' +
        'Внутри в среднем: ' + fmt(rate, 0) + ' в минуту × ' + fmt(stay, 0) + ' с ÷ 60 с = <b>' + fmt(exp, 1) + '</b> человека. Сейчас внутри <b>' + inside() + '</b>: число гуляет вокруг жёлтой линии: интервалы между приходами случайные, а в среднем держится у неё.<br>' +
        'Это закон Литтла: <b>сколько внутри = скорость прихода × время, которое каждый проводит внутри</b>. Для сервера «внутри» это запросы в работе, «пришли» это RPS, «время» это задержка.');
    }
    v.slider('Приходит в минуту', 1, 40, 1, rate, function (n) { rate = n; describe(); if (ctl.reduced) still(); }, '');
    v.slider('Каждый проводит внутри', 5, 180, 5, stay, function (n) { stay = n; describe(); if (ctl.reduced) still(); }, 'с');
    v.tryIt('удвой скорость прихода и подожди: внутри станет вдвое больше. Потом вдвое увеличь время пребывания: эффект тот же. Наведи в любое место графика: увидишь, сколько было внутри в тот момент.');
    function still() { reset(); run(Math.min(WINDOW, stay * 2.5)); draw(); describe(); }
    var ctl = L.animate(v, function (dt) { run(dt * SPEED); draw(); if (Math.floor(clock) % 4 === 0) describe(); }, still, function () { reset(); });
    v.hover(function (e, q) {
      var t = Math.max(0, Math.min(geo.t0 + geo.span, geo.t0 + (q.x - geo.left) / (geo.right - geo.left) * geo.span));
      hoverT = Math.round(t); draw();
      var h = hist.filter(function (x) { return x.t === hoverT; })[0] || hist.filter(function (x) { return x.t <= hoverT; }).pop();
      v.showTip(h ? '<b>' + h.t + ' с от начала</b><br>внутри было ' + h.n + ', по формуле в среднем ' + fmt(expected(), 1) : 'Здесь ещё пусто', e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    reset(); draw(); describe(); v.onResize(draw);
  };

  /* ---------- perf-open-closed ---------- */
  L.widgets['perf-open-closed'] = function (host) {
    injectStyle();
    var rate = num(host.dataset.rate, 8, 1, 14), users = Math.round(num(host.dataset.users, 10, 1, 40)), slow = num(host.dataset.slow, 3, 1, 6);
    var S = 0.1, T = 80, SLOW_FROM = 20, SLOW_TO = 40, DT = 0.01, SPEED = 5, SAMPLE = 1;
    var v = L.setup(host, host.dataset.title || 'Открытая и закрытая модели нагрузки');
    var open, closed, clock, samples, rand, geo = {}, hoverT = null;
    function think() { return Math.max(0.05, users / rate - S); }
    function expo(r, mean) { return -Math.log(1 - r()) * mean; }
    function mk(isOpen) {
      var s = { isOpen: isOpen, queue: [], cur: null, done: 0, latSum: 0, latN: 0, wake: [], next: 0, rand: rng(isOpen ? 11 : 23) };
      if (!isOpen) for (var i = 0; i < users; i++) s.wake.push(expo(s.rand, think()));
      else s.next = expo(s.rand, 1 / rate);
      return s;
    }
    function factor(t) { return t >= SLOW_FROM && t < SLOW_TO ? slow : 1; }
    function stepSys(s, now) {
      if (s.isOpen) { while (s.next <= now) { s.queue.push(s.next); s.next += expo(s.rand, 1 / rate); } }
      else {
        for (var i = 0; i < s.wake.length; i++) if (s.wake[i] <= now) { s.queue.push(s.wake[i]); s.wake[i] = Infinity; }
      }
      if (s.cur && now >= s.cur.end) {
        s.done++; s.latSum += now - s.cur.t0; s.latN++;
        if (!s.isOpen) for (var j = 0; j < s.wake.length; j++) if (s.wake[j] === Infinity) { s.wake[j] = now + expo(s.rand, think()); break; }
        s.cur = null;
      }
      if (!s.cur && s.queue.length) { var t0 = s.queue.shift(); s.cur = { t0: t0, end: now + expo(s.rand, S * factor(now)) }; }
    }
    function inSys(s) { return s.queue.length + (s.cur ? 1 : 0); }
    function reset() {
      open = mk(true); closed = mk(false); clock = 0; samples = [];
      open.last = { done: 0, latSum: 0, latN: 0 }; closed.last = { done: 0, latSum: 0, latN: 0 };
    }
    function snap(s) {
      var dl = s.latN - s.last.latN, r = { n: inSys(s), lat: dl > 0 ? (s.latSum - s.last.latSum) / dl : null, rps: (s.done - s.last.done) / SAMPLE };
      s.last = { done: s.done, latSum: s.latSum, latN: s.latN }; return r;
    }
    function run(sec) {
      var target = Math.min(T, clock + sec);
      while (clock < target - 1e-9) {
        clock += DT; stepSys(open, clock); stepSys(closed, clock);
        if (Math.floor(clock / SAMPLE + 1e-9) > samples.length) samples.push({ t: samples.length + SAMPLE, o: snap(open), c: snap(closed) });
      }
      return clock < T;
    }
    function last() { return samples[samples.length - 1]; }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var H = 470, W = v.canvas(H), left = narrow ? 38 : 46, right = W - 12;
      var panels = [{ top: 36, bottom: 196, key: 'n', title: narrow ? 'Запросов в системе' : 'Сколько запросов в системе (очередь + в работе)' }, { top: 266, bottom: 426, key: 'lat', title: narrow ? 'Время ответа, с' : 'Сколько ждёт ответ, секунд (среднее по ответам секунды)' }];
      function X(t) { return left + t / T * (right - left); }
      geo = { left: left, right: right };
      panels.forEach(function (p, pi) {
        var mx = 4;
        samples.forEach(function (s) { ['o', 'c'].forEach(function (k) { var val = s[k][p.key]; if (val != null && val > mx) mx = val; }); });
        var yMax = L.scale(mx * 1.1, pi === 0).max;
        function Y(n) { return p.bottom - Math.min(n, yMax) / yMax * (p.bottom - p.top); }
        v.add('rect', { x: X(SLOW_FROM), y: p.top, width: X(SLOW_TO) - X(SLOW_FROM), height: p.bottom - p.top, class: 'danger zone' });
        for (var g = 0; g <= 4; g++) {
          v.add('line', { x1: left, x2: right, y1: Y(yMax * g / 4), y2: Y(yMax * g / 4), class: 'grid' });
          v.label(left - 6, Y(yMax * g / 4) + 5, fmt(yMax * g / 4, yMax < 8 ? 1 : 0), 'muted small', 'end');
        }
        v.add('path', { d: 'M' + left + ' ' + p.top + 'V' + p.bottom + 'H' + right, class: 'axis' });
        v.label(left, p.top - 10, p.title, 'muted small', 'start');
        [['o', 'danger'], ['c', 'response']].forEach(function (m) {
          var pts = []; samples.forEach(function (s) { var val = s[m[0]][p.key]; if (val != null) pts.push(X(s.t) + ',' + Y(val)); });
          if (pts.length > 1) v.add('polyline', { points: pts.join(' '), class: m[1] + ' stroke' });
        });
      });
      v.label(X((SLOW_FROM + SLOW_TO) / 2), 214, 'сервер медленнее в ' + fmt(slow, 0) + ' раз', 'danger small');
      v.label((left + right) / 2, H - 8, 'время теста, секунд', 'muted small');
      if (clock > 0) { v.add('line', { x1: X(clock), x2: X(clock), y1: 36, y2: 426, class: 'muted marker' }); }
      if (hoverT !== null) { v.add('line', { x1: X(hoverT), x2: X(hoverT), y1: 36, y2: 426, class: 'primary marker' }); }
    }
    function describe() {
      var s = last(), t = s ? s.t : 0;
      var phase = t < SLOW_FROM ? 'сервер работает как обычно' : t < SLOW_TO ? 'сервер замедлился в ' + fmt(slow, 0) + ' раз' : 'сервер снова быстрый';
      var text = 'Обе модели начинают одинаково: около <b>' + fmt(rate, 0) + ' запросов в секунду</b>. <b>Открытая</b> модель (красная) шлёт запросы по расписанию, как поток покупателей с улицы, и не смотрит, ответили ли ей. <b>Закрытая</b> (синяя) это ' + users + ' пользователей, каждый шлёт новый запрос только после ответа на прошлый и после паузы на раздумье.<br>';
      if (s) text += 'Сейчас ' + t + '-я секунда, ' + phase + '. Открытая: в системе <b>' + s.o.n + '</b>, ответ ' + (s.o.lat == null ? 'пока нет' : '<b>' + fmt(s.o.lat, 1) + ' с</b>') + '. Закрытая: в системе <b>' + s.c.n + '</b>, ответ ' + (s.c.lat == null ? 'пока нет' : '<b>' + fmt(s.c.lat, 1) + ' с</b>') + '.<br>';
      text += 'Закрытая модель сама «щадит» сервер: пока тот тормозит, пользователи заняты ожиданием и не шлют новые запросы, поэтому очередь не выходит за число пользователей. Открытая этого не делает, и очередь после замедления растёт и потом долго рассасывается.';
      v.explain(text);
    }
    function restart() { reset(); if (ctl.reduced) still(); else { draw(); describe(); } }
    function still() { reset(); run(T); draw(); describe(); }
    v.slider('Замедление сервера', 1, 6, 1, slow, function (n) { slow = n; restart(); }, '×');
    v.slider('Запросов в секунду (открытая)', 1, 14, 1, rate, function (n) { rate = n; restart(); }, '');
    v.slider('Пользователей (закрытая)', 1, 40, 1, users, function (n) { users = Math.round(n); restart(); }, '');
    v.tryIt('поставь замедление ×1: линии почти совпадут. Потом ×3, ×6: красная уходит вверх, синяя упирается в потолок. Наведи в любое место графика, чтобы сравнить модели в одну секунду.');
    v.status.textContent = 'Сервер один, обрабатывает запрос в среднем за 100 мс. Показ ускорен в ' + SPEED + ' раз, после 80 с начнётся заново.';
    var hold = 0;
    var ctl = L.animate(v, function (dt) {
      if (clock >= T) { hold += dt; if (hold > 2.5) { hold = 0; reset(); } draw(); return; }
      run(dt * SPEED); draw(); describe();
    }, still, function () { reset(); });
    v.hover(function (e, q) {
      var t = Math.max(1, Math.min(T, Math.round((q.x - geo.left) / (geo.right - geo.left) * T)));
      var s = samples[t - 1];
      if (!s) { hoverT = null; v.showTip('Сюда показ ещё не дошёл', e.clientX, e.clientY); return; }
      hoverT = t; draw();
      function r(m) { return 'в системе ' + m.n + ', ответ ' + (m.lat == null ? 'нет данных' : fmt(m.lat, 1) + ' с') + ', ответов ' + fmt(m.rps, 0) + '/с'; }
      v.showTip('<b>' + t + '-я секунда</b><br><span class="danger">Открытая:</span> ' + r(s.o) + '<br><span class="response">Закрытая:</span> ' + r(s.c), e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    reset(); v.stage.parentNode.insertBefore(legend(host, [['a', 'открытая модель: запросы идут по расписанию'], ['b', 'закрытая: ждут ответа']]), v.stage.nextSibling);
    draw(); describe(); v.onResize(draw);
  };

  /* ---------- perf-mix ---------- */
  var DEFAULT_OPS = [
    { name: 'Вход (POST /api/login)', per: 1 }, { name: 'Список каталога', per: 5 }, { name: 'Карточка товара', per: 3 },
    { name: 'В корзину', per: 1.2 }, { name: 'Оформить заказ', per: 0.25 }, { name: 'История заказов', per: 0.3 }
  ];
  L.widgets['perf-mix'] = function (host) {
    injectStyle();
    var sessions = num(host.dataset.sessions, 2400, 100, 20000), peak = num(host.dataset.peak, 1.5, 1, 4), growth = num(host.dataset.growth, 2, 1, 5);
    var ops = L.json(host.dataset.ops, DEFAULT_OPS), limits = L.json(host.dataset.limit, {});
    if (!Array.isArray(ops) || !ops.length || ops.length > 10 || !ops.every(function (o) { return o && typeof o.name === 'string' && isFinite(o.per) && o.per >= 0; })) throw new Error('data-ops: JSON-массив из 1-10 операций {"name": строка, "per": число не меньше 0}.');
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) limits = {};
    var v = L.setup(host, host.dataset.title || 'От сессий в час к запросам в секунду');
    var prog = 0, geo = {};
    function rps(o) { return sessions * o.per / 3600 * peak * growth; }
    function total() { return ops.reduce(function (a, o) { return a + rps(o); }, 0); }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var rowH = 38, top = 30, H = top + ops.length * rowH + 40, W = v.canvas(H);
      var labelW = narrow ? 96 : 200, left = labelW + 8, right = W - (narrow ? 44 : 60);
      var mx = 0; ops.forEach(function (o) { mx = Math.max(mx, rps(o), limits[o.name] || 0); });
      var xMax = L.scale(mx * 1.1).max;
      function X(n) { return left + n / xMax * (right - left); }
      geo = { top: top, rowH: rowH };
      for (var g = 0; g <= 4; g++) {
        v.add('line', { x1: X(xMax * g / 4), x2: X(xMax * g / 4), y1: top - 6, y2: top + ops.length * rowH, class: 'grid' });
        v.label(X(xMax * g / 4), top + ops.length * rowH + 18, fmt(xMax * g / 4, xMax < 4 ? 1 : 0), 'muted small');
      }
      v.label(left, 14, 'запросов в секунду, нужно выдержать', 'muted small', 'start');
      ops.forEach(function (o, i) {
        var y = top + i * rowH, val = rps(o), lim = limits[o.name], cls = lim && val > lim * 0.7 ? (val > lim ? 'danger' : 'warning') : 'response';
        var label = o.name;
        if (narrow) {
          var cut = function (t) { return t.length > 14 ? t.slice(0, 13) + '…' : t; };
          label = label.replace(/ \(.*\)/, ''); var parts = label.split(' ');
          if (parts.length > 1 && label.length > 12) { v.label(labelW, y + rowH / 2 - 1, cut(parts[0]), 'small', 'end'); v.label(labelW, y + rowH / 2 + 12, cut(parts.slice(1).join(' ')), 'small', 'end'); }
          else v.label(labelW, y + rowH / 2 + 5, cut(label), 'small', 'end');
        } else v.label(labelW, y + rowH / 2 + 5, label, 'small', 'end');
        v.add('rect', { x: left, y: y + 7, width: Math.max(1, (X(val) - left) * prog), height: rowH - 14, rx: 4, class: cls + ' fill', opacity: 0.85 });
        v.label(Math.max(X(val) * prog, left) + 6, y + rowH / 2 + 5, fmt(val * prog, val < 1 ? 2 : 1), 'small halo', 'start');
        if (lim) { v.add('line', { x1: X(lim), x2: X(lim), y1: y + 3, y2: y + rowH - 3, class: 'danger marker' }); }
      });
    }
    function describe() {
      var tot = total(), avg = sessions * ops.reduce(function (a, o) { return a + o.per; }, 0) / 3600;
      var text = 'В пиковый час <b>' + fmt(sessions, 0) + ' сессий</b>, одна сессия делает ' + fmt(ops.reduce(function (a, o) { return a + o.per; }, 0), 1) + ' запроса в среднем. Средний RPS часа: <b>' + fmt(avg, 1) + '</b>. Пик минуты выше среднего часа в <b>' + fmt(peak, 1) + '</b> раза, запас на рост <b>×' + fmt(growth, 1) + '</b>. Итого цель теста: <b>' + fmt(tot, 1) + ' RPS</b>.';
      var bad = ops.filter(function (o) { return limits[o.name] && rps(o) > limits[o.name] * 0.7; });
      if (bad.length) text += '<br><span class="danger"><b>' + esc(bad[0].name) + '</b></span>: нужно ' + fmt(rps(bad[0]), 1) + ' RPS при пределе ' + fmt(limits[bad[0].name], 0) + ' (красная черта). Выше 70% предела держать сервис нельзя, значит, этот маршрут придётся ускорять или разгружать до теста.';
      v.explain(text);
    }
    function change(setter) { return function (n) { setter(n); prog = 1; draw(); describe(); }; }
    v.slider('Сессий в пиковый час', Math.min(500, sessions), Math.max(8000, sessions), 100, sessions, change(function (n) { sessions = n; }), '');
    v.slider('Пик минуты к среднему часа', 1, Math.max(3, peak), 0.1, peak, change(function (n) { peak = n; }), '×');
    v.slider('Запас на рост', 1, Math.max(4, growth), 0.5, growth, change(function (n) { growth = n; }), '×');
    v.tryIt('подними запас на рост до ×3 и смотри, на каком маршруте первым появится красная черта предела. Наведи на любую строку: увидишь расчёт для неё.');
    var ctl = L.animate(v, function (dt) { prog = Math.min(1, prog + dt / 0.9); draw(); describe(); return prog < 1; }, function () { prog = 1; draw(); describe(); }, function () { prog = 0; });
    v.hover(function (e, q) {
      var i = Math.floor((q.y - geo.top) / geo.rowH);
      if (i < 0 || i >= ops.length) { v.hideTip(); return; }
      var o = ops[i], val = rps(o), perHour = sessions * o.per;
      v.showTip('<b>' + esc(o.name) + '</b><br>' + fmt(o.per, 2) + ' на сессию × ' + fmt(sessions, 0) + ' сессий = ' + fmt(perHour, 0) + ' в час = ' + fmt(perHour / 3600, 2) + ' в сек.<br>С пиком ×' + fmt(peak, 1) + ' и ростом ×' + fmt(growth, 1) + ': <b>' + fmt(val, 2) + ' RPS</b>' + (limits[o.name] ? '<br>Предел из теста: ' + fmt(limits[o.name], 0) + ' RPS' : ''), e.clientX, e.clientY);
    });
    draw(); describe(); v.onResize(draw);
  };
})();
