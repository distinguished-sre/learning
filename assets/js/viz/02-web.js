/* Виджеты темы 2 «Как устроен веб-сервис»: регистрируются через window.LTViz (см. конец assets/js/viz.js).
   web-http-exchange: обмен запросом и ответом со «Магазином», сценарии с реальными ответами.
   web-index-search: полный перебор таблицы против поиска по индексу. */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, fmt = L.fmt;

  var style = document.createElement('style');
  style.textContent = [
    '.wx-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
    '.viz .wx-chip{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:4px 10px;border-radius:999px;font-size:.82rem}',
    '.viz .wx-chip[aria-pressed="true"]{border-color:var(--accent-ink);background:var(--bg-code);font-weight:700}',
    '.wx-dot{width:10px;height:10px;border-radius:50%;flex:none;background:var(--muted)}',
    '.wx-s2{background:var(--green)}.wx-s3{background:var(--blue)}.wx-s4{background:var(--yellow)}.wx-s5{background:var(--red)}.wx-s0{background:var(--violet)}',
    '.wx-road{position:relative;height:34px;margin:2px 0 8px;display:flex;align-items:center;justify-content:space-between}',
    '.wx-road::before{content:"";position:absolute;left:44px;right:44px;top:50%;border-top:3px dashed var(--line)}',
    '.wx-end{position:relative;z-index:1;width:40px;text-align:center;font-size:1.4rem;line-height:1}',
    '.wx-end.busy{filter:drop-shadow(0 0 6px var(--yellow))}',
    '.wx-env{position:absolute;top:3px;left:44px;font-size:1.3rem;z-index:2;transition:none}',
    '.wx-note{flex:1;text-align:center;font-size:.8rem;color:var(--muted);z-index:1;padding:0 52px}',
    '.wx-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.wx-card{min-width:0;border:1px solid var(--line);border-radius:10px;background:var(--bg-code);overflow:hidden}',
    '.wx-card h4{margin:0;padding:6px 10px;font-size:.8rem;font-weight:700;background:var(--bg-2);border-bottom:1px solid var(--line);color:var(--muted)}',
    '.wx-raw{margin:0;padding:8px 10px;font:12.5px/1.55 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;min-height:11em}',
    '.wx-l{display:block;border-radius:4px;cursor:help;padding:0 3px}',
    '.wx-l:hover{background:color-mix(in srgb,var(--accent-ink) 18%,transparent)}',
    '.wx-start{font-weight:700}.wx-hd{color:var(--muted)}.wx-bd{color:var(--blue)}',
    '.wx-wait{color:var(--muted);font-style:italic}',
    '.wx-badge{display:inline-block;margin-left:6px;padding:0 8px;border-radius:999px;color:var(--bg);font-weight:700}',
    '.wx-badge.wx-s2{background:var(--green)}.wx-badge.wx-s3{background:var(--blue)}.wx-badge.wx-s4{background:var(--yellow)}.wx-badge.wx-s5{background:var(--red)}.wx-badge.wx-s0{background:var(--violet)}',
    '@media (max-width:640px){.wx-cols{grid-template-columns:1fr}.wx-raw{min-height:0}.wx-note{display:none}}'
  ].join('\n');
  document.head.appendChild(style);

  var DATE = 'Sat, 03 Oct 2026 10:15:02 GMT';
  var HOST = 'Host: localhost:8000', UA = 'User-Agent: curl/8.5.0', ACC = 'Accept: */*';
  var JSONT = 'Content-Type: application/json';
  function resHeaders(len, extra) {
    return ['date: ' + DATE, 'server: uvicorn'].concat(extra || [], ['content-length: ' + len, 'content-type: application/json', 'x-request-id: 3f9a1c0e7b2d4a58b6c1e90d2f7a4b13']);
  }
  function jres(status, reason, body, extra) { return { status: status, reason: reason, headers: resHeaders(new TextEncoder().encode(body).length, extra), body: body }; }
  function get(path, auth) { return { line: 'GET ' + path + ' HTTP/1.1', headers: [HOST, UA, ACC].concat(auth ? ['Authorization: Bearer ' + auth] : []), body: '' }; }
  function post(path, body, auth) {
    return { line: 'POST ' + path + ' HTTP/1.1', headers: [HOST, UA, ACC].concat(auth ? ['Authorization: Bearer ' + auth] : [], [JSONT, 'Content-Length: ' + body.length]), body: body };
  }
  var TOKEN = '9f2c41d7a0b3…';
  var NOCART = '{"detail":"cart is empty"}';

  var SC = [
    { id: 'product-ok', tab: '200 товар', cls: 2, who: 'ok', title: 'Успех',
      req: get('/api/products/42'),
      res: jres(200, 'OK', '{"id":42,"name":"Товар 42","price":1654.0,"category_id":2,"stock":1000000}'),
      why: 'Всё получилось: сервер нашёл товар 42 и вернул его описание в теле. Код 200 означает «сделано, результат в теле».' },
    { id: 'redirect', tab: '307 слэш', cls: 3, who: 'ok', title: 'Переадресация',
      req: get('/api/products/'),
      res: { status: 307, reason: 'Temporary Redirect', headers: ['date: ' + DATE, 'server: uvicorn', 'location: http://localhost:8000/api/products', 'content-length: 0', 'x-request-id: 3f9a1c0e7b2d4a58b6c1e90d2f7a4b13'], body: '' },
      why: 'Адрес с лишним «/» на конце сервер считает чужим, но знает правильный и сообщает его в заголовке <code>location</code>. Код 3xx значит «иди по другому адресу». Браузер пойдёт сам, <code>curl</code> только если добавить флаг <code>-L</code>.' },
    { id: 'not-found', tab: '404 нет товара', cls: 4, who: 'client', title: 'Нет такого товара',
      req: get('/api/products/999999'),
      res: jres(404, 'Not Found', '{"detail":"product not found"}'),
      why: 'Сервер исправен и запрос понял, но товара с номером 999999 нет (в магазине их 10 000). Виноват запрос: повторять его без изменений бессмысленно.' },
    { id: 'bad-path', tab: '404 нет адреса', cls: 4, who: 'client', title: 'Нет такого адреса',
      req: get('/api/product/42'),
      res: jres(404, 'Not Found', '{"detail":"Not Found"}'),
      why: 'Опечатка в пути: <code>product</code> вместо <code>products</code>. Такого адреса у сервера нет совсем. Сравни с предыдущим сценарием: код тот же, а смысл другой, его объясняет тело.' },
    { id: 'method', tab: '405 метод', cls: 4, who: 'client', title: 'Метод не разрешён',
      req: { line: 'DELETE /api/products/42 HTTP/1.1', headers: [HOST, UA, ACC], body: '' },
      res: jres(405, 'Method Not Allowed', '{"detail":"Method Not Allowed"}', ['allow: GET']),
      why: 'Адрес существует, но удалять товары через него нельзя. Сервер подсказывает в заголовке <code>allow</code>, какие методы здесь работают: только GET.' },
    { id: 'validation', tab: '422 параметр', cls: 4, who: 'client', title: 'Неверное значение',
      req: get('/api/products?size=500'),
      res: jres(422, 'Unprocessable Content', '{"detail":[{"type":"less_than_equal","loc":["query","size"],"msg":"Input should be less than or equal to 100","input":"500","ctx":{"le":100}}]}'),
      why: 'Адрес верный, но параметр <code>size</code> больше допустимых 100. В теле сервер подробно объяснил, что не так: <code>loc</code> указывает место ошибки, <code>msg</code> причину.' },
    { id: 'no-token', tab: '401 без токена', cls: 4, who: 'client', title: 'Нет токена',
      req: get('/api/cart'),
      res: jres(401, 'Unauthorized', '{"detail":"bearer token required"}'),
      why: 'Корзина личная, а запрос не сказал, кто спрашивает: заголовка <code>Authorization</code> нет. Код 401 значит «представься». Как получить токен, разберём в уроке 2.2.' },
    { id: 'bad-token', tab: '401 чужой токен', cls: 4, who: 'client', title: 'Токен не подошёл',
      req: get('/api/cart', '000000'),
      res: jres(401, 'Unauthorized', '{"detail":"invalid or expired token"}'),
      why: 'Заголовок есть, но такого токена сервер не знает: он выдуман или срок его жизни (час) вышел. Лечится новым входом.' },
    { id: 'login-ok', tab: '200 вход', cls: 2, who: 'ok', title: 'Вход',
      req: post('/api/login', '{"email":"user0001@shop.lab","password":"password"}'),
      res: jres(200, 'OK', '{"token":"9f2c41d7a0b3…","expires_in":3600}'),
      why: 'Логин и пароль верные, сервер выдал токен (временный пропуск) и сказал, что он живёт 3600 секунд. Токен на экране сокращён, настоящий длиной 64 символа.' },
    { id: 'bad-login', tab: '401 пароль', cls: 4, who: 'client', title: 'Неверный пароль',
      req: post('/api/login', '{"email":"user0001@shop.lab","password":"qwerty"}'),
      res: jres(401, 'Unauthorized', '{"detail":"invalid credentials"}'),
      why: 'Пользователь есть, пароль не тот. Сервер намеренно не говорит, что именно неверно: логин или пароль, чтобы не помогать подбирать чужие учётки.' },
    { id: 'register-ok', tab: '201 регистрация', cls: 2, who: 'ok', title: 'Создано',
      req: post('/api/register', '{"email":"student@shop.lab","password":"learnload1"}'),
      res: jres(201, 'Created', '{"id":1001,"email":"student@shop.lab"}'),
      why: 'Код 201 это «создано»: в базе появился новый пользователь с номером 1001. Он отличается от 200 тем, что запрос не просто прочитал, а добавил данные.' },
    { id: 'register-409', tab: '409 занято', cls: 4, who: 'client', title: 'Уже существует',
      req: post('/api/register', '{"email":"user0001@shop.lab","password":"password"}'),
      res: jres(409, 'Conflict', '{"detail":"email already registered"}'),
      why: 'Такой email уже зарегистрирован. Код 409 значит «конфликт с текущим состоянием»: сам запрос корректный, но выполнить его нельзя.' },
    { id: 'cart-add', tab: '201 в корзину', cls: 2, who: 'ok', title: 'Товар в корзине',
      req: post('/api/cart/items', '{"product_id":5,"qty":2}', TOKEN),
      res: jres(201, 'Created', '{"items":[{"product_id":5,"name":"Товар 5","price":285.0,"qty":2}],"total":570.0}'),
      why: 'Токен принят, товар 5 в количестве 2 добавлен, в ответе вся корзина с итогом 570 = 2 × 285.' },
    { id: 'cart-422', tab: '422 количество', cls: 4, who: 'client', title: 'Количество 0',
      req: post('/api/cart/items', '{"product_id":5,"qty":0}', TOKEN),
      res: jres(422, 'Unprocessable Content', '{"detail":[{"type":"greater_than_equal","loc":["body","qty"],"msg":"Input should be greater than or equal to 1","input":0,"ctx":{"ge":1}}]}'),
      why: 'Тело запроса записано правильным JSON, но смысл неверный: количество должно быть не меньше 1. Код 422 значит «понял, что ты написал, но принять не могу».' },
    { id: 'cart-404', tab: '404 товар в корзину', cls: 4, who: 'client', title: 'Товара нет',
      req: post('/api/cart/items', '{"product_id":999999,"qty":1}', TOKEN),
      res: jres(404, 'Not Found', '{"detail":"product not found"}'),
      why: 'Форма запроса верная, но товара с таким номером нет, класть в корзину нечего.' },
    { id: 'empty-order', tab: '400 пустая корзина', cls: 4, who: 'client', title: 'Заказ без товаров',
      req: { line: 'POST /api/orders HTTP/1.1', headers: [HOST, UA, ACC, 'Authorization: Bearer ' + TOKEN], body: '' },
      res: jres(400, 'Bad Request', NOCART),
      why: 'Оформлять нечего: корзина пустая. Код 400 общий «запрос не годится», причина лежит в теле.' },
    { id: 'payment-down', tab: '502 оплата', cls: 5, who: 'server', title: 'Оплата не прошла',
      req: { line: 'POST /api/orders HTTP/1.1', headers: [HOST, UA, ACC, 'Authorization: Bearer ' + TOKEN], body: '' },
      res: jres(502, 'Bad Gateway', '{"detail":"payment failed"}'),
      why: 'Запрос был верный, но «Магазин» не смог получить подтверждение от сервиса оплаты, с которым общается сам. Код 5xx значит «проблема на стороне сервера или его соседей». Клиенту остаётся повторить позже.' },
    { id: 'ready-503', tab: '503 нет Redis', cls: 5, who: 'server', title: 'Сервис не готов',
      req: get('/readyz'),
      res: jres(503, 'Service Unavailable', '{"detail":{"unavailable":["redis"]}}'),
      why: 'Проверка готовности нашла, что недоступен Redis (хранилище корзин и токенов). Код 503 «сервис временно не может отвечать». Балансировщики и оркестраторы по такому коду убирают экземпляр из работы.' },
    { id: 'refused', tab: 'нет ответа', cls: 0, who: 'network', title: 'Сервер выключен',
      req: get('/api/products/42'),
      res: { status: 0, reason: '', headers: [], body: '', text: 'curl: (7) Failed to connect to localhost port 8000 after 0 ms: Couldn\'t connect to server' },
      why: 'Здесь HTTP-ответа нет вообще: по адресу <code>localhost:8000</code> никто не слушает (стенд остановлен). Кода статуса нет, потому что запрос не дошёл до программы-сервера. Это ошибка сети, а не HTTP.' }
  ];
  var SETS = {
    http: ['product-ok', 'redirect', 'not-found', 'bad-path', 'method', 'validation', 'no-token', 'ready-503', 'refused'],
    auth: ['login-ok', 'bad-login', 'no-token', 'bad-token', 'register-ok', 'register-409', 'cart-add', 'cart-422', 'cart-404', 'empty-order'],
    all: SC.map(function (s) { return s.id; })
  };
  var TIPS = {
    host: '<b>Host</b>: к какому сайту обращаемся. На одном IP-адресе может жить несколько сайтов, по этому заголовку сервер выбирает нужный.',
    'user-agent': '<b>User-Agent</b>: кто спрашивает (программа и версия). Браузер пишет тут своё имя, curl своё.',
    accept: '<b>Accept</b>: какие форматы ответа клиент готов принять. <code>*/*</code> значит «любые».',
    authorization: '<b>Authorization</b>: пропуск. Слово <code>Bearer</code> (предъявитель) и токен, который выдал вход.',
    'content-type': '<b>Content-Type</b>: в каком формате тело. <code>application/json</code> значит «текст в формате JSON».',
    'content-length': '<b>Content-Length</b>: сколько байт в теле, чтобы получатель знал, где оно кончается.',
    date: '<b>date</b>: когда сервер сформировал ответ (по Гринвичу).',
    server: '<b>server</b>: какая программа отвечала. Uvicorn это Python-сервер, на котором работает «Магазин».',
    'x-request-id': '<b>x-request-id</b>: номер этого запроса. Он же записан в логах «Магазина», по нему находят следы одного запроса.',
    allow: '<b>allow</b>: какие методы разрешены для этого адреса.',
    location: '<b>location</b>: новый адрес, куда нужно пойти.'
  };

  function chipLine(text, tip, cls) {
    var s = html('span', text, 'wx-l ' + (cls || '')); s.dataset.tip = tip; return s;
  }
  function fillRaw(pre, parts) {
    pre.replaceChildren();
    parts.forEach(function (p) { pre.appendChild(p); });
  }
  function reqParts(r) {
    var m = r.line.split(' ');
    var out = [chipLine(r.line, '<b>Стартовая строка</b>: метод <code>' + esc(m[0]) + '</code> (что сделать), путь <code>' + esc(m[1]) + '</code> (над чем) и версия протокола.', 'wx-start')];
    r.headers.forEach(function (h) { out.push(headLine(h)); });
    out.push(chipLine(' ', '<b>Пустая строка</b> отделяет заголовки от тела.', ''));
    if (r.body) out.push(chipLine(r.body, '<b>Тело запроса</b>: данные, которые клиент отправляет серверу.', 'wx-bd'));
    return out;
  }
  function headLine(h) {
    var name = h.split(':')[0].toLowerCase();
    return chipLine(h, TIPS[name] || '<b>' + esc(h.split(':')[0]) + '</b>: служебная строка.', 'wx-hd');
  }

  L.widgets['web-http-exchange'] = function (host) {
    var key = host.dataset.set || 'http', ids = (host.dataset.scenarios ? L.list(host.dataset.scenarios, '') : SETS[key]);
    if (!ids) throw new Error('data-set: http, auth или all; либо перечисли id в data-scenarios.');
    var list = ids.map(function (id) { return SC.filter(function (s) { return s.id === id; })[0]; }).filter(Boolean);
    if (!list.length) throw new Error('Нет подходящих сценариев.');
    var cur = 0, t = 0, auto = true;
    cur = Math.max(0, list.map(function (s) { return s.id; }).indexOf(host.dataset.start || list[0].id));
    var v = L.setup(host, host.dataset.title || 'Запрос и ответ: что внутри и какой код вернулся');
    var wrap = html('div', undefined, 'wx'); v.stage.appendChild(wrap);
    var chips = html('div', undefined, 'wx-chips'); wrap.appendChild(chips);
    var road = html('div', undefined, 'wx-road'); wrap.appendChild(road);
    var you = html('span', '💻', 'wx-end'), srv = html('span', '🏪', 'wx-end'), note = html('span', '', 'wx-note'), env = html('span', '✉️', 'wx-env');
    road.appendChild(you); road.appendChild(note); road.appendChild(srv); road.appendChild(env);
    var cols = html('div', undefined, 'wx-cols'); wrap.appendChild(cols);
    function card(title) {
      var c = html('div', undefined, 'wx-card'); c.appendChild(html('h4', title)); var pre = html('pre', undefined, 'wx-raw'); c.appendChild(pre); cols.appendChild(c);
      return { c: c, h: c.firstChild, pre: pre };
    }
    var rq = card('Запрос: клиент → сервер'), rs = card('Ответ: сервер → клиент');
    var buttons = list.map(function (s, i) {
      var b = html('button', undefined, 'wx-chip'); b.type = 'button'; b.appendChild(html('i', undefined, 'wx-dot wx-s' + s.cls));
      b.appendChild(document.createTextNode(s.tab)); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { auto = false; choose(i); if (ctl.reduced) paint(99); else setTimeout(function () { if (t === 0) paint(99); }, 150); });
      chips.appendChild(b); return b;
    });
    var shown = -1, lastPhase = -1;
    function choose(i) {
      cur = i; t = 0; lastPhase = -1; shown = -1;
      buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      var s = list[i];
      fillRaw(rq.pre, reqParts(s.req));
      explain(s);
      paint(0);
    }
    function who(s) {
      return { ok: 'Всё прошло успешно.', client: 'Виноват запрос клиента: исправь его, повтор без изменений не поможет.', server: 'Проблема на стороне сервера: клиент ничего не нарушил, повтор позже может помочь.', network: 'Это не ответ сервера: запрос до него не дошёл.' }[s.who];
    }
    function explain(s) {
      var code = s.res.status ? '<b>' + s.res.status + ' ' + esc(s.res.reason) + '</b>. ' : '';
      v.explain('<p>' + code + s.why + '</p><p>' + who(s) + '</p>');
    }
    function paint(time) {
      var s = list[cur], phase = time < 1 ? 0 : time < 1.6 ? 1 : time < 2.6 ? 2 : 3;
      var pos = phase === 0 ? time : phase === 1 ? 1 : phase === 2 ? 1 - (time - 1.6) : 0;
      if (s.who === 'network' && phase >= 1) pos = phase === 1 ? 1 : 1;
      env.style.left = 'calc(44px + (100% - 88px - 1.3rem) * ' + Math.max(0, Math.min(1, pos)).toFixed(3) + ')';
      env.textContent = phase === 2 ? '📦' : '✉️';
      env.style.visibility = phase === 3 || (s.who === 'network' && phase >= 2) ? 'hidden' : 'visible';
      srv.classList.toggle('busy', phase === 1 && s.who !== 'network');
      if (phase === lastPhase) return;
      lastPhase = phase;
      note.textContent = ['запрос в пути', s.who === 'network' ? 'никто не отвечает' : 'сервер обрабатывает', s.who === 'network' ? 'ответа не будет' : 'ответ в пути', s.who === 'network' ? 'ошибка сети' : 'ответ получен'][phase];
      if (phase < 3) {
        fillRaw(rs.pre, [html('span', phase === 0 ? 'ответа ещё нет' : 'ждём ответ…', 'wx-wait')]);
        rs.h.textContent = 'Ответ: сервер → клиент';
        return;
      }
      if (!s.res.status) {
        fillRaw(rs.pre, [chipLine(s.res.text, '<b>Ошибка curl</b>, а не HTTP-ответ: соединение не удалось открыть, поэтому кода статуса нет.', 'wx-start')]);
        rs.h.textContent = 'Ответ: нет';
        return;
      }
      var badge = html('span', String(s.res.status), 'wx-badge wx-s' + s.cls);
      var parts = [];
      var first = chipLine('HTTP/1.1 ' + s.res.status + ' ' + s.res.reason, '<b>Статусная строка</b>: версия протокола, <b>код</b> ' + s.res.status + ' (число для программы) и пояснение для человека. Первая цифра задаёт класс: ' + s.res.status.toString().charAt(0) + 'xx.', 'wx-start');
      first.appendChild(badge); parts.push(first);
      s.res.headers.forEach(function (h) { parts.push(headLine(h)); });
      parts.push(chipLine(' ', '<b>Пустая строка</b> отделяет заголовки от тела.', ''));
      if (s.res.body) parts.push(chipLine(s.res.body, '<b>Тело ответа</b>: в нашем API это JSON. Ошибки лежат в поле <code>detail</code>.', 'wx-bd'));
      fillRaw(rs.pre, parts);
      rs.h.textContent = 'Ответ: сервер → клиент';
    }
    ['pointermove', 'pointerdown'].forEach(function (ev) { wrap.addEventListener(ev, function (e) {
      var el = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el && wrap.contains(el)) v.showTip(el.dataset.tip, e.clientX, e.clientY); else v.hideTip();
    }); });
    wrap.addEventListener('pointerleave', v.hideTip);
    v.tryIt('нажимай сценарии и сравнивай коды: какие запросы «виноваты» сами, а какие нет. Наведи курсор или коснись любой строки запроса или ответа: появится пояснение.');
    var ctl = L.animate(v, function (dt) {
      t += dt; paint(t);
      if (auto && t > 9) choose((cur + 1) % list.length);
    }, function () { paint(99); }, function () { auto = true; choose(0); });
    choose(cur);
    if (ctl.reduced) paint(99);
  };

  /* ---------- Индекс: перебор против поиска по дереву ---------- */
  L.widgets['web-index-search'] = function (host) {
    var N = Math.round(L.num(host.dataset.rows, 200000, 10000, 1000000)), M = Math.round(L.num(host.dataset.matches, 200, 1, 10000));
    var FAN = 300, SCAN = 0.0001, STEP = 0.01, PAGE = 0.005; // мс: строка при переборе, ступенька дерева, страница таблицы
    var v = L.setup(host, host.dataset.title || 'Как индекс сокращает поиск');
    var tt = 0, hoverN = null, geo = {};
    function depth(n) { return Math.max(1, Math.ceil(Math.log(Math.max(n, 2)) / Math.log(FAN))); }
    function scanMs(n) { return n * SCAN; }
    function idxMs(n, m) { return depth(n) * STEP + Math.min(m, n) * PAGE; }
    function f(n) { return (n < 1 ? fmt(n, 2) : n < 100 ? fmt(n, 1) : fmt(n, 0)) + ' мс'; }
    function names(d) { var a = ['корень']; for (var i = 1; i < d - 1; i++) a.push('ветка'); if (d > 1) a.push('лист'); else a[0] = 'лист'; a.push('таблица'); return a; }
    function draw() {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || 640)), narrow = W0 < 520;
      var H = 410, W = v.canvas(H), d = depth(N), steps = d + 1;
      var progress = Math.min(1, tt / 4), nb = Math.max(12, Math.min(50, Math.floor(W / 14))), lit = Math.floor(progress * nb);
      var sNow = Math.round(progress * N), iStep = Math.min(steps, Math.floor(tt / 0.4) + 1);
      v.label(0, 18, 'Без индекса: читаем строки подряд', '', 'start');
      var bw = (W - (nb - 1) * 2) / nb;
      for (var i = 0; i < nb; i++) v.add('rect', { x: i * (bw + 2), y: 28, width: bw, height: 22, rx: 3, class: (i < lit ? 'warning fill' : 'box') });
      v.label(0, 72, 'проверено ' + fmt(sNow, 0) + ' из ' + fmt(N, 0) + ' строк, ' + f(sNow * SCAN), 'muted small', 'start');
      v.label(0, 104, narrow ? 'С индексом: по ступенькам' : 'С индексом: идём по ступенькам, как по оглавлению', '', 'start');
      var nm = names(d), gw = narrow ? 4 : 8, w2 = (W - (steps - 1) * gw) / steps;
      for (var j = 0; j < steps; j++) {
        var on = j < iStep, x = j * (w2 + gw);
        v.add('rect', { x: x, y: 114, width: w2, height: 30, rx: 6, class: on ? 'ok fill' : 'box' });
        v.label(x + w2 / 2, 134, nm[j] + (j === steps - 1 && M > 1 ? ' ×' + fmt(M, 0) : ''), 'small', 'middle');
      }
      v.label(0, 166, (iStep >= steps ? 'готово' : 'шаг ' + iStep) + ': ' + steps + ' ' + L.plural(steps, 'ступенька', 'ступеньки', 'ступенек') + ', ' + f(idxMs(N, M)), iStep >= steps ? 'ok small' : 'muted small', 'start');
      // график: время от размера таблицы
      var top = 220, bottom = 360, left = 56, right = W - 14, maxN = 1000000, sc = L.scale(scanMs(maxN));
      function X(n) { return left + n / maxN * (right - left); }
      function Y(ms) { return bottom - ms / sc.max * (bottom - top); }
      v.label(0, 196, 'Время поиска от размера таблицы', '', 'start');
      sc.ticks.forEach(function (tk) { v.add('line', { x1: left, x2: right, y1: Y(tk), y2: Y(tk), class: 'grid' }); v.label(left - 6, Y(tk) + 5, fmt(tk, 0), 'muted small', 'end'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      [0, 250000, 500000, 750000, 1000000].forEach(function (n, k) { if (!narrow || k % 2 === 0) v.label(X(n), bottom + 20, n === 0 ? '0' : fmt(n / 1000, 0) + ' тыс', 'muted small', k === 0 ? 'start' : k === 4 ? 'end' : 'middle'); });
      v.label(left + 4, top - 8, 'мс', 'muted small', 'start');
      v.label((left + right) / 2, bottom + 42, 'строк в таблице', 'muted small', 'middle');
      var pts1 = [], pts2 = [];
      for (var n = 0; n <= maxN; n += 10000) { pts1.push(X(n) + ',' + Y(scanMs(n))); pts2.push(X(n) + ',' + Y(idxMs(Math.max(n, 1), M))); }
      v.add('polyline', { points: pts1.join(' '), class: 'warning stroke' });
      v.add('polyline', { points: pts2.join(' '), class: 'ok stroke' });
      v.add('line', { x1: X(N), x2: X(N), y1: top, y2: bottom, class: 'muted marker' });
      v.add('circle', { cx: X(N), cy: Y(scanMs(N)), r: 5, class: 'warning fill' });
      v.add('circle', { cx: X(N), cy: Y(idxMs(N, M)), r: 5, class: 'ok fill' });
      if (hoverN !== null) {
        v.add('line', { x1: X(hoverN), x2: X(hoverN), y1: top, y2: bottom, class: 'muted marker' });
        v.add('circle', { cx: X(hoverN), cy: Y(scanMs(hoverN)), r: 4, class: 'warning fill' });
        v.add('circle', { cx: X(hoverN), cy: Y(idxMs(hoverN, M)), r: 4, class: 'ok fill' });
      }
      v.add('rect', { x: left, y: bottom + 52, width: 12, height: 12, rx: 3, class: 'warning fill' });
      v.label(left + 18, bottom + 63, 'перебор', 'small', 'start');
      v.add('rect', { x: left + 100, y: bottom + 52, width: 12, height: 12, rx: 3, class: 'ok fill' });
      v.label(left + 118, bottom + 63, 'индекс', 'small', 'start');
      geo = { left: left, right: right, top: top, bottom: bottom, maxN: maxN };
    }
    function describe() {
      var a = scanMs(N), b = idxMs(N, M), d = depth(N), cls, text;
      if (b < a * 0.7) { cls = 'ok'; text = 'Индекс выигрывает: в ' + fmt(a / b, a / b >= 10 ? 0 : 1) + ' ' + L.plural(a / b, 'раз', 'раза', 'раз') + ' быстрее.'; }
      else if (b <= a * 1.3) { cls = 'warning'; text = 'Почти ничья: индекс уже почти не помогает.'; }
      else { cls = 'danger'; text = 'Индекс проигрывает: он нужен, чтобы найти немногое. Когда подходит заметная доля таблицы, база сама выбирает полный перебор.'; }
      v.explain('<p class="viz-level ' + cls + '"><i></i>' + text + '</p>' +
        'В таблице <b>' + fmt(N, 0) + '</b> строк, нужно достать <b>' + fmt(M, 0) + '</b> (' + fmt(M / N * 100, M / N < 0.01 ? 2 : 1) + '%). Без индекса база проверяет каждую строку: ≈ <b>' + f(a) + '</b>. ' +
        'С индексом она спускается по дереву за <b>' + d + ' ' + L.plural(d, 'ступеньку', 'ступеньки', 'ступенек') + '</b> и читает ' + fmt(M, 0) + ' ' + L.plural(M, 'страницу', 'страницы', 'страниц') + ' таблицы: ≈ <b>' + f(b) + '</b>. ' +
        'Время условное, порядок величин как на обычном ноутбуке.');
    }
    function tick(dt) { tt += dt; if (tt > 7) tt = 0; draw(); }
    function still() { tt = 99; draw(); }
    v.slider('Строк в таблице', 10000, 1000000, 10000, N, function (n) { N = n; describe(); if (ctl.reduced) still(); else draw(); }, '');
    v.slider('Сколько строк подходит', 1, 10000, 1, M, function (n) { M = n; describe(); if (ctl.reduced) still(); else draw(); }, '');
    v.tryIt('потяни первый ползунок до миллиона: перебор растёт вместе с таблицей, индекс почти не меняется. Потом второй до 8 000: когда подходит много строк, индекс теряет преимущество. Наведи на график: покажет значения в любой точке.');
    v.hover(function (e, q) {
      if (q.y < geo.top - 10 || q.y > geo.bottom + 4) { hoverN = null; v.hideTip(); return; }
      var k = Math.max(0, Math.min(1, (q.x - geo.left) / (geo.right - geo.left)));
      hoverN = Math.max(1, Math.round(k * geo.maxN / 10000) * 10000);
      if (ctl.reduced) draw();
      v.showTip('<b>' + fmt(hoverN, 0) + ' строк</b><br><span class="viz-sw" style="color:var(--yellow)"></span>перебор: <b>' + f(scanMs(hoverN)) + '</b><br><span class="viz-sw" style="color:var(--green)"></span>индекс: <b>' + f(idxMs(hoverN, M)) + '</b> (' + depth(hoverN) + ' ' + L.plural(depth(hoverN), 'ступенька', 'ступеньки', 'ступенек') + ' и ' + fmt(Math.min(M, hoverN), 0) + ' стр.)', e.clientX, e.clientY);
    }, function () { hoverN = null; if (ctl.reduced) draw(); });
    var ctl = L.animate(v, tick, still, function () { tt = 0; });
    describe(); draw(); v.onResize(draw);
    if (ctl.reduced) still();
  };
})();
