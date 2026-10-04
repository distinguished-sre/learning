// Тесты логики «Проверь себя» (assets/js/quiz-core.js). Запуск: node --test tools/quiz.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Q = require(path.join(ROOT, 'assets/js/quiz-core.js'));

// детерминированный генератор, чтобы тесты не зависели от удачи
function rng(seed) {
  let x = seed % 2147483647 || 1;
  return () => { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; };
}

function makeBank(n, block = 5) {
  const questions = [];
  for (let i = 1; i <= n; i++) {
    const multi = i % 3 === 0;
    questions.push({
      id: 'q' + String(i).padStart(2, '0'), type: multi ? 'multiple' : 'single',
      options: ['a', 'b', 'c', 'd'].map(id => ({ id, text: id })),
      correct: multi ? ['a', 'c'] : ['b']
    });
  }
  return { lesson: '9.9', block, questions };
}

const allRight = (bank, qids) => Object.fromEntries(qids.map(id => [id, bank.questions.find(q => q.id === id).correct.slice()]));

test('порог 60% по точному значению: 3/5 и 6/10 пройдено, 2/5 и 5/10 нет', () => {
  const b5 = makeBank(5), b10 = makeBank(10);
  const answers = (bank, k) => Object.fromEntries(bank.questions.slice(0, k).map(q => [q.id, q.correct]));
  assert.equal(Q.grade(b5.questions, answers(b5, 3)).pass, true);
  assert.equal(Q.grade(b5.questions, answers(b5, 2)).pass, false);
  assert.equal(Q.grade(b10.questions, answers(b10, 6)).pass, true);
  assert.equal(Q.grade(b10.questions, answers(b10, 5)).pass, false);
  assert.equal(Q.fmtPct(3, 5), '60%');
  assert.equal(Q.fmtPct(2, 3), '66,7%');
  // 59,9...% не округляется вверх до прохода
  const b2000 = makeBank(2000);
  assert.equal(Q.grade(b2000.questions, answers(b2000, 1199)).pass, false);
  assert.equal(Q.grade(b2000.questions, answers(b2000, 1200)).pass, true);
});

test('multiple: только точное совпадение, частичных баллов нет', () => {
  const q = makeBank(3).questions[2]; // multiple, правильные a и c
  assert.equal(q.type, 'multiple');
  const g = a => Q.grade([q], { [q.id]: a }).correct;
  assert.equal(g(['a', 'c']), 1);
  assert.equal(g(['c', 'a']), 1);
  assert.equal(g(['a']), 0);
  assert.equal(g(['a', 'c', 'd']), 0);
  assert.equal(g(['a', 'b', 'c', 'd']), 0);
});

test('неотвеченный вопрос неверен и входит в знаменатель', () => {
  const b = makeBank(5);
  const r = Q.grade(b.questions, { q01: ['b'], q02: ['b'], q03: [] });
  assert.equal(r.total, 5);
  assert.equal(r.correct, 2);
  assert.equal(r.pass, false);
  assert.equal(r.per.find(p => p.id === 'q04').ok, false);
  assert.equal(r.per.find(p => p.id === 'q03').ok, false);
});

test('нет повторов до исчерпания банка, затем новый цикл без немедленного повтора', () => {
  for (const [n, block] of [[25, 5], [30, 5], [30, 10], [40, 10], [50, 10]]) {
    const bank = makeBank(n, block);
    let s = Q.emptyState(), seen = new Set();
    const rand = rng(n * 7 + block);
    for (let k = 0; k < n / block; k++) {
      s = Q.newAttempt(s, bank, rand);
      assert.equal(s.current.qids.length, block);
      for (const id of s.current.qids) { assert.ok(!seen.has(id), `повтор ${id} до исчерпания`); seen.add(id); }
      assert.equal(s.cycle, 1);
    }
    assert.equal(seen.size, n);
    const prev = s.current.qids;
    s = Q.newAttempt(s, bank, rand);
    assert.equal(s.cycle, 2);
    assert.equal(s.current.qids.filter(id => prev.includes(id)).length, 0, 'первый блок нового цикла повторил прошлый');
    // второй цикл тоже проходит банк без повторов
    const seen2 = new Set(s.current.qids);
    for (let k = 1; k < n / block; k++) {
      s = Q.newAttempt(s, bank, rand);
      for (const id of s.current.qids) { assert.ok(!seen2.has(id)); seen2.add(id); }
    }
    assert.equal(seen2.size, n);
  }
});

