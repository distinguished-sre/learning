/* Виджеты урока 5.3 «Паттерны надёжности» курса «Мониторинг и SRE»: регистрируются через window.LTViz. Префикс mon5-.

   mon5-resilience: оплата ломается на 40 секунд из двух минут. Магазин повторяет попытки, ждёт таймаут и,
    если включён выключатель (circuit breaker), перестаёт стучаться. Четыре панели: попытки к оплате,
    ожидание покупателя, нужные соединения пула и заказы по результатам.
     data-orders    заказов в секунду (по умолчанию 2)
     data-retries   повторов после первой попытки, 0-3 (по умолчанию 3, как PAYMENT_RETRIES)
     data-timeout   таймаут одной попытки в секундах (по умолчанию 1, как PAYMENT_TIMEOUT)
     data-kind      hang (оплата зависла) | error (оплата сразу отвечает 500), по умолчанию hang
     data-breaker   1: выключатель включён (по умолчанию 0) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var num = L.num, fmt = L.fmt;

  var st = document.createElement('style');
  st.textContent = '.mon5-on{border-color:var(--accent-ink)!important;font-weight:700}';
  document.head.appendChild(st);

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  var D = 120, FS = 30, FE = 70, OPEN = 15, GOOD = 0.05, FAST = 0.02, POOL = 5;

  /* Модель по секундам. В беде каждый заказ делает retries + 1 попыток; зависшая оплата держит каждую
     попытку до таймаута, а отвечающая ошибкой отдаёт её за GOOD секунд. Выключатель открывается, когда
     плохие попытки видны (секунда или таймаут), 15 секунд держит отказ без обращений к оплате и потом
     пробует одну попытку. Соединений пула нужно «заказов в секунду на время ожидания» (закон Литтла). */
  function simulate(p) {
    var o = { att: [], wait: [], need: [], ok: [], bad: [], state: [] };
    var detect = (p.hang ? Math.ceil(p.T) : 0) + 1, seen = 0, mode = 'closed', until = 0;
    for (var t = 0; t < D; t++) {
      var fail = t >= FS && t < FE, att, wait, ok = 0, bad = 0, state = mode;
      if (p.br && mode === 'open' && t >= until) mode = 'half';
      if (p.br && mode === 'open') {
        att = 0; wait = FAST; bad = p.lam; state = 'open';
      } else if (p.br && mode === 'half') {
        state = 'half';
        if (fail) { att = 1; wait = FAST; bad = p.lam; mode = 'open'; until = t + OPEN; }
        else { att = p.lam; wait = GOOD; ok = p.lam; mode = 'closed'; seen = 0; }
      } else if (fail) {
        att = p.lam * (p.R + 1); wait = (p.R + 1) * (p.hang ? p.T : GOOD); bad = p.lam;
        if (p.br && ++seen >= detect) { mode = 'open'; until = t + OPEN; }
      } else { att = p.lam; wait = GOOD; ok = p.lam; seen = 0; }
      o.att.push(att); o.wait.push(wait); o.need.push(p.lam * wait); o.ok.push(ok); o.bad.push(bad); o.state.push(state);
    }
    return o;
  }

  L.widgets['mon5-resilience'] = function (host) {
    var p = {
      lam: num(host.dataset.orders, 2, 1, 6), R: Math.round(num(host.dataset.retries, 3, 0, 3)),
      T: num(host.dataset.timeout, 1, 0.5, 5), hang: host.dataset.kind !== 'error', br: host.dataset.breaker === '1'
    };
    var v = L.setup(host, host.dataset.title || 'Оплата ломается на 40 секунд: что делают таймаут, повторы и выключатель');
    var S = null, now = 0, pin = null, geo = null, ctl = null;
    var DEFS = [
      { title: 'Попытки к оплате, в секунду', key: 'att', cls: 'violet', ref: true },
      { title: 'Сколько ждёт покупатель, с', key: 'wait', cls: 'warning' },
      { title: 'Нужно соединений пула (пул: ' + POOL + ')', key: 'need', cls: 'danger', pool: true },
      { title: 'Заказы в секунду: прошли и отказ', key: 'ok', cls: 'ok', key2: 'bad', cls2: 'danger' }
    ];
    function ymax(d) {
      var m = Math.max.apply(null, S[d.key].concat(d.key2 ? S[d.key2] : [], d.ref ? [p.lam] : [], d.pool ? [POOL] : []));
      return L.niceMax(Math.max(m, 1) * 1.05);
    }
    function draw() {
      S = simulate(p);
      var ph = 66, gap = 34, top = 22, H = top + DEFS.length * (ph + gap) + 6, W = v.canvas(H), l = 44, r = W - 8;
      var X = function (t) { return l + t / (D - 1) * (r - l); };
      geo = { l: l, r: r, boxes: [] };
      DEFS.forEach(function (d, i) {
        var b = { t: top + i * (ph + gap), b: top + i * (ph + gap) + ph }, ym = ymax(d);
        var Y = function (n) { return b.b - Math.min(n, ym) / ym * (b.b - b.t); };
        v.add('rect', { x: X(FS), y: b.t, width: X(FE) - X(FS), height: b.b - b.t, class: 'danger zone' });
        [0, ym / 2, ym].forEach(function (k) {
          v.add('line', { x1: l, x2: r, y1: Y(k), y2: Y(k), class: 'grid' });
          v.label(l - 6, Y(k) + 4, fmt(k, k < 10 && k % 1 ? 1 : 0), 'muted small', 'end');
        });
        v.add('path', { d: 'M' + l + ' ' + b.t + 'V' + b.b + 'H' + r, class: 'axis' });
        v.label(l, b.t - 8, d.title, 'small', 'start');
        if (d.ref) {
          v.add('line', { x1: l, x2: r, y1: Y(p.lam), y2: Y(p.lam), class: 'muted marker' });
          v.label(r, Y(p.lam) - 4, 'заказов в секунду', 'muted small halo', 'end');
        }
        if (d.pool) {
          v.add('line', { x1: l, x2: r, y1: Y(POOL), y2: Y(POOL), class: 'warning marker' });
          v.label(r, Y(POOL) - 4, 'весь пул', 'warning small halo', 'end');
        }
        [[d.key, d.cls], d.key2 ? [d.key2, d.cls2] : null].forEach(function (s) {
          if (!s) return;
          var pts = [];
          for (var t = 0; t <= Math.min(now, D - 1); t++) pts.push(X(t).toFixed(1) + ',' + Y(S[s[0]][t]).toFixed(1));
          if (pts.length > 1) v.add('polyline', { points: pts.join(' '), class: s[1] + ' stroke' });
        });
        if (i === 0) {
          for (var t = 0; t < D; t++) if (S.state[t] === 'open' && t <= now) v.add('rect', { x: X(t), y: b.b + 6, width: Math.max(2, X(1) - X(0)), height: 6, class: 'response fill' });
          if (S.state.indexOf('open') >= 0) v.label(l, b.b + 24, 'синяя полоска: выключатель разомкнут', 'response small', 'start');
        }
        if (pin != null) v.add('line', { x1: X(pin), x2: X(pin), y1: b.t, y2: b.b, class: 'muted marker' });
        geo.boxes.push(b);
      });
      geo.X = X;
      for (var tt = 0; tt < D; tt += 20) v.label(X(tt), H - 2, tt + ' с', 'muted small', tt === 0 ? 'start' : 'middle');
      v.label(r, H - 2, 'время, красная зона: оплата сломана', 'muted small', 'end');
    }
    function describe() {
      var a = 0, wmax = 0, nmax = 0, bad = 0, firstOpen = -1, lag = 0, t;
      for (t = 0; t < D; t++) {
        a += S.att[t]; wmax = Math.max(wmax, S.wait[t]); nmax = Math.max(nmax, S.need[t]); bad += S.bad[t];
        if (firstOpen < 0 && S.state[t] === 'open') firstOpen = t;
        if (t >= FE && S.bad[t] > 0) lag = t - FE + 1;
      }
      var base = p.lam * D, s = [];
      s.push((p.hang ? 'Оплата зависла' : 'Оплата отвечает ошибкой сразу') + ' с ' + FS + '-й по ' + (FE - 1) + '-ю секунду, всё это время каждый заказ делает до <b>' + (p.R + 1) + '</b> попыток' +
        (p.hang ? ' по <b>' + fmt(p.T, 1) + ' с</b>' : '') + '. За две минуты к оплате ушло <b>' + fmt(a, 0) + '</b> попыток при ' + fmt(base, 0) + ' заказах (' + (a >= base ? 'в ' + fmt(a / base, 1) + ' раза больше' : 'в ' + fmt(base / a, 1) + ' раза меньше, чем заказов') + ').');
      s.push('Дольше всего покупатель ждал <b>' + fmt(wmax, wmax >= 10 ? 0 : 2) + ' с</b>. Соединений пула нужно до <b>' + fmt(nmax, 1) + '</b>' +
        (nmax > POOL ? ': это больше пяти, пул кончится, заказы встанут в очередь, а каталог, которому тоже нужна база, начнёт отвечать 503.' : ', пул справляется.'));
      if (p.br) s.push('Выключатель разомкнулся на <b>' + (firstOpen < 0 ? '?' : firstOpen + '-й') + '</b> секунде и дальше отвечал отказом сразу, без обращения к оплате.' +
        (lag > 0 ? ' Цена: оплата ожила на ' + FE + '-й секунде, а заказы шли в отказ ещё <b>' + lag + ' с</b>, пока выключатель не сделал пробную попытку.' : ''));
      else s.push('Выключателя нет: каждый заказ сам дожидается всех попыток, и отказов за беду <b>' + fmt(bad, 0) + '</b>.');
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function stateText(x) { return x === 'open' ? 'выключатель разомкнут' : x === 'half' ? 'пробная попытка' : 'выключатель замкнут'; }
    var btns = {};
    function mark() {
      btns.hang.classList.toggle('mon5-on', p.hang); btns.error.classList.toggle('mon5-on', !p.hang);
      btns.br.classList.toggle('mon5-on', p.br);
      btns.hang.setAttribute('aria-pressed', String(p.hang)); btns.error.setAttribute('aria-pressed', String(!p.hang));
      btns.br.setAttribute('aria-pressed', String(p.br));
    }
    function changed() { now = D - 1; pin = null; mark(); S = simulate(p); draw(); describe(); if (ctl) ctl.finish(); }
    btns.hang = v.button('Оплата зависла (таймаут)', function () { p.hang = true; changed(); });
    btns.error = v.button('Оплата отвечает 500 сразу', function () { p.hang = false; changed(); });
    btns.br = v.button('Выключатель (circuit breaker)', function () { p.br = !p.br; changed(); });
    v.slider('Заказов в секунду', 1, 6, 1, p.lam, function (n) { p.lam = n; changed(); }, '');
    v.slider('Повторов', 0, 3, 1, p.R, function (n) { p.R = n; changed(); }, '');
    v.slider('Таймаут одной попытки', 0.5, 5, 0.5, p.T, function (n) { p.T = n; changed(); }, 'с');
    v.hover(function (e, q) {
      if (!geo || !S) return;
      pin = clamp(Math.round((q.x - geo.l) / (geo.r - geo.l) * (D - 1)), 0, Math.min(Math.floor(now), D - 1)); draw();
      var t = pin;
      v.showTip('<b>t = ' + t + ' с</b>' + (t >= FS && t < FE ? ' (оплата сломана)' : '') + '<br>' + stateText(S.state[t]) + '<br>попыток к оплате: <b>' + fmt(S.att[t], 1) +
        ' в с</b><br>покупатель ждёт: <b>' + fmt(S.wait[t], 2) + ' с</b><br>нужно соединений: <b>' + fmt(S.need[t], 1) + '</b><br>заказов прошло: <b>' + fmt(S.ok[t], 0) + '</b>, отказов: <b>' + fmt(S.bad[t], 0) + '</b>', e.clientX, e.clientY);
    }, function () { pin = null; draw(); });
    v.tryIt(host.dataset.try || 'оставь «оплата зависла», повторов 3 и таймаут 1 с: потребность в соединениях выйдет за линию пула. Потом включи выключатель и сравни все четыре панели, а заодно посмотри, сколько заказов отказали уже после ремонта оплаты. Затем поставь повторов 0.');
    function tick(dt) { now = Math.min(D - 1, now + dt * 40); draw(); return now < D - 1; }
    function still() { now = D - 1; draw(); }
    mark(); S = simulate(p); describe(); draw(); v.onResize(draw);
    now = 0; ctl = L.animate(v, tick, still, function () { now = 0; });
  };
})();
