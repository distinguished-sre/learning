/* Логика тестов «Проверь себя» без DOM: оценка, выбор блока, перемешивание, состояние.
   Общая для урока (quiz.js), страницы подготовки (prep.js) и тестов node (tools/quiz.test.mjs). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LTQuiz = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  var PASS_NUM = 3, PASS_DEN = 5; /* порог 60% включительно, без округлений */

  function shuffle(arr, rand) {
    rand = rand || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var s = {};
    a.forEach(function (x) { s[x] = 1; });
    return b.every(function (x) { return s[x] === 1; });
  }

  function byId(bank) {
    var m = {};
    (bank.questions || []).forEach(function (q) { m[q.id] = q; });
    return m;
  }

  /* Оценка блока. answers: {qid: [id вариантов]}. Вопрос засчитан только при точном совпадении
     выбранных вариантов с правильными; без ответа = неверно; процент от всех вопросов блока. */
  function grade(questions, answers) {
    answers = answers || {};
    var per = questions.map(function (q) {
      var chosen = (answers[q.id] || []).slice();
      return { id: q.id, chosen: chosen, ok: chosen.length > 0 && sameSet(chosen, q.correct), answered: chosen.length > 0 };
    });
    var correct = per.filter(function (p) { return p.ok; }).length, total = questions.length;
    return { correct: correct, total: total, pass: total > 0 && correct * PASS_DEN >= total * PASS_NUM, pct: pct(correct, total), per: per };
  }

  function pct(c, t) {
    if (!t) return 0;
    return Math.round(c * 1000 / t) / 10;
  }

  function fmtPct(c, t) {
    return String(pct(c, t)).replace('.', ',') + '%';
  }

  /* Следующий блок. state: {used: [...], cycle, prevBlock: [...]}; ids: все id банка по порядку.
     Пока банк не исчерпан, вопросы не повторяются; потом новый цикл, и в первый блок нового цикла
     по возможности не попадают вопросы прошлого блока. Возвращает {qids, used, cycle}. */
  function nextBlock(ids, size, used, cycle, prevBlock, rand) {
    var valid = {};
    ids.forEach(function (id) { valid[id] = 1; });
    var usedSet = {};
    (used || []).forEach(function (id) { if (valid[id]) usedSet[id] = 1; });
    cycle = cycle || 1;
    size = Math.max(1, Math.min(size, ids.length));
    var fresh = shuffle(ids.filter(function (id) { return !usedSet[id]; }), rand);
    var picked = fresh.slice(0, size);
    var newUsed = Object.keys(usedSet).concat(picked);
    if (picked.length < size) {
      /* банк исчерпан: новый цикл; добираем из остальных, избегая только что выданных и прошлого блока */
      cycle += 1;
      var avoid = {};
      picked.forEach(function (id) { avoid[id] = 2; });
      (prevBlock || []).forEach(function (id) { if (!avoid[id]) avoid[id] = 1; });
      var rest = shuffle(ids.filter(function (id) { return !avoid[id]; }), rand)
        .concat(shuffle(ids.filter(function (id) { return avoid[id] === 1; }), rand));
      var extra = rest.slice(0, size - picked.length);
      /* остаток старого цикла только что показан: в новом цикле он тоже считается выданным */
      newUsed = extra.concat(picked);
      picked = picked.concat(extra);
    }
    return { qids: shuffle(picked, rand), used: newUsed, cycle: cycle };
  }

  function emptyState() {
    return { v: VERSION, used: [], cycle: 1, attemptNo: 0, current: null, last: null, passedEver: false, prevBlock: [] };
  }

  function newAttempt(state, bank, rand) {
    var ids = (bank.questions || []).map(function (q) { return q.id; });
    var qs = byId(bank);
    var prev = state.current ? state.current.qids : state.prevBlock;
    var nb = nextBlock(ids, bank.block || 5, state.used, state.cycle, prev, rand);
    var order = {};
    nb.qids.forEach(function (id) {
      order[id] = shuffle(qs[id].options.map(function (o) { return o.id; }), rand);
    });
    var s = clone(state);
    s.used = nb.used;
    s.cycle = nb.cycle;
    s.prevBlock = prev || [];
    s.attemptNo = (state.attemptNo || 0) + 1;
    s.current = { no: s.attemptNo, qids: nb.qids, order: order, answers: {}, finished: false, result: null, ack: false };
    return s;
  }

  function setAnswer(state, qid, optIds) {
    var s = clone(state);
    if (!s.current || s.current.finished || s.current.qids.indexOf(qid) === -1) return state;
    s.current.answers[qid] = optIds.slice();
    return s;
  }

  /* Завершить попытку: результат замораживается, повтор только через новую попытку. */
  function finish(state, bank) {
    if (!state.current || state.current.finished) return state;
    var qs = byId(bank);
    var list = state.current.qids.map(function (id) { return qs[id]; }).filter(Boolean);
    var g = grade(list, state.current.answers);
    var s = clone(state);
    s.current.finished = true;
    s.current.result = {
      correct: g.correct, total: g.total, pass: g.pass,
      per: g.per.map(function (p) { return { id: p.id, ok: p.ok, chosen: p.chosen, correct: qs[p.id].correct.slice() }; })
    };
    s.last = { no: s.current.no, correct: g.correct, total: g.total, pass: g.pass };
    if (g.pass) s.passedEver = true;
    return s;
  }

  function acknowledge(state) {
    var s = clone(state);
    if (s.current) s.current.ack = true;
    return s;
  }

  /* Нужно ли предупреждение при переходе к следующему уроку. Переход не блокируется никогда:
     функция только решает, показать ли окно. null | {kind: 'fail', correct, total} | {kind: 'untaken'} */
  function navWarning(state) {
    if (!state || state.passedEver) return null;
    var c = state.current;
    if (c && c.ack) return null;
    if (c && c.finished) return c.result.pass ? null : { kind: 'fail', correct: c.result.correct, total: c.result.total };
    return { kind: 'untaken' };
  }

  /* Восстановление сохранённого состояния против текущего банка: удалённые вопросы и варианты
     не ломают загрузку, новые вопросы не сбрасывают прогресс. */
  function restore(raw, bank, rand) {
    var s;
    try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { s = null; }
    if (!s || typeof s !== 'object' || s.v !== VERSION) return emptyState();
    var qs = byId(bank);
    var out = emptyState();
    out.used = (Array.isArray(s.used) ? s.used : []).filter(function (id) { return qs[id]; });
    out.cycle = s.cycle > 0 ? s.cycle : 1;
    out.attemptNo = s.attemptNo > 0 ? s.attemptNo : 0;
    out.prevBlock = (Array.isArray(s.prevBlock) ? s.prevBlock : []).filter(function (id) { return qs[id]; });
    out.passedEver = !!s.passedEver;
    if (s.last && s.last.total > 0) out.last = { no: s.last.no, correct: s.last.correct, total: s.last.total, pass: !!s.last.pass };
    var c = s.current;
    if (c && Array.isArray(c.qids)) {
      if (c.finished && c.result) {
        /* завершённая попытка заморожена: счёт сохраняется, разбор показываем по оставшимся вопросам */
        var per = (c.result.per || []).filter(function (p) { return qs[p.id]; });
        out.current = {
          no: c.no, qids: c.qids.filter(function (id) { return qs[id]; }), order: {}, answers: {},
          finished: true, ack: !!c.ack,
          result: { correct: c.result.correct, total: c.result.total, pass: !!c.result.pass, per: per }
        };
        out.current.qids.forEach(function (id) { out.current.order[id] = fixOrder(c.order && c.order[id], qs[id], rand); });
        per.forEach(function (p) { out.current.answers[p.id] = p.chosen; });
      } else {
        var qids = c.qids.filter(function (id) { return qs[id]; });
        if (qids.length) {
          out.current = { no: c.no, qids: qids, order: {}, answers: {}, finished: false, result: null, ack: !!c.ack };
          qids.forEach(function (id) {
            out.current.order[id] = fixOrder(c.order && c.order[id], qs[id], rand);
            var valid = {};
            qs[id].options.forEach(function (o) { valid[o.id] = 1; });
            var a = (c.answers && Array.isArray(c.answers[id]) ? c.answers[id] : []).filter(function (x) { return valid[x]; });
            if (qs[id].type === 'single') a = a.slice(0, 1);
            if (a.length) out.current.answers[id] = a;
          });
        }
      }
    }
    return out;
  }

  function fixOrder(order, q, rand) {
    var ids = q.options.map(function (o) { return o.id; });
    var kept = (Array.isArray(order) ? order : []).filter(function (id) { return ids.indexOf(id) !== -1; });
    var added = ids.filter(function (id) { return kept.indexOf(id) === -1; });
    return kept.concat(shuffle(added, rand));
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* id заголовка, как его строит kramdown (GFM) на GitHub Pages из исходного текста заголовка:
     нижний регистр, всё кроме букв, цифр, «_», «-» и пробела удаляется, пробел → «-». */
  function slug(text) {
    var t = String(text).toLowerCase();
    try { t = t.replace(/[^\p{L}\p{M}\p{Nd}\p{Pc}\- \t]/gu, ''); } catch (e) { t = t.replace(/[^\wЀ-ӿ\- \t]/g, ''); }
    return t.replace(/[ \t]/g, '-');
  }

  /* Ключ хранилища: своё пространство, не пересекается с отметками прохождения (lt:done). */
  function storageKey(lesson) { return 'lt-quiz:v' + VERSION + ':' + lesson; }

  function makeStore() {
    var mem = {};
    return {
      get: function (k) {
        if (Object.prototype.hasOwnProperty.call(mem, k)) return mem[k];
        try { return localStorage.getItem(k); } catch (e) { return null; }
      },
      set: function (k, v) {
        mem[k] = v;
        try { localStorage.setItem(k, v); } catch (e) {}
      }
    };
  }

  return {
    VERSION: VERSION, shuffle: shuffle, grade: grade, pct: pct, fmtPct: fmtPct, nextBlock: nextBlock,
    emptyState: emptyState, newAttempt: newAttempt, setAnswer: setAnswer, finish: finish, acknowledge: acknowledge,
    navWarning: navWarning, restore: restore, slug: slug, storageKey: storageKey, makeStore: makeStore, sameSet: sameSet
  };
});