test('банк не делится на блок: добор в новом цикле без дублей внутри блока', () => {
  const bank = makeBank(12, 5);
  let s = Q.emptyState();
  const rand = rng(3);
  for (let k = 0; k < 10; k++) {
    s = Q.newAttempt(s, bank, rand);
    assert.equal(new Set(s.current.qids).size, 5);
  }
});

test('банк не делится на блок: соседние блоки не пересекаются', () => {
  for (const [n, block, seed] of [[12, 5, 1], [12, 5, 7], [30, 7, 2], [30, 7, 9], [26, 10, 4]]) {
    const bank = makeBank(n, block);
    let s = Q.emptyState();
    const rand = rng(seed);
    let prev = [];
    for (let k = 0; k < 20; k++) {
      s = Q.newAttempt(s, bank, rand);
      const cur = s.current.qids;
      assert.equal(cur.filter(id => prev.includes(id)).length, 0, `банк ${n}, блок ${block}, попытка ${k + 1}`);
      prev = cur;
    }
  }
});

test('прерванная попытка считается использованной', () => {
  const bank = makeBank(25);
  let s = Q.newAttempt(Q.emptyState(), bank, rng(1));
  const first = s.current.qids;
  s = Q.setAnswer(s, first[0], ['b']);
  s = Q.newAttempt(s, bank, rng(2)); // «Новая попытка» без проверки
  assert.equal(s.current.qids.filter(id => first.includes(id)).length, 0);
  assert.equal(s.attemptNo, 2);
});

test('перемешивание вариантов не меняет правильный ответ', () => {
  const bank = makeBank(30);
  let s = Q.emptyState();
  for (let k = 0; k < 6; k++) {
    s = Q.newAttempt(s, bank, rng(100 + k));
    for (const id of s.current.qids) {
      assert.deepEqual([...s.current.order[id]].sort(), ['a', 'b', 'c', 'd']);
    }
    let t = s;
    for (const [id, a] of Object.entries(allRight(bank, s.current.qids))) t = Q.setAnswer(t, id, a);
    t = Q.finish(t, bank);
    assert.equal(t.current.result.correct, 5);
  }
});

test('восстановление незавершённой попытки и ответов после перезагрузки', () => {
  const bank = makeBank(30);
  let s = Q.newAttempt(Q.emptyState(), bank, rng(5));
  const [a, b] = s.current.qids;
  s = Q.setAnswer(s, a, ['b', 'a']);
  s = Q.setAnswer(s, b, ['c']);
  const r = Q.restore(JSON.stringify(s), bank);
  assert.deepEqual(r.current.qids, s.current.qids);
  assert.deepEqual(r.current.order, s.current.order);
  assert.equal(r.current.finished, false);
  // single обрезается до одного ответа
  const qa = bank.questions.find(q => q.id === a);
  assert.equal(r.current.answers[a].length, qa.type === 'single' ? 1 : 2);
  assert.deepEqual(r.current.answers[b], ['c']);
  assert.deepEqual(r.used, s.used);
});

test('завершённая попытка заморожена', () => {
  const bank = makeBank(25);
  let s = Q.newAttempt(Q.emptyState(), bank, rng(9));
  s = Q.finish(s, bank);
  const frozen = JSON.stringify(s.current);
  const s2 = Q.setAnswer(s, s.current.qids[0], ['b']);
  assert.equal(JSON.stringify(s2.current), frozen);
  assert.equal(Q.finish(s2, bank), s2);
  const r = Q.restore(JSON.stringify(s), bank);
  assert.equal(r.current.finished, true);
  assert.equal(r.current.result.correct, 0);
  assert.equal(r.current.result.total, 5);
});

