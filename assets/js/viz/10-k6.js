/* Виджеты темы 10 «k6»: регистрируются через window.LTViz. Префикс k6-.
   Модели упрощены для объяснения, это не измерения учебного сервиса.

   k6-vu-lanes: виртуальные пользователи (VU) крутят итерации default-функции.
     data-vus      сколько VU (1-10, по умолчанию 3)
     data-latency  сколько мс длится запрос (50-1500, по умолчанию 300)
     data-sleep    пауза sleep() в секундах (0-3, по умолчанию 1)
   k6-executors: constant-vus (закрытая модель) против constant-arrival-rate (открытая) при замедлении сервера.
     data-rate     итераций в секунду у arrival-rate (5-100, по умолчанию 50)
     data-vus      VU у constant-vus (1-60, по умолчанию 5)
     data-maxvus   maxVUs у arrival-rate (5-100, по умолчанию 20)
     data-latency  обычная задержка запроса, мс (20-400, по умолчанию 100)
     data-slow     во сколько раз сервер замедляется на секундах 20-40 (1-8, по умолчанию 5)
   k6-threshold: порог p(95) и доля ошибок против выборки задержек, код выхода k6.
     data-limit    порог p(95), мс (50-1500, по умолчанию 500)
     data-errors   доля ошибок в процентах (0-5, по умолчанию 0.5)
     data-slowpct  сколько процентов запросов медленные (0-20, по умолчанию 6)
   k6-pick-tool: выбор инструмента (k6 или Locust) по условиям задачи, без атрибутов. */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt;

  var css = [
    '.k6-lg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;font-size:.85rem;color:var(--muted)}',
    '.k6-lg span{display:inline-flex;align-items:center;gap:6px}',
    '.k6-lg i{display:inline-block;width:12px;height:4px;border-radius:2px;background:currentColor}',
    '.k6-lg .a{color:var(--blue)}.k6-lg .b{color:var(--green)}.k6-lg .c{color:var(--red)}.k6-lg .d{color:var(--yellow)}',
    '.k6-pick{display:grid;gap:10px;margin:8px 0}',
    '.k6-pick .q{border:1px solid var(--line);border-radius:10px;background:var(--bg-2);padding:10px 12px}',
    '.k6-pick .q p{margin:0 0 8px;font-size:.95rem}',
    '.k6-pick .opts{display:flex;flex-wrap:wrap;gap:8px}',
    '.k6-pick button{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:999px;padding:6px 12px;font:inherit;font-size:.9rem;cursor:pointer;min-height:36px}',
    '.k6-pick button[aria-pressed="true"]{border-color:var(--blue);background:var(--bg-code);font-weight:600}',
    '.k6-bar{position:relative;height:26px;border-radius:13px;background:var(--bg-code);border:1px solid var(--line);overflow:hidden}',
    '.k6-bar b{position:absolute;inset:0 auto 0 0;background:var(--blue);opacity:.35;transition:width .25s}',
    '.k6-bar em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:.85rem}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('k6-viz-style')) return;
    var s = document.createElement('style'); s.id = 'k6-viz-style'; s.textContent = css; document.head.appendChild(s);
  }
  function legend(v, host, items) {
    var d = html('div', undefined, 'k6-lg');
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

  /* ---------- k6-vu-lanes ---------- */
  L.widgets['k6-vu-lanes'] = function (host) {
    injectStyle();
    var vus = Math.round(num(host.dataset.vus, 3, 1, 10)), lat = num(host.dataset.latency, 300, 50, 1500), slp = num(host.dataset.sleep, 1, 0, 3);
    var WINDOW = 10, SPEED = 1.5; // на экране 10 секунд теста, показ идёт в 1,5 раза быстрее реального времени
    var v = L.setup(host, host.dataset.title || 'VU и итерации: что делает каждый пользователь');
    var clock, lanes, geo = {}, hoverT = null;
    function build() {
      var r = rng(5); lanes = [];
      for (var i = 0; i < vus; i++) lanes.push({ ev: [], t: 0, n: 0, r: r, done: 0 });
      clock = 0;
    }
    function extend(upTo) {
      lanes.forEach(function (ln) {
        while (ln.t < upTo) {
          ln.n++;
          var d = lat / 1000 * (0.8 + 0.4 * ln.r());
          ln.ev.push({ t0: ln.t, t1: ln.t + d, kind: 'req', it: ln.n });
          ln.t += d;
          if (slp > 0) { ln.ev.push({ t0: ln.t, t1: ln.t + slp, kind: 'sleep', it: ln.n }); ln.t += slp; }
        }
      });
    }
    function doneAt(t) { var n = 0; lanes.forEach(function (ln) { n += ln.done; ln.ev.forEach(function (e) { if (e.t1 <= t && (e.kind === 'sleep' || slp === 0)) n++; }); }); return n; }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var laneH = 24, top = 30, H = top + vus * laneH + 56, W = v.canvas(H), left = narrow ? 40 : 52, right = W - 10;
      var t1 = Math.max(WINDOW, clock), t0 = t1 - WINDOW;
      function X(t) { return left + (t - t0) / WINDOW * (right - left); }
      geo = { left: left, right: right, t0: t0, top: top, laneH: laneH };
      extend(t1 + 2);
      lanes.forEach(function (ln) { ln.ev = ln.ev.filter(function (e) { if (e.t1 < t0 - 1) { if (e.kind === 'sleep' || slp === 0) ln.done++; return false; } return true; }); });
      for (var g = 0; g <= WINDOW; g += 2) {
        var tt = Math.ceil(t0 / 2) * 2 + g - 2;
        if (tt < t0 - 1e-9 || tt > t1 + 1e-9) continue;
        v.add('line', { x1: X(tt), x2: X(tt), y1: top - 4, y2: top + vus * laneH, class: 'grid' });
        v.label(X(tt), top + vus * laneH + 18, tt + ' с', 'muted small');
      }
      lanes.forEach(function (ln, i) {
        var y = top + i * laneH;
        v.label(left - 6, y + laneH / 2 + 5, 'VU ' + (i + 1), 'muted small', 'end');
        ln.ev.forEach(function (e) {
          if (e.t1 < t0 || e.t0 > clock) return;
          var a = Math.max(e.t0, t0), b = Math.min(e.t1, clock);
          if (b <= a) return;
          v.add('rect', { x: X(a), y: y + 3, width: Math.max(1.5, X(b) - X(a)), height: laneH - 6, rx: 3,
            class: (e.kind === 'req' ? 'response' : 'muted') + ' fill', 'fill-opacity': e.kind === 'req' ? 0.95 : 0.25 });
        });
      });
      v.add('path', { d: 'M' + left + ' ' + (top - 4) + 'V' + (top + vus * laneH) + 'H' + right, class: 'axis' });
      v.label(left, 16, 'синее: запрос идёт, серое: sleep()', 'muted small', 'start');
      v.label(right, H - 8, 'время теста, секунд', 'muted small', 'end');
      if (hoverT !== null) v.add('line', { x1: X(hoverT), x2: X(hoverT), y1: top - 4, y2: top + vus * laneH, class: 'primary marker' });
    }
    function describe() {
      var iterTime = lat / 1000 + slp, perVu = 1 / iterTime, rps = vus * perVu;
      v.explain('Каждый из <b>' + vus + '</b> VU по кругу выполняет одну и ту же функцию: запрос (около <b>' + fmt(lat, 0) + ' мс</b>), потом <code>sleep(' + fmt(slp, 1) + ')</code>. Одна итерация занимает около <b>' + fmt(iterTime, 2) + ' с</b>, поэтому один VU делает ' + fmt(perVu, 2) + ' итераций в секунду, а все вместе: ' + vus + ' × ' + fmt(perVu, 2) + ' = <b>' + fmt(rps, 1) + ' запросов в секунду</b>. С начала показа выполнено итераций: <b>' + doneAt(clock) + '</b>.<br>' +
        (slp === 0 ? 'Паузы нет: VU сразу шлёт следующий запрос, это самая жёсткая нагрузка для одного VU.' : 'Чем длиннее пауза, тем реже запросы: паузой имитируют, что человек читает страницу.'));
    }
    function restart() { build(); if (ctl.reduced) still(); else { draw(); describe(); } }
    function still() { build(); clock = WINDOW; draw(); describe(); }
    v.slider('VU (виртуальных пользователей)', 1, 10, 1, vus, function (n) { vus = Math.round(n); restart(); }, '');
    v.slider('Запрос длится', 50, 1500, 50, lat, function (n) { lat = n; restart(); }, 'мс');
    v.slider('Пауза sleep()', 0, 3, 0.1, slp, function (n) { slp = n; restart(); }, 'с');
    v.tryIt('поставь паузу 0: VU завалит сервер запросами без перерыва. Потом увеличь запрос до 1500 мс: запросов в секунду станет меньше, хотя VU столько же. Наведи на любой участок графика, чтобы увидеть номер итерации.');
    v.status.textContent = 'Показ идёт в ' + SPEED + ' раза быстрее реального времени; серые куски это sleep().';
    var ctl = L.animate(v, function (dt) { clock += dt * SPEED; draw(); describe(); }, still, function () { build(); });
    v.hover(function (e, q) {
      var t = geo.t0 + (q.x - geo.left) / (geo.right - geo.left) * WINDOW;
      var i = Math.floor((q.y - geo.top) / geo.laneH);
      if (t < 0 || t > clock) { hoverT = null; v.showTip('Сюда показ ещё не дошёл', e.clientX, e.clientY); return; }
      hoverT = t; draw();
      var ln = lanes[Math.max(0, Math.min(vus - 1, i))], ev = ln.ev.filter(function (x) { return x.t0 <= t && t < x.t1; })[0];
      v.showTip('<b>' + fmt(t, 1) + ' с, VU ' + (lanes.indexOf(ln) + 1) + '</b><br>' + (ev ? 'итерация ' + ev.it + ': ' + (ev.kind === 'req' ? 'идёт запрос' : 'пауза sleep()') : 'нет данных'), e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    legend(v, host, [['a', 'запрос'], ['d', 'sleep()']]); if (!ctl.reduced) { build(); draw(); describe(); } v.onResize(draw);
  };

  /* ---------- k6-executors ---------- */
  L.widgets['k6-executors'] = function (host) {
    injectStyle();
    var rate = num(host.dataset.rate, 50, 5, 100), users = Math.round(num(host.dataset.vus, 5, 1, 60)), maxvus = Math.round(num(host.dataset.maxvus, 20, 5, 100));
    var base = num(host.dataset.latency, 100, 20, 400), slow = num(host.dataset.slow, 5, 1, 8);
    var T = 60, FROM = 20, TO = 40, SPEED = 6;
    var v = L.setup(host, host.dataset.title || 'constant-vus и constant-arrival-rate, когда сервер тормозит');
    var clock, geo = {}, hoverT = null;
    function lat(t) { return base / 1000 * (t >= FROM && t < TO ? slow : 1); } // секунд
    function at(t) {
      var l = lat(t);
      var need = rate * l, used = Math.min(need, maxvus), rpsB = used / l;
      return { lat: l, closedRps: users / l, openRps: rpsB, openVus: used, need: need, dropped: Math.max(0, rate - rpsB) };
    }
    function reset() { clock = 0; }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var H = 470, W = v.canvas(H), left = narrow ? 40 : 48, right = W - 12;
      function X(t) { return left + t / T * (right - left); }
      geo = { left: left, right: right };
      var rpsMax = 0, vuMax = 0, t;
      for (t = 0; t < T; t++) { var a = at(t); rpsMax = Math.max(rpsMax, a.closedRps, rate); vuMax = Math.max(vuMax, users, a.openVus, Math.min(a.need, 999)); }
      var panels = [{ top: 36, bottom: 196, max: L.scale(rpsMax * 1.1).max, title: 'Запросов в секунду (RPS)' },
        { top: 266, bottom: 426, max: L.scale(Math.max(vuMax, maxvus) * 1.1, true).max, title: 'Сколько VU занято' }];
      panels.forEach(function (p, pi) {
        function Y(n) { return p.bottom - Math.min(n, p.max) / p.max * (p.bottom - p.top); }
        p.Y = Y;
        v.add('rect', { x: X(FROM), y: p.top, width: X(TO) - X(FROM), height: p.bottom - p.top, class: 'danger zone' });
        for (var g = 0; g <= 4; g++) {
          v.add('line', { x1: left, x2: right, y1: Y(p.max * g / 4), y2: Y(p.max * g / 4), class: 'grid' });
          v.label(left - 6, Y(p.max * g / 4) + 5, fmt(p.max * g / 4, 0), 'muted small', 'end');
        }
        v.add('path', { d: 'M' + left + ' ' + p.top + 'V' + p.bottom + 'H' + right, class: 'axis' });
        v.label(left, p.top - 10, p.title, 'muted small', 'start');
      });
      var P0 = panels[0], P1 = panels[1];
      function line(panel, key, cls, extra) {
        var pts = [];
        for (var s = 0; s <= Math.min(clock, T); s += 0.5) {
          var q = at(Math.min(s, T - 0.001)), val = typeof key === 'function' ? key(q) : q[key];
          pts.push(X(s) + ',' + panel.Y(val));
        }
        if (pts.length > 1) v.add('polyline', Object.assign({ points: pts.join(' '), class: cls + ' stroke' }, extra || {}));
      }
      v.add('line', { x1: left, x2: right, y1: P0.Y(rate), y2: P0.Y(rate), class: 'warning marker' });
      v.label(right - 4, P0.Y(rate) - 6, 'цель arrival-rate: ' + fmt(rate, 0), 'warning halo small', 'end');
      line(P0, 'closedRps', 'response');
      line(P0, 'openRps', 'ok');
      line(P1, function () { return users; }, 'response');
      line(P1, 'openVus', 'ok');
      v.add('line', { x1: left, x2: right, y1: P1.Y(maxvus), y2: P1.Y(maxvus), class: 'danger marker' });
      v.label(right - 4, P1.Y(maxvus) - 6, 'maxVUs: ' + maxvus, 'danger halo small', 'end');
      v.label(X((FROM + TO) / 2), 214, 'сервер медленнее в ' + fmt(slow, 0) + ' раз', 'danger small');
      v.label(right, H - 8, 'время теста, секунд', 'muted small', 'end');
      if (clock > 0) v.add('line', { x1: X(Math.min(clock, T)), x2: X(Math.min(clock, T)), y1: 36, y2: 426, class: 'muted marker' });
      if (hoverT !== null) v.add('line', { x1: X(hoverT), x2: X(hoverT), y1: 36, y2: 426, class: 'primary marker' });
    }
    function describe() {
      var t = Math.min(clock, T - 0.001), a = at(t), slowNow = t >= FROM && t < TO;
      var txt = 'Сервер обычно отвечает за <b>' + fmt(base, 0) + ' мс</b>; с 20-й по 40-ю секунду он медленнее в <b>' + fmt(slow, 0) + '</b> раз (' + fmt(base * slow, 0) + ' мс). ' +
        '<b>constant-vus</b> (синяя): ' + users + ' VU, каждый ждёт ответа и шлёт следующий запрос. Сейчас задержка ' + fmt(a.lat * 1000, 0) + ' мс, поэтому RPS = ' + users + ' / ' + fmt(a.lat, 2) + ' = <b>' + fmt(a.closedRps, 0) + '</b>: сервер замедлился, и генератор сам стал давить на него слабее.<br>' +
        '<b>constant-arrival-rate</b> (зелёная): новая итерация стартует ' + fmt(rate, 0) + ' раз в секунду, что бы ни случилось. Чтобы держать это при задержке ' + fmt(a.lat * 1000, 0) + ' мс, нужно ' + fmt(rate, 0) + ' × ' + fmt(a.lat, 2) + ' = <b>' + fmt(a.need, 1) + ' VU</b> одновременно. ';
      if (a.need > maxvus + 1e-9) txt += 'Разрешено только ' + maxvus + ': не хватает, поэтому RPS падает до <b>' + fmt(a.openRps, 0) + '</b>, а <b>' + fmt(a.dropped, 0) + ' итераций в секунду</b> k6 не запускает вообще (метрика <code>dropped_iterations</code>).';
      else txt += (slowNow ? 'Хватает: ' : 'Хватает: ') + 'k6 держит ровные ' + fmt(rate, 0) + ' RPS, просто занято больше VU. Потерь нет.';
      v.explain(txt);
    }
    function restart() { reset(); if (ctl.reduced) still(); else { draw(); describe(); } }
    function still() { clock = T; draw(); clock = 45; describe(); clock = T; draw(); }
    v.slider('Замедление сервера', 1, 8, 1, slow, function (n) { slow = n; restart(); }, '×');
    v.slider('Цель arrival-rate', 5, 100, 5, rate, function (n) { rate = n; restart(); }, 'RPS');
    v.slider('maxVUs', 5, 100, 5, maxvus, function (n) { maxvus = Math.round(n); restart(); }, '');
    v.slider('VU у constant-vus', 1, 60, 1, users, function (n) { users = Math.round(n); restart(); }, '');
    v.tryIt('подними maxVUs до 50: зелёная линия перестанет проваливаться, потерь нет. Потом верни 20 и поставь замедление ×8: потери вырастут. Наведи в любое место графика: увидишь обе модели в этот момент.');
    v.status.textContent = 'Показ ускорен в ' + SPEED + ' раз, после 60 с начнётся заново. Один запрос на итерацию, пауз нет.';
    var hold = 0;
    var ctl = L.animate(v, function (dt) {
      if (clock >= T) { hold += dt; if (hold > 2.5) { hold = 0; reset(); } draw(); return; }
      clock = Math.min(T, clock + dt * SPEED); draw(); describe();
    }, still, function () { reset(); });
    v.hover(function (e, q) {
      var t = Math.max(0, Math.min(T - 1, Math.round((q.x - geo.left) / (geo.right - geo.left) * T)));
      if (t > clock) { hoverT = null; v.showTip('Сюда показ ещё не дошёл', e.clientX, e.clientY); return; }
      hoverT = t; draw(); var a = at(t);
      v.showTip('<b>' + t + '-я секунда</b>, ответ ' + fmt(a.lat * 1000, 0) + ' мс<br><span class="response">constant-vus:</span> ' + users + ' VU, ' + fmt(a.closedRps, 0) + ' RPS<br><span class="ok">arrival-rate:</span> ' + fmt(a.openVus, 0) + ' VU, ' + fmt(a.openRps, 0) + ' RPS' + (a.dropped > 0.5 ? '<br><span class="danger">не запущено: ' + fmt(a.dropped, 0) + ' итераций/с</span>' : ''), e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    legend(v, host, [['a', 'constant-vus'], ['b', 'constant-arrival-rate'], ['d', 'цель'], ['c', 'maxVUs']]);
    if (!ctl.reduced) { reset(); draw(); describe(); } v.onResize(draw);
  };

  /* ---------- k6-threshold ---------- */
  L.widgets['k6-threshold'] = function (host) {
    injectStyle();
    var limit = num(host.dataset.limit, 500, 50, 1500), errPct = num(host.dataset.errors, 0.5, 0, 5), slowPct = num(host.dataset.slowpct, 6, 0, 20);
    var errLimit = 1; // порог http_req_failed: rate<0.01
    var v = L.setup(host, host.dataset.title || 'Порог p(95) и код выхода k6');
    var N = 1000, samples, geo = {}, hoverB = null, BIN = 50, BINS = 30;
    function make() {
      var r = rng(42); samples = [];
      for (var i = 0; i < N; i++) {
        var ms = i < N * slowPct / 100 ? 450 + r() * 900 : 40 + r() * r() * 380 + r() * 40;
        samples.push(ms);
      }
      samples.sort(function (a, b) { return a - b; });
    }
    function p(q) { return samples[Math.min(N - 1, Math.ceil(N * q) - 1)]; }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var H = 270, W = v.canvas(H), left = narrow ? 40 : 48, right = W - 12, top = 30, bottom = 210;
      var bins = []; for (var b = 0; b < BINS; b++) bins.push(0);
      samples.forEach(function (s) { bins[Math.min(BINS - 1, Math.floor(s / BIN))]++; });
      var yMax = L.scale(Math.max.apply(null, bins) * 1.1, true).max, X = function (ms) { return left + ms / (BIN * BINS) * (right - left); };
      function Y(n) { return bottom - n / yMax * (bottom - top); }
      geo = { left: left, right: right, bins: bins };
      for (var g = 0; g <= 4; g++) {
        v.add('line', { x1: left, x2: right, y1: Y(yMax * g / 4), y2: Y(yMax * g / 4), class: 'grid' });
        v.label(left - 6, Y(yMax * g / 4) + 5, fmt(yMax * g / 4, 0), 'muted small', 'end');
      }
      var bw = (right - left) / BINS;
      bins.forEach(function (n, i) {
        var over = i * BIN >= limit;
        v.add('rect', { x: left + i * bw + 1, y: Y(n), width: Math.max(1, bw - 2), height: bottom - Y(n), class: (over ? 'danger' : 'response') + ' fill', 'fill-opacity': hoverB === i ? 1 : 0.7 });
      });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      [0, 300, 600, 900, 1200, 1500].forEach(function (ms) { v.label(X(ms), bottom + 18, ms + '', 'muted small'); });
      v.label(right, bottom + 40, 'задержка запроса, мс', 'muted small', 'end');
      v.label(left, top - 10, (narrow ? 'запросов в «коробке» 50 мс' : 'сколько запросов из ' + N + ' в каждой «коробке» по 50 мс'), 'muted small', 'start');
      v.add('line', { x1: X(limit), x2: X(limit), y1: top, y2: bottom, class: 'warning marker' });
      v.label(Math.min(right - 4, X(limit) + 6), top + 12, 'порог ' + limit, 'warning halo small', X(limit) > right - 90 ? 'end' : 'start');
      var q = p(0.95); v.add('line', { x1: X(q), x2: X(q), y1: top + 20, y2: bottom, class: 'primary marker' });
      v.label(X(q) > right - 110 ? X(q) - 6 : X(q) + 6, top + 34, 'p(95) = ' + fmt(q, 0), 'primary halo small', X(q) > right - 110 ? 'end' : 'start');
    }
    function describe() {
      var q = p(0.95), okLat = q < limit, okErr = errPct < errLimit, code = okLat && okErr ? 0 : 99;
      v.explain('В тесте было <b>' + N + '</b> запросов, ' + fmt(slowPct, 0) + '% из них медленные. Отсортировав задержки, берём 950-е значение: <b>p(95) = ' + fmt(q, 0) + ' мс</b>. Порог: <code>p(95)&lt;' + limit + '</code> ' + (okLat ? '<b>выполнен</b>' : '<b>нарушен</b>') + '. Доля ошибок <b>' + fmt(errPct, 1) + '%</b> при пороге <code>rate&lt;0.01</code> (1%): ' + (okErr ? '<b>выполнен</b>' : '<b>нарушен</b>') + '.<br>' +
        'Итог для CI: <b>k6 завершится с кодом ' + code + '</b> ' + (code === 0 ? '(всё хорошо, этап пайплайна зелёный)' : '(99: пороги нарушены, этап красный, релиз стоит)') + '. ' + (function () { var over = samples.filter(function (x) { return x >= limit; }).length; return over === 0 ? 'Красных столбиков нет: ни один запрос не медленнее порога.' : 'Красные столбики это запросы медленнее порога: их ' + over + ' из ' + N + ' (' + fmt(over / N * 100, 1) + '%).' + (over > N * 0.05 ? ' Их больше 5%, поэтому p(95) попал в красную зону.' : ' Их не больше 5%, поэтому p(95) остался левее порога.'); })());
    }
    v.slider('Порог p(95)', 50, 1500, 50, limit, function (n) { limit = n; draw(); describe(); }, 'мс');
    v.slider('Доля ошибок', 0, 5, 0.1, errPct, function (n) { errPct = n; draw(); describe(); }, '%');
    v.slider('Медленных запросов', 0, 20, 1, slowPct, function (n) { slowPct = n; make(); draw(); describe(); }, '%');
    v.tryIt('поставь медленных запросов 3%: p(95) уйдёт влево и порог в 500 выполнится. Поставь 6%: p(95) уедет в красную зону. Среднее почти не заметит разницы, а перцентиль заметит. Наведи на любой столбик: сколько в нём запросов.');
    v.hover(function (e, q) {
      var i = Math.max(0, Math.min(BINS - 1, Math.floor((q.x - geo.left) / (geo.right - geo.left) * BINS)));
      hoverB = i; draw();
      v.showTip('<b>' + (i * BIN) + '-' + ((i + 1) * BIN) + ' мс</b><br>запросов: ' + geo.bins[i] + ' из ' + N + '<br>' + (i * BIN >= limit ? '<span class="danger">выше порога</span>' : '<span class="response">в пределах порога</span>'), e.clientX, e.clientY);
    }, function () { hoverB = null; draw(); });
    make(); draw(); describe(); v.onResize(draw);
  };

  /* ---------- k6-pick-tool ---------- */
  L.widgets['k6-pick-tool'] = function (host) {
    injectStyle();
    var v = L.setup(host, host.dataset.title || 'k6 или Locust: что выбрать под задачу');
    var Q = [
      { q: 'На чём команда пишет сценарии?', o: [['Python, команда уже на нём', 1, 0], ['JavaScript или TypeScript', 0, 1], ['Всё равно, учиться будем', 0, 0]] },
      { q: 'Какая модель нагрузки нужна?', o: [['Пользователи: N человек думают и кликают', 1, 0], ['Фиксированный поток: 200 запросов в секунду', 0, 2], ['Обе, смотря по задаче', 0, 0]] },
      { q: 'Где запускать?', o: [['Ноутбук, смотрю глазами в браузере', 1, 0], ['CI-пайплайн, нужен код выхода по порогам', 0, 2], ['И то, и то', 0, 1]] },
      { q: 'Сколько нагрузки нужно с одной машины?', o: [['Сотни RPS, хватит', 0, 0], ['Тысячи RPS с одной машины', 0, 2], ['Много, готов поднять несколько машин', 1, 0]] },
      { q: 'Метрики теста нужны в Prometheus и Grafana?', o: [['Да, рядом с метриками сервиса', 0, 1], ['Хватит CSV и отчёта', 1, 0]] }
    ];
    var ans = Q.map(function () { return -1; });
    var box = html('div', undefined, 'k6-pick'); v.stage.appendChild(box);
    var bar = html('div', undefined, 'k6-bar'), fill = html('b'), txt = html('em');
    bar.appendChild(fill); bar.appendChild(txt);
    function render() {
      var l = 0, k = 0, n = 0;
      ans.forEach(function (a, i) { if (a >= 0) { l += Q[i].o[a][1]; k += Q[i].o[a][2]; n++; } });
      var total = l + k, share = total ? k / total * 100 : 50;
      fill.style.width = share + '%';
      txt.textContent = n === 0 ? 'ответь на вопросы выше' : 'Locust ' + fmt(100 - share, 0) + '%  |  k6 ' + fmt(share, 0) + '%';
      var verdict;
      if (n === 0) verdict = 'Ответь на вопросы: шкала сдвинется туда, где инструмент удобнее.';
      else if (share >= 62) verdict = 'Ближе <b>k6</b>: открытая модель, пороги для CI и экономные ресурсы важнее привычки к языку.';
      else if (share <= 38) verdict = 'Ближе <b>Locust</b>: сценарий на Python, пользователи с раздумьями и удобный веб-интерфейс.';
      else verdict = 'Ничья. На практике часто берут оба: Locust для сложных пользовательских сценариев, k6 для стабильных прогонов в CI. Решает команда, а не таблица.';
      v.explain(verdict + ' Это ориентир, а не приговор: оба инструмента умеют и то, и другое, просто одно из них делает это проще.');
    }
    Q.forEach(function (item, qi) {
      var d = html('div', undefined, 'q'); d.appendChild(html('p', item.q));
      var opts = html('div', undefined, 'opts');
      item.o.forEach(function (o, oi) {
        var b = html('button', o[0]); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          ans[qi] = oi; Array.prototype.forEach.call(opts.children, function (c, ci) { c.setAttribute('aria-pressed', ci === oi ? 'true' : 'false'); }); render();
        });
        opts.appendChild(b);
      });
      d.appendChild(opts); box.appendChild(d);
    });
    box.appendChild(bar);
    v.tryIt('отвечай по условиям своей работы, потом измени один ответ и посмотри, насколько сдвинется шкала. Какой вопрос решает больше всего?');
    render();
  };
})();
