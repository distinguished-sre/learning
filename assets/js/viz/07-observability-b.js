/* Виджеты второй половины темы 7 «Метрики, логи и алерты» (уроки 7.4-7.6): регистрируются через window.LTViz.
   Префикс obs-. Модели упрощены для объяснения, числа не измерения учебного стенда.

   obs-use-board: метод USE на ресурсах стенда: загрузка, насыщение, ошибки в разных поломках.
     data-scenario  idle | bcrypt | leak | payment | index (по умолчанию bcrypt)
   obs-log-query: поток JSON-логов «Магазина» и сборка запроса LogQL из фильтров.
     data-preset    all | errors (по умолчанию all)
   obs-alert-life: жизненный цикл алерта inactive, pending, firing по графику доли ошибок.
     data-threshold порог, % (по умолчанию 5)
     data-for       выдержка for, секунд (по умолчанию 120) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt, lerp = L.lerp;

  if (!document.getElementById('obsb-style')) {
    var st = document.createElement('style');
    st.id = 'obsb-style';
    st.textContent = [
      '.obsb-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:0 0 8px}',
      '.obsb-tabs b{flex:none;font-size:.8rem;color:var(--muted);min-width:5.5em}',
      '.obsb-tabs button{min-height:32px;padding:3px 10px;font-size:.85rem}',
      '.obsb-lines{margin:10px 0 0;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg-code);',
      'font:12px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;max-height:15em;overflow:auto}',
      '.obsb-lines i{font-style:normal;color:var(--muted)}',
      '.obsb-lines .e{color:var(--red)}.obsb-lines .w{color:var(--yellow)}',
      '.obsb-q{margin:10px 0 0;padding:6px 10px;border-radius:8px;background:var(--bg-2);font:12.5px/1.5 var(--mono);overflow-wrap:anywhere}',
      '.obsb-q span{color:var(--muted)}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mmss(t) { t = Math.round(t); var s = t % 60; return Math.floor(t / 60) + ':' + (s < 10 ? '0' : '') + s; }
  // Ряд кнопок-переключателей: один выбранный вариант в группе.
  function tabs(parent, title, options, current, fn) {
    var row = html('div', undefined, 'obsb-tabs'), btns = [];
    row.appendChild(html('b', title));
    options.forEach(function (o) {
      var b = html('button', o[1]); b.type = 'button';
      b.setAttribute('aria-pressed', String(o[0] === current));
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true'); fn(o[0]);
      });
      btns.push(b); row.appendChild(b);
    });
    parent.appendChild(row);
    return { set: function (val) { options.forEach(function (o, i) { btns[i].setAttribute('aria-pressed', String(o[0] === val)); }); } };
  }

  /* ---------- obs-use-board ---------- */
  var RES = [
    { n: 'CPU хоста', u: 'node_cpu_seconds_total{mode="idle"}', uq: '1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m]))', sq: 'node_load1 / count(node_cpu_seconds_total{mode="idle"})', eq: null,
      sName: 'очередь', sUnit: 'загрузка на ядро', sf: function (s) { return fmt(s, 1); }, sBad: function (s) { return s >= 1 ? 2 : s >= 0.7 ? 1 : 0; } },
    { n: 'CPU контейнера shop (лимит 1 ядро)', uq: 'rate(container_cpu_usage_seconds_total{name="shop-shop-1"}[1m]) / 1', sq: 'rate(container_cpu_cfs_throttled_periods_total{name="shop-shop-1"}[1m]) / rate(container_cpu_cfs_periods_total{name="shop-shop-1"}[1m])', eq: null,
      sName: 'троттлинг', sUnit: 'периодов с паузой', sf: function (s) { return fmt(s, 0) + '%'; }, sBad: function (s) { return s >= 25 ? 2 : s >= 5 ? 1 : 0; } },
    { n: 'Память контейнера shop (лимит 512 МБ)', uq: 'container_memory_working_set_bytes{name="shop-shop-1"} / container_spec_memory_limit_bytes{name="shop-shop-1"}', sq: null, eq: 'increase(container_oom_events_total{name="shop-shop-1"}[10m])',
      eName: 'OOM-убийства', ef: function (e) { return fmt(e, 0); } },
    { n: 'CPU контейнера postgres (лимит 1 ядро)', uq: 'rate(container_cpu_usage_seconds_total{name="shop-postgres-1"}[1m]) / 1', sq: 'rate(container_cpu_cfs_throttled_periods_total{name="shop-postgres-1"}[1m]) / rate(container_cpu_cfs_periods_total{name="shop-postgres-1"}[1m])', eq: null,
      sName: 'троттлинг', sUnit: 'периодов с паузой', sf: function (s) { return fmt(s, 0) + '%'; }, sBad: function (s) { return s >= 25 ? 2 : s >= 5 ? 1 : 0; } },
    { n: 'Пул соединений shop (5 штук)', uq: '1 - shop_db_pool_available / shop_db_pool_size', sq: 'shop_db_pool_waiting', eq: 'sum(rate(http_requests_total{status="503"}[1m])) * 60',
      sName: 'очередь', sUnit: 'ждут соединение', sf: function (s) { return fmt(s, 0); }, sBad: function (s) { return s >= 1 ? 2 : 0; }, eName: '503 в минуту', ef: function (e) { return fmt(e, 0); } },
    { n: 'Диск хоста', uq: 'rate(node_disk_io_time_seconds_total[1m])', sq: 'rate(node_disk_io_time_weighted_seconds_total[1m])', eq: null,
      sName: 'очередь', sUnit: 'запросов в очереди', sf: function (s) { return fmt(s, 1); }, sBad: function (s) { return s >= 2 ? 2 : s >= 1 ? 1 : 0; } }
  ];
  // Значения [загрузка %, насыщение, ошибки] по ресурсам. null: у ресурса нет такой метрики.
  var SCN = {
    idle: { name: 'Покой', vals: [[6, 0.1, null], [4, 0, null], [38, null, 0], [3, 0, null], [20, 0, 0], [2, 0, null]],
      text: 'Всё спокойно: загрузка низкая, очередей и ошибок нет. Запомни эти цифры как «норму»: с ними будешь сравнивать.' },
    bcrypt: { name: 'Нагрузка на вход (bcrypt)', vals: [[36, 0.3, null], [99, 64, null], [42, null, 0], [8, 0, null], [20, 0, 0], [2, 0, null]],
      text: 'Хост загружен на 36%, и по нему можно решить, что запас большой. Но контейнер shop упёрся в свой лимит в одно ядро: загрузка 99%, и Docker паузами притормаживает его в 64% периодов. Узкое место: CPU контейнера shop, а не хоста.' },
    leak: { name: 'Утечка памяти', vals: [[18, 0.2, null], [35, 2, null], [94, null, 2], [5, 0, null], [15, 0, 0], [2, 0, null]],
      text: 'Процессор и пул в порядке, а память контейнера shop на 94% лимита, и уже было 2 убийства по памяти (OOM): ядро завершало процесс, Docker перезапускал контейнер. Узкое место: память shop.' },
    payment: { name: 'Медленная оплата', vals: [[7, 0.1, null], [12, 0, null], [40, null, 0], [4, 0, null], [100, 8, 12], [2, 0, null]],
      text: 'Процессоры почти простаивают, зато пул соединений занят на 100%, 8 запросов стоят в очереди и 12 в минуту получают 503. Сервис не считает, а ждёт: заказ держит соединение, пока медленная оплата не ответит. Узкое место: пул БД.' },
    index: { name: 'Запросы без индекса', vals: [[48, 0.5, null], [30, 1, null], [40, null, 0], [100, 58, null], [80, 0, 0], [6, 0.2, null]],
      text: 'Shop почти не напряжён, зато контейнер PostgreSQL упёрся в лимит ядра: загрузка 100%, троттлинг 58%. База перебирает таблицу целиком, и пул отдаёт соединения медленнее. Узкое место: CPU базы.' }
  };
  var ORDER = ['idle', 'bcrypt', 'leak', 'payment', 'index'];

  L.widgets['obs-use-board'] = function (host) {
    var key = SCN[host.dataset.scenario] ? host.dataset.scenario : 'bcrypt';
    var v = L.setup(host, host.dataset.title || 'Метод USE: где узкое место');
    var cur = SCN[key].vals.map(function (r) { return r.slice(); }), manual = false, timer = 0;
    var ROWH = 70, HEAD = 4, geo = { colW: 100 };
    var tb = html('div'); v.stage.insertBefore(tb, v.stage.firstChild);
    var t = tabs(tb, 'Сценарий', ORDER.map(function (k) { return [k, SCN[k].name]; }), key, function (k) {
      manual = true; ctl.pause(); key = k; cur = SCN[k].vals.map(function (r) { return r.slice(); }); draw(); describe();
    });
    function bad(i, c) {
      var r = RES[i], x = cur[i];
      if (c === 0) return x[0] >= 90 ? 2 : x[0] >= 70 ? 1 : 0;
      if (c === 1) return x[1] == null ? -1 : r.sBad(x[1]);
      return x[2] == null ? -1 : (x[2] > 0 ? 2 : 0);
    }
    function worst() {
      var best = 0, bi = 0;
      RES.forEach(function (r, i) { var s = Math.max(bad(i, 1), 0) * 3 + Math.max(bad(i, 2), 0) * 2 + bad(i, 0); if (s > best) { best = s; bi = i; } });
      return best >= 3 ? bi : -1;
    }
    var CL = ['danger', 'warning', 'ok'], lastW = -2;
    function cls(b) { return b === 2 ? 'danger' : b === 1 ? 'warning' : 'ok'; }
    function draw() {
      var W = v.canvas(HEAD + RES.length * ROWH + 4), colW = (W - 16) / 3; geo.colW = colW;
      var w = worst();
      if (w !== lastW) { lastW = w; describe(); }
      RES.forEach(function (r, i) {
        var y = HEAD + i * ROWH, x = cur[i];
        if (i === w) v.add('rect', { x: 2, y: y + 2, width: W - 4, height: ROWH - 4, rx: 8, class: 'danger zone' });
        if (i > 0) v.add('line', { x1: 8, x2: W - 8, y1: y, y2: y, class: 'grid' });
        v.label(8, y + 18, r.n, 'small' + (i === w ? ' danger' : ''), 'start');
        [['Загрузка', 0], ['Очередь', 1], ['Ошибки', 2]].forEach(function (c) {
          var cx = 8 + c[1] * colW, b = bad(i, c[1]);
          v.label(cx, y + 36, c[0], 'muted small', 'start');
          if (c[1] === 0) {
            v.add('rect', { x: cx, y: y + 42, width: colW - 14, height: 8, rx: 4, class: 'box' });
            v.add('rect', { x: cx, y: y + 42, width: Math.max(2, (colW - 14) * Math.min(100, x[0]) / 100), height: 8, rx: 4, class: cls(b) + ' fill' });
            v.label(cx, y + 66, fmt(x[0], 0) + '%', cls(b), 'start');
          } else {
            var raw = x[c[1]], txt = raw == null ? 'нет' : c[1] === 1 ? r.sf(raw) : r.ef(raw);
            var unit = raw == null ? '' : c[1] === 1 ? r.sName : r.eName;
            v.add('circle', { cx: cx + 5, cy: y + 46, r: 5, class: raw == null ? 'muted fill' : cls(b) + ' fill' });
            v.label(cx, y + 66, txt, raw == null ? 'muted' : cls(b), 'start');
            if (unit && colW > 150) v.label(cx + 8 + txt.length * 9, y + 66, unit, 'muted small', 'start');
          }
        });
      });
    }
    function describe() {
      var w = worst(), s = SCN[key];
      v.explain('<p><b>Сценарий «' + esc(s.name) + '».</b> ' + esc(s.text) + '</p>' +
        '<p>' + (w < 0 ? 'Красных и жёлтых ресурсов нет: можно искать причину не в железе, а выше по стеку.' :
          'Подсвечен ресурс с самой плохой связкой «загрузка, очередь, ошибки»: <b>' + esc(RES[w].n) + '</b>.') + '</p>');
    }
    v.tryIt('нажимай сценарии и смотри не на самое большое число, а на очередь и ошибки. Загрузка 100% без очереди ещё не беда, а очередь при загрузке 40% говорит, что где-то есть упор, которого ты не видишь. Наведи на любую колонку: покажется запрос PromQL.');
    v.hover(function (e, q) {
      var i = Math.floor((q.y - HEAD) / ROWH), c = Math.floor((q.x - 8) / geo.colW);
      if (i < 0 || i >= RES.length) return v.hideTip();
      c = Math.max(0, Math.min(2, c));
      var r = RES[i], p = [r.uq, r.sq, r.eq][c], nm = ['Загрузка (utilization)', 'Очередь, насыщение (saturation)', 'Ошибки (errors)'][c];
      v.showTip('<b>' + esc(r.n) + '</b><br>' + nm + '<br>' + (p ? '<code>' + esc(p) + '</code>' : 'для этого ресурса отдельной метрики нет, смотри на другие колонки'), e.clientX, e.clientY);
    });
    function still() { cur = SCN[key].vals.map(function (r) { return r.slice(); }); draw(); describe(); }
    var ctl = L.animate(v, function (dt) {
      timer += dt;
      if (!manual && timer > 4.5) {
        timer = 0; key = ORDER[(ORDER.indexOf(key) + 1) % ORDER.length]; t.set(key); describe();
      }
      var tgt = SCN[key].vals, k = Math.min(1, dt * 3);
      cur.forEach(function (row, i) { row.forEach(function (x, j) { var g = tgt[i][j]; row[j] = g == null ? null : (x == null ? g : lerp(x, g, k)); }); });
      draw();
    }, still, function () { manual = false; timer = 0; });
    draw(); describe(); v.onResize(draw);
  };

  /* ---------- obs-log-query ---------- */
  var LOGS = null;
  function buildLogs() {
    if (LOGS) return LOGS;
    var r = rng(3), out = [], hex = '0123456789abcdef';
    var routes = [['GET', '/api/products', 35, 8, 25], ['GET', '/api/products/{id}', 30, 4, 12], ['POST', '/api/login', 8, 180, 260],
      ['POST', '/api/cart/items', 12, 5, 15], ['POST', '/api/orders', 15, 55, 90]];
    function rid() { var s = ''; for (var i = 0; i < 12; i++) s += hex[Math.floor(r() * 16)]; return s; }
    for (var t = 0; t < 120; t++) {
      var n = 1 + Math.floor(r() * 2.4);
      for (var k = 0; k < n; k++) {
        var x = r() * 100, acc = 0, rt = routes[0];
        for (var j = 0; j < routes.length; j++) { acc += routes[j][2]; if (x < acc) { rt = routes[j]; break; } }
        var ms = rt[3] + r() * (rt[4] - rt[3]), status = rt[1] === '/api/orders' ? 201 : 200, level = 'INFO', err = null;
        if (rt[1] === '/api/orders' && t >= 60 && t < 100) { status = 502; ms = 205 + r() * 30; level = 'ERROR'; err = 'payment failed'; }
        if (rt[1] === '/api/login' && t >= 18 && t < 24 && r() < 0.5) { ms = 1100 + r() * 300; level = 'WARNING'; }
        out.push({ t: t + r() * 0.99, level: level, method: rt[0], route: rt[1], status: status, ms: Math.round(ms * 100) / 100, rid: rid(), err: err,
          user: rt[1] === '/api/products' || rt[1] === '/api/products/{id}' ? null : 1 + Math.floor(r() * 1000) });
      }
    }
    LOGS = out; return out;
  }
  function logLine(e) {
    var s = '{"ts":"12:0' + Math.floor(e.t / 60) + ':' + (e.t % 60 < 10 ? '0' : '') + Math.floor(e.t % 60) + '","level":"' + e.level + '","msg":"Запрос завершён","method":"' + e.method +
      '","route":"' + e.route + '","status":' + e.status + ',"duration_ms":' + e.ms + ',"request_id":"' + e.rid + '"';
    if (e.user) s += ',"user_id":' + e.user;
    if (e.err) s += ',"error":"' + e.err + '"';
    return s + '}';
  }

  L.widgets['obs-log-query'] = function (host) {
    var preset = host.dataset.preset === 'errors';
    var f = { level: preset ? 'ERROR' : '', text: '', route: '', status: '' };
    var logs = buildLogs(), SPEED = 6, TOTAL = 120, B = 10, now = 0, geo = { l: 0, r: 1 };
    var v = L.setup(host, host.dataset.title || 'Поток логов «Магазина» и запрос LogQL');
    var tb = html('div'); v.stage.insertBefore(tb, v.stage.firstChild);
    tabs(tb, 'Уровень', [['', 'любой'], ['ERROR', 'ERROR'], ['WARNING', 'WARNING']], f.level, function (x) { f.level = x; refresh(); });
    tabs(tb, 'Текст в строке', [['', 'нет'], ['payment', 'payment']], f.text, function (x) { f.text = x; refresh(); });
    tabs(tb, 'Поле route', [['', 'нет'], ['/api/orders', '/api/orders']], f.route, function (x) { f.route = x; refresh(); });
    tabs(tb, 'Поле status', [['', 'нет'], ['>= 500', '>= 500']], f.status, function (x) { f.status = x; refresh(); });
    var qbox = html('div', undefined, 'obsb-q'); tb.appendChild(qbox);
    function match(e) {
      if (f.level && e.level !== f.level) return false;
      if (f.text && logLine(e).indexOf(f.text) < 0) return false;
      if (f.route && e.route !== f.route) return false;
      if (f.status && !(e.status >= 500)) return false;
      return true;
    }
    function query() {
      var sel = '{service="shop"' + (f.level ? ',level="' + f.level + '"' : '') + '}', q = sel;
      if (f.text) q += ' |= "' + f.text + '"';
      if (f.route || f.status) q += ' | json';
      if (f.route) q += ' | route="' + f.route + '"';
      if (f.status) q += ' | status ' + f.status;
      return q;
    }
    function counts() {
      var nb = TOTAL / B, all = [], hit = [], i;
      for (i = 0; i < nb; i++) { all.push(0); hit.push(0); }
      logs.forEach(function (e) { if (e.t > now) return; var b = Math.min(nb - 1, Math.floor(e.t / B)); all[b]++; if (match(e)) hit[b]++; });
      return { all: all, hit: hit };
    }
    var pre = null;
    function draw() {
      var c = counts(), H = 190, W = v.canvas(H), left = 34, right = W - 10, top = 16, bottom = 150, nb = c.all.length;
      geo = { l: left, r: right };
      var mx = 1; for (var i = 0; i < nb; i++) mx = Math.max(mx, c.all[i]);
      var sc = L.scale(mx, true), ymax = sc.max;
      function Y(n) { return bottom - n / ymax * (bottom - top); }
      sc.ticks.forEach(function (tk) { v.add('line', { x1: left, x2: right, y1: Y(tk), y2: Y(tk), class: 'grid' }); v.label(left - 5, Y(tk) + 4, fmt(tk, 0), 'muted small', 'end'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      var bw = (right - left) / nb;
      for (i = 0; i < nb; i++) {
        var x = left + i * bw;
        v.add('rect', { x: x + 2, y: Y(c.all[i]), width: bw - 4, height: bottom - Y(c.all[i]), class: 'muted zone' });
        if (c.hit[i]) v.add('rect', { x: x + 2, y: Y(c.hit[i]), width: bw - 4, height: bottom - Y(c.hit[i]), class: (f.level === 'ERROR' || f.status ? 'danger' : f.level === 'WARNING' ? 'warning' : 'response') + ' fill' });
        if (i % 2 === 0) v.label(x, bottom + 17, mmss(i * B), 'muted small', 'start');
      }
      v.label(left, top - 4, 'строк за 10 с (серое: весь поток)', 'muted small', 'start');
      v.add('line', { x1: left + now / TOTAL * (right - left), x2: left + now / TOTAL * (right - left), y1: top, y2: bottom, class: 'muted marker' });
      v.label(right, H - 4, 'время, мин:сек', 'muted small', 'end');
      if (!pre) { pre = html('pre', undefined, 'obsb-lines'); v.stage.insertBefore(pre, v.stage.querySelector('.viz-tip')); }
      var shown = logs.filter(function (e) { return e.t <= now && match(e); });
      var tail = shown.slice(-6).reverse();
      pre.innerHTML = tail.length ? tail.map(function (e) {
        return '<i>' + mmss(e.t) + '</i> <span class="' + (e.level === 'ERROR' ? 'e' : e.level === 'WARNING' ? 'w' : '') + '">' + esc(logLine(e)) + '</span>';
      }).join('\n') : 'Подходящих строк пока нет.';
    }
    function describe() {
      var seen = logs.filter(function (e) { return e.t <= now; }), hit = seen.filter(match), q = query();
      qbox.innerHTML = '<span>Запрос логов:</span> ' + esc(q) + '<br><span>Для графика:</span> sum(count_over_time(' + esc(q) + ' [10s]))';
      var errs = seen.filter(function (e) { return e.level === 'ERROR'; }).length;
      v.explain('<p>Подошло <b>' + hit.length + '</b> строк из <b>' + seen.length + '</b> (' + fmt(seen.length ? hit.length / seen.length * 100 : 0, 0) + '%). ' +
        (now < 60 ? 'Пока всё спокойно: ошибок нет, поток ровный.' :
          errs ? 'С 1:00 по 1:40 заказы падали: ' + errs + ' строк с ERROR. В общем потоке (серые столбики) этого почти не видно: запросов столько же, просто часть из них неудачные. Фильтр «уровень ERROR» показывает провал сразу.' : '') + '</p>' +
        '<p>Метка в фигурных скобках (<code>service</code>, <code>level</code>) выбирает потоки целиком и работает быстро. Всё после неё (<code>|=</code>, <code>| json</code>) перебирает текст строк и тратит больше времени.</p>');
    }
    function refresh() { draw(); describe(); }
    v.tryIt('включи «ERROR» и посмотри на провал на графике. Потом сними «уровень» и поставь «Поле status >= 500»: запрос станет длиннее (появится <code>| json</code>), а результат тот же. Наведи на любой столбик: увидишь счёт за эти 10 секунд.');
    v.hover(function (e, q) {
      var c = counts(), nb = c.all.length, i = Math.floor((q.x - geo.l) / (geo.r - geo.l) * nb);
      if (i < 0 || i >= nb) return v.hideTip();
      v.showTip('<b>' + mmss(i * B) + ' - ' + mmss((i + 1) * B) + '</b><br>всего строк: ' + c.all[i] + '<br>подошло под запрос: ' + c.hit[i], e.clientX, e.clientY);
    });
    function still() { now = TOTAL; refresh(); }
    var ctl = L.animate(v, function (dt) {
      now = Math.min(TOTAL, now + dt * SPEED); draw();
      if (Math.floor(now) % 3 === 0) describe();
      if (now >= TOTAL) { describe(); return false; }
    }, still, function () { now = 0; });
    refresh(); v.onResize(draw);
  };

  /* ---------- obs-alert-life ---------- */
  L.widgets['obs-alert-life'] = function (host) {
    var thr = num(host.dataset.threshold, 5, 1, 50), hold = num(host.dataset['for'], 120, 0, 300);
    var STEP = 5, T = 600, N = T / STEP, SPEED = 30, GW = 10, dip = false, now = 0, geo = { l: 0, r: 1 };
    var v = L.setup(host, host.dataset.title || 'Жизнь алерта: pending, firing и for');
    var base = (function () {
      var r = rng(5), a = [];
      for (var i = 0; i <= N; i++) {
        var t = i * STEP, y = 0.6 + r() * 1.6;
        if (t >= 100 && t < 140) y = 22 + r() * 10;
        else if (t >= 250 && t < 450) y = Math.min(1, (t - 250) / 15) * (30 + r() * 10) + y;
        else if (t >= 450 && t < 480) y = 14 * (480 - t) / 30 + y;
        a.push(y);
      }
      return a;
    })();
    function val(i) { var t = i * STEP; return dip && t >= 340 && t < 350 ? 2.4 : base[i]; }
    function run() {
      var st = [], start = null, ep = { fires: [], resets: 0 }, firing = false;
      for (var i = 0; i <= N; i++) {
        var t = i * STEP, on = val(i) > thr, s;
        if (on) {
          if (start === null) start = t;
          s = t - start >= hold ? 'firing' : 'pending';
          if (s === 'firing' && !firing) { ep.fires.push(t); firing = true; }
        } else {
          if (start !== null && !firing) ep.resets++;
          start = null; firing = false; s = 'inactive';
        }
        st.push(s);
      }
      if (start !== null && !firing) ep.resets++;
      ep.st = st; return ep;
    }
    var res = run();
    function fireIn(a, b) { for (var i = 0; i < res.fires.length; i++) if (res.fires[i] >= a && res.fires[i] < b) return res.fires[i]; return null; }
    function draw() {
      var H = 272, W = v.canvas(H), left = 38, right = W - 10, top = 16, bottom = 160;
      geo = { l: left, r: right };
      var YM = 50;
      function X(t) { return left + t / T * (right - left); }
      function Y(y) { return bottom - Math.min(y, YM) / YM * (bottom - top); }
      [0, 10, 20, 30, 40, 50].forEach(function (tk) { v.add('line', { x1: left, x2: right, y1: Y(tk), y2: Y(tk), class: 'grid' }); v.label(left - 5, Y(tk) + 4, tk + '%', 'muted small', 'end'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      for (var m = 0; m <= T; m += 100) v.label(X(m), bottom + 16, mmss(m), 'muted small', m === 0 ? 'start' : m === T ? 'end' : 'middle');
      v.label(left, top - 4, 'доля ошибок, %', 'muted small', 'start');
      var pts = [], ghost = [];
      for (var i = 0; i <= N; i++) { ghost.push(X(i * STEP) + ',' + Y(val(i))); if (i * STEP <= now) pts.push(X(i * STEP) + ',' + Y(val(i))); }
      v.add('polyline', { points: ghost.join(' '), class: 'ghost' });
      if (pts.length > 1) v.add('polyline', { points: pts.join(' '), class: 'response stroke' });
      v.add('line', { x1: left, x2: right, y1: Y(thr), y2: Y(thr), class: 'warning marker' });
      v.label(right - 2, Y(thr) - 6, 'порог ' + fmt(thr, 0) + '%', 'warning halo small', 'end');
      // полоса состояний
      var by = bottom + 30, bh = 22;
      v.add('rect', { x: left, y: by, width: right - left, height: bh, rx: 4, class: 'box' });
      var cl = { inactive: 'ok', pending: 'warning', firing: 'danger' };
      for (i = 0; i <= N; i++) {
        var t0 = i * STEP; if (t0 > now) break;
        v.add('rect', { x: X(t0), y: by + 1, width: Math.max(1, X(Math.min(now, t0 + STEP)) - X(t0) + 0.5), height: bh - 2, class: cl[res.st[i]] + ' fill', opacity: res.st[i] === 'inactive' ? 0.35 : 0.9 });
      }
      res.fires.forEach(function (tf) {
        var tn = tf + GW; if (tn > now || tn > T || stateAt(tn) !== 'firing') return;
        v.add('path', { d: 'M' + X(tn) + ' ' + (by + bh + 3) + 'l-5 9h10z', class: 'violet fill' });
      });
      v.add('line', { x1: X(now), x2: X(now), y1: top, y2: by + bh, class: 'muted marker' });
      var ly = by + bh + 32, lx = left;
      [['ok', 'inactive'], ['warning', 'pending'], ['danger', 'firing'], ['violet', 'уведомление']].forEach(function (it) {
        var iw = 17 + it[1].length * 7.4 + 14;
        if (lx + iw > right + 20 && lx > left) { lx = left; ly += 20; }
        v.add('rect', { x: lx, y: ly - 10, width: 12, height: 12, rx: 3, class: it[0] + ' fill' });
        v.label(lx + 17, ly, it[1], 'muted small', 'start'); lx += iw;
      });
    }
    function stateAt(t) { return res.st[Math.max(0, Math.min(N, Math.round(t / STEP)))]; }
    function describe() {
      var reached = false; for (var q = 20; q < 28; q++) if (base[q] > thr) reached = true;
      var spike = fireIn(100, 160), inc = fireIn(250, 470), s = [];
      s.push('Порог <b>' + fmt(thr, 0) + '%</b>, <code>for</code> <b>' + fmt(hold, 0) + ' с</b>. Всплеск в 1:40-2:20 длится 40 с: ' +
        (spike !== null ? 'он продержался дольше <code>for</code>, и алерт загорелся (firing) в ' + mmss(spike) + '. Это ложная тревога на пустом месте.' :
          reached ? 'он короче <code>for</code>, алерт побывал в pending и погас, никого не разбудив.' : 'до порога метрика не дошла.'));
      s.push(inc !== null ? 'Настоящая поломка началась в 4:10, алерт загорелся в <b>' + mmss(inc) + '</b>, то есть через <b>' + fmt(inc - 250, 0) + ' с</b>, а уведомление ушло ещё через ' + GW + ' с (<code>group_wait</code>).' :
        'Настоящая поломка началась в 4:10, но алерт <b>не загорелся</b>: условие нарушалось недостаточно долго подряд.');
      if (res.resets > 0) s.push('Ожидание (pending) сбрасывалось ' + res.resets + ' раз(а): стоило метрике один раз вернуться под порог, отсчёт <code>for</code> начинался заново.');
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function refresh() { res = run(); draw(); describe(); }
    v.slider('Порог', 1, 50, 1, thr, function (n) { thr = n; refresh(); }, '%');
    v.slider('for', 0, 300, 10, hold, function (n) { hold = n; refresh(); }, 'с');
    var dipBtn = v.button('Провал метрики внутри поломки: выкл', function () {
      dip = !dip; dipBtn.textContent = 'Провал метрики внутри поломки: ' + (dip ? 'вкл' : 'выкл'); refresh();
    });
    v.tryIt('поставь <code>for</code> = 0: первый же всплеск разбудит дежурного. Подними до 120 с: всплеск пропадёт, но настоящая поломка загорится не сразу. Включи «провал» и посмотри, как одна точка под порогом откладывает алерт. Наведи на любое место графика: увидишь значение и состояние.');
    v.hover(function (e, q) {
      var t = Math.max(0, Math.min(T, (q.x - geo.l) / (geo.r - geo.l) * T)), i = Math.max(0, Math.min(N, Math.round(t / STEP)));
      var s = res.st[i], extra = '';
      if (s === 'pending') { var j = i; while (j > 0 && res.st[j - 1] === 'pending') j--; extra = '<br>ждёт уже ' + fmt(i * STEP - j * STEP, 0) + ' с из ' + fmt(hold, 0); }
      v.showTip('<b>' + mmss(i * STEP) + '</b><br>доля ошибок: ' + fmt(val(i), 1) + '%<br>состояние: ' + s + extra, e.clientX, e.clientY);
    });
    function still() { now = T; draw(); describe(); }
    var ctl = L.animate(v, function (dt) {
      now = Math.min(T, now + dt * SPEED); draw();
      if (now >= T) return false;
    }, still, function () { now = 0; });
    draw(); describe(); v.onResize(draw);
  };
})();
