/* Виджеты урока 7.7 «Трейсы: путь одного запроса»: регистрируются через window.LTViz.
   Префикс trace-. Спаны нарисованы по структуре, которую даёт инструментация стенда; числа учебные, не измерения.

   trace-waterfall: водопад спанов одного запроса «Магазина»: кто сколько времени держал запрос.
     data-scenario  order | payment | retries | n1 (по умолчанию order) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, fmt = L.fmt;

  if (!document.getElementById('trc-style')) {
    var st = document.createElement('style');
    st.id = 'trc-style';
    st.textContent = [
      '.trc-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:0 0 8px}',
      '.trc-tabs button{min-height:32px;padding:3px 10px;font-size:.85rem}',
      '.trc-legend{display:flex;flex-wrap:wrap;gap:4px 12px;margin:8px 0 0;font-size:.8rem;color:var(--muted)}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // Сервисы и цвета полос: цвет несёт смысл «кто работал», ошибка красная.
  var SVC = {
    shop: { name: 'shop', cls: 'primary' },
    payment: { name: 'payment', cls: 'violet' },
    postgres: { name: 'PostgreSQL', cls: 'response' },
    redis: { name: 'Redis', cls: 'warning' }
  };

  // Спан: [имя, сервис, старт мс, длительность мс, глубина, подсказка, ошибка].
  function S(name, svc, start, dur, depth, note, err) { return { name: name, svc: svc, start: start, dur: dur, depth: depth, note: note || '', err: !!err }; }

  function orderBase(payAt, payDur, payOk) {
    var s = [
      S('POST /api/orders', 'shop', 0, 0, 0, 'http.route=/api/orders, http.status_code=' + (payOk === false ? 502 : 201)),
      S('GET', 'redis', 1, 2, 1, 'db.statement=GET session:?'),
      S('HGETALL', 'redis', 3, 2, 1, 'db.statement=HGETALL cart:?'),
      S('db.pool.getconn', 'shop', 5, 2, 1, 'ожидание соединения из пула'),
      S('SELECT', 'postgres', 7, 7, 1, 'SELECT ... FROM products WHERE id = ANY(%s) ... FOR UPDATE'),
      S('INSERT', 'postgres', 14, 4, 1, 'INSERT INTO orders ...'),
      S('INSERT', 'postgres', 18, 3, 1, 'INSERT INTO order_items ...'),
      S('UPDATE', 'postgres', 21, 3, 1, 'UPDATE products SET stock = stock - %s ...'),
      S('INSERT', 'postgres', 24, 3, 1, 'INSERT INTO order_items ...'),
      S('UPDATE', 'postgres', 27, 3, 1, 'UPDATE products SET stock = stock - %s ...')
    ];
    return { spans: s, at: 30 };
  }

  var SCN = {
    order: {
      name: 'Заказ: всё хорошо',
      build: function () {
        var b = orderBase(), s = b.spans;
        s.push(S('POST', 'shop', 30, 58, 1, 'httpx: http.url=http://payment:8001/pay, status 200'));
        s.push(S('POST /pay', 'payment', 33, 52, 2, 'в payment спан продолжает тот же trace_id: заголовок traceparent'));
        s.push(S('DEL', 'redis', 90, 2, 1, 'db.statement=DEL cart:?'));
        s[0].dur = 94;
        return s;
      },
      text: function () { return 'Типичный заказ за <b>94 мс</b>. Оплата (спаны <code>POST</code> и <code>POST /pay</code>) занимает больше половины, SQL и Redis вместе около 30 мс. Это «здоровая» форма: ни одного длинного пустого места, спаны идут друг за другом.'; }
    },
    payment: {
      name: 'Медленная оплата',
      build: function () {
        var b = orderBase(), s = b.spans;
        s.push(S('POST', 'shop', 30, 2010, 1, 'httpx: status 200, ждали ответ 2 секунды'));
        s.push(S('POST /pay', 'payment', 33, 2004, 2, 'в payment: PAYMENT_DELAY_MS=2000'));
        s.push(S('DEL', 'redis', 2042, 2, 1, 'db.statement=DEL cart:?'));
        s[0].dur = 2046;
        return s;
      },
      text: function () { return 'Тот же заказ, но оплата отвечает 2 секунды. Весь запрос <b>2046 мс</b>, из них <b>2004 мс</b> это спан <code>POST /pay</code> в сервисе payment: виновник виден сразу, без догадок. Обрати внимание на <code>db.pool.getconn</code> и SQL выше: соединение из пула взято в самом начале и всё это время занято (оплата внутри транзакции, урок 11.5).'; }
    },
    retries: {
      name: 'Оплата падает, повторы',
      build: function () {
        var b = orderBase(0, 0, false), s = b.spans, t = 30, i;
        for (i = 0; i < 4; i++) {
          s.push(S('POST', 'shop', t, 56, 1, 'httpx: попытка ' + (i + 1) + ' из 4, status 500', true));
          s.push(S('POST /pay', 'payment', t + 3, 50, 2, 'payment отказал: HTTP 500 (PAYMENT_FAIL_RATE=1)', true));
          t += 56;
        }
        s[0].dur = t + 2;
        s[0].err = true;
        return s;
      },
      text: function () { return 'Оплата отказывает, а shop повторяет вызов без паузы: четыре попытки подряд, все красные (<code>PAYMENT_RETRIES=3</code>: первая и три повтора). Запрос закончился ошибкой 502 за <b>256 мс</b>, а payment получил в четыре раза больше обращений, чем заказов. Такой «шторм повторов» на метриках выглядит как рост RPS оплаты, а в трейсе виден как лесенка одинаковых спанов.'; }
    },
    n1: {
      name: 'N+1: список заказов',
      build: function () {
        var s = [
          S('GET /api/orders', 'shop', 0, 96, 0, 'http.route=/api/orders, http.status_code=200'),
          S('GET', 'redis', 1, 2, 1, 'db.statement=GET session:?'),
          S('db.pool.getconn', 'shop', 3, 1, 1, 'ожидание соединения из пула'),
          S('SELECT', 'postgres', 4, 36, 1, 'SELECT ... FROM orders WHERE user_id = %s ... LIMIT 20 (Seq Scan: нет индекса)')
        ], t = 40, i;
        for (i = 0; i < 20; i++) { s.push(S('SELECT', 'postgres', t, 2.6, 1, 'SELECT ... FROM order_items oi JOIN products p ... WHERE oi.order_id = ANY(%s) (заказ ' + (i + 1) + ' из 20)')); t += 2.8; }
        return s;
      },
      text: function () { return 'Список заказов за <b>96 мс</b>: один медленный <code>SELECT</code> по <code>orders</code> (36 мс, нет индекса) и потом <b>20 одинаковых коротких</b> <code>SELECT</code>: по одному на каждый заказ. Это N+1 (урок 11.3). Каждый запрос быстрый, поэтому ни один не попадёт в журнал медленных запросов, но «лесенка» в трейсе видна сразу. Нажми «Свернуть повторы».'; }
    }
  };
  var ORDER = ['order', 'payment', 'retries', 'n1'];

  L.widgets['trace-waterfall'] = function (host) {
    var key = SCN[host.dataset.scenario] ? host.dataset.scenario : 'order';
    var v = L.setup(host, host.dataset.title || 'Водопад спанов одного запроса');
    var spans, rows, total, folded = false, picked = -1, clock = 0, SPEED = 1, HOLD = 1.2, ctl;
    var ROW = 22, TOP = 26;

    var tb = html('div', undefined, 'trc-tabs'), btns = [];
    v.stage.insertBefore(tb, v.stage.firstChild);
    ORDER.forEach(function (k) {
      var b = html('button', SCN[k].name); b.type = 'button'; b.setAttribute('aria-pressed', String(k === key));
      b.addEventListener('click', function () { choose(k); });
      btns.push(b); tb.appendChild(b);
    });

    function load() {
      spans = SCN[key].build();
      total = spans[0].dur;
      // Свёрнутые повторы: подряд идущие спаны с тем же именем, сервисом и глубиной (минимум 3).
      rows = [];
      var i = 0;
      while (i < spans.length) {
        var j = i + 1;
        while (folded && j < spans.length && spans[j].name === spans[i].name && spans[j].svc === spans[i].svc && spans[j].depth === spans[i].depth &&
          spans[j].dur <= spans[i].dur * 3 && spans[i].dur <= spans[j].dur * 3) j++;
        if (folded && j - i >= 3) {
          var g = spans.slice(i, j), end = g[g.length - 1].start + g[g.length - 1].dur, sum = g.reduce(function (a, x) { return a + x.dur; }, 0);
          rows.push({ name: spans[i].name + ' x' + g.length, svc: spans[i].svc, start: g[0].start, dur: end - g[0].start, depth: spans[i].depth, err: g.some(function (x) { return x.err; }),
            note: g.length + ' одинаковых спанов подряд, суммарно ' + L.ms(sum), group: g.length, sum: sum });
        } else { for (var k = i; k < j; k++) rows.push(spans[k]); }
        i = j;
      }
      picked = -1;
    }
    function choose(k) {
      key = k; btns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(ORDER[i] === k)); });
      load(); clock = 0; describe();
      if (ctl && !ctl.reduced) ctl.play(); else { clock = total; draw(); }
    }

    var geo = {};
    function draw() {
      var H = TOP + rows.length * ROW + 34, W = v.canvas(H);
      var narrow = W < 520, labW = Math.round(narrow ? Math.min(150, W * 0.4) : Math.min(240, W * 0.34)), left = labW + 8, right = W - 12;
      var sc = L.scale(total * 1.02), max = sc.max;
      function X(t) { return left + t / max * (right - left); }
      geo = { left: left, right: right, labW: labW, X: X };
      sc.ticks.forEach(function (tk) {
        v.add('line', { x1: X(tk), x2: X(tk), y1: TOP - 4, y2: TOP + rows.length * ROW, class: 'grid' });
        v.label(X(tk), TOP + rows.length * ROW + 16, fmt(tk, 0) + ' мс', 'muted small', tk === 0 ? 'start' : 'middle');
      });
      var chars = Math.max(8, Math.floor(labW / 6.6));
      rows.forEach(function (r, i) {
        var y = TOP + i * ROW, c = r.err ? 'danger' : SVC[r.svc].cls, shown = Math.max(0, Math.min(r.dur, clock - r.start));
        if (i === picked) v.add('rect', { x: 2, y: y, width: W - 4, height: ROW - 2, rx: 4, class: 'box busy' });
        var name = r.name, indent = Math.min(r.depth, 2) * 10;
        if (name.length + indent / 6.6 > chars) name = name.slice(0, Math.max(3, chars - Math.ceil(indent / 6.6) - 1)) + '…';
        v.label(6 + indent, y + 15, name, 'small', 'start');
        if (clock >= r.start || clock >= total) {
          var w = Math.max(2, X(r.start + (clock >= total ? r.dur : shown)) - X(r.start));
          v.add('rect', { x: X(r.start), y: y + 3, width: w, height: ROW - 8, rx: 3, class: c + ' fill', opacity: r.group ? 0.65 : 0.9 });
        }
      });
      v.label(left, TOP - 10, 'время от начала запроса', 'muted small', 'start');
      // Лента-легенда: цвета сервисов.
      var done = clock >= total;
      v.status.textContent = done ? 'Весь запрос: ' + L.ms(total) + ', спанов: ' + spans.length + '.' : 'Идёт запрос: прошло ' + L.ms(Math.min(clock, total)) + ' из ' + L.ms(total) + '.';
    }

    function describe() {
      var r = picked >= 0 ? rows[picked] : null;
      if (!r) { v.explain(SCN[key].text()); return; }
      var self = r.dur;
      if (r.depth === 0 && !r.group) self = r.dur - spans.filter(function (x) { return x.depth === 1; }).reduce(function (a, x) { return a + x.dur; }, 0);
      v.explain('<b>' + esc(r.name) + '</b> (' + esc(SVC[r.svc].name) + '): начало +' + L.ms(r.start) + ', длительность <b>' + L.ms(r.dur) + '</b>, ' + L.pct(r.dur / total) + ' запроса. ' + esc(r.note) +
        '<br><span class="viz-note">Нажми на другую строку или вернись к сценарию, чтобы увидеть общий вывод.</span>');
    }

    function rowAt(q) { var i = Math.floor((q.y - TOP) / ROW); return i >= 0 && i < rows.length ? i : -1; }
    function tipFor(i) {
      var r = rows[i];
      return '<b>' + esc(r.name) + '</b><br>сервис: ' + esc(SVC[r.svc].name) + (r.err ? ' <b>(ошибка)</b>' : '') +
        '<br>старт: +' + L.ms(r.start) + ', длительность: <b>' + L.ms(r.dur) + '</b><br>' + esc(r.note);
    }
    v.hover(function (e, q) { var i = rowAt(q); if (i < 0) return v.hideTip(); v.showTip(tipFor(i), e.clientX, e.clientY); }, function () {});
    v.stage.addEventListener('click', function (e) {
      if (!v.svg || !v.svg.contains(e.target)) return;
      var q = v.local(e), i = q ? rowAt(q) : -1;
      picked = i === picked ? -1 : i; describe(); draw();
    });

    var foldBtn = v.button('Свернуть повторы', function () {
      folded = !folded; foldBtn.textContent = folded ? 'Показать все спаны' : 'Свернуть повторы';
      load(); describe(); draw();
    });
    // Легенда сервисов.
    var legend = html('div', undefined, 'trc-legend');
    Object.keys(SVC).concat(['err']).forEach(function (k) {
      var chip = html('span', undefined, 'viz-chip ' + (k === 'err' ? 'danger' : SVC[k].cls)); chip.appendChild(html('i'));
      chip.appendChild(document.createTextNode(k === 'err' ? 'ошибка' : SVC[k].name)); legend.appendChild(chip);
    });
    v.stage.parentNode.insertBefore(legend, v.stage.nextSibling);

    v.tryIt('переключи сценарий и найди самую длинную полосу: она показывает, где запрос провёл время. Нажми на строку, чтобы увидеть детали спана, а в «N+1: список заказов» нажми «Свернуть повторы».');

    function tick(dt) {
      clock += dt * total / 4 * SPEED;
      if (clock >= total + total * 0.3) { clock = total; draw(); return false; }
      draw();
    }
    function still() { clock = total; draw(); }
    load(); describe(); draw();
    ctl = L.animate(v, tick, still, function () { clock = 0; });
    v.onResize(draw);
    if (ctl.reduced) still();
  };
})();
