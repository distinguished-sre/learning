// Проверки тестов «Проверь себя» в настоящем браузере по собранному сайту.
// Запуск: npm install --no-save playwright && npx playwright install chromium
//         SITE_DIR=_site node --test tools/browser.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(ROOT, process.env.SITE_DIR || '_site');
const BASE = '/load-tester';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

let chromium = null;
try { ({ chromium } = await import('playwright')); } catch (e) {}
const skip = !chromium ? 'нет playwright' : !existsSync(SITE) ? 'нет собранного сайта ' + SITE : false;
// в CI пропуск означал бы зелёную проверку без проверки
if (skip && process.env.CI) throw new Error(skip);

let server, origin, browser;

// первая страница урока с банком теста
function lessonPath() {
  for (const dir of readdirSync(SITE).filter(d => /^\d\d-/.test(d)).sort()) {
    for (const f of readdirSync(path.join(SITE, dir)).filter(f => f.endsWith('.html') && f !== 'index.html').sort()) {
      if (readFileSync(path.join(SITE, dir, f), 'utf8').includes('data-quiz-bank')) return `${BASE}/${dir}/${f}`;
    }
  }
  throw new Error('в сайте нет урока с тестом');
}

before(async () => {
  if (skip) return;
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!p.startsWith(BASE + '/')) { res.writeHead(404); return res.end(); }
    let f = path.join(SITE, p.slice(BASE.length));
    if (!f.startsWith(SITE)) { res.writeHead(403); return res.end(); }
    if (existsSync(f) && statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

// выбрать первый вариант в вопросе с номером i (с нуля)
async function pick(page, i) {
  const input = page.locator('.qz-card').nth(i).locator('input').first();
  await input.check();
  return input;
}

async function checkedCards(page) {
  return page.$$eval('.qz-card', cards => cards.map(c => [...c.querySelectorAll('input')].some(x => x.checked)));
}

test('две вкладки одного урока: ответы обеих сохраняются, фокус не теряется', { skip }, async () => {
  const ctx = await browser.newContext();
  const url = origin + lessonPath();
  const tab1 = await ctx.newPage(), tab2 = await ctx.newPage();
  await tab1.goto(url); await tab1.locator('.qz-card').first().waitFor();
  await tab2.goto(url); await tab2.locator('.qz-card').first().waitFor();

  const first = await pick(tab1, 0);
  await pick(tab2, 1);
  // вкладка 1 видит ответ из вкладки 2 и не теряет фокус
  await tab1.waitForFunction(() => document.querySelectorAll('.qz-card')[1].querySelector('input:checked'));
  assert.equal(await first.evaluate(el => el === document.activeElement), true, 'фокус остался на варианте');
  await pick(tab1, 2);

  await tab1.reload(); await tab1.locator('.qz-card').first().waitFor();
  assert.deepEqual((await checkedCards(tab1)).slice(0, 3), [true, true, true]);
  await ctx.close();
});

test('битая запись завершённой попытки: урок открывается с новой попыткой', { skip }, async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const url = origin + lessonPath();
  await page.goto(url); await page.locator('.qz-card').first().waitFor();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lt-quiz:v1:') && k !== 'lt-quiz:v1:prep');
    const s = JSON.parse(localStorage.getItem(key));
    s.current.finished = true;
    s.current.result = { correct: 1, total: 5, pass: false, per: {} };
    localStorage.setItem(key, JSON.stringify(s));
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.reload(); await page.locator('.qz-card').first().waitFor();
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('.qz-card input:not(:disabled)').count() > 0, true, 'новая попытка доступна');
  await ctx.close();
});

test('подготовка: битая завершённая проверка не ломает страницу', { skip }, async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(origin + BASE + '/interview.html');
  await page.evaluate(v => localStorage.setItem('lt-quiz:v1:prep', JSON.stringify({ v, mode: 'check', topic: '1', lesson: '', size: 5,
    cur: { topic: '1', lesson: '', qids: ['q01-01-01'], order: {}, answers: {}, finished: true, result: { correct: 1, total: 5, per: [null] } } })),
    await page.evaluate(() => window.LTQuiz.VERSION));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  // ошибка отрисовки уходит в .catch промиса, поэтому смотрим на текст, а не только на pageerror
  await page.getByText('Выбери тему или урок и размер блока').waitFor({ timeout: 3000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

for (const how of ['кнопкой', 'клавишей Enter']) {
  test(`подготовка: после проверки ${how} фокус на итоге`, { skip }, async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(origin + BASE + '/interview.html');
    await page.evaluate(v => localStorage.setItem('lt-quiz:v1:prep', JSON.stringify({ v, mode: 'check', topic: '1', lesson: '', size: 5 })),
      await page.evaluate(() => window.LTQuiz.VERSION));
    await page.reload();
    await page.getByRole('button', { name: 'Начать проверку' }).click();
    await page.locator('.qz-card').first().waitFor();
    await pick(page, 0);
    const submit = page.getByRole('button', { name: 'Проверить ответы' });
    if (how === 'кнопкой') await submit.click();
    else { await submit.focus(); await page.keyboard.press('Enter'); }
    await page.locator('.qz-result').waitFor();
    await page.waitForFunction(() => document.activeElement && document.activeElement.matches('.qz-result'), null, { timeout: 3000 });
    await ctx.close();
  });
}
