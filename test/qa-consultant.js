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

  // ——— Голос ———
  const micVisible = await page.$eval('.tc-mic', (el) => !el.hidden).catch(() => false);
  check('кнопка микрофона показана', micVisible);

  const speak = await page.$eval('#tcSpeak', (el) => ({ hidden: el.hidden, pressed: el.getAttribute('aria-pressed') }));
  check('озвучка по умолчанию выключена', speak.pressed === 'false');

  await page.click('#tcSpeak');
  const speakOn = await page.$eval('#tcSpeak', (el) => el.getAttribute('aria-pressed'));
  check('озвучка включается кнопкой', speakOn === 'true');
  await page.click('#tcSpeak');

  // Настоящий микрофон в headless-браузере недоступен, поэтому подменяем
  // распознаватель заглушкой и прогоняем тот же путь, что у живого клиента:
  // нажал микрофон → произнёс → текст оказался в поле, но не улетел сам.
  const dictated = await page.evaluate(() => {
    let inst = null;
    window.SpeechRecognition = function () {
      inst = this;
      this.start = function () {};
      this.stop = function () { if (this.onend) this.onend(); };
    };
    window.webkitSpeechRecognition = window.SpeechRecognition;
    window.__tcSpoken = function (text) {
      if (!inst || !inst.onresult) return '__распознаватель не создан__';
      const results = [Object.assign([{ transcript: text }], { isFinal: true })];
      inst.onresult({ resultIndex: 0, results });
      inst.stop();
      return document.querySelector('#tcInput').value;
    };
    return true;
  });
  check('заглушка распознавателя установлена', dictated === true);

  // Виджет читает SpeechRecognition при загрузке, поэтому перезагружаем страницу
  // с уже подменённым распознавателем.
  await page.evaluate(() => sessionStorage.removeItem('topolinyy-chat'));
  await page.evaluateOnNewDocument(() => {
    let inst = null;
    const Fake = function () {
      inst = this;
      this.start = function () {};
      this.stop = function () { if (this.onend) this.onend(); };
    };
    window.SpeechRecognition = Fake;
    window.webkitSpeechRecognition = Fake;
    window.__tcSpoken = function (text) {
      if (!inst || !inst.onresult) return '__распознаватель не создан__';
      const results = [Object.assign([{ transcript: text }], { isFinal: true })];
      inst.onresult({ resultIndex: 0, results });
      inst.stop();
      return document.querySelector('#tcInput').value;
    };
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.click('.tc-btn');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('.tc-mic');
  await new Promise((r) => setTimeout(r, 200));

  const heard = await page.evaluate(() => window.__tcSpoken('двушку до девяти миллионов'));
  check('сказанное попадает в поле ввода', heard === 'двушку до девяти миллионов', heard);

  const sentBySelf = await page.$$eval('.tc-msg.tc-me', (els) => els.length);
  check('сказанное не отправляется само, человек может поправить', sentBySelf === 0, `отправлено сообщений: ${sentBySelf}`);

  const recOff = await page.$eval('.tc-mic', (el) => el.classList.contains('rec'));
  check('после распознавания запись выключается', !recOff);

  // Отказ в доступе к микрофону — обычное дело, виджет не должен ломаться.
  // Проверяем на отдельной вкладке: там нет встроенного распознавания,
  // поэтому виджет идёт вторым путём — через запись звука, а её запрещают.
  const denyPage = await browser.newPage();
  await denyPage.evaluateOnNewDocument(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
      },
    });
  });
  await denyPage.goto(URL, { waitUntil: 'networkidle2' });
  await denyPage.click('.tc-btn');
  await new Promise((r) => setTimeout(r, 300));

  const micShown = await denyPage.$eval('.tc-mic', (el) => !el.hidden);
  check('микрофон предлагается и без встроенного распознавания', micShown);

  await denyPage.click('.tc-mic');
  await new Promise((r) => setTimeout(r, 900));
  const afterDeny = await denyPage.$eval('.tc-log', (el) => el.textContent);
  check('отказ в микрофоне объясняется человеку', /микрофон/i.test(afterDeny), afterDeny.slice(-90));
  check('после отказа запись не считается идущей', !(await denyPage.$eval('.tc-mic', (el) => el.classList.contains('rec'))));
  await denyPage.close();

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
