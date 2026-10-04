/* Общие части интерфейса тестов: карточка вопроса, разбор, итог. Используют quiz.js (урок) и prep.js (подготовка). */
(function () {
  'use strict';
  var Q = window.LTQuiz;
  if (!Q) return;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  /* Текст из банка: экранируем всё, `код` превращаем в <code>. */
  function inline(node, text) {
    String(text).split(/(`[^`]+`)/).forEach(function (part) {
      if (/^`[^`]+`$/.test(part)) node.appendChild(el('code', null, part.slice(1, -1)));
      else if (part) node.appendChild(document.createTextNode(part));
    });
    return node;
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function resultText(r) { return r.correct + ' из ' + r.total + ', ' + Q.fmtPct(r.correct, r.total); }

  var uid = 0;
  /* Карточка вопроса.
     o: {n, total, order, chosen, per (после проверки: {ok, chosen}), reveal (показать ответ без выбора),
         readonly, refHref, refLabel, onChange(ids), label (подпись над вопросом)} */
  function card(q, o) {
    var fs = el('fieldset', 'qz-card');
    var name = 'qz' + (++uid);
    var legend = el('legend', 'qz-q');
    legend.appendChild(el('span', 'qz-n', o.label || ('Вопрос ' + o.n + ' из ' + o.total)));
    legend.appendChild(inline(el('span', 'qz-text'), q.text));
    fs.appendChild(legend);
    if (q.code) {
      var pre = el('pre', 'qz-code');
      pre.appendChild(el('code', null, q.code));
      pre.setAttribute('tabindex', '0');
      pre.setAttribute('aria-label', 'Фрагмент к вопросу');
      fs.appendChild(pre);
    }
    var multi = q.type === 'multiple';
    fs.appendChild(el('p', 'qz-hint', multi ? 'Выбери все правильные ответы' : 'Выбери один ответ'));
    var per = o.per || null, reveal = !!(per || o.reveal);
    var chosen = per ? per.chosen : (o.chosen || []);
    var opts = el('div', 'qz-opts');
    var optMap = {};
    q.options.forEach(function (x) { optMap[x.id] = x; });
    var order = o.order || q.options.map(function (x) { return x.id; });
    order.forEach(function (oid) {
      var opt = optMap[oid];
      if (!opt) return;
      var lab = el('label', 'qz-opt');
      var inp = el('input');
      inp.type = multi ? 'checkbox' : 'radio';
      inp.name = name;
      inp.value = oid;
      inp.checked = chosen.indexOf(oid) !== -1;
      inp.disabled = reveal || !!o.readonly;
      if (o.onChange) inp.addEventListener('change', function () {
        var vals = Array.prototype.filter.call(fs.querySelectorAll('input'), function (x) { return x.checked; })
          .map(function (x) { return x.value; });
        o.onChange(multi ? vals : vals.slice(0, 1));
      });
      lab.appendChild(inp);
      lab.appendChild(inline(el('span', 'qz-otext'), opt.text));
      if (reveal) {
        var isRight = q.correct.indexOf(oid) !== -1, isChosen = chosen.indexOf(oid) !== -1;
        if (isRight) lab.classList.add('is-right');
        if (isChosen && !isRight) lab.classList.add('is-wrong');
        var mark = null;
        if (per && isChosen) mark = isRight ? '✓ твой ответ, верно' : '✗ твой ответ, неверно';
        else if (isRight) mark = '✓ правильный ответ';
        else if (!per) mark = '✗ неверный вариант';
        if (mark) lab.appendChild(el('span', 'qz-mark', mark));
        if (opt.why) lab.appendChild(inline(el('span', 'qz-why'), opt.why));
      }
      opts.appendChild(lab);
    });
    fs.appendChild(opts);
    if (per) {
      fs.classList.add(per.ok ? 'is-pass' : 'is-fail');
      var st = el('p', 'qz-status ' + (per.ok ? 'is-pass' : 'is-fail'),
        per.ok ? '✓ Верно' : (per.chosen.length ? '✗ Неверно' : '✗ Нет ответа: засчитан как неверный'));
      fs.insertBefore(st, legend.nextSibling);
    }
    if (reveal) {
      var ex = el('div', 'qz-explain');
      ex.appendChild(inline(el('p'), q.explain));
      if (q.section && o.refHref) {
        var p = el('p', 'qz-ref');
        p.appendChild(document.createTextNode((o.refLabel || 'Повтори в уроке') + ': '));
        var a = el('a');
        a.href = o.refHref;
        inline(a, q.section);
        p.appendChild(a);
        ex.appendChild(p);
      }
      fs.appendChild(ex);
    }
    return fs;
  }

  function summary(r, passText, failText) {
    var box = el('div', 'qz-result ' + (r.pass ? 'is-pass' : 'is-fail'));
    box.setAttribute('role', 'status');
    box.setAttribute('tabindex', '-1');
    var t = el('p', 'qz-score');
    t.appendChild(el('strong', null, (r.pass ? '✓ Пройдено: ' : '✗ Не пройдено: ') + resultText(r) + '.'));
    box.appendChild(t);
    box.appendChild(el('p', null, r.pass ? passText : failText));
    return box;
  }

  function countText(answered, total) {
    return 'Отвечено ' + answered + ' из ' + total +
      (answered < total ? '. Вопрос без ответа засчитывается как неверный.' : '.');
  }

  window.LTQuizUI = { el: el, inline: inline, plural: plural, resultText: resultText, card: card, summary: summary, countText: countText };
})();
