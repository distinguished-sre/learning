/* Главная курса. Без библиотек. Подключается только в layout home.
   Если анимации отключены в системе (prefers-reduced-motion), всё показывается сразу в конечном виде. */
(function () {
  'use strict';
  window.__homeReady = true;

  var doc = document, root = doc.documentElement, body = doc.body;
  var home = doc.querySelector('.home');
  if (!home) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

  /* ---------- шапка прозрачная, пока страница наверху ---------- */
  function onScroll() { body.classList.toggle('scrolled', window.scrollY > 12); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- появление блоков ---------- */
  var reveals = $$('.reveal');
  if (still || !hasIO) reveals.forEach(function (e) { e.classList.add('shown'); });
  else {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('shown'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(function (e) { rio.observe(e); });
  }

  /* ---------- прогресс: продолжить с первого непройденного урока ---------- */
  var done = {};
  try { (JSON.parse(localStorage.getItem('lt:done') || '[]') || []).forEach(function (i) { done[i] = 1; }); } catch (e) {}
  var lessons = $$('.nav-lesson');
  var nDone = lessons.filter(function (a) { return done[a.getAttribute('data-id')]; }).length;
  if (nDone) {
    var next = lessons.filter(function (a) { return !done[a.getAttribute('data-id')]; })[0];
    $$('[data-continue]').forEach(function (a) {
      var txt = $('[data-continue-text]', a);
      if (next) { a.href = next.href; txt.textContent = 'Продолжить: урок ' + next.getAttribute('data-id'); }
      else { a.href = '#path'; txt.textContent = 'Курс пройден, открыть программу'; }
    });
    var hp = $('[data-home-progress]');
    if (hp) { hp.hidden = false; hp.textContent = '✓ пройдено ' + nDone + ' из ' + lessons.length + ' уроков'; }
    $$('[data-stage-ids]').forEach(function (s) {
      var ids = s.getAttribute('data-stage-ids').split(' ');
      var n = ids.filter(function (i) { return done[i]; }).length;
      if (n) { s.hidden = false; s.textContent = n === ids.length ? '✓ пройдено' : n + ' из ' + ids.length; }
    });
  }

  /* «Все уроки списком» открывает боковое меню курса */
  $$('[data-open-menu]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = $('.menu-btn'); if (!m) return;
      m.click();
      /* фокус в меню, чтобы Tab шёл по урокам, а не по странице под затемнением */
      var first = $('.sidebar a'); if (first) setTimeout(function () { first.focus(); }, 50);
    });
  });

  /* ---------- краш-тест: время ответа растёт резко у предела ---------- */
  var crash = $('[data-crash]');
  if (crash) {
    /* Та же формула, что нарисовала кривую в разметке: время = 0,3 с / (1 - покупатели / 1800). */
    var CAP = 1800, BASE = 0.3, MAXU = 1750;
    var px = function (u) { return 40 + u / CAP * 510; };
    var py = function (t) { return 10 + 220 * (1 - Math.min(t, 6) / 6); };
    var inp = $('[data-crash-in]', crash), dot = $('[data-crash-dot]', crash), line = $('[data-crash-line]', crash);
    var outU = $('[data-crash-users]', crash), outT = $('[data-crash-time]', crash), st = $('[data-crash-state]', crash);
    var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    var show = function (u) {
      var t = BASE / (1 - u / CAP), x = px(u), y = py(t);
      dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
      line.setAttribute('x1', x.toFixed(1)); line.setAttribute('x2', x.toFixed(1));
      outU.textContent = fmt(Math.round(u / 10) * 10);
      outT.textContent = (t < 10 ? t.toFixed(1) : Math.round(t)).toString().replace('.', ',') + ' с';
      var cls = t < 1 ? 'ok' : (t < 3 ? 'warn' : 'bad');
      inp.setAttribute('aria-valuetext', outU.textContent + ' покупателей, страница за ' + outT.textContent);
      st.className = 'crash-state ' + cls;
      st.textContent = cls === 'ok' ? 'Быстро' : (cls === 'warn' ? 'Уже медленно' : 'Покупатели уходят');
    };
    /* Сам двигает ползунок туда и обратно, пока график на экране и человек его не тронул. */
    var auto = !still, visible = false, u = 0, dir = 1, pauseUntil = 0, last = 0, raf = 0;
    var tick = function (now) {
      raf = 0;
      if (!auto || !visible) return;
      var dt = last ? Math.min(now - last, 50) : 16; last = now;
      if (now >= pauseUntil) {
        u += dir * dt * 0.28;
        if (u >= MAXU) { u = MAXU; dir = -1; pauseUntil = now + 1600; }
        if (u <= 0) { u = 0; dir = 1; pauseUntil = now + 900; }
        inp.value = u; show(u);
      }
      raf = requestAnimationFrame(tick);
    };
    var stop = function () { auto = false; };
    inp.addEventListener('input', function () { stop(); show(+inp.value); });
    inp.addEventListener('pointerdown', stop);
    inp.addEventListener('keydown', stop);
    show(+inp.value);
    if (auto) {
      u = 0; inp.value = 0; show(0);
      var inView = false;
      var start = function () { visible = inView && !doc.hidden; last = 0; if (visible && auto && !raf) raf = requestAnimationFrame(tick); };
      /* кривая рисуется 2 секунды, точка трогается после */
      setTimeout(function () {
        if (hasIO) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; start(); }).observe(crash);
        else { inView = true; start(); }
      }, 2000);
      doc.addEventListener('visibilitychange', start);
    }
  }

  /* ---------- калькулятор темпа ---------- */
  var calc = $('[data-calc]');
  if (calc) {
    var HOURS = parseFloat(home.getAttribute('data-hours')) || 128;
    var inH = $('[data-in="h"]', calc), inD = $('[data-in="d"]', calc);
    var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    var plural = function (n, a, b, c) { var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c); };
    var upd = function () {
      var h = parseFloat(inH.value), d = parseInt(inD.value, 10);
      $('[data-out="h"]', calc).textContent = String(h).replace('.', ',');
      $('[data-out="d"]', calc).textContent = d;
      var weeks = Math.ceil(HOURS / (h * d));
      $('[data-res-weeks]', calc).textContent = weeks;
      $('[data-res-unit]', calc).textContent = plural(weeks, 'неделя', 'недели', 'недель');
      var end = new Date(); end.setDate(end.getDate() + weeks * 7);
      var months = Math.round(weeks / 4.35);
      $('[data-res-date]', calc).textContent = 'Если начать сегодня, финиш примерно: ' + MONTHS[end.getMonth()] + ' ' + end.getFullYear() +
        (months >= 2 ? ' (около ' + months + ' ' + plural(months, 'месяца', 'месяцев', 'месяцев') + ')' : '');
    };
    inH.addEventListener('input', upd); inD.addEventListener('input', upd); upd();
  }
})();
