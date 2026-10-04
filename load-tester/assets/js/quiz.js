/* Блок «Проверь себя» в конце урока и предупреждение перед переходом к следующему уроку.
   Банк урока лежит в странице (<script type="application/json" data-quiz-bank>), логика в quiz-core.js,
   карточки в quiz-ui.js. Переход никогда не блокируется: окно только предупреждает. */
(function () {
  'use strict';
  var Q = window.LTQuiz, UI = window.LTQuizUI;
  var section = document.querySelector('section.quiz[data-quiz]');
  if (!Q || !UI || !section) return;
  var bankEl = section.querySelector('[data-quiz-bank]');
  var app = section.querySelector('[data-quiz-app]');
  var bank;
  try { bank = JSON.parse(bankEl.textContent); } catch (e) { return; }
  if (!bank || !bank.questions || !bank.questions.length) return;
  var el = UI.el;

  var lesson = section.getAttribute('data-quiz');
  var KEY = Q.storageKey(lesson);
  var store = Q.makeStore();
  var qs = {};
  bank.questions.forEach(function (q) { qs[q.id] = q; });
  var state = Q.restore(store.get(KEY), bank);
  if (!state.current) state = Q.newAttempt(state, bank);
  save();

  function save() { store.set(KEY, JSON.stringify(state)); }

  /* Блок ставим перед последним абзацем «Дальше: …», чтобы тест шёл до перехода. */
  var body = section.parentNode;
  var nextP = Array.prototype.filter.call(body.children, function (p) {
    return p.tagName === 'P' && /^\s*Дальше:/.test(p.textContent);
  }).pop();
  if (nextP) body.insertBefore(section, nextP);

  function answeredCount(c) {
    return c.qids.filter(function (id) { return (c.answers[id] || []).length; }).length;
  }

  function render() {
    var c = state.current;
    app.textContent = '';
    var head = el('div', 'qz-head');
    head.appendChild(el('span', 'chip', 'Попытка ' + c.no));
    head.appendChild(el('span', 'chip', c.qids.length + ' ' + UI.plural(c.qids.length, 'вопрос', 'вопроса', 'вопросов') + ' из ' + bank.questions.length));
    if (state.last && !(c.finished && state.last.no === c.no)) {
      head.appendChild(el('span', 'chip qz-last ' + (state.last.pass ? 'is-pass' : 'is-fail'),
        'Прошлая попытка: ' + UI.resultText(state.last) + (state.last.pass ? ' ✓' : ' ✗')));
    }
    app.appendChild(head);

    var form = el('form', 'qz-form');
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', function (e) { e.preventDefault(); check(); });
    c.qids.forEach(function (qid, i) {
      var per = c.finished ? (c.result.per.filter(function (p) { return p.id === qid; })[0] || { ok: false, chosen: c.answers[qid] || [] }) : null;
      form.appendChild(UI.card(qs[qid], {
        n: i + 1, total: c.qids.length, order: c.order[qid], chosen: c.answers[qid] || [], per: per,
        refHref: '#' + Q.slug(qs[qid].section),
        onChange: c.finished ? null : function (ids) { onChange(qid, ids); }
      }));
    });

    var foot = el('div', 'qz-foot');
    if (!c.finished) {
      var cnt = el('p', 'qz-count', UI.countText(answeredCount(c), c.qids.length));
      cnt.setAttribute('aria-live', 'polite');
      foot.appendChild(cnt);
      var btn = el('button', 'btn primary', 'Проверить ответы');
      btn.type = 'submit';
      foot.appendChild(btn);
    } else {
      foot.appendChild(UI.summary(c.result,
        'Порог 60% набран. Ниже разбор каждого вопроса.',
        'Для перехода рекомендуется набрать минимум 60%. Ниже разбор каждого вопроса: повтори разделы по ссылкам и попробуй другой набор вопросов.'));
    }
    var again = el('button', 'btn', c.finished ? 'Новая попытка' : 'Другие вопросы (новая попытка)');
    again.type = 'button';
    again.addEventListener('click', function () { newAttempt(true); });
    foot.appendChild(again);
    form.appendChild(foot);
    app.appendChild(form);
  }

  function onChange(qid, ids) {
    state = Q.setAnswer(state, qid, ids);
    save();
    var cnt = app.querySelector('.qz-count');
    if (cnt) cnt.textContent = UI.countText(answeredCount(state.current), state.current.qids.length);
  }

  function check() {
    if (state.current.finished) return;
    state = Q.finish(state, bank);
    save();
    render();
    var r = state.current.result;
    var box = app.querySelector('.qz-result');
    if (box) { box.scrollIntoView({ block: 'center' }); box.focus({ preventScroll: true }); }
    if (!r.pass) warn({ kind: 'fail', correct: r.correct, total: r.total }, null);
  }

  function newAttempt(focus) {
    state = Q.newAttempt(state, bank);
    save();
    render();
    if (focus) {
      section.scrollIntoView({ block: 'start' });
      var first = app.querySelector('input');
      if (first) first.focus({ preventScroll: true });
    }
  }

  /* ---------- предупреждение ---------- */
  var dlg = null, pendingHref = null, opener = null;
  function warn(w, href) {
    pendingHref = href;
    opener = document.activeElement;
    if (!dlg) {
      dlg = el('dialog', 'qz-dialog');
      dlg.setAttribute('aria-labelledby', 'qz-dlg-h');
      dlg.setAttribute('aria-describedby', 'qz-dlg-t');
      dlg.addEventListener('close', function () {
        if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
      });
      /* клик по затемнению закрывает окно без перехода */
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
    }
    dlg.textContent = '';
    var box = el('div', 'qz-dlg-box');
    var h = el('h2', null, w.kind === 'fail' ? 'Тест урока не пройден' : 'Тест урока ещё не пройден');
    h.id = 'qz-dlg-h';
    box.appendChild(h);
    var t = el('div', 'qz-dlg-text');
    t.id = 'qz-dlg-t';
    if (w.kind === 'fail') {
      t.appendChild(el('p', null, 'Результат: ' + w.correct + ' из ' + w.total + ', ' + Q.fmtPct(w.correct, w.total) + '.'));
      t.appendChild(el('p', null, 'Для перехода рекомендуется набрать минимум 60%. Повтори материал урока и попробуй другой набор вопросов.'));
    } else {
      t.appendChild(el('p', null, 'Ты ещё не проверил ответы в блоке «Проверь себя» в конце урока.'));
      t.appendChild(el('p', null, 'Для перехода рекомендуется набрать в нём минимум 60%: так ты убедишься, что материал урока усвоен.'));
    }
    t.appendChild(el('p', null, 'Ты можешь продолжить обучение сейчас.'));
    box.appendChild(t);
    var btns = el('div', 'qz-dlg-btns');
    var ok = el('button', 'btn primary', href ? 'ОК, продолжить' : 'ОК');
    ok.type = 'button';
    ok.addEventListener('click', function () {
      state = Q.acknowledge(state);
      save();
      var go = pendingHref;
      dlg.close();
      if (go) location.href = go;
    });
    btns.appendChild(ok);
    var alt = el('button', 'btn', w.kind === 'fail' ? 'Новая попытка' : 'К тесту');
    alt.type = 'button';
    alt.addEventListener('click', function () {
      opener = null;
      dlg.close();
      if (w.kind === 'fail') newAttempt(true);
      else {
        section.scrollIntoView({ block: 'start' });
        var first = app.querySelector('input:not(:disabled)');
        if (first) first.focus({ preventScroll: true });
      }
    });
    btns.appendChild(alt);
    box.appendChild(btns);
    dlg.appendChild(box);
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute('open', '');
    ok.focus();
  }

  /* Переход к следующему уроку: кнопка «дальше», клавиша → (site.js вызывает click) и ссылки
     в тексте урока на тот же адрес. Меню и прочие ссылки не трогаем. */
  var nextA = document.querySelector('a[data-nav="next"]');
  var nextUrl = nextA ? nextA.href.split('#')[0] : null;
  if (nextUrl) {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.href.split('#')[0] !== nextUrl) return;
      if (!a.matches('a[data-nav="next"]') && !a.closest('.lesson-body')) return;
      var w = Q.navWarning(state);
      if (!w) return;
      e.preventDefault();
      warn(w, a.href);
    }, true);
  }

  /* Тест прошли в другой вкладке: подхватываем состояние. */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    var next = Q.restore(e.newValue, bank);
    /* ответы в той же попытке не перерисовываем: иначе в этой вкладке теряется фокус */
    var a = state.current, b = next.current;
    if (a && b && a.no === b.no && !!a.finished === !!b.finished && !!a.ack === !!b.ack) return;
    state = next;
    if (!state.current) state = Q.newAttempt(state, bank);
    render();
  });

  render();
})();
