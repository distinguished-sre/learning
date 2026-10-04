/* Виджеты темы 5 «Надёжность и инциденты» курса «Мониторинг и SRE», урок 5.2: регистрируются через window.LTViz. Префикс mon52-.

   mon52-actions: проверка задач из постмортема. Выбери задачу кнопкой и посмотри, какие из пяти проверок
    она проходит (те же правила, что в check-actions.py): действие, тип, владелец, срок, критерий готовности. */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var esc = L.esc;

  var st = document.createElement('style');
  st.textContent = '.mon52-on{border-color:var(--accent-ink)!important;font-weight:700}';
  document.head.appendChild(st);

  var VAGUE = ['улучш', 'повысить', 'обсудить', 'внимательн', 'усилить', 'рассмотреть'];
  var VAGUE_OWNER = ['все', 'команда', 'команде', 'кто-то', 'разработчики', 'дежурные', ''];
  var TYPES = ['prevent', 'detect', 'mitigate'];

  var ACTIONS = [
    { b: 'Улучшить мониторинг оплаты', a: 'Улучшить мониторинг оплаты', t: 'detect', o: 'команда', d: 'скоро', c: '' },
    { b: 'Дежурным быть внимательнее', a: 'Дежурным быть внимательнее ночью', t: 'mitigate', o: 'все', d: '', c: '' },
    { b: 'Увеличить пул до 50', a: 'Увеличить пул соединений с 5 до 50', t: 'prevent', o: 'разработчик заказов', d: '2026-10-18', c: '' },
    { b: 'Алерт на p95 оплаты', a: 'Добавить алерт LabPaymentSlow: p95 оплаты больше 1 с, for 2m', t: 'detect', o: 'SRE на дежурстве', d: '2026-10-11', c: 'promtool test rules зелёный, в прогоне алерт горит через 3 минуты' },
    { b: 'Оплата вне транзакции', a: 'Вынести вызов оплаты из транзакции заказа', t: 'prevent', o: 'разработчик заказов', d: '2026-10-18', c: 'при delay_ms=5000 и 8 покупателях shop_db_pool_waiting остаётся 0' },
    { b: 'Шаг в runbook', a: 'Дописать в runbook-payment.md шаг «вернуть оплату к норме»', t: 'mitigate', o: 'SRE и разработчик', d: '2026-10-11', c: 'коллега выполнил шаг по инструкции за 3 минуты' }
  ];

  function checks(x) {
    var low = x.a.toLowerCase(), own = x.o.toLowerCase();
    return [
      { name: 'Действие', val: x.a, ok: !(VAGUE.some(function (w) { return low.indexOf(w) >= 0; }) || x.a.length < 15),
        why: 'Нужен глагол и объект, который можно потрогать. «Улучшить», «обсудить», «быть внимательнее» не проверишь.' },
      { name: 'Тип', val: x.t, ok: TYPES.indexOf(x.t.toLowerCase()) >= 0,
        why: 'prevent не допустить повтора, detect заметить быстрее, mitigate смягчить последствия.' },
      { name: 'Владелец', val: x.o || '(пусто)', ok: !(VAGUE_OWNER.indexOf(own) >= 0 || own.indexOf(' и ') >= 0 || own.indexOf(',') >= 0),
        why: 'Владелец один: человек или роль. «Команда», «все» и список из двух значат, что за задачу не отвечает никто.' },
      { name: 'Срок', val: x.d || '(пусто)', ok: /^\d{4}-\d{2}-\d{2}$/.test(x.d),
        why: 'Срок датой ГГГГ-ММ-ДД. «Скоро» и пустое поле нельзя ни проверить, ни просрочить.' },
      { name: 'Критерий готовности', val: x.c || '(пусто)', ok: x.c.length >= 15,
        why: 'Чем проверим, что сделано: запрос, тест, прогон на стенде. «Закрыто в трекере» критерием не считается.' }
    ];
  }

  /* ---------- mon52-actions ---------- */
  L.widgets['mon52-actions'] = function (host) {
    var v = L.setup(host, host.dataset.title || 'Задача из постмортема: пять проверок');
    var cur = 3, btns = [], rows = [];
    function draw() {
      var x = ACTIONS[cur], cs = checks(x), rowH = 44, H = 16 + cs.length * rowH + 14, W = v.canvas(H);
      var lw = Math.min(150, W * 0.3), bad = 0;
      rows = [];
      cs.forEach(function (c, i) {
        var y = 14 + i * rowH;
        v.add('rect', { x: 6, y: y, width: W - 12, height: rowH - 8, rx: 6, class: c.ok ? 'ok fill' : 'danger fill', opacity: 0.18 });
        v.add('rect', { x: 6, y: y, width: W - 12, height: rowH - 8, rx: 6, class: c.ok ? 'ok stroke' : 'danger stroke', fill: 'none' });
        v.label(16, y + 23, c.name, 'small', 'start');
        var room = Math.max(10, Math.floor((W - lw - 70) / 7)), txt = c.val.length > room ? c.val.slice(0, room - 1) + '…' : c.val;
        v.label(lw, y + 23, txt, c.val.charAt(0) === '(' ? 'muted small' : '', 'start');
        v.label(W - 16, y + 23, c.ok ? 'ок' : 'плохо', c.ok ? 'small' : 'danger small', 'end');
        rows.push({ y0: y, y1: y + rowH - 8, c: c });
        if (!c.ok) bad++;
      });
      return { x: x, bad: bad, cs: cs };
    }
    function describe(r) {
      var s = [];
      if (!r.bad) s.push('<b>«' + esc(r.x.b) + '»</b> проходит все пять проверок: действие конкретное, владелец один, срок датой, есть критерий.');
      else s.push('<b>«' + esc(r.x.b) + '»</b> не проходит проверок: ' + r.bad + ' из 5. Провалены: ' + r.cs.filter(function (c) { return !c.ok; }).map(function (c) { return esc(c.name.toLowerCase()); }).join(', ') + '.');
      if (r.x.b === 'Увеличить пул до 50') s.push('Задача выглядит конкретной, но без критерия не ясно, как узнать, что стало лучше. К тому же у PostgreSQL <code>max_connections=100</code>: пул в 50 съедает половину соединений.');
      if (r.x.b === 'Шаг в runbook') s.push('Здесь всё хорошо, кроме владельца: «SRE и разработчик» это двое, значит, спросить не с кого.');
      v.explain('<p>' + s.join('</p><p>') + '</p>');
    }
    function refresh() {
      describe(draw());
      btns.forEach(function (b, i) { b.classList.toggle('mon52-on', i === cur); });
    }
    ACTIONS.forEach(function (a, i) { btns.push(v.button(a.b, function () { cur = i; refresh(); })); });
    v.hover(function (e, q) {
      for (var i = 0; i < rows.length; i++) {
        if (q.y >= rows[i].y0 && q.y <= rows[i].y1) {
          var c = rows[i].c;
          return v.showTip('<b>' + esc(c.name) + ': ' + (c.ok ? 'ок' : 'плохо') + '</b><br>' + esc(c.why), e.clientX, e.clientY);
        }
      }
      v.hideTip();
    });
    v.tryIt('нажми «Улучшить мониторинг оплаты», потом «Увеличить пул до 50» и «Шаг в runbook»: у каждой задачи свой изъян. Наведи на строку, чтобы прочитать правило.');
    v.onResize(refresh);
    refresh();
  };
})();
