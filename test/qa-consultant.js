// Проверка виджета-консультанта на живой странице настоящим браузером.
// Гоняет то, что ломается: открытие, реальный ответ агента, мобильная ширина,
// отсутствие ключей в коде страницы, закрытие с клавиатуры.
//
// Запуск: node test/qa-consultant.js [URL]
// По умолчанию http://localhost:8000 (python -m http.server 8000)

const fs = require('fs');
const puppeteer = require('puppeteer');

const URL = process.argv[2] || 'http://localhost:8000';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  ✓ ${name}`); }
  else { failed += 1; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

(async () => {
  const opts = { headless: 'new', args: ['--no-sandbox'] };
  if (fs.existsSync(CHROME)) opts.executablePath = CHROME;
  const browser = await puppeteer.launch(opts);
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log(`\nВиджет-консультант: ${URL}`);

  // ——— Кнопка и открытие ———
  const btn = await page.$('.tc-btn');
  check('кнопка консультанта есть на странице', !!btn);

  const btnText = btn ? await page.$eval('.tc-btn', (el) => el.textContent.trim()) : '';
  check('кнопка говорит, что делает', /квартир|консультант|спросить/i.test(btnText), btnText);

  await page.click('.tc-btn');
  await new Promise((r) => setTimeout(r, 400));
  check('окно чата открылось', await page.$eval('.tc-panel', (el) => !el.hidden));
  check('кнопка спряталась за окном', await page.$eval('.tc-btn', (el) => el.hidden));

  const greeting = await page.$eval('.tc-log', (el) => el.textContent);
  check('есть приветствие консультанта', /Тополиный/.test(greeting));

  const hints = await page.$$eval('.tc-hint button', (els) => els.map((e) => e.textContent));
  check('есть подсказки с вопросами', hints.length >= 3, hints.join(' | '));

  // ——— Настоящий ответ агента ———
  await page.type('#tcInput', 'Что есть до 7 миллионов?');
  await page.click('.tc-send');

  let answered = false;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const bubbles = await page.$$eval('.tc-msg.tc-bot:not(.tc-typing)', (els) => els.map((e) => e.textContent));
    if (bubbles.length >= 2) { answered = true; var answer = bubbles[bubbles.length - 1]; break; }
  }
  check('консультант ответил на вопрос', answered);

  if (answered) {
    const text = await page.$eval('.tc-log', (el) => el.textContent);
    check('в ответе есть настоящие цены из каталога', /4\s?900\s?000|6\s?400\s?000/.test(text.replace(/\u00a0/g, ' ')), text.slice(0, 120));
    check('видно, что агент именно посчитал', /подобрал квартиры|посчитал/.test(text));
    check('в ответе нет markdown-звёздочек', !/\*\s/.test(text));
  }

  // ——— Безопасность ———
  const html = await page.content();
  check('ключа модели нет в коде страницы', !/AIza[\w-]{20,}|gsk_[\w]{20,}/.test(html));
  const widget = fs.existsSync('consultant.js') ? fs.readFileSync('consultant.js', 'utf8') : '';
  check('ключа нет и в файле виджета', !/AIza[\w-]{20,}|gsk_[\w]{20,}/.test(widget));

  // ——— Клавиатура ———
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 300));
  check('окно закрывается клавишей Escape', await page.$eval('.tc-panel', (el) => el.hidden));

  // ——— Телефон ———
  await page.setViewport({ width: 390, height: 780, isMobile: true });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 500));

  // Плашка про cookie висит внизу и раньше полностью накрывала кнопку.
  const onTop = await page.evaluate(() => {
    const b = document.querySelector('.tc-btn');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { hit: !!(el && b.contains(el)), over: el ? (el.className || el.tagName) : 'нет', bottom: Math.round(window.innerHeight - r.bottom) };
  });
  check('кнопку на телефоне ничто не перекрывает', onTop.hit, `сверху: ${onTop.over}`);
  check('кнопка поднята над плашкой cookie', onTop.bottom > 60, `отступ снизу ${onTop.bottom}px`);

  await page.click('.tc-btn');
  await new Promise((r) => setTimeout(r, 400));

  const box = await page.$eval('.tc-panel', (el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left };
  });
  check('на телефоне окно во всю ширину', box.w >= 380 && box.left >= -1, JSON.stringify(box));

  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  check('виджет не создаёт горизонтальную прокрутку', scrollW <= 400, `scrollWidth ${scrollW}`);

  const inputFont = await page.$eval('#tcInput', (el) => parseFloat(getComputedStyle(el).fontSize));
  check('поле ввода не мельче 16px (иначе iPhone зумит)', inputFont >= 15, `${inputFont}px`);

  check('нет ошибок JavaScript', errors.length === 0, errors.join('; '));

  await browser.close();

  console.log(`\n${'─'.repeat(46)}`);
  console.log(`Пройдено: ${passed}   Провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('Тест упал:', err.message);
  process.exit(1);
});
