/* Виджеты «как в настоящем мониторинге»: панель Grafana, Stat, Explore с Loki, водопад Tempo,
   жизнь алерта, Prometheus Targets, вкладка Table. Регистрируются через window.LTViz, префикс mu-.
   Данные статичные, берутся из data-атрибутов (JSON в одинарных кавычках); числа учебные, не измерения.

   mon-panel    data-query, data-x, data-series, data-unit, data-thresholds, data-annotations, data-stack
   mon-stat     data-stats
   mon-logs     data-query, data-lines, data-highlight
   mon-trace    data-trace-id, data-spans, data-focus
   mon-alert    data-x, data-values, data-unit, data-threshold, data-for, data-name, data-group-wait
   mon-targets  data-targets
   mon-table    data-query, data-columns, data-rows, data-highlight-col, data-highlight-row
   Общее: data-title, data-explain, data-try. */
(function () {
  'use strict';
  var L = window.LTViz;
  if (!L) return;
  var html = L.html, esc = L.esc, fmt = L.fmt, json = L.json, node = L.node, W = L.widgets;

  if (!document.getElementById('mu-style')) {
    var st = document.createElement('style');
    st.id = 'mu-style';
    st.textContent = [
      '.mu{--mu-green:var(--green);--mu-yellow:var(--yellow);--mu-blue:var(--blue);--mu-purple:var(--violet);--mu-red:var(--red);--mu-orange:color-mix(in srgb,var(--red) 55%,var(--yellow))}',
      '.mu .mu-green{color:var(--mu-green)}.mu .mu-yellow{color:var(--mu-yellow)}.mu .mu-blue{color:var(--mu-blue)}',
      '.mu .mu-purple{color:var(--mu-purple)}.mu .mu-red{color:var(--mu-red)}.mu .mu-orange{color:var(--mu-orange)}.mu .mu-gray{color:var(--muted)}',
      '.mu .viz-title{display:none}',
      '.mu-panel{border:1px solid var(--line);border-radius:6px;background:var(--bg);overflow:hidden}',
      '.mu-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:10px 12px 6px}',
      '.mu-title{margin:0;font-weight:600;font-size:.95rem;line-height:1.3;min-width:0;overflow-wrap:anywhere}',
      '.mu-ds{font:600 .68rem/1 var(--sans);padding:3px 6px;border-radius:3px;border:1px solid var(--line);color:var(--muted);text-transform:uppercase;letter-spacing:.03em}',
      '.mu-query{flex:1 0 100%;margin:2px 0 0;padding:6px 9px;border:1px solid var(--line);border-radius:4px;background:var(--bg-2);font:.78rem/1.4 var(--mono);color:var(--text);overflow-x:auto;white-space:pre}',
      '.mu-query b{color:var(--muted);font-weight:600;margin-right:8px}',
      '.mu-legend{display:flex;flex-wrap:wrap;gap:2px 14px;padding:4px 12px 10px}',
      '.viz .mu-legend button{min-height:28px;padding:2px 4px;border:0;border-radius:4px;background:transparent;font-size:.8rem;display:inline-flex;align-items:center;gap:6px}',
      '.viz .mu-legend button:hover:enabled{background:var(--bg-2)}',
      '.mu-legend button[aria-pressed=false]{opacity:.45;text-decoration:line-through}',
      '.mu-sw{display:inline-block;width:14px;height:4px;border-radius:2px;background:currentColor;flex:none}',
      '.mu-legend small{color:var(--muted);font:.74rem var(--mono)}',
      '.mu-ann{display:flex;flex-wrap:wrap;gap:2px 14px;padding:0 12px 10px;font-size:.78rem;color:var(--muted)}',
      '.mu-ann span::before{content:"";display:inline-block;margin-right:6px;border:5px solid transparent;border-bottom:7px solid var(--mu-blue);border-top:0}',
      '.viz-svg text.mu-t{font-size:12px;fill:var(--muted)}.viz-svg text.mu-tl{font-size:12px;fill:currentColor}',
      '.viz-svg .mu-grid{stroke:var(--line);stroke-width:1;opacity:.7}.viz-svg .mu-vgrid{stroke:var(--line);stroke-width:1;opacity:.35}',
      '.viz-svg .mu-line{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}',
      '.viz-svg .mu-area{fill:currentColor;stroke:none}.viz-svg .mu-dot{fill:currentColor;stroke:var(--bg);stroke-width:2}',
      '.viz-svg .mu-thr{fill:none;stroke:currentColor;stroke-width:1.4;stroke-dasharray:6 4}',
      '.viz-svg .mu-cross{stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3}',
      '.viz-svg .mu-annline{stroke:var(--mu-blue);stroke-width:1.2;stroke-dasharray:4 3}.viz-svg .mu-flag{fill:var(--mu-blue)}',
      '.viz-svg .mu-seg{stroke:var(--bg);stroke-width:1}',
      '.mu-scroll{overflow-x:auto;max-width:100%}',
      '.mu-det{margin:0 12px 10px;font-size:.85rem}.mu-det table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%}',
      '.mu-det th,.mu-det td{padding:3px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;font-family:var(--mono);font-size:.78rem}.mu-det th:first-child{text-align:left}',
      /* Stat */
      '.mu-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
      '.mu-card{position:relative;overflow:hidden;min-height:112px;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--bg);display:flex;flex-direction:column;justify-content:space-between}',
      '.mu-card:focus-visible{outline:2px solid var(--accent);outline-offset:1px}',
      '.mu-card-t{position:relative;z-index:1;font-size:.85rem;color:var(--muted);line-height:1.3;overflow-wrap:anywhere}',
      '.mu-card-v{position:relative;z-index:1;margin:6px 0 2px;font:600 2.1rem/1.1 var(--sans);color:currentColor;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '.mu-card-v small{font-size:.95rem;font-weight:500;margin-left:3px;opacity:.85}',
      '.mu-card-s{position:relative;z-index:1;font-size:.78rem;color:var(--muted)}',
      '.mu-spark{position:absolute;left:0;right:0;bottom:0;width:100%;height:46%;display:block}',
      '.mu-spark path{vector-effect:non-scaling-stroke}.mu-spark .a{fill:currentColor;opacity:.14;stroke:none}.mu-spark .l{fill:none;stroke:currentColor;stroke-width:1.5;opacity:.9}',
      /* Loki */
      '.mu-sec{padding:6px 12px 4px;font-size:.78rem;font-weight:600;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center}',
      '.mu-sec .mu-lv-chip{font-weight:400;display:inline-flex;align-items:center;gap:5px}',
      '.mu-lv-chip i{width:9px;height:9px;border-radius:2px;background:currentColor;display:inline-block}',
      '.mu-volume{border-top:1px solid var(--line)}.mu-volume svg{display:block}',
      '.mu-wrap{margin-left:auto}.viz .mu-wrap{min-height:26px;padding:1px 9px;font-size:.78rem}',
      '.mu-logs{border-top:1px solid var(--line);max-height:430px;overflow:auto}',
      '.mu-row{display:grid;grid-template-columns:auto 1fr;gap:0 10px;padding:5px 12px 5px 9px;border-left:3px solid currentColor;border-bottom:1px solid color-mix(in srgb,var(--line) 55%,transparent);cursor:pointer;font:.76rem/1.5 var(--mono);color:var(--muted)}',
      '.mu-row:hover{background:var(--bg-2)}.mu-row:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}',
      '.mu-row .ts{white-space:nowrap}.mu-row .msg{color:var(--text);min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}',
      '@container (max-width:520px){.mu-row{grid-template-columns:1fr}}',
      '.mu-nowrap .mu-row .msg{white-space:pre;overflow-wrap:normal;overflow-x:auto}',
      '.mu-row mark{background:color-mix(in srgb,var(--mu-yellow) 45%,transparent);color:inherit;border-radius:2px;padding:0 1px}',
      '.mu-fields{grid-column:1/-1;margin:6px 0 2px;color:var(--text);cursor:default;min-width:0}',
      '.mu-fields table{border-collapse:collapse;width:100%;font-size:.76rem}.mu-fields td,.mu-fields th{text-align:left;vertical-align:top;padding:2px 10px 2px 0;border-bottom:1px dotted var(--line)}',
      '.mu-fields th{color:var(--muted);font-weight:500;white-space:nowrap}.mu-fields td{overflow-wrap:anywhere}.mu-fields h4{margin:6px 0 2px;font:600 .7rem var(--sans);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}',
      '.mu-rows-in .mu-row{animation:mu-fade .35s both;animation-delay:calc(var(--i)*35ms)}',
      '@keyframes mu-fade{from{opacity:0;transform:translateY(4px)}}',
      /* Tempo */
      '.mu-meta{display:flex;flex-wrap:wrap;gap:2px 16px;padding:0 12px 8px;font-size:.8rem;color:var(--muted)}.mu-meta b{color:var(--text);font-weight:600;font-family:var(--mono);font-size:.78rem}',
      '.mu-wf{min-width:540px}',
      '.mu-tr{display:grid;grid-template-columns:minmax(170px,34%) 1fr;min-height:30px;border-top:1px solid color-mix(in srgb,var(--line) 55%,transparent);cursor:pointer;align-items:stretch}',
      '.mu-tr:hover{background:var(--bg-2)}.mu-tr:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.mu-tr.mu-focus{background:color-mix(in srgb,var(--accent) 14%,transparent)}',
      '.mu-ruler{border-top:1px solid var(--line);border-bottom:0;cursor:default;font-size:.72rem;color:var(--muted);min-height:24px}.mu-ruler:hover{background:none}',
      '.mu-ruler .mu-time span{position:absolute;top:4px;transform:translateX(-50%);white-space:nowrap;font-family:var(--mono)}.mu-ruler .mu-time span:first-child{transform:none}.mu-ruler .mu-time span:last-child{transform:translateX(-100%)}',
      '.mu-name{display:flex;align-items:center;gap:4px;min-width:0;padding:4px 8px 4px 12px;font-size:.8rem;white-space:nowrap}',
      '.mu-name .mu-twist{flex:none;width:18px;height:18px;min-height:0;padding:0;border:0;background:transparent;color:var(--muted);font-size:.7rem;line-height:1;cursor:pointer}',
      '.viz .mu-name .mu-twist{min-height:18px;padding:0;border:0;background:transparent}',
      '.mu-name .sp{flex:none;width:18px}.mu-name .svc{font-weight:600;flex:none}.mu-name .op{color:var(--muted);overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.mu-name .err{color:var(--mu-red);flex:none}',
      '.mu-time{position:relative;min-width:0;background:linear-gradient(to right,var(--line) 1px,transparent 1px) 0 0/25% 100%}',
      '.mu-bar{position:absolute;top:8px;height:14px;min-width:3px;border-radius:2px;background:currentColor;transform-origin:left;transition:transform .55s ease-out;transition-delay:calc(var(--i)*40ms)}',
      '.mu-pre .mu-bar{transform:scaleX(0)}',
      '.mu-bar-l{position:absolute;top:5px;font:.72rem/20px var(--mono);color:var(--text);white-space:nowrap}',
      '.mu-attrs{padding:6px 12px 10px 30px;border-top:1px dashed var(--line);background:var(--bg-2);font-size:.76rem}.mu-attrs table{border-collapse:collapse}.mu-attrs th,.mu-attrs td{text-align:left;padding:1px 14px 1px 0;font-family:var(--mono);vertical-align:top;overflow-wrap:anywhere}.mu-attrs th{color:var(--muted);font-weight:500;white-space:nowrap}',
      /* Targets и Table */
      '.mu-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 8px;align-items:center}',
      '.viz .mu-tab{min-height:30px;padding:3px 12px;font-size:.82rem;border-radius:4px}.viz .mu-tab[aria-pressed=true],.viz .mu-tab[aria-selected=true]{background:color-mix(in srgb,var(--accent) 18%,var(--bg));border-color:var(--accent-ink)}',
      '.mu-grp{border-top:1px solid var(--line)}',
      '.mu-gh{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:8px 12px}.mu-gh b{font-size:.95rem}',
      '.viz .mu-gh button{min-height:28px;padding:1px 8px;font-size:.78rem;margin-left:auto}',
      '.mu-badge{display:inline-block;padding:1px 7px;border-radius:3px;font:700 .68rem/1.5 var(--sans);letter-spacing:.03em;color:var(--bg);background:currentColor;position:relative}',
      '.mu-badge>span{color:var(--bg)}',
      '.mu-tbl{border-collapse:collapse;width:100%;font-size:.8rem}',
      '.mu-tbl th{text-align:left;padding:6px 10px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--line);border-top:1px solid var(--line);background:var(--bg-2);white-space:nowrap}',
      '.mu-tbl td{padding:6px 10px;border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent);vertical-align:top}',
      '.mu-tbl tbody tr:hover td{background:var(--bg-2)}',
      '.mu-tbl .mono{font-family:var(--mono);font-size:.76rem}.mu-tbl .n{text-align:right;font-family:var(--mono);white-space:nowrap}.mu-tbl th.n{text-align:right}',
      '.mu-tbl .ep a{color:var(--accent-ink);text-decoration:none}.mu-tbl .ep{white-space:nowrap}',
      '.mu-lab{display:inline-block;margin:1px 4px 1px 0;padding:0 6px;border:1px solid var(--line);border-radius:3px;background:var(--bg-2);font:.72rem/1.6 var(--mono);white-space:nowrap}',
      '.mu-err{color:var(--mu-red);font:.75rem/1.4 var(--mono);min-width:180px;overflow-wrap:anywhere}',
      '.mu-tbl tr.hr td{background:color-mix(in srgb,var(--accent) 14%,transparent)}.mu-tbl td.hc{background:color-mix(in srgb,var(--accent) 30%,transparent);font-weight:700;box-shadow:inset 0 0 0 1px var(--accent-ink)}',
      '.mu-foot{padding:6px 12px 8px;font-size:.76rem;color:var(--muted);border-top:1px solid var(--line)}'
    ].join('\n');
    document.head.appendChild(st);
  }

  var COLORS = ['green', 'yellow', 'blue', 'orange', 'red', 'purple'];
  var LV = { info: 'green', warn: 'yellow', warning: 'yellow', error: 'red', debug: 'blue' };
  var seq = 0;
  function reduced() { return L.motion.matches || !('IntersectionObserver' in window); }
  // fn вызывается один раз, когда элемент впервые виден на экране
  function firstView(el, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.2 });
    io.observe(el);
  }
  function arr(value, what, numeric) {
    var a = json(value, null);
    if (!Array.isArray(a) && typeof value === 'string' && value.trim()) a = value.split(',').map(function (s) { return numeric ? (s.trim() === '' ? null : Number(s)) : s.trim(); });
    if (!Array.isArray(a) || !a.length) throw new Error(what + ': нужен непустой JSON-массив.');
    return a;
  }
  function isNum(n) { return typeof n === 'number' && Number.isFinite(n); }
  function colorOf(c, i) { return COLORS.indexOf(c) >= 0 ? c : COLORS[i % COLORS.length]; }

  // Число и единица раздельно: «2,4» и «%», «3,2» и «MB».
  function parts(n, unit) {
    if (n == null) return ['—', ''];
    var a = Math.abs(n);
    if (unit === 'B') {
      var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
      while (a >= 1024 && i < 4) { a /= 1024; n /= 1024; i++; }
      return [fmt(n, a < 10 && i ? 1 : 0), u[i]];
    }
    var d = a >= 1000 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2;
    return [fmt(n, d), unit || ''];
  }
  function fv(n, unit) { var p = parts(n, unit); return p[1] ? p[0] + (unit === '%' ? '' : ' ') + p[1] : p[0]; }

  /* Каркас панели: рамка, заголовок, источник и запрос как в редакторе Grafana. */
  function begin(host, def, query) {
    host.classList.add('mu');
    var v = L.setup(host, host.dataset.title || def);
    var title = host.querySelector('.viz-title');
    v.stage.classList.add('mu-panel');
    var head = html('div', undefined, 'mu-head');
    head.appendChild(html('h4', host.dataset.title || def, 'mu-title'));
    if (host.dataset.viz === 'mon-trace') head.appendChild(html('span', 'Tempo', 'mu-ds'));
    if (query != null) {
      var loki = /^\s*[{|]/.test(query) || host.dataset.viz === 'mon-logs';
      head.appendChild(html('span', loki ? 'Loki' : 'Prometheus', 'mu-ds'));
      if (query) { var q = html('pre', undefined, 'mu-query'); q.appendChild(html('b', 'A')); q.appendChild(document.createTextNode(query)); head.appendChild(q); }
    }
    if (title) title.remove();
    v.stage.insertBefore(head, v.stage.firstChild);
    return v;
  }
  function finish(host, v, explain, tip) {
    v.explain(esc(host.dataset.explain || explain));
    v.tryIt(host.dataset.try ? esc(host.dataset.try) : tip);
  }

  /* ---------- Ряд временных графиков: mon-panel и mon-alert ---------- */
  function seriesChart(v, o) {
    var xs = o.xs, series = o.series, n = xs.length, hidden = series.map(function () { return false; });
    var sel = null, focus = -1, reveal = 1, geo = {}, uid = 'mu-clip' + (++seq), H = o.height || 270;
    var legend = html('div', undefined, 'mu-legend');
    series.forEach(function (s, i) {
      var b = html('button', undefined, 'mu-' + s.color); b.type = 'button'; b.setAttribute('aria-pressed', 'true'); b.title = 'Нажми, чтобы скрыть или показать';
      b.appendChild(html('span', undefined, 'mu-sw')); var nm = html('span', s.name); nm.style.color = 'var(--text)'; b.appendChild(nm);
      var last = null; s.values.forEach(function (x) { if (x != null) last = x; });
      if (o.legendLast !== false) b.appendChild(html('small', fv(last, o.unit)));
      b.addEventListener('click', function () {
        if (!hidden[i] && hidden.filter(function (h) { return !h; }).length === 1) return;
        hidden[i] = !hidden[i]; b.setAttribute('aria-pressed', hidden[i] ? 'false' : 'true'); draw();
      });
      b.addEventListener('pointerenter', function () { focus = i; draw(); });
      b.addEventListener('pointerleave', function () { focus = -1; draw(); });
      legend.appendChild(b);
    });
    function vis() { return series.map(function (_, j) { return j; }).filter(function (j) { return !hidden[j]; }); }
    function stacked() {
      var cum = [], run = xs.map(function () { return 0; });
      vis().forEach(function (j) {
        run = run.map(function (t, i) { return t + (series[j].values[i] || 0); }); cum[j] = run.slice();
      });
      return cum;
    }
    function draw() {
      var W = v.canvas(H + (o.stripH || 0)), svg = v.svg, narrow = W < 420;
      var cum = o.stack ? stacked() : null, shown = vis();
      var all = [];
      shown.forEach(function (j) { (cum ? cum[j] : series[j].values).forEach(function (x) { if (x != null) all.push(x); }); });
      (o.thresholds || []).forEach(function (t) { all.push(t.value); });
      var low = Math.min(0, Math.min.apply(null, all)), sc = L.scale(Math.max.apply(null, all.concat([0])));
      if (low < 0) low = -L.niceMax(-low);
      var high = sc.max, ticks = low < 0 ? [0, 1, 2, 3, 4].map(function (g) { return low + g / 4 * (high - low); }) : sc.ticks;
      var lab = ticks.map(function (t) { return fv(t, o.unit); });
      var left = Math.max.apply(null, lab.map(function (s) { return s.length; })) * 6.6 + 14, right = W - 14, top = 12, bottom = H - 28;
      function X(i) { return n === 1 ? (left + right) / 2 : left + i / (n - 1) * (right - left); }
      function Y(val) { return bottom - (val - low) / (high - low) * (bottom - top); }
      geo = { X: X };
      v.add('defs', {}).appendChild(node('clipPath', { id: uid })).appendChild(node('rect', { x: left - 6, y: 0, width: Math.max(0, (right - left + 12) * reveal), height: H + (o.stripH || 0) }));
      ticks.forEach(function (t, i) {
        v.add('line', { x1: left, x2: right, y1: Y(t), y2: Y(t), class: 'mu-grid' });
        v.label(left - 8, Y(t) + 4, lab[i], 'mu-t', 'end');
      });
      var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((right - left) / (narrow ? 56 : 72)))));
      xs.forEach(function (x, i) {
        if (i % every) return;
        v.add('line', { x1: X(i), x2: X(i), y1: top, y2: bottom, class: 'mu-vgrid' });
        v.label(X(i), bottom + 17, x, 'mu-t', i === 0 && left < 34 ? 'start' : 'middle');
      });
      (o.thresholds || []).forEach(function (t, i) {
        var c = colorOf(t.color, 4);
        v.add('rect', { x: left, y: top, width: right - left, height: Math.max(0, Y(t.value) - top), class: 'mu-area mu-' + c, opacity: 0.07 });
        v.add('line', { x1: left, x2: right, y1: Y(t.value), y2: Y(t.value), class: 'mu-thr mu-' + c });
        v.add('text', { x: right - 4, y: Y(t.value) - 5, 'text-anchor': 'end', class: 'mu-tl halo mu-' + c }, (t.label ? t.label + ' ' : '') + fv(t.value, o.unit));
      });
      var g = v.add('g', { 'clip-path': 'url(#' + uid + ')' });
      function put(tag, attrs, text) { var e = node(tag, attrs, text); g.appendChild(e); return e; }
      function cls(j, base) { return base + ' mu-' + series[j].color + (focus >= 0 && focus !== j ? ' dim' : ''); }
      if (cum) {
        shown.slice().reverse().forEach(function (j) {
          var below = shown.indexOf(j) ? cum[shown[shown.indexOf(j) - 1]] : null;
          var up = cum[j].map(function (t, i) { return X(i) + ',' + Y(t); });
          var dn = xs.map(function (_, i) { return X(i) + ',' + Y(below ? below[i] : 0); }).reverse();
          put('polygon', { points: up.concat(dn).join(' '), class: cls(j, 'mu-area'), opacity: 0.45 });
          put('polyline', { points: up.join(' '), class: cls(j, 'mu-line') });
        });
      } else {
        shown.forEach(function (j) {
          var vals = series[j].values, seg = [];
          function flush() {
            if (seg.length > 1) {
              put('polyline', { points: seg.join(' '), class: cls(j, 'mu-line') });
              if (shown.length === 1) put('polygon', { points: seg.concat([seg[seg.length - 1].split(',')[0] + ',' + Y(Math.max(0, low)), seg[0].split(',')[0] + ',' + Y(Math.max(0, low))]).join(' '), class: cls(j, 'mu-area'), opacity: 0.12 });
            } else if (seg.length === 1) { var p = seg[0].split(','); put('circle', { cx: p[0], cy: p[1], r: 2.5, class: cls(j, 'mu-dot') }); }
            seg = [];
          }
          vals.forEach(function (x, i) { if (x == null) flush(); else seg.push(X(i) + ',' + Y(x)); });
          flush();
        });
      }
      var ctx = { g: g, put: put, X: X, Y: Y, left: left, right: right, top: top, bottom: bottom, W: W, H: H, reveal: reveal, revealX: left + (right - left) * reveal };
      if (o.drawStrip) o.drawStrip(ctx);
      (o.annotations || []).forEach(function (a) {
        var i = xs.indexOf(a.at); if (i < 0) return;
        v.add('line', { x1: X(i), x2: X(i), y1: top, y2: bottom, class: 'mu-annline' });
        v.add('polygon', { points: (X(i) - 5) + ',' + bottom + ' ' + (X(i) + 5) + ',' + bottom + ' ' + X(i) + ',' + (bottom - 8), class: 'mu-flag' });
      });
      if (sel !== null) {
        v.add('line', { x1: X(sel), x2: X(sel), y1: top, y2: bottom, class: 'mu-cross' });
        shown.forEach(function (j) {
          var val = cum ? cum[j][sel] : series[j].values[sel];
          if (val != null) v.add('circle', { cx: X(sel), cy: Y(val), r: 4, class: 'mu-dot mu-' + series[j].color });
        });
      }
    }
    function tipFor(i) {
      var t = '<b>' + esc(xs[i]) + '</b>';
      vis().forEach(function (j) {
        t += '<br><span class="viz-sw mu-' + series[j].color + '"></span>' + esc(series[j].name) + ': <b>' + fv(series[j].values[i], o.unit) + '</b>';
      });
      if (o.stack && vis().length > 1) t += '<br>Всего: <b>' + fv(vis().reduce(function (a, j) { return a + (series[j].values[i] || 0); }, 0), o.unit) + '</b>';
      (o.annotations || []).forEach(function (a) { if (a.at === xs[i]) t += '<br><span style="color:var(--mu-blue)">&#9650;</span> ' + esc(a.text); });
      return t + (o.tipExtra ? o.tipExtra(i) : '');
    }
    function pick(e, q) {
      sel = xs.reduce(function (best, _, i) { return Math.abs(geo.X(i) - q.x) < Math.abs(geo.X(best) - q.x) ? i : best; }, 0);
      draw(); v.showTip(tipFor(sel), e.clientX, e.clientY);
    }
    draw();
    v.stage.insertBefore(legend, v.svg.nextSibling);
    if ((o.annotations || []).length) {
      var an = html('div', undefined, 'mu-ann');
      o.annotations.forEach(function (a) { an.appendChild(html('span', a.at + ' ' + a.text)); });
      v.stage.insertBefore(an, legend.nextSibling);
    }
    v.svg.setAttribute('tabindex', '0');
    v.hover(pick, function () { sel = null; draw(); });
    v.svg.addEventListener('blur', function () { sel = null; v.hideTip(); draw(); });
    v.svg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation(); sel = Math.max(0, Math.min(n - 1, (sel === null ? 0 : sel) + (e.key === 'ArrowRight' ? 1 : -1))); draw();
      var r = v.svg.getBoundingClientRect(); v.showTip(tipFor(sel), r.left + geo.X(sel) * r.width / v.width, r.top + 40);
    });
    v.onResize(draw);
    return { draw: draw, setReveal: function (k) { reveal = k; draw(); }, get reveal() { return reveal; } };
  }

  function dataTable(host, xs, series, unit, head) {
    var d = html('details', undefined, 'mu-det'); d.appendChild(html('summary', 'Данные графика таблицей'));
    var t = html('table'), tr = html('tr'); tr.appendChild(html('th', head || 'Время'));
    series.forEach(function (s) { tr.appendChild(html('th', s.name)); }); var th = html('thead'); th.appendChild(tr); t.appendChild(th);
    var tb = html('tbody');
    xs.forEach(function (x, i) { var r = html('tr'); r.appendChild(html('th', x)); series.forEach(function (s) { r.appendChild(html('td', fv(s.values[i], unit))); }); tb.appendChild(r); });
    t.appendChild(tb); d.appendChild(t); host.querySelector('.mu-panel').appendChild(d);
  }

  /* ---------- mon-panel: панель Time series ---------- */
  W['mon-panel'] = function (host) {
    var xs = arr(host.dataset.x, 'data-x').map(String), series = arr(host.dataset.series, 'data-series');
    if (series.length > 8 || !series.every(function (s, i) {
      return s && typeof s.name === 'string' && Array.isArray(s.values) && s.values.length === xs.length && s.values.every(function (n) { return n === null || isNum(n); });
    })) throw new Error('data-series: [{"name": "...", "values": [...]}], длина values равна длине data-x, числа или null.');
    series = series.map(function (s, i) { return { name: s.name, values: s.values, color: colorOf(s.color, i) }; });
    var unit = host.dataset.unit || '', thr = json(host.dataset.thresholds, []) || [], ann = json(host.dataset.annotations, []) || [];
    var v = begin(host, 'Панель', host.dataset.query || '');
    var chart = seriesChart(v, { xs: xs, series: series, unit: unit, thresholds: thr, annotations: ann, stack: host.dataset.stack === 'true', height: host.clientWidth && host.clientWidth < 420 ? 230 : 270 });
    dataTable(host, xs, series, unit);
    var peak = series.map(function (s) { return Math.max.apply(null, s.values.filter(isNum).concat([-Infinity])); }), top = peak.indexOf(Math.max.apply(null, peak));
    var over = thr.length && peak[top] > thr[0].value;
    finish(host, v, 'Это панель Grafana: время слева направо, значение по вертикали. Больше всего поднялась «' + esc(series[top].name) + '»: до ' + fv(peak[top], unit) + (thr.length ? (over ? ', это выше линии «' + esc(thr[0].label || 'порог') + '».' : ', до линии «' + esc(thr[0].label || 'порог') + '» не дошла.') : '.'),
      'наведи на график или коснись: появится подсказка со значениями всех линий в этот момент. Нажми на название в легенде, чтобы скрыть линию.');
    if (!reduced()) { chart.setReveal(0); firstView(host, function () { var t0 = 0; (function f(t) { t0 = t0 || t; var k = Math.max(0, Math.min(1, (t - t0) / 800)); chart.setReveal(k); if (k < 1) requestAnimationFrame(f); })(performance.now()); }); }
  };

  /* ---------- mon-stat: ряд панелей Stat ---------- */
  W['mon-stat'] = function (host) {
    var stats = json(host.dataset.stats, null);
    if (!Array.isArray(stats) || !stats.length || stats.length > 6 || !stats.every(function (s) { return s && typeof s.title === 'string' && isNum(s.value); }))
      throw new Error('data-stats: 1–6 объектов {"title": "...", "value": число, "unit": "%", "color": "green"}.');
    host.classList.add('mu');
    var v = L.setup(host, host.dataset.title || 'Показатели');
    var vt = host.querySelector('.viz-title'); if (host.dataset.title) vt.style.display = 'block'; else vt.remove();
    var row = html('div', undefined, 'mu-stats'); v.stage.insertBefore(row, v.stage.firstChild);
    var cards = stats.map(function (s, i) {
      var c = html('div', undefined, 'mu-card ' + (['green', 'yellow', 'orange', 'red', 'blue'].indexOf(s.color) >= 0 ? 'mu-' + s.color : '')); c.tabIndex = 0;
      c.setAttribute('role', 'group'); c.setAttribute('aria-label', s.title + ': ' + fv(s.value, s.unit || ''));
      c.appendChild(html('div', s.title, 'mu-card-t'));
      var val = html('div', undefined, 'mu-card-v'), p = parts(s.value, s.unit || '');
      var numEl = html('span', p[0]); val.appendChild(numEl); if (p[1]) val.appendChild(html('small', p[1])); c.appendChild(val);
      c.appendChild(html('div', s.sub || '', 'mu-card-s'));
      if (Array.isArray(s.spark) && s.spark.length > 1) {
        var sp = s.spark.filter(isNum), lo = Math.min.apply(null, sp), hi = Math.max.apply(null, sp), rng = hi - lo || 1;
        var pts = sp.map(function (y, k) { return (k / (sp.length - 1) * 100).toFixed(1) + ',' + (28 - (y - lo) / rng * 24).toFixed(1); });
        var svg = node('svg', { viewBox: '0 0 100 30', preserveAspectRatio: 'none', class: 'mu-spark', 'aria-hidden': 'true' });
        svg.appendChild(node('path', { d: 'M0,30 L' + pts.join(' L') + ' L100,30Z', class: 'a' }));
        svg.appendChild(node('path', { d: 'M' + pts.join(' L'), class: 'l' })); c.appendChild(svg);
      }
      function show(e) {
        var t = '<b>' + esc(s.title) + '</b><br>' + fv(s.value, s.unit || '');
        if (s.spark && s.spark.length > 1) { var q = s.spark.filter(isNum); t += '<br>за период: от ' + fv(Math.min.apply(null, q), s.unit || '') + ' до ' + fv(Math.max.apply(null, q), s.unit || ''); }
        if (e.clientX) v.showTip(t, e.clientX, e.clientY); else { var r = c.getBoundingClientRect(); v.showTip(t, r.left + 20, r.top + 30); }
      }
      c.addEventListener('pointermove', show); c.addEventListener('pointerleave', v.hideTip);
      c.addEventListener('focus', show); c.addEventListener('blur', v.hideTip);
      row.appendChild(c);
      return { num: numEl, value: s.value, unit: s.unit || '', text: p[0] };
    });
    var bad = stats.filter(function (s) { return s.color === 'red' || s.color === 'orange'; });
    finish(host, v, 'Каждая карточка Stat показывает одно число «сейчас» и его цвет: зелёный значит норма, жёлтый внимание, красный плохо.' + (bad.length ? ' Здесь тревожно: ' + bad.map(function (s) { return esc(s.title); }).join(', ') + '.' : ''),
      'наведи на карточку: в подсказке будет разброс значений за период (тонкая линия на фоне).');
    if (!reduced()) firstView(host, function () {
      var t0 = 0; (function f(t) {
        t0 = t0 || t; var k = Math.max(0, Math.min(1, (t - t0) / 700)), e = 1 - Math.pow(1 - k, 3);
        cards.forEach(function (c) { if (c.unit !== 'B') c.num.textContent = k < 1 ? parts(c.value * e, c.unit)[0] : c.text; });
        if (k < 1) requestAnimationFrame(f);
      })(performance.now());
    });
  };

  /* ---------- mon-logs: Explore с Loki ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  W['mon-logs'] = function (host) {
    var lines = json(host.dataset.lines, null), hl = host.dataset.highlight || '';
    if (!Array.isArray(lines) || !lines.length || lines.length > 200 || !lines.every(function (l) { return l && typeof l.line === 'string'; }))
      throw new Error('data-lines: массив объектов {"ts", "level", "labels", "line"}.');
    var v = begin(host, 'Explore: логи', host.dataset.query || '');
    var lv = function (l) { return LV[String(l.level || '').toLowerCase()] || 'gray'; };
    var times = lines.map(function (l) { var t = Date.parse(String(l.ts || '').replace(' ', 'T')); return isFinite(t) ? t : null; });
    var good = times.every(function (t) { return t !== null; }), min = Math.min.apply(null, times), max = Math.max.apply(null, times);
    if (!good || min === max) { times = lines.map(function (_, i) { return lines.length - 1 - i; }); min = 0; max = Math.max(1, lines.length - 1); good = false; }
    var nb = Math.min(30, Math.max(8, lines.length)), buckets = [];
    for (var b = 0; b < nb; b++) buckets.push({ info: 0, warn: 0, error: 0, debug: 0, gray: 0, total: 0 });
    lines.forEach(function (l, i) {
      var k = Math.min(nb - 1, Math.floor((times[i] - min) / (max - min) * nb)), c = lv(l);
      c = c === 'green' ? 'info' : c === 'yellow' ? 'warn' : c === 'red' ? 'error' : c === 'blue' ? 'debug' : 'gray';
      buckets[k][c]++; buckets[k].total++;
    });
    function clock(ms) { if (!good) return ''; var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
    var counts = { green: 0, yellow: 0, red: 0, blue: 0, gray: 0 }; lines.forEach(function (l) { counts[lv(l)]++; });
    var vol = html('div', undefined, 'mu-volume');
    var vh = html('div', undefined, 'mu-sec'); vh.appendChild(html('span', 'Log volume'));
    [['red', 'error'], ['yellow', 'warn'], ['green', 'info'], ['blue', 'debug'], ['gray', 'other']].forEach(function (p) {
      if (!counts[p[0]]) return; var ch = html('span', undefined, 'mu-lv-chip mu-' + p[0]); ch.appendChild(html('i'));
      ch.appendChild(document.createTextNode(p[1] + ' ' + counts[p[0]])); vh.appendChild(ch);
    });
    vol.appendChild(vh);
    var order = [['error', 'red'], ['warn', 'yellow'], ['info', 'green'], ['debug', 'blue'], ['gray', 'gray']], peak = Math.max.apply(null, buckets.map(function (x) { return x.total; })), geo = {}, grow = 1;
    function draw() {
      var Wd = v.canvas(92), left = 28, right = Wd - 12, top = 8, bottom = 70, bw = (right - left) / nb;
      geo = { left: left, bw: bw };
      [0, peak].forEach(function (t) { v.add('line', { x1: left, x2: right, y1: bottom - t / peak * (bottom - top), y2: bottom - t / peak * (bottom - top), class: 'mu-grid' }); v.label(left - 6, bottom - t / peak * (bottom - top) + 4, String(t), 'mu-t', 'end'); });
      buckets.forEach(function (bk, i) {
        var y = bottom;
        order.forEach(function (o) {
          if (!bk[o[0]]) return; var h = bk[o[0]] / peak * (bottom - top) * grow;
          v.add('rect', { x: left + i * bw + 1, y: y - h, width: Math.max(1, bw - 2), height: h, rx: 1, class: 'mu-area mu-' + o[1], opacity: 0.9 }); y -= h;
        });
      });
      if (good) { v.label(left, 87, clock(min), 'mu-t', 'start'); v.label(right, 87, clock(max), 'mu-t', 'end'); }
    }
    draw(); vol.appendChild(v.svg); v.stage.insertBefore(vol, v.stage.lastChild);
    v.hover(function (e, q) {
      var k = Math.max(0, Math.min(nb - 1, Math.floor((q.x - geo.left) / geo.bw))), bk = buckets[k];
      var t = '<b>' + (good ? clock(min + k / nb * (max - min)) : 'интервал ' + (k + 1)) + '</b>' + (bk.total ? '' : '<br>строк нет');
      order.forEach(function (o) { if (bk[o[0]]) t += '<br><span class="viz-sw mu-' + o[1] + '"></span>' + o[0] + ': <b>' + bk[o[0]] + '</b>'; });
      v.showTip(t, e.clientX, e.clientY);
    });
    v.onResize(draw);
    var sec = html('div', undefined, 'mu-sec'); sec.style.borderTop = '1px solid var(--line)'; sec.appendChild(html('span', 'Logs (' + lines.length + ')'));
    var wrap = html('button', 'Перенос строк: да', 'mu-wrap'); wrap.type = 'button'; wrap.setAttribute('aria-pressed', 'true'); sec.appendChild(wrap);
    var list = html('div', undefined, 'mu-logs');
    v.stage.insertBefore(sec, v.stage.lastChild); v.stage.insertBefore(list, v.stage.lastChild);
    wrap.addEventListener('click', function () {
      var on = wrap.getAttribute('aria-pressed') !== 'true'; wrap.setAttribute('aria-pressed', on); wrap.textContent = 'Перенос строк: ' + (on ? 'да' : 'нет'); list.classList.toggle('mu-nowrap', !on);
    });
    function mark(s) { var e = esc(s); return hl ? e.split(esc(hl)).join('<mark>' + esc(hl) + '</mark>') : e; }
    function table(title, obj) {
      var keys = Object.keys(obj); if (!keys.length) return '';
      return '<h4>' + title + '</h4><table>' + keys.map(function (k) { var val = obj[k]; return '<tr><th>' + esc(k) + '</th><td>' + mark(typeof val === 'object' && val ? JSON.stringify(val) : String(val)) + '</td></tr>'; }).join('') + '</table>';
    }
    lines.forEach(function (l, i) {
      var r = html('div', undefined, 'mu-row mu-' + lv(l)); r.style.setProperty('--i', Math.min(i, 12)); r.tabIndex = 0; r.setAttribute('role', 'button'); r.setAttribute('aria-expanded', 'false');
      r.appendChild(html('span', String(l.ts || ''), 'ts'));
      var m = html('span', undefined, 'msg'); m.innerHTML = mark(l.line); r.appendChild(m);
      var det = null;
      function toggle() {
        if (det) { det.remove(); det = null; r.setAttribute('aria-expanded', 'false'); return; }
        var f = null; if (/^\s*\{/.test(l.line)) f = json(l.line, null);
        det = html('div', undefined, 'mu-fields'); det.innerHTML = table('Labels', l.labels || {}) + (f && typeof f === 'object' ? table('Fields', f) : '') || '<h4>Нет полей</h4>';
        det.addEventListener('click', function (e) { e.stopPropagation(); }); r.appendChild(det); r.setAttribute('aria-expanded', 'true');
      }
      r.addEventListener('click', toggle);
      r.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); toggle(); } });
      list.appendChild(r);
    });
    var err = counts.red, first = lines.filter(function (l) { return lv(l) === 'red'; })[0];
    finish(host, v, 'Так выглядит Explore в Grafana: сверху запрос и график «сколько строк в каждый момент» (красное это ошибки), ниже сами строки, новые сверху.' + (err ? ' Здесь ' + err + ' ' + L.plural(err, 'строка', 'строки', 'строк') + ' с ошибкой' + (hl ? ', подсвечено «' + esc(hl) + '»' : '') + '.' : ''),
      'нажми на строку: раскроются метки и поля. Наведи на столбик графика, чтобы увидеть, сколько строк какого уровня в этом интервале.' + (first ? '' : ''));
    if (!reduced()) { list.classList.remove('mu-rows-in'); grow = 0; draw(); firstView(host, function () { list.classList.add('mu-rows-in'); var t0 = 0; (function f(t) { t0 = t0 || t; grow = Math.max(0, Math.min(1, (t - t0) / 600)); draw(); if (grow < 1) requestAnimationFrame(f); })(performance.now()); }); }
  };

  /* ---------- mon-trace: водопад Tempo ---------- */
  function dur(ms) { return ms >= 1000 ? fmt(ms / 1000, 2) + ' s' : ms >= 10 ? fmt(ms, 0) + ' ms' : fmt(ms, 1) + ' ms'; }
  W['mon-trace'] = function (host) {
    var spans = json(host.dataset.spans, null);
    if (!Array.isArray(spans) || !spans.length || spans.length > 80 || !spans.every(function (s) { return s && typeof s.id === 'string' && typeof s.name === 'string' && isNum(s.start) && isNum(s.dur); }))
      throw new Error('data-spans: массив {"id", "parent", "service", "name", "start", "dur", "status"} в мс.');
    var tid = host.dataset.traceId || '';
    host.classList.add('mu');
    var v = begin(host, 'Trace', null);
    var byId = {}, kids = {}, svc = [];
    spans.forEach(function (s) { byId[s.id] = s; if (svc.indexOf(s.service) < 0) svc.push(s.service); });
    spans.forEach(function (s) { var p = s.parent && byId[s.parent] && s.parent !== s.id ? s.parent : ''; (kids[p] = kids[p] || []).push(s); });
    var total = Math.max.apply(null, spans.map(function (s) { return s.start + s.dur; })) || 1;
    var depth = {}, seen = {}, flat = [];
    (function walk(p, d) {
      (kids[p] || []).slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (s) {
        if (seen[s.id]) return; seen[s.id] = 1; depth[s.id] = d; flat.push(s); walk(s.id, d + 1);
      });
    })('', 0);
    var errs = spans.filter(function (s) { return s.status === 'error'; }).length;
    var meta = html('div', undefined, 'mu-meta');
    [['Trace ID', tid || '—'], ['Duration', dur(total)], ['Spans', spans.length], ['Services', svc.length]].concat(errs ? [['Errors', errs]] : []).forEach(function (m) {
      var s = html('span', m[0] + ' '); s.appendChild(html('b', String(m[1]))); meta.appendChild(s);
    });
    var sc = html('div', undefined, 'mu-legend');
    svc.forEach(function (s, i) { var b = html('span', undefined, 'mu-' + COLORS[[2, 5, 0, 3, 1][i % 5]]); b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:.8rem'; b.appendChild(html('span', undefined, 'mu-sw')); var t = html('span', s); t.style.color = 'var(--text)'; b.appendChild(t); sc.appendChild(b); });
    v.stage.insertBefore(sc, v.stage.children[1]); v.stage.insertBefore(meta, sc);
    var scroll = html('div', undefined, 'mu-scroll'), wf = html('div', undefined, 'mu-wf'); scroll.appendChild(wf); v.stage.insertBefore(scroll, v.stage.lastChild);
    var animate = !reduced(); if (animate) wf.classList.add('mu-pre');
    var collapsed = {}, open = {}; if (host.dataset.focus) open[host.dataset.focus] = true;
    function sv(s) { return [2, 5, 0, 3, 1][svc.indexOf(s.service) % 5]; }
    function render() {
      wf.replaceChildren();
      var ruler = html('div', undefined, 'mu-tr mu-ruler'); ruler.appendChild(html('div', 'Service & Operation', 'mu-name')); ruler.firstChild.style.color = 'var(--muted)';
      var rt = html('div', undefined, 'mu-time'); [0, 1, 2, 3, 4].forEach(function (k) { var s = html('span', k ? dur(total * k / 4) : '0'); s.style.left = (k * 25) + '%'; rt.appendChild(s); }); ruler.appendChild(rt); wf.appendChild(ruler);
      var skip = null, idx = 0;
      flat.forEach(function (s) {
        if (skip !== null && depth[s.id] > skip) return; skip = null;
        if (collapsed[s.id]) skip = depth[s.id];
        var row = html('div', undefined, 'mu-tr' + (s.id === host.dataset.focus ? ' mu-focus' : '')); row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-expanded', open[s.id] ? 'true' : 'false');
        var nm = html('div', undefined, 'mu-name'); nm.style.paddingLeft = (12 + depth[s.id] * 14) + 'px';
        if ((kids[s.id] || []).length) {
          var tw = html('button', collapsed[s.id] ? '▸' : '▾', 'mu-twist'); tw.type = 'button'; tw.setAttribute('aria-label', collapsed[s.id] ? 'Развернуть' : 'Свернуть');
          tw.addEventListener('click', function (e) { e.stopPropagation(); collapsed[s.id] = !collapsed[s.id]; render(); }); nm.appendChild(tw);
        } else nm.appendChild(html('span', undefined, 'sp'));
        if (s.status === 'error') nm.appendChild(html('span', '●', 'err'));
        nm.appendChild(html('span', s.service || '', 'svc')); nm.appendChild(html('span', s.name, 'op')); row.appendChild(nm);
        var tm = html('div', undefined, 'mu-time'), pc = s.start / total * 100, wd = s.dur / total * 100;
        var bar = html('span', undefined, 'mu-bar mu-' + (s.status === 'error' ? 'red' : COLORS[sv(s)])); bar.style.left = pc + '%'; bar.style.width = wd + '%'; bar.style.setProperty('--i', idx++);
        if (s.id === host.dataset.focus) bar.style.boxShadow = '0 0 0 2px var(--bg),0 0 0 3.5px var(--text)';
        tm.appendChild(bar);
        var bl = html('span', dur(s.dur), 'mu-bar-l');
        if (wd > 30) { bl.style.right = 'calc(' + (100 - pc - wd) + '% + 6px)'; bl.style.color = 'var(--bg)'; bl.style.fontWeight = '600'; }
        else if (pc + wd < 72) bl.style.left = 'calc(' + (pc + wd) + '% + 6px)'; else bl.style.right = 'calc(' + (100 - pc) + '% + 6px)';
        tm.appendChild(bl); row.appendChild(tm); wf.appendChild(row);
        function tip(e) { v.showTip('<b>' + esc(s.name) + '</b><br>' + esc(s.service || '') + '<br>' + dur(s.dur) + ', ' + fmt(s.dur / total * 100, s.dur / total < 0.1 ? 1 : 0) + '% трейса<br>старт +' + dur(s.start) + (s.status === 'error' ? '<br><span style="color:var(--mu-red)">ошибка</span>' : ''), e.clientX, e.clientY); }
        row.addEventListener('pointermove', tip); row.addEventListener('pointerleave', v.hideTip);
        function toggle() { open[s.id] = !open[s.id]; render(); var rows = wf.querySelectorAll('.mu-tr[data-id="' + s.id + '"]'); if (rows[0]) rows[0].focus(); }
        row.dataset.id = s.id; row.addEventListener('click', toggle);
        row.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); toggle(); } });
        if (open[s.id]) {
          var at = html('div', undefined, 'mu-attrs'), rows = [['service', s.service], ['span.id', s.id], ['start', '+' + dur(s.start)], ['duration', dur(s.dur)], ['status', s.status || 'ok']];
          Object.keys(s.attrs || {}).forEach(function (k) { rows.push([k, typeof s.attrs[k] === 'object' ? JSON.stringify(s.attrs[k]) : s.attrs[k]]); });
          at.innerHTML = '<table>' + rows.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>'; wf.appendChild(at);
        }
      });
    }
    render();
    var f = byId[host.dataset.focus];
    finish(host, v, 'Это водопад трейса, как в Tempo: каждая строка спан (кусок работы), полоска показывает, когда он начался и сколько шёл. Вложенные спаны отодвинуты вправо.' + (f ? ' Выделен спан «' + esc(f.name) + '» (' + esc(f.service || '') + '): ' + dur(f.dur) + ', ' + Math.round(f.dur / total * 100) + '% всего времени' + (f.status === 'error' ? ', с ошибкой.' : '.') : ''),
      'нажми на строку: покажутся атрибуты спана. Стрелка слева сворачивает вложенные спаны.');
    if (animate) firstView(host, function () { wf.classList.remove('mu-pre'); });
  };

  /* ---------- mon-alert: жизнь алерта ---------- */
  var STATE = { inactive: ['Inactive', 'gray'], pending: ['Pending', 'yellow'], firing: ['Firing', 'red'], resolved: ['Resolved', 'green'] };
  W['mon-alert'] = function (host) {
    var xs = arr(host.dataset.x, 'data-x').map(String), vals = arr(host.dataset.values, 'data-values', true);
    var thr = Number(host.dataset.threshold), forN = Math.max(0, Math.round(Number(host.dataset.for || 0))), gw = Math.max(0, Math.round(Number(host.dataset.groupWait || 0)));
    if (vals.length !== xs.length || !vals.every(function (n) { return n === null || isNum(n); }) || !isNum(thr)) throw new Error('mon-alert: data-values той же длины, что data-x, и числовой data-threshold.');
    var unit = host.dataset.unit || '', name = host.dataset.name || 'Alert', n = xs.length;
    var st = [], run = 0, notify = null, firingFrom = null;
    vals.forEach(function (x, i) {
      var c = x !== null && x > thr, prev = st[i - 1];
      if (c) { run++; st.push(run > forN ? 'firing' : 'pending'); if (run === forN + 1) firingFrom = i; }
      else { st.push(prev === 'firing' || prev === 'resolved' ? 'resolved' : 'inactive'); run = 0; }
    });
    if (firingFrom !== null) { var k = firingFrom + gw; if (k < n && st[k] === 'firing') notify = k; }
    var pendFrom = st.indexOf('pending'), resFrom = st.indexOf('resolved');
    var v = begin(host, 'Alert: ' + name, 'expr: value > ' + thr + (forN ? '   for: ' + forN + ' ' + L.plural(forN, 'точка', 'точки', 'точек') : '') + (gw ? '   group_wait: ' + gw : ''));
    var series = [{ name: name, values: vals, color: 'blue' }];
    var strip = 22;
    var chart = seriesChart(v, {
      xs: xs, series: series, unit: unit, thresholds: [{ value: thr, color: 'red', label: 'threshold' }], legendLast: false, height: 230, stripH: strip + 34,
      tipExtra: function (i) { return '<br>состояние: <b>' + STATE[st[i]][0] + '</b>'; },
      drawStrip: function (c) {
        var y = c.bottom + 30, step = n > 1 ? (c.right - c.left) / (n - 1) : 0, i = 0;
        c.put('text', { x: c.left - 8, y: y + 15, 'text-anchor': 'end', class: 'mu-t' }, 'State');
        while (i < n) {
          var j = i; while (j + 1 < n && st[j + 1] === st[i]) j++;
          var x0 = i === 0 ? c.left : c.X(i) - step / 2, x1 = j === n - 1 ? c.right : c.X(j) + step / 2, s = STATE[st[i]];
          c.put('rect', { x: x0, y: y, width: Math.max(0, x1 - x0), height: strip, class: 'mu-area mu-seg mu-' + s[1], opacity: st[i] === 'inactive' ? 0.3 : 0.85 });
          if (x1 - x0 > s[0].length * 7 + 8) c.put('text', { x: (x0 + x1) / 2, y: y + 15, 'text-anchor': 'middle', style: 'font-size:12px;font-weight:600;fill:' + (st[i] === 'inactive' ? 'var(--text)' : 'var(--bg)') }, s[0]);
          i = j + 1;
        }
        if (notify !== null && c.X(notify) <= c.revealX) {
          var nx = c.X(notify), end = nx > c.right - 150;
          c.put('line', { x1: nx, x2: nx, y1: c.top, y2: y - 2, class: 'mu-annline' });
          c.put('polygon', { points: (nx - 5) + ',' + (y + strip + 12) + ' ' + (nx + 5) + ',' + (y + strip + 12) + ' ' + nx + ',' + (y + strip + 5), class: 'mu-flag' });
          c.put('text', { x: nx + (end ? -8 : 8), y: y + strip + 14, 'text-anchor': end ? 'end' : 'start', class: 'mu-t', style: 'fill:var(--mu-blue)' }, c.W < 420 ? 'уведомление' : 'Alertmanager: уведомление');
        }
      }
    });
    dataTable(host, xs, series, unit);
    var txt = pendFrom < 0 && firingFrom === null ? 'Метрика ни разу не поднялась выше порога ' + fv(thr, unit) + ': алерт остаётся Inactive.' : '';
    if (!txt) {
      var first = st.findIndex(function (s) { return s !== 'inactive'; });
      txt = 'Условие «значение выше ' + fv(thr, unit) + '» впервые выполнилось в ' + esc(xs[first]) + '. ' + (forN && pendFrom >= 0 ? 'Дальше алерт ждёт (Pending) ' + forN + ' ' + L.plural(forN, 'точку', 'точки', 'точек') + ', чтобы не сработать на случайный всплеск. ' : '') +
        (firingFrom === null ? 'Но условие держалось недостаточно долго, и алерт так и не стал Firing: уведомления не будет.' : 'Firing с ' + esc(xs[firingFrom]) + '. ' + (notify !== null ? 'Alertmanager отправит уведомление в ' + esc(xs[notify]) + (gw ? ' (после group_wait)' : '') + '.' : 'Алерт погас раньше, чем закончился group_wait, поэтому уведомление не уйдёт.') + (resFrom >= 0 ? ' Resolved с ' + esc(xs[resFrom]) + '.' : ''));
    }
    finish(host, v, txt, 'наведи на график: в подсказке время, значение и состояние алерта в эту минуту. Нажми «Показать ещё раз», чтобы увидеть, как состояния сменяются во времени.');
    // Анимация: график и полоса состояний «прорисовываются» слева направо.
    var a = L.animate(v, function (dt) { var k = Math.min(1, chart.reveal + dt / 5); chart.setReveal(k); return k < 1; }, function () { chart.setReveal(1); }, function () { chart.setReveal(0); });
    if (!L.motion.matches) chart.setReveal(0);
    return a;
  };

  /* ---------- mon-targets: Status -> Targets в Prometheus ---------- */
  W['mon-targets'] = function (host) {
    var targets = json(host.dataset.targets, null);
    if (!Array.isArray(targets) || !targets.length || targets.length > 60 || !targets.every(function (t) { return t && typeof t.job === 'string' && typeof t.endpoint === 'string'; }))
      throw new Error('data-targets: массив {"job", "endpoint", "state", "labels", "last", "duration", "error"}.');
    var v = begin(host, 'Targets', '');
    var jobs = [], by = {}; targets.forEach(function (t) { if (!by[t.job]) { by[t.job] = []; jobs.push(t.job); } by[t.job].push(t); });
    var bad = targets.filter(function (t) { return t.state !== 'up'; }).length, only = false, collapsed = {};
    var tabs = html('div', undefined, 'mu-tabs'), all = html('button', 'All (' + targets.length + ')', 'mu-tab'), unh = html('button', 'Unhealthy (' + bad + ')', 'mu-tab');
    [all, unh].forEach(function (b) { b.type = 'button'; tabs.appendChild(b); });
    v.stage.insertBefore(tabs, v.stage.children[1]);
    var body = html('div'); v.stage.insertBefore(body, v.stage.lastChild);
    var MEAN = { up: 'последний запрос за метриками прошёл успешно', down: 'Prometheus не смог получить метрики с этого адреса', unknown: 'этот адрес ещё не опрашивали' };
    function render() {
      all.setAttribute('aria-pressed', !only); unh.setAttribute('aria-pressed', only); body.replaceChildren();
      jobs.forEach(function (j) {
        var ts = by[j].filter(function (t) { return !only || t.state !== 'up'; }); if (!ts.length) return;
        var up = by[j].filter(function (t) { return t.state === 'up'; }).length, dn = by[j].filter(function (t) { return t.state === 'down'; }).length, g = html('div', undefined, 'mu-grp'), h = html('div', undefined, 'mu-gh');
        h.appendChild(html('b', j + ' (' + up + '/' + by[j].length + ' up)'));
        var bd = html('span', undefined, 'mu-badge mu-' + (up === by[j].length ? 'green' : !dn ? 'gray' : up ? 'orange' : 'red')); bd.appendChild(html('span', up === by[j].length ? 'HEALTHY' : !dn ? 'UNKNOWN' : up ? 'DEGRADED' : 'DOWN')); h.appendChild(bd);
        var tg = html('button', collapsed[j] ? 'show more' : 'show less'); tg.type = 'button'; tg.setAttribute('aria-expanded', !collapsed[j]);
        tg.addEventListener('click', function () { collapsed[j] = !collapsed[j]; render(); }); h.appendChild(tg); g.appendChild(h);
        if (!collapsed[j]) {
          var sc = html('div', undefined, 'mu-scroll'), t = html('table', undefined, 'mu-tbl'); sc.appendChild(t);
          t.innerHTML = '<thead><tr><th>Endpoint</th><th>State</th><th>Labels</th><th class="n">Last scrape</th><th class="n">Scrape duration</th><th>Error</th></tr></thead>';
          var tb = html('tbody');
          ts.forEach(function (x) {
            var st = x.state === 'up' || x.state === 'down' ? x.state : 'unknown', tr = html('tr');
            tr.innerHTML = '<td class="ep mono"><a>' + esc(x.endpoint) + '</a></td><td><span class="mu-badge mu-' + (st === 'up' ? 'green' : st === 'down' ? 'red' : 'gray') + '"><span>' + st.toUpperCase() + '</span></span></td><td>' +
              Object.keys(x.labels || {}).map(function (k) { return '<span class="mu-lab">' + esc(k) + '="' + esc(x.labels[k]) + '"</span>'; }).join('') + '</td><td class="n">' + esc(x.last || '') + '</td><td class="n">' + esc(x.duration || '') + '</td><td class="mu-err">' + esc(x.error || '') + '</td>';
            tr.addEventListener('pointermove', function (e) { v.showTip('<b>' + esc(x.endpoint) + '</b><br>' + st.toUpperCase() + ': ' + MEAN[st] + (x.error ? '<br><span style="color:var(--mu-red)">' + esc(x.error) + '</span>' : ''), e.clientX, e.clientY); });
            tr.addEventListener('pointerleave', v.hideTip); tb.appendChild(tr);
          });
          t.appendChild(tb); g.appendChild(sc);
        }
        body.appendChild(g);
      });
      if (!body.firstChild) body.appendChild(html('p', 'Все цели в порядке: нет ни одной с состоянием down.', 'mu-foot'));
    }
    all.addEventListener('click', function () { only = false; render(); }); unh.addEventListener('click', function () { only = true; render(); });
    render();
    var down = targets.filter(function (t) { return t.state === 'down'; })[0];
    finish(host, v, 'Это страница Status → Targets в Prometheus: цели сгруппированы по job, в скобках «сколько работают из скольких». ' + (bad ? 'Здесь ' + bad + ' ' + L.plural(bad, 'цель не работает', 'цели не работают', 'целей не работают') + (down && down.error ? ': в колонке Error причина («' + esc(down.error) + '»).' : '.') : 'Все цели в состоянии UP.'),
      'нажми Unhealthy: останутся только проблемные цели. Наведи на строку, чтобы увидеть, что значит состояние.');
    if (!reduced()) { body.classList.add('mu-rows-in'); body.querySelectorAll('tr').forEach(function (r, i) { r.style.setProperty('--i', Math.min(i, 12)); }); body.style.visibility = 'hidden'; firstView(host, function () { body.style.visibility = ''; body.querySelectorAll('tbody tr').forEach(function (r, i) { r.style.animation = 'mu-fade .35s both'; r.style.animationDelay = Math.min(i, 12) * 40 + 'ms'; }); }); }
  };

  /* ---------- mon-table: вкладка Table ---------- */
  W['mon-table'] = function (host) {
    var cols = arr(host.dataset.columns, 'data-columns'), rows = arr(host.dataset.rows, 'data-rows');
    if (!rows.every(function (r) { return Array.isArray(r); })) throw new Error('data-rows: массив массивов.');
    var hc = host.dataset.highlightCol, hr = host.dataset.highlightRow, hci = hc === undefined || hc === '' ? -1 : (isNaN(Number(hc)) ? cols.indexOf(hc) : Number(hc)), hri = hr === undefined || hr === '' ? -1 : Number(hr);
    var v = begin(host, 'Table', host.dataset.query || '');
    var tabs = html('div', undefined, 'mu-tabs'), tt = html('button', 'Table', 'mu-tab'), gt = html('button', 'Graph', 'mu-tab');
    tt.type = gt.type = 'button'; tt.setAttribute('aria-selected', 'true'); gt.disabled = true; gt.title = 'Здесь показана только вкладка Table'; tabs.appendChild(tt); tabs.appendChild(gt);
    v.stage.insertBefore(tabs, v.stage.children[1]);
    var sc = html('div', undefined, 'mu-scroll'), t = html('table', undefined, 'mu-tbl'); sc.appendChild(t);
    function numeric(x) { return typeof x === 'number' || (typeof x === 'string' && /^-?\d+([.,]\d+)?(e[+-]?\d+)?$/i.test(x.trim())); }
    var numCol = cols.map(function (_, i) { return rows.length && rows.every(function (r) { return r[i] == null || numeric(r[i]); }); });
    t.innerHTML = '<thead><tr>' + cols.map(function (c, i) { return '<th' + (numCol[i] ? ' class="n"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead>';
    var tb = html('tbody');
    rows.forEach(function (r, ri) {
      var tr = html('tr', undefined, ri === hri ? 'hr' : '');
      cols.forEach(function (c, i) {
        var td = html('td', r[i] == null ? '' : String(r[i]), (numCol[i] ? 'n' : 'mono') + (i === hci && (hri < 0 || ri === hri) ? ' hc' : '')); tr.appendChild(td);
        td.addEventListener('pointermove', function (e) { v.showTip('<b>' + esc(c) + '</b><br>' + esc(r[i] == null ? '' : r[i]), e.clientX, e.clientY); });
      });
      tr.addEventListener('pointerleave', v.hideTip); tb.appendChild(tr);
    });
    t.appendChild(tb); v.stage.insertBefore(sc, v.stage.lastChild);
    v.stage.insertBefore(html('div', 'Result series: ' + rows.length, 'mu-foot'), v.stage.lastChild);
    finish(host, v, 'Вкладка Table показывает результат запроса «как есть»: одна строка на одну временную серию, значение в последней колонке. Это сырые числа, на которых строится график.' + (hci >= 0 && hri >= 0 && rows[hri] ? ' Выделено значение ' + esc(rows[hri][hci]) + '.' : ''),
      'наведи на ячейку: подсказка назовёт колонку и значение. Если таблица шире блока, её можно прокрутить вбок.');
    if (!reduced()) { tb.querySelectorAll('tr').forEach(function (r, i) { r.style.opacity = 0; r.style.animation = 'none'; }); firstView(host, function () { tb.querySelectorAll('tr').forEach(function (r, i) { r.style.opacity = ''; r.style.animation = 'mu-fade .35s both'; r.style.animationDelay = Math.min(i, 12) * 40 + 'ms'; }); }); }
  };
})();
