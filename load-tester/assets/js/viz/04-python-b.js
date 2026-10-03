/* Виджеты второй половины темы 4 «Python для тестировщика» (уроки 4.5-4.7).
   Регистрируются через window.LTViz, имена с префиксом py-. Файл 04-python.js не трогаем.

   py-session-compare: новое соединение на каждый запрос против Session (временная шкала).
     data-requests  число запросов (по умолчанию 8)
     data-connect   мс на открытие соединения (15)
     data-work      мс работы сервера на один запрос (25)
   py-task-weights: несколько объектов-пользователей выбирают задачи по весам (подготовка к Locust).
     data-users     число пользователей (3)
     data-weights   JSON {"catalog":6,"product":3,"cart":2,"order":1}
   py-report: отчёт pytest, переключение сценариев, подсказка к каждой строке.
     data-scenarios JSON [{"name":"...","intro":"...","lines":[{"t":"строка отчёта","n":"пояснение"}]}] */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, json = L.json, fmt = L.fmt, ms = L.ms;

  var css = [
    '.pyb-seg{stroke:var(--bg-code);stroke-width:1}',
    '.pyb-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
    '.pyb-chips button{font:600 13px var(--sans);padding:6px 12px;min-height:34px;border:1px solid var(--line);border-radius:999px;background:var(--bg-2);color:var(--text);cursor:pointer}',
    '.pyb-chips button[aria-pressed="true"]{border-color:var(--accent-ink);color:var(--accent-ink);background:color-mix(in srgb,var(--accent-ink) 14%,var(--bg-2))}',
    '.pyb-intro{margin:0 0 8px;font:14px/1.5 var(--sans);color:var(--text)}',
    '.pyb-rep{border:1px solid var(--line);border-radius:10px;background:var(--bg-code);padding:6px 0;overflow-x:auto;font:13px/1.6 var(--mono)}',
    '.pyb-line{white-space:pre;padding:0 12px;border-left:3px solid transparent;min-height:1.6em}',
    '.pyb-line.has{cursor:pointer;border-left-color:var(--line)}',
    '.pyb-line.has:hover,.pyb-line.sel,.pyb-line.has:focus-visible{background:color-mix(in srgb,var(--accent-ink) 14%,transparent);border-left-color:var(--accent-ink);outline:none}',
    '.pyb-line.err{color:var(--red)}.pyb-line.arrow{color:var(--yellow);font-weight:700}.pyb-line.head{color:var(--muted)}.pyb-line.ok{color:var(--green)}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('pyb-viz-style')) return;
    var s = document.createElement('style'); s.id = 'pyb-viz-style'; s.textContent = css; document.head.appendChild(s);
  }
  function chip(parent, cls, text) {
    var c = html('span', undefined, 'viz-chip ' + cls); c.appendChild(html('i')); c.appendChild(document.createTextNode(text)); parent.appendChild(c);
  }
  function plural(n, a, b, c) { return L.plural(n, a, b, c); }

  /* ---------- py-session-compare ---------- */
  L.widgets['py-session-compare'] = function (host) {
    injectStyle();
    var n = Math.round(num(host.dataset.requests, 8, 1, 40)), con = num(host.dataset.connect, 15, 0, 200), work = num(host.dataset.work, 25, 1, 200);
    var v = L.setup(host, host.dataset.title || 'Новое соединение на каждый запрос или Session');
    var legend = html('div', undefined, 'viz-legend'); v.stage.appendChild(legend);
    chip(legend, 'warning', 'открытие соединения'); chip(legend, 'primary', 'работа сервера над запросом');
    var t = 0, hold = 0, hoverT = null, geo = {}, frozen = false;

    function plan() {
      var a = [], b = [], x = 0, i;
      for (i = 0; i < n; i++) {
        if (con > 0) a.push({ s: x, e: x + con, k: 'c', i: i });
        x += con; a.push({ s: x, e: x + work, k: 'w', i: i }); x += work;
      }
      var ta = x, y = 0;
      if (con > 0) b.push({ s: 0, e: con, k: 'c', i: 0 });
      y = con;
      for (i = 0; i < n; i++) { b.push({ s: y, e: y + work, k: 'w', i: i }); y += work; }
      return { a: a, ta: ta, b: b, tb: y };
    }
    var P = plan();
    function state(list, time) {
      var done = 0, cur = null;
      list.forEach(function (s) { if (s.k === 'w' && s.e <= time) done++; if (s.s <= time && time < s.e) cur = s; });
      var text = cur ? 'запрос ' + (cur.i + 1) + (cur.k === 'c' ? ': открывает соединение' : ': сервер работает') : done >= n ? 'всё готово' : 'ещё не начал';
      return { done: done, text: text };
    }
    function draw() {
      var H = 236, W = v.canvas(H), left = 12, right = W - 12, T = P.ta;
      function X(time) { return left + Math.min(time, T) / T * (right - left); }
      var laneH = 40, yA = 52, yB = 140, axisY = 200;
      geo = { left: left, right: right, T: T };
      var sc = L.scale(T);
      sc.ticks.forEach(function (tk) {
        if (tk > T) return;
        v.add('line', { x1: X(tk), x2: X(tk), y1: 30, y2: axisY, class: 'grid' });
        v.label(Math.min(Math.max(X(tk), left + 14), right - 14), axisY + 18, fmt(tk, 0), 'muted small');
      });
      v.label((left + right) / 2, H - 6, 'время от старта, мс', 'muted small');
      [[yA, P.a, P.ta, (W < 460 ? 'Без Session: ' + n + ' × (откр. + работа)' : 'Без Session: ' + n + ' × (открыть + работа)')], [yB, P.b, P.tb, 'С Session: открыть один раз']].forEach(function (lane) {
        var y = lane[0];
        v.label(left, y - 10, lane[3], 'small', 'start');
        v.add('rect', { x: left, y: y, width: X(lane[2]) - left, height: laneH, rx: 4, class: 'band' });
        lane[1].forEach(function (s) {
          if (t <= s.s) return;
          var x1 = X(s.s), x2 = X(Math.min(s.e, t));
          v.add('rect', { x: x1, y: y, width: Math.max(0.6, x2 - x1), height: laneH, class: 'pyb-seg ' + (s.k === 'c' ? 'warning' : 'primary') + ' fill' });
        });
        if (t >= lane[2]) { var side = X(lane[2]) < right - 70; v.label(side ? X(lane[2]) + 6 : right, side ? y + laneH / 2 + 5 : y + laneH + 16, ms(lane[2]), lane[2] === P.ta ? 'danger' : 'ok', side ? 'start' : 'end'); }
      });
      if (t >= P.tb && P.ta > P.tb) {
        v.add('line', { x1: X(P.tb), x2: X(P.ta), y1: yB + laneH + 7, y2: yB + laneH + 7, class: 'ok marker' });
        v.label((X(P.tb) + X(P.ta)) / 2, yB + laneH + 24, 'экономия ' + ms(P.ta - P.tb), 'ok small halo');
      }
      var cur = hoverT !== null ? hoverT : (t < T ? t : null);
      if (cur !== null) v.add('line', { x1: X(cur), x2: X(cur), y1: 34, y2: axisY, class: 'muted marker' });
      geo.X = X;
    }
    function describe() {
      var saved = P.ta - P.tb, share = saved / P.ta;
      var text = 'Без Session каждый из <b>' + n + '</b> ' + plural(n, 'запроса', 'запросов', 'запросов') + ' сначала открывает соединение (<b>' + ms(con) + '</b>), потом ждёт сервер (<b>' + ms(work) + '</b>): всего <b>' + ms(P.ta) + '</b>.<br>' +
        'С Session соединение открывается один раз, остальные запросы идут по нему: ' + ms(con) + ' + ' + n + ' × ' + ms(work) + ' = <b>' + ms(P.tb) + '</b>.<br>';
      if (n === 1) text += 'Запрос всего один, поэтому разницы нет: соединение всё равно надо открыть. Выигрыш начинается со второго запроса.';
      else if (con === 0) text += 'Открытие соединения ничего не стоит, и разницы нет. Так почти бывает на одной машине, но не в сети.';
      else text += 'Экономия: <b>' + ms(saved) + '</b> (' + L.pct(share) + ' времени), это ' + (n - 1) + ' ' + plural(n - 1, 'пропущенное открытие', 'пропущенных открытия', 'пропущенных открытий') + ' соединения. Чем дальше сервер и чем короче сам запрос, тем заметнее выигрыш.';
      v.explain(text);
    }
    function refresh() { P = plan(); t = frozen ? P.ta : 0; hold = 0; draw(); describe(); }
    v.slider('Запросов', 1, 40, 1, n, function (x) { n = Math.round(x); refresh(); });
    v.slider('Открытие соединения', 0, 200, 1, con, function (x) { con = x; refresh(); }, 'мс');
    v.slider('Работа сервера', 1, 200, 1, work, function (x) { work = x; refresh(); }, 'мс');
    v.tryIt('поставь открытие соединения 1 мс (так близко к стенду на твоём компьютере) и работу сервера 25 мс: полосы почти сольются. Теперь подними открытие до 100 мс, как к серверу в другом городе: разница станет огромной. Наведи на любое место шкалы: увидишь, что делает каждый запрос в этот момент.');
    v.hover(function (e, q) {
      var time = Math.max(0, Math.min(geo.T, (q.x - geo.left) / (geo.right - geo.left) * geo.T)); hoverT = time; draw();
      var a = state(P.a, time), b = state(P.b, time);
      v.showTip('<b>' + ms(time) + ' от старта</b><br>Без Session: ' + a.text + ', готово ' + a.done + ' из ' + n + '<br>С Session: ' + b.text + ', готово ' + b.done + ' из ' + n, e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    var handle = L.animate(v, function (dt) {
      if (t >= P.ta) { hold += dt; if (hold > 1.8) { t = 0; hold = 0; } }
      else t = Math.min(P.ta, t + dt * P.ta / 5);
      draw();
    }, function () { frozen = true; if (P) { t = P.ta; draw(); } }, function () { frozen = false; t = 0; hold = 0; });
    refresh(); v.onResize(draw);
    return handle;
  };

  /* ---------- py-task-weights ---------- */
  var TASKS = [
    { id: 'catalog', cls: 'primary', what: 'открыл каталог' },
    { id: 'product', cls: 'response', what: 'открыл карточку товара' },
    { id: 'cart', cls: 'violet', what: 'положил товар в корзину' },
    { id: 'order', cls: 'warning', what: 'оформил заказ' }
  ];
  L.widgets['py-task-weights'] = function (host) {
    injectStyle();
    var users = Math.round(num(host.dataset.users, 3, 1, 5));
    var given = json(host.dataset.weights, {}), weights = {};
    TASKS.forEach(function (k) { weights[k.id] = Math.round(num(given[k.id], { catalog: 6, product: 3, cart: 2, order: 1 }[k.id], 0, 10)); });
    var v = L.setup(host, host.dataset.title || 'Пользователи выбирают задачи по весам');
    var people, counts, total, acc = 0, geo = {}, pick = null, frozen = false;
    function reset() {
      people = []; counts = {}; total = 0;
      for (var i = 0; i < users; i++) people.push({ cart: 0, orders: 0, reqs: 0, last: null, result: '' });
      TASKS.forEach(function (k) { counts[k.id] = 0; });
    }
    function sum() { return TASKS.reduce(function (s, k) { return s + weights[k.id]; }, 0); }
    function choose() {
      var r = Math.random() * sum();
      for (var i = 0; i < TASKS.length; i++) { r -= weights[TASKS[i].id]; if (r < 0) return TASKS[i]; }
      return TASKS[0];
    }
    function stepAll() {
      if (!sum()) return;
      people.forEach(function (p) {
        var k = choose(); p.reqs++; p.last = k; counts[k.id]++; total++;
        if (k.id === 'cart') { p.cart++; p.result = '201'; }
        else if (k.id === 'order') {
          if (p.cart > 0) { p.orders++; p.cart = 0; p.result = '201'; } else p.result = '400: корзина пуста';
        } else p.result = '200';
      });
    }
    function reseed() { reset(); for (var i = 0; i < (frozen ? 60 : 12); i++) stepAll(); }
    function draw() {
      var rowB = 32, topB = 40, topU = topB + TASKS.length * rowB + 44, rowU = 50, H = topU + users * rowU + 10;
      var W = v.canvas(H), barL = 84, barR = W - 70, S = sum();
      geo = { topB: topB, rowB: rowB, topU: topU, rowU: rowU, barL: barL, barR: barR };
      v.label(8, 20, W < 460 ? 'Сколько раз выбрана задача' : 'Сколько раз выбрана каждая задача', 'small', 'start');
      TASKS.forEach(function (k, i) {
        var y = topB + i * rowB, share = total ? counts[k.id] / total : 0, want = S ? weights[k.id] / S : 0;
        v.label(8, y + 17, k.id, 'small', 'start');
        v.add('rect', { x: barL, y: y + 4, width: barR - barL, height: 18, rx: 4, class: 'band' });
        if (share > 0) v.add('rect', { x: barL, y: y + 4, width: Math.max(2, share * (barR - barL)), height: 18, rx: 4, class: k.cls + ' fill' + (pick === 'b' + i ? ' hl' : '') });
        v.add('line', { x1: barL + want * (barR - barL), x2: barL + want * (barR - barL), y1: y, y2: y + 26, class: 'muted marker' });
        v.label(W - 8, y + 18, counts[k.id] + ' · ' + L.pct(share), 'small', 'end');
      });
      v.label(barL, topB + TASKS.length * rowB + 14, W < 460 ? 'штрих: по весам; столбец: факт' : 'штрих: доля по весам, столбец: что получилось', 'muted small', 'start');
      v.label(8, topU - 6, W < 460 ? 'ShopUser: своё состояние у каждого' : 'Объекты ShopUser: у каждого своё состояние', 'small', 'start');
      people.forEach(function (p, i) {
        var y = topU + i * rowU;
        v.add('rect', { x: 4, y: y + 2, width: W - 8, height: rowU - 8, rx: 8, class: 'box' });
        v.add('circle', { cx: 20, cy: y + 18, r: 6, class: (p.last ? p.last.cls : 'muted') + ' fill' });
        v.label(34, y + 22, W < 460 ? 'user' + (i + 1) + ': корзина ' + p.cart + ', заказов ' + p.orders + ', запр. ' + p.reqs : 'user' + (i + 1) + '  корзина: ' + p.cart + '  заказов: ' + p.orders + '  запросов: ' + p.reqs, 'small', 'start');
        v.label(34, y + 40, p.last ? (W < 460 ? '' : 'последнее: ') + p.last.id + ' → ' + (W < 460 ? p.result.replace('корзина пуста', 'пусто') : p.result) : 'ещё ничего не делал', 'muted small', 'start');
      });
    }
    function describe() {
      var S = sum();
      if (!S) { v.explain('Все веса равны нулю: пользователям нечего выбирать, они стоят на месте. Подними хотя бы один вес.'); return; }
      var parts = TASKS.filter(function (k) { return weights[k.id] > 0; }).map(function (k) {
        return '<b>' + k.id + '</b>: вес ' + weights[k.id] + ' из ' + S + ' = ' + L.pct(weights[k.id] / S) + ', выпало ' + L.pct(total ? counts[k.id] / total : 0);
      });
      var withCart = people.filter(function (p) { return p.cart > 0; }).length;
      v.explain('Всего выбрано <b>' + total + '</b> ' + plural(total, 'действие', 'действия', 'действий') + ' (' + users + ' ' + plural(users, 'пользователь', 'пользователя', 'пользователей') + ', каждый делает свой выбор независимо).<br>' + parts.join('<br>') +
        '<br>У каждого пользователя своя корзина: сейчас товары лежат у ' + withCart + ' из ' + users + '. Пока выборок мало, доли гуляют; чем дольше идёт показ, тем ближе они к весам.');
    }
    function refresh() { reseed(); draw(); describe(); }
    TASKS.forEach(function (k) { v.slider('Вес ' + k.id, 0, 10, 1, weights[k.id], function (x) { weights[k.id] = Math.round(x); refresh(); }); });
    v.slider('Пользователей', 1, 5, 1, users, function (x) { users = Math.round(x); refresh(); });
    v.button('Сбросить счётчики', refresh);
    v.tryIt('обнули вес catalog и подними order до 10: заказы пойдут один за другим, и у пользователей без корзины появится «400: корзина пуста». Наведи на строку пользователя или на столбец: появится подробность.');
    v.hover(function (e, q) {
      var S = sum(), i;
      if (q.y >= geo.topB && q.y < geo.topB + TASKS.length * geo.rowB) {
        i = Math.floor((q.y - geo.topB) / geo.rowB); var k = TASKS[i]; pick = 'b' + i; draw();
        v.showTip('<b>' + k.id + '</b>: ' + k.what + '<br>выбрана ' + counts[k.id] + ' ' + plural(counts[k.id], 'раз', 'раза', 'раз') + ' из ' + total + '<br>вес ' + weights[k.id] + (S ? ' из ' + S + ', ждём ' + L.pct(weights[k.id] / S) : ''), e.clientX, e.clientY);
      } else if (q.y >= geo.topU && q.y < geo.topU + people.length * geo.rowU) {
        i = Math.floor((q.y - geo.topU) / geo.rowU); var p = people[i]; pick = null; draw();
        v.showTip('<b>user' + (i + 1) + '</b>: отдельный объект<br>self.cart = ' + p.cart + ', self.orders = ' + p.orders + '<br>запросов сделал ' + p.reqs + (p.last ? '<br>последний: ' + p.last.what + ' (' + p.result + ')' : ''), e.clientX, e.clientY);
      } else { pick = null; draw(); v.hideTip(); }
    }, function () { pick = null; draw(); });
    var handle = L.animate(v, function (dt) {
      acc += dt;
      if (acc >= 0.6) { acc = 0; stepAll(); draw(); describe(); }
    }, function () { frozen = true; if (people) { reseed(); draw(); describe(); } }, function () { frozen = false; });
    refresh(); v.onResize(draw);
    return handle;
  };

  /* ---------- py-report ---------- */
  L.widgets['py-report'] = function (host) {
    injectStyle();
    var list = json(host.dataset.scenarios, null);
    if (!Array.isArray(list) || !list.length) throw new Error('data-scenarios: JSON-массив сценариев {"name","intro","lines":[{"t","n"}]}.');
    var v = L.setup(host, host.dataset.title || 'Читаем отчёт pytest');
    var chips = html('div', undefined, 'pyb-chips'); v.stage.appendChild(chips);
    var intro = html('p', '', 'pyb-intro'); v.stage.appendChild(intro);
    var rep = html('div', undefined, 'pyb-rep'); v.stage.appendChild(rep);
    var cur = 0, sel = -1, buttons = [];
    function code(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); }
    function kind(t) {
      return /^E\s/.test(t) ? 'err' : /^>/.test(t) ? 'arrow' : /^(FAILED|ERROR)/.test(t) ? 'err' : /^=+/.test(t) ? (/failed|error/.test(t) ? 'err' : /passed/.test(t) ? 'ok' : 'head') : '';
    }
    function show(i) {
      cur = i; sel = -1;
      buttons.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      var s = list[i];
      intro.innerHTML = code(s.intro || '');
      rep.replaceChildren();
      (s.lines || []).forEach(function (ln, k) {
        var el = html('div', ln.t || ' ', 'pyb-line ' + kind(ln.t || '') + (ln.n ? ' has' : ''));
        if (ln.n) {
          el.tabIndex = 0;
          var open = function (e) { sel = k; mark(); v.explain('<b>Строка отчёта:</b> <code>' + esc(ln.t.trim()) + '</code><br>' + code(ln.n)); if (e && e.clientX !== undefined) v.showTip(code(ln.n), e.clientX, e.clientY); };
          el.addEventListener('pointermove', function (e) { v.showTip(code(ln.n), e.clientX, e.clientY); });
          el.addEventListener('pointerleave', v.hideTip);
          el.addEventListener('click', open);
          el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
          el.addEventListener('focus', function () { v.hideTip(); });
        }
        rep.appendChild(el);
      });
      v.explain(s.summary ? code(s.summary) : 'Наведи на подсвеченную слева строку отчёта или нажми на неё: объясню, что она значит.');
    }
    function mark() { Array.prototype.forEach.call(rep.children, function (el, k) { el.classList.toggle('sel', k === sel); }); }
    list.forEach(function (s, i) {
      var b = html('button', s.name); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', function () { show(i); });
      chips.appendChild(b); buttons.push(b);
    });
    v.tryIt('переключай сценарии сверху и читай отчёт сверху вниз: сначала итоговая строка, потом строка со стрелкой <code>&gt;</code>, потом строки <code>E</code>.');
    show(0);
  };
})();