test('битая завершённая попытка: без падения, начинается новая, прогресс цел', () => {
  const bank = makeBank(25);
  let s = Q.newAttempt(Q.emptyState(), bank, rng(4));
  s = Q.finish(s, bank);
  s.passedEver = true;
  const broken = [
    { correct: 0, total: 5, pass: false, per: {} },
    { correct: 0, total: 5, pass: false, per: [null] },
    { correct: 0, total: 5, pass: false, per: [{ id: 'q01' }] },
    { correct: '0', total: 5, pass: false, per: [] },
    { correct: 7, total: 5, pass: true, per: [] },
    null
  ];
  for (const result of broken) {
    const raw = JSON.parse(JSON.stringify(s));
    raw.current.result = result;
    const r = Q.restore(JSON.stringify(raw), bank);
    assert.equal(r.current, null, JSON.stringify(result));
    assert.equal(r.passedEver, true);
    assert.deepEqual(r.used, s.used);
    const n = Q.newAttempt(r, bank, rng(5));
    assert.equal(n.current.finished, false);
    assert.equal(n.current.qids.length, 5);
  }
});

test('обновление банка: удалённые ID не ломают загрузку, новые не сбрасывают прогресс', () => {
  const bank = makeBank(30);
  let s = Q.emptyState();
  const rand = rng(11);
  s = Q.newAttempt(s, bank, rand);
  s = Q.finish(s, bank);
  s = Q.newAttempt(s, bank, rand);
  const cur = s.current.qids;
  s = Q.setAnswer(s, cur[1], ['b']);
  // удаляем один вопрос текущего блока и один вариант у другого, добавляем новый вопрос
  const removed = cur[0];
  const changed = bank.questions.find(q => q.id === cur[2]);
  const nb = JSON.parse(JSON.stringify(bank));
  nb.questions = nb.questions.filter(q => q.id !== removed);
  const cq = nb.questions.find(q => q.id === changed.id);
  cq.options = cq.options.filter(o => o.id !== 'd').concat([{ id: 'e', text: 'e' }]);
  nb.questions.push({ id: 'q99', type: 'single', options: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }, { id: 'c', text: 'c' }, { id: 'd', text: 'd' }], correct: ['a'] });
  const r = Q.restore(JSON.stringify(s), nb);
  assert.equal(r.attemptNo, 2);
  assert.ok(r.last && r.last.total === 5);
  assert.ok(!r.current.qids.includes(removed));
  assert.equal(r.current.qids.length, 4);
  assert.deepEqual(r.current.answers[cur[1]], ['b']);
  assert.deepEqual([...r.current.order[cq.id]].sort(), ['a', 'b', 'c', 'e']);
  assert.ok(!r.used.includes(removed));
  // новый вопрос выдаётся до конца текущего цикла (остаток цикла добирается в блок, который его закрывает)
  let t = r, seen = new Set();
  while (t.cycle === r.cycle) { t = Q.newAttempt(t, nb, rand); t.current.qids.forEach(id => seen.add(id)); }
  assert.ok(seen.has('q99'));
  // мусор и старая версия не ломают загрузку
  assert.deepEqual(Q.restore('{не json', nb), Q.emptyState());
  assert.deepEqual(Q.restore(JSON.stringify({ v: 0 }), nb), Q.emptyState());
  assert.deepEqual(Q.restore(null, nb), Q.emptyState());
});

test('предупреждение перед переходом никогда не блокирует и показывается один раз', () => {
  const bank = makeBank(25);
  let s = Q.newAttempt(Q.emptyState(), bank, rng(4));
  assert.deepEqual(Q.navWarning(s), { kind: 'untaken' });
  let ack = Q.acknowledge(s);
  assert.equal(Q.navWarning(ack), null, 'после «ОК, продолжить» в этой попытке окно не показывается');
  // провал
  s = Q.setAnswer(s, s.current.qids[0], bank.questions.find(q => q.id === s.current.qids[0]).correct);
  s = Q.finish(s, bank);
  assert.deepEqual(Q.navWarning(s), { kind: 'fail', correct: 1, total: 5 });
  s = Q.acknowledge(s);
  assert.equal(Q.navWarning(s), null);
  // новая попытка: снова предупреждаем
  s = Q.newAttempt(s, bank, rng(5));
  assert.deepEqual(Q.navWarning(s), { kind: 'untaken' });
  // прошёл
  for (const [id, a] of Object.entries(allRight(bank, s.current.qids))) s = Q.setAnswer(s, id, a);
  s = Q.finish(s, bank);
  assert.equal(Q.navWarning(s), null);
  // однажды пройденный урок больше не предупреждает
  s = Q.newAttempt(s, bank, rng(6));
  assert.equal(Q.navWarning(s), null);
});

