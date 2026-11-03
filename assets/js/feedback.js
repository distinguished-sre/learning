/* Общая форма для всех страниц. Контакты и метаданные приходят из Jekyll. */
(function () {
  'use strict';
  var dialog = document.getElementById('feedback');
  var content = document.getElementById('content');
  if (!dialog || !content || typeof dialog.showModal !== 'function') return;
  var form = dialog.querySelector('form');
  var status = dialog.querySelector('[data-feedback-status]');
  var note = dialog.querySelector('[data-feedback-note]');
  var message = form.elements.message;
  var preview = dialog.querySelector('#feedback-preview');
  var step = 1, context, returnFocus;
  // Длиннее этого ссылка в часть почтовых и мобильных приложений не проходит целиком.
  var LINK_LIMIT = 8000;
  var questions = {
    'Ошибка или неточность': ['Где ошибка?', ['Текст', 'Команда или код', 'Вопрос или ответ теста', 'Схема', 'Другое']],
    'Непонятное объяснение': ['Что помогло бы разобраться?', ['Пример', 'Объяснение проще', 'Схема', 'Разбор по шагам', 'Другое']],
    'Не хватает материала': ['Что добавить?', ['Объяснение темы', 'Пример', 'Практическое задание', 'Вопрос для самопроверки', 'Другое']],
    'Не работает страница': ['Что не работает?', ['Ссылка', 'Тест', 'Схема или виджет', 'Меню или кнопка', 'Другое']],
    'Другое предложение': ['Что хочешь улучшить?', ['Материал курса', 'Удобство сайта', 'Порядок тем', 'Другое']]
  };
  var channels = Array.from(dialog.querySelectorAll('[data-feedback-channel]'));
  channels.forEach(function (a) { a.dataset.contact = a.href; });
  form.noValidate = true;

  function text(el) { return el ? el.textContent.trim() : ''; }
  function selection() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed || !content.contains(sel.anchorNode) || !content.contains(sel.focusNode)) return null;
    var node = sel.getRangeAt(0).startContainer;
    return { element: node.nodeType === 1 ? node : node.parentElement, quote: sel.toString().trim().slice(0, 600) };
  }
  // Снимок выделения до клика: перевод фокуса на кнопку может его убрать.
  // Снимок привязан к нажатой кнопке и живёт недолго после отпускания: сорвавшийся клик его не оставляет.
  // На касании click приходит позже pointerup отдельной задачей, поэтому пауза, а не setTimeout(0).
  var pendingSelection = null, pendingTimer;
  document.addEventListener('pointerdown', function (e) {
    var trigger = e.target.closest('[data-feedback-open]');
    clearTimeout(pendingTimer);
    pendingSelection = trigger ? { trigger: trigger, selection: selection() } : null;
  });
  document.addEventListener('pointerup', function () {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function () { pendingSelection = null; }, 500);
  });
  document.addEventListener('pointercancel', function () { pendingSelection = null; });

  // Последний заголовок перед элементом (или сам элемент, если это заголовок).
  function headingFor(element, selector) {
    var heading = null;
    content.querySelectorAll(selector).forEach(function (h) {
      if (h === element || (h.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) heading = h;
    });
    return heading;
  }
  // Выделение берётся только из того раздела или вопроса, к которому относится кнопка.
  function within(element, selected) {
    if (!element || !selected || !selected.quote) return selected;
    if (element.matches('h2, h3')) {
      return headingFor(selected.element, element.tagName === 'H2' ? 'h2' : 'h2, h3') === element ? selected : null;
    }
    return element.contains(selected.element) ? selected : null;
  }
  function sourceUrl(card, base) {
    if (!card || !card.dataset.questionSource) return '';
    try { return new URL(card.dataset.questionSource, base).href; } catch (e) { return card.dataset.questionSource; }
  }

  function collect(element, selected) {
    var heading = null;
    if (element && content.contains(element)) {
      heading = headingFor(element, 'h2, h3');
    } else {
      content.querySelectorAll('h2, h3').forEach(function (h) { if (h.getBoundingClientRect().top <= 150) heading = h; });
    }
    var url = new URL(dialog.dataset.pageUrl, location.href);
    url.search = '';
    url.hash = heading && heading.id ? heading.id : '';
    var card = element && element.closest('.qz-card');
    return {
      title: dialog.dataset.pageTitle,
      course: dialog.dataset.course,
      topic: dialog.dataset.topic,
      lesson: dialog.dataset.lesson,
      section: text(heading),
      url: url.href,
      quote: selected ? selected.quote : '',
      question: card ? text(card.querySelector('.qz-text')).slice(0, 600) : '',
      questionId: card ? card.dataset.questionId : '',
      questionCode: card ? text(card.querySelector('.qz-code')).slice(0, 1000) : '',
      questionSource: sourceUrl(card, url)
    };
  }

  function showStep(n) {
    step = n;
    status.textContent = '';
    dialog.querySelectorAll('[data-feedback-step]').forEach(function (el) {
      el.hidden = Number(el.dataset.feedbackStep) !== n;
    });
    var current = dialog.querySelector('[data-feedback-step="' + n + '"]');
    current.querySelector('legend, h3').focus();
    dialog.scrollTop = 0;
  }

  function open(options) {
    if (dialog.open) return;
    options = options || {};
    var selected = within(options.element, options.selection || selection());
    var element = options.element || (selected && selected.quote ? selected.element : null);
    context = collect(element, selected);
    returnFocus = options.trigger || document.activeElement;
    form.reset();
    message.setCustomValidity('');
    preview.value = '';
    dialog.querySelector('[data-feedback-context]').textContent = [context.title, context.section].filter(Boolean).join(' · ');
    dialog.querySelector('[data-feedback-quote]').hidden = !context.quote;
    dialog.querySelector('[data-feedback-quote-text]').textContent = context.quote;
    dialog.showModal();
    showStep(1);
  }

  // Для будущих виджетов: LearningFeedback.open({ element: DOMElement }).
  window.LearningFeedback = { open: open };
  document.querySelectorAll('[data-feedback-open]').forEach(function (b) { b.hidden = false; });
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-feedback-open]');
    if (!trigger) return;
    var section = trigger.dataset.feedbackSection;
    var element = section ? document.getElementById(section) : trigger.closest('.qz-card');
    var snapshot = pendingSelection && pendingSelection.trigger === trigger ? pendingSelection.selection : null;
    pendingSelection = null;
    open({ element: element, trigger: trigger, selection: snapshot || selection() });
  });
  dialog.querySelector('[data-feedback-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', function () { if (returnFocus && returnFocus.isConnected) returnFocus.focus(); });
  dialog.querySelectorAll('[data-feedback-back]').forEach(function (b) {
    b.addEventListener('click', function () { showStep(step - 1); });
  });

  function next() {
    var kind = form.querySelector('input[name="kind"]:checked');
    if (!kind) { form.querySelector('[name="kind"]').reportValidity(); return; }
    var question = questions[kind.value];
    var options = dialog.querySelector('[data-feedback-options]');
    // Назад сохраняет уточнение, смена первого ответа создаёт новый опрос.
    if (options.dataset.kind !== kind.value) {
      options.textContent = '';
      options.dataset.kind = kind.value;
      dialog.querySelector('[data-feedback-followup]').textContent = question[0];
      question[1].forEach(function (value) {
        var label = document.createElement('label');
        var input = document.createElement('input');
        input.type = 'radio'; input.name = 'detail'; input.value = value; input.required = true;
        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + value));
        options.appendChild(label);
      });
    }
    showStep(2);
  }
  dialog.querySelector('[data-feedback-next]').addEventListener('click', next);
  message.addEventListener('input', function () { message.setCustomValidity(''); });

  // short: укороченный вариант для ссылки, когда полный текст в неё не помещается.
  function compose(short) {
    var lines = ['Обратная связь по курсу', 'Страница: ' + context.title];
    if (context.course) lines.push('Курс: ' + context.course);
    if (context.topic) lines.push('Тема: ' + context.topic);
    if (context.lesson) lines.push('Урок: ' + context.lesson);
    if (context.section) lines.push('Раздел: ' + context.section);
    lines.push('Ссылка: ' + context.url);
    if (context.question) lines.push('Вопрос теста: ' + (short ? context.question.slice(0, 200) : context.question));
    if (context.questionId) lines.push('ID вопроса: ' + context.questionId);
    if (context.questionSource) lines.push('Раздел урока: ' + context.questionSource);
    if (context.questionCode && !short) lines.push('Код из вопроса:\n' + context.questionCode);
    if (context.quote && form.elements.includeQuote.checked) lines.push('Фрагмент: «' + (short ? context.quote.slice(0, 200) : context.quote) + '»');
    lines.push('', 'Что изменить: ' + form.querySelector('[name="kind"]:checked').value,
      dialog.querySelector('[data-feedback-followup]').textContent + ' ' + form.querySelector('[name="detail"]:checked').value,
      '', short ? message.value.trim().slice(0, 500) : message.value.trim());
    return lines.join('\n');
  }

  // Пробелы и переносы кодируются как %20 и %0A: «+» часть приложений показывает буквально.
  function link(a, body) {
    if (a.dataset.feedbackChannel === 'email') {
      return a.dataset.contact + '?subject=' + encodeURIComponent('Обратная связь: ' + context.title) +
        '&body=' + encodeURIComponent(body);
    }
    return a.dataset.contact + '?text=' + encodeURIComponent(body);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (step === 1) { next(); return; }
    if (step !== 2) return;
    var detail = form.querySelector('[name="detail"]:checked');
    if (!detail) { form.querySelector('[name="detail"]').reportValidity(); return; }
    message.setCustomValidity(message.value.trim() ? '' : 'Напиши коротко, что нужно изменить.');
    if (!message.reportValidity()) return;
    preview.value = compose(false);
    var shortened = false;
    channels.forEach(function (a) {
      var kind = a.dataset.feedbackChannel;
      if (kind !== 'email' && kind !== 'telegram') return;
      var href = link(a, preview.value);
      if (href.length > LINK_LIMIT) { href = link(a, compose(true)); shortened = true; }
      a.href = href;
    });
    note.hidden = !shortened;
    showStep(3);
  });

  dialog.querySelector('[data-feedback-copy]').addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(preview.value);
      status.textContent = 'Сообщение скопировано. Вставь его в переписку с автором.';
    } catch (e) {
      preview.focus(); preview.select();
      status.textContent = 'Не удалось скопировать. Текст выделен: скопируй его вручную.';
    }
  });

  content.querySelectorAll('[data-prose] h2[id], [data-prose] h3[id]').forEach(function (heading) {
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'feedback-section';
    button.dataset.feedbackOpen = '';
    button.dataset.feedbackSection = heading.id;
    button.textContent = 'Что исправить в этом разделе?';
    button.setAttribute('aria-label', 'Обратная связь: ' + text(heading));
    heading.insertAdjacentElement('afterend', button);
  });

  function addQuizButtons() {
    content.querySelectorAll('.qz-card').forEach(function (card) {
      if (card.querySelector('[data-feedback-open]')) return;
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'feedback-section';
      button.dataset.feedbackOpen = '';
      button.textContent = 'Ошибка в вопросе?';
      card.appendChild(button);
    });
  }
  addQuizButtons();
  new MutationObserver(function (mutations) {
    if (mutations.some(function (m) {
      return Array.from(m.addedNodes).some(function (node) {
        return node.nodeType === 1 && (node.matches('.qz-card') || node.querySelector('.qz-card'));
      });
    })) addQuizButtons();
  }).observe(content, { childList: true, subtree: true });
})();
