/* Виджеты темы 7 «Метрики, логи и алерты»: регистрируются через window.LTViz. Префикс obs-.

   obs-scrape: pull-модель. Prometheus раз в N секунд снимает «снимок» метрик. Счётчик не теряет
    события между снимками, gauge теряет пики.
     data-interval  интервал скрейпа в секундах (по умолчанию 15)
   obs-rate: счётчик ступеньками и функции rate, irate по окну.
     data-window    окно в секундах (по умолчанию 30), скрейп каждые 5 с
   obs-quantile: как histogram_quantile получает перцентиль из бакетов.
     data-slow      доля медленных запросов, % (по умолчанию 5)
     data-q         квантиль, % (по умолчанию 95)
   obs-dashboard: четыре панели RED/USE во время нагрузочного теста с общим перекрестием.
     data-scenario  ok | pool | payment (по умолчанию ok) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt, scale = L.scale;

  var st = document.createElement('style');
  st.textContent = '.obsv-on{border-color:var(--accent-ink)!important;font-weight:700}';
  document.head.appendChild(st);

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  // Оси панели: возвращает функции пересчёта данных в пиксели.
  function panel(v, box, xmax, ymax, title, ylab, ticks) {
    var X = function (t) { return box.l + t / xmax * (box.r - box.l); };
    var Y = function (n) { return box.b - n / ymax * (box.b - box.t); };
    (ticks || [0, 0.5, 1].map(function (k) { return ymax * k; })).forEach(function (val) {
      v.add('line', { x1: box.l, x2: box.r, y1: Y(val), y2: Y(val), class: 'grid' });
      v.label(box.l - 6, Y(val) + 4, fmt(val, val < 10 && val % 1 ? 1 : 0), 'muted small', 'end');
    });
    v.add('path', { d: 'M' + box.l + ' ' + box.t + 'V' + box.b + 'H' + box.r, class: 'axis' });
    v.label(box.l, box.t - 8, title + (ylab ? ', ' + ylab : ''), 'small', 'start');
    return { X: X, Y: Y };
  }
  function xTicks(v, p, box, xmax, step, y) {
    for (var t = 0; t <= xmax; t += step) v.label(p.X(t), y, String(t), 'muted small', t === 0 ? 'start' : t === xmax ? 'end' : 'middle');
  }
  function line(v, p, pts, cls, extra) {
    if (pts.length < 2) return;
    var a = { points: pts.map(function (q) { return p.X(q[0]).toFixed(1) + ',' + p.Y(q[1]).toFixed(1); }).join(' '), class: cls + ' stroke' };
    if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
    v.add('polyline', a);
  }

  /* ---------- 7.1: скрейп, счётчик и gauge ---------- */
  L.widgets['obs-scrape'] = function (host) {
    var DUR = 60, interval = num(host.dataset.interval, 15, 1, 30), now = 0, hold = 0, pin = null;
    var v = L.setup(host, host.dataset.title || 'Prometheus снимает метрики раз в N секунд');
    function rate(t) { return 20 + (t >= 24 && t < 28 ? 80 : 0); }
    function counter(t) { return 20 * t + 80 * clamp(t - 24, 0, 4); }
    function gauge(t) {
      var trap = clamp(t - 24, 0, 1) - clamp(t - 27, 0, 1);
      return 2 + 0.6 * Math.sin(t * 1.3) + 14 * trap;
    }
    function scrapes(upto) { var a = []; for (var t = 0; t <= upto + 1e-9; t += interval) a.push(t); return a; }
    function draw() {
      var H = 372, W = v.canvas(H), l = 52, r = W - 12;
      var A = { l: l, r: r, t: 26, b: 150 }, B = { l: l, r: r, t: 214, b: 322 };
      var cur = pin == null ? now : Math.min(pin, now), sc = scrapes(now);
      var pa = panel(v, A, DUR, 1600, 'http_requests_total', 'штук', [0, 800, 1600]);
      var pb = panel(v, B, DUR, 20, 'http_requests_in_progress', 'в работе', [0, 10, 20]);
      xTicks(v, pb, B, DUR, 10, B.b + 20); v.label((l + r) / 2, H - 6, 'время, секунды', 'muted small');
      var ta = [], tb = [], tt;
      for (tt = 0; tt <= now + 1e-9; tt += 0.25) { ta.push([tt, counter(tt)]); tb.push([tt, gauge(tt)]); }
      line(v, pa, ta, 'muted', { 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
      line(v, pb, tb, 'muted', { 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
      line(v, pa, sc.map(function (t) { return [t, counter(t)]; }), 'primary');
      line(v, pb, sc.map(function (t) { return [t, gauge(t)]; }), 'response');
      sc.forEach(function (t) {
        v.add('circle', { cx: pa.X(t), cy: pa.Y(counter(t)), r: 5, class: 'primary fill' });
        v.add('circle', { cx: pb.X(t), cy: pb.Y(gauge(t)), r: 5, class: 'response fill' });
      });
      if (now >= 24) v.add('rect', { x: pb.X(24), y: B.t, width: pb.X(28) - pb.X(24), height: B.b - B.t, class: 'danger zone' });
      if (now >= 24) v.label(pb.X(26), B.t + 14, 'всплеск', 'danger small');
      v.add('line', { x1: pa.X(cur), x2: pa.X(cur), y1: A.t, y2: A.b, class: 'muted marker' });
      v.add('line', { x1: pb.X(cur), x2: pb.X(cur), y1: B.t, y2: B.b, class: 'muted marker' });
      v.label(r, A.t + 14, 'пунктир: что было на самом деле', 'muted small', 'end');
      v.label(r, A.t + 30, 'точки: что увидел Prometheus', 'primary small', 'end');
      info(sc);
      return { pa: pa, A: A, B: B };
    }
    var geo = null;
    function info(sc) {
      var seen = sc.length ? Math.max.apply(null, sc.map(gauge)) : 0, real = 0, t;
      for (t = 0; t <= now; t += 0.25) real = Math.max(real, gauge(t));
      var s = '<b>Скрейп каждые ' + interval + ' с</b>: к секунде ' + fmt(now, 0) + ' набралось ' + sc.length + ' ' + L.plural(sc.length, 'замер', 'замера', 'замеров') + '. ';
      if (now < 24) s += 'Пока всё спокойно: нагрузка 20 запросов в секунду, в работе 2–3 запроса.';
      else {
        s += 'На секундах 24–28 был всплеск: 100 запросов в секунду и до ' + fmt(real, 0) + ' запросов в работе одновременно. ';
        s += seen >= 10 ? 'Замер попал в всплеск, и gauge его показал (максимум ' + fmt(seen, 0) + ').'
          : '<b>Ни один замер в всплеск не попал</b>: gauge показывает максимум ' + fmt(seen, 0) + ', как будто ничего не было. ';
        if (sc.length > 1) {
          var a = sc[sc.length - 2], b = sc[sc.length - 1];
          s += 'А счётчик ничего не потерял: между замерами ' + a + ' и ' + b + ' он вырос с ' + fmt(counter(a), 0) + ' до ' + fmt(counter(b), 0) + ', это ' + fmt((counter(b) - counter(a)) / (b - a), 0) + ' запросов в секунду в среднем.';
        }
      }
      v.explain(s);
    }
    function still() { now = DUR; geo = draw(); }
    function tick(dt) {
      if (hold > 0) { hold -= dt; if (hold <= 0) now = 0; geo = draw(); return; }
      now = Math.min(DUR, now + dt * 9); geo = draw();
      if (now >= DUR) hold = 2.5;
    }
    v.slider('Интервал скрейпа', 1, 30, 1, interval, function (n) { interval = n; geo = draw(); }, 'с');
    v.hover(function (e, q) {
      if (!geo) return;
      var t = clamp((q.x - geo.A.l) / (geo.A.r - geo.A.l) * DUR, 0, Math.max(now, 0.01));
      pin = t; geo = draw();
      var sc = scrapes(now).filter(function (s) { return s <= t; }), last = sc.length ? sc[sc.length - 1] : 0;
      v.showTip('<b>t = ' + fmt(t, 1) + ' с</b><br>Запросов всего: <b>' + fmt(counter(t), 0) + '</b><br>В работе: <b>' + fmt(gauge(t), 1) +
        '</b><br>Последний замер: ' + last + ' с<br>Prometheus помнит: счётчик ' + fmt(counter(last), 0) + ', gauge ' + fmt(gauge(last), 1), e.clientX, e.clientY);
    }, function () { pin = null; geo = draw(); });
    v.tryIt('подними интервал до 30 секунд: линия gauge почти не похожа на правду, а счётчик по-прежнему точен. Потом опусти до 2 секунд: всплеск виден, но замеров в 7 раз больше. Наведи мышь на любую точку графика.');
    now = 0; geo = draw(); v.onResize(function () { geo = draw(); }); L.animate(v, tick, still, function () { now = 0; hold = 0; });
  };

  /* ---------- 7.2: rate, irate, increase по окну ---------- */
  L.widgets['obs-rate'] = function (host) {
    var DUR = 180, STEP = 5, win = num(host.dataset.window, 30, 5, 120), now = 0, hold = 0, pin = null, showIrate = false;
    var v = L.setup(host, host.dataset.title || 'Счётчик и rate: что считает окно');
    var rnd = rng(7), samples = [], c = 0, i, t, rps;
    function trueRate(t) { return t < 60 ? 20 : t < 120 ? 60 : 30; }
    for (i = 0; i <= DUR / STEP; i++) {
      t = i * STEP; rps = trueRate(t - STEP / 2);
      if (t === 140) c = 0;                      // перезапуск сервиса: счётчик обнулился
      else if (i > 0) c += Math.round(rps * STEP * (0.75 + 0.5 * rnd()));
      samples.push({ t: t, v: c });
    }
    function inWin(tt, w) { return samples.filter(function (s) { return s.t > tt - w && s.t <= tt; }); }
    function incr(pts) {
      var s = 0, k; for (k = 1; k < pts.length; k++) s += pts[k].v >= pts[k - 1].v ? pts[k].v - pts[k - 1].v : pts[k].v;
      return s;
    }
    function rateAt(tt, w) { var p = inWin(tt, w); return p.length < 2 ? null : incr(p) / (p[p.length - 1].t - p[0].t); }
    function irateAt(tt) {
      var p = inWin(tt, win); if (p.length < 2) return null;
      var a = p[p.length - 2], b = p[p.length - 1];
      return (b.v >= a.v ? b.v - a.v : b.v) / (b.t - a.t);
    }
    var geo = null;
    function draw() {
      var H = 372, W = v.canvas(H), l = 52, r = W - 12, A = { l: l, r: r, t: 26, b: 150 }, B = { l: l, r: r, t: 214, b: 322 };
      var cur = pin == null ? now : Math.min(pin, now);
      var maxV = Math.max.apply(null, samples.map(function (s) { return s.v; })), sa = scale(maxV);
      var pa = panel(v, A, DUR, sa.max, 'http_requests_total', 'штук', [0, sa.max / 2, sa.max]);
      var pb = panel(v, B, DUR, 80, 'rate(...[' + win + 's])', 'запросов в с', [0, 20, 40, 60, 80]);
      xTicks(v, pb, B, DUR, 20, B.b + 20); v.label((l + r) / 2, H - 6, 'время, секунды', 'muted small');
      var lo = Math.max(0, cur - win);
      v.add('rect', { x: pa.X(lo), y: A.t, width: pa.X(cur) - pa.X(lo), height: A.b - A.t, class: 'primary zone' });
      v.add('rect', { x: pb.X(lo), y: B.t, width: pb.X(cur) - pb.X(lo), height: B.b - B.t, class: 'primary zone' });
      var tr = []; for (t = 0; t <= DUR; t += 1) tr.push([t, trueRate(t)]);
      line(v, pb, tr, 'muted', { 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
      var seen = samples.filter(function (s) { return s.t <= now; });
      line(v, pa, seen.map(function (s) { return [s.t, s.v]; }), 'primary');
      seen.forEach(function (s) { v.add('circle', { cx: pa.X(s.t), cy: pa.Y(s.v), r: 3, class: 'primary fill' }); });
      var rr = [], ir = [];
      seen.forEach(function (s) { var x = rateAt(s.t, win), y = irateAt(s.t); if (x != null) rr.push([s.t, x]); if (y != null) ir.push([s.t, Math.min(y, 80)]); });
      if (showIrate) line(v, pb, ir, 'warning', { 'stroke-width': 2 });
      line(v, pb, rr, 'response');
      if (cur > 0) { v.add('line', { x1: pa.X(cur), x2: pa.X(cur), y1: A.t, y2: A.b, class: 'muted marker' }); v.add('line', { x1: pb.X(cur), x2: pb.X(cur), y1: B.t, y2: B.b, class: 'muted marker' }); }
      if (W < 520) { v.label(r, B.t + 12, 'синяя: rate, пунктир: нагрузка', 'muted small', 'end'); if (showIrate) v.label(r, B.t + 26, 'жёлтая: irate', 'muted small', 'end'); }
      else v.label(r, B.t + 14, 'синяя: rate, пунктир: настоящая нагрузка' + (showIrate ? ', жёлтая: irate' : ''), 'muted small', 'end');
      if (now >= 140) v.label(pa.X(140) + 6, A.t + 14, 'перезапуск', 'danger small', 'start');
      geo = { A: A, pa: pa };
      info(cur);
    }
    function info(cur) {
      var p = inWin(cur, win), rt = rateAt(cur, win), s;
      s = '<b>Окно ' + win + ' с, момент ' + fmt(cur, 0) + ' с.</b> В окне ' + p.length + ' ' + L.plural(p.length, 'замер', 'замера', 'замеров') + ' (скрейп раз в ' + STEP + ' с). ';
      if (rt == null) s += 'Нужно минимум два замера, поэтому <b>rate ничего не показывает</b>: окно слишком короткое. Правило: окно не меньше четырёх интервалов скрейпа.';
      else {
        s += 'Счётчик вырос на ' + fmt(incr(p), 0) + ' запросов за ' + fmt(p[p.length - 1].t - p[0].t, 0) + ' с, значит <b>rate = ' + fmt(rt, 1) + ' запросов в секунду</b>. Настоящая нагрузка сейчас ' + trueRate(cur) + '.';
        if (showIrate) s += ' irate смотрит только на два последних замера: ' + fmt(irateAt(cur), 1) + '.';
        if (p.some(function (q, k) { return k > 0 && q.v < p[k - 1].v; })) s += ' В окне счётчик обнулился (перезапуск): rate это замечает и считает рост заново, а не уходит в минус.';
      }
      v.explain(s);
    }
    function still() { now = DUR; draw(); }
    function tick(dt) {
      if (hold > 0) { hold -= dt; if (hold <= 0) now = 0; draw(); return; }
      now = Math.min(DUR, now + dt * 30); draw();
      if (now >= DUR) hold = 2.5;
    }
    v.slider('Окно rate', 5, 120, 5, win, function (n) { win = n; draw(); }, 'с');
    var b = v.button('Показать ещё и irate', function () { showIrate = !showIrate; b.textContent = showIrate ? 'Скрыть irate' : 'Показать ещё и irate'; draw(); });
    v.hover(function (e, q) {
      if (!geo) return;
      pin = clamp((q.x - geo.A.l) / (geo.A.r - geo.A.l) * DUR, 0, Math.max(now, 1)); draw();
      var tt = pin, last = samples.filter(function (s) { return s.t <= tt; }).pop(), rt = rateAt(tt, win);
      v.showTip('<b>t = ' + fmt(tt, 0) + ' с</b><br>Счётчик: <b>' + fmt(last.v, 0) + '</b><br>rate: <b>' + (rt == null ? 'нет данных' : fmt(rt, 1) + ' в с') +
        '</b><br>настоящая нагрузка: ' + trueRate(tt) + ' в с', e.clientX, e.clientY);
    }, function () { pin = null; draw(); });
    v.tryIt('поставь окно 5 секунд: линия пропадёт, замеров в окне меньше двух. Окно 10: линия дёргается. Окно 120: гладкая, но запаздывает за скачком с 20 до 60. Включи irate и найди момент, где он прыгает сильнее rate.');
    draw(); v.onResize(draw); L.animate(v, tick, still, function () { now = 0; hold = 0; });
  };

  /* ---------- 7.2: histogram_quantile по бакетам ---------- */
  L.widgets['obs-quantile'] = function (host) {
    var LE = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], N = 2000;
    var slow = num(host.dataset.slow, 5, 0, 20), q = num(host.dataset.q, 95, 50, 99), shown = 0, acc = 0, pin = -1;
    var v = L.setup(host, host.dataset.title || 'Как из бакетов получается p95');
    var base = [], k, rnd = rng(11), z;
    function gauss() { var a = rnd() || 1e-9, b = rnd(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); }
    // Для каждого запроса заранее: «быстрый» ли он, и случайные числа. Ползунок меняет только порог.
    for (k = 0; k < N; k++) base.push({ u: rnd(), fast: Math.exp(Math.log(0.06) + 0.55 * gauss()), slow: Math.exp(Math.log(0.8) + 0.35 * gauss()) });
    var data = [];
    function build() { data = base.map(function (b) { return b.u < slow / 100 ? b.slow : b.fast; }); }
    build();
    function stats(n) {
      var cum = LE.map(function () { return 0; }), srt = data.slice(0, n).sort(function (a, b) { return a - b; });
      srt.forEach(function (x) { for (var j = 0; j < LE.length; j++) if (x <= LE[j]) cum[j]++; });
      var rank = q / 100 * n, j = 0, est = null;
      while (j < LE.length && cum[j] < rank) j++;
      if (n > 0) {
        if (j >= LE.length) est = LE[LE.length - 1];
        else { var lo = j ? LE[j - 1] : 0, c0 = j ? cum[j - 1] : 0; est = lo + (LE[j] - lo) * (rank - c0) / Math.max(1, cum[j] - c0); }
      }
      return { cum: cum, rank: rank, j: j, est: est, truth: n ? srt[Math.min(n - 1, Math.ceil(rank) - 1)] : null };
    }
    var geo = null;
    function draw() {
      var H = 330, W = v.canvas(H), l = 50, r = W - 10, top = 28, bottom = 262, S = stats(shown), n = LE.length + 1;
      var sc = scale(Math.max(N, 10)), Y = function (c) { return bottom - c / sc.max * (bottom - top); };
      var band = (r - l) / n, X = function (i) { return l + (i + 0.5) * band; };
      sc.ticks.forEach(function (tk) { v.add('line', { x1: l, x2: r, y1: Y(tk), y2: Y(tk), class: 'grid' }); v.label(l - 6, Y(tk) + 4, fmt(tk, 0), 'muted small', 'end'); });
      v.add('path', { d: 'M' + l + ' ' + top + 'V' + bottom + 'H' + r, class: 'axis' });
      v.label(l, top - 10, 'счётчик каждого бакета (le), штук', 'small', 'start');
      if (pin >= 0) v.add('rect', { x: l + pin * band, y: top, width: band, height: bottom - top, class: 'band' });
      var step = band < 36 ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var c = i < LE.length ? S.cum[i] : shown, hot = i === S.j;
        v.add('rect', { x: X(i) - band * 0.36, y: Y(c), width: band * 0.72, height: Math.max(0, bottom - Y(c)), rx: 3, class: (hot ? 'warning' : 'response') + ' fill' });
        if (i % step === 0 || i === n - 1) v.label(X(i), bottom + 18, i < LE.length ? String(LE[i]) : '+Inf', 'muted small');
      }
      v.label((l + r) / 2, H - 22, 'le: верхняя граница бакета, секунды', 'muted small');
      var yr = Y(S.rank);
      v.add('line', { x1: l, x2: r, y1: yr, y2: yr, class: 'danger marker' });
      v.label(r, yr - 6, 'p' + q + ': ' + fmt(S.rank, 0) + ' из ' + shown, 'danger small', 'end');
      geo = { l: l, band: band, n: n, S: S };
      info(S);
    }
    function info(S) {
      if (!shown) return v.explain('Запросы ещё не пришли.');
      var j = S.j, lo = j ? LE[j - 1] : 0, s;
      s = '<b>Пришло ' + shown + ' запросов.</b> Чтобы найти p' + q + ', нужен запрос под номером ' + fmt(S.rank, 0) + ' по возрастанию. ';
      if (j >= LE.length) return v.explain(s + 'Он медленнее 10 секунд: самый большой бакет, и Prometheus вернёт просто 10 с.');
      s += 'Первый бакет, где накоплено не меньше этого числа: <b>le=' + LE[j] + '</b> (жёлтый), в него попадают запросы от ' + lo + ' до ' + LE[j] + ' с. ';
      s += 'Внутри бакета Prometheus не знает, где лежат запросы, и считает, что равномерно. Получается <b>' + fmt(S.est * 1000, 0) + ' мс</b>. По-настоящему p' + q + ' равен <b>' + fmt(S.truth * 1000, 0) + ' мс</b>. ';
      var d = Math.abs(S.est - S.truth) / S.truth;
      s += d < 0.1 ? 'Ошибка небольшая: бакет узкий.' : 'Расхождение ' + Math.round(d * 100) + '%: бакет широкий, а запросы в нём лежат неравномерно.';
      v.explain(s);
    }
    var ctl;
    function still() { acc = shown = N; draw(); }
    function tick(dt) { acc = Math.min(N, acc + dt * 330); shown = Math.floor(acc); draw(); if (shown >= N) return false; }
    v.slider('Доля медленных запросов', 0, 20, 1, slow, function (n) { slow = n; build(); draw(); }, '%');
    v.slider('Перцентиль', 50, 99, 1, q, function (n) { q = n; draw(); }, '%');
    v.hover(function (e, p) {
      if (!geo) return;
      pin = clamp(Math.floor((p.x - geo.l) / geo.band), 0, geo.n - 1); draw();
      var c = pin < LE.length ? geo.S.cum[pin] : shown, prev = pin === 0 ? 0 : pin < LE.length ? geo.S.cum[pin - 1] : geo.S.cum[LE.length - 1];
      v.showTip('<b>' + (pin < LE.length ? 'le="' + LE[pin] + '"' : 'le="+Inf"') + '</b><br>всего не медленнее: <b>' + c + '</b><br>именно в этом диапазоне: <b>' + (c - prev) + '</b>', e.clientX, e.clientY);
    }, function () { pin = -1; draw(); });
    v.tryIt('подними долю медленных до 15%: растёт p95, и жёлтый столбик переезжает к большим бакетам. Поставь перцентиль 99 и сравни оценку с настоящим числом: чем шире бакет, тем грубее оценка. Наведи мышь на любой столбик.');
    draw(); v.onResize(draw); ctl = L.animate(v, tick, still, function () { acc = shown = 0; });
  };

  /* ---------- 7.3: четыре панели во время нагрузочного теста ---------- */
  L.widgets['obs-dashboard'] = function (host) {
    var DUR = 300, scen = host.dataset.scenario || 'ok', now = 0, hold = 0, pin = null, ctl;
    var v = L.setup(host, host.dataset.title || 'Дашборд во время ступенчатого теста');
    if (['ok', 'pool', 'payment'].indexOf(scen) < 0) scen = 'ok';
    var NAMES = { ok: 'Всё в порядке', pool: 'Упёрлись в пул БД', payment: 'Медленная оплата' };
    var TEXT = {
      ok: 'Нагрузка растёт, RPS идёт за ней, p95 почти не меняется, ошибок нет, запросов в работе немного. Это эталон: с ним сравнивай остальное.',
      pool: 'С секунды ~140 RPS перестал расти и лёг на потолок (около 100), хотя нагрузка идёт вверх: сервис насытился. Сразу за этим p95 пошёл «клюшкой», а очередь за соединениями (<code>shop_db_pool_waiting</code>) стала расти. Когда ожидание дошло до таймаута, появились ошибки 5xx.',
      payment: 'С секунды 100 p95 прыгнул ступенькой до ~2 с, RPS почти не изменился, зато запросов в работе стало больше: они стоят и ждут оплату. Позже заняты все соединения пула, начинают расти очередь и ошибки. Причина снаружи магазина, и по первым двум графикам этого не видно: надо идти дальше, к графику оплаты.'
    };
    function ramp(t) { return 10 + 190 * t / DUR; }
    function sm(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    var S = {};
    function gen(sc) {
      var rnd = rng(sc.length * 31 + 5), o = { rps: [], p95: [], err: [], run: [], wait: [] }, t, a, rps, p95, err, run, wait, t0 = (100 - 10) / 190 * DUR;
      for (t = 0; t <= DUR; t++) {
        a = ramp(t); rps = a; p95 = 40 + 12 * Math.pow(a / 200, 2); err = 0; run = a * 0.045 + 1; wait = 0;
        if (sc === 'pool') {
          rps = Math.min(a, 100); if (a > 100) { p95 = Math.min(5000, 52 + (t - t0) * 70); wait = Math.min(60, (t - t0) * 0.9); run += wait; }
          if (t > 213) err = Math.min(30, (t - 213) * 0.6);
        } else if (sc === 'payment') {
          var k = sm((t - 100) / 6); rps = a * (1 - 0.1 * k); p95 += 1950 * k; run += 35 * k;
          if (t > 160) { wait = Math.min(40, (t - 160) * 0.7); p95 = Math.min(5000, p95 + wait * 40); run += wait; }
          if (t > 230) err = Math.min(10, (t - 230) * 0.3);
        }
        o.rps.push(Math.max(0, rps * (1 + 0.03 * (rnd() - 0.5))));
        o.p95.push(p95 * (1 + 0.06 * (rnd() - 0.5))); o.err.push(Math.max(0, err * (1 + 0.1 * (rnd() - 0.5)))); o.run.push(run + rnd()); o.wait.push(wait);
      }
      return o;
    }
    ['ok', 'pool', 'payment'].forEach(function (k) { S[k] = gen(k); });
    var geo = null;
    function draw() {
      var Wd = v.canvas(10) , wide = Wd >= 560, ph = wide ? 138 : 108, gap = 44;
      var H = wide ? 2 * (ph + gap) + 24 : 4 * (ph + gap) + 10, W = v.canvas(H);
      var cw = wide ? (W - 24) / 2 : W - 4, d = S[scen], cur = pin == null ? now : Math.min(pin, now), boxes = [], pans = [];
      var defs = [
        { title: 'Rate: запросов в секунду', ymax: 250, ticks: [0, 100, 200], series: [{ a: d.rps, c: 'primary' }], ref: function (t) { return ramp(t); } },
        { title: 'Duration: p95, мс', ymax: 5000, ticks: [0, 2500, 5000], series: [{ a: d.p95, c: 'response' }] },
        { title: 'Errors: доля 5xx, %', ymax: 30, ticks: [0, 15, 30], series: [{ a: d.err, c: 'danger' }] },
        { title: 'Saturation: в работе и ждут пул', ymax: 100, ticks: [0, 50, 100], series: [{ a: d.run, c: 'warning' }, { a: d.wait, c: 'violet' }] }
      ];
      defs.forEach(function (df, i) {
        var col = wide ? i % 2 : 0, row = wide ? Math.floor(i / 2) : i;
        var b = { l: (wide ? col * (cw + 24) : 0) + 40, r: (wide ? col * (cw + 24) : 0) + cw - 4, t: row * (ph + gap) + 22, b: row * (ph + gap) + 22 + ph };
        var p = panel(v, b, DUR, df.ymax, df.title, '', df.ticks);
        for (var tx = 0; tx <= DUR; tx += 100) v.label(p.X(tx), b.b + 16, String(tx), 'muted small', tx === 0 ? 'start' : tx === DUR ? 'end' : 'middle');
        if (df.ref) { var rp = []; for (var u = 0; u <= DUR; u += 5) rp.push([u, df.ref(u)]); line(v, p, rp, 'muted', { 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }); }
        df.series.forEach(function (s) {
          var pts = []; for (var u = 0; u <= now; u++) pts.push([u, Math.min(s.a[u], df.ymax)]); line(v, p, pts, s.c);
        });
        v.add('line', { x1: p.X(cur), x2: p.X(cur), y1: b.t, y2: b.b, class: 'muted marker' });
        boxes.push(b); pans.push(p);
      });
      geo = { boxes: boxes, pans: pans, wide: wide, H: H };
      v.label(W - 4, H - 4, 'время теста, секунды', 'muted small', 'end');
      info();
    }
    function info() {
      v.explain('<b>' + NAMES[scen] + '.</b> ' + TEXT[scen] + ' Пунктир на первой панели: сколько запросов в секунду хочет послать генератор.');
    }
    function still() { now = DUR; draw(); }
    function tick(dt) {
      if (hold > 0) { hold -= dt; if (hold <= 0) now = 0; draw(); return; }
      now = Math.min(DUR, now + dt * 40); draw();
      if (now >= DUR) hold = 3;
    }
    var btns = {};
    ['ok', 'pool', 'payment'].forEach(function (k) {
      btns[k] = v.button(NAMES[k], function () { scen = k; now = 0; hold = 0; mark(); if (ctl) ctl.play(); draw(); });
    });
    function mark() { Object.keys(btns).forEach(function (k) { btns[k].classList.toggle('obsv-on', k === scen); btns[k].setAttribute('aria-pressed', String(k === scen)); }); }
    mark();
    v.hover(function (e, q) {
      if (!geo) return;
      var b = geo.boxes[0], bx = geo.boxes.filter(function (x) { return q.x >= x.l - 40 && q.x <= x.r + 4 && q.y >= x.t - 22 && q.y <= x.b + 30; })[0] || b;
      pin = clamp(Math.round((q.x - bx.l) / (bx.r - bx.l) * DUR), 0, Math.floor(Math.max(now, 1))); draw();
      var d = S[scen], t = pin;
      v.showTip('<b>t = ' + t + ' с</b><br>RPS: <b>' + fmt(d.rps[t], 0) + '</b> (хочет ' + fmt(ramp(t), 0) + ')<br>p95: <b>' + fmt(d.p95[t], 0) + ' мс</b><br>5xx: <b>' + fmt(d.err[t], 1) +
        ' %</b><br>в работе: <b>' + fmt(d.run[t], 0) + '</b>, ждут пул: <b>' + fmt(d.wait[t], 0) + '</b>', e.clientX, e.clientY);
    }, function () { pin = null; draw(); });
    v.tryIt('переключай сценарии и каждый раз ищи по порядку: что стало с RPS, потом p95, потом ошибки, потом очередь. Наведи мышь на любой момент: перекрестие покажет все четыре числа сразу.');
    draw(); v.onResize(draw); ctl = L.animate(v, tick, still, function () { now = 0; hold = 0; });
  };
})();
