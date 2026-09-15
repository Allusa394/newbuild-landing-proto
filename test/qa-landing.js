/**
 * Автотесты лендинга ЖК «Тополиный».
 *
 * Запуск:  node test/qa-landing.js                      — локальный файл
 *          node test/qa-landing.js https://...           — живая ссылка
 *
 * Отдельно проверяется ипотечный калькулятор: платёж считается по формуле
 * аннуитета и сверяется с эталоном, посчитанным здесь же. Если формула на
 * странице «поплывёт», тест это поймает — клиент проверит цифру в банке.
 */

const puppeteer = require('C:/Users/alusa/OneDrive/Documents/Документы/projects/veritas-landing-proto/node_modules/puppeteer');
const fs = require('fs');

const URL = process.argv[2] || ('file:///' + 'C:/Users/alusa/OneDrive/Documents/Документы/projects/newbuild-landing-proto/index.html');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

function annuity(price, downPct, yearsN, ratePct) {
  const loan = price * (1 - downPct / 100);
  const i = ratePct / 100 / 12;
  const n = yearsN * 12;
  return loan * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

(async () => {
  const opts = { headless: 'new', args: ['--no-sandbox'] };
  if (fs.existsSync(CHROME)) opts.executablePath = CHROME;
  const browser = await puppeteer.launch(opts);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  await page.setViewport({ width: 1440, height: 900 });
  console.log('Проверяем: ' + URL + '\n');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 700));

  // картинки
  await page.evaluate(async () => { await new Promise(res => { let y = 0; const s = () => { window.scrollBy(0, 900); y += 900; if (y < document.body.scrollHeight) setTimeout(s, 90); else res(); }; s(); }); });
  await new Promise(r => setTimeout(r, 1000));
  const broken = await page.evaluate(() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.currentSrc || i.src));
  check('Все картинки загрузились', broken.length === 0, broken.join(', '));

  // якоря
  const badAnchors = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      const id = a.getAttribute('href').slice(1);
      if (id && !document.getElementById(id)) bad.push(a.getAttribute('href'));
    });
    return bad;
  });
  check('Все ссылки меню ведут на существующие секции', badAnchors.length === 0, badAnchors.join(', '));

  // калькулятор: значения по умолчанию
  const parse = t => parseInt(t.replace(/[^\d]/g, ''), 10);
  const payDefault = parse(await page.$eval('#payout', e => e.textContent));
  const expectDefault = Math.round(annuity(6400000, 20, 25, 6));
  check('Платёж по умолчанию совпадает с формулой аннуитета', Math.abs(payDefault - expectDefault) <= 1, `${payDefault} против ${expectDefault}`);

  // калькулятор: смена программы
  await page.evaluate(() => document.querySelector('[data-name="Базовая"]').click());
  await new Promise(r => setTimeout(r, 250));
  const payBase = parse(await page.$eval('#payout', e => e.textContent));
  const expectBase = Math.round(annuity(6400000, 20, 25, 21));
  check('Смена программы меняет ставку и платёж', Math.abs(payBase - expectBase) <= 1 && payBase > payDefault, `${payBase} против ${expectBase}`);

  // калькулятор: ползунки
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    document.querySelector('[data-name="Семейная"]').click();
    set('price', 9000000); set('down', 30); set('years', 15);
  });
  await new Promise(r => setTimeout(r, 250));
  const paySlider = parse(await page.$eval('#payout', e => e.textContent));
  const expectSlider = Math.round(annuity(9000000, 30, 15, 6));
  check('Ползунки пересчитывают платёж', Math.abs(paySlider - expectSlider) <= 1, `${paySlider} против ${expectSlider}`);

  const loanShown = parse(await page.$eval('#valLoan', e => e.textContent));
  check('Сумма кредита считается от взноса', loanShown === 9000000 * 0.7, `${loanShown}`);

  const incomeShown = parse(await page.$eval('#valIncome', e => e.textContent));
  check('Требуемый доход считается от платежа', Math.abs(incomeShown - Math.round(paySlider / 0.4)) <= 2, `${incomeShown}`);

  // форма
  await page.evaluate(() => document.getElementById('visitSubmit').click());
  await new Promise(r => setTimeout(r, 300));
  const errShown = await page.$eval('#formError', e => getComputedStyle(e).display !== 'none');
  check('Пустая форма не отправляется', errShown);

  await page.type('#v-name', 'Ирина');
  await page.type('#v-phone', '+7 903 771-06-22');
  await page.evaluate(() => { document.getElementById('v-agree').checked = true; });
  await page.evaluate(() => document.getElementById('visitSubmit').click());
  await new Promise(r => setTimeout(r, 500));
  const okShown = await page.$eval('#formOk', e => getComputedStyle(e).display !== 'none');
  check('Заполненная форма показывает подтверждение', okShown);

  // cookie
  const cookieShown = await page.$eval('#cookie', e => !e.classList.contains('hide'));
  await page.evaluate(() => document.getElementById('cookieOk').click());
  await new Promise(r => setTimeout(r, 250));
  const cookieHidden = await page.$eval('#cookie', e => e.classList.contains('hide'));
  check('Cookie-баннер появляется и закрывается', cookieShown && cookieHidden);

  // юридические страницы
  const legal = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="legal/"]')].map(a => a.getAttribute('href')))]);
  const base = URL.replace(/index\.html$/, '');
  const missing = legal.filter(l => URL.startsWith('file') && !fs.existsSync(decodeURIComponent((base + l).replace('file:///', ''))));
  check('Юридические страницы на месте', missing.length === 0, missing.join(', '));

  // карточки планировок одной высоты
  const heights = await page.evaluate(() => [...document.querySelectorAll('.plan')].map(c => Math.round(c.getBoundingClientRect().height)));
  check('Карточки планировок одной высоты', new Set(heights).size <= 1, heights.join(' / '));

  // мобильный
  const mob = await browser.newPage();
  await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mob.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 600));
  const hscroll = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('Нет горизонтального скролла на 390px', !hscroll);
  await mob.evaluate(() => document.getElementById('burger').click());
  await new Promise(r => setTimeout(r, 350));
  const menuOpen = await mob.evaluate(() => document.getElementById('navMob').classList.contains('on'));
  check('Мобильное меню открывается', menuOpen);

  check('Нет ошибок в консоли', errors.length === 0, errors.slice(0, 2).join(' | '));

  const failed = results.filter(r => !r.ok).length;
  console.log(`\nПройдено ${results.length - failed} из ${results.length}`);
  console.log('Тесты не видят композицию — скриншоты смотреть глазами, результат проверять на живой ссылке.');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
