/* Виджеты темы 4 «Python для тестировщика»: регистрируются через window.LTViz.
   Имена с префиксом py-. Новые виджеты темы дописывай В КОНЕЦ файла, перед последней
   строкой «})();», в том же стиле: один блок на виджет, стили в общем <style> ниже.

   py-trace: пошаговое выполнение кода. Все данные лежат в разметке, интерпретатора в
   браузере нет: шаги заранее посчитаны (tools или скрипт sys.settrace) и записаны в JSON.
     data-title    заголовок (необязательно)
     data-code     JSON-массив строк кода, нумерация с 1
     data-steps    JSON-массив шагов {"l": номер строки, "v": {"имя": "repr значения"},
                   "o": "что печатает этот шаг" (необязательно), "n": "пояснение" (необязательно),
                   "f": "имя функции, где мы сейчас" (необязательно)}; "v" полный снимок
                   переменных ПОСЛЕ выполнения строки, значения записаны как их печатает repr()
     data-speed    мс на шаг при автопоказе (по умолчанию 1800)
     data-try      строка «Попробуй: ...» (необязательно)
   py-index: как читаются список и словарь.
     data-mode     list (по умолчанию) или dict
     data-name     имя переменной в выражении (times, response)
     data-items    list: JSON-массив чисел или строк; dict: JSON-объект {"ключ": значение}
     data-index    list: стартовый индекс; data-start, data-stop: стартовый срез
     data-missing  dict: ключ, которого нет в словаре (показывает KeyError) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, json = L.json;

  /* ---------- общие стили ---------- */
  var css = [
    '.pyv-wrap{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;max-width:100%}',
    '.pyv-code{flex:2 1 300px;min-width:0;margin:0;border:1px solid var(--line);border-radius:10px;background:var(--bg-code);overflow-x:auto;padding:6px 0;font:13px/1.65 var(--mono);font-variant-ligatures:none}',
    '.pyv-line{display:flex;white-space:pre-wrap;overflow-wrap:anywhere;padding:0 10px 0 0;border-left:3px solid transparent;cursor:default}',
    '.pyv-line>span:last-child{min-width:0;flex:1 1 auto}',
    '.pyv-line .no{flex:none;width:2.6em;text-align:right;padding-right:.9em;color:var(--muted);user-select:none}',
    '.pyv-line.cur{background:color-mix(in srgb,var(--accent-ink) 18%,transparent);border-left-color:var(--accent-ink)}',
    '.pyv-line.done{opacity:.62}',
    '.pyv-line .k{color:var(--accent-ink)}.pyv-line .s{color:var(--green)}.pyv-line .d{color:var(--blue)}.pyv-line .c{color:var(--muted);font-style:italic}.pyv-line .b{color:var(--violet)}',
    '.pyv-mem{flex:1 1 230px;min-width:0;display:flex;flex-direction:column;gap:10px}',
    '.pyv-box{border:1px solid var(--line);border-radius:10px;background:var(--bg-2);padding:8px 10px;min-width:0}',
    '.pyv-box h4{margin:0 0 6px;font:600 12px var(--mono);color:var(--muted);text-transform:none;letter-spacing:0}',
    '.pyv-var{display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;padding:3px 6px;border-radius:6px;font:13px/1.4 var(--mono);border:1px solid transparent}',
    '.pyv-var b{color:var(--text)}.pyv-var .t{color:var(--muted);font-size:11px}.pyv-var .val{color:var(--accent-ink);overflow-wrap:anywhere;min-width:0}',
    '.pyv-var.new{background:color-mix(in srgb,var(--yellow) 22%,transparent);border-color:var(--yellow)}',
    '.pyv-empty{color:var(--muted);font:13px var(--sans);margin:0}',
    '.pyv-out{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 var(--mono);color:var(--text);min-height:1.5em}',
    '.pyv-frame{font:600 12px var(--mono);color:var(--violet);margin:0 0 6px}',
    '.pyv-note{margin:8px 0 0;font:14px/1.5 var(--sans);color:var(--text)}',
    '.pyv-cells{display:flex;flex-wrap:wrap;gap:26px 6px;padding:20px 4px 22px}',
    '.pyv-cell{position:relative;min-width:54px;max-width:100%;overflow-wrap:anywhere;padding:9px 8px;text-align:center;border:1px solid var(--line);border-radius:8px;background:var(--bg-code);font:600 14px var(--mono);cursor:default}',
    '.pyv-cell .ix{position:absolute;left:0;right:0;top:-17px;font:11px var(--mono);color:var(--muted)}',
    '.pyv-cell .nx{position:absolute;left:0;right:0;bottom:-18px;font:11px var(--mono);color:var(--muted)}',
    '.pyv-cell.pick{border-color:var(--accent-ink);background:color-mix(in srgb,var(--accent-ink) 22%,var(--bg-code))}',
    '.pyv-cell.cut{border-color:var(--blue);background:color-mix(in srgb,var(--blue) 22%,var(--bg-code))}',
    '.pyv-cell.pick.cut{box-shadow:0 0 0 2px var(--accent-ink)}',
    '.pyv-rows{display:flex;flex-direction:column;gap:5px;padding:4px 0}',
    '.pyv-row{display:flex;flex-wrap:wrap;border:1px solid var(--line);border-radius:8px;background:var(--bg-code);font:600 14px var(--mono);overflow:hidden;cursor:default}',
    '.pyv-row .kk{flex:1 1 110px;padding:7px 10px;color:var(--violet);background:var(--bg-2);overflow-wrap:anywhere}',
    '.pyv-row .vv{flex:2 1 120px;padding:7px 10px;overflow-wrap:anywhere}',
    '.pyv-row.pick{border-color:var(--accent-ink);background:color-mix(in srgb,var(--accent-ink) 22%,var(--bg-code))}',
    '.pyv-expr{margin:0 0 6px;font:14px/1.6 var(--mono);overflow-wrap:anywhere}',
    '.pyv-expr .r{color:var(--accent-ink);font-weight:700}.pyv-expr .e{color:var(--red);font-weight:700}',
    '.pyv-keys{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}',
    '.pyv-keys button{font:600 13px var(--mono);padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg-2);color:var(--text);cursor:pointer}',
    '.pyv-keys button.on{border-color:var(--accent-ink);color:var(--accent-ink)}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('py-viz-style')) return;
    var s = document.createElement('style'); s.id = 'py-viz-style'; s.textContent = css; document.head.appendChild(s);
  }

  /* Подсветка Python: комментарии, строки, числа, ключевые слова, встроенные функции. */
  var tokenRe = /(#.*$)|([fFrR]?(?:'[^']*'|"[^"]*"))|(\b\d+(?:\.\d+)?\b)|(\b(?:if|elif|else|for|while|in|not|and|or|is|def|return|import|from|as|try|except|finally|raise|with|break|continue|pass|class|lambda|True|False|None)\b)|(\b(?:print|len|range|sum|min|max|sorted|int|float|str|bool|list|dict|open|enumerate|round|type|abs)\b(?=\())/g;
  function colorize(line) {
    var out = '', last = 0, m;
    tokenRe.lastIndex = 0;
    while ((m = tokenRe.exec(line))) {
      out += esc(line.slice(last, m.index));
      var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'd' : m[4] ? 'k' : 'b';
      out += '<span class="' + cls + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(line.slice(last));
  }
  /* Тип по тому, как значение напечатал бы repr(). */
  function typeOf(r) {
    r = String(r).trim();
    if (/^-?\d+$/.test(r)) return 'int';
    if (/^-?\d+\.\d*(e[+-]?\d+)?$/i.test(r) || /^-?\d+e[+-]?\d+$/i.test(r) || r === 'inf' || r === 'nan') return 'float';
    if (r === 'True' || r === 'False') return 'bool';
    if (r === 'None') return 'NoneType';
    if (/^[bfBF]?(['"])/.test(r)) return 'str';
    if (r[0] === '[') return 'list';
    if (r[0] === '{') return r.indexOf(':') < 0 && r.length > 2 ? 'set' : 'dict';
    if (r[0] === '(') return 'tuple';
    return 'object';
  }

  /* ---------- py-trace ---------- */
  L.widgets['py-trace'] = function (host) {
    injectStyle();
    var code = json(host.dataset.code, null), steps = json(host.dataset.steps, null);
    if (!Array.isArray(code) || !code.length || code.length > 40) throw new Error('data-code: JSON-массив из 1-40 строк кода.');
    if (!Array.isArray(steps) || !steps.length || steps.length > 80 || !steps.every(function (s) { return s && s.l >= 1 && s.l <= code.length; }))
      throw new Error('data-steps: JSON-массив из 1-80 шагов {"l": номер строки, "v": {...}}.');
    var speed = num(host.dataset.speed, 1800, 400, 6000);
    var v = L.setup(host, host.dataset.title || 'Выполнение кода по шагам');
    var wrap = html('div', undefined, 'pyv-wrap'); v.stage.appendChild(wrap);
    var pre = html('div', undefined, 'pyv-code'); wrap.appendChild(pre);
    var lines = code.map(function (text, i) {
      var el = html('div', undefined, 'pyv-line');
      el.appendChild(html('span', String(i + 1), 'no'));
      var body = html('span'); body.innerHTML = colorize(text); el.appendChild(body); pre.appendChild(el);
      el.addEventListener('pointermove', function (e) {
        var which = []; steps.forEach(function (s, k) { if (s.l === i + 1) which.push(k + 1); });
        v.showTip('Строка ' + (i + 1) + (which.length ? ': выполняется на ' + L.plural(which.length, 'шаге', 'шагах', 'шагах') + ' ' + which.join(', ') : ': в показе не выполняется'), e.clientX, e.clientY);
      });
      el.addEventListener('pointerleave', v.hideTip);
      return el;
    });
    var mem = html('div', undefined, 'pyv-mem'); wrap.appendChild(mem);
    var frameP = html('p', '', 'pyv-frame'); frameP.hidden = true;
    var varsBox = html('div', undefined, 'pyv-box'); varsBox.appendChild(html('h4', 'Переменные (память)'));
    var varsList = html('div'); varsBox.appendChild(varsList);
    var outBox = html('div', undefined, 'pyv-box'); outBox.appendChild(html('h4', 'Вывод на экран'));
    var outPre = html('pre', '', 'pyv-out'); outBox.appendChild(outPre);
    mem.appendChild(varsBox); mem.appendChild(outBox);
    varsBox.insertBefore(frameP, varsList);

    var cur = 0, slider, handle, acc = 0, auto = false;
    function snapshot(i) { return i < 0 ? {} : steps[i].v || {}; }
    function draw() {
      var s = steps[cur], now = snapshot(cur), before = snapshot(cur - 1);
      lines.forEach(function (el, i) { el.classList.toggle('cur', i + 1 === s.l); });
      // «Сделано»: строки, которые уже выполнялись раньше.
      var seen = {}; for (var k = 0; k < cur; k++) seen[steps[k].l] = 1;
      lines.forEach(function (el, i) { el.classList.toggle('done', !!seen[i + 1] && i + 1 !== s.l); });
      var names = Object.keys(now);
      varsList.replaceChildren();
      if (!names.length) varsList.appendChild(html('p', 'Пока пусто: ни одной переменной не создано.', 'pyv-empty'));
      names.forEach(function (name) {
        var changed = !(name in before) || before[name] !== now[name];
        var row = html('div', undefined, 'pyv-var' + (changed ? ' new' : ''));
        row.appendChild(html('b', name)); row.appendChild(html('span', typeOf(now[name]), 't')); row.appendChild(html('span', now[name], 'val'));
        row.addEventListener('pointermove', function (e) {
          v.showTip('<b>' + esc(name) + '</b> = ' + esc(now[name]) + '<br>тип: ' + typeOf(now[name]) + (!(name in before) ? '<br>создана на этом шаге' : before[name] !== now[name] ? '<br>была: ' + esc(before[name]) : '<br>не менялась'), e.clientX, e.clientY);
        });
        row.addEventListener('pointerleave', v.hideTip);
        varsList.appendChild(row);
      });
      var printed = []; for (var j = 0; j <= cur; j++) if (steps[j].o) printed.push(steps[j].o);
      outPre.textContent = printed.join('\n');
      frameP.hidden = !s.f; frameP.textContent = s.f ? 'Мы внутри: ' + s.f : '';
      v.status.textContent = 'Шаг ' + (cur + 1) + ' из ' + steps.length + ', строка ' + s.l;
      v.explain('<b>Строка ' + s.l + '.</b> ' + (s.n ? esc(s.n).replace(/`([^`]+)`/g, '<code>$1</code>') : 'Python выполняет эту строку.'));
      if (slider) { slider.value = cur + 1; slider.dispatchEvent(new Event('input')); }
    }
    function go(i) { cur = Math.max(0, Math.min(steps.length - 1, i)); acc = 0; draw(); }
    function manual(fn) { return function () { if (handle) handle.pause(); fn(); }; }
    v.button('⏮ Сначала', manual(function () { go(0); }));
    v.button('◀ Назад', manual(function () { go(cur - 1); }));
    v.button('Шаг ▶', manual(function () { go(cur + 1); }));
    slider = v.slider('Шаг', 1, steps.length, 1, 1, function (n) { if (!auto && n - 1 !== cur) { if (handle) handle.pause(); go(n - 1); } });
    v.tryIt(host.dataset.try ? esc(host.dataset.try) : 'нажимай «Шаг ▶» и «◀ Назад» или двигай ползунок: смотри, как меняется правая колонка. Наведи на переменную или строку кода: появится подсказка.');
    handle = L.animate(v, function (dt) {
      acc += dt * 1000;
      if (acc < speed) return true;
      acc = 0;
      if (cur >= steps.length - 1) return false;
      auto = true; go(cur + 1); auto = false;
      return true;
    }, function () { go(steps.length - 1); }, function () { go(0); });
    go(0);
  };

  /* ---------- py-index ---------- */
  L.widgets['py-index'] = function (host) {
    injectStyle();
    var mode = host.dataset.mode === 'dict' ? 'dict' : 'list';
    var name = esc(host.dataset.name || (mode === 'dict' ? 'response' : 'times'));
    var items = json(host.dataset.items, null);
    if (mode === 'list' && !(Array.isArray(items) && items.length >= 2 && items.length <= 12)) throw new Error('data-items: JSON-массив из 2-12 значений.');
    if (mode === 'dict' && !(items && typeof items === 'object' && !Array.isArray(items) && Object.keys(items).length >= 2)) throw new Error('data-items: JSON-объект с 2 и более ключами.');
    var v = L.setup(host, host.dataset.title || (mode === 'dict' ? 'Как читается словарь' : 'Как читается список: индексы и срезы'));
    var box = html('div', undefined, 'pyv-box'); v.stage.appendChild(box);
    var expr = html('p', undefined, 'pyv-expr'); box.appendChild(expr);
    function repr(x) { return typeof x === 'string' ? "'" + x + "'" : JSON.stringify(x); }
    var handle;

    if (mode === 'list') {
      var n = items.length, idx = Math.round(num(host.dataset.index, 0, -n - 1, n)), a = Math.round(num(host.dataset.start, 1, 0, n)), b = Math.round(num(host.dataset.stop, Math.min(n, 3), 0, n));
      var cells = html('div', undefined, 'pyv-cells'); box.appendChild(cells);
      var cellEls = items.map(function (x, i) {
        var c = html('div', repr(x), 'pyv-cell');
        c.appendChild(html('span', String(i), 'ix')); c.appendChild(html('span', String(i - n), 'nx'));
        c.addEventListener('pointermove', function (e) { v.showTip('<code>' + name + '[' + i + ']</code> и <code>' + name + '[' + (i - n) + ']</code> дают ' + esc(repr(x)), e.clientX, e.clientY); });
        c.addEventListener('pointerleave', v.hideTip);
        cells.appendChild(c); return c;
      });
      var draw = function () {
        var ok = idx >= -n && idx < n, real = idx < 0 ? idx + n : idx;
        cellEls.forEach(function (c, i) { c.classList.toggle('pick', ok && i === real); c.classList.toggle('cut', i >= a && i < b); });
        var sl = items.slice(a, b);
        expr.innerHTML = '<code>' + name + '[' + idx + ']</code> &rarr; ' + (ok ? '<span class="r">' + esc(repr(items[real])) + '</span>' : '<span class="e">IndexError: list index out of range</span>') +
          '<br><code>' + name + '[' + a + ':' + b + ']</code> &rarr; <span class="r">' + esc('[' + sl.map(repr).join(', ') + ']') + '</span>';
        v.explain(ok
          ? 'В списке из ' + n + ' элементов индекс <b>' + idx + '</b> указывает на ' + (idx < 0 ? 'элемент с конца: <code>' + idx + '</code> то же, что <code>' + real + '</code>' : 'элемент номер ' + idx + ' (счёт с нуля)') + '. Срез <code>[' + a + ':' + b + ']</code> берёт элементы от номера ' + a + ' до номера ' + b + ', сам номер ' + b + ' в срез не входит: получилось ' + sl.length + ' ' + L.plural(sl.length, 'элемент', 'элемента', 'элементов') + '.'
          : 'Индекс <b>' + idx + '</b> вышел за границы: допустимы номера от 0 до ' + (n - 1) + ' и от -1 до -' + n + '. Python останавливает программу с <code>IndexError</code>. Срез при этом не падает: <code>[' + a + ':' + b + ']</code> просто вернул ' + sl.length + ' ' + L.plural(sl.length, 'элемент', 'элемента', 'элементов') + '.');
      };
      var iSl = v.slider('Индекс i', -n - 1, n, 1, idx, function (x) { idx = x; draw(); });
      var aSl = v.slider('Срез: начало', 0, n, 1, a, function (x) { a = x; draw(); });
      var bSl = v.slider('Срез: конец', 0, n, 1, b, function (x) { b = x; draw(); });
      [iSl, aSl, bSl].forEach(function (s) { s.addEventListener('pointerdown', function () { if (handle) handle.pause(); }); s.addEventListener('keydown', function () { if (handle) handle.pause(); }); });
      draw();
      v.tryIt('подвигай индекс до края и за край, потом задай конец среза меньше начала. Наведи на ячейку: увидишь оба её номера.');
      var t = 0, acc = 0, order = []; for (var q = 0; q < n; q++) order.push(q); order.push(-1, n);
      handle = L.animate(v, function (dt) {
        acc += dt;
        if (acc < 1.3) return true;
        acc = 0; if (t >= order.length) return false;
        idx = order[t++]; iSl.value = idx; iSl.dispatchEvent(new Event('input')); return true;
      }, draw, function () { t = 0; });
    } else {
      var keys = Object.keys(items), missing = host.dataset.missing || 'discount', sel = keys[0];
      var rows = html('div', undefined, 'pyv-rows'); box.appendChild(rows);
      var rowEls = {};
      keys.forEach(function (k) {
        var r = html('div', undefined, 'pyv-row'); r.appendChild(html('span', repr(k), 'kk')); r.appendChild(html('span', repr(items[k]), 'vv'));
        r.addEventListener('pointermove', function (e) { v.showTip('Ключ ' + esc(repr(k)) + ' ведёт к значению ' + esc(repr(items[k])), e.clientX, e.clientY); });
        r.addEventListener('pointerleave', v.hideTip);
        rows.appendChild(r); rowEls[k] = r;
      });
      var keyBox = html('div', undefined, 'pyv-keys'); box.appendChild(keyBox);
      var btns = {};
      keys.concat([missing]).forEach(function (k) {
        var bt = html('button', name + '[' + repr(k) + ']'); bt.type = 'button';
        bt.addEventListener('click', function () { if (handle) handle.pause(); pick(k); });
        keyBox.appendChild(bt); btns[k] = bt;
      });
      var pick = function (k) {
        sel = k; var ok = Object.prototype.hasOwnProperty.call(items, k);
        keys.forEach(function (x) { rowEls[x].classList.toggle('pick', ok && x === k); });
        Object.keys(btns).forEach(function (x) { btns[x].classList.toggle('on', x === k); });
        expr.innerHTML = '<code>' + name + '[' + esc(repr(k)) + ']</code> &rarr; ' + (ok ? '<span class="r">' + esc(repr(items[k])) + '</span>' : '<span class="e">KeyError: ' + esc(repr(k)) + '</span>') +
          '<br><code>' + name + '.get(' + esc(repr(k)) + ')</code> &rarr; <span class="r">' + (ok ? esc(repr(items[k])) : 'None') + '</span>';
        v.explain(ok ? 'Словарь ищет не номер, а <b>ключ</b>: нашёл ' + esc(repr(k)) + ' и вернул значение ' + esc(repr(items[k])) + '. Порядок строк на результат не влияет.'
          : 'Ключа ' + esc(repr(k)) + ' в словаре нет. Квадратные скобки в этом случае останавливают программу с <code>KeyError</code>, а <code>.get()</code> спокойно возвращает <code>None</code> (или значение по умолчанию, если передать второй аргумент).');
      };
      v.tryIt('нажимай на выражения и сравни квадратные скобки с <code>.get()</code>, особенно для ключа, которого нет.');
      pick(sel);
      var ti = 0, tacc = 0, seq = keys.concat([missing]);
      handle = L.animate(v, function (dt) {
        tacc += dt; if (tacc < 1.6) return true; tacc = 0;
        if (ti >= seq.length) return false; pick(seq[ti++]); return true;
      }, function () { pick(sel); }, function () { ti = 0; });
    }
  };
})();
