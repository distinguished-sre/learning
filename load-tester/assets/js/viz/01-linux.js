/* Виджеты темы 1: регистрируются через window.LTViz (см. конец assets/js/viz.js).
   linux-pipeline      конвейер команд: что остаётся на каждом шаге (урок 1.2)
   linux-load-average  load average против числа ядер (урок 1.3)
   linux-net-timeline  DNS, TCP-рукопожатие и HTTP по времени, как их показывает curl -w (урок 1.4) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;

  var css = document.createElement('style');
  css.textContent =
    '.lp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
    '.lp-chip{max-width:100%;padding:5px 10px;border:1px solid var(--line);border-radius:999px;background:var(--bg-2);color:var(--muted);font:600 .8rem var(--mono);overflow-wrap:anywhere;cursor:pointer}' +
    '.lp-chip.on{border-color:var(--accent-ink);color:var(--text)}' +
    '.lp-chip.now{background:var(--accent-ink);border-color:var(--accent-ink);color:var(--bg)}' +
    '.lp-bar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;margin:0 0 6px;font-size:.85rem;color:var(--muted)}' +
    '.lp-bar b{color:var(--text)}' +
    '.lp-out{margin:0;padding:10px 12px;max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--bg);font:.8rem/1.55 var(--mono);color:var(--text);white-space:pre}' +
    '.lp-out i{font-style:normal;color:var(--yellow)}' +
    '.lp-out em{font-style:normal;color:var(--red);font-weight:700}';
  document.head.appendChild(css);

  /* ---------- Конвейер команд ---------- */
  var SAMPLE = [
    '10.0.0.19 - - [03/Oct/2026:10:05:03 +0000] "POST /api/login HTTP/1.1" 200 2771 0.300',
    '10.0.0.19 - - [03/Oct/2026:10:05:03 +0000] "POST /api/cart/items HTTP/1.1" 201 2889 0.012',
    '10.0.0.24 - - [03/Oct/2026:10:05:03 +0000] "GET /api/products/6417 HTTP/1.1" 200 1191 0.012',
    '10.0.0.30 - - [03/Oct/2026:10:05:03 +0000] "POST /api/orders HTTP/1.1" 503 40 1.940',
    '10.0.0.30 - - [03/Oct/2026:10:05:03 +0000] "POST /api/orders HTTP/1.1" 503 40 1.902',
    '10.0.0.28 - - [03/Oct/2026:10:05:03 +0000] "GET /api/products/288 HTTP/1.1" 200 1557 0.012',
    '10.0.0.12 - - [03/Oct/2026:10:05:03 +0000] "GET /api/products?page=3&size=20 HTTP/1.1" 200 363 0.030',
    '10.0.0.19 - - [03/Oct/2026:10:05:03 +0000] "GET /api/products?page=2&size=20 HTTP/1.1" 200 2990 0.143',
    '10.0.0.11 - - [03/Oct/2026:10:05:03 +0000] "GET /api/products/7675 HTTP/1.1" 200 2830 0.013',
    '10.0.0.21 - - [03/Oct/2026:10:05:03 +0000] "GET /api/products/3573 HTTP/1.1" 200 3006 0.016',
    '10.0.0.15 - - [03/Oct/2026:10:05:03 +0000] "POST /api/login HTTP/1.1" 200 648 0.161',
    '10.0.0.15 - - [03/Oct/2026:10:05:04 +0000] "GET /api/cart HTTP/1.1" 200 1442 0.007'
  ];
  var STAGES = [
    { cmd: 'cat access.log', run: function (x) { return x; },
      say: 'Команда <code>cat</code> печатает файл целиком. Здесь образец из {n} строк, в настоящем логе их 10 000.' },
    { cmd: 'grep POST', run: function (x) { return x.filter(function (s) { return s.indexOf('POST') >= 0; }); },
      say: '<code>grep POST</code> оставил только строки со словом POST: {n} из 12. Остальные дальше не пошли.' },
    { cmd: "awk '{print $9}'", run: function (x) { return x.map(function (s) { return s.split(/\s+/)[8]; }); },
      say: '<code>awk</code> разрезал каждую строку по пробелам и взял девятое слово: код ответа. Из длинных строк остались короткие, всего {n}.' },
    { cmd: 'sort', run: function (x) { return x.slice().sort(); },
      say: '<code>sort</code> выстроил одинаковые коды рядом. Это нужно следующей команде: она замечает повторы только у соседей.' },
    { cmd: 'uniq -c', run: function (x) {
        var out = [];
        x.forEach(function (s) { var last = out[out.length - 1]; if (last && last.v === s) last.n++; else out.push({ v: s, n: 1 }); });
        return out.map(function (o) { return ('      ' + o.n).slice(-7) + ' ' + o.v; });
      },
      say: '<code>uniq -c</code> склеил соседние одинаковые строки и написал слева, сколько их было: {n} строк вместо 5.' },
    { cmd: 'sort -rn', run: function (x) {
        return x.slice().sort(function (a, b) { var d = parseInt(b, 10) - parseInt(a, 10); return d || (a < b ? 1 : -1); });
      },
      say: '<code>sort -rn</code> (r: наоборот, n: как числа) поставил наверх самое частое. Итог: ответ на вопрос «какие коды отвечали на POST».' }
  ];

  L.widgets['linux-pipeline'] = function (host) {
    var v = L.setup(host, host.dataset.title || 'Конвейер команд шаг за шагом');
    var stage = Math.round(L.num(host.dataset.stage, 0, 0, STAGES.length - 1));
    var chips = L.html('div', undefined, 'lp-chips'), bar = L.html('div', undefined, 'lp-bar'), out = L.html('pre', undefined, 'lp-out');
    out.tabIndex = 0;
    v.stage.appendChild(chips); v.stage.appendChild(bar); v.stage.appendChild(out);
    var chipEls = STAGES.map(function (s, i) {
      var c = L.html('button', (i ? '| ' : '') + s.cmd, 'lp-chip'); c.type = 'button';
      c.addEventListener('click', function () { if (ctl) ctl.pause(); go(i); });
      chips.appendChild(c); return c;
    });
    var ctl, timer = 0, auto = false;
    var slider = v.slider('Сколько команд в конвейере (номер шага)', 0, STAGES.length - 1, 1, stage, function (n) { if (!auto && ctl) ctl.pause(); set(n); });
    function go(n) { auto = true; set(n); slider.value = n; slider.dispatchEvent(new Event('input')); auto = false; }
    function lines(n) { var x = SAMPLE; for (var i = 0; i <= n; i++) x = STAGES[i].run(x); return x; }
    function set(n) {
      stage = n;
      var res = lines(n), prev = n ? lines(n - 1) : SAMPLE;
      chipEls.forEach(function (c, i) { c.className = 'lp-chip' + (i <= n ? ' on' : '') + (i === n ? ' now' : ''); });
      bar.innerHTML = '<span>Шаг <b>' + (n + 1) + ' из ' + STAGES.length + '</b></span><span>строк на входе: <b>' + prev.length + '</b>, на выходе: <b>' + res.length + '</b></span>';
      out.innerHTML = res.map(function (s) {
        var e = L.esc(s);
        if (n < 2) e = e.replace(/ (50[03]) (\d+ [\d.]+)$/, ' <em>$1</em> $2').replace(/"(POST) /, '"<i>$1</i> ');
        else if (n === 4 || n === 5) e = e.replace(/(\s)(50[03])$/, '$1<em>$2</em>');
        else if (n >= 2) e = e.replace(/^(50[03])$/, '<em>$1</em>');
        return e;
      }).join('\n');
      v.explain(STAGES[n].say.replace('{n}', res.length) + ' Красным выделены ответы 5xx: сбой на стороне сервера.');
    }
    v.tryIt('двигай ползунок или нажимай на команды: видно, что на входе и на выходе каждой. Попробуй мысленно убрать <code>sort</code> перед <code>uniq -c</code>: у 200 и 201 соседи перемешаны, счёт получится неверным.');
    ctl = L.animate(v, function (dt) {
      timer += dt;
      if (timer < (stage === STAGES.length - 1 ? 4 : 2.4)) return true;
      timer = 0; go((stage + 1) % STAGES.length);
      return true;
    }, function () { go(STAGES.length - 1); }, function () { timer = 0; });
    set(stage);
  };

  /* ---------- Load average против числа ядер ---------- */
  var SPEED = 4, WINDOW = 90;
  {
    L.widgets['linux-load-average'] = function (host) {
      var cores = Math.round(L.num(host.dataset.cores, 4, 1, 8)), target = L.num(host.dataset.load, 6, 0, 20);
      var v = L.setup(host, host.dataset.title || 'Load average и ядра процессора');
      var hist, la, noise, acc, ptr = null, geo = {};
      function nextN() {
        noise = 0.7 * noise + (Math.random() - 0.5) * 1.8 * Math.sqrt(target + 1);
        return Math.max(0, Math.round(target + noise));
      }
      function push() {
        var n = nextN(); la += (n - la) * (1 - Math.exp(-1 / 60));
        hist.push({ n: n, la: la }); if (hist.length > WINDOW) hist.shift();
      }
      function reset() { hist = []; la = target; noise = 0; acc = 0; for (var i = 0; i < WINDOW; i++) push(); }
      reset();
      function state() { return la <= cores * 0.7 ? 'ok' : la <= cores ? 'warning' : 'danger'; }
      function say() {
        var cur = hist[hist.length - 1], busy = Math.min(cur.n, cores), wait = Math.max(0, cur.n - cores), per = la / cores;
        var verdict = per <= 0.7 ? 'Ядра справляются с запасом.' : per <= 1 ? 'Ядра заняты почти полностью, запаса нет.' :
          'Процессов больше, чем ядер: в среднем ' + L.fmt(la - cores, 1) + ' из них всегда ждут очереди, всё работает медленнее.';
        v.explain('Прямо сейчас хотят процессор <b>' + cur.n + '</b> ' + L.plural(cur.n, 'процесс', 'процесса', 'процессов') + ', ядер <b>' + cores + '</b>: работают ' + busy + ', ждут ' + wait +
          '. Load average (среднее за минуту) <b>' + L.fmt(la, 2) + '</b>, это ' + L.fmt(per, 2) + ' на ядро. ' + verdict +
          ' Загрузка процессора при этом ' + (cur.n >= cores ? '100%' : Math.round(cur.n / cores * 100) + '%') + ': она не показывает, сколько процессов ждут.');
      }
      var lastSay = -1;
      function draw() {
        var s = Math.min(48, Math.floor((v.stage.clientWidth - 7 * (cores - 1)) / cores)), W0 = Math.max(280, v.stage.clientWidth || 640);
        var cur = hist[hist.length - 1], top = 22, perRow = Math.max(4, Math.floor((W0 - 8) / 18));
        var wait = Math.max(0, cur.n - cores), rows = Math.min(2, Math.ceil(wait / perRow)), qTop = top + s + 34;
        var chartTop = qTop + Math.max(1, rows) * 18 + 30, H = chartTop + 150 + 62;
        var W = v.canvas(H), left = 34, right = W - 10, ch = 150, bottom = chartTop + ch;
        v.label(0, 14, 'Ядра процессора', 'muted small', 'start');
        for (var i = 0; i < cores; i++) {
          var x = i * (s + 7), run = i < cur.n;
          v.add('rect', { x: x, y: top, width: s, height: s, rx: 8, class: run ? 'box busy' : 'box' });
          v.add('circle', { cx: x + s / 2, cy: top + s / 2, r: Math.max(5, s / 5), class: (run ? 'ok' : 'muted') + ' fill', opacity: run ? 1 : 0.25 });
        }
        v.label(0, qTop - 8, wait ? 'Ждут своей очереди: ' + wait : 'Очереди нет', wait ? 'danger small' : 'muted small', 'start');
        for (var k = 0; k < Math.min(wait, perRow * 2); k++) v.add('circle', { cx: 8 + (k % perRow) * 18, cy: qTop + 6 + Math.floor(k / perRow) * 18, r: 7, class: 'danger fill' });
        if (wait > perRow * 2) v.label(W - 4, qTop - 8, '+ ещё ' + (wait - perRow * 2), 'danger small', 'end');
        var sc = L.scale(Math.max(cores * 2, 4, Math.max.apply(null, hist.map(function (h) { return h.n; })) + 1), true), high = sc.max;
        function X(i) { return left + i / (WINDOW - 1) * (right - left); }
        function Y(n) { return bottom - n / high * ch; }
        geo = { X: X, left: left, right: right, top: chartTop, bottom: bottom };
        v.label(left, chartTop - 10, 'Последние 90 секунд', 'muted small', 'start');
        sc.ticks.forEach(function (t) {
          v.add('line', { x1: left, x2: right, y1: Y(t), y2: Y(t), class: 'grid' });
          v.label(left - 6, Y(t) + 5, String(t), 'muted small', 'end');
        });
        v.add('path', { d: 'M' + left + ' ' + chartTop + 'V' + bottom + 'H' + right, class: 'axis' });
        v.add('rect', { x: left, y: Y(high), width: right - left, height: Y(cores) - Y(high), class: 'danger zone' });
        v.add('line', { x1: left, x2: right, y1: Y(cores), y2: Y(cores), class: 'warning marker' });
        v.label(right, Y(cores) - 5, 'ядер: ' + cores, 'warning small halo', 'end');
        v.add('polyline', { points: hist.map(function (h, i) { return X(i) + ',' + Y(h.n); }).join(' '), class: 'response stroke', opacity: 0.45, 'stroke-width': 1.5 });
        v.add('polyline', { points: hist.map(function (h, i) { return X(i) + ',' + Y(h.la); }).join(' '), class: state() + ' stroke' });
        v.label(left, bottom + 20, '90 с назад', 'muted small', 'start'); v.label(right, bottom + 20, 'сейчас', 'muted small', 'end');
        v.label(left, bottom + 38, 'тонкая линия: сколько процессов хотят CPU', 'muted small', 'start');
        v.label(left, bottom + 54, 'толстая линия: load average', 'muted small', 'start');
        if (ptr) mark();
        v.status.textContent = 'Показ ускорен в ' + SPEED + ' раза: секунда на графике идёт за четверть секунды.';
        var key = Math.floor(hist.length ? Math.round(la * 4) + cur.n * 100 + cores * 100000 : 0);
        if (key !== lastSay) { lastSay = key; say(); }
      }
      function mark() {
        var i = Math.max(0, Math.min(WINDOW - 1, Math.round((ptr.x - geo.left) / (geo.right - geo.left) * (WINDOW - 1)))), h = hist[i];
        v.add('line', { x1: geo.X(i), x2: geo.X(i), y1: geo.top, y2: geo.bottom, class: 'muted marker' });
        v.showTip('<b>' + (WINDOW - 1 - i) + ' с назад</b><br>Хотели CPU: <b>' + h.n + '</b> из ' + cores + ' ядер<br>Load average: <b>' + L.fmt(h.la, 2) + '</b> (' + L.fmt(h.la / cores, 2) + ' на ядро)<br>' +
          (h.la > cores ? 'Больше, чем ядер: очередь' : 'Не больше числа ядер'), ptr.cx, ptr.cy);
      }
      var still = window.matchMedia('(prefers-reduced-motion: reduce)');
      v.slider('Процессов хотят CPU в среднем', 0, 20, 0.5, target, function (n) { target = n; if (still.matches) { reset(); draw(); } });
      v.slider('Ядер в машине', 1, 8, 1, cores, function (n) { cores = n; if (still.matches) reset(); draw(); });
      v.hover(function (e, q) { ptr = { x: q.x, cx: e.clientX, cy: e.clientY }; draw(); }, function () { ptr = null; draw(); });
      v.tryIt('подними «процессов» выше числа ядер и подожди: толстая линия медленно ползёт вверх и пересекает жёлтую черту, очередь из красных кружков растёт. Уменьши число ядер при той же нагрузке: то же число процессов вдруг становится перегрузкой.');
      L.animate(v, function (dt) {
        acc += dt * SPEED; while (acc >= 1) { acc -= 1; push(); }
        draw();
      }, function () { draw(); }, reset);
      draw(); v.onResize(draw);
    };
  }

  /* ---------- DNS, TCP и HTTP по времени ---------- */
  L.widgets['linux-net-timeline'] = function (host) {
    var P = { dns: L.num(host.dataset.dns, 30, 0, 300), rtt: L.num(host.dataset.rtt, 40, 1, 300), srv: L.num(host.dataset.server, 80, 0, 1500) };
    var v = L.setup(host, host.dataset.title || 'Куда уходит время запроса: DNS, TCP, сервер');
    var t = 0, hl = -1, hoverOn = false, ev = [], total = 0, geo = {};
    var still = window.matchMedia('(prefers-reduced-motion: reduce)');
    function curT() { return still.matches ? total + 1 : t; }
    function build() {
      var xfer = Math.max(2, Math.round(P.rtt * 0.25)), h = P.rtt / 2, a = 0;
      ev = [
        { l: 'запрос', long: 'Клиент спрашивает у DNS-сервера адрес имени', d: P.dns / 2, from: 0, to: 1, seg: 0 },
        { l: 'ответ', long: 'DNS-сервер отвечает адресом', d: P.dns / 2, from: 1, to: 0, seg: 0 },
        { l: 'SYN', long: 'Клиент стучится: «давай соединяться» (SYN)', d: h, from: 0, to: 2, seg: 1 },
        { l: 'SYN-ACK', long: 'Сервер отвечает: «слышу, давай» (SYN-ACK)', d: h, from: 2, to: 0, seg: 1 },
        { l: 'ACK + GET', long: 'Клиент подтверждает (ACK) и сразу шлёт HTTP-запрос GET', d: h, from: 0, to: 2, seg: 2 },
        { l: 'сервер думает', long: 'Приложение на сервере обрабатывает запрос', d: P.srv, from: 2, to: 2, seg: 2 },
        { l: '200 OK', long: 'Сервер отправляет ответ: первый байт идёт к клиенту', d: h, from: 2, to: 0, seg: 2 },
        { l: 'тело', long: 'Клиент дочитывает тело ответа', d: xfer, from: 0, to: 0, seg: 3 }
      ];
      ev.forEach(function (e) { e.t0 = a; a += e.d; e.t1 = a; });
      total = a;
    }
    var SEG = [['DNS', 'primary'], ['TCP-соединение', 'violet'], ['Ожидание ответа', 'warning'], ['Загрузка тела', 'ok']];
    function segMs(i) { return ev.filter(function (e) { return e.seg === i; }).reduce(function (s, e) { return s + e.d; }, 0); }
    function drawing(tt) {
      build();
      var W0 = Math.max(280, v.stage.clientWidth || 640), rows = 1, lw = 10;
      SEG.forEach(function (s, i) { var w = (s[0] + ' ' + L.ms(segMs(i))).length * 7.2 + 26; if (lw + w > W0) { rows++; lw = 10; } lw += w; });
      var H = 366 + 52 + rows * 20 + 8, W = v.canvas(H), x1 = 104, x3 = W - 46, x2 = x1 + (x3 - x1) * 0.42, X = [x1, x2, x3];
      var top = 46, plotH = 250, barY = 366, bw = W - 20;
      // длины по вертикали: пропорционально времени, но не короче 18 px
      var len = ev.map(function (e) { return Math.max(18, e.d / total * plotH); }), sum = len.reduce(function (a, b) { return a + b; }, 0), k = plotH / sum, y = top;
      ev.forEach(function (e, i) { e.y0 = y; y += len[i] * k; e.y1 = y; });
      geo = { top: top, bottom: y, barY: barY, bw: bw, X: X };
      ['Клиент', 'DNS', 'Сервер'].forEach(function (name, i) {
        v.label(X[i], 18, name, '', 'middle');
        v.add('line', { x1: X[i], x2: X[i], y1: 28, y2: y + 6, class: 'axis' });
      });
      v.label(0, 18, 'время ↓', 'muted small', 'start');
      var clock = 0;
      ev.forEach(function (e, i) {
        var past = tt >= e.t1, now = tt >= e.t0 && tt < e.t1, cls = SEG[e.seg][1] + (hl === i ? ' hl' : '') + (past || now ? '' : ' dim');
        var xa = X[e.from], xb = X[e.to];
        if (e.from === e.to) {
          var hgt = Math.max(8, e.y1 - e.y0);
          v.add('rect', { x: xa > W / 2 ? xa - 14 : xa + 4, y: e.y0, width: 10, height: hgt, rx: 3, class: cls + ' fill' });
          v.label(xa > W / 2 ? xa - 20 : xa + 18, (e.y0 + e.y1) / 2 + 5, e.l, 'small ' + SEG[e.seg][1], xa > W / 2 ? 'end' : 'start');
        } else {
          v.add('line', { x1: xa, y1: e.y0, x2: xb, y2: e.y1, class: cls + ' stroke', 'stroke-width': 2.5 });
          var tipx = xb + (xb > xa ? -1 : 1) * 8, dir = xb > xa ? -1 : 1;
          v.add('path', { d: 'M' + xb + ' ' + e.y1 + 'l' + (dir * 10) + ' -4 m' + (-dir * 10) + ' 4 l' + (dir * 10) + ' 4', class: cls + ' stroke', 'stroke-width': 2.5 });
          v.label((xa + xb) / 2, (e.y0 + e.y1) / 2 - 6, e.l, 'small halo ' + SEG[e.seg][1], 'middle');
          if (now) {
            var f = (tt - e.t0) / e.d;
            v.add('circle', { cx: xa + (xb - xa) * f, cy: e.y0 + (e.y1 - e.y0) * f, r: 6, class: SEG[e.seg][1] + ' fill' });
          }
        }
        if (past && (i === 1 || i === 3 || i === 6 || i === 7)) {
          clock = e.t1;
          v.label(x1 - 12, e.y1 + 4, L.ms(e.t1), 'small muted', 'end');
        }
      });
      // полоса «куда ушло время»
      v.label(10, barY - 12, 'Те же ' + L.ms(total) + ' одной полосой (в масштабе)', 'muted small', 'start');
      var x = 10;
      SEG.forEach(function (s, i) {
        var w = segMs(i) / total * bw;
        v.add('rect', { x: x, y: barY, width: Math.max(1, w), height: 30, rx: 3, class: s[1] + ' fill' + (tt < ev.filter(function (e) { return e.seg === i; })[0].t0 ? ' dim' : '') });
        x += w;
      });
      var lx = 10, ly = barY + 52;
      SEG.forEach(function (s, i) {
        var txt = s[0] + ' ' + L.ms(segMs(i)), w = txt.length * 7.2 + 26;
        if (lx + w > W) { lx = 10; ly += 20; }
        v.add('rect', { x: lx, y: ly - 10, width: 11, height: 11, rx: 2, class: s[1] + ' fill' });
        v.label(lx + 16, ly, txt, 'small', 'start'); lx += w;
      });
      v.status.textContent = 'curl -w: namelookup ' + (P.dns / 1000).toFixed(3) + ' · connect ' + ((P.dns + P.rtt) / 1000).toFixed(3) +
        ' · starttransfer ' + ((P.dns + 2 * P.rtt + P.srv) / 1000).toFixed(3) + ' · total ' + (total / 1000).toFixed(3) + ' с';
    }
    var lastSay = '';
    function say() {
      var key = [P.dns, P.rtt, P.srv].join(); if (key === lastSay) return; lastSay = key;
      var big = Math.max(P.dns, P.rtt * 2, P.srv), who = big === P.srv ? 'сервер (его код и база)' : big === P.dns ? 'DNS (узнавание адреса)' : 'сеть (два круга туда-обратно)';
      v.explain('Весь запрос занял <b>' + L.ms(total) + '</b>: DNS <b>' + L.ms(P.dns) + '</b>, рукопожатие TCP <b>' + L.ms(P.rtt) + '</b> (один круг туда-обратно, RTT), ожидание ответа <b>' + L.ms(P.rtt + P.srv) +
        '</b> (круг до сервера и обратно плюс <b>' + L.ms(P.srv) + '</b> работы сервера). Дольше всего тянется: ' + who + '. Именно так <code>curl -w</code> раскладывает время на поля, внизу их значения в секундах.');
    }
    function refresh() { t = 0; build(); say(); drawing(curT()); }
    function pickEvent(y) {
      var best = -1, bd = 1e9; ev.forEach(function (e, i) { var d = Math.abs((e.y0 + e.y1) / 2 - y); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    function tipFor(i) { var e = ev[i]; return '<b>' + L.esc(SEG[e.seg][0]) + '</b><br>' + L.esc(e.long) + '<br>Занимает ' + L.ms(e.d) + ', с ' + L.ms(e.t0) + ' по ' + L.ms(e.t1); }
    v.slider('DNS отвечает за', 0, 300, 5, P.dns, function (n) { P.dns = n; refresh(); }, 'мс');
    v.slider('RTT (круг туда-обратно)', 2, 300, 2, P.rtt, function (n) { P.rtt = n; refresh(); }, 'мс');
    v.slider('Сервер думает', 0, 1500, 10, P.srv, function (n) { P.srv = n; refresh(); }, 'мс');
    v.hover(function (e, q) {
      hoverOn = true;
      if (q.y > geo.barY - 6) {
        var ms = Math.max(0, Math.min(total, (q.x - 10) / geo.bw * total)), acc = 0, seg = 0;
        for (seg = 0; seg < 3; seg++) { acc += segMs(seg); if (ms < acc) break; }
        hl = ev.findIndex(function (z) { return z.seg === seg; });
        v.showTip('<b>' + L.esc(SEG[seg][0]) + '</b>: ' + L.ms(segMs(seg)) + ' (' + L.pct(segMs(seg) / total) + ' всего времени)<br>Это место на полосе: ' + L.ms(ms) + ' от начала', e.clientX, e.clientY);
      } else { hl = pickEvent(q.y); v.showTip(tipFor(hl), e.clientX, e.clientY); }
      drawing(curT());
    }, function () { hl = -1; hoverOn = false; drawing(curT()); });
    v.tryIt('подвинь «Сервер думает» до 800 мс: растёт только жёлтый кусок, сеть тут ни при чём. Подвинь RTT: растут сразу три участка, потому что пакетов «туда-обратно» в запросе несколько. Наведи на стрелку или на полосу: появится описание шага.');
    var HOLD = 1.2, DUR = 6;
    L.animate(v, function (dt) {
      t += dt * total / DUR;
      if (t > total + total / DUR * HOLD) t = 0;
      drawing(Math.min(t, total + 1)); return true;
    }, function () { drawing(total + 1); }, function () { t = 0; });
    build(); say(); drawing(curT());
    v.onResize(function () { drawing(curT()); });
  };
})();
