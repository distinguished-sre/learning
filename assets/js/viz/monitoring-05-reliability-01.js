/* Виджеты урока 5.1 «Инцидент: от алерта до восстановления» курса «Мониторинг»: регистрируются через window.LTViz. Префикс mon5-.

   mon5-timeline: хронология инцидента с MTTD, MTTA, MTTI, MTTM и MTTR на одной оси и расходом месячного бюджета ошибок.
    Ползунки задают длину каждого этапа и долю ошибок. Начало отсчёта 11:30 (диск базы заполнился), SLO 99,9% за 30 дней.
     data-start   время начала, минут от полуночи (по умолчанию 690, то есть 11:30) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var fmt = L.fmt;

  var BUDGET = 43.2; /* 30 суток × 24 × 60 × 0,1% */
  var STAGES = [
    { k: 'MTTD', name: 'обнаружение', cls: 'danger', what: 'от начала сбоя до срабатывания алерта' },
    { k: 'MTTA', name: 'подтверждение', cls: 'warning', what: 'от алерта до того, как человек взял его в работу' },
    { k: 'MTTI', name: 'локализация', cls: 'violet', what: 'от подтверждения до ответа «что и где сломано»' },
    { k: 'MTTM', name: 'митигация', cls: 'primary', what: 'от найденной причины до снятия ущерба' }
  ];

  function clock(min) {
    var m = Math.round(min), h = Math.floor(m / 60) % 24, r = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (r < 10 ? '0' : '') + r;
  }

  /* ---------- mon5-timeline ---------- */
  L.widgets['mon5-timeline'] = function (host) {
    var v = L.setup(host, host.dataset.title || 'Хронология инцидента: где уходит время');
    var t0 = +host.dataset.start || 690;
    var d = [4, 2, 5, 10], fixLeft = 39, share = 20;
    function total() { return d[0] + d[1] + d[2] + d[3]; }
    function geo() {
      var cum = [0], i;
      for (i = 0; i < 4; i++) cum.push(cum[i] + d[i]);
      return { cum: cum, mttr: cum[4] + fixLeft };
    }
    function draw() {
      var g = geo(), H = 215, W = v.canvas(H), left = 12, right = W - 12, top = 40, bh = 34;
      function X(m) { return left + m / g.mttr * (right - left); }
      v.label(left, 16, 'начало ' + clock(t0) + ' (сбой)', 'muted small', 'start');
      v.label(right, 16, 'устранено ' + clock(t0 + g.mttr), 'muted small', 'end');
      STAGES.forEach(function (s, i) {
        var x1 = X(g.cum[i]), x2 = X(g.cum[i + 1]);
        v.add('rect', { x: x1, y: top, width: Math.max(1, x2 - x1 - 1), height: bh, rx: 4, class: s.cls + ' fill', opacity: 0.85 });
        if (x2 - x1 > 34) v.label((x1 + x2) / 2, top + 21, s.k, 'small', 'middle');
      });
      var xm = X(g.cum[4]), xe = X(g.mttr);
      v.add('rect', { x: xm, y: top, width: Math.max(1, xe - xm), height: bh, rx: 4, class: 'ok fill', opacity: 0.55 });
      if (xe - xm > 60) v.label((xm + xe) / 2, top + 21, 'устранение', 'small', 'middle');
      for (var i = 0; i <= 4; i++) v.add('line', { x1: X(g.cum[i]), x2: X(g.cum[i]), y1: top - 6, y2: top + bh + 6, class: 'muted marker' });
      v.label(X(g.cum[4]), top + bh + 22, 'ущерб снят ' + clock(t0 + g.cum[4]), 'small', g.cum[4] / g.mttr > 0.8 ? 'end' : 'middle');
      var y2 = top + bh + 40;
      v.add('line', { x1: left, x2: X(g.cum[4]), y1: y2, y2: y2, class: 'primary stroke' });
      v.label(left, y2 + 16, 'MTTD + MTTA + MTTI + MTTM = ' + total() + ' мин с ущербом', 'small', 'start');
      var y3 = y2 + 34;
      v.add('line', { x1: left, x2: right, y1: y3, y2: y3, class: 'ok stroke' });
      v.label(left, y3 + 16, 'MTTR = ' + g.mttr + ' мин от начала до закрытия', 'small', 'start');
      return { X: X, g: g, left: left, right: right, top: top, bh: bh };
    }
    var geoNow;
    function describe() {
      var g = geo(), dmg = total() * share / 100, pct = dmg / BUDGET * 100, burn = share / 0.1;
      var s = [];
      s.push('Ущерб идёт <b>' + total() + ' мин</b> при <b>' + share + '%</b> ошибок: это ' + fmt(dmg, 1) + ' мин «полного отказа», то есть <b>' + fmt(pct, 1) + '%</b> месячного бюджета ' + fmt(BUDGET, 1) + ' мин (SLO 99,9%). Темп расхода в <b>' + fmt(burn, 0) + '</b> раз быстрее нормы.');
      s.push(pct > 100 ? 'Бюджет месяца исчерпан: по политике ошибок дальше стоят релизы.' : 'Самый длинный этап: ' + longest() + '. Сокращать нужно его.');
      s.push('MTTR (' + g.mttr + ' мин) длиннее суммы четырёх этапов на «устранение»: ущерб уже снят, но причину ещё чинят.');
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function longest() {
      var bi = 0;
      for (var i = 1; i < 4; i++) if (d[i] > d[bi]) bi = i;
      return STAGES[bi].k + ' (' + STAGES[bi].name + ', ' + d[bi] + ' мин)';
    }
    function refresh() { geoNow = draw(); describe(); }
    STAGES.forEach(function (s, i) {
      v.slider(s.k + ': ' + s.name, 1, 30, 1, d[i], function (n) { d[i] = n; refresh(); }, 'мин');
    });
    v.slider('Устранение после митигации', 0, 120, 1, fixLeft, function (n) { fixLeft = n; refresh(); }, 'мин');
    v.slider('Доля ошибок', 1, 100, 1, share, function (n) { share = n; refresh(); }, '%');
    v.tryIt('сократи MTTD с 4 до 1 минуты и посмотри на расход бюджета. Потом верни 4 и сократи «Устранение»: бюджет не изменится, а MTTR упадёт. Наведи на отрезки: увидишь, где этап начинается и заканчивается.');
    v.hover(function (e, q) {
      if (!geoNow) return;
      var g = geoNow.g, m = (q.x - geoNow.left) / (geoNow.right - geoNow.left) * g.mttr, i, s, txt;
      if (m < 0 || m > g.mttr) return v.hideTip();
      for (i = 0; i < 4; i++) if (m <= g.cum[i + 1]) break;
      if (i < 4) {
        s = STAGES[i];
        txt = '<b>' + s.k + ' (' + s.name + '): ' + d[i] + ' мин</b><br>' + clock(t0 + g.cum[i]) + ' – ' + clock(t0 + g.cum[i + 1]) + '<br>' + s.what;
      } else {
        txt = '<b>Устранение: ' + fixLeft + ' мин</b><br>' + clock(t0 + g.cum[4]) + ' – ' + clock(t0 + g.mttr) + '<br>ущерба уже нет, идёт полное исправление';
      }
      v.showTip(txt, e.clientX, e.clientY);
    });
    v.onResize(refresh);
    refresh();
  };
})();
