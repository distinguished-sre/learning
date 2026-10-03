/* Учебные SVG-виджеты: без библиотек, цвета задаёт style.scss.
   Модели упрощены для объяснения, это не измерения учебного сервиса. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var motion = matchMedia('(prefers-reduced-motion: reduce)');
  var palette = ['primary', 'response', 'violet', 'warning', 'danger'];
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
    var v = Number(value); return value == null || !Number.isFinite(v) ? fallback : Math.max(min, Math.min(max, v));
  }
  function list(value, fallback) { return (value || fallback).split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function json(value, fallback) { try { return JSON.parse(value); } catch (e) { return fallback; } }
  function fmt(n) { return Number(n.toFixed(1)).toLocaleString('ru-RU'); }
  function setup(host, title, description) {
    host.replaceChildren();
    var caption = html('p', title, 'viz-title'); host.appendChild(caption);
    var svg = node('svg', { viewBox: '0 0 720 310', role: 'img', 'aria-label': description, class: 'viz-svg' });
    svg.appendChild(node('title', {}, title)); host.appendChild(svg);
    var status = html('p', '', 'viz-status'); host.appendChild(status);
    var controls = html('div', undefined, 'viz-controls'); host.appendChild(controls);
    var info = html('p', description, 'viz-caption'); host.appendChild(info);
    function clear(height) {
      svg.replaceChildren(node('title', {}, title)); svg.setAttribute('viewBox', '0 0 720 ' + (height || 310));
    }
    function add(tag, attrs, text) { var n = node(tag, attrs, text); svg.appendChild(n); return n; }
    function label(x, y, text, cls, anchor) { return add('text', { x: x, y: y, class: cls || '', 'text-anchor': anchor || 'middle' }, text); }
    function button(text, fn) {
      var b = html('button', text); b.type = 'button'; b.addEventListener('click', fn); controls.appendChild(b); return b;
    }
    function slider(text, min, max, step, value, fn) {
      var l = html('label'), name = html('span', text + ': '), out = html('output', fmt(value));
      name.appendChild(out); l.appendChild(name);
      var input = html('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
      input.setAttribute('aria-label', text); l.appendChild(input); controls.appendChild(l);
      input.addEventListener('input', function () { out.textContent = fmt(+input.value); fn(+input.value); });
      return input;
    }
    function describe(text) { svg.setAttribute('aria-label', description + ' ' + text); status.textContent = text; }
    return { host: host, svg: svg, status: status, controls: controls, clear: clear, add: add, label: label, button: button, slider: slider, describe: describe };
  }
  /* Один цикл на виджет. Рисование при паузе, за пределами экрана и в фоновой
     вкладке прекращается. Reduced motion действует и при смене настройки. */
  function animate(v, tick, reset, staticFrame) {
    var playing = false, visible = true, raf = 0, last = 0;
    var play = v.button('▶ Пуск', function () { if (!motion.matches) { playing = true; sync(); } });
    var pause = v.button('❚❚ Пауза', function () { playing = false; sync(); });
    v.button('↺ Заново', function () { reset(); if (motion.matches) staticFrame(); sync(); });
    function frame(time) {
      raf = 0;
      if (!playing || !visible || document.hidden || motion.matches) return;
      var ongoing = tick(last ? Math.min((time - last) / 1000, 0.1) : 0); last = time;
      if (ongoing === false) { playing = false; sync(); return; }
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      cancelAnimationFrame(raf); raf = 0; last = 0;
      play.disabled = motion.matches || playing;
      pause.disabled = motion.matches || !playing;
      if (playing && visible && !document.hidden && !motion.matches) raf = requestAnimationFrame(frame);
    }
    function reduced() {
      if (motion.matches) { playing = false; staticFrame(); }
      sync();
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting; sync();
    }).observe(v.host);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', reduced);
    reset(); reduced();
  }
  function axes(v, xLabel, yLabel, maxX, maxY, unit) {
    var left = 76, right = 660, top = 40, bottom = 236;
    for (var i = 0; i <= 4; i++) {
      var y = bottom - i / 4 * (bottom - top);
      v.add('line', { x1: left, x2: right, y1: y, y2: y, class: 'grid' });
      v.label(left - 8, y + 5, fmt(maxY * i / 4), 'muted', 'end');
      v.label(left + i / 4 * (right - left), bottom + 22, fmt(maxX * i / 4), 'muted');
    }
    v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
    v.label((left + right) / 2, 296, xLabel);
    v.label(left, 22, yLabel + (unit ? ', ' + unit : ''), '', 'start');
    return { x: function (n) { return left + n / maxX * (right - left); }, y: function (n) { return bottom - n / maxY * (bottom - top); }, bottom: bottom };
  }
  var widgets = {};
  widgets['request-path'] = function (host) {
    var names = list(host.dataset.nodes, 'Браузер,Сеть,Магазин,PostgreSQL').slice(0, 12);
    if (names.length < 2) names = ['Браузер', 'Магазин'];
    var times = list(host.dataset.ms, '').map(function (x) { return num(x, 1, 0, 100000); });
    var v = setup(host, 'Путь запроса и ответа', 'Пакет проходит узлы: ' + names.join(', ') + '. Ответ возвращается другим цветом.');
    var elapsed = 0;
    function draw() {
      var narrow = host.clientWidth < 520, count = names.length;
      var h = narrow ? 64 + count * 78 : 260; v.clear(h);
      var pts = names.map(function (_, i) { return narrow ? [200, 42 + i * 78] : [60 + i * 600 / (count - 1), 116]; });
      pts.slice(0, -1).forEach(function (p, i) {
        var q = pts[i + 1]; v.add('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: 'axis' });
        if (times[i] !== undefined) v.label(narrow ? 110 : (p[0] + q[0]) / 2, narrow ? (p[1] + q[1]) / 2 : 72, times[i] + ' мс', 'muted');
      });
      names.forEach(function (name, i) {
        var p = pts[i]; v.add('circle', { cx: p[0], cy: p[1], r: 17, class: 'box' });
        v.label(narrow ? 240 : p[0], narrow ? p[1] + 5 : 164, name, '', narrow ? 'start' : 'middle');
      });
      // Время участка определяет относительную скорость пакета.
      var weights = pts.slice(1).map(function (_, i) { return Math.max(1, times[i] || 1); });
      var sum = weights.reduce(function (a, b) { return a + b; }, 0);
      var phase = (elapsed % 6) / 3, response = phase >= 1;
      var pos = (response ? 2 - phase : phase) * sum, start = 0, seg = 0;
      while (seg < weights.length - 1 && pos > start + weights[seg]) start += weights[seg++];
      var f = Math.min(1, Math.max(0, (pos - start) / weights[seg]));
      var a = pts[seg], b = pts[seg + 1];
      v.add('circle', { cx: a[0] + (b[0] - a[0]) * f, cy: a[1] + (b[1] - a[1]) * f, r: 8, class: response ? 'response fill' : 'primary fill' });
      v.status.textContent = response ? 'Ответ возвращается к клиенту' : 'Запрос идёт к сервису';
    }
    animate(v, function (dt) { elapsed += dt; draw(); }, function () { elapsed = 0; draw(); }, function () { elapsed = 1.5; draw(); });
    new ResizeObserver(draw).observe(host);
  };

  widgets.queue = function (host) {
    var channels = Math.round(num(host.dataset.servers, 2, 1, 12));
    var lambda = 8, mu = 10, queue = [], active = [], arrivals = 0, clock = 0, served = 0, started = 0, totalWait = 0;
    var v = setup(host, 'Очередь и насыщение', 'λ: входящие запросы в секунду. μ: суммарная ёмкость всех каналов. Закон Литтла L = λW применим к устойчивой очереди.');
    function draw() {
      v.clear();
      v.label(180, 35, 'λ = ' + lambda + ' запросов/с'); v.label(540, 35, 'μ = ' + mu + ' запросов/с');
      v.label(240, 80, 'Очередь'); v.label(545, 80, 'Сервер: ' + channels + ' каналов');
      for (var i = 0; i < Math.min(queue.length, 48); i++) v.add('circle', { cx: 72 + i % 12 * 29, cy: 110 + Math.floor(i / 12) * 29, r: 9, class: 'primary fill' });
      for (var j = 0; j < channels; j++) {
        var x = 472 + j % 4 * 48, y = 102 + Math.floor(j / 4) * 47;
        v.add('rect', { x: x, y: y, width: 36, height: 34, rx: 6, class: active[j] ? 'response fill' : 'box' });
      }
      var wait = started ? totalWait / started : 0, busy = active.filter(Boolean).length;
      v.describe('В очереди: ' + queue.length + ' · Среднее ожидание: ' + fmt(wait) + ' с · Загрузка: ' + Math.round(busy / channels * 100) + '%');
      v.label(360, 255, lambda >= mu ? 'λ ≥ μ: очередь растёт' : 'ρ = λ/μ = ' + fmt(lambda / mu) + ' · Lq ≈ λWq', lambda >= mu ? 'danger' : 'muted');
      if (queue.length > 48) v.label(240, 225, '+ ещё ' + (queue.length - 48), 'warning');
    }
    function tick(dt) {
      clock += dt;
      active.forEach(function (job, i) { if (job && clock >= job.end) { served++; active[i] = null; } });
      arrivals += dt * lambda;
      while (arrivals >= 1) { queue.push(clock); arrivals--; }
      for (var i = 0; i < channels; i++) if (!active[i] && queue.length) {
        var entered = queue.shift(); totalWait += clock - entered; started++;
        // Независимые экспоненциальные времена обслуживания: модель M/D arrivals/M/c.
        active[i] = { end: clock - Math.log(Math.max(0.001, Math.random())) * channels / mu };
      }
      draw();
    }
    v.slider('Запросов в секунду (λ)', 1, 40, 1, lambda, function (n) { lambda = n; draw(); });
    v.slider('Сервер успевает в секунду (μ, всего)', 1, 40, 1, mu, function (n) { mu = n; draw(); });
    function reset() { queue = []; active = []; arrivals = 0; clock = 0; served = 0; started = 0; totalWait = 0; draw(); }
    animate(v, tick, reset, function () { queue = [0, 0, 0, 0]; active = Array.from({ length: channels }, function () { return { end: 1 }; }); draw(); });
  };

  widgets['latency-hist'] = function (host) {
    var slow = 2, sample = [];
    var v = setup(host, 'Задержки: среднее и длинный хвост', 'Синтетическая выборка из 1200 запросов: логнормальное распределение и редкие выбросы. Линии: среднее, p50, p95, p99.');
    function generate() {
      sample = Array.from({ length: 1200 }, function () {
        var normal = Math.sqrt(-2 * Math.log(Math.max(1e-9, Math.random()))) * Math.cos(2 * Math.PI * Math.random());
        return { base: Math.exp(3.9 + normal * 0.5), chance: Math.random(), tail: 700 + Math.random() * 2300 };
      });
    }
    function draw() {
      var values = sample.map(function (s) { return s.base + (s.chance < slow / 100 ? s.tail : 0); }).sort(function (a, b) { return a - b; });
      var xmax = Math.ceil(Math.max(3200, values[values.length - 1]) / 500) * 500, bins = Array(32).fill(0);
      values.forEach(function (x) { bins[Math.min(31, Math.floor(x / xmax * 32))]++; });
      v.clear(); var a = axes(v, 'Задержка, мс', 'Запросов', xmax, Math.max.apply(null, bins), '');
      bins.forEach(function (n, i) { v.add('rect', { x: a.x(i * xmax / 32) + 1, y: a.y(n), width: 584 / 32 - 2, height: a.bottom - a.y(n), class: 'primary fill', opacity: 0.65 }); });
      var stats = [values.reduce(function (s, n) { return s + n; }, 0) / values.length, values[Math.ceil(values.length * 0.5) - 1], values[Math.ceil(values.length * 0.95) - 1], values[Math.ceil(values.length * 0.99) - 1]];
      var names = ['Среднее', 'p50', 'p95', 'p99'];
      stats.forEach(function (n, i) {
        v.add('line', { x1: a.x(n), x2: a.x(n), y1: 40, y2: a.bottom, class: palette[i] + ' marker' });
        var tx = Math.min(595, a.x(n) + 6), ty = 56 + i * 32;
        v.add('rect', { x: tx - 3, y: ty - 26, width: names[i].length * 17 + 8, height: 32, class: 'label-bg' });
        v.label(tx, ty, names[i], palette[i], 'start');
      });
      // Разнесённые подписи остаются читаемыми, даже когда перцентили совпадают.
      var legend = v.host.querySelector('.viz-legend');
      if (!legend) { legend = html('div', undefined, 'viz-legend'); v.host.insertBefore(legend, v.controls); }
      legend.replaceChildren();
      stats.forEach(function (n, i) { legend.appendChild(html('span', names[i] + ': ' + fmt(n) + ' мс', palette[i])); });
      v.describe(names.map(function (n, i) { return n + ': ' + fmt(stats[i]) + ' мс'; }).join(' · '));
    }
    v.slider('Доля медленных запросов, %', 0, 15, 0.5, slow, function (n) { slow = n; draw(); });
    v.button('Новая выборка', function () { generate(); draw(); }); generate(); draw();
  };

  widgets['hockey-stick'] = function (host) {
    var capacity = num(host.dataset.capacity, 100, 5, 100000), load = capacity * 0.5;
    var v = setup(host, 'Предел ёмкости: рост p95', 'Модель M/M/1: p95 времени в системе = −ln(0,05)/(μ−λ). У предела ёмкости задержка резко растёт.');
    function latency(rps) { return -Math.log(0.05) / (capacity - rps) * 1000; }
    function draw() {
      v.clear(); var a = axes(v, 'Нагрузка, RPS', 'p95', capacity, latency(capacity * 0.98), 'мс');
      var points = Array.from({ length: 99 }, function (_, i) { var n = capacity * i / 100; return a.x(n) + ',' + a.y(latency(n)); });
      v.add('polyline', { points: points.join(' '), class: 'primary stroke' });
      v.add('circle', { cx: a.x(load), cy: a.y(latency(load)), r: 7, class: 'response fill' });
      v.describe('Нагрузка: ' + fmt(load) + ' RPS · p95: ' + fmt(latency(load)) + ' мс · Запас до предела: ' + fmt(100 * (1 - load / capacity)) + '%');
    }
    v.slider('Текущая нагрузка, RPS', 0, capacity * 0.98, capacity / 100, load, function (n) { load = n; draw(); }); draw();
  };

  widgets['load-profiles'] = function (host) {
    var shapes = { smoke: [0, 1, 1, 1, 0], load: [0, 3, 6, 6, 6, 0], stress: [0, 2, 4, 6, 8, 10, 0], soak: [0, 5, 5, 5, 5, 5, 5, 5, 0], spike: [1, 1, 1, 10, 1, 1, 1] };
    var names = list(host.dataset.only, 'smoke,load,stress,soak,spike').filter(function (n) { return shapes[n]; });
    if (!names.length) names = Object.keys(shapes);
    var captions = { smoke: 'Короткая проверка', load: 'Ожидаемая нагрузка', stress: 'Поиск предела', soak: 'Долгая нагрузка', spike: 'Резкий всплеск' };
    var v = setup(host, 'Профили нагрузки', 'Пользователи во времени: ' + names.map(function (n) { return n + ': ' + captions[n]; }).join('; ') + '. Оси относительные.');
    var progress = 1;
    function draw() {
      var narrow = host.clientWidth < 520, cols = narrow ? 1 : 2, rows = Math.ceil(names.length / cols), w = 720 / cols;
      v.clear(rows * 210);
      names.forEach(function (name, i) {
        var x = (i % cols) * w + 58, y = Math.floor(i / cols) * 210 + 54, width = w - 92;
        v.label(x + width / 2, y - 24, name + ': ' + captions[name]);
        v.add('path', { d: 'M' + x + ' ' + y + 'v112h' + width, class: 'axis' });
        v.label(x, y - 5, 'пользователи', 'muted', 'start'); v.label(x + width / 2, y + 140, 'время →', 'muted');
        var values = shapes[name]; var pts = values.map(function (n, j) { return [x + j * width / (values.length - 1), y + 112 - n * 10]; });
        var count = progress * (pts.length - 1), index = Math.floor(count), partial = pts.slice(0, index + 1);
        if (index < pts.length - 1) partial.push([pts[index][0] + (pts[index + 1][0] - pts[index][0]) * (count - index), pts[index][1] + (pts[index + 1][1] - pts[index][1]) * (count - index)]);
        v.add('polyline', { points: partial.map(function (p) { return p.join(','); }).join(' '), class: palette[i % palette.length] + ' stroke' });
      });
    }
    animate(v, function (dt) { progress = Math.min(1, progress + dt / 4); draw(); return progress < 1; }, function () { progress = 0; draw(); }, function () { progress = 1; draw(); });
    new ResizeObserver(draw).observe(host);
  };

  widgets.pool = function (host) {
    var size = Math.round(num(host.dataset.size, 4, 1, 16)), duration = 600;
    var timeout = num(host.dataset.timeout, 1500, 100, 10000), rate = num(host.dataset.rate, 10, 1, 100);
    var clock = 0, arrivals = 0, slots = [], waiting = [], errors = 0, completed = 0;
    var v = setup(host, 'Пул соединений', 'Запрос занимает одно соединение на заданное время. Поступает ' + rate + ' запросов/с. Ожидание дольше ' + timeout + ' мс заканчивается ошибкой.');
    function draw() {
      v.clear();
      v.label(350, 30, 'Соединения');
      for (var i = 0; i < size; i++) {
        var x = 84 + i % 8 * 72, y = 58 + Math.floor(i / 8) * 62;
        v.add('rect', { x: x, y: y, width: 55, height: 45, rx: 7, class: slots[i] ? 'response fill' : 'box' });
        v.label(x + 27, y + 29, i + 1, slots[i] ? 'on-fill' : 'muted');
      }
      v.label(100, 222, 'Ожидают:', 'muted');
      for (var j = 0; j < Math.min(waiting.length, 18); j++) v.add('circle', { cx: 165 + j * 25, cy: 217, r: 8, class: 'primary fill' });
      v.label(360, 273, errors ? 'Истёк таймаут: ошибка' : 'Первый в очереди получает слот', errors ? 'danger' : 'muted');
      var busy = slots.filter(Boolean).length;
      v.describe('Занято: ' + busy + '/' + size + ' · Ждут: ' + waiting.length + ' · Ошибок: ' + errors + ' · Выполнено: ' + completed);
    }
    function tick(dt) {
      clock += dt * 1000;
      slots.forEach(function (job, i) { if (job && job <= clock) { completed++; slots[i] = null; } });
      waiting = waiting.filter(function (time) { if (clock - time > timeout) { errors++; return false; } return true; });
      arrivals += rate * dt;
      while (arrivals >= 1) { waiting.push(clock); arrivals--; }
      for (var i = 0; i < size; i++) if (!slots[i] && waiting.length) { waiting.shift(); slots[i] = clock + duration; }
      draw();
    }
    v.slider('Размер пула', 1, 16, 1, size, function (n) {
      // Занятые соединения при уменьшении пула возвращают заявки в ожидание.
      slots.slice(n).forEach(function (job) { if (job) waiting.unshift(clock); });
      slots.length = Math.min(slots.length, n); size = n; draw();
    });
    v.slider('Время запроса, мс', 50, 2000, 50, duration, function (n) { duration = n; draw(); });
    animate(v, tick, function () { clock = 0; arrivals = 0; slots = []; waiting = []; errors = 0; completed = 0; draw(); }, function () { slots = Array(size).fill(1000); waiting = [0, 0, 0]; errors = 1; draw(); });
  };

  widgets.chart = function (host) {
    var series = json(host.dataset.series, []), xs = list(host.dataset.x, ''), type = host.dataset.type || 'line';
    if (!Array.isArray(series) || !series.length || !xs.length || xs.length > 200 || series.length > 12 || !series.every(function (s) {
      return s && typeof s.name === 'string' && Array.isArray(s.values) && s.values.length === xs.length && s.values.every(function (n) { return typeof n === 'number' && Number.isFinite(n); });
    }) || !['line', 'bar'].includes(type)) throw new Error('Проверь data-series, data-x и data-type: нужны равные длины и конечные числа.');
    var unit = host.dataset.unit || '', selected = null;
    var v = setup(host, host.dataset.title || 'Результаты теста', 'График ' + type + '. ' + (host.dataset.xLabel || 'X') + ', ' + (host.dataset.yLabel || 'Y') + '. Серии: ' + series.map(function (s) { return s.name; }).join(', ') + '.');
    var legend = html('div', undefined, 'viz-legend'); host.insertBefore(legend, v.controls);
    series.forEach(function (s, i) { legend.appendChild(html('span', s.name, palette[i % palette.length])); });
    var tooltip = html('p', 'Наведи указатель, коснись графика или выбери точку стрелками.', 'viz-tooltip'); host.appendChild(tooltip);
    v.svg.setAttribute('tabindex', '0');
    var values = series.flatMap(function (s) { return s.values; }), low = Math.min(0, Math.min.apply(null, values)), high = Math.max(0, Math.max.apply(null, values));
    if (high === low) high = low + 1;
    var left = 76, right = 660, top = 40, bottom = 236;
    var numericX = type === 'line' && xs.length > 1 && xs.every(function (n) { return n.trim() !== '' && Number.isFinite(Number(n)); });
    var xValues = xs.map(Number), xMin = Math.min.apply(null, xValues), xMax = Math.max.apply(null, xValues);
    if (xMin === xMax) numericX = false;
    function x(i) { return numericX ? left + (xValues[i] - xMin) / (xMax - xMin) * (right - left) : left + (i + 0.5) * (right - left) / xs.length; }
    function y(n) { return bottom - (n - low) / (high - low) * (bottom - top); }
    function draw() {
      v.clear();
      for (var i = 0; i <= 4; i++) {
        var value = low + i / 4 * (high - low);
        v.add('line', { x1: left, x2: right, y1: y(value), y2: y(value), class: 'grid' });
        v.label(left - 8, y(value) + 5, fmt(value), 'muted', 'end');
      }
      v.add('path', { d: 'M' + left + ' ' + top + 'V' + bottom + 'H' + right, class: 'axis' });
      v.add('line', { x1: left, x2: right, y1: y(0), y2: y(0), class: 'axis' });
      v.label(left, 22, (host.dataset.yLabel || 'Y') + (unit ? ', ' + unit : ''), '', 'start');
      v.label(368, 296, host.dataset.xLabel || 'X');
      xs.forEach(function (n, i) { if (i % Math.max(1, Math.ceil(xs.length / 8)) === 0 || i === xs.length - 1) v.label(x(i), bottom + 22, n, 'muted'); });
      series.forEach(function (s, j) {
        var cls = palette[j % palette.length];
        if (type === 'line') {
          v.add('polyline', { points: s.values.map(function (n, i) { return x(i) + ',' + y(n); }).join(' '), class: cls + ' stroke' });
          s.values.forEach(function (n, i) { v.add('circle', { cx: x(i), cy: y(n), r: 3, class: cls + ' fill' }); });
        } else {
          var w = (right - left) / xs.length * 0.8 / series.length;
          s.values.forEach(function (n, i) { v.add('rect', { x: x(i) - w * series.length / 2 + j * w, y: Math.min(y(n), y(0)), width: Math.max(0.5, w - 1), height: Math.abs(y(n) - y(0)), class: cls + ' fill' }); });
        }
      });
      if (selected !== null) {
        v.add('line', { x1: x(selected), x2: x(selected), y1: top, y2: bottom, class: 'marker' });
        tooltip.textContent = xs[selected] + ': ' + series.map(function (s) { return s.name + ' ' + fmt(s.values[selected]) + (unit ? ' ' + unit : ''); }).join(' · ');
      }
    }
    function pick(e) {
      var point = v.svg.createSVGPoint(); point.x = e.clientX; point.y = e.clientY;
      var matrix = v.svg.getScreenCTM(); if (!matrix) return;
      var local = point.matrixTransform(matrix.inverse());
      selected = xs.reduce(function (best, _, i) { return Math.abs(x(i) - local.x) < Math.abs(x(best) - local.x) ? i : best; }, 0); draw();
    }
    v.svg.addEventListener('pointermove', pick); v.svg.addEventListener('pointerdown', pick);
    v.svg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); selected = Math.max(0, Math.min(xs.length - 1, (selected === null ? 0 : selected) + (e.key === 'ArrowRight' ? 1 : -1))); draw();
    });
    // Таблица даёт доступ к каждой точке без мыши и без чтения геометрии SVG.
    var details = html('details'), summary = html('summary', 'Данные графика'); details.appendChild(summary);
    var table = html('table'), head = html('tr'); head.appendChild(html('th', host.dataset.xLabel || 'X'));
    series.forEach(function (s) { head.appendChild(html('th', s.name + (unit ? ', ' + unit : ''))); });
    var thead = html('thead'); thead.appendChild(head); table.appendChild(thead); var tbody = html('tbody');
    xs.forEach(function (n, i) { var row = html('tr'); row.appendChild(html('th', n)); series.forEach(function (s) { row.appendChild(html('td', fmt(s.values[i]))); }); tbody.appendChild(row); });
    table.appendChild(tbody); details.appendChild(table); host.appendChild(details); draw();
  };

  widgets.flow = function (host) {
    var steps = json(host.dataset.steps, ['Симптом', 'Гипотеза', 'Проверка', 'Вывод']);
    if (!Array.isArray(steps) || !steps.length || steps.length > 20 || !steps.every(function (s) { return typeof s === 'string'; })) throw new Error('data-steps должен содержать массив из 1–20 строк.');
    var current = 0, v = setup(host, 'Алгоритм по шагам', 'Шаги: ' + steps.join('; ') + '.');
    function wrap(text, max) {
      var lines = [''];
      text.split(/\s+/).forEach(function (word) {
        if (lines[lines.length - 1].length + word.length > max && lines[lines.length - 1]) lines.push('');
        lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + word;
      }); return lines;
    }
    function draw() {
      var vertical = host.clientWidth < 600 || steps.length > 5;
      var lineSets = steps.map(function (s) { return wrap(s, vertical ? 42 : 16); });
      var heights = lineSets.map(function (ls) { return Math.max(64, ls.length * 22 + 24); });
      var height = vertical ? heights.reduce(function (a, b) { return a + b + 30; }, 24) : Math.max.apply(null, heights) + 75;
      v.clear(height);
      var offset = 20;
      steps.forEach(function (_, i) {
        var w = vertical ? 610 : 670 / steps.length - 14, x = vertical ? 55 : 25 + i * 670 / steps.length;
        var y = vertical ? offset : 30, h = heights[i]; offset += h + 30;
        if (i) v.add('path', { d: vertical ? 'M360 ' + (y - 26) + 'v18l-5-5m5 5 5-5' : 'M' + (x - 13) + ' ' + (y + 32) + 'h10l-5-5m5 5-5 5', class: 'axis' });
        v.add('rect', { x: x, y: y, width: w, height: h, rx: 8, class: i === current ? 'primary selected' : 'box' });
        lineSets[i].forEach(function (line, j) { v.label(x + w / 2, y + 26 + j * 22, line, i === current ? 'primary' : ''); });
      });
      back.disabled = current === 0; next.disabled = current === steps.length - 1;
      v.describe('Шаг ' + (current + 1) + '/' + steps.length + ': ' + steps[current]);
    }
    var back = v.button('← Назад', function () { current = Math.max(0, current - 1); draw(); });
    var next = v.button('Дальше →', function () { current = Math.min(steps.length - 1, current + 1); draw(); });
    v.status.setAttribute('aria-live', 'polite'); draw(); new ResizeObserver(draw).observe(host);
  };

  document.querySelectorAll('.viz[data-viz]').forEach(function (host) {
    try {
      var build = widgets[host.dataset.viz];
      if (!build) throw new Error('Неизвестный виджет: ' + host.dataset.viz);
      build(host);
    } catch (e) { host.replaceChildren(html('p', e.message, 'viz-error')); console.warn('Viz:', e); }
  });
})();
