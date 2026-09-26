/**
 * Автотест hero-морфинга ЖК «Тополиный» (видео «стройка → готовый двор»).
 *
 * Запуск:  node test/qa-hero-video.js                     — локально (поднимает свой мини-сервер)
 *          node test/qa-hero-video.js https://...         — живая ссылка
 *          SHOTS=<папка> node test/qa-hero-video.js ...   — плюс скриншоты начала и конца
 *
 * Что должно быть: на телефоне видео играет один раз и замирает на готовом
 * дворе; на компьютере и во всех случаях отказа видео не скачивается или
 * прячется, и остаётся обычная картинка.
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
    if (opt.blockVideo && req.url().includes('hero-morph.mp4')) return req.abort();
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
    t: v.currentTime, dur: v.duration, paused: v.paused, ended: v.ended, loop: v.loop,
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

  // 1. Телефон: видео играет один раз и замирает на последнем кадре
  {
    const { page, errors } = await open(browser, url, PHONE);
    await wait(900);
    let s = await state(page);
    check('Телефон: морфинг включился', s.morph && s.shown);
    check('Телефон: видео играет', !s.paused && s.t > 0, `t=${s.t.toFixed(2)}`);
    check('Телефон: без повтора по кругу', !s.loop);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-start.png') });
    await page.waitForFunction(() => document.querySelector('.hero__video').ended, { timeout: 20000 }).catch(() => {});
    await wait(1500);
    s = await state(page);
    check('Телефон: доиграло до конца и остановилось', s.ended && s.paused && s.t >= s.dur - 0.15, `t=${s.t.toFixed(2)} из ${(s.dur || 0).toFixed(2)}`);
    check('Телефон: после конца видно последний кадр, а не картинку', s.morph && s.shown);
    check('Телефон: нет горизонтального скролла', !s.hScroll);
    check('Телефон: консоль без ошибок', errors.length === 0, errors.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-end.png') });
    await page.close();
  }

  await browser.close();
  if (server) server.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\nИтого: ${results.length - failed}/${results.length}`);
  process.exit(failed ? 1 : 0);
})();
