/* Виджеты темы 9 «Locust»: регистрируются через window.LTViz.
   Имена с префиксом locust-. Модели упрощены для объяснения, это не измерения учебного сервиса.

   locust-closed: закрытая модель: пользователи с паузой, от чего зависит RPS.
     data-users     виртуальных пользователей (1-400, по умолчанию 20)
     data-wait-min  пауза between(a, b), нижняя граница, секунд (0-5, по умолчанию 1)
     data-wait-max  пауза, верхняя граница, секунд (0-5, по умолчанию 3)
     data-resp      ответ сервера без нагрузки, мс (5-500, по умолчанию 80)
     data-cap       предел сервера, RPS (20-400, по умолчанию 150)
   locust-generator: генератор упёрся в процессор и искажает задержку.
     data-gen       сколько RPS тянет один процесс Locust (100-2000, по умолчанию 400)
     data-procs     процессов Locust, --processes (1-8, по умолчанию 1)
     data-server    предел сервера, RPS (200-3000, по умолчанию 1500)
   locust-omission: координированное упущение: что видит генератор и что видели бы люди.
     data-rate      запросов в секунду по плану (1-50, по умолчанию 10)
     data-stall     на сколько секунд сервер замирает (0-10, по умолчанию 5) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt;

  var css = [
    '.lc-lg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;font-size:.85rem;color:var(--muted)}',
    '.lc-lg span{display:inline-flex;align-items:center;gap:6px}',
    '.lc-lg i{display:inline-block;width:12px;height:6px;border-radius:2px;background:currentColor}',
    '.lc-lg .a{color:var(--red)}.lc-lg .b{color:var(--blue)}.lc-lg .c{color:var(--yellow)}.lc-lg .d{color:var(--muted)}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('locust-viz-style')) return;
    var s = document.createElement('style'); s.id = 'locust-viz-style'; s.textContent = css; document.head.appendChild(s);
  }
  function legend(v, items) {
    var d = html('div', undefined, 'lc-lg');
    items.forEach(function (it) { var s = html('span', undefined, it[0]); s.appendChild(html('i')); s.appendChild(document.createTextNode(it[1])); d.appendChild(s); });
    v.stage.parentNode.insertBefore(d, v.stage.nextSibling);
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function axes(v, left, right, top, bottom, yMax, yFmt) {
    for (var g = 0; g <= 4; g++) {
      var y = bottom - (bottom - top) * g / 4;
      v.add('line', { x1: left, x2: right, y1: y, y2: y, class: 'grid' });
      v.label(left - 6, y + 5, yFmt(yMax * g / 4), 'muted small', 'end');
    }
    v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
  }

  /* ---------- locust-closed ---------- */
  L.widgets['locust-closed'] = function (host) {
    injectStyle();
    var users = Math.round(num(host.dataset.users, 20, 1, 400)), wmin = num(host.dataset.waitMin, 1, 0, 5), wmax = num(host.dataset.waitMax, 3, 0, 5);
    var resp = num(host.dataset.resp, 80, 5, 500), cap = num(host.dataset.cap, 150, 20, 400);
    if (wmax < wmin) wmax = wmin;
    var LANES = 8, WINDOW = 10;
    var v = L.setup(host, host.dataset.title || 'Закрытая модель: пользователи, паузы и RPS');
    var clock, lanes, rand, geo = {}, hoverN = null;
    function lo() { return Math.min(wmin, wmax); }
    function hi() { return Math.max(wmin, wmax); }
    function avgWait() { return (lo() + hi()) / 2; }
    // Решаем «пользователей = RPS × (пауза + ответ)» с ответом, который растёт у предела (закон Литтла).
    function model(n) {
      var w = avgWait(), r0 = resp / 1000, xm = cap * 0.98;
      function R(x) { return r0 / (1 - x / cap); }
      function f(x) { return x * (w + R(x)); }
      if (f(xm) <= n) return { x: xm, r: Math.max(R(xm), n / xm - w), sat: true };
      var lo = 0, hi = xm;
      for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (f(mid) < n) lo = mid; else hi = mid; }
      return { x: hi, r: R(hi), sat: hi > cap * 0.85 };
    }
    function pause() { return lo() + (hi() - lo()) * rand(); }
    function reset() {
      rand = rng(5); clock = 0; lanes = [];
      var m = model(users);
      for (var i = 0; i < Math.min(users, LANES); i++) {
        // Пользователи стартуют не одновременно: Locust запускает их постепенно (spawn rate).
        var start = rand() * (avgWait() + m.r);
        lanes.push({ segs: [], kind: 'wait', from: 0, until: start });
      }
    }
    function advance(dt) {
      clock += dt; var r = model(users).r;
      lanes.forEach(function (ln) {
        while (ln.until <= clock) {
          ln.segs.push({ a: ln.from, b: ln.until, kind: ln.kind });
          ln.from = ln.until; ln.kind = ln.kind === 'wait' ? 'req' : 'wait';
          ln.until = ln.from + (ln.kind === 'req' ? r * (0.8 + 0.4 * rand()) : pause());
        }
        while (ln.segs.length && ln.segs[0].b < clock - WINDOW - 1) ln.segs.shift();
      });
    }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var laneTop = 26, laneH = 22, lanesBottom = laneTop + LANES * laneH, chTop = lanesBottom + 58, chBottom = chTop + 150, H = chBottom + 48;
      var W = v.canvas(H), left = narrow ? 40 : 52, right = W - 12;
      var m = model(users), r = m.r;
      var t1 = clock, t0 = clock - WINDOW;
      function TX(t) { return left + (t - t0) / WINDOW * (right - left); }
      v.label(left, 14, 'Пользователи (показано ' + Math.min(users, LANES) + ' из ' + users + '): ', 'muted small', 'start');
      v.add('rect', { x: left, y: laneTop - 4, width: right - left, height: LANES * laneH + 4, rx: 6, class: 'box' });
      lanes.forEach(function (ln, i) {
        var y = laneTop + i * laneH + 2, all = ln.segs.concat([{ a: ln.from, b: Math.min(ln.until, t1), kind: ln.kind }]);
        v.add('line', { x1: left, x2: right, y1: y + 7, y2: y + 7, class: 'grid' });
        all.forEach(function (s) {
          var a = Math.max(left, TX(s.a)), b = Math.min(right, TX(s.b));
          if (b <= left || a >= right || b < a) return;
          if (s.kind === 'req') v.add('rect', { x: a, y: y, width: Math.max(3, b - a), height: 14, rx: 2, class: (m.sat ? 'danger' : 'response') + ' fill' });
        });
      });
      v.label(right, lanesBottom + 20, narrow ? 'метка: запрос; пусто: пауза' : 'цветные метки: запрос идёт; пустое место: пользователь делает паузу', 'muted small', 'end');
      v.label((left + right) / 2, lanesBottom + 38, 'последние ' + WINDOW + ' секунд', 'muted small');
      // кривая RPS от числа пользователей
      var uMax = L.scale(Math.max(users * 1.25, cap * (avgWait() + resp / 1000) * 1.5, 20), true).max;
      var yMax = L.scale(cap * 1.15).max;
      function UX(n) { return left + n / uMax * (right - left); }
      function YY(x) { return chBottom - Math.min(x, yMax) / yMax * (chBottom - chTop); }
      geo = { left: left, right: right, uMax: uMax, chTop: chTop, chBottom: chBottom, laneTop: laneTop, laneH: laneH, t0: t0 };
      v.label(left, chTop - 12, 'RPS, который даёт такое число пользователей', 'muted small', 'start');
      axes(v, left, right, chTop, chBottom, yMax, function (n) { return fmt(n, 0); });
      v.add('line', { x1: left, x2: right, y1: YY(cap), y2: YY(cap), class: 'danger marker' });
      v.label(right - 4, YY(cap) - 6, 'предел сервера ' + fmt(cap, 0), 'danger halo small', 'end');
      var ideal = [], real = [];
      for (var i = 0; i <= 60; i++) { var n = uMax * i / 60; ideal.push(UX(n) + ',' + YY(n / (avgWait() + resp / 1000))); real.push(UX(n) + ',' + YY(model(n).x)); }
      v.add('polyline', { points: ideal.join(' '), class: 'muted ghost' });
      v.add('polyline', { points: real.join(' '), class: 'response stroke' });
      if (hoverN !== null) v.add('line', { x1: UX(hoverN), x2: UX(hoverN), y1: chTop, y2: chBottom, class: 'muted marker' });
      v.add('circle', { cx: UX(users), cy: YY(m.x), r: 7, class: (m.sat ? 'danger' : 'warning') + ' fill' });
      [0, uMax / 2, uMax].forEach(function (n) { v.label(UX(n), chBottom + 18, fmt(n, 0), 'muted small'); });
      v.label((left + right) / 2, chBottom + 38, 'виртуальных пользователей', 'muted small');
    }
    function describe() {
      var m = model(users), w = avgWait(), cycle = w + m.r;
      var text = 'У каждого пользователя цикл: запрос (<b>' + fmt(m.r * 1000, 0) + ' мс</b>) и пауза от ' + fmt(lo(), 1) + ' до ' + fmt(hi(), 1) + ' с, в среднем <b>' + fmt(w, 1) + ' с</b>. Цикл ' + fmt(cycle, 2) + ' с, значит один пользователь делает <b>' + fmt(1 / cycle, 2) + ' запроса в секунду</b>. ' +
        users + ' пользователей дают <b>' + fmt(m.x, 1) + ' RPS</b>.<br>';
      if (m.sat) text += '<span class="danger"><b>Сервер на пределе (' + fmt(cap, 0) + ' RPS).</b></span> RPS больше не растёт, зато растёт ответ: ' + fmt(m.r * 1000, 0) + ' мс вместо ' + fmt(resp, 0) + '. Лишние пользователи просто стоят в очереди.';
      else text += 'Сервер справляется (загрузка ' + fmt(m.x / cap * 100, 0) + '%): RPS растёт вместе с числом пользователей. Серая пунктирная линия это «идеал» без очередей, синяя это то, что получится с учётом растущего ответа.';
      v.explain(text);
    }
    function again() { reset(); if (ctl.reduced) still(); else { draw(); describe(); } }
    function still() { reset(); advance(WINDOW); draw(); describe(); }
    v.slider('Пользователей', 1, 400, 1, users, function (n) { users = Math.round(n); again(); }, '');
    v.slider('Пауза от', 0, 5, 0.5, wmin, function (n) { wmin = n; again(); }, 'с');
    v.slider('Пауза до', 0, 5, 0.5, wmax, function (n) { wmax = n; again(); }, 'с');
    v.slider('Ответ сервера без нагрузки', 5, 500, 5, resp, function (n) { resp = n; again(); }, 'мс');
    v.tryIt('поставь паузу от 0 до 0: каждый пользователь превращается в пулемёт и 10 пользователей уже упираются в предел. Потом верни паузу 1-3 с и добавляй пользователей. Наведи на график: увидишь RPS для любого числа пользователей.');
    reset();
    var ctl = L.animate(v, function (dt) { advance(dt); draw(); }, still, function () { reset(); });
    v.hover(function (e, q) {
      if (q.y < geo.chTop - 6) {
        var i = Math.floor((q.y - geo.laneTop) / geo.laneH);
        if (hoverN !== null) { hoverN = null; draw(); }
        if (i < 0 || i >= lanes.length) { v.hideTip(); return; }
        var t = geo.t0 + (q.x - geo.left) / (geo.right - geo.left) * WINDOW, ln = lanes[i];
        var all = ln.segs.concat([{ a: ln.from, b: ln.until, kind: ln.kind }]);
        var s = all.filter(function (x) { return x.a <= t && t <= x.b; })[0];
        v.showTip('<b>Пользователь ' + (i + 1) + '</b><br>' + (s ? (s.kind === 'req' ? 'ждёт ответа ' + fmt((s.b - s.a) * 1000, 0) + ' мс' : 'пауза ' + fmt(s.b - s.a, 1) + ' с') : 'здесь пусто'), e.clientX, e.clientY);
        return;
      }
      var n = Math.max(1, Math.min(geo.uMax, Math.round((q.x - geo.left) / (geo.right - geo.left) * geo.uMax)));
      hoverN = n; draw();
      var m = model(n);
      v.showTip('<b>' + n + ' пользователей</b><br>' + fmt(m.x, 1) + ' RPS, ответ ' + fmt(m.r * 1000, 0) + ' мс' + (m.sat ? '<br>сервер на пределе' : ''), e.clientX, e.clientY);
    }, function () { hoverN = null; draw(); });
    legend(v, [['b', 'запрос идёт, сервер справляется'], ['a', 'сервер на пределе'], ['d', 'серый пунктир: RPS без очередей']]);
    draw(); describe(); v.onResize(draw);
  };

  /* ---------- locust-generator ---------- */
  L.widgets['locust-generator'] = function (host) {
    injectStyle();
    var gen = num(host.dataset.gen, 400, 100, 2000), procs = Math.round(num(host.dataset.procs, 1, 1, 8)), server = num(host.dataset.server, 1500, 200, 3000);
    var X_MAX = 2400, SWEEP = 12;
    var v = L.setup(host, host.dataset.title || 'Генератор упёрся в процессор: что он показывает');
    var cursor = 0, hoverX = null, geo = {};
    function capGen() { return gen * procs; }
    // Возвращает то, что есть на самом деле при просьбе «дай x запросов в секунду».
    function at(x) {
      var G = capGen(), sent = Math.min(x, G), rhoG = x / G, rhoS = Math.min(sent / server, 0.97);
      var real = 5 / (1 - rhoS) + (sent > server ? (sent / server - 1) * 400 : 0);
      var extra = rhoG < 1 ? 2 / (1 - Math.min(rhoG, 0.98)) - 2 : 100 + (x / G - 1) * 900;
      var done = Math.min(sent, server * 0.97);
      return { sent: done, cpuG: Math.min(1, rhoG), cpuS: Math.min(1, sent / server), real: real, seen: real + extra, drop: x > done + 1 };
    }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var chTop = 30, chBottom = 230, barTop = chBottom + 62, H = barTop + 78;
      var W = v.canvas(H), left = narrow ? 42 : 54, right = W - 22;
      var yMax = 100;
      function XX(x) { return left + x / X_MAX * (right - left); }
      function YY(ms) { return chBottom - Math.min(ms, yMax) / yMax * (chBottom - chTop); }
      geo = { left: left, right: right };
      v.label(left, chTop - 12, 'задержка, мс (график обрезан на ' + yMax + ' мс)', 'muted small', 'start');
      axes(v, left, right, chTop, chBottom, yMax, function (n) { return fmt(n, 0); });
      v.add('rect', { x: XX(Math.min(X_MAX, capGen())), y: chTop, width: Math.max(0, right - XX(Math.min(X_MAX, capGen()))), height: chBottom - chTop, class: 'danger zone' });
      var a = [], b = [];
      for (var x = 0; x <= X_MAX; x += 20) { var p = at(x); if (x <= cursor + 1e-9) { a.push(XX(x) + ',' + YY(p.real)); b.push(XX(x) + ',' + YY(p.seen)); } }
      if (b.length > 1) { v.add('polyline', { points: b.join(' '), class: 'danger stroke' }); v.add('polyline', { points: a.join(' '), class: 'ok stroke' }); }
      [0, 600, 1200, 1800, 2400].forEach(function (x) { v.label(XX(x), chBottom + 18, fmt(x, 0), 'muted small'); });
      v.label((left + right) / 2, chBottom + 38, 'запрошено у генератора, RPS', 'muted small');
      if (cursor > 0) v.add('line', { x1: XX(cursor), x2: XX(cursor), y1: chTop, y2: chBottom, class: 'muted marker' });
      if (hoverX !== null) v.add('line', { x1: XX(hoverX), x2: XX(hoverX), y1: chTop, y2: chBottom, class: 'primary marker' });
      var cx = hoverX !== null ? hoverX : cursor, s = at(cx);
      function bar(y, name, k, cls) {
        v.label(left, y - 6, name + ': ' + fmt(k * 100, 0) + '%', 'small', 'start');
        v.add('rect', { x: left, y: y, width: right - left, height: 12, rx: 6, class: 'box' });
        v.add('rect', { x: left, y: y, width: Math.max(2, (right - left) * k), height: 12, rx: 6, class: cls + ' fill' });
      }
      bar(barTop + 12, 'процессор генератора (Locust)', s.cpuG, s.cpuG >= 0.9 ? 'danger' : 'response');
      bar(barTop + 52, 'процессор магазина', s.cpuS, s.cpuS >= 0.9 ? 'warning' : 'ok');
    }
    function describe() {
      var cx = hoverX !== null ? hoverX : cursor, s = at(cx), G = capGen();
      var text = 'Один процесс Locust тянет около <b>' + fmt(gen, 0) + ' RPS</b>, сейчас процессов <b>' + procs + '</b>, генератор вместе тянет <b>' + fmt(G, 0) + '</b>. Магазин (его предел <b>' + fmt(server, 0) + ' RPS</b>) в этой модели быстрый.<br>' +
        'При просьбе <b>' + fmt(cx, 0) + ' RPS</b> генератор загружен на <b>' + fmt(s.cpuG * 100, 0) + '%</b>, реально уходит <b>' + fmt(s.sent, 0) + ' RPS</b>. Магазин отвечает за <b>' + fmt(s.real, 0) + ' мс</b> (зелёная линия, её покажет Grafana), а Locust покажет <b>' + fmt(s.seen, 0) + ' мс</b> (красная).<br>';
      var genOver = cx > G, shopOver = Math.min(cx, G) >= server * 0.97;
      if (genOver && shopOver) text += '<span class="danger"><b>Перегружены оба:</b></span> и генератор, и магазин. Красная линия врёт сильнее зелёной. Сначала добавь процессов, потом смотри, где остановится рост.';
      else if (genOver) text += '<span class="danger"><b>Генератор перегружен:</b></span> запросы ждут в нём самом, и эту очередь Locust записывает как «медленный ответ сервера». Виноват не магазин. Плюс RPS меньше, чем ты просил.';
      else if (shopOver) text += '<b>Упёрся магазин:</b> генератор справляется (' + fmt(s.cpuG * 100, 0) + '%), красная и зелёная линии почти совпадают. Это настоящий предел магазина, ему и нужна починка.';
      else if (s.cpuG > 0.7) text += 'Генератор загружен выше 70%: красная линия уже оторвалась от зелёной. Данные начинают врать до того, как загорится 100%.';
      else text += 'Генератор в запасе, линии почти совпадают: Locust показывает то, что видит сервер.';
      v.explain(text);
    }
    function still() { cursor = X_MAX; draw(); describe(); }
    v.slider('Процессов Locust (--processes)', 1, 8, 1, procs, function (n) { procs = Math.round(n); draw(); describe(); }, '');
    v.slider('Сколько тянет один процесс', 100, 2000, 50, gen, function (n) { gen = n; draw(); describe(); }, 'RPS');
    v.tryIt('при одном процессе нагрузка 600 RPS уже искажает задержку. Увеличь процессы до 4: красная линия прижмётся к зелёной. Остановись мышью на любой нагрузке: полоски покажут процессор в этой точке.');
    var hold = 0;
    var ctl = L.animate(v, function (dt) {
      if (cursor >= X_MAX) { hold += dt; if (hold > 2.5) { hold = 0; cursor = 0; } draw(); describe(); return; }
      cursor = Math.min(X_MAX, cursor + dt * X_MAX / SWEEP); draw(); describe();
    }, still, function () { cursor = 0; });
    v.hover(function (e, q) {
      var x = Math.max(0, Math.min(X_MAX, Math.round((q.x - geo.left) / (geo.right - geo.left) * X_MAX / 20) * 20));
      hoverX = x; draw(); describe();
      var s = at(x);
      v.showTip('<b>Просишь ' + fmt(x, 0) + ' RPS</b><br>уходит ' + fmt(s.sent, 0) + ' RPS<br>магазин: ' + fmt(s.real, 0) + ' мс<br>Locust видит: ' + fmt(s.seen, 0) + ' мс<br>процессор генератора ' + fmt(s.cpuG * 100, 0) + '%', e.clientX, e.clientY);
    }, function () { hoverX = null; draw(); describe(); });
    legend(v, [['c', 'зелёная: что видит магазин (Grafana)'], ['a', 'красная: что показывает Locust'], ['a', 'розовая зона: генератор перегружен']]);
    draw(); describe(); v.onResize(draw);
  };

  /* ---------- locust-omission ---------- */
  L.widgets['locust-omission'] = function (host) {
    injectStyle();
    var rate = Math.round(num(host.dataset.rate, 10, 1, 50)), stall = num(host.dataset.stall, 5, 0, 10);
    var D = 30, S0 = 10, SWEEP = 14;
    var v = L.setup(host, host.dataset.title || 'Координированное упущение: куда деваются медленные запросы');
    var clock = 0, hoverT = null, data, geo = {};
    function pct(arr, p) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))] : 0; }
    function build() {
      var rand = rng(9), planned = [], seen = [], t, base = function () { return 0.012 + 0.016 * rand(); };
      var step = 1 / rate, end = S0 + stall;
      for (var k = 0; k * step < D; k++) {
        t = k * step; var lat = base();
        if (stall > 0 && t >= S0 && t < end) lat = end - t + lat;
        planned.push({ t: t, lat: lat });
      }
      t = 0;
      while (t < D) {
        var l = base();
        if (stall > 0 && t >= S0 && t < end) l = end - t + l;
        seen.push({ t: t, lat: l }); t += Math.max(step, l);
      }
      data = { planned: planned, seen: seen };
    }
    function stats(arr) {
      var l = arr.map(function (x) { return x.lat * 1000; });
      return { n: l.length, p50: pct(l, 0.5), p95: pct(l, 0.95), p99: pct(l, 0.99), max: Math.max.apply(null, l) };
    }
    function upTo(arr, t) { return arr.filter(function (x) { return x.t <= t; }); }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var top = 30, bottom = 220, H = bottom + 48, W = v.canvas(H), left = narrow ? 40 : 52, right = W - 12;
      var yMax = Math.max(1, Math.ceil(stall + 1));
      function TX(t) { return left + t / D * (right - left); }
      function YY(s) { return bottom - Math.min(s, yMax) / yMax * (bottom - top); }
      geo = { left: left, right: right };
      v.label(left, top - 12, 'сколько ждёт один запрос, секунд', 'muted small', 'start');
      axes(v, left, right, top, bottom, yMax, function (n) { return fmt(n, 1); });
      if (stall > 0) v.add('rect', { x: TX(S0), y: top, width: TX(S0 + stall) - TX(S0), height: bottom - top, class: 'warning zone' });
      if (stall > 0) v.label(TX(S0 + stall / 2), top + 14, 'сервер завис', 'warning small');
      var shown = upTo(data.planned, clock);
      shown.forEach(function (p) { v.add('circle', { cx: TX(p.t), cy: YY(p.lat), r: 3.5, class: 'danger fill', opacity: 0.8 }); });
      upTo(data.seen, clock).forEach(function (p) { v.add('circle', { cx: TX(p.t), cy: YY(p.lat), r: 4.5, class: 'response fill' }); });
      [0, 10, 20, 30].forEach(function (t) { v.label(TX(t), bottom + 18, String(t), 'muted small'); });
      v.label((left + right) / 2, bottom + 38, 'время теста, секунд', 'muted small');
      if (clock > 0 && clock < D) v.add('line', { x1: TX(clock), x2: TX(clock), y1: top, y2: bottom, class: 'muted marker' });
      if (hoverT !== null) v.add('line', { x1: TX(hoverT), x2: TX(hoverT), y1: top, y2: bottom, class: 'primary marker' });
    }
    function describe() {
      var a = stats(upTo(data.seen, clock)), b = stats(upTo(data.planned, clock));
      var text = 'План: <b>' + rate + ' запросов в секунду</b>. На ' + S0 + '-й секунде сервер замирает на <b>' + fmt(stall, 1) + ' с</b>. Закрытый генератор (Locust с паузами) шлёт следующий запрос только после ответа, поэтому за время зависания отправляет <b>один</b> запрос: он честно записывает ' + fmt(stall, 1) + ' с, а остальные запросы, которые должны были уйти по расписанию, не отправляются.<br>' +
        '<b>Locust покажет</b> (синие точки): запросов ' + a.n + ', p50 ' + fmt(a.p50, 0) + ' мс, p95 ' + fmt(a.p95, 0) + ' мс, p99 ' + fmt(a.p99, 0) + ' мс, макс ' + fmt(a.max, 0) + ' мс.<br>' +
        '<b>Увидели бы люди</b> (красные точки, каждый пришёл по расписанию): запросов ' + b.n + ', p50 ' + fmt(b.p50, 0) + ' мс, p95 ' + fmt(b.p95, 0) + ' мс, p99 ' + fmt(b.p99, 0) + ' мс, макс ' + fmt(b.max, 0) + ' мс.';
      if (stall > 0 && clock > S0 + stall) text += '<br>Разница в p99 это и есть координированное упущение: генератор подстроился под медленный сервер и «не заметил» большую часть пострадавших.';
      v.explain(text);
    }
    function still() { clock = D; draw(); describe(); }
    v.slider('Запросов в секунду по плану', 1, 50, 1, rate, function (n) { rate = Math.round(n); build(); clock = ctl.reduced ? D : 0; draw(); describe(); }, '');
    v.slider('Сервер замирает на', 0, 10, 0.5, stall, function (n) { stall = n; build(); clock = ctl.reduced ? D : 0; draw(); describe(); }, 'с');
    v.tryIt('поставь замирание 5 с и дождись конца: у Locust p99 останется около 30 мс, хотя сервер подвёл сотни «покупателей». Убери замирание, и два набора точек совпадут. Наведи на график, чтобы сравнить, кто что видел.');
    var hold = 0;
    build();
    var ctl = L.animate(v, function (dt) {
      if (clock >= D) { hold += dt; if (hold > 2.5) { hold = 0; clock = 0; } draw(); describe(); return; }
      clock = Math.min(D, clock + dt * D / SWEEP); draw(); describe();
    }, still, function () { clock = 0; });
    v.hover(function (e, q) {
      var t = Math.max(0, Math.min(D, (q.x - geo.left) / (geo.right - geo.left) * D));
      hoverT = t; draw();
      function near(arr) { var best = null; arr.forEach(function (p) { if (p.t <= clock && (!best || Math.abs(p.t - t) < Math.abs(best.t - t))) best = p; }); return best; }
      var p = near(data.planned), s = near(data.seen);
      v.showTip('<b>' + fmt(t, 1) + ' с от начала</b><br>' + (p ? 'по плану ближайший запрос: ' + fmt(p.lat * 1000, 0) + ' мс' : 'сюда показ ещё не дошёл') + '<br>' + (s ? 'у Locust ближайший: ' + fmt(s.lat * 1000, 0) + ' мс (в ' + fmt(s.t, 1) + ' с)' : ''), e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    legend(v, [['b', 'синие: что записал Locust'], ['a', 'красные: что получили бы пришедшие по расписанию'], ['c', 'жёлтая зона: сервер завис']]);
    draw(); describe(); v.onResize(draw);
  };
})();
