/* Виджеты темы 3 «Дашборды и алерты» курса «Мониторинг и SRE»: регистрируются через window.LTViz. Префикс mon3-.

   mon3-route: куда Alertmanager отправит алерт. Включай алерты, глуши предупреждения при падении магазина
    и пробуй опечатку в метке: ветки сравнивают метки буква в букву.
   mon3-burn: сгорание бюджета ошибок в двух окнах. Беда с заданной долей ошибок и длительностью:
    быстрое правило будит, только если плохо и за час, и за пять минут. */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var num = L.num, fmt = L.fmt;

  var st = document.createElement('style');
  st.textContent = '.mon3-on{border-color:var(--accent-ink)!important;font-weight:700}';
  document.head.appendChild(st);

  /* ---------- mon3-route ---------- */
  L.widgets['mon3-route'] = function (host) {
    var v = L.setup(host, host.dataset.title || 'Маршруты Alertmanager: кто получит алерт');
    var ALERTS = [
      { n: 'LabShopDown', sev: 'critical' },
      { n: 'LabHighErrorRate', sev: 'critical' },
      { n: 'LabHighLatencyP95', sev: 'warning' },
      { n: 'LabDbPoolQueue', sev: 'warning' },
      { n: 'ShopNoTraffic', sev: 'info' }
    ];
    var RECV = [['page', 'page (звонок)'], ['ticket', 'ticket (задача)'], ['chat', 'chat (по умолчанию)']];
    var on = { LabHighErrorRate: true, LabDbPoolQueue: true, ShopNoTraffic: true };
    var typo = false, inhibit = true;
    function sevOf(a) { return typo && a.n === 'LabHighErrorRate' ? 'Critical' : a.sev; }
    function route(a) {
      var s = sevOf(a);
      return s === 'critical' ? 'page' : s === 'warning' ? 'ticket' : 'chat';
    }
    function draw() {
      var rowH = 38, H = 20 + ALERTS.length * rowH + 10, W = v.canvas(H), lw = Math.min(190, W * 0.42), rx = W - Math.min(170, W * 0.38);
      var down = !!on.LabShopDown, idx = { page: 0, ticket: 1, chat: 2 };
      RECV.forEach(function (r, i) {
        var y = 24 + i * 52 + 12;
        v.add('rect', { x: rx, y: y - 18, width: W - rx - 6, height: 36, rx: 6, class: 'box' });
        v.label(rx + 10, y + 4, r[1], '', 'start');
      });
      var hit = { page: 0, ticket: 0, chat: 0 }, lines = [];
      ALERTS.forEach(function (a, i) {
        var y = 20 + i * rowH + 12, active = !!on[a.n];
        var muted = active && inhibit && down && a.sev === 'warning';
        v.add('rect', { x: 6, y: y - 15, width: lw, height: 30, rx: 6, class: (active ? (a.sev === 'critical' ? 'danger' : a.sev === 'warning' ? 'warning' : 'ok') + ' fill' : 'box'), opacity: active ? (muted ? 0.35 : 0.9) : 1 });
        v.label(14, y + 4, a.n + (typo && a.n === 'LabHighErrorRate' ? ' [Critical]' : ''), active ? '' : 'muted small', 'start');
        if (!active) return;
        var r = route(a), ty = 24 + idx[r] * 52 + 12;
        if (muted) { v.label(lw + 14, y + 4, 'подавлен', 'muted small', 'start'); return; }
        hit[r]++;
        v.add('line', { x1: 6 + lw, x2: rx, y1: y, y2: ty, class: 'response stroke' });
      });
      RECV.forEach(function (r, i) {
        if (hit[r[0]]) v.label(W - 12, 24 + i * 52 + 16, hit[r[0]] + ' шт.', 'muted small', 'end');
      });
      return { hit: hit, down: down };
    }
    var btns = [];
    function describe(res) {
      var s = [], names = ALERTS.filter(function (a) { return on[a.n]; });
      if (!names.length) s.push('Включи пару алертов кнопками ниже.');
      else {
        s.push('Звонок (<code>page</code>) получат: <b>' + res.hit.page + '</b>, задачу (<code>ticket</code>): <b>' + res.hit.ticket + '</b>, чат по умолчанию: <b>' + res.hit.chat + '</b>.');
        if (typo && on.LabHighErrorRate) s.push('Метка <code>severity: Critical</code> с большой буквы не совпала с <code>severity = "critical"</code>: ошибка покупателей ушла в общий чат, и ночью никто не проснулся.');
        if (inhibit && res.down) s.push('Магазин лежит, поэтому правило подавления заглушило предупреждения: смотреть задержку, когда сайт не отвечает, незачем.');
      }
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function refresh() {
      var r = draw(); describe(r);
      btns.forEach(function (b) { b.el.classList.toggle('mon3-on', b.get()); });
    }
    ALERTS.forEach(function (a) {
      var el = v.button(a.n, function () { on[a.n] = !on[a.n]; refresh(); });
      btns.push({ el: el, get: function () { return !!on[a.n]; } });
    });
    var bi = v.button('Подавление при падении магазина', function () { inhibit = !inhibit; refresh(); });
    btns.push({ el: bi, get: function () { return inhibit; } });
    var bt = v.button('Опечатка в метке ошибок', function () { typo = !typo; refresh(); });
    btns.push({ el: bt, get: function () { return typo; } });
    v.tryIt('включи <code>LabShopDown</code> вместе с предупреждениями: они пропадут. Потом включи опечатку в метке и посмотри, куда пойдёт критичный алерт.');
    v.onResize(refresh);
    refresh();
  };

  /* ---------- mon3-burn ---------- */
  L.widgets['mon3-burn'] = function (host) {
    var v = L.setup(host, host.dataset.title || 'Сгорание бюджета: два окна');
    var ratio = 50, dur = 4, BASE = 0.2, BUDGET = 1, FAST = 14.4, T = 120;
    function avg(win) {
      var bad = Math.min(dur, win), good = win - bad;
      return (bad * ratio + good * BASE) / win;
    }
    function draw() {
      var H = 250, W = v.canvas(H), left = 44, right = W - 12, top = 18, bottom = 130, YM = 60;
      function X(m) { return left + (m + T) / T * (right - left); }
      function Y(y) { return bottom - Math.min(y, YM) / YM * (bottom - top); }
      [0, 20, 40, 60].forEach(function (tk) { v.add('line', { x1: left, x2: right, y1: Y(tk), y2: Y(tk), class: 'grid' }); v.label(left - 5, Y(tk) + 4, tk + '%', 'muted small', 'end'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      [-120, -90, -60, -30, 0].forEach(function (m) { v.label(X(m), bottom + 16, m === 0 ? 'сейчас' : m + ' мин', 'muted small', m === -120 ? 'start' : m === 0 ? 'end' : 'middle'); });
      var d = Math.min(dur, T), pts = X(-T) + ',' + Y(BASE) + ' ' + X(-d) + ',' + Y(BASE) + ' ' + X(-d) + ',' + Y(ratio) + ' ' + X(0) + ',' + Y(ratio);
      v.add('polyline', { points: pts, class: 'response stroke' });
      v.add('line', { x1: left, x2: right, y1: Y(FAST), y2: Y(FAST), class: 'warning marker' });
      v.label(left + 4, Y(FAST) - 5, 'порог 14,4%', 'warning halo small', 'start');
      v.label(left, top - 5, 'доля ошибок, %', 'muted small', 'start');
      v.add('rect', { x: X(-60), y: bottom + 26, width: X(0) - X(-60), height: 8, rx: 3, class: 'box' });
      v.label(X(-30), bottom + 52, 'окно 1 час', 'muted small', 'middle');
      v.add('rect', { x: X(-5), y: bottom + 40, width: X(0) - X(-5), height: 8, rx: 3, class: 'violet fill' });
      v.label(X(-5), bottom + 66, 'окно 5 минут', 'muted small', 'end');
    }
    function describe() {
      var a1 = avg(60), a5 = avg(5), f1 = a1 > FAST, f5 = a5 > FAST, fire = f1 && f5;
      var s = [];
      s.push('За 5 минут ошибок <b>' + fmt(a5, 1) + '%</b> (' + (f5 ? 'выше' : 'ниже') + ' порога), за час <b>' + fmt(a1, 1) + '%</b> (' + (f1 ? 'выше' : 'ниже') + ' порога).');
      s.push(fire ? 'Оба окна выше порога: правило сработает (после <code>for</code>) и разбудит дежурного.' :
        !f5 && f1 ? 'За час много, но прямо сейчас уже тихо: беда закончилась, будить незачем.' :
        f5 ? 'Сейчас плохо, но за час вклад небольшой: это всплеск. Пять минут подряд не повод звонить, а если он затянется, окно часа дойдёт до порога.' : 'Всё в норме.');
      var burn = Math.max(a1, a5) / BUDGET;
      s.push('Темп расхода бюджета (при SLO 99%) по большему окну: в <b>' + fmt(burn, 1) + '</b> раза быстрее нормы.');
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function refresh() { draw(); describe(); }
    v.slider('Доля ошибок в беде', 1, 60, 1, ratio, function (n) { ratio = n; refresh(); }, '%');
    v.slider('Беда длится', 1, 120, 1, dur, function (n) { dur = n; refresh(); }, 'мин');
    v.tryIt('посмотри на 50% ошибок в течение 4 минут: окно часа не дойдёт до порога. Потом растягивай беду по одной минуте и поймай момент, когда проснутся оба окна. Подними долю до 60% и посмотри, как этот момент сдвинется.');
    v.onResize(refresh);
    refresh();
  };
})();
