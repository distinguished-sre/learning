/* Виджеты темы 11 «Поиск узких мест»: регистрируются через window.LTViz.
   Имена с префиксом bn-. Модели упрощены для объяснения, это не измерения учебного стенда.

   bn-diagnose: дерево диагностики, по которому проходишь кликами, читая «показания дашборда».
     data-case   номер случая 1-6 (по умолчанию 1)
   bn-bcrypt-cost: сколько стоит один вход при разном числе раундов bcrypt и что это даёт пределу.
     data-rounds  раундов bcrypt, 4-14 (по умолчанию 12)
     data-cpus    ядер у контейнера, 1-4 (по умолчанию 1)
   bn-limits: загрузка трёх ресурсов «Магазина» при росте нагрузки; чинишь один, предел переезжает.
     data-index   1 - индекс на orders.user_id создан (по умолчанию 0)
     data-fixed   1 - N+1 исправлен (по умолчанию 0)
     data-pool    DB_POOL_MAX, 1-30 (по умолчанию 5)
     data-load    итераций сценария в секунду, 5-150 (по умолчанию 30)
   bn-leak: память при утечке против нормального «пилообразного» графика.
     data-rps     запросов в секунду, 1-200 (по умолчанию 40)
     data-kb      утечка на запрос, КБ, 0-50 (по умолчанию 10)
     data-limit   лимит памяти контейнера, МБ, 256-1024 (по умолчанию 512)
     data-base    память после старта, МБ, 60-200 (по умолчанию 118)
   bn-retry-storm: повторы без пауз и сбой зависимости, у которой есть предел.
     data-rate      заказов в секунду, 4-20 (по умолчанию 12)
     data-capacity  сколько попыток в секунду выдерживает оплата, 15-60 (по умолчанию 30)
     data-retries   повторов после первой попытки, 0-5 (по умолчанию 3)
     data-timeout   таймаут одной попытки, с, 0.5-5 (по умолчанию 1)
     data-blip      длительность сбоя оплаты, с, 5-40 (по умолчанию 10) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt;

  var css = [
    '.bn-cases{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
    '.bn-cases button{min-height:34px;padding:4px 10px}',
    '.viz .bn-cases button[aria-pressed="true"],.viz .bn-modes button[aria-pressed="true"],.viz .bn-ans button.bn-picked{border-color:var(--accent-ink);box-shadow:inset 0 0 0 1px var(--accent-ink)}',
    '.bn-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(124px,1fr));gap:8px;margin:0 0 12px}',
    '.bn-tile{background:var(--bg-2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;min-width:0}',
    '.bn-tile span{display:block;font-size:.78rem;color:var(--muted);line-height:1.25}',
    '.bn-tile b{display:block;font-size:1.1rem;margin-top:2px}',
    '.bn-bar{height:5px;border-radius:3px;background:var(--line);margin-top:6px;overflow:hidden}',
    '.bn-bar i{display:block;height:100%;background:var(--green)}',
    '.bn-tile.warn .bn-bar i{background:var(--yellow)}.bn-tile.bad .bn-bar i{background:var(--red)}',
    '.bn-tile.bad{border-color:var(--red)}',
    '.bn-card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--bg)}',
    '.bn-card .bn-q{margin:0 0 4px;font-weight:600}',
    '.bn-card .bn-hint{margin:0 0 10px;font-size:.85rem;color:var(--muted)}',
    '.bn-ans{display:flex;flex-wrap:wrap;gap:8px}',
    '.bn-msg{margin:10px 0 0;font-size:.9rem}',
    '.bn-msg.no{color:var(--red)}.bn-msg.yes{color:var(--green)}',
    '.bn-leaf{border-color:var(--green)}',
    '.bn-leaf .bn-q{color:var(--green)}',
    '.bn-trail{margin:10px 0 0;padding:0;list-style:none;font-size:.88rem;display:grid;gap:4px}',
    '.bn-trail li{display:flex;gap:8px;align-items:baseline}',
    '.bn-trail em{font-style:normal;font-weight:600;white-space:nowrap}',
    '.bn-lg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;font-size:.85rem;color:var(--muted)}',
    '.bn-lg span{display:inline-flex;align-items:center;gap:6px}',
    '.bn-lg i{display:inline-block;width:14px;height:4px;border-radius:2px;background:currentColor}',
    '.bn-lg .a{color:var(--red)}.bn-lg .b{color:var(--blue)}.bn-lg .c{color:var(--violet)}.bn-lg .d{color:var(--green)}.bn-lg .e{color:var(--yellow)}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('bn-viz-style')) return;
    var s = document.createElement('style'); s.id = 'bn-viz-style'; s.textContent = css; document.head.appendChild(s);
  }
  function legend(items) {
    var d = html('div', undefined, 'bn-lg');
    items.forEach(function (it) { var s = html('span', undefined, it[0]); s.appendChild(html('i')); s.appendChild(document.createTextNode(it[1])); d.appendChild(s); });
    return d;
  }
  function pressed(btn, on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  /* ---------- bn-diagnose ---------- */
  var READS = [
    { key: 'cpu', label: 'CPU контейнера shop, % лимита', warn: 60, bad: 85, unit: '%' },
    { key: 'pool', label: 'Ждут соединения БД, шт.', warn: 1, bad: 3, unit: '' },
    { key: 'pg', label: 'CPU PostgreSQL, % лимита', warn: 60, bad: 85, unit: '%' },
    { key: 'mem', label: 'Память shop, % лимита', warn: 60, bad: 85, unit: '%' },
    { key: 'pay', label: 'Оплата p95, с', warn: 0.3, bad: 0.8, unit: ' с', max: 3 },
    { key: 'gen', label: 'CPU генератора нагрузки, %', warn: 60, bad: 85, unit: '%' }
  ];
  var CASES = [
    { name: 'Входы тормозят', r: { cpu: 99, pool: 0, pg: 9, mem: 34, rising: false, pay: 0.05, gen: 18 }, leaf: 'cpu' },
    { name: 'Заказы тормозят', r: { cpu: 38, pool: 3, pg: 100, mem: 30, rising: false, pay: 0.05, gen: 22 }, leaf: 'db' },
    { name: 'Всё ждёт пул', r: { cpu: 31, pool: 9, pg: 24, mem: 31, rising: false, pay: 0.06, gen: 20 }, leaf: 'pool' },
    { name: 'Память растёт', r: { cpu: 22, pool: 0, pg: 11, mem: 91, rising: true, pay: 0.05, gen: 25 }, leaf: 'leak' },
    { name: 'Оплата медленная', r: { cpu: 27, pool: 5, pg: 12, mem: 33, rising: false, pay: 2.1, gen: 19 }, leaf: 'dep' },
    { name: 'Все ресурсы свободны', r: { cpu: 31, pool: 0, pg: 14, mem: 32, rising: false, pay: 0.05, gen: 97 }, leaf: 'gen' }
  ];
  var TREE = {
    q1: { q: 'Процессор контейнера shop упёрся в лимит?', hint: 'USE, использование: панель CPU shop, доля от лимита в 1 ядро.', key: 'cpu', rule: 'от 85% считаем «упёрся»', test: function (r) { return r.cpu >= 85; }, yes: 'cpu', no: 'q2' },
    q2: { q: 'Запросы ждут соединение с базой?', hint: 'USE, насыщение: shop_db_pool_waiting больше нуля.', key: 'pool', rule: 'любое значение выше нуля считаем «ждут»', test: function (r) { return r.pool > 0; }, yes: 'q3', no: 'q5' },
    q3: { q: 'Процессор PostgreSQL упёрся в лимит?', hint: 'USE, использование: CPU контейнера postgres.', key: 'pg', rule: 'от 85% считаем «упёрся»', test: function (r) { return r.pg >= 85; }, yes: 'db', no: 'q4' },
    q4: { q: 'Оплата медленная, пока занято соединение?', hint: 'Время попытки оплаты: shop_payment_duration_seconds.', key: 'pay', rule: 'от 0,8 с считаем «медленная»', test: function (r) { return r.pay >= 0.8; }, yes: 'dep', no: 'pool' },
    q5: { q: 'Память shop растёт без остановки?', hint: 'Память контейнера: наклон графика за десятки минут.', key: 'mem', rule: 'стрелка вверх на плитке значит «растёт»', test: function (r) { return r.rising; }, yes: 'leak', no: 'q6' },
    q6: { q: 'Оплата медленная или с ошибками?', hint: 'Время и результат попыток оплаты.', key: 'pay', rule: 'от 0,8 с считаем «медленная»', test: function (r) { return r.pay >= 0.8; }, yes: 'dep', no: 'q7' },
    q7: { q: 'Генератор нагрузки упёрся в процессор?', hint: 'Сервер скучает, а ответы всё равно медленные: проверь саму машину с генератором.', key: 'gen', rule: 'от 85% считаем «упёрся»', test: function (r) { return r.gen >= 85; }, yes: 'gen', no: 'none' }
  };
  var LEAVES = {
    cpu: { t: 'Узкое место: процессор приложения', d: 'Профилировщик py-spy покажет, какая функция съедает ядро. Дальше: тяжёлая функция, число воркеров, лимит CPU. Урок 11.2.' },
    db: { t: 'Узкое место: запросы к базе', d: 'pg_stat_statements покажет самый дорогой запрос, EXPLAIN ANALYZE докажет полный перебор таблицы. Урок 11.3.' },
    pool: { t: 'Узкое место: пул соединений мал', d: 'База свободна, оплата быстрая, а запросы стоят в очереди за соединением. Считай размер пула по закону Литтла. Урок 11.3.' },
    leak: { t: 'Подозрение: утечка памяти', d: 'Нужен длинный тест (soak) и график памяти. Урок 11.4.' },
    dep: { t: 'Узкое место: медленная зависимость', d: 'Медленная оплата держит соединения, а повторы без пауз множат нагрузку. Урок 11.5.' },
    gen: { t: 'Узкое место: сам генератор', d: 'Цифры теста недостоверны: сервер не нагружен. Вынеси генератор на другую машину или уменьши его работу. Урок 9.5.' },
    none: { t: 'Ресурсы в порядке, причина не найдена', d: 'Ищи не в ресурсах: логи 5xx и таймаутов, блокировки в базе, сеть между сервисами. Гипотеза «ресурс» отвергнута, это тоже результат.' }
  };

  L.widgets['bn-diagnose'] = function (host) {
    injectStyle();
    var caseNo = Math.round(num(host.dataset.case, 1, 1, CASES.length)) - 1;
    var v = L.setup(host, host.dataset.title || 'Дерево диагностики: пройди кликами');
    var cur, path, node, acc, msg;
    var casesBox = html('div', undefined, 'bn-cases'), tiles = html('div', undefined, 'bn-tiles'), card = html('div', undefined, 'bn-card'), trail = html('ol', undefined, 'bn-trail');
    v.stage.appendChild(casesBox); v.stage.appendChild(tiles); v.stage.appendChild(card); v.stage.appendChild(trail);
    var caseBtns = CASES.map(function (c, i) {
      var b = html('button', (i + 1) + '. ' + c.name); b.type = 'button';
      b.addEventListener('click', function () { anim.pause(); pick(i); });
      casesBox.appendChild(b); return b;
    });
    function pick(i) { cur = i; path = []; node = 'q1'; acc = 0; msg = null; render(); }
    function tileState(def, r) {
      var val = r[def.key], cls = val >= def.bad ? 'bad' : val >= def.warn ? 'warn' : '';
      return { cls: cls, text: def.key === 'pay' ? fmt(val, 2) + def.unit : fmt(val, 0) + def.unit, ratio: Math.min(1, val / (def.max || 100)) };
    }
    function answer(yes, auto) {
      if (!TREE[node]) return;
      var n = TREE[node], correct = n.test(CASES[cur].r);
      if (yes !== correct) {
        var r = CASES[cur].r, def = READS.filter(function (d) { return d.key === n.key; })[0];
        msg = { no: true, text: 'Не сходится с показаниями: на плитке «' + def.label + '» ' + (n.key === 'mem' ? (r.rising ? 'стрелка вверх' : 'стрелка вправо, память ровная') : tileState(def, r).text) + ' (' + n.rule + '). Верный ответ: ' + (correct ? 'да' : 'нет') + '.' };
        render(); return;
      }
      path.push({ q: n.q, yes: yes }); node = yes ? n.yes : n.no; msg = null; render();
    }
    function render() {
      caseBtns.forEach(function (b, i) { pressed(b, i === cur); });
      var r = CASES[cur].r;
      tiles.replaceChildren();
      READS.forEach(function (def) {
        var st = tileState(def, r), t = html('div', undefined, 'bn-tile ' + st.cls), a = html('span', def.label), b = html('b', st.text + (def.key === 'mem' ? (r.rising ? ' ↗' : ' →') : ''));
        t.appendChild(a); t.appendChild(b);
        var bar = html('div', undefined, 'bn-bar'), fill = html('i'); fill.style.width = Math.round(st.ratio * 100) + '%'; bar.appendChild(fill); t.appendChild(bar); tiles.appendChild(t);
      });
      card.replaceChildren(); card.className = 'bn-card';
      if (TREE[node]) {
        var n = TREE[node];
        card.appendChild(html('p', n.q, 'bn-q')); card.appendChild(html('p', n.hint, 'bn-hint'));
        var ans = html('div', undefined, 'bn-ans');
        [['Да', true], ['Нет', false]].forEach(function (a) {
          var b = html('button', a[0]); b.type = 'button'; b.addEventListener('click', function () { anim.pause(); answer(a[1]); var f = card.querySelector('.bn-ans button'); if (f) f.focus(); }); ans.appendChild(b);
        });
        card.appendChild(ans);
        if (msg) card.appendChild(html('p', msg.text, 'bn-msg ' + (msg.no ? 'no' : 'yes')));
      } else {
        var lf = LEAVES[node]; card.className = 'bn-card bn-leaf';
        card.appendChild(html('p', lf.t, 'bn-q')); card.appendChild(html('p', lf.d));
        if (node !== CASES[cur].leaf) card.appendChild(html('p', 'Для этого случая ждали другой вывод: пройди дерево заново.', 'bn-msg no'));
      }
      trail.replaceChildren();
      path.forEach(function (p) { var li = html('li'); li.appendChild(html('em', p.yes ? '✓ Да' : '✓ Нет')); li.appendChild(html('span', p.q)); trail.appendChild(li); });
      var steps = path.length;
      v.explain('Случай «' + esc(CASES[cur].name) + '»: плитки сверху это показания дашборда во время нагрузки. Ты ответил на ' + steps + ' ' + L.plural(steps, 'вопрос', 'вопроса', 'вопросов') + (TREE[node] ? '. Следующий вопрос: «' + esc(TREE[node].q) + '» Ответь по плиткам.' : ', вывод: <b>' + esc(LEAVES[node].t) + '</b>. Заметь, что ты не гадал: каждый ответ опирался на показание.'));
    }
    function tick(dt) {
      acc += dt;
      if (acc < 1.4) return;
      acc = 0;
      if (!TREE[node]) return false;
      var n = TREE[node], correct = n.test(CASES[cur].r);
      path.push({ q: n.q, yes: correct }); node = correct ? n.yes : n.no; msg = null; render();
      if (!TREE[node]) return false;
    }
    function still() { pick(cur); while (TREE[node]) { var n = TREE[node], c = n.test(CASES[cur].r); path.push({ q: n.q, yes: c }); node = c ? n.yes : n.no; } render(); }
    cur = caseNo;
    var anim = L.animate(v, tick, still, function () { pick(cur); });
    if (!anim.reduced) pick(caseNo);
    v.tryIt('нажми «Да» или «Нет» сам. Если ответ не сходится с плитками, дерево подскажет, на какую смотреть. Потом выбери другой случай: путь по дереву будет другим.');
  };

  /* ---------- bn-bcrypt-cost ---------- */
  L.widgets['bn-bcrypt-cost'] = function (host) {
    injectStyle();
    var rounds = Math.round(num(host.dataset.rounds, 12, 4, 14)), cpus = Math.round(num(host.dataset.cpus, 1, 1, 4));
    var v = L.setup(host, host.dataset.title || 'Цена одного входа: раунды bcrypt');
    var R0 = 4, R1 = 14, show = R1 - R0 + 1, sel = null, geo = {};
    function cost(r) { return 0.25 * Math.pow(2, r - 12); } // секунд процессорного времени на один хеш
    function perSec(r) { return cpus / (cost(r) + 0.003); }
    function msTxt(r) { var m = cost(r) * 1000; return m >= 100 ? fmt(m, 0) + ' мс' : m >= 10 ? fmt(m, 1) + ' мс' : fmt(m, 2) + ' мс'; }
    function guesses(r) { return fmt(Math.round(1 / cost(r)), 0); }
    function draw(grow) {
      var H = 300, W = v.canvas(H), left = 52, right = W - 14, top = 26, bottom = H - 50;
      var lo = Math.log10(0.5), hi = Math.log10(5000);
      function Y(ms) { return bottom - (Math.log10(Math.max(ms, 0.5)) - lo) / (hi - lo) * (bottom - top); }
      function X(i) { return left + (i + 0.5) * (right - left) / show; }
      geo = { X: X, left: left, right: right };
      [1, 10, 100, 1000].forEach(function (g) { v.add('line', { x1: left, x2: right, y1: Y(g), y2: Y(g), class: 'grid' }); v.label(left - 6, Y(g) + 5, fmt(g, 0), 'muted small', 'end'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.label(left + 4, top - 10, 'время на один хеш, мс (шкала ×10)', 'muted small', 'start');
      v.label((left + right) / 2, H - 6, 'раундов bcrypt (BCRYPT_ROUNDS)', 'muted small');
      var w = (right - left) / show * 0.7;
      for (var r = R0; r <= R1; r++) {
        var i = r - R0, ms = cost(r) * 1000, k = grow == null ? 1 : Math.max(0, Math.min(1, grow - i * 0.35)), y = bottom - (bottom - Y(ms)) * k;
        var cls = (r === rounds ? 'danger' : 'response') + ' fill' + (sel !== null && sel !== i ? ' dim' : '');
        if (k > 0) v.add('rect', { x: X(i) - w / 2, y: y, width: w, height: Math.max(1, bottom - y), rx: 3, class: cls });
        v.label(X(i), bottom + 18, String(r), r === rounds ? 'small' : 'muted small');
        if (r === rounds && k >= 1) v.label(X(i), Y(ms) - 8, msTxt(r), 'small halo');
      }
      if (sel !== null) v.add('rect', { x: X(sel) - (right - left) / show / 2, y: top, width: (right - left) / show, height: bottom - top, class: 'band' });
    }
    function explainNow() {
      var c = cost(rounds), cap = perSec(rounds);
      v.explain('<b>' + rounds + ' ' + L.plural(rounds, 'раунд', 'раунда', 'раундов') + '.</b> Один вход стоит около ' + msTxt(rounds) + ' процессорного времени. У контейнера ' + cpus + ' ' + L.plural(cpus, 'ядро', 'ядра', 'ядер') + ', значит, предел входов около ' + fmt(cap, cap < 10 ? 1 : 0) + ' в секунду. Каждый лишний раунд удваивает цену: при 4 раундах вход в 256 раз дешевле, чем при 12. Но ровно во столько же раз дешевле и подбирать пароли тому, кто украл базу: он перебирает около ' + guesses(rounds) + ' паролей в секунду на ядро.');
    }
    var inR = v.slider('Раундов bcrypt', R0, R1, 1, rounds, function (x) { rounds = x; anim.pause(); done(); });
    var inC = v.slider('Ядер у контейнера', 1, 4, 1, cpus, function (x) { cpus = x; anim.pause(); done(); });
    function done() { draw(); explainNow(); }
    var t = 0;
    var anim = L.animate(v, function (dt) { t += dt * 1.4; draw(t); if (t > show * 0.35 + 1.2) { draw(); explainNow(); return false; } }, done, function () { t = 0; });
    draw(0); explainNow();
    v.hover(function (e, q) {
      sel = Math.max(0, Math.min(show - 1, Math.floor((q.x - geo.left) / (geo.right - geo.left) * show))); draw();
      var r = R0 + sel;
      v.showTip('<b>' + r + ' ' + L.plural(r, 'раунд', 'раунда', 'раундов') + '</b><br>один хеш: ' + msTxt(r) + '<br>входов в секунду (' + cpus + ' ' + L.plural(cpus, 'ядро', 'ядра', 'ядер') + '): <b>' + fmt(perSec(r), perSec(r) < 10 ? 1 : 0) + '</b><br>перебор паролей: ' + guesses(r) + ' в секунду на ядро', e.clientX, e.clientY);
    }, function () { sel = null; draw(); });
    v.tryIt('подвинь «Раундов bcrypt» на 4: предел входов вырастет в сотни раз. Подвинь «Ядер»: предел растёт линейно. Наведи на любой столбец и сравни цены.');
    v.onResize(function () { draw(); });
    void inR; void inC;
  };

  /* ---------- bn-limits ---------- */
  L.widgets['bn-limits'] = function (host) {
    injectStyle();
    var st = { index: host.dataset.index === '1', fixed: host.dataset.fixed === '1', pool: Math.round(num(host.dataset.pool, 5, 1, 30)), load: num(host.dataset.load, 30, 5, 150) };
    var v = L.setup(host, host.dataset.title || 'Узкое место переезжает');
    var X_MAX = 150, cursor = 0, hoverX = null, geo = {};
    // Модель на одну итерацию сценария «mix» (5 запросов): сколько каждого ресурса она съедает.
    function dbMs() { return 5 + (st.index ? 0.4 : 22) + (st.fixed ? 0.4 : 5); }
    function holdMs() { return 80 + (st.index ? (st.fixed ? 3 : 12) : (st.fixed ? 24 : 35)); }
    function shopMs() { return 10 + (st.fixed ? 0 : 5); }
    var RES = [
      { id: 'db', name: 'CPU PostgreSQL', cls: 'danger', cap: function () { return 1000 / dbMs(); }, per: function () { return fmt(dbMs(), 1) + ' мс CPU базы на итерацию'; } },
      { id: 'pool', name: 'Пул соединений', cls: 'response', cap: function () { return st.pool * 1000 / holdMs(); }, per: function () { return fmt(holdMs(), 0) + ' мс соединения на итерацию'; } },
      { id: 'shop', name: 'CPU shop', cls: 'violet', cap: function () { return 1000 / shopMs(); }, per: function () { return fmt(shopMs(), 0) + ' мс CPU shop на итерацию'; } }
    ];
    function first() { return RES.slice().sort(function (a, b) { return a.cap() - b.cap(); })[0]; }
    function draw() {
      var H = 310, W = v.canvas(H), left = 50, right = W - 14, top = 26, bottom = H - 50, yMax = 140;
      function X(x) { return left + x / X_MAX * (right - left); }
      function Y(p) { return bottom - Math.min(p, yMax) / yMax * (bottom - top); }
      geo = { left: left, right: right };
      [0, 25, 50, 75, 100, 125].forEach(function (g) { v.add('line', { x1: left, x2: right, y1: Y(g), y2: Y(g), class: g === 100 ? 'marker danger' : 'grid' }); v.label(left - 6, Y(g) + 5, g + '%', 'muted small', 'end'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.label(left + 4, top - 10, 'загрузка ресурса, % (100% это предел)', 'muted small', 'start');
      v.label((left + right) / 2, H - 6, 'нагрузка, итераций сценария в секунду', 'muted small');
      for (var g = 0; g <= X_MAX; g += 25) v.label(X(g), bottom + 20, String(g), 'muted small');
      var fr = first();
      RES.forEach(function (r) {
        var cap = r.cap(), xEnd = Math.min(X_MAX, cap * 1.4);
        v.add('line', { x1: X(0), y1: Y(0), x2: X(xEnd), y2: Y(xEnd / cap * 100), class: r.cls + ' stroke' + (r === fr ? '' : ' dim') });
        if (cap <= X_MAX) v.add('circle', { cx: X(cap), cy: Y(100), r: r === fr ? 7 : 4, class: r.cls + ' fill' });
      });
      v.add('line', { x1: X(fr.cap()), x2: X(fr.cap()), y1: Y(100), y2: bottom, class: 'muted marker' });
      v.label(Math.min(right - 4, X(fr.cap()) + 8), Y(100) - 8, 'предел ' + fmt(fr.cap(), 0) + '/с: ' + fr.name, 'small halo', X(fr.cap()) > (left + right) / 2 ? 'end' : 'start');
      var x = hoverX !== null ? hoverX : cursor;
      v.add('line', { x1: X(x), x2: X(x), y1: top, y2: bottom, class: 'muted marker' });
      RES.forEach(function (r) { var p = x / r.cap() * 100; v.add('circle', { cx: X(x), cy: Y(p), r: 5, class: r.cls + ' fill' }); });
      geo.X = X;
    }
    function explainNow() {
      var fr = first(), parts = RES.map(function (r) { return r.name + ' ' + fmt(st.load / r.cap() * 100, 0) + '%'; }).join(', ');
      var over = st.load >= fr.cap();
      v.explain('Нагрузка ' + fmt(st.load, 0) + ' итераций в секунду. Загрузка: ' + esc(parts) + '. Первым кончается <b>' + esc(fr.name) + '</b>, его предел около ' + fmt(fr.cap(), 0) + ' итераций в секунду (' + esc(fr.per()) + '). ' + (over ? 'Нагрузка выше предела: очередь растёт, задержка уходит вверх. ' : 'Пока запас есть: ' + fmt((1 - st.load / fr.cap()) * 100, 0) + '% до предела. ') + 'Если починить именно его, выше станет следующий: общий предел равен самому слабому звену.');
    }
    function btn(text, key) {
      var b = v.button(text, function () { st[key] = !st[key]; pressed(b, st[key]); anim.pause(); cursor = st.load; draw(); explainNow(); });
      pressed(b, st[key]); return b;
    }
    v.slider('Нагрузка, итераций/с', 5, 150, 5, st.load, function (x) { st.load = x; cursor = x; anim.pause(); draw(); explainNow(); });
    v.slider('DB_POOL_MAX', 1, 30, 1, st.pool, function (x) { st.pool = x; anim.pause(); draw(); explainNow(); });
    var anim = L.animate(v, function (dt) { cursor = Math.min(st.load, cursor + dt * st.load / 3); draw(); if (cursor >= st.load) { explainNow(); return false; } }, function () { cursor = st.load; draw(); explainNow(); }, function () { cursor = 0; });
    btn('Индекс на orders.user_id', 'index'); btn('Исправить N+1', 'fixed');
    cursor = 0; draw(); explainNow();
    v.hover(function (e, q) {
      var x = Math.max(0, Math.min(X_MAX, (q.x - geo.left) / (geo.right - geo.left) * X_MAX)); hoverX = x; draw();
      v.showTip('<b>Нагрузка ' + fmt(x, 0) + ' итераций/с</b>' + RES.map(function (r) { return '<br>' + esc(r.name) + ': ' + fmt(x / r.cap() * 100, 0) + '% (предел ' + fmt(r.cap(), 0) + ')'; }).join(''), e.clientX, e.clientY);
    }, function () { hoverX = null; draw(); });
    v.tryIt('включи «Индекс на orders.user_id»: база перестанет быть первой, её место займёт пул. Потом «Исправить N+1», потом подними DB_POOL_MAX до 15 и смотри, кто станет слабым звеном.');
    v.onResize(draw);
    host.appendChild(legend([['a', 'CPU PostgreSQL'], ['b', 'пул соединений'], ['c', 'CPU shop']]));
  };

  /* ---------- bn-leak ---------- */
  L.widgets['bn-leak'] = function (host) {
    injectStyle();
    var st = { rps: num(host.dataset.rps, 40, 1, 200), kb: num(host.dataset.kb, 10, 0, 50), limit: Math.round(num(host.dataset.limit, 512, 256, 1024)), base: num(host.dataset.base, 118, 60, 200) };
    var IDLE = 0.4; // запросов в секунду от Prometheus и healthcheck даже без нагрузки
    var v = L.setup(host, host.dataset.title || 'Память: утечка и норма');
    var now = 0, hoverT = null, geo = {}, lastMin = -1;
    function slope() { return (st.rps + IDLE) * st.kb / 1024 * 60; } // МБ в минуту
    function leakAt(t) { return st.base + slope() * t; }
    function okAt(t) { var ph = (t % 4.5) / 4.5; return st.base + 9 * ph + 1.2 * Math.sin(t * 7.3); }
    function oomAt() { return slope() > 0 ? (st.limit - st.base) / slope() : Infinity; }
    function xMax() { var o = oomAt(); return Math.max(30, Math.min(120, Math.ceil(o * 1.25 / 5) * 5)); }
    function draw() {
      var H = 310, W = v.canvas(H), left = 52, right = W - 14, top = 26, bottom = H - 50, XM = xMax(), yTop = L.niceMax(st.limit * 1.15);
      function X(t) { return left + t / XM * (right - left); }
      function Y(m) { return bottom - Math.min(m, yTop) / yTop * (bottom - top); }
      geo = { left: left, right: right, XM: XM };
      L.scale(yTop).ticks.forEach(function (g) { v.add('line', { x1: left, x2: right, y1: Y(g), y2: Y(g), class: 'grid' }); v.label(left - 6, Y(g) + 5, fmt(g, 0), 'muted small', 'end'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.label(left + 4, top - 10, 'память контейнера, МБ', 'muted small', 'start');
      v.label((left + right) / 2, H - 6, 'время теста, минуты', 'muted small');
      var step = XM > 60 ? 20 : XM > 30 ? 10 : 5;
      for (var g = 0; g <= XM; g += step) v.label(X(g), bottom + 20, String(g), 'muted small');
      v.add('line', { x1: left, x2: right, y1: Y(st.limit), y2: Y(st.limit), class: 'danger marker' });
      v.label(left + 6, Y(st.limit) - 6, 'лимит ' + st.limit + ' МБ (mem_limit)', 'small danger', 'start');
      var oom = oomAt(), tEnd = Math.min(now, oom);
      var pts = [], pts2 = [];
      for (var t = 0; t <= now + 1e-9; t += XM / 240) { pts.push(X(t) + ',' + Y(okAt(t))); }
      for (var u = 0; u <= tEnd + 1e-9; u += XM / 240) { pts2.push(X(u) + ',' + Y(leakAt(u))); }
      if (pts.length > 1) v.add('polyline', { points: pts.join(' '), class: 'ok stroke' });
      if (pts2.length > 1) v.add('polyline', { points: pts2.join(' '), class: 'danger stroke' });
      if (now < oom && now > 0) { var fEnd = Math.min(oom, XM); v.add('line', { x1: X(now), y1: Y(leakAt(now)), x2: X(fEnd), y2: Y(leakAt(fEnd)), class: 'danger marker' }); }
      if (now >= oom && oom <= XM) {
        v.add('circle', { cx: X(oom), cy: Y(st.limit), r: 7, class: 'danger fill' });
        v.label(Math.min(right - 4, X(oom) + 10), Y(st.limit) + 22, 'OOM kill на ' + fmt(oom, 0) + ' мин', 'small halo danger', X(oom) > (left + right) / 2 ? 'end' : 'start');
      }
      v.add('line', { x1: X(now), x2: X(now), y1: top, y2: bottom, class: 'muted marker' });
      if (hoverT !== null) v.add('line', { x1: X(hoverT), x2: X(hoverT), y1: top, y2: bottom, class: 'muted marker' });
      geo.X = X;
    }
    function explainNow() {
      var s = slope(), oom = oomAt(), idle = IDLE * st.kb / 1024 * 3600;
      v.explain('Нормальный сервис (зелёная линия) колеблется «пилой»: память растёт, потом сборщик мусора её возвращает, и средний уровень стоит на месте около ' + fmt(st.base, 0) + ' МБ. При утечке (красная) каждый запрос оставляет ' + fmt(st.kb, 0) + ' КБ навсегда: при ' + fmt(st.rps, 0) + ' запросах в секунду это ' + fmt(s, 1) + ' МБ в минуту. ' + (oom < 1e5 ? 'Лимит ' + st.limit + ' МБ кончится примерно на ' + fmt(oom, 0) + '-й минуте, и ядро убьёт процесс (OOM kill). ' : 'Утечки нет, лимит не угрожает. ') + 'Даже без нагрузки Prometheus и healthcheck дают около ' + fmt(IDLE, 1) + ' запроса в секунду: это ещё ' + fmt(idle, 1) + ' МБ в час.');
    }
    function setNow(x) { now = x; }
    function refresh() { now = xMax(); draw(); explainNow(); }
    v.slider('Запросов в секунду', 1, 200, 1, st.rps, function (x) { st.rps = x; anim.pause(); refresh(); });
    v.slider('Утечка на запрос, КБ', 0, 50, 1, st.kb, function (x) { st.kb = x; anim.pause(); refresh(); });
    v.slider('Лимит памяти, МБ', 256, 1024, 64, st.limit, function (x) { st.limit = x; anim.pause(); refresh(); });
    var anim = L.animate(v, function (dt) {
      setNow(Math.min(xMax(), now + dt * xMax() / 14)); draw();
      var m = Math.floor(now); if (m !== lastMin) { lastMin = m; }
      if (now >= xMax()) { explainNow(); return false; }
    }, function () { refresh(); }, function () { now = 0; lastMin = -1; });
    if (anim.reduced) refresh(); else { now = 0; draw(); explainNow(); }
    v.hover(function (e, q) {
      var t = Math.max(0, Math.min(geo.XM, (q.x - geo.left) / (geo.right - geo.left) * geo.XM)); hoverT = t; draw();
      var lk = leakAt(t), dead = t >= oomAt();
      v.showTip('<b>Минута ' + fmt(t, 1) + '</b><br>норма: ' + fmt(okAt(t), 0) + ' МБ<br>утечка: ' + (dead ? '<b>процесс убит</b>' : '<b>' + fmt(lk, 0) + ' МБ</b> (' + fmt(lk / st.limit * 100, 0) + '% лимита)'), e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    v.tryIt('подвинь «Утечка на запрос» на 0: красная линия ляжет на зелёную. Подними запросы в секунду: время до OOM падает. Наведи на график и сравни обе линии в любой минуте.');
    v.onResize(draw);
    host.appendChild(legend([['d', 'норма: пила около постоянного уровня'], ['a', 'утечка: ровный подъём до лимита']]));
  };

  /* ---------- bn-retry-storm ---------- */
  function simulate(P) {
    var dt = 0.1, N = Math.round(P.dur / dt), d = 0.05, Q = 0, ev = {}, tokens = 0, out = [], a = 5;
    function rnd() { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }
    function addEv(step, k, n) { (ev[step] = ev[step] || []).push({ k: k, n: n }); }
    for (var i = 0; i < N; i++) {
      var t = i * dt, fresh = P.rate * dt, att = 0, ok = 0, cohorts = [{ k: 0, n: fresh }];
      tokens = Math.min(tokens + fresh * 0.1, 5);
      (ev[i] || []).forEach(function (c) {
        var n = c.n;
        if (P.mode === 'budget') { var allow = Math.min(n, tokens); tokens -= allow; n = allow; }
        if (n > 0) cohorts.push({ k: c.k, n: n });
      });
      var blip = t >= P.blipAt && t < P.blipAt + P.blip, lat = d + Q / P.cap;
      cohorts.forEach(function (c) {
        var fail, wait;
        att += c.n;
        if (lat > P.timeout) { fail = c.n; wait = P.timeout; } else if (blip) { fail = c.n; wait = lat; } else { fail = 0; wait = lat; ok += c.n; }
        if (fail > 0 && c.k < P.retries) addEv(i + Math.max(1, Math.round((wait + (P.mode === 'backoff' ? 0.3 * Math.pow(2, c.k) * (0.5 + rnd()) : 0)) / dt)), c.k + 1, fail);
      });
      ok = Math.min(ok, P.cap * dt);
      Q = Math.max(0, Q + att - P.cap * dt);
      out.push({ t: t, att: att / dt, ok: ok / dt, q: Q, lat: lat });
    }
    return out;
  }

  L.widgets['bn-retry-storm'] = function (host) {
    injectStyle();
    var st = { rate: num(host.dataset.rate, 12, 4, 20), cap: num(host.dataset.capacity, 30, 15, 60), retries: Math.round(num(host.dataset.retries, 3, 0, 5)), timeout: num(host.dataset.timeout, 1, 0.5, 5), blip: num(host.dataset.blip, 10, 5, 40), mode: 'none' };
    var DUR = 120, BLIP_AT = 20;
    var v = L.setup(host, host.dataset.title || 'Шторм повторов: что делает оплата, у которой есть предел');
    var data, now = 0, hoverI = null, geo = {}, att0 = 0;
    function run() { data = simulate({ dur: DUR, rate: st.rate, cap: st.cap, retries: st.retries, timeout: st.timeout, blipAt: BLIP_AT, blip: st.blip, mode: st.mode }); }
    function draw() {
      var H = 360, W = v.canvas(H), left = 50, right = W - 14;
      var p1 = { top: 28, bottom: 158 }, p2 = { top: 206, bottom: 306 };
      var maxAtt = Math.max(st.cap * 1.2, data.reduce(function (m, x) { return Math.max(m, x.att); }, 0)), sc1 = L.scale(maxAtt), sc2 = L.scale(st.rate * 1.3);
      function X(t) { return left + t / DUR * (right - left); }
      function Y1(n) { return p1.bottom - Math.min(n, sc1.max) / sc1.max * (p1.bottom - p1.top); }
      function Y2(n) { return p2.bottom - Math.min(n, sc2.max) / sc2.max * (p2.bottom - p2.top); }
      geo = { left: left, right: right, X: X };
      [[p1, sc1, Y1, 'запросов к оплате в секунду'], [p2, sc2, Y2, 'заказов, прошедших оплату, в секунду']].forEach(function (p) {
        v.add('rect', { x: X(BLIP_AT), y: p[0].top, width: X(BLIP_AT + st.blip) - X(BLIP_AT), height: p[0].bottom - p[0].top, class: 'danger zone' });
        p[1].ticks.forEach(function (g) { v.add('line', { x1: left, x2: right, y1: p[2](g), y2: p[2](g), class: 'grid' }); v.label(left - 6, p[2](g) + 5, fmt(g, 0), 'muted small', 'end'); });
        v.add('path', { d: 'M' + left + ' ' + p[0].top + 'V' + p[0].bottom + 'H' + right, class: 'axis' });
        v.label(left + 4, p[0].top - 10, p[3], 'muted small', 'start');
      });
      v.label(X(BLIP_AT + st.blip / 2), p1.top + 16, 'сбой оплаты', 'small halo danger');
      for (var g = 0; g <= DUR; g += 20) v.label(X(g), p2.bottom + 20, String(g), 'muted small');
      v.label((left + right) / 2, H - 6, 'время, секунды', 'muted small');
      v.add('line', { x1: left, x2: right, y1: Y1(st.cap), y2: Y1(st.cap), class: 'warning marker' });
      v.label(right - 4, Y1(st.cap) - 6, 'предел оплаты ' + fmt(st.cap, 0) + '/с', 'small warning', 'end');
      v.add('line', { x1: left, x2: right, y1: Y2(st.rate), y2: Y2(st.rate), class: 'muted marker' });
      v.label(right - 4, Y2(st.rate) - 6, 'пришло заказов ' + fmt(st.rate, 0) + '/с', 'small muted', 'end');
      var n = Math.max(1, Math.min(data.length, Math.floor(now / 0.1) + 1)), step = Math.max(1, Math.floor(data.length / 240)), a = [], b = [];
      for (var i = 0; i < n; i += step) { a.push(X(data[i].t) + ',' + Y1(data[i].att)); b.push(X(data[i].t) + ',' + Y2(data[i].ok)); }
      if (a.length > 1) { v.add('polyline', { points: a.join(' '), class: 'danger stroke' }); v.add('polyline', { points: b.join(' '), class: 'ok stroke' }); }
      v.add('line', { x1: X(now), x2: X(now), y1: p1.top, y2: p2.bottom, class: 'muted marker' });
      if (hoverI !== null) v.add('line', { x1: X(data[hoverI].t), x2: X(data[hoverI].t), y1: p1.top, y2: p2.bottom, class: 'muted marker' });
    }
    function mean(from, to, key) { var s = 0, c = 0; data.forEach(function (x) { if (x.t >= from && x.t < to) { s += x[key]; c++; } }); return c ? s / c : 0; }
    function explainNow() {
      var peak = data.reduce(function (m, x) { return Math.max(m, x.att); }, 0), okEnd = mean(DUR - 20, DUR, 'ok'), rec = okEnd >= st.rate * 0.9, per = peak / st.rate;
      v.explain('В обычное время оплата получает ' + fmt(st.rate, 0) + ' попыток в секунду и успевает (предел ' + fmt(st.cap, 0) + '). Во время сбоя каждая неудачная попытка повторяется до ' + (st.retries + 1) + ' раз: на пике оплата получает <b>' + fmt(peak, 0) + ' попыток в секунду</b>, в ' + fmt(per, 1) + ' раза больше обычного' + (peak > st.cap ? ', то есть больше предела. Оплата не справляется, ответы приходят позже таймаута (' + fmt(st.timeout, 1) + ' с), их выбрасывают и повторяют ещё раз.' : ': пока это меньше предела, оплата справляется.') + ' ' + (rec ? 'К концу теста <b>всё восстановилось</b>: заказы проходят.' : 'К концу теста оплата давно здорова, но заказы <b>не проходят</b>: повторы сами держат её в перегрузе.'));
    }
    function reset() { run(); now = 0; }
    function refresh() { run(); now = DUR; draw(); explainNow(); }
    v.slider('Повторов после первой попытки', 0, 5, 1, st.retries, function (x) { st.retries = x; anim.pause(); refresh(); });
    v.slider('Таймаут одной попытки', 0.5, 5, 0.5, st.timeout, function (x) { st.timeout = x; anim.pause(); refresh(); }, 'с');
    v.slider('Длительность сбоя', 5, 40, 5, st.blip, function (x) { st.blip = x; anim.pause(); refresh(); }, 'с');
    var modes = [['none', 'Без пауз (как в стенде)'], ['backoff', 'Пауза растёт (backoff + jitter)'], ['budget', 'Бюджет повторов 10%']], mbox = html('div', undefined, 'bn-cases bn-modes'), mbtn = {};
    modes.forEach(function (m) {
      var b = html('button', m[1]); b.type = 'button'; b.addEventListener('click', function () { st.mode = m[0]; Object.keys(mbtn).forEach(function (k) { pressed(mbtn[k], k === st.mode); }); anim.pause(); refresh(); });
      mbtn[m[0]] = b; pressed(b, m[0] === st.mode); mbox.appendChild(b);
    });
    v.stage.parentNode.insertBefore(mbox, v.stage.nextSibling);
    run();
    var anim = L.animate(v, function (dt) { now = Math.min(DUR, now + dt * 10); draw(); if (now >= DUR) { explainNow(); return false; } }, function () { refresh(); }, function () { reset(); });
    draw(); explainNow();
    v.hover(function (e, q) {
      var t = Math.max(0, Math.min(DUR - 0.1, (q.x - geo.left) / (geo.right - geo.left) * DUR)); hoverI = Math.round(t / 0.1); draw();
      var x = data[hoverI];
      v.showTip('<b>Секунда ' + fmt(x.t, 0) + '</b><br>запросов к оплате: <b>' + fmt(x.att, 0) + '/с</b> (предел ' + fmt(st.cap, 0) + ')<br>заказов прошло: <b>' + fmt(x.ok, 1) + '/с</b><br>очередь у оплаты: ' + fmt(x.q, 0) + ', ответ через ' + fmt(x.lat, 1) + ' с', e.clientX, e.clientY);
    }, function () { hoverI = null; draw(); });
    v.tryIt('поставь «Повторов» на 0 или 1: оплата переживает сбой и сама восстанавливается. На 3 без пауз она не восстанавливается никогда. Включи «Бюджет повторов» при 3 повторах и сравни.');
    v.onResize(draw);
    host.appendChild(legend([['a', 'запросов к оплате'], ['d', 'успешных заказов'], ['e', 'предел оплаты']]));
    void att0;
  };
})();
