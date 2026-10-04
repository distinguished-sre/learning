/* Страница «Подготовка к собеседованию»: все вопросы курса из единой базы.
   Данные по темам: assets/questions/topic-NN.json (собирает Jekyll из _data/questions).
   История проверки своя (lt-quiz:v1:prep) и не тратит вопросы тестов в уроках. */
(function () {
  'use strict';
  var Q = window.LTQuiz, UI = window.LTQuizUI;
  var root = document.querySelector('[data-prep]');
  if (!Q || !UI || !root) return;
  var el = UI.el;
  var course;
  try { course = JSON.parse(root.querySelector('[data-prep-course]').textContent); } catch (e) { return; }
  var base = root.getAttribute('data-base');
  var store = Q.makeStore();
  var KEY = Q.storageKey('prep');
  var PAGE = 20;

  var ps = load();
  function load() {
    var s = null;
    try { s = JSON.parse(store.get(KEY) || 'null'); } catch (e) {}
    var d = { v: Q.VERSION, mode: 'open', topic: '1', lesson: '', level: '', hot: false, hideKnown: false, order: 'random', size: 5, known: {}, cycles: {}, cur: null };
    if (!s || s.v !== Q.VERSION) return d;
    Object.keys(d).forEach(function (k) { if (s[k] !== undefined && typeof s[k] === typeof d[k] || (k === 'cur' && s.cur)) d[k] = s[k]; });
    /* устаревшая или битая запись не должна ломать страницу */
    if (d.topic !== 'all' && !course.some(function (t) { return String(t.n) === d.topic; })) { d.topic = '1'; d.lesson = ''; }
    var c = d.cur;
    if (c && (typeof c !== 'object' || !Array.isArray(c.qids) || !c.order || typeof c.order !== 'object' ||
        !c.answers || typeof c.answers !== 'object' || typeof c.topic !== 'string')) d.cur = null;
    if (c && d.cur && c.finished && !(c.result && Array.isArray(c.result.per))) d.cur = null;
    if (['open', 'study', 'check'].indexOf(d.mode) === -1) d.mode = 'open';
    if (['random', 'lesson'].indexOf(d.order) === -1) d.order = 'random';
    if (!(d.size >= 5 && d.size <= 10) || d.size % 1) d.size = 5;
    return d;
  }
  function save() { store.set(KEY, JSON.stringify(ps)); }

  /* ---------- данные ---------- */
  var cache = {};
  function topicData(n) {
    if (!cache[n]) {
      cache[n] = fetch(base + 'topic-' + (n < 10 ? '0' : '') + n + '.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .catch(function (e) { delete cache[n]; throw e; });
    }
    return cache[n];
  }
  function scopeTopics() {
    return ps.topic === 'all' ? course.map(function (t) { return t.n; }) : [Number(ps.topic)];
  }
  function lessonsInScope() {
    return Promise.all(scopeTopics().map(topicData)).then(function (list) {
      var out = [];
      list.forEach(function (t) {
        t.lessons.forEach(function (l) { if (!ps.lesson || ps.lesson === l.id) out.push(l); });
      });
      return out;
    });
  }

  function norm(s) { return String(s).toLowerCase().replace(/ё/g, 'е').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }
  function matches(hay, words) { return words.every(function (w) { return hay.indexOf(w) !== -1; }); }
  function searchWords() { return norm(search.value).trim().split(' ').filter(Boolean); }

  /* ---------- каркас ---------- */
  root.textContent = '';
  var modes = el('div', 'prep-modes');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Режим');
  var MODES = [['open', 'Устные вопросы'], ['study', 'Тесты: изучение'], ['check', 'Тесты: проверка']];
  var modeBtns = MODES.map(function (m) {
    var b = el('button', 'btn', m[1]);
    b.type = 'button';
    b.addEventListener('click', function () { ps.mode = m[0]; save(); sync(); refresh(); });
    modes.appendChild(b);
    return b;
  });
  root.appendChild(modes);

  var filters = el('div', 'prep-filters');
  function field(label, ctl, cls) {
    var w = el('label', 'prep-field' + (cls ? ' ' + cls : ''));
    w.appendChild(el('span', null, label));
    w.appendChild(ctl);
    filters.appendChild(w);
    return w;
  }
  var topicSel = el('select');
  topicSel.appendChild(new Option('Все темы', 'all'));
  course.forEach(function (t) { topicSel.appendChild(new Option(t.n + '. ' + t.title, String(t.n))); });
  field('Тема', topicSel);
  var lessonSel = el('select');
  field('Урок', lessonSel);
  var search = el('input');
  search.type = 'search';
  search.placeholder = 'слово из вопроса или ответа';
  search.setAttribute('autocomplete', 'off');
  var searchF = field('Поиск', search, 'wide');
  var levelSel = el('select');
  [['', 'любой'], ['junior', 'junior'], ['middle', 'middle']].forEach(function (o) { levelSel.appendChild(new Option(o[1], o[0])); });
  var levelF = field('Уровень', levelSel);
  var orderSel = el('select');
  [['random', 'вперемешку'], ['lesson', 'по урокам']].forEach(function (o) { orderSel.appendChild(new Option(o[1], o[0])); });
  var orderF = field('Порядок', orderSel);
  var sizeSel = el('select');
  for (var i = 5; i <= 10; i++) sizeSel.appendChild(new Option(String(i), String(i)));
  var sizeF = field('Вопросов в блоке', sizeSel);
  function check(label) {
    var w = el('label', 'prep-check');
    var c = el('input');
    c.type = 'checkbox';
    w.appendChild(c);
    w.appendChild(document.createTextNode(' ' + label));
    filters.appendChild(w);
    return c;
  }
  var hotChk = check('только «часто спрашивают»');
  var knownChk = check('скрыть отмеченные «знаю»');
  root.appendChild(filters);

  var actions = el('div', 'prep-actions');
  var shuffleBtn = el('button', 'btn', 'Перемешать');
  shuffleBtn.type = 'button';
  var mockBtn = el('button', 'btn', 'Пробное собеседование: 10 вопросов');
  mockBtn.type = 'button';
  var startBtn = el('button', 'btn primary', 'Начать проверку');
  startBtn.type = 'button';
  [shuffleBtn, mockBtn, startBtn].forEach(function (b) { actions.appendChild(b); });
  root.appendChild(actions);

  var count = el('p', 'prep-count');
  count.setAttribute('aria-live', 'polite');
  root.appendChild(count);
  var list = el('div', 'prep-list');
  root.appendChild(list);
  var more = el('button', 'btn prep-more', 'Показать ещё');
  more.type = 'button';
  root.appendChild(more);

  function fillLessons() {
    lessonSel.textContent = '';
    lessonSel.appendChild(new Option(ps.topic === 'all' ? 'все уроки курса' : 'все уроки темы', ''));
    if (ps.topic !== 'all') {
      var t = course.filter(function (x) { return String(x.n) === ps.topic; })[0];
      (t ? t.lessons : []).forEach(function (l) { lessonSel.appendChild(new Option(l.id + ' ' + l.title, l.id)); });
    }
    lessonSel.disabled = ps.topic === 'all';
    if (ps.topic === 'all') ps.lesson = '';
    lessonSel.value = ps.lesson;
  }

  function sync() {
    modeBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', MODES[i][0] === ps.mode ? 'true' : 'false'); });
    topicSel.value = ps.topic;
    fillLessons();
    levelSel.value = ps.level;
    orderSel.value = ps.order;
    sizeSel.value = String(ps.size);
    hotChk.checked = ps.hot;
    knownChk.checked = ps.hideKnown;
    var open = ps.mode === 'open', chk = ps.mode === 'check';
    searchF.hidden = chk;
    levelF.hidden = !open;
    orderF.hidden = chk;
    hotChk.parentNode.hidden = !open;
    knownChk.parentNode.hidden = !open;
    sizeF.hidden = !chk;
    shuffleBtn.hidden = !open && ps.mode !== 'study';
    mockBtn.hidden = !open;
    startBtn.hidden = !chk;
  }

  topicSel.addEventListener('change', function () { ps.topic = topicSel.value; ps.lesson = ''; save(); sync(); refresh(); });
  lessonSel.addEventListener('change', function () { ps.lesson = lessonSel.value; save(); refresh(); });
  levelSel.addEventListener('change', function () { ps.level = levelSel.value; save(); refresh(); });
  orderSel.addEventListener('change', function () { ps.order = orderSel.value; save(); refresh(); });
  sizeSel.addEventListener('change', function () { ps.size = Number(sizeSel.value); save(); });
  hotChk.addEventListener('change', function () { ps.hot = hotChk.checked; save(); refresh(); });
  knownChk.addEventListener('change', function () { ps.hideKnown = knownChk.checked; save(); refresh(); });
  var timer = null;
  search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(refresh, 200); });
  shuffleBtn.addEventListener('click', function () { seed = Math.random(); refresh(); });
  mockBtn.addEventListener('click', function () { mock = true; refresh(); });
  startBtn.addEventListener('click', startCheck);

  /* ---------- список ---------- */
  var seed = Math.random(), mock = false, items = [], shown = 0, groupCounts = {}, lastGroup = null, token = 0;

  function seeded(s) {
    var x = Math.floor(s * 2147483646) + 1;
    return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; };
  }

  function refresh() {
    var my = ++token;
    list.textContent = '';
    more.hidden = true;
    if (ps.mode === 'check') { renderCheck(); return; }
    count.textContent = 'Загружаю вопросы…';
    lessonsInScope().then(function (lessons) {
      if (my !== token) return;
      var words = searchWords();
      items = [];
      lessons.forEach(function (l) {
        if (ps.mode === 'open') {
          l.open.forEach(function (q) {
            if (ps.level && q.tags.indexOf(ps.level) === -1) return;
            if (ps.hot && q.tags.indexOf('часто') === -1) return;
            if (ps.hideKnown && ps.known[q.id]) return;
            if (words.length) {
              if (!q._s) q._s = norm(q.q + ' ' + q.a);
              if (!matches(q._s, words)) return;
            }
            items.push({ l: l, q: q });
          });
        } else {
          l.quiz.forEach(function (q) {
            if (words.length) {
              if (!q._s) q._s = norm(q.text + ' ' + (q.code || '') + ' ' + q.options.map(function (o) { return o.text; }).join(' ') + ' ' + q.explain);
              if (!matches(q._s, words)) return;
            }
            items.push({ l: l, q: q });
          });
        }
      });
      groupCounts = {};
      items.forEach(function (it) { groupCounts[it.l.id] = (groupCounts[it.l.id] || 0) + 1; });
      if (ps.order === 'random') items = Q.shuffle(items, seeded(seed));
      var total = items.length, nLessons = Object.keys(groupCounts).length;
      if (mock && ps.mode === 'open') {
        var pos = new Map(items.map(function (it, k) { return [it, k]; }));
        items = Q.shuffle(items).slice(0, 10);
        /* по урокам: случайные 10, но в порядке курса, чтобы заголовки уроков не повторялись */
        if (ps.order === 'lesson') items.sort(function (x, y) { return pos.get(x) - pos.get(y); });
        mock = false;
        renderMockHead(total);
      }
      count.textContent = total
        ? 'Найдено: ' + total + ' ' + UI.plural(total, 'вопрос', 'вопроса', 'вопросов') + ' в ' + nLessons + ' ' + UI.plural(nLessons, 'уроке', 'уроках', 'уроках') + '.'
        : 'Ничего не найдено. Измени тему, урок или слова поиска.';
      shown = 0;
      lastGroup = null;
      page();
    }).catch(function () {
      if (my !== token) return;
      count.textContent = 'Не удалось загрузить вопросы. Проверь соединение и обнови страницу.';
    });
  }

  function renderMockHead(total) {
    var box = el('div', 'prep-mock');
    box.appendChild(el('p', null, 'Пробное собеседование: 10 случайных вопросов из ' + total + '. На каждый ответь вслух за 1–2 минуты, потом открой ответ и сравни с «что хотят услышать».'));
    var back = el('button', 'btn', 'Вернуться ко всем вопросам');
    back.type = 'button';
    back.addEventListener('click', refresh);
    box.appendChild(back);
    list.appendChild(box);
  }

  function page() {
    var end = Math.min(items.length, shown + PAGE);
    var firstNew = null;
    for (var i = shown; i < end; i++) {
      var it = items[i];
      if (ps.order === 'lesson' && it.l.id !== lastGroup) {
        lastGroup = it.l.id;
        var h = el('h2', 'prep-group');
        var a = el('a', null, 'Урок ' + it.l.id + '. ' + it.l.title);
        a.href = it.l.url;
        h.appendChild(a);
        h.appendChild(el('span', 'prep-gcount', ' · ' + groupCounts[it.l.id] + ' ' + UI.plural(groupCounts[it.l.id], 'вопрос', 'вопроса', 'вопросов')));
        list.appendChild(h);
      }
      var c = ps.mode === 'open' ? openCard(it, i) : studyCard(it, i);
      if (!firstNew) firstNew = c;
      list.appendChild(c);
    }
    var prev = shown;
    shown = end;
    var left = items.length - shown;
    more.hidden = left <= 0;
    more.textContent = 'Показать ещё (осталось ' + left + ')';
    return prev > 0 ? firstNew : null;
  }
  more.addEventListener('click', function () {
    var first = page();
    if (first) { var f = first.querySelector('button, input, a'); if (f) f.focus(); }
  });

  function lessonLink(l, hash) {
    var a = el('a', 'prep-lesson', 'Урок ' + l.id + ': ' + l.title);
    a.href = l.url + (hash || '');
    return a;
  }

  function fixLinks(box, l) {
    var abs = new URL(l.url, location.href);
    Array.prototype.forEach.call(box.querySelectorAll('a[href]'), function (a) {
      var h = a.getAttribute('href');
      if (/^[a-z][a-z0-9+.-]*:|^\//i.test(h)) return;
      a.href = new URL(h, abs).href;
    });
  }

  var cid = 0;
  function openCard(it, i) {
    var q = it.q, l = it.l;
    var card = el('article', 'qcard prep-card');
    var meta = el('p', 'prep-meta');
    q.tags.forEach(function (t) {
      var cls = t === 'часто' ? 'tag-hot' : t === 'на скорость' ? 'tag-speed' : 'tag-' + t;
      meta.appendChild(el('span', 'tag ' + cls, t === 'часто' ? 'часто спрашивают' : t));
    });
    meta.appendChild(el('span', 'prep-num', (ps.order === 'random' ? (i + 1) + '. ' : '') + 'Урок ' + l.id));
    card.appendChild(meta);
    var h = el('h3', 'prep-q');
    h.innerHTML = q.q;
    card.appendChild(h);
    var btn = el('button', 'btn', 'Показать ответ');
    btn.type = 'button';
    var ans = el('div', 'prep-ans');
    ans.id = 'prep-a' + (++cid);
    ans.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', ans.id);
    btn.addEventListener('click', function () {
      if (!ans.firstChild) { ans.innerHTML = q.a; fixLinks(ans, l); }
      ans.hidden = !ans.hidden;
      btn.setAttribute('aria-expanded', ans.hidden ? 'false' : 'true');
      btn.textContent = ans.hidden ? 'Показать ответ' : 'Скрыть ответ';
    });
    var foot = el('div', 'prep-foot');
    foot.appendChild(btn);
    var known = el('button', 'btn', ps.known[q.id] ? '✓ Знаю' : 'Знаю');
    known.type = 'button';
    known.setAttribute('aria-pressed', ps.known[q.id] ? 'true' : 'false');
    known.addEventListener('click', function () {
      if (ps.known[q.id]) delete ps.known[q.id]; else ps.known[q.id] = 1;
      save();
      known.setAttribute('aria-pressed', ps.known[q.id] ? 'true' : 'false');
      known.textContent = ps.known[q.id] ? '✓ Знаю' : 'Знаю';
    });
    foot.appendChild(known);
    foot.appendChild(lessonLink(l, '#вопросы-с-собеседований'));
    card.appendChild(foot);
    card.appendChild(ans);
    return card;
  }

  function studyCard(it, i) {
    var q = it.q, l = it.l, chosen = [];
    var wrap = el('div', 'prep-study');
    var label = (ps.order === 'random' ? (i + 1) + '. ' : '') + 'Урок ' + l.id + ' · ' + (q.type === 'multiple' ? 'несколько ответов' : 'один ответ');
    function draw(reveal) {
      wrap.textContent = '';
      var per = null;
      if (reveal && chosen.length) per = { ok: Q.sameSet(chosen, q.correct), chosen: chosen };
      wrap.appendChild(UI.card(q, {
        label: label, chosen: chosen, reveal: reveal, per: per,
        refHref: l.url + '#' + Q.slug(q.section), refLabel: 'Раздел урока ' + l.id,
        onChange: reveal ? null : function (ids) { chosen = ids; }
      }));
      var b = el('button', 'btn', reveal ? 'Скрыть ответ' : 'Показать ответ');
      b.type = 'button';
      b.setAttribute('aria-expanded', reveal ? 'true' : 'false');
      b.addEventListener('click', function () { if (reveal) chosen = []; draw(!reveal); wrap.querySelector('.prep-study > .btn').focus(); });
      wrap.appendChild(b);
    }
    draw(false);
    return wrap;
  }

  /* ---------- проверка случайным блоком ---------- */
  function scopeKey() { return ps.topic === 'all' ? 'all' : ps.lesson ? 'l' + ps.lesson : 't' + ps.topic; }

  function startCheck() {
    var my = ++token;
    count.textContent = 'Загружаю вопросы…';
    lessonsInScope().then(function (lessons) {
      if (my !== token) return;
      var ids = [];
      lessons.forEach(function (l) { l.quiz.forEach(function (q) { ids.push(q.id); }); });
      if (!ids.length) { count.textContent = 'В выбранной теме нет тестовых вопросов.'; return; }
      var key = scopeKey();
      var cyc = ps.cycles[key] || { used: [], cycle: 1, prev: [] };
      var nb = Q.nextBlock(ids, ps.size, cyc.used, cyc.cycle, cyc.prev);
      ps.cycles[key] = { used: nb.used, cycle: nb.cycle, prev: nb.qids };
      var order = {};
      var byId = indexQuiz(lessons);
      nb.qids.forEach(function (id) { order[id] = Q.shuffle(byId[id].q.options.map(function (o) { return o.id; })); });
      ps.cur = { scope: key, topic: ps.topic, lesson: ps.lesson, qids: nb.qids, order: order, answers: {}, finished: false, result: null };
      save();
      renderCheck(true);
    }).catch(function () { count.textContent = 'Не удалось загрузить вопросы. Проверь соединение и обнови страницу.'; });
  }

  function indexQuiz(lessons) {
    var m = {};
    lessons.forEach(function (l) { l.quiz.forEach(function (q) { m[q.id] = { q: q, l: l }; }); });
    return m;
  }

  function renderCheck(focus) {
    var my = ++token;
    list.textContent = '';
    more.hidden = true;
    var cur = ps.cur;
    if (!cur) {
      count.textContent = 'Выбери тему или урок и размер блока, потом нажми «Начать проверку». Ответы и разбор появятся после проверки.';
      return;
    }
    count.textContent = 'Загружаю вопросы…';
    var topics = cur.topic === 'all' ? course.map(function (t) { return t.n; }) : [Number(cur.topic)];
    Promise.all(topics.map(topicData)).then(function (data) {
      if (my !== token) return;
      var lessons = [];
      data.forEach(function (t) { lessons = lessons.concat(t.lessons); });
      var byId = indexQuiz(lessons);
      cur.qids = cur.qids.filter(function (id) { return byId[id]; });
      /* банк обновился: удалённые варианты убираем, новые добавляем в конец */
      cur.qids.forEach(function (id) {
        var ids = byId[id].q.options.map(function (o) { return o.id; });
        var kept = (cur.order[id] || []).filter(function (x) { return ids.indexOf(x) !== -1; });
        cur.order[id] = kept.concat(ids.filter(function (x) { return kept.indexOf(x) === -1; }));
        if (cur.answers[id]) cur.answers[id] = cur.answers[id].filter(function (x) { return ids.indexOf(x) !== -1; });
      });
      if (!cur.qids.length) { ps.cur = null; save(); renderCheck(); return; }
      var scopeName = cur.topic === 'all' ? 'весь курс' : cur.lesson ? 'урок ' + cur.lesson : 'тема ' + cur.topic;
      count.textContent = 'Блок из ' + cur.qids.length + ' ' + UI.plural(cur.qids.length, 'вопроса', 'вопросов', 'вопросов') + ': ' + scopeName + '.';
      var form = el('form', 'qz-form');
      form.setAttribute('novalidate', '');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var g = Q.grade(cur.qids.map(function (id) { return byId[id].q; }), cur.answers);
        cur.finished = true;
        cur.result = { correct: g.correct, total: g.total, pass: g.pass, per: g.per };
        save();
        renderCheck();
        var box = list.querySelector('.qz-result');
        if (box) { box.scrollIntoView({ block: 'center' }); box.focus({ preventScroll: true }); }
      });
      cur.qids.forEach(function (id, i) {
        var it = byId[id];
        var per = cur.finished ? cur.result.per.filter(function (p) { return p.id === id; })[0] : null;
        form.appendChild(UI.card(it.q, {
          n: i + 1, total: cur.qids.length, label: 'Вопрос ' + (i + 1) + ' из ' + cur.qids.length + ' · урок ' + it.l.id,
          order: cur.order[id], chosen: cur.answers[id] || [], per: per,
          refHref: it.l.url + '#' + Q.slug(it.q.section), refLabel: 'Раздел урока ' + it.l.id,
          onChange: cur.finished ? null : function (ids) {
            cur.answers[id] = ids;
            save();
            var cnt = list.querySelector('.qz-count');
            if (cnt) cnt.textContent = UI.countText(answered(), cur.qids.length);
          }
        }));
      });
      function answered() { return cur.qids.filter(function (id) { return (cur.answers[id] || []).length; }).length; }
      var foot = el('div', 'qz-foot');
      if (!cur.finished) {
        var cnt = el('p', 'qz-count', UI.countText(answered(), cur.qids.length));
        cnt.setAttribute('aria-live', 'polite');
        foot.appendChild(cnt);
        var b = el('button', 'btn primary', 'Проверить ответы');
        b.type = 'submit';
        foot.appendChild(b);
      } else {
        foot.appendChild(UI.summary(cur.result, 'Порог 60% набран. Ниже разбор каждого вопроса.',
          'Порог 60% не набран. Разбери ошибки по ссылкам на разделы уроков и попробуй новый блок.'));
      }
      var again = el('button', 'btn', 'Новый блок');
      again.type = 'button';
      again.addEventListener('click', startCheck);
      foot.appendChild(again);
      form.appendChild(foot);
      list.appendChild(form);
      if (focus) { var f = form.querySelector('input'); if (f) f.focus(); }
    }).catch(function () { count.textContent = 'Не удалось загрузить вопросы. Проверь соединение и обнови страницу.'; });
  }

  sync();
  refresh();
})();
