/* Виджеты урока 5.4 «Изменения без аварий и аварийное восстановление» курса «Мониторинг»: регистрируются через window.LTViz. Префикс rel-.

   rel-rollout: плохая версия уходит всем сразу или ступенями (canary) и откатывается, когда беду заметили.
    Считает расход месячного бюджета ошибок (SLO 99%, 30 дней, 432 минуты).
     data-error   доля ошибок новой версии, % (по умолчанию 20)
     data-detect  через сколько минут после начала выкатки заметили беду (по умолчанию 4)
   rel-dr: RPO и RTO на одной линии времени: копия, авария, восстановление.
     data-interval  интервал копий, минут (по умолчанию 60)
     data-restore   сколько минут идёт само восстановление (по умолчанию 8)
     data-rpo, data-rto  цели в минутах (по умолчанию 15 и 45) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var num = L.num, fmt = L.fmt, esc = L.esc;

  /* ---------- rel-rollout ---------- */
  L.widgets['rel-rollout'] = function (host) {
    var err = num(host.dataset.error, 20, 1, 100), detect = num(host.dataset.detect, 4, 1, 30);
    var v = L.setup(host, host.dataset.title || 'Плохая выкатка: сразу всем или ступенями');
    var T = 30, BUDGET = 432, BACK = 2, geo = null;
    // Доля трафика на новой версии: канарейка идёт ступенями, откат возвращает ноль.
    function shareFull(t) { return t < detect + BACK ? 1 : 0; }
    function shareCanary(t) {
      if (t >= detect + BACK) return 0;
      return t < 5 ? 0.05 : t < 10 ? 0.25 : t < 15 ? 0.5 : 1;
    }
    function spent(share, upto) {
      var s = 0, dt = 0.05;
      for (var t = 0; t < upto; t += dt) s += share(t) * err / 100 * dt;
      return s / BUDGET * 100;
    }
    function draw(pin) {
      var H = 290, W = v.canvas(H), l = 58, r = W - 14, top = 26, bottom = 190;
      var maxV = Math.max(spent(shareFull, T), 0.001), sc = L.scale(maxV);
      function X(t) { return l + t / T * (r - l); }
      function Y(n) { return bottom - n / sc.max * (bottom - top); }
      sc.ticks.forEach(function (tk) {
        v.add('line', { x1: l, x2: r, y1: Y(tk), y2: Y(tk), class: 'grid' });
        v.label(l - 6, Y(tk) + 4, fmt(tk, tk < 1 ? 3 : 1), 'muted small', 'end');
      });
      v.add('path', { d: 'M' + l + ' ' + top + 'V' + bottom + 'H' + r, class: 'axis' });
      v.label(l, top - 10, 'потрачено бюджета за месяц, %', 'muted small', 'start');
      for (var m = 0; m <= T; m += 5) v.label(X(m), bottom + 16, m + ' мин', 'muted small', m === 0 ? 'start' : m === T ? 'end' : 'middle');
      // Ступени canary полосой снизу.
      [[0, 5, '5%'], [5, 10, '25%'], [10, 15, '50%'], [15, T, '100%']].forEach(function (s) {
        var a = Math.min(s[0], detect + BACK), b = Math.min(s[1], detect + BACK);
        v.add('rect', { x: X(s[0]), y: bottom + 28, width: X(s[1]) - X(s[0]) - 2, height: 18, rx: 3, class: a < b ? 'violet fill' : 'box', opacity: a < b ? 0.8 : 1 });
        v.label((X(s[0]) + X(s[1])) / 2, bottom + 41, s[2], 'muted small');
      });
      v.label(l - 6, bottom + 41, 'canary', 'muted small', 'end');
      var stopX = X(detect + BACK);
      v.add('line', { x1: stopX, x2: stopX, y1: top, y2: bottom, class: 'warning marker' });
      v.label(Math.min(stopX + 4, r - 40), top + 10, 'откат готов', 'warning halo small', stopX > r - 90 ? 'end' : 'start');
      function curve(share, cls) {
        var pts = [];
        for (var t = 0; t <= T + 1e-9; t += 0.5) pts.push(X(t).toFixed(1) + ',' + Y(spent(share, t)).toFixed(1));
        v.add('polyline', { points: pts.join(' '), class: cls + ' stroke' });
      }
      curve(shareFull, 'danger');
      curve(shareCanary, 'primary');
      v.label(r, Y(spent(shareFull, T)) - 6, 'сразу всем', 'danger small', 'end');
      v.label(r, Y(spent(shareCanary, T)) + 14, 'canary', 'primary small', 'end');
      if (pin != null) {
        v.add('line', { x1: X(pin), x2: X(pin), y1: top, y2: bottom, class: 'muted marker' });
      }
      geo = { X: X, l: l, r: r };
    }
    function describe() {
      var a = spent(shareFull, T), b = spent(shareCanary, T);
      var days = 0.3 / (err / 100);
      var s = ['При <b>' + fmt(err, 0) + '%</b> ошибок и обнаружении за <b>' + fmt(detect, 0) + ' мин</b> выкатка сразу всем съела <b>' + fmt(a, a < 1 ? 3 : 2) + '%</b> месячного бюджета, а canary с теми же настройками <b>' + fmt(b, b < 1 ? 3 : 2) + '%</b>.'];
      s.push(err > 1 ? 'Если не откатывать, бюджет месяца кончится примерно за <b>' + fmt(days, days < 10 ? 1 : 0) + ' ' + L.plural(Math.round(days), 'сутки', 'суток', 'суток') + '</b>: поэтому такую беду откатывают сразу, а не «посмотрим ещё».' : 'При 1% ошибок бюджет уходит ровно с нормальной скоростью: это не авария.');
      s.push('Canary выигрывает, пока заметили быстро: чем дольше ты ждёшь, тем ближе ступени к 100%, и разница пропадает. Проверь, что ты замечаешь беду именно на малой доле трафика: общий график ошибок при 5% трафика почти не изменится.');
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function refresh() { draw(null); describe(); }
    v.slider('Доля ошибок новой версии', 1, 100, 1, err, function (n) { err = n; refresh(); }, '%');
    v.slider('Заметили через', 1, 30, 1, detect, function (n) { detect = n; refresh(); }, 'мин');
    v.hover(function (e, q) {
      if (!geo) return;
      var t = Math.max(0, Math.min(T, (q.x - geo.l) / (geo.r - geo.l) * T));
      draw(t);
      v.showTip('<b>Минута ' + fmt(t, 1) + '</b><br>Сразу всем: <b>' + fmt(spent(shareFull, t), 3) + '%</b> бюджета<br>Canary: <b>' + fmt(spent(shareCanary, t), 3) + '%</b><br>Доля новой версии при canary: ' + fmt(shareCanary(t) * 100, 0) + '%', e.clientX, e.clientY);
    }, function () { draw(null); });
    v.tryIt('поставь «заметили через» 20 минут: линии почти сойдутся, потому что canary дошёл до 100%. Верни 3 минуты и подними долю ошибок до 60%: беда та же, но canary зацепит только малую часть покупателей.');
    v.onResize(refresh);
    refresh();
  };

  /* ---------- rel-dr ---------- */
  L.widgets['rel-dr'] = function (host) {
    var interval = num(host.dataset.interval, 60, 5, 240), restore = num(host.dataset.restore, 8, 1, 120);
    var rpoT = num(host.dataset.rpo, 15, 1, 240), rtoT = num(host.dataset.rto, 45, 1, 240), at = 100;
    var v = L.setup(host, host.dataset.title || 'RPO и RTO на одной линии времени');
    // Этапы простоя, кроме самого восстановления: минуты.
    var STAGES = [['Заметили', 4], ['Собрали людей', 6], ['Нашли копию', 5], ['Восстановление', null], ['Проверили', 5], ['Переключили', 2]];
    var geo = null;
    function stages() { return STAGES.map(function (s) { return [s[0], s[1] == null ? restore : s[1]]; }); }
    function draw(pin) {
      var H = 230, W = v.canvas(H), l = 14, r = W - 14, y = 70, h = 34;
      var loss = interval * at / 100, st = stages(), down = st.reduce(function (a, s) { return a + s[1]; }, 0);
      var total = loss + down, k = (r - l) / Math.max(total, 1);
      var x0 = l, segs = [];
      // Левая часть: данные после последней копии, их потеряем.
      segs.push({ name: 'Данные после последней копии (потеряны)', len: loss, cls: loss > rpoT ? 'danger fill' : 'warning fill' });
      st.forEach(function (s) { segs.push({ name: s[0], len: s[1], cls: 'primary fill' }); });
      var x = x0;
      segs.forEach(function (s) {
        s.x = x; s.w = s.len * k; x += s.w;
        v.add('rect', { x: s.x, y: y, width: Math.max(s.w - 1, 1), height: h, rx: 4, class: s.cls, opacity: 0.85 });
        if (s.w > 46) v.label(s.x + s.w / 2, y + h / 2 + 4, fmt(s.len, 0) + ' мин', 'small');
      });
      var crashX = x0 + loss * k;
      v.add('line', { x1: x0, x2: x0, y1: y - 24, y2: y + h + 10, class: 'ok marker' });
      v.label(x0 + 4, y - 30, 'последняя копия', 'muted small', 'start');
      v.add('line', { x1: crashX, x2: crashX, y1: y - 24, y2: y + h + 10, class: 'danger marker' });
      v.label(crashX, y - 30, 'авария', 'danger small', crashX < l + 40 ? 'start' : 'middle');
      v.add('line', { x1: r, x2: r, y1: y - 24, y2: y + h + 10, class: 'ok marker' });
      v.label(r, y - 30, 'сервис вернулся', 'muted small', 'end');
      // Скобки RPO и RTO.
      v.add('path', { d: 'M' + x0 + ' ' + (y + h + 28) + 'H' + crashX, class: (loss > rpoT ? 'danger' : 'ok') + ' stroke', 'stroke-width': 3 });
      v.label(x0, y + h + 48, 'потеря данных (RPO): ' + fmt(loss, 0) + ' мин, цель ' + fmt(rpoT, 0), (loss > rpoT ? 'danger' : 'ok') + ' small', 'start');
      v.add('path', { d: 'M' + crashX + ' ' + (y + h + 66) + 'H' + r, class: (down > rtoT ? 'danger' : 'ok') + ' stroke', 'stroke-width': 3 });
      v.label(r, y + h + 86, 'простой (RTO): ' + fmt(down, 0) + ' мин, цель ' + fmt(rtoT, 0), (down > rtoT ? 'danger' : 'ok') + ' small', 'end');
      if (pin != null) v.add('line', { x1: pin, x2: pin, y1: y - 6, y2: y + h + 6, class: 'muted marker' });
      geo = { segs: segs, loss: loss, down: down };
      return { loss: loss, down: down };
    }
    function describe(res) {
      var s = [];
      s.push('Копии каждые <b>' + fmt(interval, 0) + ' мин</b>, авария на ' + fmt(at, 0) + '% пути до следующей: потеряно <b>' + fmt(res.loss, 0) + ' мин</b> записей. ' + (res.loss > rpoT ? 'Цель RPO ' + fmt(rpoT, 0) + ' мин не выполнена: нужны копии чаще.' : 'Цель RPO выполнена.'));
      s.push('Простой <b>' + fmt(res.down, 0) + ' мин</b>, из них само восстановление только ' + fmt(restore, 0) + '. ' + (res.down > rtoT ? 'Цель RTO ' + fmt(rtoT, 0) + ' мин не выполнена: смотри, какие этапы можно сократить.' : 'Цель RTO выполнена.'));
      s.push('RPO считают по худшему случаю, когда авария случилась прямо перед следующей копией. Передвинь ползунок аварии: потеря меняется, расписание нет.');
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function refresh() { describe(draw(null)); }
    v.slider('Интервал между копиями', 5, 240, 5, interval, function (n) { interval = n; refresh(); }, 'мин');
    v.slider('Авария на пути между копиями', 0, 100, 5, at, function (n) { at = n; refresh(); }, '%');
    v.slider('Само восстановление', 1, 120, 1, restore, function (n) { restore = n; refresh(); }, 'мин');
    v.hover(function (e, q) {
      if (!geo) return;
      var hit = geo.segs.filter(function (s) { return q.x >= s.x && q.x <= s.x + s.w; })[0];
      draw(q.x);
      if (hit) v.showTip('<b>' + esc(hit.name) + '</b><br>' + fmt(hit.len, 0) + ' мин', e.clientX, e.clientY);
    }, function () { draw(null); });
    v.tryIt('поставь копии раз в 5 минут и аварию на 100%: потеря станет мала, а простой всё равно 30 минут. Потом верни 60 минут и сократи восстановление до 1 минуты: RTO почти не изменится, потому что дело не в самой команде восстановления.');
    v.onResize(refresh);
    refresh();
  };
})();
