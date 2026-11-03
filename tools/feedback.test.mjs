// SITE_DIR=_site node --test tools/feedback.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(ROOT, process.env.SITE_DIR || '_site');
let chromium;
try { ({ chromium } = await import('playwright')); } catch {}
const skip = !chromium ? 'нет playwright' : !existsSync(SITE) ? 'нет собранного сайта' : false;
if (skip && process.env.CI) throw new Error(skip);
let browser, server, origin;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
// Адрес сайта и почта автора из _config.yml: форк или локальная сборка с другим адресом не ломают тест.
const config = readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
const SITE_URL = config.match(/^url:\s*"?([^"\s]+)"?/m)[1];
const EMAIL = config.match(/^email:\s*"?([^"\s]+)"?/m)[1];
const pages = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.html')) {
      const html = readFileSync(file, 'utf8');
      if (html.includes('id="content"')) pages.push({ file, html, url: '/learning/' + path.relative(SITE, file) });
    }
  }
}
function lesson(course = 'load-tester') {
  return pages.find(p => p.url.includes('/' + course + '/') && p.html.includes('data-quiz-bank'));
}
before(async () => {
  if (skip) return;
  walk(SITE);
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const file = path.resolve(SITE, '.' + decodeURIComponent(url.pathname).replace(/^\/learning/, ''));
    if (!file.startsWith(SITE + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
async function pageFor(url = lesson().url, options = {}) {
  const page = await browser.newPage(options);
  // Внешние шрифты и диаграммы не нужны для проверки формы.
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin + url);
  return page;
}
async function complete(page, kind = 'Ошибка или неточность') {
  await page.getByRole('radio', { name: kind, exact: true }).check();
  await page.locator('[data-feedback-next]').click();
  await page.locator('[name="detail"]').first().check();
  await page.locator('#feedback-message').fill('Добавь пример с ожидаемым результатом: <script> & «кавычки».');
  await page.getByRole('button', { name: 'Посмотреть сообщение' }).click();
  return page.locator('#feedback-preview').inputValue();
}

test('каждая страница с общим layout содержит форму ровно один раз', { skip }, () => {
  assert.ok(pages.length > 100);
  for (const p of pages) {
    assert.equal((p.html.match(/id="feedback"/g) || []).length, 1, p.url);
    assert.ok(p.html.includes('data-feedback-open'), p.url);
  }
});

test('опрос, обязательный текст, возврат назад и безопасные ссылки на контакты', { skip }, async () => {
  const page = await pageFor();
  try {
    await page.locator('.feedback-launch').click();
    await page.locator('[data-feedback-next]').click();
    assert.equal(await page.locator('[data-feedback-step="1"]').isVisible(), true);
    await page.getByRole('radio', { name: 'Не хватает материала', exact: true }).check();
    await page.locator('[data-feedback-next]').click();
    assert.equal(await page.locator('[data-feedback-followup]').textContent(), 'Что добавить?');
    await page.locator('[name="detail"]').first().check();
    await page.locator('#feedback-message').fill('   ');
    await page.getByRole('button', { name: 'Посмотреть сообщение' }).click();
    assert.equal(await page.locator('[data-feedback-step="2"]').isVisible(), true);
    await page.locator('#feedback-message').fill('Нужен пример: <script> & кавычки');
    await page.getByRole('button', { name: 'Посмотреть сообщение' }).click();
    const body = await page.locator('#feedback-preview').inputValue();
    assert.ok(body.includes('Не хватает материала'));
    const telegram = new URL(await page.locator('[data-feedback-channel="telegram"]').getAttribute('href'));
    const email = new URL(await page.locator('[data-feedback-channel="email"]').getAttribute('href'));
    assert.equal(telegram.pathname, '/distinguished_sre');
    assert.equal(telegram.searchParams.get('text'), body);
    assert.equal(email.pathname, EMAIL);
    assert.equal(email.searchParams.get('body'), body);
    assert.ok(!email.search.includes('+'), 'mailto использует %20 для пробелов');
    assert.ok(!telegram.search.includes('+'), 'telegram использует %20 для пробелов');
    assert.equal(await page.locator('[data-feedback-note]').isVisible(), false);
    assert.equal(await page.locator('[data-feedback-channel]').count(), 4);
    assert.equal(await page.locator('[data-feedback-channel="vk"]').getAttribute('href'), 'https://vk.ru/distinguished_sre');
    await page.getByRole('button', { name: 'Изменить сообщение' }).click();
    assert.equal(await page.locator('#feedback-message').inputValue(), 'Нужен пример: <script> & кавычки');
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
    await page.getByRole('radio', { name: 'Непонятное объяснение', exact: true }).check();
    await page.locator('[data-feedback-next]').click();
    assert.equal(await page.locator('[data-feedback-followup]').textContent(), 'Что помогло бы разобраться?');
    assert.equal(await page.locator('[name="detail"]:checked').count(), 0);
  } finally { await page.close(); }
});

test('раздел, цитата, каноническая ссылка без query и отказ от цитаты', { skip }, async () => {
  const page = await pageFor(lesson('monitoring').url + '?private=value');
  try {
    const heading = await page.locator('[data-prose] h2[id]').nth(2).evaluate(h => {
      const range = document.createRange(); range.selectNodeContents(h);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      return { id: h.id, text: h.textContent.trim() };
    });
    await page.getByRole('button', { name: 'Обратная связь: ' + heading.text, exact: true }).click();
    let body = await complete(page);
    assert.ok(body.includes('Раздел: ' + heading.text));
    assert.ok(body.includes('Фрагмент: «' + heading.text + '»'));
    const url = new URL(body.split('\n').find(l => l.startsWith('Ссылка: ')).slice(8));
    assert.equal(url.origin, SITE_URL);
    assert.equal(decodeURIComponent(url.hash.slice(1)), heading.id);
    assert.equal(url.search, '');
    assert.ok(!body.includes('private=value'));
    await page.getByRole('button', { name: 'Изменить сообщение' }).click();
    await page.locator('[name="includeQuote"]').uncheck();
    await page.getByRole('button', { name: 'Посмотреть сообщение' }).click();
    body = await page.locator('#feedback-preview').inputValue();
    assert.ok(!body.includes('Фрагмент:'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#feedback').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.feedbackSection), heading.id);
  } finally { await page.close(); }
});

test('выделение из чужого раздела и сорвавшееся нажатие не попадают в сообщение', { skip }, async () => {
  const page = await pageFor(lesson('monitoring').url);
  const select = n => page.locator('[data-prose] h2[id]').nth(n).evaluate(h => {
    const range = document.createRange(); range.selectNodeContents(h);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    return h.textContent.trim();
  });
  try {
    // Выделен заголовок второго раздела, нажата кнопка третьего: цитаты нет, раздел третий.
    const second = await select(1);
    const third = await page.locator('[data-prose] h2[id]').nth(2).evaluate(h => h.textContent.trim());
    await page.getByRole('button', { name: 'Обратная связь: ' + third, exact: true }).click();
    let body = await complete(page);
    assert.ok(body.includes('Раздел: ' + third));
    assert.ok(!body.includes('Фрагмент:'), body);
    await page.keyboard.press('Escape');
    // Выделение внутри своего раздела (заголовок в него входит) остаётся.
    await select(1);
    await page.getByRole('button', { name: 'Обратная связь: ' + second, exact: true }).click();
    body = await complete(page);
    assert.ok(body.includes('Фрагмент: «' + second + '»'));
    await page.keyboard.press('Escape');
    // Нажали кнопку третьего раздела и увели курсор, потом сняли выделение и открыли форму второго с клавиатуры.
    await select(1);
    const button = page.getByRole('button', { name: 'Обратная связь: ' + third, exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(10, 10, { steps: 3 });
    await page.mouse.up();
    assert.equal(await page.locator('#feedback').evaluate(d => d.open), false);
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await page.getByRole('button', { name: 'Обратная связь: ' + second, exact: true }).focus();
    await page.keyboard.press('Enter');
    body = await complete(page);
    assert.ok(body.includes('Раздел: ' + second));
    assert.ok(!body.includes('Фрагмент:'), body);
  } finally { await page.close(); }
});

test('кнопка у вопроса передаёт его текст и не меняет ответы или прогресс', { skip }, async () => {
  const page = await pageFor(lesson('devops').url);
  try {
    const card = page.locator('.qz-card').first();
    await card.locator('[data-feedback-open]').waitFor();
    const question = await card.locator('.qz-text').textContent();
    const qid = await card.getAttribute('data-question-id');
    await card.locator('input').first().check();
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    await card.locator('[data-feedback-open]').click();
    const body = await complete(page);
    assert.ok(body.includes('Вопрос теста: ' + question.trim()));
    assert.ok(body.includes('ID вопроса: ' + qid));
    assert.ok(body.includes('Раздел урока: ' + SITE_URL + '/learning/devops/'));
    await page.keyboard.press('ArrowRight');
    assert.equal(page.url(), origin + lesson('devops').url);
    await page.keyboard.press('Escape');
    assert.equal(await card.locator('input:checked').count(), 1);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before);
  } finally { await page.close(); }
});

test('копирование и запасной ручной способ при отказе clipboard', { skip }, async () => {
  const page = await pageFor();
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.feedback-launch').click();
    const body = await complete(page);
    await page.locator('[data-feedback-copy]').click();
    await page.waitForFunction(() => document.querySelector('[data-feedback-status]').textContent.includes('скопировано'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), body);
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
    await page.locator('[data-feedback-copy]').click();
    await page.waitForFunction(() => document.querySelector('[data-feedback-status]').textContent.includes('вручную'));
    assert.equal(await page.locator('#feedback-preview').evaluate(t => t.selectionEnd - t.selectionStart), body.length);
  } finally { await page.close(); }
});

test('подготовка: одинаковые вопросы различаются по ID, коду и исходному уроку', { skip }, async () => {
  const page = await pageFor('/learning/load-tester/interview.html');
  try {
    await page.evaluate(v => localStorage.setItem(window.LTQuiz.storageKey('prep'), JSON.stringify({
      v, mode: 'check', topic: '4', lesson: '4.2', size: 5
    })), await page.evaluate(() => window.LTQuiz.VERSION));
    await page.reload();
    await page.getByRole('button', { name: 'Начать проверку' }).click();
    const card = page.locator('.qz-card:has(.qz-code)').first();
    await card.locator('[data-feedback-open]').waitFor();
    const qid = await card.getAttribute('data-question-id');
    const code = await card.locator('.qz-code').textContent();
    await card.locator('[data-feedback-open]').click();
    const body = await complete(page);
    assert.ok(body.includes('ID вопроса: ' + qid));
    assert.ok(body.includes('Код из вопроса:\n' + code.trim()));
    assert.ok(body.includes('Раздел урока: ' + SITE_URL + '/learning/load-tester/04-python/02-conditions-loops.html#'));
  } finally { await page.close(); }
});

test('главная, страницы курсов, темы и дополнения; 390px и обе темы', { skip }, async () => {
  const urls = ['/learning/index.html', '/learning/devops/index.html', '/learning/load-tester/index.html', '/learning/monitoring/index.html',
    pages.find(p => p.html.includes('class="topic"')).url,
    pages.find(p => p.html.includes('class="page"')).url];
  for (const theme of ['dark', 'light']) {
    const page = await pageFor(urls[0], { viewport: { width: 390, height: 844 } });
    try {
      for (const url of urls) {
        await page.goto(origin + url);
        await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
        assert.equal(await page.locator('.feedback-launch').isVisible(), true, url);
        assert.ok(await page.locator('.feedback-launch').evaluate(b => b.getBoundingClientRect().right <= innerWidth), url);
        await page.locator('.feedback-launch').click();
        await complete(page);
        assert.ok(await page.locator('#feedback').evaluate(d => d.scrollWidth <= d.clientWidth), url);
        await page.keyboard.press('Escape');
      }
    } finally { await page.close(); }
  }
});
