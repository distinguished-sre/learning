/* Виджеты темы 5 «Docker и учебный стенд»: регистрируются через window.LTViz, имена с префиксом dk-.
   Модели упрощены для объяснения, числа условные, это не измерения учебного сервиса.

   dk-lifecycle: жизнь контейнера и что переживает docker rm (слой контейнера против тома).
     data-title    заголовок (необязательно)
     data-image    имя образа в подсказках (nginx:stable-alpine)
     data-name     имя контейнера (web)
     data-volume   1 или 0: смонтирован ли том в /data при docker run (по умолчанию 1)
   dk-layers: слои образа и кэш сборки.
     data-change   что изменилось: none, app, requirements, base (по умолчанию app)
     data-order    good (COPY requirements до pip, как в «Магазине») или bad (COPY . . до pip)
   dk-startup: порядок запуска сервисов Compose, depends_on и healthcheck.
     data-seed       сколько секунд PostgreSQL заполняет базу при первом запуске (5-90, по умолчанию 30)
     data-condition  1: depends_on с condition: service_healthy, 0: только порядок запуска
   dk-limits: контейнер под нагрузкой против лимитов CPU и памяти.
     data-rps        нагрузка, запросов в секунду (по умолчанию 200)
     data-cpus       лимит CPU, ядер (по умолчанию 1)
     data-mem        лимит памяти, МБ (по умолчанию 512)
     data-leak       1: включена утечка памяти LEAK_ENABLED (по умолчанию 0)
     data-restart    1: у контейнера есть restart-политика (по умолчанию 0) */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, num = L.num, fmt = L.fmt;

  var css = [
    '.dkv-box{border:1px solid var(--line);border-radius:10px;background:var(--bg-2);padding:8px 12px;min-width:0;margin:0 0 8px}',
    '.dkv-box h4{margin:0 0 4px;font:600 13px var(--sans);color:var(--muted);text-transform:none;letter-spacing:0}',
    '.dkv-box.img{border-style:dashed}',
    '.dkv-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.dkv-chip{display:inline-block;padding:2px 10px;border-radius:999px;font:600 13px var(--mono);border:1px solid var(--line);background:var(--bg-code);color:var(--muted)}',
    '.dkv-chip.running{color:var(--green);border-color:var(--green)}',
    '.dkv-chip.exited{color:var(--yellow);border-color:var(--yellow)}',
    '.dkv-chip.none{color:var(--muted)}',
    '.dkv-files{display:flex;flex-wrap:wrap;gap:6px;min-height:28px;margin:4px 0 0}',
    '.dkv-file{padding:2px 8px;border-radius:6px;font:12px var(--mono);background:var(--bg-code);border:1px solid var(--line);overflow-wrap:anywhere}',
    '.dkv-file.vol{border-color:var(--violet);color:var(--violet)}',
    '.dkv-file.lay{border-color:var(--blue);color:var(--blue)}',
    '.dkv-none{margin:0;color:var(--muted);font:13px var(--sans)}',
    '.dkv-term{margin:0;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg-code);font:12.5px/1.5 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;min-height:7.5em;color:var(--text)}',
    '.dkv-term .cmd{color:var(--accent-ink)}.dkv-term .bad{color:var(--red)}',
    '.dkv-svg .lab{font:13px var(--sans);fill:var(--text)}',
    '.dkv-svg .sm{font:12px var(--sans);fill:var(--muted)}',
    '.dkv-svg .c-ok{fill:var(--green)}.dkv-svg .c-bad{fill:var(--red)}.dkv-svg .c-warn{fill:var(--yellow)}',
    '.dkv-svg .c-blue{fill:var(--blue)}.dkv-svg .c-vio{fill:var(--violet)}.dkv-svg .c-mut{fill:var(--line)}',
    '.dkv-svg .s-ok{stroke:var(--green)}.dkv-svg .s-bad{stroke:var(--red)}.dkv-svg .s-blue{stroke:var(--blue)}.dkv-svg .s-vio{stroke:var(--violet)}.dkv-svg .s-warn{stroke:var(--yellow)}',
    '.dkv-svg .ln{fill:none;stroke-width:2.5;stroke-linejoin:round}',
    '.dkv-svg .lim{fill:none;stroke:var(--red);stroke-width:2;stroke-dasharray:6 4}',
    '.dkv-svg .cur{stroke:var(--text);stroke-width:1;stroke-dasharray:3 3;opacity:.6}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('dk-viz-style')) return;
    var s = document.createElement('style'); s.id = 'dk-viz-style'; s.textContent = css; document.head.appendChild(s);
  }
  function svgEl(v, tag, attrs, text) { return v.add(tag, attrs, text); }
  function toggle(v, onText, offText, get, set) {
    var b = v.button('', function () { set(!get()); sync(); });
    function sync() { b.textContent = get() ? onText : offText; }
    sync(); return { sync: sync, btn: b };
  }

  /* ---------- dk-lifecycle ---------- */
  L.widgets['dk-lifecycle'] = function (host) {
    injectStyle();
    var image = host.dataset.image || 'nginx:stable-alpine', name = host.dataset.name || 'web';
    var volOn = host.dataset.volume !== '0';
    var v = L.setup(host, host.dataset.title || 'Жизнь контейнера: что переживает docker rm');
    var st, log;
    function reset() { st = { c: 'none', layer: [], vol: [], mounted: false, n: 0 }; log = []; }
    function say(cmd, out, bad) { log.push({ cmd: cmd, out: out, bad: !!bad }); if (log.length > 4) log.shift(); }

    var imgBox = html('div', undefined, 'dkv-box img'); imgBox.appendChild(html('h4', 'Образ ' + image + ' (только чтение, общий для всех контейнеров)'));
    imgBox.appendChild(html('p', 'Слои с nginx и страницей /usr/share/nginx/html/index.html. Контейнеры его не меняют.', 'dkv-none'));
    var cBox = html('div', undefined, 'dkv-box'); var cHead = html('div', undefined, 'dkv-row');
    cHead.appendChild(html('b', 'Контейнер ' + name)); var chip = html('span', '', 'dkv-chip'); cHead.appendChild(chip); cBox.appendChild(cHead);
    cBox.appendChild(html('h4', 'Слой контейнера: сюда пишет программа, пока не нет тома'));
    var layerEl = html('div', undefined, 'dkv-files'); cBox.appendChild(layerEl);
    var vBox = html('div', undefined, 'dkv-box'); var vHead = html('h4', ''); vBox.appendChild(vHead);
    var volEl = html('div', undefined, 'dkv-files'); vBox.appendChild(volEl);
    var term = html('pre', '', 'dkv-term');
    [imgBox, cBox, vBox, term].forEach(function (n) { v.stage.appendChild(n); });
    var tips = [[imgBox, 'Образ не меняется при работе контейнера: поэтому из одного образа можно запустить сколько угодно одинаковых контейнеров.'],
      [cBox, 'У каждого контейнера свой тонкий слой для записи. Он живёт, пока контейнер не удалён командой docker rm.'],
      [vBox, 'Том (volume) хранит Docker отдельно от контейнера. docker rm его не трогает: новый контейнер подключает тот же том и видит старые файлы.']];
    tips.forEach(function (t) {
      t[0].addEventListener('pointermove', function (e) { v.showTip(t[1], e.clientX, e.clientY); });
      t[0].addEventListener('pointerleave', v.hideTip);
    });

    function files(el, list, cls, empty) {
      el.replaceChildren();
      if (!list.length) { el.appendChild(html('p', empty, 'dkv-none')); return; }
      list.forEach(function (f) { el.appendChild(html('span', f, 'dkv-file ' + cls)); });
    }
    function render() {
      chip.className = 'dkv-chip ' + st.c;
      chip.textContent = st.c === 'running' ? 'Up (работает)' : st.c === 'exited' ? 'Exited (0): остановлен' : 'нет такого контейнера';
      files(layerEl, st.layer, 'lay', st.c === 'none' ? 'слоя нет: контейнера нет' : 'пусто');
      var eff = st.c !== 'none' ? st.mounted : volOn;
      vHead.textContent = 'Том data' + (st.c !== 'none' && st.mounted ? ' (подключён к /data)' : ' (живёт сам по себе)') + (eff ? '' : ': в этом запуске не используется') + (st.c !== 'none' && eff !== volOn ? ' [переключатель сработает при следующем docker run]' : '');
      files(volEl, st.vol, 'vol', eff ? 'пусто' : 'тома нет: всё, что запишешь в /data, попадёт в слой контейнера');
      term.replaceChildren();
      if (!log.length) term.appendChild(document.createTextNode('$ нажимай команды ниже'));
      log.forEach(function (l) {
        var c = html('span', '$ ' + l.cmd + '\n', 'cmd'); term.appendChild(c);
        term.appendChild(html('span', l.out ? l.out + '\n' : '', l.bad ? 'bad' : ''));
      });
      var lost = st.c === 'none' && log.length && log[log.length - 1].cmd.indexOf('docker rm') === 0;
      v.explain(st.c === 'none'
        ? (lost ? 'Контейнер удалён вместе со своим слоем: файлы из /tmp пропали навсегда. ' : 'Контейнера нет, есть только образ. ') + (st.vol.length ? 'Том остался и хранит ' + st.vol.length + ' ' + L.plural(st.vol.length, 'файл', 'файла', 'файлов') + ': следующий <code>docker run -v</code> подключит его.' : 'Тома с данными тоже нет.')
        : st.c === 'running'
          ? 'Контейнер работает. В слое контейнера ' + st.layer.length + ' ' + L.plural(st.layer.length, 'файл', 'файла', 'файлов') + ', в томе ' + st.vol.length + '. Остановить его можно, потерь не будет.'
          : 'Контейнер остановлен, но не удалён: слой цел, <code>docker start</code> вернёт всё как было. Потерять данные можно только командой <code>docker rm</code>.');
    }
    function cmd(kind) {
      var full = '';
      if (kind === 'run') {
        full = 'docker run -d --name ' + name + (volOn ? ' -v data:/data' : '') + ' ' + image;
        if (st.c !== 'none') say(full, 'docker: Conflict. The container name "/' + name + '" is already in use.\nУдали старый контейнер: docker rm ' + name, true);
        else { st.c = 'running'; st.layer = []; st.mounted = volOn; say(full, '3f9a1c7e2b40...  (ID нового контейнера)'); }
      } else if (kind === 'stop') {
        full = 'docker stop ' + name;
        if (st.c !== 'running') say(full, 'контейнер ' + (st.c === 'none' ? 'не найден' : 'уже остановлен'), true);
        else { st.c = 'exited'; say(full, name); }
      } else if (kind === 'start') {
        full = 'docker start ' + name;
        if (st.c !== 'exited') say(full, st.c === 'none' ? 'Error: No such container: ' + name : 'уже работает', true);
        else { st.c = 'running'; say(full, name); }
      } else if (kind === 'rm') {
        full = 'docker rm ' + name;
        if (st.c === 'running') say(full, 'Error response from daemon: cannot remove container "/' + name + '": container is running: stop the container before removing or force remove', true);
        else if (st.c === 'none') say(full, 'Error response from daemon: No such container: ' + name, true);
        else { st.c = 'none'; st.layer = []; say(full, name); }
      } else {
        var path = kind === 'tmp' ? '/tmp' : '/data';
        full = 'docker exec ' + name + ' touch ' + path + '/note' + (st.n + 1);
        if (st.c !== 'running') say(full, 'Error response from daemon: container ' + name + ' is not running', true);
        else {
          st.n++; var f = path + '/note' + st.n;
          if (kind === 'data' && st.mounted) st.vol.push(f); else st.layer.push(f);
          say(full, '');
        }
      }
      render();
    }
    var scenario = ['run', 'tmp', 'data', 'stop', 'start', 'stop', 'rm', 'run'];
    var anim, idx = 0, acc = 0, manual = false;
    [['docker run', 'run'], ['exec: файл в /tmp', 'tmp'], ['exec: файл в /data', 'data'], ['docker stop', 'stop'], ['docker start', 'start'], ['docker rm', 'rm']].forEach(function (b) {
      v.button(b[0], function () { manual = true; cmd(b[1]); });
    });
    toggle(v, 'Том -v data: вкл', 'Том -v data: выкл', function () { return volOn; }, function (x) { manual = true; volOn = x; render(); });
    v.button('Сбросить', function () { manual = true; reset(); render(); });
    v.tryIt('нажми «docker run», запиши файл в /tmp и в /data, затем «docker stop», «docker rm», «docker run». Файл из /tmp исчезнет, файл из /data останется. Выключи том и повтори: пропадёт и он.');
    reset(); render();
    function play() { if (manual) return; reset(); idx = 0; acc = 0; render(); }
    anim = L.animate(v, function (dt) {
      if (manual) return false;
      acc += dt; if (acc < 1.6) return true; acc = 0;
      if (idx >= scenario.length) return false;
      cmd(scenario[idx++]);
      return idx < scenario.length || (acc = -1.2, true);
    }, function () { if (manual) return; reset(); scenario.forEach(function (k) { cmd(k); }); }, play);
  };

  /* ---------- dk-layers ---------- */
  var BASE = [
    { id: 'from', cmd: 'FROM python:3.14.8-slim', sec: 9, mb: 125, why: 'Базовый образ: Debian и Python. Если тег не менялся, Docker берёт его из локального хранилища.' },
    { id: 'work', cmd: 'WORKDIR /app', sec: 0.1, mb: 0, why: 'Создаёт каталог /app и делает его рабочим. Почти бесплатно.' },
    { id: 'req', cmd: 'COPY requirements.txt .', sec: 0.1, mb: 0, why: 'Кладёт в образ один файл со списком библиотек. Слой пересоберётся, только если изменился этот файл.' },
    { id: 'pip', cmd: 'RUN pip install ...', sec: 28, mb: 72, why: 'Скачивает и ставит библиотеки: самая долгая часть сборки.' },
    { id: 'app', cmd: 'COPY app ./app', sec: 0.1, mb: 0.2, why: 'Код магазина. Меняется чаще всего.' },
    { id: 'ent', cmd: 'COPY entrypoint.sh .', sec: 0.1, mb: 0, why: 'Скрипт запуска.' },
    { id: 'chmod', cmd: 'RUN chmod +x entrypoint.sh', sec: 0.3, mb: 0, why: 'Делает скрипт исполняемым.' }
  ];
  var BAD = [
    BASE[0], BASE[1],
    { id: 'all', cmd: 'COPY . .', sec: 0.2, mb: 0.2, why: 'Копирует в образ всё сразу: код, список библиотек и скрипт. Меняется при любой правке.' },
    { id: 'pip', cmd: 'RUN pip install ...', sec: 28, mb: 72, why: 'Те же библиотеки, но слой стоит ПОСЛЕ копирования кода: любая правка кода сбивает кэш и тянет их заново.' },
    BASE[6]
  ];
  var CHANGES = { none: 'ничего', app: 'правка app/main.py', requirements: 'правка requirements.txt', base: 'новый базовый образ' };
  function touches(change, layer) {
    if (change === 'base') return layer.id === 'from';
    if (change === 'requirements') return layer.id === 'req' || layer.id === 'all';
    if (change === 'app') return layer.id === 'app' || layer.id === 'all';
    return false;
  }
  L.widgets['dk-layers'] = function (host) {
    injectStyle();
    var change = CHANGES[host.dataset.change] ? host.dataset.change : 'app', bad = host.dataset.order === 'bad';
    var v = L.setup(host, host.dataset.title || 'Слои образа и кэш при пересборке');
    v.stage.classList.add('dkv-svg');
    var rows, total, shown = 0, hoverRow = -1;
    function plan() {
      var layers = bad ? BAD : BASE, dirty = false;
      rows = layers.map(function (l) {
        dirty = dirty || touches(change, l);
        return { l: l, rebuilt: dirty, t: dirty ? l.sec : 0 };
      });
      total = rows.reduce(function (s, r) { return s + r.t; }, 0);
      var full = layers.reduce(function (s, l) { return s + l.sec; }, 0);
      var first = rows.findIndex(function (r) { return r.rebuilt; });
      var cached = rows.filter(function (r) { return !r.rebuilt; }).length;
      v.explain(change === 'none'
        ? 'Ничего не менялось: все ' + rows.length + ' слоёв берутся из кэша, сборка занимает около секунды. Без кэша было бы ' + fmt(full, 0) + ' с.'
        : 'Изменилось: <b>' + CHANGES[change] + '</b>. Слои выше (' + cached + ') берутся из кэша. Начиная с «' + esc(rows[first].l.cmd) + '» Docker пересобирает всё ниже, потому что каждый слой строится на предыдущем. Итого около ' + fmt(total + 1, 0) + ' с из ' + fmt(full, 0) + '.' +
          (bad && change === 'app' ? ' Из-за порядка <code>COPY . .</code> до <code>pip install</code> правка одной строки кода тянет все библиотеки заново.' : ''));
    }
    function draw() {
      var rowH = 34, top = 28, H = top + rows.length * rowH + ((v.stage.clientWidth || 640) < 420 ? 62 : 40), W = v.canvas(H);
      var narrow = W < 420, labW = Math.min(190, Math.round(W * (narrow ? 0.5 : 0.46))), left = labW + 8, right = W - (narrow ? 62 : 72), full = 30;
      function X(s) { return left + Math.min(s, full) / full * (right - left); }
      svgEl(v, 'text', { x: 0, y: 16, class: 'sm', 'text-anchor': 'start' }, 'Слой Dockerfile');
      svgEl(v, 'text', { x: left, y: 16, class: 'sm', 'text-anchor': 'start' }, narrow ? 'Время, с' : 'Время сборки слоя, с');
      rows.forEach(function (r, i) {
        var y = top + i * rowH, prog = Math.max(0, Math.min(1, shown - i));
        if (i === hoverRow) svgEl(v, 'rect', { x: 0, y: y, width: W, height: rowH - 2, class: 'band', rx: 4 });
        var label = r.l.cmd.length > (narrow ? 20 : 24) && labW < 200 ? r.l.cmd.slice(0, narrow ? 19 : 23) + '…' : r.l.cmd;
        svgEl(v, 'text', { x: 0, y: y + 21, class: 'lab', 'text-anchor': 'start' }, label);
        var done = prog >= 1, w = Math.max(r.rebuilt ? 3 : 2, X(r.t) - left);
        svgEl(v, 'rect', { x: left, y: y + 6, width: r.rebuilt ? Math.max(3, (X(r.t) - left) * prog) : w, height: 20, rx: 4, class: r.rebuilt ? 'c-bad' : 'c-ok', opacity: prog > 0 ? 1 : 0.15 });
        if (prog > 0) svgEl(v, 'text', { x: right + 6, y: y + 21, class: 'sm', 'text-anchor': 'start' }, r.rebuilt ? (r.t < 1 ? '<1 с' : fmt(r.t, 0) + ' с') : (done ? (narrow ? 'кэш' : 'CACHED') : ''));
        if (prog > 0 && !r.rebuilt && W > 420) svgEl(v, 'text', { x: left + 8, y: y + 21, class: 'sm', 'text-anchor': 'start' }, 'кэш');
      });
      var ly = top + rows.length * rowH + 20;
      svgEl(v, 'rect', { x: 0, y: ly - 11, width: 14, height: 14, rx: 3, class: 'c-ok' });
      svgEl(v, 'text', { x: 20, y: ly, class: 'sm', 'text-anchor': 'start' }, 'взят из кэша');
      svgEl(v, 'rect', { x: 120, y: ly - 11, width: 14, height: 14, rx: 3, class: 'c-bad' });
      svgEl(v, 'text', { x: 140, y: ly, class: 'sm', 'text-anchor': 'start' }, 'пересобран');
      svgEl(v, 'text', { x: narrow ? 0 : W, y: narrow ? ly + 20 : ly, class: 'lab', 'text-anchor': narrow ? 'start' : 'end' }, 'Итого: ' + (shown >= rows.length ? fmt(total + 1, 0) : '…') + ' с');
    }
    var go = function () { shown = 0; hoverRow = -1; plan(); draw(); anim.play(); if (anim.reduced) { shown = rows.length; draw(); } };
    Object.keys(CHANGES).forEach(function (k) { v.button(CHANGES[k], function () { change = k; go(); }); });
    toggle(v, 'Порядок: COPY . . до pip', 'Порядок: как в «Магазине»', function () { return bad; }, function (x) { bad = x; go(); });
    v.tryIt('выбери «правка app/main.py» и посмотри, сколько слоёв пересобрано. Затем включи порядок «COPY . . до pip» и повтори ту же правку: время вырастет с 1 до 30 секунд. Наведи на любую строку: увидишь, что делает слой.');
    plan();
    var anim = L.animate(v, function (dt) { shown += dt * 2.2; draw(); return shown < rows.length + 0.5; }, function () { shown = rows.length; draw(); }, function () { shown = 0; draw(); });
    v.hover(function (e, q) {
      var rowH = 34, top = 28, i = Math.floor((q.y - top) / rowH);
      if (i < 0 || i >= rows.length) { hoverRow = -1; draw(); v.hideTip(); return; }
      hoverRow = i; draw();
      var r = rows[i];
      v.showTip('<b>' + esc(r.l.cmd) + '</b><br>' + esc(r.l.why) + '<br>' + (r.rebuilt ? 'Пересобран: ' + (r.t < 1 ? 'меньше секунды' : fmt(r.t, 0) + ' с') : 'Из кэша: вход не изменился и все слои выше тоже') + (r.l.mb ? '<br>Размер слоя: около ' + fmt(r.l.mb, 0) + ' МБ' : ''), e.clientX, e.clientY);
    }, function () { hoverRow = -1; draw(); });
    v.onResize(draw); draw();
  };

  /* ---------- dk-startup ---------- */
  function hc(start, ready) { return start + 5 * Math.max(1, Math.ceil((ready - start) / 5)); }
  function startupModel(seed, cond) {
    var pgReady = seed + 2, pgOk = hc(0, pgReady), redisOk = 5, payOk = 5;
    var rows = [
      { n: 'postgres', segs: [[0, pgReady, 'init'], [pgReady, pgOk, 'starting'], [pgOk, 100, 'healthy']] },
      { n: 'redis', segs: [[0, redisOk, 'starting'], [redisOk, 100, 'healthy']] },
      { n: 'payment', segs: [[0, payOk, 'starting'], [payOk, 100, 'healthy']] }
    ], shop, done, verdict;
    if (cond) {
      var start = Math.max(pgOk, redisOk, payOk), ok = start + 5;
      shop = { n: 'shop', segs: [[0, start, 'wait'], [start, ok, 'starting'], [ok, 100, 'healthy']] };
      done = ok; verdict = 'ok';
    } else {
      var s0 = 1;
      if (pgReady - s0 > 60) {
        shop = { n: 'shop', segs: [[0, s0, 'wait'], [s0, s0 + 61, 'starting'], [s0 + 61, 100, 'dead']] };
        done = null; verdict = 'dead';
      } else {
        var ready = Math.max(s0 + 4, pgReady + 2), ok2 = hc(s0, ready);
        shop = { n: 'shop', segs: [[0, s0, 'wait'], [s0, ok2, 'starting'], [ok2, 100, 'healthy']] };
        done = ok2; verdict = 'lucky';
      }
    }
    rows.push(shop);
    return { rows: rows, pgOk: pgOk, done: done, verdict: verdict, shop: shop };
  }
  var STATE_TXT = { init: 'идёт инициализация базы (схема и сид)', starting: 'запущен, healthcheck ещё не прошёл (starting)', healthy: 'healthy: проверка проходит', wait: 'контейнера ещё нет: Compose ждёт зависимости', dead: 'упал и не перезапускается (Exited 3)' };
  var STATE_CLS = { init: 'c-vio', starting: 'c-warn', healthy: 'c-ok', wait: 'c-mut', dead: 'c-bad' };
  L.widgets['dk-startup'] = function (host) {
    injectStyle();
    var seed = num(host.dataset.seed, 30, 5, 90), cond = host.dataset.condition !== '0';
    var v = L.setup(host, host.dataset.title || 'Запуск стенда: кто кого ждёт');
    var m, t = 0, T = 100, hoverT = null, geo = {};
    function model() {
      m = startupModel(seed, cond);
      var shopS = m.shop.segs;
      if (m.verdict === 'ok') v.explain('PostgreSQL заполняет базу ' + seed + ' с и становится healthy на ' + m.pgOk + '-й секунде (проверка идёт раз в 5 с). Только тогда Compose создаёт <b>shop</b>: он готов на ' + m.done + '-й секунде. Команда <code>up -d --wait</code> вернёт управление именно тогда, без единой ошибки в логах.');
      else if (m.verdict === 'lucky') v.explain('Без <code>condition: service_healthy</code> shop стартует на 1-й секунде и сам ждёт базу: пул соединений повторяет попытки до 60 с. База готова за ' + (seed + 2) + ' с, поэтому всё обошлось и shop healthy на ' + m.done + '-й секунде. Но это везение: на медленном диске сид идёт дольше.');
      else v.explain('Сид занимает ' + seed + ' с, а shop без <code>condition: service_healthy</code> ждёт базу только 60 с. Он падает на ' + shopS[1][1] + '-й секунде с ошибкой запуска, а политики перезапуска нет: <code>docker compose ps</code> покажет <code>Exited (3)</code>, и тест не с чем запускать.');
    }
    function stateAt(row, x) {
      for (var i = 0; i < row.segs.length; i++) if (x >= row.segs[i][0] && x < row.segs[i][1]) return row.segs[i][2];
      return row.segs[row.segs.length - 1][2];
    }
    function draw() {
      var rowH = 38, top = 26, H = top + 4 * rowH + 38, W = v.canvas(H), left = Math.min(78, Math.round(W * 0.2)), right = W - 10;
      function X(x) { return left + x / T * (right - left); }
      geo = { left: left, right: right, top: top, bottom: top + 4 * rowH };
      for (var g = 0; g <= 100; g += 20) {
        svgEl(v, 'line', { x1: X(g), x2: X(g), y1: top - 4, y2: top + 4 * rowH, class: 'grid' });
        svgEl(v, 'text', { x: X(g), y: top + 4 * rowH + 16, class: 'sm', 'text-anchor': g === 0 ? 'start' : g === 100 ? 'end' : 'middle' }, g + ' с');
      }
      m.rows.forEach(function (r, i) {
        var y = top + i * rowH;
        svgEl(v, 'text', { x: 0, y: y + 22, class: 'lab', 'text-anchor': 'start' }, r.n);
        r.segs.forEach(function (s) {
          var a = Math.min(s[0], t), b = Math.min(s[1], t);
          if (b <= a) return;
          svgEl(v, 'rect', { x: X(a), y: y + 6, width: Math.max(1, X(b) - X(a)), height: 22, class: STATE_CLS[s[2]] });
        });
      });
      if (m.done != null && t >= m.done) {
        svgEl(v, 'line', { x1: X(m.done), x2: X(m.done), y1: top - 4, y2: top + 4 * rowH, class: 's-ok ln' });
        svgEl(v, 'text', { x: Math.min(X(m.done) + 4, right - 90), y: top - 8, class: 'sm', 'text-anchor': 'start' }, '--wait вернулся: ' + m.done + ' с');
      }
      var cx = hoverT != null ? hoverT : t;
      svgEl(v, 'line', { x1: X(cx), x2: X(cx), y1: top - 4, y2: top + 4 * rowH, class: 'cur' });
    }
    function legend() {
      var box = html('div', undefined, 'viz-legend'); v.stage.appendChild(box);
      [['init', 'сид базы'], ['starting', 'starting'], ['healthy', 'healthy'], ['wait', 'ждёт'], ['dead', 'упал']].forEach(function (k) {
        var chip = html('span', undefined, 'viz-chip'); var i = html('i'); i.style.background = 'var(--' + ({ init: 'violet', starting: 'yellow', healthy: 'green', wait: 'line', dead: 'red' }[k[0]]) + ')';
        i.style.display = 'inline-block'; i.style.width = '12px'; i.style.height = '12px'; i.style.borderRadius = '3px'; i.style.marginRight = '6px';
        chip.appendChild(i); chip.appendChild(document.createTextNode(k[1])); box.appendChild(chip);
      });
    }
    v.stage.classList.add('dkv-svg');
    v.slider('Сид базы', 5, 90, 5, seed, function (n) { seed = n; go(); }, 'с');
    toggle(v, 'depends_on: service_healthy', 'depends_on: только порядок', function () { return cond; }, function (x) { cond = x; go(); });
    v.tryIt('подвинь «Сид базы» вправо до 70 секунд и выключи service_healthy: shop упадёт, не дождавшись базы. Включи обратно: он подождёт сколько нужно. Наведи на любое место графика: увидишь, что в этот момент делает каждый сервис.');
    var anim;
    function go() { t = 0; model(); draw(); anim.play(); if (anim.reduced) { t = T; draw(); } }
    model();
    anim = L.animate(v, function (dt) { t += dt * 10; draw(); if (t >= T) { t = T; draw(); return false; } return true; }, function () { t = T; draw(); }, function () { t = 0; draw(); });
    v.hover(function (e, q) {
      var x = Math.max(0, Math.min(T, (q.x - geo.left) / (geo.right - geo.left) * T));
      hoverT = x; draw();
      var lines = m.rows.map(function (r) { return '<b>' + r.n + '</b>: ' + STATE_TXT[stateAt(r, x)]; });
      v.showTip('<b>' + fmt(x, 0) + ' с</b><br>' + lines.join('<br>'), e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    legend(); draw(); v.onResize(draw);
  };

  /* ---------- dk-limits ---------- */
  var CPU_COST = 0.006, MEM_BASE = 95, MEM_PER_RPS = 0.2, LEAK_MB_PER_REQ = 0.0098, SPAN = 600;
  function simulate(p) {
    var out = [], alive = true, deadUntil = Infinity, leaked = 0, oomAt = [], cap = Math.max(0, p.cpus - 0.02) / CPU_COST;
    for (var s = 0; s <= SPAN; s++) {
      if (!alive && s >= deadUntil) { alive = true; leaked = 0; }
      if (!alive) { out.push({ t: s, cpu: 0, mem: 0, served: 0, dead: true }); continue; }
      var served = Math.min(p.rps, cap), mem = MEM_BASE + MEM_PER_RPS * served + leaked;
      leaked += p.leak ? served * LEAK_MB_PER_REQ : 0;
      if (mem >= p.mem) { oomAt.push(s); alive = false; deadUntil = p.restart ? s + 10 : Infinity; out.push({ t: s, cpu: 0, mem: p.mem, served: 0, dead: true, oom: true }); continue; }
      out.push({ t: s, cpu: served * CPU_COST + 0.02, mem: mem, served: served, dead: false });
    }
    return { pts: out, oom: oomAt, cap: cap };
  }
  L.widgets['dk-limits'] = function (host) {
    injectStyle();
    var p = { rps: num(host.dataset.rps, 200, 10, 600), cpus: num(host.dataset.cpus, 1, 0.25, 4), mem: num(host.dataset.mem, 512, 128, 1024), leak: host.dataset.leak === '1', restart: host.dataset.restart === '1' };
    var v = L.setup(host, host.dataset.title || 'Контейнер под нагрузкой: лимиты CPU и памяти');
    var sim, t = 0, hoverT = null, geo = {};
    v.stage.classList.add('dkv-svg');
    function describe() {
      var need = p.rps * CPU_COST, lines = [];
      if (p.rps > sim.cap) lines.push('Нагрузка ' + fmt(p.rps, 0) + ' запросов/с требует ' + fmt(need, 2) + ' ядра, лимит ' + fmt(p.cpus, 2) + ': сервис успевает ' + fmt(sim.cap, 0) + ' запросов/с, остальное копится в очереди, задержка растёт. Контейнер при этом жив: CPU только притормаживает, а не убивает.');
      else lines.push('CPU хватает: нужно ' + fmt(need, 2) + ' ядра при лимите ' + fmt(p.cpus, 2) + ', сервис успевает всё.');
      if (sim.oom.length) lines.push('Память упёрлась в лимит ' + fmt(p.mem, 0) + ' МБ на ' + fmt(sim.oom[0] / 60, 1) + ' мин (' + sim.oom[0] + ' с): ядро убило процесс, <code>docker ps -a</code> покажет <code>Exited (137)</code>.' + (p.restart ? ' Из-за restart-политики контейнер поднимается снова, память копится заново: пила.' : ' Политики перезапуска нет, поэтому сервис остался лежать.'));
      else { var peak = sim.pts.reduce(function (a, q) { return Math.max(a, q.mem); }, 0); lines.push('Память за 10 минут не дошла до лимита: пик ' + fmt(peak, 0) + ' МБ из ' + fmt(p.mem, 0) + '.'); }
      v.explain(lines.join(' '));
    }
    function draw() {
      var H = 330, W = v.canvas(H), left = 48, right = W - 12, ph = 110;
      var cpuMax = L.scale(Math.max(p.cpus, p.rps * CPU_COST) * 1.1), memPeak = sim.pts.reduce(function (a, q) { return Math.max(a, q.mem); }, 0);
      var memMax = L.scale(Math.max(p.mem, memPeak) * 1.1);
      geo = { left: left, right: right, y1: 22, y2: 22 + ph, y3: 22 + ph + 48, y4: 22 + 2 * ph + 48 };
      function X(s) { return left + s / SPAN * (right - left); }
      [[geo.y1, geo.y2, cpuMax, 'CPU, ядер', function (q) { return q.cpu; }, p.cpus, 's-blue'],
       [geo.y3, geo.y4, memMax, 'Память, МБ', function (q) { return q.mem; }, p.mem, 's-vio']].forEach(function (pn) {
        var top = pn[0], bot = pn[1], sc = pn[2];
        function Y(val) { return bot - val / sc.max * (bot - top); }
        svgEl(v, 'text', { x: 0, y: top - 8, class: 'lab', 'text-anchor': 'start' }, pn[3]);
        sc.ticks.forEach(function (tk) {
          svgEl(v, 'line', { x1: left, x2: right, y1: Y(tk), y2: Y(tk), class: 'grid' });
          svgEl(v, 'text', { x: left - 6, y: Y(tk) + 4, class: 'sm', 'text-anchor': 'end' }, fmt(tk, sc.max < 5 ? 1 : 0));
        });
        svgEl(v, 'line', { x1: left, x2: right, y1: Y(pn[5]), y2: Y(pn[5]), class: 'lim' });
        svgEl(v, 'text', { x: right, y: Y(pn[5]) - 5, class: 'sm', 'text-anchor': 'end' }, 'лимит ' + fmt(pn[5], pn[5] < 5 ? 2 : 0));
        var d = '';
        sim.pts.forEach(function (q) {
          if (q.t > t) return;
          d += (d ? 'L' : 'M') + X(q.t).toFixed(1) + ' ' + Y(pn[4](q)).toFixed(1) + ' ';
        });
        if (d) svgEl(v, 'path', { d: d, class: 'ln ' + pn[6] });
      });
      sim.oom.forEach(function (s) {
        if (s > t) return;
        svgEl(v, 'text', { x: X(s), y: geo.y3 + 14, class: 'lab c-bad', 'text-anchor': s > SPAN * 0.85 ? 'end' : 'middle' }, '✕ OOM, код 137');
        svgEl(v, 'line', { x1: X(s), x2: X(s), y1: geo.y3, y2: geo.y4, class: 'marker', stroke: 'var(--red)', 'stroke-dasharray': '2 3' });
      });
      for (var g = 0; g <= 600; g += 120) svgEl(v, 'text', { x: X(g), y: geo.y4 + 16, class: 'sm', 'text-anchor': g === 0 ? 'start' : g === 600 ? 'end' : 'middle' }, g / 60 + ' мин');
      var cx = hoverT != null ? hoverT : t;
      svgEl(v, 'line', { x1: X(cx), x2: X(cx), y1: geo.y1, y2: geo.y4, class: 'cur' });
    }
    function go() { t = 0; sim = simulate(p); describe(); draw(); anim.play(); if (anim.reduced) { t = SPAN; draw(); } }
    v.slider('Нагрузка', 20, 600, 10, p.rps, function (n) { p.rps = n; go(); }, 'запр/с');
    v.slider('Лимит CPU', 0.25, 4, 0.25, p.cpus, function (n) { p.cpus = n; go(); }, 'ядер');
    v.slider('Лимит памяти', 128, 1024, 64, p.mem, function (n) { p.mem = n; go(); }, 'МБ');
    toggle(v, 'Утечка памяти: вкл', 'Утечка памяти: выкл', function () { return p.leak; }, function (x) { p.leak = x; go(); });
    toggle(v, 'restart: вкл', 'restart: нет', function () { return p.restart; }, function (x) { p.restart = x; go(); });
    v.tryIt('включи утечку и смотри, на какой минуте память упрётся в лимит. Подними лимит памяти: OOM уйдёт дальше, но не исчезнет, утечку лимит не лечит. Подними нагрузку выше «потолка» CPU: график CPU прижмётся к лимиту, а сервис станет отдавать меньше запросов, чем приходит. Наведи на любое место графика.');
    sim = simulate(p); describe();
    var anim = L.animate(v, function (dt) { t += dt * 60; if (t >= SPAN) { t = SPAN; draw(); return false; } draw(); return true; }, function () { t = SPAN; draw(); }, function () { t = 0; draw(); });
    v.hover(function (e, q) {
      var x = Math.max(0, Math.min(t, (q.x - geo.left) / (geo.right - geo.left) * SPAN)), pt = sim.pts[Math.min(SPAN, Math.round(x))];
      hoverT = x; draw();
      var tx;
      if (pt.dead) tx = pt.oom ? 'Память достигла лимита: процесс убит (OOM-kill, код 137)' : 'Контейнер остановлен или перезапускается';
      else {
        var util = p.rps / Math.max(1, sim.cap);
        tx = 'CPU: ' + fmt(pt.cpu, 2) + ' из ' + fmt(p.cpus, 2) + ' ядра<br>Память: ' + fmt(pt.mem, 0) + ' из ' + fmt(p.mem, 0) + ' МБ<br>Отдаёт: ' + fmt(pt.served, 0) + ' из ' + fmt(p.rps, 0) + ' запр/с' + (util >= 1 ? '<br>Очередь растёт, задержка уходит вверх' : '<br>Задержка около ' + L.ms(12 / (1 - Math.min(util, 0.97))));
      }
      v.showTip('<b>' + L.fmt(x / 60, 1) + ' мин</b><br>' + tx, e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    draw(); v.onResize(draw);
  };
})();