test('ключи хранилища: свои, не пересекаются с прогрессом и подготовкой', () => {
  assert.equal(Q.storageKey('5.3'), 'lt-quiz:v1:5.3');
  assert.notEqual(Q.storageKey('prep'), Q.storageKey('5.3'));
  assert.ok(!Q.storageKey('5.3').startsWith('lt:'));
  const prep = readFileSync(path.join(ROOT, 'assets/js/prep.js'), 'utf8');
  assert.match(prep, /storageKey\('prep'\)/);
  assert.equal((prep.match(/storageKey\(/g) || []).length, 1, 'prep.js пишет только в свой ключ');
  assert.ok(!/lt:done/.test(prep));
  const quiz = readFileSync(path.join(ROOT, 'assets/js/quiz.js'), 'utf8');
  assert.ok(!/lt:done/.test(quiz), 'тест урока не трогает отметки прохождения');
});

test('хранилище без localStorage работает в рамках вкладки', () => {
  const st = Q.makeStore();
  st.set('lt-quiz:v1:x', '1');
  assert.equal(st.get('lt-quiz:v1:x'), '1');
  assert.equal(st.get('lt-quiz:v1:y'), null);
});

test('хранилище: вкладка читает то, что записала другая, а не свою старую копию', () => {
  const data = {};
  const fake = { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  try {
    const tab1 = Q.makeStore(), tab2 = Q.makeStore();
    tab1.set('lt-quiz:v1:x', 'старое');
    tab2.set('lt-quiz:v1:x', 'новое');
    assert.equal(tab1.get('lt-quiz:v1:x'), 'новое');
    // запись не принята (переполнено): вкладка помнит своё в памяти
    fake.setItem = () => { throw new Error('QuotaExceededError'); };
    tab1.set('lt-quiz:v1:x', 'только в памяти');
    assert.equal(tab1.get('lt-quiz:v1:x'), 'только в памяти');
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
  }
});

test('slug совпадает с якорями kramdown GFM', () => {
  assert.equal(Q.slug('Пул соединений: зачем и сколько'), 'пул-соединений-зачем-и-сколько');
  assert.equal(Q.slug('Что такое `p95` и почему не среднее?'), 'что-такое-p95-и-почему-не-среднее');
  assert.equal(Q.slug('HTTP-коды 4xx и 5xx'), 'http-коды-4xx-и-5xx');
  assert.equal(Q.slug('Ёлка «Магазина»'), 'ёлка-магазина');
});

// настоящие банки: правильный ответ находится при любом перемешивании, все блоки собираются
const QDIR = path.join(ROOT, '_data/questions/quiz');
const banks = existsSync(QDIR) ? readdirSync(QDIR).filter(f => f.endsWith('.json')) : [];
test('настоящие банки: блоки, перемешивание и оценка', { skip: banks.length === 0 && 'банков нет' }, () => {
  for (const f of banks) {
    const bank = JSON.parse(readFileSync(path.join(QDIR, f), 'utf8'));
    let s = Q.emptyState();
    const rand = rng(f.length * 31 + bank.questions.length);
    const cycles = bank.questions.length / bank.block;
    const seen = new Set();
    for (let k = 0; k < cycles; k++) {
      s = Q.newAttempt(s, bank, rand);
      s.current.qids.forEach(id => seen.add(id));
      for (const [id, a] of Object.entries(allRight(bank, s.current.qids))) s = Q.setAnswer(s, id, [...a].reverse());
      s = Q.finish(s, bank);
      assert.equal(s.current.result.correct, bank.block, f);
    }
    assert.equal(seen.size, bank.questions.length, f + ': банк проходится за целое число блоков');
  }
});
