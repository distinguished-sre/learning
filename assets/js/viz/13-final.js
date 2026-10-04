/* Виджеты темы 13 «Финал: работа и собеседования»: регистрируются через window.LTViz. Префикс final-.
   Модели упрощены для объяснения, это не измерения учебного сервиса.

   final-incident-timeline: хронология инцидента «медленная оплата + пул БД»: p95, ошибки, алерты, откат.
     data-delay    задержка оплаты в мс (500-5000, по умолчанию 2000)
     data-react    через сколько минут после начала сбоя откатили (1-20, по умолчанию 9)
   final-day-plan: план тестового на 8 часов: сколько времени на каждый этап.
     data-plan     JSON-массив {"name","h","min"} - этап, часы по умолчанию, минимум часов (необязательно)
     data-total    сколько часов в запасе (по умолчанию 8)
   final-speed-quiz: тренажёр «на скорость»: случайный вопрос, таймер, ответ, счёт.
     data-questions  JSON-массив {"q","a"}
     data-seconds    время на ответ (10-120, по умолчанию 30) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt;

  var css = [
    '.fin-q{margin:0;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--bg-2)}',
    '.fin-q .fin-tag{margin:0 0 6px;font-size:.8rem;color:var(--muted)}',
    '.fin-q .fin-text{margin:0;font-size:1.05rem;font-weight:600;line-height:1.45;overflow-wrap:anywhere}',
    '.fin-a{margin:10px 0 0;padding:10px 12px;border-left:3px solid var(--green);background:var(--bg-code);border-radius:6px;line-height:1.5;overflow-wrap:anywhere}',
    '.fin-bar{height:10px;margin:10px 0 0;border-radius:6px;background:var(--bg-code);overflow:hidden}',
    '.fin-bar i{display:block;height:100%;width:100%;background:var(--green);transform-origin:left}',
    '.fin-bar.warn i{background:var(--yellow)}.fin-bar.late i{background:var(--red)}',
    '.fin-score{margin:10px 0 0;font-size:.9rem;color:var(--muted)}',
    '.fin-dots{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 0}',
    '.fin-dots b{width:14px;height:14px;border-radius:4px;border:1px solid var(--line);background:var(--bg-code)}',
    '.fin-dots b.y{background:var(--green);border-color:var(--green)}.fin-dots b.n{background:var(--red);border-color:var(--red)}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'final-viz-style'; st.textContent = css; document.head.appendChild(st);

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- final-incident-timeline ---------- */
  L.widgets['final-incident-timeline'] = function (host) {
    var DUR = 30, T0 = 5, DT = 0.25, LOAD = 4, RPS = 20, POOL = 5;
    var delay = num(host.dataset.delay, 2000, 500, 5000), react = num(host.dataset.react, 9, 1, 20);
    var v = L.setup(host, host.dataset.title || 'Хронология инцидента: оплата замедлилась');
    var d, now = 0, hoverT = null, geo = null, ctl;
    function level(t, tm) {
      var up = clamp((t - T0) / 1.5, 0, 1), down = clamp((t - tm) / 1.0, 0, 1);
      return up * (1 - down);
    }
    function model() {
      var cap = POOL / (delay / 1000), sat = Math.max(0, 1 - cap / LOAD), tm = T0 + react, rnd = rng(13);
      var p95Full = Math.min(5.2, 0.15 + delay / 1000 * (1 + 3 * sat)), errFull = Math.min(60, sat * 60);
      var p95 = [], err = [], wait = [], t, k;
      for (t = 0; t <= DUR + 1e-9; t += DT) {
        k = level(t, tm);
        p95.push(0.15 + k * (p95Full - 0.15) + 0.02 * rnd());
        err.push(Math.max(0, k * errFull * (1 + 0.1 * (rnd() - 0.5))));
        wait.push(sat > 0 ? k : 0);
      }
      // алерт срабатывает, когда условие держится все «for» минут подряд и сбой ещё идёт
      function fire(cond, forMin, delayMin) {
        var run = null, i;
        for (i = 0; i < p95.length; i++) {
          if (cond(i)) { if (run === null) run = i * DT; if (i * DT - run >= forMin) return Math.max(run + forMin + delayMin, i * DT); }
          else run = null;
        }
        return null;
      }
      var a1 = fire(function (i) { return wait[i] > 0.3; }, 1, 0.25);
      var a2 = fire(function (i) { return err[i] > 5; }, 2, 0.25);
      var a3 = fire(function (i) { return p95[i] > 1; }, 5, 0.25);
      var names = [['ShopDbPoolExhausted', a1], ['ShopHighErrorRate', a2], ['ShopHighLatencyP95', a3]];
      var alerts = names.filter(function (a) { return a[1] !== null && a[1] < tm + 1; });
      var lost = 0; for (var i = 0; i < err.length; i++) lost += err[i] / 100 * RPS * 60 * DT;
      return { p95: p95, err: err, wait: wait, tm: tm, cap: cap, sat: sat, alerts: alerts, lost: lost, p95Full: p95Full, errFull: errFull };
    }
    function at(t) { return Math.min(d.p95.length - 1, Math.round(t / DT)); }
    function active(t) {
      return d.alerts.filter(function (a) { return a[1] <= t && t < d.tm + 1; }).map(function (a) { return a[0]; });
    }
    function events(t) {
      var out = [];
      if (t >= T0) out.push('payment: delay_ms=' + fmt(delay, 0));
      d.alerts.forEach(function (a) { if (t >= a[1]) out.push('алерт ' + a[0]); });
      if (t >= d.tm) out.push('откат: delay_ms=50');
      return out;
    }
    function draw() {
      var W = v.canvas(10), narrow = W < 520, H = narrow ? 420 : 380, ph = narrow ? 120 : 112;
      W = v.canvas(H);
      var l = 44, r = W - 12, A = { t: 28, b: 28 + ph }, B = { t: A.b + 54, b: A.b + 54 + ph };
      var X = function (t) { return l + t / DUR * (r - l); };
      var YA = function (n) { return A.b - Math.min(n, 6) / 6 * (A.b - A.t); };
      var YB = function (n) { return B.b - Math.min(n, 40) / 40 * (B.b - B.t); };
      geo = { l: l, r: r };
      [[A, YA, [0, 3, 6], 'p95 запросов, с'], [B, YB, [0, 20, 40], 'доля 5xx, %']].forEach(function (p) {
        p[2].forEach(function (val) {
          v.add('line', { x1: l, x2: r, y1: p[1](val), y2: p[1](val), class: 'grid' });
          v.label(l - 6, p[1](val) + 4, String(val), 'muted small', 'end');
        });
        v.add('path', { d: 'M' + l + ' ' + p[0].t + 'V' + p[0].b + 'H' + r, class: 'axis' });
        v.label(l, p[0].t - 10, p[3], 'small', 'start');
      });
      for (var m = 0; m <= DUR; m += 5) v.label(X(m), B.b + 16, String(m), 'muted small', m === 0 ? 'start' : m === DUR ? 'end' : 'middle');
      v.label((l + r) / 2, B.b + 34, 'минуты от начала наблюдения', 'muted small');
      // порог алерта p95 > 1 с
      v.add('line', { x1: l, x2: r, y1: YA(1), y2: YA(1), class: 'warning marker', 'stroke-dasharray': '4 3' });
      v.label(r - 2, YA(1) - 4, 'порог 1 с', 'warning halo small', 'end');
      v.add('line', { x1: l, x2: r, y1: YB(5), y2: YB(5), class: 'warning marker', 'stroke-dasharray': '4 3' });
      v.label(r - 2, YB(5) - 4, 'порог 5%', 'warning halo small', 'end');
      // зона сбоя
      v.add('rect', { x: X(T0), y: A.t, width: X(Math.min(DUR, d.tm + 1)) - X(T0), height: B.b - A.t, class: 'danger zone' });
      var pa = [], pb = [], i;
      for (i = 0; i <= at(now); i++) { pa.push(X(i * DT) + ',' + YA(d.p95[i])); pb.push(X(i * DT) + ',' + YB(d.err[i])); }
      if (pa.length > 1) {
        v.add('polyline', { points: pa.join(' '), class: 'response stroke' });
        v.add('polyline', { points: pb.join(' '), class: 'danger stroke' });
      }
      var marks = [[T0, 'сбой', 'danger']];
      d.alerts.forEach(function (a, k) { marks.push([a[1], 'алерт ' + (k + 1), 'warning']); });
      marks.push([d.tm, 'откат', 'ok']);
      marks.forEach(function (mk) {
        if (now < mk[0]) return;
        v.add('line', { x1: X(mk[0]), x2: X(mk[0]), y1: A.t, y2: B.b, class: mk[2] + ' marker' });
        v.label(X(mk[0]) + 3, A.t + 12 + (mk[2] === 'warning' ? 12 * (marks.indexOf(mk) % 2) : 0), mk[1], mk[2] + ' halo small', 'start');
      });
      if (hoverT !== null) v.add('line', { x1: X(hoverT), x2: X(hoverT), y1: A.t, y2: B.b, class: 'muted marker' });
    }
    function describe() {
      var al = d.alerts.map(function (a, k) { return (k + 1) + ') <code>' + a[0] + '</code> на минуте ' + fmt(a[1], 1); }).join(', ');
      var text = 'Оплата замедляется до <b>' + fmt(delay, 0) + ' мс</b> на минуте ' + T0 + '. Пул из ' + POOL + ' соединений пропускает при такой оплате около <b>' + fmt(d.cap, 1) + '</b> заказа в секунду, а приходит ' + LOAD + '. ';
      text += d.sat > 0 ? 'Пул не справляется: растут очередь, p95 (до <b>' + fmt(d.p95Full, 1) + ' с</b>) и ошибки (до <b>' + fmt(d.errFull, 0) + '%</b>). ' : 'Пул справляется: p95 растёт до ' + fmt(d.p95Full, 1) + ' с, но ошибок нет, очереди нет. ';
      text += al ? 'Сработали: ' + al + '. ' : 'Ни один алерт не успел сработать: откатили раньше, чем истёк срок «for». ';
      text += 'Откат на минуте <b>' + fmt(d.tm, 0) + '</b> (через ' + fmt(react, 0) + ' мин). За это время клиенты получили около <b>' + fmt(Math.round(d.lost / 10) * 10, 0) + '</b> ответов с ошибкой при ' + RPS + ' запросах в секунду.';
      v.explain(text);
    }
    function recompute() { d = model(); describe(); }
    v.slider('Задержка оплаты', 500, 5000, 100, delay, function (n) { delay = n; recompute(); now = DUR; draw(); }, 'мс');
    v.slider('Откатили через', 1, 20, 1, react, function (n) { react = n; recompute(); now = DUR; draw(); }, 'мин');
    v.tryIt('поставь задержку 1000 мс: пул справляется, ошибок нет, но p95 уже выше порога. Потом верни 3000 и сдвигай «Откатили через»: каждая минута промедления это тысячи ответов с ошибкой. Наведи в любое место графика: увидишь значения и какие алерты горят.');
    recompute();
    ctl = L.animate(v, function (dt) { now = Math.min(DUR, now + dt * 4); draw(); return now < DUR; }, function () { now = DUR; draw(); }, function () { now = 0; });
    v.hover(function (e, q) {
      var t = clamp((q.x - geo.l) / (geo.r - geo.l) * DUR, 0, now);
      hoverT = Math.round(t / DT) * DT; draw();
      var i = at(hoverT), ev = events(hoverT), act = active(hoverT);
      v.showTip('<b>Минута ' + fmt(hoverT, 1) + '</b><br>p95: <b>' + fmt(d.p95[i], 2) + ' с</b><br>5xx: <b>' + fmt(d.err[i], 1) + '%</b><br>' +
        (act.length ? 'Горят: ' + act.map(esc).join(', ') : 'Алертов нет') + (ev.length ? '<br><span style="opacity:.8">' + ev.map(esc).join('; ') + '</span>' : ''), e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    draw(); v.onResize(draw);
  };

  /* ---------- final-day-plan ---------- */
  L.widgets['final-day-plan'] = function (host) {
    var plan = L.json(host.dataset.plan, null), total = num(host.dataset.total, 8, 1, 24), hoverI = -1, geo = null;
    if (!Array.isArray(plan) || !plan.length || plan.length > 10) throw new Error('data-plan: массив из 1-10 этапов {"name","h","min"}.');
    plan = plan.map(function (p) { return { name: String(p.name), h: num(p.h, 1, 0, 8), min: num(p.min, 0, 0, 8) }; });
    var v = L.setup(host, host.dataset.title || 'План тестового задания по часам');
    var cls = ['response', 'violet', 'warning', 'ok', 'danger', 'primary'];
    function sum() { return plan.reduce(function (s, p) { return s + p.h; }, 0); }
    function clock(h) { var m = Math.round(9 * 60 + h * 60); return ('0' + Math.floor(m / 60) % 24).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
    function draw() {
      var W = v.canvas(10), narrow = W < 520, rowH = narrow ? 24 : 26, H = 70 + plan.length * rowH + 20;
      W = v.canvas(H);
      var l = 12, r = W - 12, scaleMax = Math.max(total, sum()), X = function (h) { return l + h / scaleMax * (r - l); };
      v.label(l, 16, 'Старт в 09:00. Лимит: ' + fmt(total, 1) + ' ч', 'small', 'start');
      var acc = 0; geo = { segs: [], l: l, r: r, y0: 28, y1: 28 + 30 };
      plan.forEach(function (p, i) {
        var a = acc, b = acc + p.h; acc = b;
        geo.segs.push({ a: a, b: b, x0: X(a), x1: X(b) });
        if (p.h > 0) v.add('rect', { x: X(a), y: 28, width: Math.max(1, X(b) - X(a) - 1), height: 30, rx: 4, class: cls[i % cls.length] + ' fill', opacity: hoverI === i ? 1 : 0.8 });
        if (X(b) - X(a) > 22) v.label((X(a) + X(b)) / 2, 48, String(i + 1), 'halo small');
      });
      v.add('line', { x1: X(total), x2: X(total), y1: 22, y2: 64, class: 'danger marker' });
      if (sum() > total) v.add('rect', { x: X(total), y: 28, width: X(sum()) - X(total), height: 30, class: 'danger zone' });
      for (var h = 0; h <= Math.ceil(scaleMax); h += (narrow || scaleMax > 10 ? 2 : 1)) v.label(X(h), 76, clock(h), 'muted small', h === 0 ? 'start' : h >= scaleMax ? 'end' : 'middle');
      acc = 0;
      plan.forEach(function (p, i) {
        var y = 96 + i * rowH, a = acc; acc += p.h;
        v.add('rect', { x: l, y: y - 11, width: 12, height: 12, rx: 3, class: cls[i % cls.length] + ' fill' });
        v.label(l + 18, y, (i + 1) + '. ' + p.name + ': ' + fmt(p.h, 2) + ' ч' + (p.min && p.h < p.min ? (narrow ? ' (мало)' : ' (мало, нужно от ' + fmt(p.min, 1) + ')') : ''), p.min && p.h < p.min ? 'danger small' : 'small', 'start');
      });
    }
    function describe() {
      var s = sum(), left = total - s, short = plan.filter(function (p) { return p.min && p.h < p.min; });
      var t = 'Сумма этапов: <b>' + fmt(s, 2) + ' ч</b> из ' + fmt(total, 1) + '. ';
      t += left >= 0 ? (left > 0.01 ? 'В запасе <b>' + fmt(left * 60, 0) + ' мин</b>: это буфер на то, что пойдёт не так.' : 'Запаса нет: любая заминка сорвёт срок.') : 'Не влезаешь на <b>' + fmt(-left * 60, 0) + ' мин</b>: придётся резать этап.';
      if (short.length) t += ' Слишком мало времени: ' + short.map(function (p) { return '«' + esc(p.name) + '»'; }).join(', ') + '. Обычно именно на них проваливаются.';
      v.explain(t);
    }
    plan.forEach(function (p, i) {
      v.slider(p.name, 0, Math.max(4, Math.ceil(p.h)), 0.25, p.h, function (n) { p.h = n; draw(); describe(); }, 'ч');
    });
    v.tryIt('растяни «Прогон теста» до 3 часов: на отчёт не останется времени. Верни и посмотри, где у тебя запас.');
    v.hover(function (e, q) {
      var i = -1; geo.segs.forEach(function (s, k) { if (q.x >= s.x0 && q.x <= s.x1 && s.b > s.a) i = k; });
      hoverI = i; draw();
      if (i < 0) { v.showTip('Время ' + clock(clamp((q.x - geo.l) / (geo.r - geo.l) * Math.max(total, sum()), 0, 24)), e.clientX, e.clientY); return; }
      v.showTip('<b>' + esc(plan[i].name) + '</b><br>' + clock(geo.segs[i].a) + ' - ' + clock(geo.segs[i].b) + ' (' + fmt(plan[i].h, 2) + ' ч)', e.clientX, e.clientY);
    }, function () { hoverI = -1; draw(); });
    draw(); describe(); v.onResize(draw);
  };

  /* ---------- final-speed-quiz ---------- */
  L.widgets['final-speed-quiz'] = function (host) {
    var qs = L.json(host.dataset.questions, null), secs = num(host.dataset.seconds, 30, 10, 120);
    if (!Array.isArray(qs) || !qs.length || !qs.every(function (x) { return x && x.q && x.a; })) throw new Error('data-questions: массив {"q","a"}.');
    var v = L.setup(host, host.dataset.title || 'Тренажёр на скорость: ответь вслух за ' + secs + ' секунд');
    var order = [], pos = -1, left = secs, shown = false, done = false, result = [], revealBtn, ctl;
    var card = html('div', undefined, 'fin-q'), tag = html('p', '', 'fin-tag'), text = html('p', '', 'fin-text'), ans = html('p', '', 'fin-a');
    var bar = html('div', undefined, 'fin-bar'), fill = html('i'), score = html('p', '', 'fin-score'), dots = html('div', undefined, 'fin-dots');
    ans.hidden = true; bar.appendChild(fill);
    [tag, text, ans, bar, score, dots].forEach(function (n) { card.appendChild(n); });
    v.stage.insertBefore(card, v.stage.firstChild);
    function shuffle() {
      order = qs.map(function (_, i) { return i; });
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
      result = order.map(function () { return 0; }); pos = -1; done = false;
    }
    function paint() {
      fill.style.transform = 'scaleX(' + clamp(left / secs, 0, 1) + ')';
      bar.className = 'fin-bar' + (left <= 0 ? ' late' : left < secs / 3 ? ' warn' : '');
      var yes = result.filter(function (x) { return x === 1; }).length, no = result.filter(function (x) { return x === 2; }).length;
      score.textContent = 'Отвечено: ' + (yes + no) + ' из ' + qs.length + '. Знал: ' + yes + ', не знал: ' + no + '. ' + (done ? 'Круг пройден: знал ' + yes + ' из ' + qs.length + '. Нажми «Заново», чтобы повторить.' : shown ? '' : 'Осталось: ' + Math.max(0, Math.ceil(left)) + ' с.');
      dots.replaceChildren();
      result.forEach(function (x) { dots.appendChild(html('b', '', x === 1 ? 'y' : x === 2 ? 'n' : '')); });
    }
    function next() {
      if (pos + 1 >= order.length) { done = true; shown = true; tag.textContent = 'Готово'; text.textContent = 'Все вопросы пройдены'; ans.hidden = true; revealBtn.disabled = true; paint(); return; }
      pos++; left = secs; shown = false; ans.hidden = true;
      var q = qs[order[pos]]; tag.textContent = 'Вопрос ' + (pos + 1) + ' из ' + qs.length; text.textContent = q.q;
      revealBtn.disabled = false; paint();
    }
    function reveal() { if (done) return; shown = true; ans.hidden = false; ans.textContent = qs[order[pos]].a; revealBtn.disabled = true; paint(); }
    function mark(k) { if (done) return; result[pos] = k; if (!shown) reveal(); next(); }
    revealBtn = v.button('Показать ответ', function () { reveal(); });
    v.button('Знал, дальше', function () { mark(1); });
    v.button('Не знал, дальше', function () { mark(2); });
    v.button('Заново', function () { shuffle(); next(); });
    v.explain('Читай вопрос и отвечай <b>вслух</b>, а не про себя: вслух сразу слышно, где ты запутался. Когда закончил, нажми «Показать ответ» и честно сравни. Если сказал главное, жми «Знал», иначе «Не знал»: такие вопросы вернутся в твой список повторения. Таймер не сдаётся: когда он дойдёт до нуля, ответ откроется сам, а настоящий интервьюер к этому моменту уже ждёт следующий вопрос.');
    v.tryIt('пройди все вопросы подряд и повтори тренажёр, пока «не знал» не станет меньше трёх. Хороший ответ короткий: определение, одна цифра или пример, и всё.');
    shuffle(); next();
    ctl = L.animate(v, function (dt) {
      if (shown) return true;
      left -= dt; if (left <= 0) { left = 0; reveal(); } else paint();
      return true;
    }, function () { left = secs; paint(); }, function () {});
    host.addEventListener('keydown', function (e) { if (e.key === ' ' && e.target === host) { e.preventDefault(); reveal(); } });
  };
})();
