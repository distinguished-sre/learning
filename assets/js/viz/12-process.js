/* Виджеты темы 12 «Нагрузочное тестирование как процесс»: регистрируются через window.LTViz.
   Имена с префиксом proc-. Модели упрощены для объяснения, это не измерения учебного сервиса.

   proc-ci-history: история прогонов нагрузочного smoke по коммитам, порог и шум раннера.
     data-base       обычный p95 здорового кода, мс (по умолчанию 260)
     data-noise      разброс раннера, % (3-40, по умолчанию 12)
     data-regress    насколько регресс замедляет код, % (0-150, по умолчанию 40)
     data-at         номер коммита, в который внесён регресс (5-26, по умолчанию 18)
     data-threshold  порог сборки, мс (150-800, по умолчанию 400)
     data-retries    повторов при красном (0-2, по умолчанию 0)
   proc-capacity: когда кончится запас ёмкости при росте трафика.
     data-peak       пик сегодня, RPS (по умолчанию 90)
     data-capacity   ёмкость по SLO из stress-теста, RPS (по умолчанию 200)
     data-growth     рост пика в месяц, % (по умолчанию 6)
     data-target     рабочая загрузка от ёмкости, % (по умолчанию 70)
     data-season     множитель пика во время акции (по умолчанию 1.8)
     data-season-month  через сколько месяцев акция (по умолчанию 1)
     data-boost      прирост ёмкости от оптимизации, % (по умолчанию 0) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt;

  var css = [
    '.proc-lg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;font-size:.85rem;color:var(--muted)}',
    '.proc-lg span{display:inline-flex;align-items:center;gap:6px}',
    '.proc-lg i{display:inline-block;width:12px;height:12px;border-radius:50%;background:currentColor}',
    '.proc-lg i.ln{height:3px;border-radius:2px;width:16px}',
    '.proc-lg .g{color:var(--green)}.proc-lg .r{color:var(--red)}.proc-lg .y{color:var(--yellow)}.proc-lg .b{color:var(--blue)}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('proc-viz-style')) return;
    var s = document.createElement('style'); s.id = 'proc-viz-style'; s.textContent = css; document.head.appendChild(s);
  }
  function legend(items) {
    var d = html('div', undefined, 'proc-lg');
    items.forEach(function (it) {
      var s = html('span', undefined, it[0]); s.appendChild(html('i', undefined, it[2] || ''));
      s.appendChild(document.createTextNode(it[1])); d.appendChild(s);
    });
    return d;
  }
  // Детерминированный генератор: слайдеры не перемешивают «случайность», кадр при reduced motion стабилен.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function pctStr(x) { return fmt(x, 0) + '%'; }

  /* ---------- proc-ci-history ---------- */
  L.widgets['proc-ci-history'] = function (host) {
    injectStyle();
    var N = 30, MAXTRY = 3;
    var base = num(host.dataset.base, 260, 50, 2000), noise = num(host.dataset.noise, 12, 3, 40);
    var reg = num(host.dataset.regress, 40, 0, 150), thr = num(host.dataset.threshold, 400, 150, 800);
    var retries = Math.round(num(host.dataset.retries, 0, 0, 2)), at = Math.round(num(host.dataset.at, 18, 5, 26));
    var v = L.setup(host, host.dataset.title || 'Регресс в CI: история прогонов по коммитам');
    var rand = rng(2026), z = [], sp = [], i, a;
    for (i = 0; i < N; i++) {
      z[i] = []; sp[i] = [];
      for (a = 0; a < MAXTRY; a++) { z[i][a] = Math.max(-2.2, Math.min(2.2, gauss(rand))); sp[i][a] = rand() < 0.08 ? 0.4 + 0.4 * rand() : 0; }
    }
    var shown = 0, geo = {}, hoverI = null;
    function value(c, t) {
      var lat = base * (c >= at - 1 ? 1 + reg / 100 : 1);
      return Math.max(20, lat * (1 + noise / 100 * z[c][t] + Math.min(1, noise / 12) * sp[c][t]));
    }
    function run(c) {
      var tries = [], ok = false;
      for (var t = 0; t <= retries; t++) {
        var x = value(c, t); tries.push(x);
        if (x <= thr) { ok = true; break; }
      }
      return { tries: tries, val: tries[tries.length - 1], ok: ok };
    }
    function stats() {
      var s = { healthy: 0, falseRed: 0, bad: 0, caught: 0, missed: 0, first: 0 }, c;
      for (c = 0; c < Math.floor(shown); c++) {
        var r = run(c);
        if (c < at - 1 || reg === 0) { s.healthy++; if (!r.ok) s.falseRed++; }
        else { s.bad++; if (!r.ok) { s.caught++; if (!s.first) s.first = c + 1; } else s.missed++; }
      }
      return s;
    }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var H = narrow ? 300 : 320, W = v.canvas(H), left = narrow ? 40 : 48, right = W - 10, top = 26, bottom = H - 50;
      var all = []; for (var c = 0; c < N; c++) all.push(run(c).val);
      var yMax = L.scale(Math.max(thr * 1.15, Math.max.apply(null, all) * 1.05, base * (1 + reg / 100) * 1.3), false).max;
      function X(k) { return left + (k + 0.5) / N * (right - left); }
      function Y(val) { return bottom - Math.min(val, yMax) / yMax * (bottom - top); }
      geo = { left: left, right: right, top: top, bottom: bottom };
      if (reg > 0) {
        v.add('rect', { x: X(at - 1) - (right - left) / N / 2, y: top, width: right - (X(at - 1) - (right - left) / N / 2), height: bottom - top, class: 'danger zone' });
        v.label(right - 4, top + 14, 'код медленнее на ' + pctStr(reg), 'danger small halo', 'end');
      }
      var g, ticks = L.scale(yMax, false).ticks;
      ticks.forEach(function (t) {
        v.add('line', { x1: left, x2: right, y1: Y(t), y2: Y(t), class: 'grid' });
        v.label(left - 6, Y(t) + 5, fmt(t, 0), 'muted small', 'end');
      });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.label(left, top - 10, 'p95 прогона, мс', 'muted small', 'start');
      for (g = 1; g <= N; g++) if (g === 1 || g % 5 === 0) v.label(X(g - 1), bottom + 18, String(g), 'muted small');
      v.label((left + right) / 2, bottom + 40, 'номер коммита', 'muted small');
      v.add('line', { x1: left, x2: right, y1: Y(base), y2: Y(base), class: 'muted marker' });
      v.label(left + 4, Y(base) + 15, 'обычный p95 ' + fmt(base, 0), 'muted small halo', 'start');
      v.add('line', { x1: left, x2: right, y1: Y(thr), y2: Y(thr), class: 'danger marker' });
      v.label(left + 4, Y(thr) - 6, 'порог ' + fmt(thr, 0) + ' мс', 'danger small halo', 'start');
      var rr = narrow ? 4 : 5;
      for (c = 0; c < Math.floor(shown); c++) {
        var r = run(c);
        for (var t = 0; t < r.tries.length - 1; t++) v.add('circle', { cx: X(c), cy: Y(r.tries[t]), r: rr - 1, class: 'danger stroke', fill: 'none', 'stroke-width': 1.5, opacity: 0.6 });
        v.add('circle', { cx: X(c), cy: Y(r.val), r: rr, class: (r.ok ? 'ok' : 'danger') + ' fill' });
      }
      if (hoverI !== null) v.add('line', { x1: X(hoverI), x2: X(hoverI), y1: top, y2: bottom, class: 'muted marker' });
    }
    function describe() {
      var s = stats(), done = Math.floor(shown);
      var txt = 'Обычный p95 здорового кода <b>' + fmt(base, 0) + ' мс</b>, раннер даёт разброс около <b>±' + fmt(noise, 0) + '%</b>, порог сборки <b>' + fmt(thr, 0) + ' мс</b> (это на ' + pctStr((thr / base - 1) * 100) + ' выше обычного). ';
      if (done < 1) { v.explain(txt); return; }
      txt += 'Из <b>' + s.healthy + '</b> здоровых коммитов красными стали <b>' + s.falseRed + '</b>: это ложные тревоги. ';
      if (reg > 0) {
        if (s.bad === 0) txt += 'Регресс +' + pctStr(reg) + ' ещё не появился на графике.';
        else txt += 'С коммита <b>№' + at + '</b> код медленнее на <b>' + pctStr(reg) + '</b> (в среднем ' + fmt(base * (1 + reg / 100), 0) + ' мс). Красных среди таких коммитов: <b>' + s.caught + ' из ' + s.bad + '</b>' +
          (s.first ? ', первая красная сборка на коммите №' + s.first : ', пока ни одной красной') + '; пропущено (зелёных): <b>' + s.missed + '</b>.';
      } else txt += 'Регресса нет: любая красная сборка здесь ложная.';
      if (done >= N) {
        if (s.falseRed > 0 && s.missed > 0) txt += '<br>Порог шумит в обе стороны: и кричит зря, и пропускает настоящее. Нужен порог с запасом над разбросом и достаточно длинный прогон.';
        else if (s.falseRed > 0) txt += '<br>Порог слишком близко к обычному разбросу: красный перестанут принимать всерьёз.';
        else if (s.missed > 0) txt += '<br>Порог слишком далеко: регресс проскочил. Запас нужен, но не бесконечный.';
        else if (reg > 0) txt += '<br>Порог поймал регресс и не поднял ложных тревог при таком шуме.';
      }
      v.explain(txt);
    }
    function refresh() { draw(); describe(); }
    v.slider('Шум раннера', 3, 40, 1, noise, function (n) { noise = n; refresh(); }, '%');
    v.slider('Регресс кода', 0, 150, 5, reg, function (n) { reg = n; refresh(); }, '%');
    v.slider('Порог', 150, 800, 10, thr, function (n) { thr = n; refresh(); }, 'мс');
    v.slider('Повторов при красном', 0, 2, 1, retries, function (n) { retries = Math.round(n); refresh(); }, '');
    v.tryIt('опусти порог к 280 мс: здоровые сборки начнут краснеть. Подними до 600: регресс +40% проскочит. Потом верни порог 400, подними шум до 30% и включи повтор: ложных тревог станет меньше, зато цена повтора это время и риск пропустить слабый регресс. Наведи на любой коммит.');
    var ctl = L.animate(v, function (dt) { shown = Math.min(N, shown + dt * 5); refresh(); return shown < N; },
      function () { shown = N; refresh(); }, function () { shown = 0; });
    v.stage.parentNode.insertBefore(legend([['g', 'прогон зелёный', ''], ['r', 'прогон красный', ''], ['r', 'порог', 'ln']]), v.stage.nextSibling);
    v.hover(function (e, q) {
      var k = Math.max(0, Math.min(N - 1, Math.floor((q.x - geo.left) / (geo.right - geo.left) * N)));
      if (k >= Math.floor(shown)) { hoverI = null; draw(); v.showTip('Этот коммит ещё не прогнан', e.clientX, e.clientY); return; }
      hoverI = k; draw();
      var r = run(k), t = '<b>Коммит №' + (k + 1) + '</b>' + (k >= at - 1 && reg > 0 ? ' (с регрессом)' : ' (здоровый)') + '<br>';
      t += r.tries.map(function (x, n) { return 'попытка ' + (n + 1) + ': ' + fmt(x, 0) + ' мс'; }).join('<br>') + '<br>';
      t += r.ok ? 'итог: зелёный' : 'итог: красный';
      v.showTip(t, e.clientX, e.clientY);
    }, function () { hoverI = null; draw(); });
    refresh(); v.onResize(draw);
    void ctl;
  };

  /* ---------- proc-capacity ---------- */
  L.widgets['proc-capacity'] = function (host) {
    injectStyle();
    var M = 18;
    var peak = num(host.dataset.peak, 90, 20, 300), cap = num(host.dataset.capacity, 200, 60, 500);
    var growth = num(host.dataset.growth, 6, 0, 15), target = num(host.dataset.target, 70, 50, 90);
    var season = num(host.dataset.season, 1.8, 1, 3), sm = Math.round(num(host.dataset.seasonMonth, 1, 0, 12));
    var boost = num(host.dataset.boost, 0, 0, 100), linear = false;
    var v = L.setup(host, host.dataset.title || 'Прогноз ёмкости: когда кончится запас');
    var shown = 0, geo = {}, hoverM = null;
    function level() { return cap * (1 + boost / 100); }
    function work() { return level() * target / 100; }
    function at(m) { return linear ? peak * (1 + growth / 100 * m) : peak * Math.pow(1 + growth / 100, m); }
    function cross(lv) {
      if (peak >= lv) return 0;
      if (growth <= 0) return Infinity;
      return linear ? (lv / peak - 1) / (growth / 100) : Math.log(lv / peak) / Math.log(1 + growth / 100);
    }
    function when(m) { if (m === Infinity) return 'никогда при таком росте'; return m > M ? 'позже, чем через ' + M + ' мес' : 'через ' + fmt(m, 1) + ' мес'; }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var H = narrow ? 300 : 330, W = v.canvas(H), left = narrow ? 40 : 48, right = W - 12, top = 26, bottom = H - 48;
      var seasonVal = at(sm) * season;
      var yMax = L.scale(Math.max(level() * 1.2, seasonVal * 1.1, at(M) * 1.05), false).max;
      function X(m) { return left + m / M * (right - left); }
      function Y(val) { return bottom - Math.min(val, yMax) / yMax * (bottom - top); }
      geo = { left: left, right: right, top: top, bottom: bottom, X: X };
      v.add('rect', { x: left, y: Y(work()), width: right - left, height: bottom - Y(work()), class: 'ok zone' });
      v.add('rect', { x: left, y: Y(level()), width: right - left, height: Y(work()) - Y(level()), class: 'warning zone' });
      v.add('rect', { x: left, y: top, width: right - left, height: Y(level()) - top, class: 'danger zone' });
      L.scale(yMax, false).ticks.forEach(function (t) {
        v.add('line', { x1: left, x2: right, y1: Y(t), y2: Y(t), class: 'grid' });
        v.label(left - 6, Y(t) + 5, fmt(t, 0), 'muted small', 'end');
      });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.label(left, top - 10, 'пик нагрузки, RPS', 'muted small', 'start');
      for (var m = 0; m <= M; m += (narrow ? 3 : 2)) v.label(X(m), bottom + 18, String(m), 'muted small');
      v.label((left + right) / 2, bottom + 40, 'месяцев от сегодня', 'muted small');
      v.add('line', { x1: left, x2: right, y1: Y(level()), y2: Y(level()), class: 'danger marker' });
      v.label(right - 4, Y(level()) - 6, 'ёмкость ' + fmt(level(), 0), 'danger small halo', 'end');
      v.add('line', { x1: left, x2: right, y1: Y(work()), y2: Y(work()), class: 'warning marker' });
      v.label(right - 4, Y(work()) - 6, 'граница ' + fmt(target, 0) + '%: ' + fmt(work(), 0), 'warning small halo', 'end');
      var pts = [], last = Math.min(shown, M);
      for (var k = 0; k <= Math.floor(last); k++) pts.push(X(k) + ',' + Y(at(k)));
      if (last > Math.floor(last)) pts.push(X(last) + ',' + Y(at(last)));
      if (pts.length > 1) v.add('polyline', { points: pts.join(' '), class: 'response stroke' });
      if (shown >= sm && sm <= M && season > 1) {
        v.add('line', { x1: X(sm), x2: X(sm), y1: Y(at(sm)), y2: Y(seasonVal), class: 'violet stroke', 'stroke-width': 2 });
        v.add('circle', { cx: X(sm), cy: Y(seasonVal), r: 6, class: 'violet fill' });
        v.label(X(sm) + 10, Y(seasonVal) + 4, 'акция ×' + fmt(season, 1) + ': ' + fmt(seasonVal, 0), 'violet small halo', 'start');
      }
      if (hoverM !== null) v.add('line', { x1: X(hoverM), x2: X(hoverM), y1: top, y2: bottom, class: 'muted marker' });
    }
    function describe() {
      var lv = level(), wk = work(), mw = cross(wk), ml = cross(lv), yearV = at(12), sv = at(sm) * season;
      var t = 'Сегодня пик <b>' + fmt(peak, 0) + ' RPS</b>, ёмкость <b>' + fmt(lv, 0) + ' RPS</b>: загрузка <b>' + pctStr(peak / lv * 100) + '</b>. ' +
        (linear ? 'Рост по прямой' : 'Рост') + ' <b>' + fmt(growth, 0) + '% в месяц</b>: до рабочей границы (' + fmt(target, 0) + '% ёмкости, ' + fmt(wk, 0) + ' RPS) пик дойдёт <b>' + when(mw) + '</b>, ' +
        'до самого предела <b>' + when(ml) + '</b>. Через год пик <b>' + fmt(yearV, 0) + ' RPS</b>, то есть ' + pctStr(yearV / lv * 100) + ' ёмкости.';
      if (season > 1 && sm <= M) {
        t += '<br>Акция ×' + fmt(season, 1) + ' в месяце ' + sm + ': пик <b>' + fmt(sv, 0) + ' RPS</b> (' + pctStr(sv / lv * 100) + ' ёмкости), ' +
          (sv > lv ? 'это <b>выше предела</b>: сервис ляжет.' : sv > wk ? 'это выше рабочей границы: выдержим, но без запаса на неожиданность.' : 'укладываемся в запас.');
      }
      var need = Math.max(sv, at(12)) / (target / 100);
      if (need > lv) t += '<br>Чтобы и акция, и пик через год укладывались в границу, нужна ёмкость не меньше <b>' + fmt(need, 0) + ' RPS</b>: это ещё <b>+' + fmt((need / lv - 1) * 100, 0) + '%</b> к нынешней. Либо оптимизация, либо больше ресурсов.';
      else t += '<br>Ёмкости хватает и на акцию, и на пик через год с запасом до границы.';
      v.explain(t);
    }
    function refresh() { draw(); describe(); }
    v.slider('Пик сегодня', 20, 300, 5, peak, function (n) { peak = n; refresh(); }, 'RPS');
    v.slider('Ёмкость по SLO', 60, 500, 10, cap, function (n) { cap = n; refresh(); }, 'RPS');
    v.slider('Рост в месяц', 0, 15, 1, growth, function (n) { growth = n; refresh(); }, '%');
    v.slider('Граница загрузки', 50, 90, 5, target, function (n) { target = n; refresh(); }, '%');
    v.slider('Пик акции', 1, 3, 0.1, season, function (n) { season = n; refresh(); }, '×');
    v.slider('Прирост ёмкости', 0, 100, 5, boost, function (n) { boost = n; refresh(); }, '%');
    var modeBtn = v.button('Рост: сложный процент', function () {
      linear = !linear; modeBtn.textContent = linear ? 'Рост: по прямой' : 'Рост: сложный процент'; refresh();
    });
    v.tryIt('подними рост до 10% в месяц: запас сгорит вдвое быстрее. Нажми кнопку роста: прямая даёт более позднюю дату, чем сложный процент, и ошибается в оптимистичную сторону. Подвигай «Прирост ёмкости»: так выглядит эффект индекса или лишнего воркера.');
    var ctl = L.animate(v, function (dt) { shown = Math.min(M, shown + dt * 3.5); refresh(); return shown < M; },
      function () { shown = M; refresh(); }, function () { shown = 0; });
    v.stage.parentNode.insertBefore(legend([['b', 'ожидаемый пик', 'ln'], ['y', 'рабочая граница', 'ln'], ['r', 'ёмкость по SLO', 'ln']]), v.stage.nextSibling);
    v.hover(function (e, q) {
      var m = Math.max(0, Math.min(M, Math.round((q.x - geo.left) / (geo.right - geo.left) * M)));
      hoverM = m; draw();
      var val = at(m), lv = level();
      var st = val > lv ? 'выше ёмкости' : val > work() ? 'выше рабочей границы' : 'в запасе';
      v.showTip('<b>Месяц ' + m + '</b><br>пик ' + fmt(val, 0) + ' RPS<br>' + pctStr(val / lv * 100) + ' ёмкости: ' + st +
        (m === sm && season > 1 ? '<br>с акцией: ' + fmt(val * season, 0) + ' RPS' : ''), e.clientX, e.clientY);
    }, function () { hoverM = null; draw(); });
    refresh(); v.onResize(draw);
    void ctl;
  };
})();
