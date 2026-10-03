/* Учебные виджеты: без библиотек, цвета задаёт style.scss.
   Модели упрощены для объяснения, это не измерения учебного сервиса.
   Каждый виджет сразу показывает живой пример со значениями из data-атрибутов,
   а под ним простыми словами объясняет, что происходит сейчас.
   SVG рисуется в пикселях ширины блока: текст всегда того же размера, что и в уроке. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var motion = matchMedia('(prefers-reduced-motion: reduce)');
  var palette = ['primary', 'response', 'violet', 'warning', 'danger', 'ok'];

  function node(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { n.setAttribute(key, attrs[key]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function html(tag, text, cls) {
    var n = document.createElement(tag); if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls; return n;
  }
  function num(value, fallback, min, max) {
    var v = Number(value); return value == null || value === '' || !Number.isFinite(v) ? fallback : Math.max(min, Math.min(max, v));
  }
  function list(value, fallback) { return (value || fallback).split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function json(value, fallback) { try { return JSON.parse(value); } catch (e) { return fallback; } }
  function fmt(n, digits) { return Number(n.toFixed(digits == null ? 1 : digits)).toLocaleString('ru-RU'); }
  function ms(n) { return fmt(n, n >= 100 ? 0 : 1) + ' мс'; }
  function sec(n) { return n >= 60 ? Math.floor(n / 60) + ' мин ' + Math.round(n % 60) + ' с' : fmt(n, n >= 10 ? 0 : 1) + ' с'; }
  function pct(n) { return Math.round(n * 100) + '%'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plural(n, one, few, many) {
    var a = Math.abs(Math.round(n)) % 100, b = a % 10;
    return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
  }
  function niceMax(n) {
    if (!(n > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(n))), f = n / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  // Круглые деления оси: 0, 250, 500… или 0, 1, 2… для целых (пользователи).
  function scale(max, whole) {
    if (!(max > 0)) max = 1;
    var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    if (whole) step = Math.max(1, Math.round(step));
    var ticks = []; for (var t = 0; t <= max + step * 0.999; t += step) ticks.push(+t.toFixed(6));
    return { max: ticks[ticks.length - 1], ticks: ticks };
  }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* Каркас: заголовок, сцена (SVG или HTML) с подсказкой, ползунки, кнопки,
     блок «Что сейчас происходит» и строка «Попробуй». */
  function setup(host, title) {
    host.replaceChildren();
    host.appendChild(html('p', title, 'viz-title'));
    var stage = html('div', undefined, 'viz-stage'); host.appendChild(stage);
    var tip = html('div', undefined, 'viz-tip'); tip.hidden = true; tip.setAttribute('aria-hidden', 'true'); stage.appendChild(tip);
    var status = html('p', '', 'viz-status'); host.appendChild(status);
    var sliders = html('div', undefined, 'viz-controls'); host.appendChild(sliders);
    var buttons = html('div', undefined, 'viz-buttons'); host.appendChild(buttons);
    var box = html('div', undefined, 'viz-explain'); box.hidden = true;
    box.appendChild(html('p', 'Что сейчас происходит', 'viz-explain-head'));
    var now = html('div', undefined, 'viz-now'); now.setAttribute('aria-live', 'polite'); box.appendChild(now);
    var hint = html('p', '', 'viz-try'); hint.hidden = true; box.appendChild(hint);
    host.appendChild(box);
    var svg = null, width = 0;
    function canvas(height) {
      if (!svg) { svg = node('svg', { class: 'viz-svg', role: 'img', 'aria-label': title }); stage.insertBefore(svg, tip); }
      width = Math.max(280, Math.round(stage.clientWidth || 640));
      svg.replaceChildren(); svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      svg.setAttribute('width', width); svg.setAttribute('height', height);
      return width;
    }
    function add(tag, attrs, text) { var n = node(tag, attrs, text); svg.appendChild(n); return n; }
    function label(x, y, text, cls, anchor) { return add('text', { x: x, y: y, class: cls || '', 'text-anchor': anchor || 'middle' }, text); }
    function button(text, fn) {
      var b = html('button', text); b.type = 'button'; b.addEventListener('click', fn); buttons.appendChild(b); return b;
    }
    function slider(text, min, max, step, value, fn, unit) {
      var l = html('label'), name = html('span', text + ': '), out = html('output');
      var input = html('input');
      function show(n) { out.textContent = fmt(n, step < 1 ? 2 : 0) + (unit ? ' ' + unit : ''); input.style.setProperty('--p', ((n - min) / (max - min) * 100).toFixed(1) + '%'); }
      name.appendChild(out); l.appendChild(name);
      input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value; show(value);
      input.setAttribute('aria-label', text); l.appendChild(input); sliders.appendChild(l);
      input.addEventListener('input', function () { show(+input.value); fn(+input.value); });
      return input;
    }
    function explain(text) { now.innerHTML = text; box.hidden = !text && hint.hidden; }
    function tryIt(text) { hint.innerHTML = text ? '<b>Попробуй:</b> ' + text : ''; hint.hidden = !text; box.hidden = !now.innerHTML && !text; }
    function showTip(text, clientX, clientY) {
      var r = stage.getBoundingClientRect(); tip.innerHTML = text; tip.hidden = false;
      var x = clientX - r.left + 14, y = clientY - r.top + 16;
      if (x + tip.offsetWidth > r.width) x = Math.max(0, clientX - r.left - tip.offsetWidth - 14);
      if (y + tip.offsetHeight > r.height) y = Math.max(0, clientY - r.top - tip.offsetHeight - 12);
      tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    }
    function hideTip() { tip.hidden = true; }
    function local(e) {
      var m = svg && svg.getScreenCTM(); if (!m) return null;
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(m.inverse());
    }
    /* Подсказка как в Grafana: в любой точке графика, а не только над линией или
       столбиком. На телефоне ведёшь пальцем вбок, вертикальный жест листает страницу. */
    function hover(move, leave) {
      var on = false;
      function off() { if (on) { on = false; hideTip(); if (leave) leave(); } }
      function pick(e) {
        if (!svg || !svg.contains(e.target)) return off();
        var q = local(e); if (q) { on = true; move(e, q); }
      }
      stage.addEventListener('pointermove', pick); stage.addEventListener('pointerdown', pick);
      stage.addEventListener('pointerleave', off);
      if (svg) svg.style.touchAction = 'pan-y'; else stage.style.touchAction = 'pan-y';
    }
    function onResize(fn) {
      var last = 0;
      new ResizeObserver(function () { var w = Math.round(stage.clientWidth); if (w && w !== last) { last = w; fn(); } }).observe(stage);
    }
    return {
      host: host, stage: stage, status: status, canvas: canvas, add: add, label: label, button: button, slider: slider,
      explain: explain, tryIt: tryIt, showTip: showTip, hideTip: hideTip, local: local, hover: hover, onResize: onResize,
      get svg() { return svg; }, get width() { return width; }
    };
  }

  /* Анимация стартует сама, как только виджет виден на экране, со значений из
     разметки. Вне экрана и в фоновой вкладке кадры не считаются. При настройке
     «уменьшить движение» показывается статичный кадр. tick вернул false: показ
     закончен, кнопка предлагает повторить. */
  function animate(v, tick, still, reset) {
    var playing = true, done = false, visible = !('IntersectionObserver' in window), raf = 0, last = 0;
    var btn = v.button('❚❚ Пауза', function () {
      if (done) { done = false; playing = true; if (reset) reset(); } else playing = !playing;
      sync();
    });
    function running() { return playing && visible && !document.hidden && !motion.matches; }
    function frame(time) {
      raf = 0; if (!running()) return;
      var dt = last ? Math.min((time - last) / 1000, 0.1) : 0; last = time;
      if (tick(dt) === false) { done = true; playing = false; sync(); return; }
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      cancelAnimationFrame(raf); raf = 0; last = 0;
      if (motion.matches) { btn.hidden = true; still(); return; }
      btn.hidden = false;
      btn.textContent = done ? '↺ Показать ещё раз' : playing ? '❚❚ Пауза' : '▶ Продолжить';
      if (running()) raf = requestAnimationFrame(frame);
    }
    if (!visible) new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }).observe(v.host);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    sync();
    return {
      pause: function () { playing = false; sync(); },
      play: function () { done = false; playing = true; sync(); },
      finish: function () { done = true; playing = false; sync(); },
      get reduced() { return motion.matches; }
    };
  }

  var widgets = {};

  /* ---------- Путь запроса: где тратится время ---------- */
  widgets['request-path'] = function (host) {
    var t = { net: num(host.dataset.net, 20, 0, 300), app: num(host.dataset.app, 5, 0, 1000), db: num(host.dataset.db, 8, 0, 3000) };
    var v = setup(host, host.dataset.title || 'Куда уходит время одного запроса');
    var track = html('div', undefined, 'rp-track'); v.stage.appendChild(track);
    function station(icon, name, sub, cls) {
      var el = html('div', undefined, 'rp-station ' + cls);
      el.appendChild(html('span', icon, 'rp-icon')); el.appendChild(html('b', name)); el.appendChild(html('span', sub, 'rp-sub'));
      el.badge = html('span', '', 'rp-badge'); el.appendChild(el.badge); track.appendChild(el); return el;
    }
    function road(cls) { var el = html('div', undefined, 'rp-road ' + cls); el.label = html('span', '', 'rp-road-label'); el.appendChild(el.label); track.appendChild(el); return el; }
    var you = station('💻', 'Ты', 'скрипт или браузер', 'you');
    var net = road('response');
    var shop = station('🏪', 'Магазин', 'код сервиса', 'primary');
    var inner = road('inner');
    var db = station('🗄️', 'База данных', 'хранит товары', 'violet');
    inner.label.textContent = '≈ 0 мс';
    var env = html('span', '✉️', 'rp-env'); env.setAttribute('aria-hidden', 'true'); track.appendChild(env);
    var clock = html('p', '', 'rp-clock'); v.stage.appendChild(clock);
    var bar = html('div', undefined, 'rp-bar'); v.stage.appendChild(bar);
    var cursor = html('span', undefined, 'rp-cursor'); bar.appendChild(cursor);
    var legend = html('div', undefined, 'rp-legend'); v.stage.appendChild(legend);
    var idx = 0, phaseT = 0, hold = 0, steps = [], segs = [];
    var kinds = { net: { name: 'Сеть', cls: 'response' }, app: { name: 'Магазин', cls: 'primary' }, db: { name: 'База', cls: 'violet' }, inner: { name: '', cls: '' } };
    function plan() {
      steps = [
        { a: you, b: shop, ms: t.net, kind: 'net', what: 'Запрос едет по сети к магазину', env: '✉️', seg: 'Сеть туда' },
        { a: shop, ms: t.app / 2, kind: 'app', what: 'Магазин читает запрос и решает, что спросить у базы', seg: 'Магазин' },
        { a: shop, b: db, ms: 0, kind: 'inner', what: 'Магазин передаёт вопрос базе', env: '✉️' },
        { a: db, ms: t.db, kind: 'db', what: 'База ищет товар', seg: 'База' },
        { a: db, b: shop, ms: 0, kind: 'inner', what: 'База отдаёт найденное', env: '📦' },
        { a: shop, ms: t.app / 2, kind: 'app', what: 'Магазин собирает ответ', seg: 'Магазин' },
        { a: shop, b: you, ms: t.net, kind: 'net', what: 'Ответ едет по сети обратно', env: '📦', seg: 'Сеть обратно' }
      ];
    }
    function total() { return 2 * t.net + t.app + t.db; }
    function dur(s) { return 0.35 + 4 * s.ms / Math.max(total(), 0.001); }
    function simAt() { var sum = 0; for (var i = 0; i < idx && i < steps.length; i++) sum += steps[i].ms; return idx >= steps.length ? total() : sum + steps[idx].ms * Math.min(1, phaseT / dur(steps[idx])); }
    function buildBar() {
      bar.querySelectorAll('.rp-seg').forEach(function (s) { s.remove(); });
      var all = total() || 1;
      segs = steps.filter(function (s) { return s.seg; }).map(function (s) {
        var el = html('span', undefined, 'rp-seg ' + kinds[s.kind].cls), share = s.ms / all;
        el.style.flexGrow = Math.max(share, 0.0001); el.textContent = share > 0.12 ? s.seg : '';
        el.addEventListener('pointerenter', show); el.addEventListener('pointermove', show); el.addEventListener('pointerleave', v.hideTip);
        function show(e) { v.showTip('<b>' + s.seg + ': ' + ms(s.ms) + '</b><br>' + pct(share) + ' всего времени запроса', e.clientX, e.clientY); }
        bar.insertBefore(el, cursor); return el;
      });
      legend.replaceChildren();
      [['net', 2 * t.net, 'туда и обратно'], ['app', t.app, 'думает'], ['db', t.db, 'ищет']].forEach(function (r) {
        var chip = html('span', undefined, 'viz-chip ' + kinds[r[0]].cls); chip.appendChild(html('i'));
        chip.appendChild(document.createTextNode(kinds[r[0]].name + ' (' + r[2] + '): ' + ms(r[1]))); legend.appendChild(chip);
      });
      net.label.textContent = '🛣️ Сеть: ' + ms(t.net) + ' в одну сторону';
      describe();
    }
    function describe() {
      var all = total(), parts = [['net', 2 * t.net], ['app', t.app], ['db', t.db]].sort(function (a, b) { return b[1] - a[1]; });
      var top = parts[0], text = 'Весь запрос, от отправки до ответа: <b>' + ms(all) + '</b>. Это сеть дважды (туда ' + ms(t.net) + ' и обратно ' + ms(t.net) + '), плюс магазин ' + ms(t.app) + ', плюс база ' + ms(t.db) + '.<br>';
      text += 'Больше всего забирает <b>' + { net: 'сеть', app: 'магазин', db: 'база' }[top[0]] + '</b>: ' + ms(top[1]) + ', это ' + pct(top[1] / (all || 1)) + ' полосы. ';
      if (top[0] === 'net') text += 'Письмо с запросом едет по сети два раза, поэтому сеть считается дважды. Ускорять код здесь почти бесполезно: даже мгновенный магазин сэкономит только ' + ms(t.app) + '.';
      else if (top[0] === 'db') text += 'Сеть и код тут ни при чём: искать причину нужно в базе, например в медленном запросе без индекса.';
      else text += 'Сервис долго думает сам: занят процессор или тяжёлый код. Сеть и база тут ни при чём.';
      v.explain(text);
    }
    function centre(el) { return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight }; }
    function edge(a, b) {
      var p = centre(a), q = centre(b), dx = q.x - p.x, dy = q.y - p.y;
      return Math.abs(dx) > Math.abs(dy) ? { x: p.x + Math.sign(dx) * p.w / 2, y: p.y } : { x: p.x, y: p.y + Math.sign(dy) * p.h / 2 };
    }
    function draw() {
      var s = steps[Math.min(idx, steps.length - 1)], doneAll = idx >= steps.length;
      [you, shop, db].forEach(function (el) { el.classList.remove('active'); el.badge.textContent = ''; });
      [net, inner].forEach(function (el) { el.classList.remove('active'); });
      if (doneAll) {
        env.style.opacity = 0; you.classList.add('active'); you.badge.textContent = '✅ ответ за ' + ms(total());
        v.status.textContent = 'Готово: ответ получен за ' + ms(total()) + '. Сейчас начнём заново.';
      } else if (s.b) {
        var a = edge(s.a, s.b), b = edge(s.b, s.a), k = Math.min(1, phaseT / dur(s));
        k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        env.textContent = s.env; env.style.opacity = 1;
        env.style.transform = 'translate(' + (lerp(a.x, b.x, k) - 14) + 'px,' + (lerp(a.y, b.y, k) - 14) + 'px)';
        (s.kind === 'net' ? net : inner).classList.add('active');
        v.status.textContent = 'Сейчас: ' + s.what + (s.ms ? ' (' + ms(s.ms) + ')' : '');
      } else {
        env.style.opacity = 0; s.a.classList.add('active');
        s.a.badge.textContent = '⏳ ' + ms(s.ms * Math.min(1, phaseT / dur(s)));
        v.status.textContent = 'Сейчас: ' + s.what + ' (' + ms(s.ms) + ')';
      }
      var all = total() || 1, at = simAt();
      clock.textContent = '⏱ ' + ms(at);
      cursor.style.left = (at / all * 100) + '%';
    }
    function tick(dt) {
      if (idx >= steps.length) { hold += dt; if (hold > 1.8) { idx = 0; phaseT = 0; hold = 0; } }
      else { phaseT += dt; while (idx < steps.length && phaseT >= dur(steps[idx])) { phaseT -= dur(steps[idx]); idx++; } }
      draw();
    }
    function still() { idx = steps.length; phaseT = 0; draw(); }
    function change(key) { return function (n) { t[key] = n; plan(); buildBar(); draw(); }; }
    plan(); buildBar();
    v.slider('Сеть, в одну сторону', 0, 150, 1, t.net, change('net'), 'мс');
    v.slider('Магазин думает', 0, 200, 1, t.app, change('app'), 'мс');
    v.slider('База ищет товар', 0, 500, 1, t.db, change('db'), 'мс');
    v.tryIt('поставь сеть 100 мс (так бывает, когда сервер в другой стране) и посмотри, какую часть полосы займёт синий цвет. Потом верни 1 мс, как на стенде у тебя на компьютере, и разгони базу до 300 мс.');
    animate(v, tick, still);
    v.onResize(draw);
  };

  /* ---------- Очередь в кассу ---------- */
  widgets.queue = function (host) {
    var K = Math.round(num(host.dataset.servers, 2, 1, 6)), A = num(host.dataset.rate, 7, 1, 30), M = num(host.dataset.service, 12, 2, 40);
    var SPEED = 10; // секунда на экране = 10 секунд в магазине
    var v = setup(host, host.dataset.title || 'Очередь в кассу');
    var people, queue, desks, clock, nextIn, waits, history, histT, served, id, lastText = -1, pointer = null;
    function expo(mean) { return -Math.log(1 - Math.random()) * mean; }
    function reset() { people = []; queue = []; desks = []; clock = 0; nextIn = 0; waits = []; history = []; histT = 0; served = 0; id = 0; }
    function step(dt) {
      clock += dt; nextIn -= dt;
      while (nextIn <= 0) {
        if (queue.length < 999) { var p = { id: id++, born: clock, state: 'queue' }; queue.push(p); people.push(p); }
        nextIn += expo(60 / A);
      }
      for (var i = 0; i < Math.max(K, desks.length); i++) {
        var d = desks[i];
        if (d && clock >= d.end) { d.state = 'gone'; d.left = clock; served++; desks[i] = d = null; }
        if (!d && i < K && queue.length) {
          var c = queue.shift(); c.state = 'desk'; c.desk = i; c.start = clock; c.end = clock + M * (0.5 + Math.random());
          desks[i] = c; waits.push({ t: clock, w: clock - c.born });
        }
      }
      waits = waits.filter(function (w) { return clock - w.t <= 120; });
      histT += dt; while (histT >= 1) { histT -= 1; history.push(queue.length); if (history.length > 180) history.shift(); }
      people = people.filter(function (p) { return p.state !== 'gone' || clock - p.left < 6; });
    }
    function run(simSeconds) { while (simSeconds > 0) { var d = Math.min(0.5, simSeconds); step(d); simSeconds -= d; } }
    function waitOf(p) { return (p.state === 'queue' ? clock : p.start) - p.born; }
    function colour(w) { return w < M ? 'ok' : w < 3 * M ? 'warning' : 'danger'; }
    var geo = {};
    function draw(dt) {
      var rowH = 60, deskTop = 40, deskH = Math.max(K * rowH, 110), sparkTop = deskTop + deskH + 34, H = sparkTop + 66;
      var W = v.canvas(H), deskW = Math.min(170, Math.max(110, W * 0.3)), deskX = W - deskW - 6, midY = deskTop + deskH / 2;
      var qRight = deskX - 26, qLeft = 62, gap = 22, slots = Math.max(1, Math.floor((qRight - qLeft) / gap) + 1);
      geo = { deskTop: deskTop, deskH: deskH, deskX: deskX, deskW: deskW, rowH: rowH, sparkTop: sparkTop, W: W };
      v.add('rect', { x: 6, y: midY - 28, width: 40, height: 56, rx: 6, class: 'box' });
      v.label(26, midY + 7, '🚪');
      v.label(26, midY + 46, 'вход', 'muted');
      v.label(qLeft - 8, 22, 'В очереди: ' + queue.length, queue.length > slots ? 'warning' : '', 'start');
      v.label(deskX, 22, 'Кассы', '', 'start');
      var y0 = deskTop + (deskH - K * rowH) / 2;
      for (var i = 0; i < K; i++) {
        var y = y0 + i * rowH, d = desks[i];
        v.add('rect', { x: deskX, y: y + 3, width: deskW, height: rowH - 8, rx: 8, class: d ? 'box busy' : 'box' });
        v.label(deskX + 12, y + 26, 'Касса ' + (i + 1), d ? '' : 'muted', 'start');
        if (!d) v.label(deskX + 12, y + 44, 'свободна', 'muted small', 'start');
        if (d) v.add('rect', { x: deskX + 10, y: y + rowH - 9, width: (deskW - 52) * Math.min(1, (clock - d.start) / (d.end - d.start)), height: 3, class: 'ok fill' });
      }
      var k = Math.min(1, (dt || 1) * 8);
      people.forEach(function (p) {
        var tx, ty, j;
        if (p.state === 'queue') { j = queue.indexOf(p); if (j >= slots) { p.x = null; return; } tx = qRight - j * gap; ty = midY; }
        else if (p.state === 'desk') { tx = deskX + deskW - 22; ty = y0 + p.desk * rowH + rowH / 2 - 1; }
        else { tx = W + 20; ty = p.y == null ? midY : p.y; }
        if (p.x == null) { p.x = p.state === 'queue' ? 26 : tx; p.y = ty; }
        p.x = lerp(p.x, tx, k); p.y = lerp(p.y, ty, k);
        var w = waitOf(p);
        v.add('circle', { cx: p.x, cy: p.y, r: 8, class: colour(w) + ' fill', opacity: p.state === 'gone' ? Math.max(0, 1 - (clock - p.left) / 6) : 1 });
      });
      if (queue.length > slots) v.label(qLeft - 8, midY - 16, '+ ещё ' + (queue.length - slots), 'warning', 'start');
      var sx = 8, sw = W - 16, sh = 44;
      v.label(sx, sparkTop - 8, 'Очередь за последние 3 минуты', 'muted small', 'start');
      v.add('line', { x1: sx, x2: sx + sw, y1: sparkTop + sh, y2: sparkTop + sh, class: 'axis' });
      var hmax = Math.max(5, Math.max.apply(null, history.concat([0])));
      if (history.length > 1) {
        var pts = history.map(function (q, n) { return (sx + sw - (history.length - 1 - n) / 179 * sw) + ',' + (sparkTop + sh - q / hmax * sh); });
        v.add('polyline', { points: pts.join(' '), class: (A >= K * 60 / M ? 'danger' : 'response') + ' stroke' });
      }
      if (W >= 480) v.label(sx + sw, sparkTop - 8, 'верх шкалы: ' + hmax, 'muted small', 'end');
      v.status.textContent = 'В магазине прошло ' + sec(clock) + ' (показ ускорен в ' + SPEED + ' раз) · обслужено ' + served;
      if (Math.floor(clock / 5) !== lastText) { lastText = Math.floor(clock / 5); describe(); }
    }
    function describe() {
      var cap = K * 60 / M, load = A / cap, avg = waits.length ? waits.reduce(function (s, w) { return s + w.w; }, 0) / waits.length : 0, level, cls;
      if (load < 0.5) { cls = 'ok'; level = 'Свободно. Кассы часто простаивают, почти никто не ждёт.'; }
      else if (load < 0.8) { cls = 'ok'; level = 'Нормально. Иногда покупатели приходят пачкой, и пара человек ждёт, но очередь быстро рассасывается.'; }
      else if (load < 1) { cls = 'warning'; level = 'На пределе. Кассы заняты почти всё время, поэтому любая пачка покупателей создаёт очередь, которая долго не уходит. Ждут уже дольше, чем стоят на кассе.'; }
      else { cls = 'danger'; level = 'Перегрузка. Приходит больше, чем кассы успевают обслужить: очередь растёт без конца, и каждый новый ждёт дольше предыдущего. Поможет только ещё одна касса или более быстрая касса.'; }
      v.explain('<p class="viz-level ' + cls + '"><i></i>' + level + '</p>' +
        'Кассы успевают обслужить <b>' + fmt(cap) + ' ' + plural(cap, 'покупателя', 'покупателей', 'покупателей') + ' в минуту</b> (' + K + ' ' + plural(K, 'касса', 'кассы', 'касс') + ', одна обслуживает человека за ' + fmt(M, 0) + ' с), а приходит <b>' + fmt(A, 0) + '</b>. Кассы заняты на <b>' + pct(Math.min(load, 9.99)) + '</b>.<br>' +
        'Сейчас в очереди <b>' + queue.length + '</b>, за последние 2 минуты ждали в среднем <b>' + sec(avg) + '</b>. Цвет кружка: зелёный ждёт меньше, чем длится обслуживание, жёлтый до трёх раз дольше, красный ещё дольше.' +
        '<br><span class="viz-note">В сервере всё так же: покупатели это запросы, кассы это обработчики (потоки или процессы сервиса), время на кассе это время обработки одного запроса.</span>');
    }
    function still() { reset(); run(150); people.forEach(function (p) { p.x = null; }); draw(1); describe(); }
    function pointerTip(e) {
      var p = v.local(e); if (!p) return;
      if (p.y > geo.sparkTop - 4 && history.length) {
        var n = Math.round((geo.W - 8 - p.x) / (geo.W - 16) * 179), q = history[history.length - 1 - n];
        if (q !== undefined) return v.showTip(n ? n + ' с назад: в очереди ' + q : 'Сейчас в очереди ' + q, e.clientX, e.clientY);
      }
      var best = null; people.forEach(function (c) { if (c.x != null && Math.hypot(c.x - p.x, c.y - p.y) < 14) best = c; });
      if (best) return v.showTip(best.state === 'queue' ? 'Ждёт в очереди уже ' + sec(waitOf(best)) : best.state === 'desk' ? 'На кассе. Перед этим ждал ' + sec(waitOf(best)) : 'Ушёл с покупкой', e.clientX, e.clientY);
      v.hideTip();
    }
    reset(); run(90); people.forEach(function (p) { p.x = null; });
    v.slider('Покупателей в минуту', 1, 30, 1, A, function (n) { A = n; nextIn = Math.min(nextIn, expo(60 / A)); describe(); if (ctl.reduced) still(); }, '');
    v.slider('Касса на одного', 2, 40, 1, M, function (n) { M = n; describe(); if (ctl.reduced) still(); }, 'с');
    v.slider('Открыто касс', 1, 6, 1, K, function (n) {
      for (var i = n; i < desks.length; i++) if (desks[i]) { desks[i].state = 'queue'; queue.unshift(desks[i]); desks[i] = null; }
      K = n; describe(); if (ctl.reduced) still(); else draw(0);
    }, '');
    v.tryIt('добавь покупателей до 12 в минуту и посмотри, как очередь растёт без остановки, а линия внизу ползёт вверх. Потом открой третью кассу и смотри, как очередь тает.');
    var ctl = animate(v, function (dt) { run(dt * SPEED); draw(dt); }, still);
    host.addEventListener('pointermove', function (e) { if (v.svg && v.svg.contains(e.target)) pointerTip(e); else v.hideTip(); });
    host.addEventListener('pointerleave', v.hideTip);
    describe(); draw(1);
    v.onResize(function () { draw(0); });
  };

  /* ---------- 100 запросов по порядку: среднее и перцентили ---------- */
  widgets.percentiles = function (host) {
    var slow = Math.round(num(host.dataset.slow, 5, 0, 30)), slowMs = num(host.dataset.slowMs, 800, 200, 3000);
    var v = setup(host, host.dataset.title || '100 запросов, выстроенных по времени ответа');
    var fast, slowK, order, values, byRank, rank, avg, t = 0, hover = -1, geo = {};
    var APPEAR = 1.6, HOLD = 0.7, SORT = 1.3, END = APPEAR + HOLD + SORT;
    function gauss() { return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()); }
    function sample() {
      fast = []; slowK = []; order = [];
      for (var i = 0; i < 100; i++) { fast.push(Math.max(18, Math.min(140, 45 * Math.exp(0.3 * gauss())))); slowK.push(0.75 + Math.random() * 0.5); order.push(i); }
      for (var j = 99; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)), x = order[j]; order[j] = order[r]; order[r] = x; }
      compute();
    }
    function compute() {
      var isSlow = {}; for (var i = 0; i < slow; i++) isSlow[order[i]] = true;
      values = fast.map(function (f, i) { return isSlow[i] ? slowMs * slowK[i] : f; });
      byRank = values.map(function (_, i) { return i; }).sort(function (a, b) { return values[a] - values[b]; });
      rank = []; byRank.forEach(function (i, r) { rank[i] = r; });
      avg = values.reduce(function (s, x) { return s + x; }, 0) / 100;
    }
    function p(n) { return values[byRank[n - 1]]; }
    function isSlowValue(x) { return x >= slowMs * 0.5; }
    function draw() {
      var H = 310, W = v.canvas(H), narrow = W < 480, left = 50, right = W - 10, top = 52, bottom = H - 46, bw = (right - left) / 100;
      var sc = scale(Math.max.apply(null, values) * 1.05), yMax = sc.max;
      function Y(x) { return bottom - x / yMax * (bottom - top); }
      geo = { left: left, bw: bw, top: top, bottom: bottom, Y: Y };
      sc.ticks.forEach(function (val) {
        v.add('line', { x1: left, x2: right, y1: Y(val), y2: Y(val), class: 'grid' });
        v.label(left - 6, Y(val) + 5, fmt(val, 0), 'muted small', 'end');
      });
      v.label(left - 6, top - 14, 'мс', 'muted small', 'end');
      var sorted = t >= END, k = t <= APPEAR + HOLD ? 0 : Math.min(1, (t - APPEAR - HOLD) / SORT);
      k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      values.forEach(function (x, i) {
        if (t < APPEAR && i / 100 > t / APPEAR) return;
        var pos = lerp(i, rank[i], k), r = rank[i];
        var cls = sorted && (r === 49 || r === 94 || r === 98) ? 'primary' : isSlowValue(x) ? 'danger' : 'response';
        v.add('rect', { x: left + pos * bw + 0.5, y: Y(x), width: Math.max(1, bw - 1), height: Math.max(1, bottom - Y(x)), class: cls + ' fill' + (i === hover ? ' hl' : '') });
      });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.add('line', { x1: left, x2: right, y1: Y(avg), y2: Y(avg), class: 'warning marker' });
      v.label(left + 6, Y(avg) - 7, 'среднее ' + ms(avg), 'warning halo', 'start');
      if (sorted) {
        [[50, 'p50', 40, 'middle'], [95, 'p95', 40, 'end'], [99, 'p99', 20, 'end']].forEach(function (m) {
          var x = left + (m[0] - 0.5) * bw, val = p(m[0]);
          v.add('line', { x1: x, x2: x, y1: m[2] + 4, y2: Y(val) - 2, class: 'primary marker' });
          v.label(m[3] === 'end' ? x + 4 : x, m[2], m[1] + (narrow ? '' : ' = ' + ms(val)), 'primary halo', m[3]);
        });
        [1, 50, 100].forEach(function (n) { v.label(n === 100 ? right : left + (n - 0.5) * bw, bottom + 18, '№' + n, 'muted small', n === 100 ? 'end' : n === 1 ? 'start' : 'middle'); });
      }
      v.label((left + right) / 2, H - 6, sorted ? (v.width < 520 ? '← быстрые · медленные →' : 'запросы от самого быстрого (слева) к самому медленному (справа)') : (v.width < 520 ? 'в порядке прихода' : 'запросы в том порядке, как они приходили'), 'muted small');
      v.status.textContent = t < APPEAR ? 'Запросы приходят один за другим. Высота столбика это время ответа.' : !sorted ? 'Выстраиваем их по росту: от быстрых к медленным.' : 'Готово: слева самые быстрые, справа самые медленные. Наведи на любой столбик.';
    }
    function describe() {
      var below = values.filter(function (x) { return x < avg; }).length, p95slow = isSlowValue(p(95)), p99slow = isSlowValue(p(99));
      var text = '<ul><li><b>p50 = ' + ms(p(50)) + '</b>: половина запросов быстрее. Это медиана, 50-й столбик слева.</li>' +
        '<li><b>p95 = ' + ms(p(95)) + '</b>: 95 запросов из 100 уложились в это время, 5 оказались дольше.</li>' +
        '<li><b>p99 = ' + ms(p(99)) + '</b>: дольше только 1 запрос из 100.</li>' +
        '<li><b>Среднее = ' + ms(avg) + '</b>' + (slow ? ': оно больше, чем у ' + below + ' ' + plural(below, 'запроса', 'запросов', 'запросов') + ' из 100. Несколько медленных тянут его вверх, и среднее не похоже ни на обычный запрос, ни на медленный.' : ': без медленных запросов оно почти совпадает с медианой.') + '</li></ul>';
      if (slow && !p95slow && p99slow) text += '<p>Посмотри: p95 не заметил ' + slow + ' ' + plural(slow, 'медленного', 'медленных', 'медленных') + ', а p99 заметил. Чем реже проблема, тем выше перцентиль, который её видит.</p>';
      if (slow && p95slow) text += '<p>Медленных уже ' + slow + ' из 100, и их видит даже p95.</p>';
      if (slow) text += '<p>Если страница магазина делает 10 запросов, хотя бы на один медленный наткнётся <b>' + pct(1 - Math.pow(1 - slow / 100, 10)) + ' посетителей</b>.</p>';
      v.explain(text);
    }
    function onMove(e, q) {
      var pos = Math.max(0, Math.min(99, Math.floor((q.x - geo.left) / geo.bw)));
      if (Math.abs(q.y - geo.Y(avg)) < 6 && t >= END) {
        hover = -1; draw();
        var below = values.filter(function (x) { return x < avg; }).length;
        return v.showTip('<b>Среднее: ' + ms(avg) + '</b><br>Сумма всех 100 времён, делённая на 100. Быстрее среднего ' + below + ' ' + plural(below, 'запрос', 'запроса', 'запросов') + ' из 100.', e.clientX, e.clientY);
      }
      var i = t >= END ? byRank[pos] : pos, x = values[i], r = rank[i], note = { 49: 'Это p50 (медиана): половина запросов быстрее.', 94: 'Это p95: 95 запросов из 100 уложились в это время.', 98: 'Это p99: медленнее только один запрос.' }[r];
      hover = i; draw();
      v.showTip('<b>Запрос: ' + ms(x) + '</b><br>' + (t >= END ? '№' + (r + 1) + ' по скорости. Быстрее него ' + r + ', медленнее ' + (99 - r) + '.' : 'Пришёл ' + (i + 1) + '-м.') + (note && t >= END ? '<br>' + note : ''), e.clientX, e.clientY);
    }
    sample(); describe();
    v.slider('Сколько запросов из 100 тормозят', 0, 30, 1, slow, function (n) { slow = n; compute(); describe(); t = END; draw(); ctl.finish(); }, '');
    v.slider('Сколько длится тормозящий запрос', 200, 3000, 100, slowMs, function (n) { slowMs = n; compute(); describe(); t = END; draw(); ctl.finish(); }, 'мс');
    v.tryIt('поставь 1 тормозящий запрос: p50 и p95 не шелохнутся, а среднее уже подрастёт. Потом поставь 10 и посмотри, когда тормоза заметит p95. Наведи на столбики и на линию среднего.');
    var ctl = animate(v, function (dt) { t += dt; draw(); return t < END; }, function () { t = END; draw(); }, function () { t = 0; draw(); });
    v.button('Новые 100 запросов', function () { sample(); describe(); t = 0; ctl.play(); if (ctl.reduced) { t = END; draw(); } });
    v.hover(onMove, function () { hover = -1; draw(); });
    draw(); v.onResize(draw);
  };
  widgets['latency-hist'] = widgets.percentiles; // старое имя из первых черновиков

  /* ---------- «Хоккейная клюшка»: нагрузка против задержки ---------- */
  widgets['hockey-stick'] = function (host) {
    var cap = num(host.dataset.capacity, 100, 0.1, 1e6), base = num(host.dataset.base, 50, 1, 10000);
    var load = num(host.dataset.load, cap * 0.6, 0, cap * 1.1), unit = host.dataset.unit || 'RPS';
    var v = setup(host, host.dataset.title || 'Нагрузка и задержка: «хоккейная клюшка»');
    var xMax = cap * 1.15, yMax = base * 12, hoverX = null, geo = {};
    function lat(x) { return x >= cap ? Infinity : base / (1 - x / cap); }
    function zone(x) { return x < 0.7 * cap ? 'ok' : x < 0.9 * cap ? 'warning' : 'danger'; }
    var legend = html('div', undefined, 'viz-legend'); v.stage.appendChild(legend);
    [['ok', 'до 70% предела: спокойно'], ['warning', '70–90%: осторожно'], ['danger', 'больше 90%: у предела']].forEach(function (z) {
      var c = html('span', undefined, 'viz-chip ' + z[0]); c.appendChild(html('i')); c.appendChild(document.createTextNode(z[1])); legend.appendChild(c);
    });
    function draw() {
      var H = 300, W = v.canvas(H), left = 58, right = W - 14, top = 22, bottom = H - 48;
      function X(x) { return left + x / xMax * (right - left); }
      function Y(y) { return bottom - Math.min(y, yMax) / yMax * (bottom - top); }
      geo = { X: X, left: left, right: right };
      [[0, 0.7, 'ok'], [0.7, 0.9, 'warning'], [0.9, xMax / cap, 'danger']].forEach(function (z) {
        v.add('rect', { x: X(z[0] * cap), y: top, width: X(z[1] * cap) - X(z[0] * cap), height: bottom - top, class: z[2] + ' zone' });
      });
      for (var g = 0; g <= 4; g++) {
        v.add('line', { x1: left, x2: right, y1: Y(yMax * g / 4), y2: Y(yMax * g / 4), class: 'grid' });
        v.label(left - 6, Y(yMax * g / 4) + 5, fmt(yMax * g / 4, 0), 'muted small', 'end');
        v.label(X(cap * g / 4), bottom + 18, fmt(cap * g / 4, cap < 20 ? 1 : 0), 'muted small');
      }
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.add('line', { x1: X(cap), x2: X(cap), y1: top, y2: bottom, class: 'danger marker' });
      v.label(X(cap) - 4, top + 16, 'предел', 'danger halo', 'end');
      v.label(left + 4, top + 16, 'задержка, мс', 'muted small halo', 'start');
      v.label((left + right) / 2, H - 8, 'нагрузка, ' + unit, 'muted small');
      var pts = []; for (var x = 0; x <= cap * 0.995; x += cap / 200) { pts.push(X(x) + ',' + Y(lat(x))); if (lat(x) > yMax) break; }
      v.add('polyline', { points: pts.join(' '), class: 'primary stroke' });
      var over = load >= cap, ly = over ? top : Y(lat(load)), cls = zone(load);
      v.add('line', { x1: X(load), x2: X(load), y1: ly, y2: bottom, class: cls + ' marker' });
      v.add('circle', { cx: X(load), cy: ly, r: 8, class: cls + ' fill pulse' });
      v.label(X(load) + (X(load) > right - 120 ? -12 : 12), Math.max(top + 34, ly - 10), over ? 'очередь растёт без конца' : lat(load) > yMax ? 'уходит вверх' : ms(lat(load)), cls + ' halo', X(load) > right - 120 ? 'end' : 'start');
      if (hoverX !== null) {
        v.add('line', { x1: X(hoverX), x2: X(hoverX), y1: top, y2: bottom, class: 'muted marker' });
        if (hoverX < cap) v.add('circle', { cx: X(hoverX), cy: Math.max(top, Y(lat(hoverX))), r: 5, class: 'primary fill' });
      }
    }
    function describe() {
      var share = load / cap, w = lat(load), z = zone(load), text = 'Нагрузка <b>' + fmt(load, cap < 20 ? 2 : 0) + ' ' + esc(unit) + '</b>, это <b>' + pct(share) + '</b> от предела в ' + fmt(cap, cap < 20 ? 1 : 0) + ' ' + esc(unit) + '.<br>';
      if (load >= cap) text += '<span class="danger"><b>Предел пройден.</b></span> Приходит больше, чем сервис успевает обработать: очередь растёт без конца, задержка увеличивается с каждой секундой теста.';
      else {
        text += 'Запрос идёт <b>' + ms(w) + '</b>: ' + ms(base) + ' работы и <b>' + ms(w - base) + ' ожидания в очереди</b>.<br>';
        text += z === 'ok' ? 'Спокойная зона: задержка растёт медленно, запас до предела ' + fmt(cap - load, cap < 20 ? 2 : 0) + ' ' + esc(unit) + '.' : z === 'warning' ? 'Зона осторожности: ещё немного нагрузки, и ожидание заметно вырастет.' : '<span class="danger">У предела:</span> каждый лишний запрос в секунду добавляет много задержки. Держать сервис здесь нельзя: любой всплеск загонит всех в очередь.';
        var next = Math.min(load + cap * 0.1, cap * 0.999);
        if (load + cap * 0.1 < cap) text += '<br>Добавь ещё 10% нагрузки, и задержка станет <b>' + ms(lat(next)) + '</b> (+' + ms(lat(next) - w) + ').';
        else text += '<br>Ещё 10% нагрузки, и сервис упрётся в предел.';
      }
      v.explain(text);
    }
    v.slider('Нагрузка', 0, +(cap * 1.1).toFixed(2), +(cap / 100).toPrecision(2), load, function (n) { load = n; draw(); describe(); }, unit);
    v.tryIt('веди ползунок медленно от 50% до 95% предела и следи, на сколько растёт задержка за каждый шаг. Наведи в любое место графика: увидишь задержку при такой нагрузке.');
    v.hover(function (e, q) {
      var x = Math.max(0, Math.min(xMax, (q.x - geo.left) / (geo.right - geo.left) * xMax));
      hoverX = x; draw();
      v.showTip(x >= cap ? '<b>' + fmt(x, cap < 20 ? 2 : 0) + ' ' + esc(unit) + '</b><br>Больше предела: очередь растёт без конца' : '<b>' + fmt(x, cap < 20 ? 2 : 0) + ' ' + esc(unit) + ' (' + pct(x / cap) + ' предела)</b><br>Задержка ' + ms(lat(x)) + ', из них ожидание ' + ms(lat(x) - base), e.clientX, e.clientY);
    }, function () { hoverX = null; draw(); });
    draw(); describe(); v.onResize(draw);
  };

  /* ---------- Профили нагрузки ---------- */
  var PROFILES = {
    smoke: { name: 'Дымовой тест (smoke)', short: 'smoke', unit: 'мин', pts: [[0, 0], [0.3, 2], [4.7, 2], [5, 0]],
      notes: [[2.5, 'пара пользователей']],
      what: 'Пара пользователей несколько минут.', why: 'Убедиться, что тест вообще работает: скрипт не падает, сервис отвечает, метрики пишутся. Его запускают перед любым большим тестом.', look: 'Ошибки в самом скрипте и ответы с кодом не 200.' },
    load: { name: 'Нагрузочный тест (load)', short: 'load', unit: 'мин', pts: [[0, 0], [5, 100], [25, 100], [30, 0]],
      notes: [[2.5, 'разгон'], [15, 'ровная обычная нагрузка'], [27.5, 'спад']],
      what: 'Обычная ожидаемая нагрузка, например как в час пик.', why: 'Проверить, что в нормальный день сервис укладывается в цели по задержке и ошибкам.', look: 'p95 и долю ошибок на ровном участке. Они должны быть ровными, без роста.' },
    stress: { name: 'Стресс-тест (stress)', short: 'stress', unit: 'мин', pts: [[0, 0], [1, 50], [5, 50], [6, 100], [10, 100], [11, 150], [15, 150], [16, 200], [20, 200], [21, 250], [25, 250], [26, 0]],
      notes: [[3, 'норма'], [13, 'выше нормы'], [23, 'до отказа']],
      what: 'Нагрузку поднимают ступеньками выше обычной, пока сервис не начнёт сдаваться.', why: 'Найти предел и узнать, что ломается первым.', look: 'Ступеньку, на которой задержка резко выросла или пошли ошибки.' },
    soak: { name: 'Длительный тест (soak)', short: 'soak', unit: 'ч', pts: [[0, 0], [0.2, 80], [7.8, 80], [8, 0]],
      notes: [[4, 'обычная нагрузка много часов']],
      what: 'Обычная нагрузка много часов подряд.', why: 'Поймать то, что копится медленно: утечки памяти, заполнение диска, растущие таблицы.', look: 'Медленный рост памяти и задержки к концу теста.' },
    spike: { name: 'Всплеск (spike)', short: 'spike', unit: 'мин', pts: [[0, 20], [10, 20], [10.3, 200], [12, 200], [12.3, 20], [20, 20]],
      notes: [[5, 'фон'], [11.2, 'удар'], [16, 'восстановление']],
      what: 'Резкий скачок пользователей, как после рассылки или старта распродажи.', why: 'Проверить, переживёт ли сервис удар и как быстро придёт в себя.', look: 'Ошибки во время скачка и сколько времени нужно, чтобы задержка вернулась к норме.' }
  };
  widgets['load-profiles'] = function (host) {
    var keys = list(host.dataset.only, 'smoke,load,stress,soak,spike').filter(function (k) { return PROFILES[k]; });
    if (!keys.length) keys = Object.keys(PROFILES);
    var v = setup(host, host.dataset.title || (keys.length > 1 ? 'Профили нагрузки: как меняется число пользователей' : PROFILES[keys[0]].name));
    var cur = 0, prog = 0, hold = 0, auto = keys.length > 1, geo = {}, hoverT = null;
    var tabs = html('div', undefined, 'viz-tabs'); tabs.setAttribute('role', 'group'); v.stage.insertBefore(tabs, v.stage.firstChild);
    var tabButtons = keys.map(function (k, i) {
      var b = html('button', PROFILES[k].short); b.type = 'button';
      b.addEventListener('click', function () { cur = i; prog = 0; hold = 0; auto = false; describe(); draw(); if (ctl.reduced) { prog = 1; draw(); } });
      tabs.appendChild(b); return b;
    });
    if (keys.length < 2) tabs.hidden = true;
    function value(pts, t) {
      for (var i = 1; i < pts.length; i++) if (t <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return b[0] === a[0] ? b[1] : lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
      return pts[pts.length - 1][1];
    }
    function draw() {
      var pr = PROFILES[keys[cur]], pts = pr.pts, T = pts[pts.length - 1][0];
      var ys = scale(Math.max.apply(null, pts.map(function (p) { return p[1]; })) * 1.1, true), uMax = ys.max, xsc = scale(T);
      var H = 250, W = v.canvas(H), left = 50, right = W - 14, top = 26, bottom = H - 46;
      function X(t) { return left + t / T * (right - left); }
      function Y(u) { return bottom - u / uMax * (bottom - top); }
      geo = { X: X, T: T, left: left, right: right, pr: pr };
      ys.ticks.forEach(function (u) {
        v.add('line', { x1: left, x2: right, y1: Y(u), y2: Y(u), class: 'grid' });
        v.label(left - 6, Y(u) + 5, fmt(u, 0), 'muted small', 'end');
      });
      var shownT = xsc.ticks.filter(function (t) { return t <= T; });
      if ((T - shownT[shownT.length - 1]) / T > 0.12) shownT.push(T);
      shownT.forEach(function (t) { v.label(X(t), bottom + 18, fmt(t, 2), 'muted small', t === T ? 'end' : 'middle'); });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.label(left + 4, top - 8, 'пользователей одновременно', 'muted small', 'start');
      v.label((left + right) / 2, H - 8, 'время теста, ' + pr.unit, 'muted small');
      v.add('polyline', { points: pts.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' '), class: 'muted ghost' });
      var cut = prog * T, drawn = pts.filter(function (p) { return p[0] <= cut; }).map(function (p) { return [p[0], p[1]]; });
      drawn.push([cut, value(pts, cut)]);
      var line = drawn.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' ');
      v.add('polygon', { points: X(0) + ',' + bottom + ' ' + line + ' ' + X(cut) + ',' + bottom, class: 'primary area' });
      v.add('polyline', { points: line, class: 'primary stroke' });
      if (W >= 480) pr.notes.forEach(function (n) { if (n[0] <= cut) v.label(X(n[0]), Math.min(bottom - 8, Y(value(pts, n[0])) + 22), n[1], 'small halo'); });
      if (prog < 1) {
        v.add('circle', { cx: X(cut), cy: Y(value(pts, cut)), r: 6, class: 'primary fill' });
        v.label(X(cut) + (X(cut) > right - 90 ? -10 : 10), Y(value(pts, cut)) - 10, Math.round(value(pts, cut)) + ' польз.', 'primary halo', X(cut) > right - 90 ? 'end' : 'start');
      }
      if (hoverT !== null) {
        v.add('line', { x1: X(hoverT), x2: X(hoverT), y1: top, y2: bottom, class: 'muted marker' });
        v.add('circle', { cx: X(hoverT), cy: Y(value(pts, hoverT)), r: 5, class: 'primary fill' });
      }
      tabButtons.forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); });
      v.status.textContent = auto ? 'Профили сменяют друг друга сами. Нажми на название, чтобы остановиться на одном.' : 'Показан профиль ' + pr.short + '.';
    }
    function describe() {
      var pr = PROFILES[keys[cur]];
      v.explain('<b>' + pr.name + '.</b> ' + pr.what + '<br><b>Зачем:</b> ' + pr.why + '<br><b>Что ищем на графиках:</b> ' + pr.look);
    }
    function tick(dt) {
      if (prog < 1) prog = Math.min(1, prog + dt / 4.5);
      else { hold += dt; if (hold > 2.5) { hold = 0; prog = 0; if (auto) { cur = (cur + 1) % keys.length; describe(); } } }
      draw();
    }
    v.tryIt(keys.length > 1 ? 'нажми на профиль, чтобы рассмотреть его. Наведи в любое место графика: увидишь, сколько пользователей в каждый момент теста.' : 'наведи в любое место графика: увидишь, сколько пользователей в каждый момент теста.');
    var ctl = animate(v, tick, function () { prog = 1; draw(); });
    v.hover(function (e, q) {
      var t = Math.max(0, Math.min(geo.T, (q.x - geo.left) / (geo.right - geo.left) * geo.T));
      hoverT = t; draw();
      v.showTip(fmt(t, geo.T < 10 ? 1 : 0) + ' ' + geo.pr.unit + ' от начала: <b>' + Math.round(value(geo.pr.pts, t)) + ' пользователей</b>', e.clientX, e.clientY);
    }, function () { hoverT = null; draw(); });
    describe(); draw(); v.onResize(draw);
  };

  /* ---------- Пул соединений ---------- */
  widgets.pool = function (host) {
    var size = Math.round(num(host.dataset.size, 4, 1, 16)), dur = num(host.dataset.duration, 600, 50, 2000);
    var rate = num(host.dataset.rate, 10, 1, 40), timeout = num(host.dataset.timeout, 1500, 100, 10000);
    var SPEED = 0.5; // показ замедлен вдвое, чтобы успеть рассмотреть
    var v = setup(host, host.dataset.title || 'Пул соединений с базой');
    var clock, acc, waiting, slots, items, oks, errs, lastText = -1, geo = {};
    function reset() { clock = 0; acc = 0; waiting = []; slots = []; items = []; oks = []; errs = []; }
    function step(dtMs) {
      clock += dtMs; acc += rate * dtMs / 1000;
      while (acc >= 1) { acc--; var it = { born: clock, state: 'wait' }; waiting.push(it); items.push(it); }
      for (var i = 0; i < slots.length; i++) { var s = slots[i]; if (s && s.end <= clock) { s.state = 'ok'; s.left = clock; oks.push(clock); slots[i] = null; } }
      waiting = waiting.filter(function (w) { if (clock - w.born > timeout) { w.state = 'err'; w.left = clock; errs.push(clock); return false; } return true; });
      for (var j = 0; j < size; j++) if (!slots[j] && waiting.length) { var c = waiting.shift(); c.state = 'slot'; c.slot = j; c.start = clock; c.end = clock + dur * (0.7 + 0.6 * Math.random()); slots[j] = c; }
      oks = oks.filter(function (x) { return clock - x <= 10000; }); errs = errs.filter(function (x) { return clock - x <= 10000; });
      items = items.filter(function (x) { return x.state === 'wait' || x.state === 'slot' || clock - x.left < 700; });
    }
    function run(msTotal) { while (msTotal > 0) { var d = Math.min(20, msTotal); step(d); msTotal -= d; } }
    function draw(dt) {
      var W0 = Math.max(280, Math.round(v.stage.clientWidth || v.width || 640)), narrow = W0 < 560;
      var cell = 46, gapC = 8, binW = narrow ? 0 : 150;
      var poolX = narrow ? 10 : Math.round(W0 * 0.42), poolW = (narrow ? W0 - 20 : W0 - poolX - binW - 20);
      var cols = Math.max(1, Math.min(size, Math.floor((poolW + gapC) / (cell + gapC)))), rows = Math.ceil(size / cols);
      var poolTop = 40, poolH = rows * (cell + gapC) - gapC;
      var qY = narrow ? poolTop + poolH + 60 : poolTop + poolH / 2, binTop = narrow ? qY + 46 : poolTop;
      var H = narrow ? binTop + 110 : Math.max(poolTop + poolH + 40, 190);
      var W = v.canvas(H);
      geo = { items: items };
      v.label(poolX, 24, 'Пул: занято ' + slots.filter(Boolean).length + ' из ' + size, '', 'start');
      for (var i = 0; i < size; i++) {
        var x = poolX + (i % cols) * (cell + gapC), y = poolTop + Math.floor(i / cols) * (cell + gapC), s = slots[i];
        v.add('rect', { x: x, y: y, width: cell, height: cell, rx: 8, class: s ? 'box busy' : 'box' });
        if (s) v.add('rect', { x: x + 5, y: y + cell - 8, width: (cell - 10) * Math.min(1, (clock - s.start) / (s.end - s.start)), height: 3, class: 'ok fill' });
        s && (s.tx = x + cell / 2, s.ty = y + cell / 2 - 3);
      }
      var qRight = narrow ? W - 20 : poolX - 24, qLeft = 14, gap = 20, cap = Math.max(1, Math.floor((qRight - qLeft) / gap) + 1);
      v.label(narrow ? 10 : qLeft, narrow ? qY - 22 : 24, 'Ждут свободное соединение: ' + waiting.length, waiting.length ? 'warning' : 'muted', 'start');
      var okX = narrow ? 34 : W - binW + 10, errX = okX, okY = narrow ? binTop + 22 : poolTop + 24, errY = narrow ? binTop + 70 : poolTop + 90;
      v.label(okX, okY, '✓ ответили: ' + oks.length, 'ok', 'start');
      v.label(errX, errY, '✗ ошибки: ' + errs.length, errs.length ? 'danger' : 'muted', 'start');
      v.label(okX, okY + 18, 'за 10 секунд', 'muted small', 'start');
      v.label(errX, errY + 18, 'ждали дольше ' + ms(timeout), 'muted small', 'start');
      var k = Math.min(1, (dt || 1) * 10);
      items.forEach(function (it) {
        var tx, ty, j;
        if (it.state === 'wait') { j = waiting.indexOf(it); if (j >= cap) { it.x = null; return; } tx = narrow ? qRight - j * gap : qRight - j * gap; ty = qY; }
        else if (it.state === 'slot') { tx = it.tx; ty = it.ty; }
        else if (it.state === 'ok') { tx = okX - 14; ty = okY - 5; }
        else { tx = errX - 14; ty = errY - 5; }
        if (it.x == null) { it.x = it.state === 'wait' ? 0 : tx; it.y = ty; }
        it.x = lerp(it.x, tx, k); it.y = lerp(it.y, ty, k);
        var waited = (it.state === 'wait' ? clock : it.start || it.left) - it.born;
        var cls = it.state === 'err' ? 'danger' : it.state === 'slot' || it.state === 'ok' ? 'response' : waited < timeout / 2 ? 'ok' : 'warning';
        v.add('circle', { cx: it.x, cy: it.y, r: 7, class: cls + ' fill', opacity: it.state === 'ok' || it.state === 'err' ? Math.max(0, 1 - (clock - it.left) / 700) : 1 });
      });
      if (waiting.length > cap) v.label(qLeft, qY - 14, '+ ещё ' + (waiting.length - cap), 'warning', 'start');
      v.status.textContent = 'Показ замедлен в ' + (1 / SPEED) + ' раза. Синий кружок: запрос работает с базой через соединение.';
      if (Math.floor(clock / 1000) !== lastText) { lastText = Math.floor(clock / 1000); describe(); }
    }
    function describe() {
      var need = rate * dur / 1000, level, cls;
      if (need < size * 0.7) { cls = 'ok'; level = 'Хватает с запасом: запросы почти не ждут.'; }
      else if (need < size) { cls = 'warning'; level = 'Впритык: когда запросы приходят пачкой, кому-то приходится ждать свободного соединения.'; }
      else { cls = 'danger'; level = 'Не хватает: очередь растёт, и кто ждёт дольше ' + ms(timeout) + ', получает ошибку (таймаут). Сама база при этом может быть почти свободна, просто к ней нет «дверей».'; }
      v.explain('<p class="viz-level ' + cls + '"><i></i>' + level + '</p>' +
        'Пул это несколько заранее открытых соединений с базой, которые запросы берут по очереди и возвращают. Приходит <b>' + fmt(rate, 0) + ' запросов в секунду</b>, каждый держит соединение около <b>' + ms(dur) + '</b>. Значит, одновременно нужно в среднем <b>' + fmt(need) + ' ' + plural(need, 'соединение', 'соединения', 'соединений') + '</b>, а в пуле <b>' + size + '</b>.<br>' +
        'Сейчас занято ' + slots.filter(Boolean).length + ' из ' + size + ', ждут ' + waiting.length + ', ошибок за 10 секунд: ' + errs.length + '.');
    }
    function still() { reset(); run(10000); items.forEach(function (it) { it.x = null; }); draw(1); describe(); }
    reset(); run(4000); items.forEach(function (it) { it.x = null; });
    v.slider('Размер пула', 1, 16, 1, size, function (n) {
      slots.slice(n).forEach(function (s) { if (s) { s.state = 'wait'; waiting.unshift(s); } });
      slots.length = Math.min(slots.length, n); size = n; describe(); if (ctl.reduced) still(); else draw(0);
    }, '');
    v.slider('Запрос держит соединение', 50, 2000, 50, dur, function (n) { dur = n; describe(); if (ctl.reduced) still(); }, 'мс');
    v.slider('Запросов в секунду', 1, 40, 1, rate, function (n) { rate = n; describe(); if (ctl.reduced) still(); }, '');
    v.tryIt('уменьши пул до 3 и смотри, как ожидающие желтеют и уходят в ошибки. Потом верни пул и вместо этого ускорь запрос до 300 мс: это тоже лечит.');
    var ctl = animate(v, function (dt) { run(dt * 1000 * SPEED); draw(dt); }, still);
    describe(); draw(1); v.onResize(function () { draw(0); });
  };

  /* ---------- График по данным ---------- */
  widgets.chart = function (host) {
    var series = json(host.dataset.series, []), xs = list(host.dataset.x, ''), type = host.dataset.type || 'line';
    if (!Array.isArray(series) || !series.length || !xs.length || xs.length > 200 || series.length > 6 || !series.every(function (s) {
      return s && typeof s.name === 'string' && Array.isArray(s.values) && s.values.length === xs.length && s.values.every(function (n) { return typeof n === 'number' && Number.isFinite(n); });
    }) || ['line', 'bar'].indexOf(type) < 0) throw new Error('Проверь data-series, data-x и data-type: нужны равные длины и конечные числа.');
    var unit = host.dataset.unit || '', xLabel = host.dataset.xLabel || '', yLabel = host.dataset.yLabel || '';
    var v = setup(host, host.dataset.title || 'Результаты теста');
    var hidden = series.map(function () { return false; }), focus = -1, sel = null, geo = {};
    var legend = html('div', undefined, 'viz-legend'); v.stage.insertBefore(legend, v.stage.firstChild);
    series.forEach(function (s, i) {
      var b = html('button', undefined, 'viz-chip ' + palette[i % palette.length]); b.type = 'button';
      b.appendChild(html('i')); b.appendChild(document.createTextNode(s.name)); b.setAttribute('aria-pressed', 'true');
      b.title = 'Нажми, чтобы скрыть или показать';
      b.addEventListener('click', function () {
        if (!hidden[i] && hidden.filter(function (h) { return !h; }).length === 1) return;
        hidden[i] = !hidden[i]; b.setAttribute('aria-pressed', hidden[i] ? 'false' : 'true'); draw();
      });
      b.addEventListener('pointerenter', function () { focus = i; draw(); });
      b.addEventListener('pointerleave', function () { focus = -1; draw(); });
      legend.appendChild(b);
    });
    function u(s) { return s.unit != null ? s.unit : unit; }
    function draw() {
      var H = 300, W = v.canvas(H), left = 56, right = W - 16, top = 28, bottom = H - 52;
      var shown = series.filter(function (_, i) { return !hidden[i]; }), vals = shown.reduce(function (a, s) { return a.concat(s.values); }, []);
      var sc = scale(Math.max(0, Math.max.apply(null, vals))), high = sc.max, low = Math.min(0, Math.min.apply(null, vals));
      if (low < 0) low = -niceMax(-low);
      var ticks = low < 0 ? [0, 1, 2, 3, 4].map(function (g) { return low + g / 4 * (high - low); }) : sc.ticks;
      var numericX = type === 'line' && xs.length > 1 && xs.every(function (n) { return n.trim() !== '' && Number.isFinite(Number(n)); });
      var xv = xs.map(Number), xMin = Math.min.apply(null, xv), xMax = Math.max.apply(null, xv);
      if (xMin === xMax) numericX = false;
      function X(i) { return numericX ? left + (xv[i] - xMin) / (xMax - xMin) * (right - left) : left + (i + 0.5) * (right - left) / xs.length; }
      function Y(n) { return bottom - (n - low) / (high - low) * (bottom - top); }
      geo = { X: X, Y: Y };
      if (sel !== null && type === 'bar') { var band = (right - left) / xs.length; v.add('rect', { x: X(sel) - band / 2, y: top, width: band, height: bottom - top, class: 'band' }); }
      ticks.forEach(function (val) {
        v.add('line', { x1: left, x2: right, y1: Y(val), y2: Y(val), class: 'grid' });
        v.label(left - 6, Y(val) + 5, fmt(val, 2), 'muted small', 'end');
      });
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.add('line', { x1: left, x2: right, y1: Y(0), y2: Y(0), class: 'axis' });
      v.label(left + 4, top - 10, yLabel + (unit ? ', ' + unit : ''), 'muted small', 'start');
      v.label((left + right) / 2, H - 8, xLabel, 'muted small');
      var every = Math.max(1, Math.ceil(xs.length / Math.max(2, Math.floor((right - left) / 60))));
      xs.forEach(function (n, i) { if (i % every === 0 || i === xs.length - 1) v.label(X(i), bottom + 20, n, 'muted small'); });
      if (sel !== null && type === 'line') v.add('line', { x1: X(sel), x2: X(sel), y1: top, y2: bottom, class: 'muted marker' });
      var visible = series.map(function (s, j) { return j; }).filter(function (j) { return !hidden[j]; });
      visible.forEach(function (j, vi) {
        var s = series[j], cls = palette[j % palette.length] + (focus >= 0 && focus !== j ? ' dim' : '');
        if (type === 'line') {
          v.add('polyline', { points: s.values.map(function (n, i) { return X(i) + ',' + Y(n); }).join(' '), class: cls + ' stroke' });
          s.values.forEach(function (n, i) { v.add('circle', { cx: X(i), cy: Y(n), r: i === sel ? 7 : 4, class: cls + ' fill' }); });
        } else {
          var w = (right - left) / xs.length * 0.75 / visible.length;
          s.values.forEach(function (n, i) { v.add('rect', { x: X(i) - w * visible.length / 2 + vi * w, y: Math.min(Y(n), Y(0)), width: Math.max(1, w - 2), height: Math.max(1, Math.abs(Y(n) - Y(0))), rx: 3, class: cls + ' fill' }); });
        }
      });
    }
    function tipFor(i) {
      return '<b>' + esc(xLabel ? xLabel + ': ' : '') + esc(xs[i]) + '</b>' + series.map(function (s, j) {
        return hidden[j] ? '' : '<br><span class="viz-sw ' + palette[j % palette.length] + '"></span>' + esc(s.name) + ': <b>' + fmt(s.values[i], Math.abs(s.values[i]) < 10 ? 2 : 1) + (u(s) ? ' ' + esc(u(s)) : '') + '</b>';
      }).join('');
    }
    function pick(e, q) {
      sel = xs.reduce(function (best, _, i) { return Math.abs(geo.X(i) - q.x) < Math.abs(geo.X(best) - q.x) ? i : best; }, 0);
      draw(); v.showTip(tipFor(sel), e.clientX, e.clientY);
    }
    var svgReady = function () {
      v.svg.setAttribute('tabindex', '0');
      v.hover(pick, function () { sel = null; draw(); });
      v.svg.addEventListener('blur', function () { sel = null; v.hideTip(); draw(); });
      v.svg.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); e.stopPropagation(); sel = Math.max(0, Math.min(xs.length - 1, (sel === null ? 0 : sel) + (e.key === 'ArrowRight' ? 1 : -1))); draw();
        var r = v.svg.getBoundingClientRect(), k = r.width / v.width; v.showTip(tipFor(sel), r.left + geo.X(sel) * k, r.top + 40);
      });
    };
    draw(); svgReady();
    if (host.dataset.explain) v.explain(esc(host.dataset.explain));
    v.tryIt('наведи на график или коснись его: появятся точные значения. Нажми на название в легенде, чтобы скрыть или вернуть линию.');
    // Таблица даёт доступ к каждой точке без мыши и без чтения геометрии SVG.
    var details = html('details'), summary = html('summary', 'Данные графика таблицей'); details.appendChild(summary);
    var table = html('table'), head = html('tr'); head.appendChild(html('th', xLabel || 'X'));
    series.forEach(function (s) { head.appendChild(html('th', s.name + (u(s) ? ', ' + u(s) : ''))); });
    var thead = html('thead'); thead.appendChild(head); table.appendChild(thead); var tbody = html('tbody');
    xs.forEach(function (n, i) { var row = html('tr'); row.appendChild(html('th', n)); series.forEach(function (s) { row.appendChild(html('td', fmt(s.values[i], 2))); }); tbody.appendChild(row); });
    table.appendChild(tbody); details.appendChild(table); host.appendChild(details);
    v.onResize(draw);
  };

  /* ---------- Алгоритм по шагам ---------- */
  widgets.flow = function (host) {
    var raw = json(host.dataset.steps, null);
    if (!Array.isArray(raw) || !raw.length || raw.length > 20 || !raw.every(function (s) { return typeof s === 'string' || (s && typeof s.title === 'string'); }))
      throw new Error('data-steps: массив из 1–20 строк или объектов {"title": "...", "text": "..."}.');
    var steps = raw.map(function (s) { return typeof s === 'string' ? { title: s, text: '' } : s; });
    var v = setup(host, host.dataset.title || 'Алгоритм по шагам');
    function rich(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); }
    // Все шаги видны сразу, читаются сверху вниз. Анимация одна: при первом
    // появлении на экране шаги выстраиваются по очереди, дальше ничего не двигается.
    var ol = html('ol', undefined, 'flow-list'); v.stage.appendChild(ol);
    steps.forEach(function (s, i) {
      var li = html('li', undefined, 'flow-step'), card = html('div', undefined, 'flow-card');
      li.style.setProperty('--i', i);
      card.appendChild(html('span', String(i + 1), 'flow-num'));
      var body = html('div', undefined, 'flow-body'), title = html('p', undefined, 'flow-title'); title.innerHTML = rich(s.title); body.appendChild(title);
      if (s.text) { var text = html('p', undefined, 'flow-text'); text.innerHTML = rich(s.text); body.appendChild(text); }
      card.appendChild(body); li.appendChild(card); ol.appendChild(li);
    });
    if (!motion.matches && 'IntersectionObserver' in window) {
      ol.classList.add('flow-hidden');
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect(); ol.classList.remove('flow-hidden'); ol.classList.add('flow-in');
      }, { threshold: 0.25 });
      io.observe(ol);
    }
  };

  /* Виджеты тем лежат в assets/js/viz/<тема>.js и регистрируются через
     LTViz.widgets['имя'] = function (host) { var v = LTViz.setup(host, 'Заголовок'); ... }.
     Все скрипты подключены с defer, поэтому к DOMContentLoaded они уже загружены. */
  window.LTViz = {
    widgets: widgets, setup: setup, animate: animate, palette: palette, motion: motion,
    node: node, html: html, num: num, list: list, json: json, fmt: fmt, ms: ms, sec: sec, pct: pct,
    esc: esc, plural: plural, niceMax: niceMax, scale: scale, lerp: lerp
  };
  var started = false;
  function init() {
    if (started) return; started = true;
    document.querySelectorAll('.viz[data-viz]').forEach(function (host) {
      try {
        var build = widgets[host.dataset.viz];
        if (!build) throw new Error('Неизвестный виджет: ' + host.dataset.viz);
        build(host);
      } catch (e) { host.replaceChildren(html('p', e.message, 'viz-error')); console.warn('Viz:', e); }
    });
  }
  // defer-скрипты выполняются при readyState «interactive», но до DOMContentLoaded:
  // ждём его, чтобы файлы тем успели зарегистрировать свои виджеты.
  if (document.readyState === 'complete') init();
  else { document.addEventListener('DOMContentLoaded', init); addEventListener('load', init); }
})();
