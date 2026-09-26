/**
 * Автотест hero-морфинга ЖК «Тополиный» (видео «стройка → готовый двор»).
 *
 * Запуск:  node test/qa-hero-video.js                     — локально (поднимает свой мини-сервер)
 *          node test/qa-hero-video.js https://...         — живая ссылка
 *          SHOTS=<папка> node test/qa-hero-video.js ...   — плюс скриншоты начала и конца
 *
 * Что должно быть: телефон (до 720px) играет вертикальный ролик, всё шире —
 * горизонтальный; каждый качает только свой. Один проигрыш, стоп на готовом
 * дворе. Анимация отключена, экономия трафика, файл не загрузился, автоплей
 * запрещён — видео не скачивается или прячется, остаётся обычная картинка.
 */

const puppeteer = require('C:/Users/alusa/OneDrive/Documents/Документы/projects/veritas-landing-proto/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.env.SHOTS || '';

const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// Мини-сервер вместо file://: так видео грузится как на настоящем сайте
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

async function open(browser, url, viewport, opt = {}) {
  const page = await browser.newPage();
  const errors = [];
  const videoRequests = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  await page.setViewport(viewport);
  if (opt.reducedMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (opt.saveData) await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
  if (opt.denyAutoplay) await page.evaluateOnNewDocument(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('autoplay blocked', 'NotAllowedError')); });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().includes('hero-morph')) videoRequests.push(req.url());
    if (opt.blockVideo && /hero-morph(-wide)?\.mp4/.test(req.url())) return req.abort();
    req.continue();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { page, errors, videoRequests };
}

const state = page => page.evaluate(() => {
  const hero = document.querySelector('.hero');
  const v = document.querySelector('.hero__video');
  const img = document.querySelector('.hero__media img');
  return {
    morph: hero.classList.contains('is-morph'),
    shown: getComputedStyle(v).display !== 'none',
    src: v.currentSrc, t: v.currentTime, dur: v.duration, paused: v.paused, ended: v.ended, loop: v.loop,
    imgOk: img.complete && img.naturalWidth > 0,
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
  };
});

(async () => {
  let server = null;
  let url = process.argv[2];
  if (!url) { server = await serve(); url = `http://localhost:${server.address().port}/index.html`; }
  console.log('Проверяем: ' + url + '\n');

  const opts = { headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] };
  if (fs.existsSync(CHROME)) opts.executablePath = CHROME;
  const browser = await puppeteer.launch(opts);

  const PHONE_FILE = 'hero-morph.mp4';
  const WIDE_FILE = 'hero-morph-wide.mp4';

  // 1-4. Видео играет один раз и замирает на последнем кадре, каждый экран — свой ролик
  const plays = [
    ['Телефон 390×844', PHONE, PHONE_FILE, WIDE_FILE, 'phone'],
    ['Компьютер 1440×900', { width: 1440, height: 900 }, WIDE_FILE, PHONE_FILE, 'desktop'],
    ['Планшет 768×1024', { width: 768, height: 1024, isMobile: true, hasTouch: true }, WIDE_FILE, PHONE_FILE, ''],
    ['Телефон боком 844×390', { width: 844, height: 390, isMobile: true, hasTouch: true }, WIDE_FILE, PHONE_FILE, ''],
  ];
  for (const [name, viewport, file, other, shot] of plays) {
    const { page, errors, videoRequests } = await open(browser, url, viewport);
    await wait(900);
    let s = await state(page);
    check(`${name}: морфинг включился`, s.morph && s.shown);
    check(`${name}: играет свой ролик`, path.basename(s.src || '') === file, path.basename(s.src || '—'));
    check(`${name}: чужой ролик не скачивается`, !videoRequests.some(u => path.basename(u.split('?')[0]) === other));
    check(`${name}: видео играет`, !s.paused && s.t > 0, `t=${s.t.toFixed(2)}`);
    check(`${name}: без повтора по кругу`, !s.loop);
    if (SHOTS && shot) await page.screenshot({ path: path.join(SHOTS, `${shot}-start.png`) });
    if (SHOTS && shot) {
      await page.waitForFunction(() => document.querySelector('.hero__video').currentTime >= 3.5, { timeout: 10000 }).catch(() => {});
      await page.screenshot({ path: path.join(SHOTS, `${shot}-mid.png`) });
    }
    await page.waitForFunction(() => document.querySelector('.hero__video').ended, { timeout: 20000 }).catch(() => {});
    await wait(1500);
    s = await state(page);
    check(`${name}: доиграло до конца и остановилось`, s.ended && s.paused && s.t >= s.dur - 0.15, `t=${s.t.toFixed(2)} из ${(s.dur || 0).toFixed(2)}`);
    check(`${name}: после конца виден последний кадр`, s.morph && s.shown);
    check(`${name}: нет горизонтального скролла`, !s.hScroll);
    check(`${name}: консоль без ошибок`, errors.length === 0, errors.join(' | '));
    if (SHOTS && shot) await page.screenshot({ path: path.join(SHOTS, `${shot}-end.png`) });
    await page.close();
  }

  // 5-7. Где видео быть не должно — не скачивается вовсе, стоит картинка
  const noVideo = [
    ['Компьютер, анимация отключена в системе', { width: 1440, height: 900 }, { reducedMotion: true }],
    ['Телефон, анимация отключена в системе', PHONE, { reducedMotion: true }],
    ['Телефон, режим экономии трафика', PHONE, { saveData: true }],
  ];
  for (const [name, viewport, opt] of noVideo) {
    const { page, errors, videoRequests } = await open(browser, url, viewport, opt);
    await wait(2500);
    const s = await state(page);
    check(`${name}: видео не скачивается`, videoRequests.length === 0, videoRequests.map(u => path.basename(u)).join(', '));
    check(`${name}: видна картинка`, !s.morph && !s.shown && s.imgOk);
    check(`${name}: консоль без ошибок`, errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // 8-11. Отказы — вместо видео должна остаться картинка, не пустой экран
  const failures = [
    ['Телефон, файл видео не загрузился', PHONE, { blockVideo: true }],
    ['Телефон, браузер запретил автозапуск', PHONE, { denyAutoplay: true }],
    ['Компьютер, файл видео не загрузился', { width: 1440, height: 900 }, { blockVideo: true }],
    ['Компьютер, браузер запретил автозапуск', { width: 1440, height: 900 }, { denyAutoplay: true }],
  ];
  for (const [name, viewport, opt] of failures) {
    const { page, errors } = await open(browser, url, viewport, opt);
    await wait(2500);
    const s = await state(page);
    check(`${name}: видна картинка`, !s.morph && !s.shown && s.imgOk);
    const real = errors.filter(e => !/Failed to load resource|ERR_FAILED/.test(e));
    check(`${name}: консоль без ошибок скрипта`, real.length === 0, real.join(' | '));
    await page.close();
  }

  await browser.close();
  if (server) server.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\nИтого: ${results.length - failed}/${results.length}`);
  process.exit(failed ? 1 : 0);
})();
