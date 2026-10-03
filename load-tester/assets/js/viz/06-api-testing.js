/* Виджеты темы 6 «Тестирование и автотесты API»: регистрируются через window.LTViz (см. конец assets/js/viz.js).
   api-test-boundary: классы эквивалентности и граничные значения параметров /api/products.
   api-test-pyramid: пирамида тестов, время прогона и ложные падения (модель, не измерение).
   api-test-report: прогон pytest -v с падением и разбор отчёта по строкам.
   api-test-ci: путь push -> runner -> стенд -> тесты -> статус, с поломкой на выбранном шаге. */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, fmt = L.fmt;

  var style = document.createElement('style');
  style.textContent = [
    '.at-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
    '.viz .at-chip{display:inline-flex;align-items:center;min-height:36px;padding:4px 12px;border-radius:999px;font-size:.84rem}',
    '.viz .at-chip[aria-pressed="true"]{border-color:var(--accent-ink);background:var(--bg-2);font-weight:700}',
    '.at-term{margin:0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);font:12.5px/1.55 var(--mono);min-height:15em}',
    '.at-ln{display:block;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:4px;padding:0 3px;cursor:help}',
    '.at-ln:hover{background:color-mix(in srgb,var(--accent-ink) 16%,transparent)}',
    '.at-pass{color:var(--green)}.at-fail{color:var(--red);font-weight:700}.at-dim{color:var(--muted)}',
    '.at-e{color:var(--red)}.at-gt{color:var(--red);font-weight:700}.at-hd{font-weight:700}',
    '.at-steps{list-style:none;margin:0;padding:0;display:grid;gap:6px}',
    '.at-step{display:flex;align-items:center;gap:10px;min-width:0;padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);cursor:help}',
    '.at-step:hover{border-color:var(--accent-ink)}',
    '.at-ic{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:.8rem;font-weight:700;background:var(--bg-2);color:var(--muted);border:2px solid var(--line)}',
    '.at-step.run .at-ic{border-color:var(--blue);color:var(--blue);animation:at-spin 1s linear infinite}',
    '.at-step.ok .at-ic{background:var(--green);border-color:var(--green);color:var(--bg)}',
    '.at-step.fail .at-ic{background:var(--red);border-color:var(--red);color:var(--bg)}',
    '.at-step.skip{opacity:.55}.at-step.skip .at-name{text-decoration:line-through}',
    '.at-name{flex:1;min-width:0;overflow-wrap:anywhere;font-size:.9rem}',
    '.at-name small{display:block;color:var(--muted);font-size:.78rem}',
    '.at-time{flex:none;font:12px var(--mono);color:var(--muted)}',
    '.at-badge{display:inline-block;margin-top:10px;padding:4px 12px;border-radius:6px;font:700 13px var(--mono);color:var(--bg);background:var(--muted)}',
    '.at-badge.ok{background:var(--green)}.at-badge.fail{background:var(--red)}',
    '@keyframes at-spin{50%{transform:scale(1.15)}}',
    '@media (max-width:520px){.at-term{font-size:11.5px}.at-time{display:none}}'
  ].join('\n');
  document.head.appendChild(style);

  function chips(v, items, current, onPick) {
    var row = html('div', undefined, 'at-chips'), els = [];
    items.forEach(function (it) {
      var b = html('button', it.tab, 'at-chip'); b.type = 'button';
      b.setAttribute('aria-pressed', it.id === current ? 'true' : 'false');
      b.addEventListener('click', function () { onPick(it.id); });
      row.appendChild(b); els.push(b);
    });
    v.stage.insertBefore(row, v.stage.firstChild);
    return function (id) { els.forEach(function (b, i) { b.setAttribute('aria-pressed', items[i].id === id ? 'true' : 'false'); }); };
  }
  function tipOn(v, wrap) {
    wrap.addEventListener('pointermove', function (e) {
      var el = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el && wrap.contains(el)) v.showTip(el.dataset.tip, e.clientX, e.clientY); else v.hideTip();
    });
    wrap.addEventListener('pointerleave', v.hideTip);
  }

  /* ---------- Классы эквивалентности и границы ---------- */
  var PARAMS = {
    size: {
      min: -10, max: 120, tick: 10, name: 'size', def: 20,
      zones: [{ a: -10, b: 0, code: 422, label: 'меньше 1', cls: 'danger' }, { a: 1, b: 100, code: 200, label: 'от 1 до 100', cls: 'ok' }, { a: 101, b: 120, code: 422, label: 'больше 100', cls: 'danger' }],
      bounds: [0, 1, 100, 101], reps: [-5, 20, 110],
      why: function (n) { return n < 1 ? 'меньше 1: приложение требует <code>size</code> не меньше 1 (<code>ge=1</code>)' : n > 100 ? 'больше 100: потолок страницы <code>le=100</code>' : 'допустимое значение'; }
    },
    page: {
      min: -5, max: 30, tick: 5, name: 'page', def: 3,
      zones: [{ a: -5, b: 0, code: 422, label: 'меньше 1', cls: 'danger' }, { a: 1, b: 30, code: 200, label: '1 и больше', cls: 'ok' }],
      bounds: [0, 1], reps: [-3, 7],
      why: function (n) { return n < 1 ? 'меньше 1: страницы считаются с единицы (<code>ge=1</code>)' : 'допустимое значение; верхнего предела у <code>page</code> нет, страница за концом списка вернёт <code>200</code> и пустой <code>items</code>'; }
    }
  };
  function zoneOf(p, n) { for (var i = 0; i < p.zones.length; i++) if (n >= p.zones[i].a && n <= p.zones[i].b) return p.zones[i]; return p.zones[0]; }

  L.widgets['api-test-boundary'] = function (host) {
    var key = host.dataset.param === 'page' ? 'page' : 'size';
    var P = PARAMS[key], val = Math.round(L.num(host.dataset.value, P.def, P.min, P.max)), t = 0, sliderEl, setKey;
    var v = L.setup(host, host.dataset.title || 'Какие значения параметра проверять');
    var geo = {};
    function X(n) { return geo.left + (n - P.min) / (P.max - P.min) * (geo.right - geo.left); }
    function draw() {
      var H = 190, W = v.canvas(H), left = 14, right = W - 14, y0 = 70, hh = 36;
      geo = { left: left, right: right, y0: y0, hh: hh };
      P.zones.forEach(function (z) {
        var x1 = X(z.a - (z.a === P.min ? 0 : 0.5)), x2 = X(z.b + (z.b === P.max ? 0 : 0.5));
        v.add('rect', { x: x1, y: y0, width: Math.max(2, x2 - x1), height: hh, rx: 4, class: z.cls + ' zone' });
        v.add('rect', { x: x1, y: y0 + hh - 4, width: Math.max(2, x2 - x1), height: 4, class: z.cls + ' fill' });
        v.label((x1 + x2) / 2, y0 + 22, z.code === 200 ? '200' : '422', z.cls + ' small', 'middle');
        v.label((x1 + x2) / 2, y0 + hh + 18, z.label, 'muted small', 'middle');
      });
      for (var n = Math.ceil(P.min / P.tick) * P.tick; n <= P.max; n += P.tick) {
        v.add('line', { x1: X(n), x2: X(n), y1: y0 + hh, y2: y0 + hh + 5, class: 'grid' });
        if (n % (P.tick * 2) === 0) v.label(X(n), y0 + hh + 36, String(n), 'muted small', 'middle');
      }
      P.reps.forEach(function (n) { v.add('circle', { cx: X(n), cy: y0 - 12, r: 5, class: 'response fill' }); });
      P.bounds.forEach(function (n) { v.add('rect', { x: X(n) - 5, y: y0 - 18, width: 10, height: 10, transform: 'rotate(45 ' + X(n) + ' ' + (y0 - 13) + ')', class: 'violet fill' }); });
      v.add('circle', { cx: 18, cy: 18, r: 5, class: 'response fill' }); v.label(30, 22, 'по одному из класса', 'small', 'start');
      v.add('rect', { x: Math.min(W - 160, 190), y: 13, width: 10, height: 10, transform: 'rotate(45 ' + (Math.min(W - 160, 190) + 5) + ' 18)', class: 'violet fill' }); v.label(Math.min(W - 160, 190) + 16, 22, 'границы', 'small', 'start');
      var z = zoneOf(P, val), px = X(val);
      v.add('line', { x1: px, x2: px, y1: y0 - 2, y2: y0 + hh + 4, class: z.cls + ' marker' });
      v.add('path', { d: 'M' + (px - 7) + ' ' + (y0 - 30) + 'L' + (px + 7) + ' ' + (y0 - 30) + 'L' + px + ' ' + (y0 - 18) + 'Z', class: z.cls + ' fill' });
      v.label(Math.max(30, Math.min(W - 30, px)), y0 - 36, key + ' = ' + val, z.cls + ' small', 'middle');
      v.label(0, H - 6, 'GET /api/products?' + key + '=' + val + '  →  ' + z.code, 'small', 'start');
    }
    function describe() {
      var z = zoneOf(P, val), edge = P.bounds.indexOf(val) >= 0;
      v.explain('<p class="viz-level ' + z.cls + '"><i></i>' + key + ' = <b>' + val + '</b>: ожидаем <b>' + z.code + '</b></p>' +
        'Класс «' + z.label + '»: ' + P.why(val) + '. ' + (edge ? 'Это <b>граничное</b> значение: ровно здесь ответ меняется, и здесь чаще всего прячутся ошибки «на единицу».' : 'Это значение из середины класса: если ответ верен для него, он, скорее всего, верен для всех соседей.') +
        ' Минимальный набор: по одному значению из каждого класса (' + P.zones.length + ' ' + L.plural(P.zones.length, 'тест', 'теста', 'тестов') + '), с границами ' + (P.bounds.length + P.zones.length) + '.');
    }
    var prog = false;
    function sync() { prog = true; sliderEl.value = val; sliderEl.dispatchEvent(new Event('input')); prog = false; }
    function makeSlider() {
      if (sliderEl) sliderEl.closest('label').remove();
      sliderEl = v.slider('Значение ' + key, P.min, P.max, 1, val, function (n) { if (prog) return; val = n; ctl.pause(); describe(); draw(); }, '');
    }
    makeSlider();
    setKey = chips(v, [{ id: 'size', tab: 'параметр size' }, { id: 'page', tab: 'параметр page' }], key, function (id) {
      key = id; P = PARAMS[id]; val = P.def; t = 0; setKey(id); makeSlider(); ctl.pause(); describe(); draw();
    });
    v.tryIt('двигай ползунок через границы (0 и 1, 100 и 101): цвет и код меняются ровно на границе. Нажми «параметр page»: у него только одна граница. Наведи на шкалу: подсказка покажет ответ для любого значения.');
    v.hover(function (e, q) {
      var k = (q.x - geo.left) / (geo.right - geo.left), n = Math.max(P.min, Math.min(P.max, Math.round(P.min + k * (P.max - P.min))));
      var z = zoneOf(P, n);
      v.showTip('<b>' + key + ' = ' + n + '</b><br><span class="viz-sw" style="color:var(--' + (z.code === 200 ? 'green' : 'red') + ')"></span>ожидаем <b>' + z.code + '</b><br>' + P.why(n), e.clientX, e.clientY);
    });
    function tick(dt) {
      t += dt; var span = P.max - P.min, k = (t / 9) % 2; k = k > 1 ? 2 - k : k;
      val = Math.round(P.min + k * span); sync();
      describe(); draw();
    }
    var ctl = L.animate(v, tick, function () { describe(); draw(); });
    describe(); draw(); v.onResize(draw);
  };

  /* ---------- Пирамида тестов ---------- */
  L.widgets['api-test-pyramid'] = function (host) {
    var n = { unit: Math.round(L.num(host.dataset.unit, 200, 0, 500)), api: Math.round(L.num(host.dataset.api, 60, 0, 200)), ui: Math.round(L.num(host.dataset.ui, 8, 0, 200)) };
    var LV = [
      { k: 'ui', name: 'UI', sec: 15, flaky: 0.01, cls: 'danger', tip: 'Тест открывает браузер и кликает по странице. Видит всё как пользователь, но медленный и капризный: падает от смены вёрстки, от долгой загрузки, от «не успел появиться».' },
      { k: 'api', name: 'API', sec: 0.25, flaky: 0.001, cls: 'primary', tip: 'Тест шлёт HTTP-запрос работающему сервису и сверяет ответ. Проверяет, как части работают вместе (приложение, база, кэш), и не зависит от вёрстки.' },
      { k: 'unit', name: 'Unit', sec: 0.02, flaky: 0.0001, cls: 'ok', tip: 'Тест проверяет одну функцию в коде без сети и базы. Молниеносный и стабильный, но ничего не знает о том, как части стыкуются.' }
    ];
    var v = L.setup(host, host.dataset.title || 'Пирамида тестов: что дёшево, а что дорого');
    var tt = 0, geo = {};
    function stats() {
      var total = 0, ok = 1;
      LV.forEach(function (l) { total += n[l.k] * l.sec; ok *= Math.pow(1 - l.flaky, n[l.k]); });
      return { total: total, falseFail: 1 - ok };
    }
    function draw() {
      var H = 232, W = v.canvas(H), s = stats(), left = 56, right = W - 10, area = right - left, rowH = 46, gap = 8, top = 8;
      var mx = Math.max(1, n.unit, n.api, n.ui), cx = left + area / 2;
      var run = Math.min(1, tt / 6), clock = run * s.total;
      var acc = 0;
      geo = { top: top, rowH: rowH, gap: gap };
      LV.slice().reverse().forEach(function (l) { // unit идёт первым
        var dur = n[l.k] * l.sec; l.done = dur > 0 ? Math.max(0, Math.min(1, (clock - acc) / dur)) : (clock >= acc ? 1 : 0); acc += dur;
      });
      LV.forEach(function (l, i) {
        var y = top + i * (rowH + gap), w = n[l.k] ? Math.max(22, n[l.k] / mx * area) : 0, x = cx - w / 2;
        v.label(0, y + rowH / 2 + 5, l.name, '', 'start');
        v.add('rect', { x: left, y: y, width: area, height: rowH, rx: 6, class: 'band' });
        if (w) {
          v.add('rect', { x: x, y: y, width: w, height: rowH, rx: 6, class: l.cls + ' zone' });
          v.add('rect', { x: x, y: y, width: w * l.done, height: rowH, rx: 6, class: l.cls + ' fill' });
          v.add('rect', { x: x, y: y, width: w, height: rowH, rx: 6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, class: l.cls });
        }
        v.label(cx, y + rowH / 2 + 5, String(n[l.k]), 'halo', 'middle');
      });
      var yb = top + 3 * (rowH + gap) + 12;
      v.label(0, yb, 'Прогон: ' + L.sec(s.total) + '  |  ложное падение: ' + fmt(s.falseFail * 100, s.falseFail < 0.1 ? 1 : 0) + '%', '', 'start');
      v.add('rect', { x: 0, y: yb + 10, width: W, height: 8, rx: 4, class: 'band' });
      v.add('rect', { x: 0, y: yb + 10, width: W * run, height: 8, rx: 4, class: 'primary fill' });
      v.label(0, yb + 36, 'часы: ' + L.sec(clock) + ' из ' + L.sec(s.total) + ' (ускорено)', 'muted small', 'start');
    }
    function describe() {
      var s = stats(), total = n.unit + n.api + n.ui, share = total ? n.ui / total : 0;
      var cls = share > 0.3 ? 'danger' : share > 0.12 ? 'warning' : 'ok';
      var text = share > 0.3 ? 'Перевёрнутая пирамида («рожок мороженого»): большая часть времени и нервов уходит на UI.' : share > 0.12 ? 'UI-тестов многовато для верхушки.' : 'Форма пирамиды: основа дешёвая, верх узкий.';
      var uiTime = n.ui * 15, share2 = s.total ? uiTime / s.total * 100 : 0;
      v.explain('<p class="viz-level ' + cls + '"><i></i>' + text + '</p>' +
        'Всего <b>' + total + '</b> ' + L.plural(total, 'тест', 'теста', 'тестов') + ' (UI ' + fmt(share * 100, 0) + '%). Один прогон займёт <b>' + L.sec(s.total) + '</b>, из них на UI уходит ' + fmt(share2, 0) + '%. Шанс, что хоть один тест упадёт без настоящей поломки, ≈ <b>' + fmt(s.falseFail * 100, s.falseFail < 0.1 ? 1 : 0) + '%</b>: чем больше капризных тестов, тем чаще «красный» набор значит «повтори», а не «чини». Числа условные (unit 0,02 с, API 0,25 с, UI 15 с), порядок как в жизни.');
    }
    function redraw() { describe(); if (ctl.reduced) { tt = 99; } draw(); }
    v.slider('Unit-тестов', 0, 500, 10, n.unit, function (x) { n.unit = x; tt = 0; redraw(); }, '');
    v.slider('API-тестов', 0, 200, 5, n.api, function (x) { n.api = x; tt = 0; redraw(); }, '');
    v.slider('UI-тестов', 0, 200, 1, n.ui, function (x) { n.ui = x; tt = 0; redraw(); }, '');
    function preset(a, b, c) { n.unit = a; n.api = b; n.ui = c; tt = 0; v.host.querySelectorAll('.viz-controls input').forEach(function (inp, i) { inp.value = [a, b, c][i]; inp.dispatchEvent(new Event('input')); }); }
    v.button('Пирамида 200 / 60 / 8', function () { preset(200, 60, 8); });
    v.button('Рожок 20 / 30 / 120', function () { preset(20, 30, 120); });
    v.tryIt('нажми «Рожок»: те же 170 тестов превращаются из двух минут в полчаса, а ложные падения вырастают в разы. Потом верни пирамиду и двигай ползунок UI. Наведи на любой ряд: подсказка расскажет про уровень.');
    v.hover(function (e, q) {
      var i = Math.floor((q.y - geo.top) / (geo.rowH + geo.gap));
      if (i < 0 || i > 2) { v.hideTip(); return; }
      var l = LV[i];
      v.showTip('<b>' + l.name + '</b>: ' + n[l.k] + ' шт.<br>≈ ' + L.sec(l.sec) + ' на тест, всего ' + L.sec(n[l.k] * l.sec) + '<br>ложное падение теста ≈ ' + fmt(l.flaky * 100, 2) + '%<br>' + l.tip, e.clientX, e.clientY);
    });
    var ctl = L.animate(v, function (dt) { tt += dt; if (tt > 9) tt = 0; draw(); }, function () { tt = 99; draw(); }, function () { tt = 0; });
    describe(); draw(); v.onResize(draw);
    if (ctl.reduced) { tt = 99; draw(); }
  };

  /* ---------- Прогон pytest и чтение отчёта ---------- */
  var TESTS = [
    ['test_auth.py', 'test_login_ok'], ['test_auth.py', 'test_login_wrong_password'], ['test_auth.py', 'test_cart_requires_token'],
    ['test_cart.py', 'test_cart_starts_empty'], ['test_cart.py', 'test_add_to_cart'],
    ['test_health.py', 'test_healthz'], ['test_health.py', 'test_readyz'],
    ['test_orders.py', 'test_empty_order_rejected'],
    ['test_products.py', 'test_product_schema'], ['test_products.py', 'test_size_in_range[1]'], ['test_products.py', 'test_size_in_range[100]'],
    ['test_products.py', 'test_size_out_of_range[0]'], ['test_products.py', 'test_size_out_of_range[101]'], ['test_products.py', 'test_product_not_found']
  ];
  var FAILS = {
    ok: null,
    limit: { idx: 12, title: 'test_size_out_of_range[101]', src: ['session = <requests.sessions.Session object at 0x7f3a1c2b5d10>, base_url = \'http://localhost:8000\'', 'size = 101', '', '    @pytest.mark.parametrize("size", [0, 101])', '    def test_size_out_of_range(session, base_url, size):', '        response = session.get(base_url + "/api/products", params={"size": size}, timeout=10)'],
      gt: '>       assert response.status_code == 422', e: ['assert 200 == 422', ' +  where 200 = <Response [200]>.status_code'], loc: 'test_products.py:27: AssertionError', short: 'assert 200 == 422',
      what: 'Приложение теперь отвечает 200 на size=101: проверка потолка страницы пропала (или потолок подняли). Тест нашёл расхождение с договорённостью: больше 100 нельзя.' },
    auth: { idx: 2, title: 'test_cart_requires_token', src: ['session = <requests.sessions.Session object at 0x7f3a1c2b5d10>, base_url = \'http://localhost:8000\'', '', '    def test_cart_requires_token(session, base_url):', '        response = session.get(base_url + "/api/cart", timeout=10)'],
      gt: '>       assert response.status_code == 401', e: ['assert 200 == 401', ' +  where 200 = <Response [200]>.status_code'], loc: 'test_auth.py:31: AssertionError', short: 'assert 200 == 401',
      what: 'Корзина открылась без токена: проверка авторизации сломана. Это не мелочь, а дыра в безопасности, и тест её поймал.' },
    schema: { idx: 8, title: 'test_product_schema', src: ['session = <requests.sessions.Session object at 0x7f3a1c2b5d10>, base_url = \'http://localhost:8000\'', '', '    def test_product_schema(session, base_url):', '        product = session.get(base_url + "/api/products/1", timeout=10).json()'],
      gt: '>       assert set(product) == {"id", "name", "price", "category_id", "stock"}', e: ['AssertionError: assert {\'category_id\', \'id\', \'name\', \'price\', \'quantity\'} == {\'category_id\', \'id\', \'name\', \'price\', \'stock\'}', '  Extra items in the left set:', '  \'quantity\'', '  Extra items in the right set:', '  \'stock\''], loc: 'test_products.py:12: AssertionError', short: 'AssertionError: assert {\'category_id\', \'id\', \'name\', \'price\', \'quantity\'} == ...',
      what: 'Поле stock переименовали в quantity. Любой клиент, который читает stock, теперь сломан: тест схемы заметил это раньше пользователей.' },
    order: { idx: 3, title: 'test_cart_starts_empty', src: ['session = <requests.sessions.Session object at 0x7f3a1c2b5d10>, base_url = \'http://localhost:8000\'', 'headers = {\'Authorization\': \'Bearer 9f2c41d7a0b3…\'}', '', '    def test_cart_starts_empty(session, base_url, headers):', '        response = session.get(base_url + "/api/cart", headers=headers, timeout=10)'],
      gt: '>       assert response.json()["items"] == []', e: ['assert [{\'name\': \'Товар 1\', \'price\': 137.0, \'product_id\': 1, \'qty\': 2}] == []', '  Left contains one more item: {\'name\': \'Товар 1\', \'price\': 137.0, \'product_id\': 1, \'qty\': 2}'], loc: 'test_cart.py:8: AssertionError', short: 'assert [{\'name\': \'Товар 1\', ...}] == []',
      what: 'Приложение не виновато. Тест предположил, что корзина общего пользователя пуста, а в ней остался товар: его положил test_add_to_cart в прошлом прогоне и не убрал. Это зависимость тестов друг от друга: лечится отдельным пользователем на каждый тест.' }
  };
  var RTIPS = {
    pass: '<b>PASSED</b>: проверка выполнена, ни один <code>assert</code> не нашёл расхождения.',
    fail: '<b>FAILED</b>: внутри теста сработал <code>assert</code> (или вылетело исключение). Подробности ниже, в разделе FAILURES.',
    head: '<b>Заголовок отчёта</b>: версия Python и pytest, каталог, число найденных тестов (<code>collected</code>).',
    id: '<b>Путь теста</b>: файл <code>::</code> функция. В квадратных скобках значение параметра из <code>parametrize</code>. Этим путём тест можно запустить отдельно.',
    sect: '<b>Раздел отчёта</b>. Сначала по одной строке на тест, потом подробности по упавшим.',
    src: '<b>Код теста</b>: pytest печатает функцию целиком и показывает значения фикстур и параметров над ней.',
    gt: '<b>Строка с <code>&gt;</code></b>: именно эта строка теста упала. Читай её первой.',
    e: '<b>Строки с <code>E</code></b>: что pytest вычислил. Слева от <code>==</code> то, что вернула программа (<b>фактический</b> результат), справа то, что ждал тест (<b>ожидаемый</b>).',
    loc: '<b>Место падения</b>: файл, номер строки и тип ошибки.',
    sum: '<b>Итог</b>: сколько упало, сколько прошло и за сколько секунд. Код выхода pytest при любом падении не нулевой, поэтому CI покраснеет.',
    short: '<b>Короткая сводка</b>: упавшие тесты по одной строке, удобно скопировать в баг-репорт.'
  };
  L.widgets['api-test-report'] = function (host) {
    var cur = Object.prototype.hasOwnProperty.call(FAILS, host.dataset.fail) ? host.dataset.fail : 'limit', lines = [], shown = 0, t = 0, auto = true;
    var v = L.setup(host, host.dataset.title || 'Прогон pytest: читаем отчёт о падении');
    var pre = html('pre', undefined, 'at-term'); pre.setAttribute('aria-label', 'Вывод pytest'); v.stage.appendChild(pre);
    var setChip = chips(v, [{ id: 'ok', tab: 'всё зелёное' }, { id: 'limit', tab: 'лимит size' }, { id: 'auth', tab: 'нет авторизации' }, { id: 'schema', tab: 'поле переименовано' }, { id: 'order', tab: 'тесты зависят' }], cur, function (id) { choose(id); });
    function build() {
      var f = FAILS[cur]; lines = [];
      function add(text, cls, tip) { lines.push({ text: text, cls: cls || '', tip: tip }); }
      add('============================ test session starts ============================', 'at-dim', RTIPS.head);
      add('platform linux -- Python 3.12.3, pytest-9.1.1, pluggy-1.6.0', 'at-dim', RTIPS.head);
      add('rootdir: /home/student/perf-lab/06-api-tests', 'at-dim', RTIPS.head);
      add('collected ' + TESTS.length + ' items', 'at-hd', RTIPS.head);
      add('', '', '');
      TESTS.forEach(function (tc, i) {
        var bad = f && f.idx === i, pct = Math.round((i + 1) / TESTS.length * 100), padPct = ('   ' + pct + '%').slice(-4);
        var id = tc[0] + '::' + tc[1];
        lines.push({ text: id + ' ' + (bad ? 'FAILED' : 'PASSED') + '  [' + padPct + ']', cls: bad ? 'at-fail' : 'at-pass', tip: (bad ? RTIPS.fail : RTIPS.pass) + '<br>' + RTIPS.id, test: i });
      });
      if (f) {
        add('', '', '');
        add('================================= FAILURES =================================', 'at-hd', RTIPS.sect);
        add('_' + new Array(Math.max(2, Math.floor((72 - f.title.length) / 2))).join('_') + ' ' + f.title + ' ' + new Array(Math.max(2, Math.ceil((72 - f.title.length) / 2))).join('_'), 'at-hd', RTIPS.sect);
        add('', '', '');
        f.src.forEach(function (s) { add(s, '', RTIPS.src); });
        add(f.gt, 'at-gt', RTIPS.gt);
        f.e.forEach(function (s) { add('E       ' + s, 'at-e', RTIPS.e); });
        add('', '', '');
        add(f.loc, 'at-hd', RTIPS.loc);
        add('========================= short test summary info =========================', 'at-hd', RTIPS.short);
        add('FAILED ' + TESTS[f.idx][0] + '::' + f.title + ' - ' + f.short, 'at-fail', RTIPS.short);
        add('====================== 1 failed, ' + (TESTS.length - 1) + ' passed in 2.84s ======================', 'at-fail', RTIPS.sum);
      } else {
        add('', '', '');
        add('============================ ' + TESTS.length + ' passed in 2.71s ============================', 'at-pass', RTIPS.sum);
      }
    }
    function paint() {
      pre.replaceChildren();
      lines.slice(0, shown).forEach(function (l) {
        var d = html('span', l.text || ' ', 'at-ln ' + l.cls); if (l.tip) d.dataset.tip = l.tip; pre.appendChild(d);
      });
      var f = FAILS[cur];
      var ran = Math.min(TESTS.length, Math.max(0, shown - 5));
      v.status.textContent = '$ pytest -v   (' + ran + ' из ' + TESTS.length + ' тестов выполнено)';
      if (f) v.explain('<p class="viz-level danger"><i></i>Упал <code>' + esc(f.title) + '</code>, остальные ' + (TESTS.length - 1) + ' прошли</p>Читай сверху вниз: строка с <code>&gt;</code> показывает, какая проверка не сработала; строки <code>E</code> показывают, что получилось на самом деле. ' + f.what);
      else v.explain('<p class="viz-level ok"><i></i>Все ' + TESTS.length + ' ' + L.plural(TESTS.length, 'тест', 'теста', 'тестов') + ' прошли</p>Зелёный набор значит: всё, что мы описали тестами, работает. Он ничего не говорит о том, что мы забыли описать.');
    }
    function choose(id) { cur = id; auto = true; t = 0; shown = 0; setChip(id); build(); if (ctl && ctl.reduced) shown = lines.length; paint(); if (ctl) ctl.play(); }
    tipOn(v, pre);
    v.tryIt('переключай сценарии и каждый раз читай отчёт: на какой строке тест упал, что вернула программа и что ждал тест. Наведи на любую строку отчёта: появится пояснение.');
    var ctl = L.animate(v, function (dt) {
      t += dt; var want = Math.min(lines.length, Math.floor(t / 0.16));
      if (want !== shown) { shown = want; paint(); }
      return shown >= lines.length ? false : undefined;
    }, function () { shown = lines.length; paint(); }, function () { t = 0; shown = 0; });
    build(); shown = ctl.reduced ? lines.length : 0; paint();
  };

  /* ---------- Путь в CI ---------- */
  var STEPS = [
    { n: 'git push в perf-lab', s: 'событие <code>on: push</code>', t: 1, tip: 'Всё начинается с твоего <code>git push</code>. GitHub видит новый коммит и ищет в <code>.github/workflows/</code> файлы, которые просят запуск на <code>push</code>.' },
    { n: 'Runner: чистая виртуалка', s: 'runs-on: ubuntu-latest', t: 6, tip: 'GitHub выдаёт на время запуска пустую виртуальную машину с Ubuntu и Docker. Ничего твоего на ней нет, поэтому всё нужное придётся поставить в шагах.' },
    { n: 'Забрать код тестов', s: 'actions/checkout', t: 3, tip: 'Шаг <code>uses: actions/checkout@v5</code> клонирует твой репозиторий perf-lab на runner.' },
    { n: 'Забрать код стенда', s: 'checkout load-tester в stand/', t: 4, tip: 'Стенд «Магазин» живёт в репозитории курса. Второй <code>checkout</code> с параметрами <code>repository</code> и <code>path</code> кладёт его рядом.' },
    { n: 'Python и зависимости', s: 'setup-python, pip install', t: 22, tip: 'Ставим Python и <code>pip install -r requirements.txt</code>: тот же файл, что и на твоём ноутбуке.' },
    { n: 'Поднять стенд', s: 'docker compose up -d --build --wait', t: 150, tip: 'Сборка образов и запуск «Магазина», PostgreSQL, Redis и оплаты. Флаг <code>--wait</code> ждёт, пока все проверки здоровья станут зелёными: без него тесты побегут в ещё не готовый сервис.' },
    { n: 'Запустить pytest', s: 'pytest -v --junitxml=junit.xml', t: 25, tip: 'Те же тесты, что ты запускал руками, против стенда на этом же runner. Любое падение даёт ненулевой код выхода, и шаг краснеет.' },
    { n: 'Сохранить junit.xml', s: 'if: always()', t: 3, always: true, tip: 'Шаг <code>actions/upload-artifact</code> с <code>if: always()</code> выполняется даже после падения: отчёт нужен именно тогда, когда что-то сломалось.' },
    { n: 'Логи стенда', s: 'if: failure()', t: 2, onFail: true, tip: 'Шаг с <code>if: failure()</code> печатает <code>docker compose logs</code> только когда что-то упало: так видно, что говорило приложение.' },
    { n: 'Погасить стенд', s: 'if: always()', t: 6, always: true, tip: '<code>docker compose down -v</code> с <code>if: always()</code> убирает за собой. Виртуалка всё равно удалится, но привычка аккуратности не мешает.' }
  ];
  var CI = {
    ok: { tab: 'всё хорошо', fail: -1 },
    stand: { tab: 'стенд не поднялся', fail: 5, why: 'Шаг <b>Поднять стенд</b> вернул ошибку (например, сборка образа не прошла), тесты даже не запускались. Логи стенда помогают понять причину, а артефакта-отчёта pytest нет: тесты не стартовали.' },
    test: { tab: 'тест упал', fail: 6, why: 'Стенд поднялся, <b>pytest</b> нашёл расхождение и вернул код 1. Заметь: junit.xml всё равно сохранён, а стенд погашен благодаря <code>if: always()</code>. Открой артефакт и лог шага: они покажут строку <code>E</code>.' },
    yaml: { tab: 'опечатка в YAML', fail: -2, why: 'Файл workflow не разобрался (например, сдвиг отступа), поэтому ни один шаг не начался: runner даже не выдан. GitHub показывает «Invalid workflow file» с номером строки. Проверь отступы: YAML чувствителен к пробелам.' }
  };
  L.widgets['api-test-ci'] = function (host) {
    var cur = Object.prototype.hasOwnProperty.call(CI, host.dataset.fail) ? host.dataset.fail : 'test', idx = 0, t = 0, st = [], els = [];
    var v = L.setup(host, host.dataset.title || 'Что происходит после git push');
    var ol = html('ol', undefined, 'at-steps'); v.stage.appendChild(ol);
    var res = html('div'); v.stage.appendChild(res);
    var setChip = chips(v, ['ok', 'stand', 'test', 'yaml'].map(function (k) { return { id: k, tab: CI[k].tab }; }), cur, function (id) { choose(id); });
    STEPS.forEach(function (s) {
      var li = html('li', undefined, 'at-step'), ic = html('span', '', 'at-ic'), nm = html('span', undefined, 'at-name'), tm = html('span', '', 'at-time');
      nm.innerHTML = esc(s.n) + '<small>' + s.s + '</small>'; li.dataset.tip = s.tip;
      li.appendChild(ic); li.appendChild(nm); li.appendChild(tm); ol.appendChild(li); els.push({ li: li, ic: ic, tm: tm });
    });
    tipOn(v, ol);
    function plan() {
      var f = CI[cur].fail; st = [];
      STEPS.forEach(function (s, i) {
        var failed = f >= 0 && i > f;
        if (f === -2) st.push(i === 0 ? 'ok' : 'skip');
        else if (i === f) st.push('fail');
        else if (failed && !s.always && !s.onFail) st.push('skip');
        else if (s.onFail && f < 0) st.push('skip');
        else st.push('ok');
      });
    }
    function paint() {
      var total = 0;
      els.forEach(function (e, i) {
        var s = i < idx ? st[i] : i === idx && idx < STEPS.length ? (st[i] === 'skip' ? 'skip' : 'run') : 'pend';
        e.li.className = 'at-step ' + (s === 'pend' ? '' : s);
        e.ic.textContent = s === 'ok' ? '✓' : s === 'fail' ? '✗' : s === 'skip' ? '–' : s === 'run' ? '…' : String(i + 1);
        e.tm.textContent = (i < idx && st[i] !== 'skip') ? STEPS[i].t + ' с' : '';
        if (i < idx && st[i] !== 'skip') total += STEPS[i].t;
      });
      var done = idx >= STEPS.length, bad = CI[cur].fail !== -1;
      res.replaceChildren();
      if (done) {
        var b = html('span', bad ? 'api-tests | failing' : 'api-tests | passing', 'at-badge ' + (bad ? 'fail' : 'ok')); res.appendChild(b);
        res.appendChild(html('span', '  итого ≈ ' + L.sec(total), 'at-time'));
      }
      v.status.textContent = done ? (bad ? 'Запуск завершился ошибкой' : 'Запуск успешен') : 'Идёт запуск: шаг ' + (idx + 1) + ' из ' + STEPS.length;
      var why = CI[cur].why;
      v.explain(done ? (bad ? '<p class="viz-level danger"><i></i>Красный запуск</p>' + why : '<p class="viz-level ok"><i></i>Зелёный запуск за ≈ ' + L.sec(total) + '</p>Каждый шаг прошёл, тесты зелёные, на странице репозитория рядом с коммитом зелёная галочка, а бейдж в README показывает <code>passing</code>. Больше всего времени съела сборка стенда: тесты стоят секунды.') :
        'Шаги идут по очереди на чужой чистой машине. Ждём результат: каждый шаг получит ✓, ✗ (упал) или – (пропущен, потому что раньше что-то упало).');
    }
    function choose(id) { cur = id; setChip(id); t = 0; idx = 0; plan(); if (CI[id].fail === -2) { /* ничего не стартует */ } if (ctl.reduced) idx = STEPS.length; paint(); ctl.play(); }
    v.tryIt('выбирай поломку и смотри, какие шаги пропускаются, а какие всё равно выполняются из-за <code>if: always()</code>. Наведи на шаг: появится кусок workflow. Сравни «стенд не поднялся» и «тест упал»: где есть отчёт junit.xml?');
    var ctl = L.animate(v, function (dt) {
      t += dt;
      var want = CI[cur].fail === -2 ? Math.min(STEPS.length, t > 0.8 ? STEPS.length : 0) : Math.min(STEPS.length, Math.floor(t / 0.75));
      if (want !== idx) { idx = want; paint(); }
      return idx >= STEPS.length ? false : undefined;
    }, function () { idx = STEPS.length; paint(); }, function () { t = 0; idx = 0; });
    plan(); idx = ctl.reduced ? STEPS.length : 0; paint();
  };
})();
