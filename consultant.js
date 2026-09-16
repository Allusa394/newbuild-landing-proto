/* Консультант отдела продаж прямо на странице.
   Ключ к мозгу здесь не лежит: виджет обращается к прослойке на сервере,
   а она уже ходит к модели. В коде страницы нет ничего секретного. */

(function () {
  'use strict';

  var API = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api/chat'
    : 'https://newbuild-sales-agent.vercel.app/api/chat';

  var STORE = 'topolinyy-chat';
  var MAX_STORED = 30;

  var state = { open: false, busy: false, history: [], session: null };

  // ——— Хранение переписки в этой вкладке ————————————————————
  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
    if (saved && Array.isArray(saved.history)) {
      state.history = saved.history;
      state.session = saved.session;
    }
  } catch (e) { /* приватный режим — переписка просто не сохранится */ }

  if (!state.session) {
    state.session = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function save() {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({
        session: state.session,
        history: state.history.slice(-MAX_STORED),
      }));
    } catch (e) { /* не критично */ }
  }

  // ——— Разметка ————————————————————————————————————————————

  var css = ''
    + '.tc-btn{position:fixed;right:20px;bottom:20px;z-index:79;display:flex;align-items:center;gap:10px;'
    + 'padding:13px 20px 13px 16px;border:0;border-radius:999px;background:#1F3D34;color:#F4F1EA;cursor:pointer;'
    + 'font:600 15px/1 "Onest",-apple-system,"Segoe UI",Arial,sans-serif;box-shadow:0 14px 30px -12px rgba(22,34,30,.6);'
    + 'transition:transform .18s ease,box-shadow .18s ease}'
    + '.tc-btn:hover{transform:translateY(-2px);box-shadow:0 18px 36px -14px rgba(22,34,30,.7)}'
    + '.tc-btn:active{transform:translateY(0)}'
    + '.tc-btn:focus-visible{outline:3px solid #C99A4B;outline-offset:3px}'
    + '.tc-btn[hidden]{display:none}'
    + '.tc-dot{width:8px;height:8px;border-radius:50%;background:#E7C37B;flex:none}'
    + '.tc-panel{position:fixed;right:20px;bottom:20px;z-index:90;width:390px;max-width:calc(100vw - 32px);'
    + 'height:min(620px,calc(100dvh - 40px));display:flex;flex-direction:column;background:#FCFAF6;'
    + 'border:1px solid rgba(22,34,30,.12);border-radius:16px;overflow:hidden;'
    + 'box-shadow:0 30px 70px -30px rgba(22,34,30,.75);'
    + 'font:15px/1.5 "Onest",-apple-system,"Segoe UI",Arial,sans-serif;color:#16221E}'
    + '.tc-panel[hidden]{display:none}'
    + '.tc-head{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 18px;background:#1F3D34;color:#F4F1EA}'
    + '.tc-head h3{margin:0;font:600 16px/1.2 "Literata",Georgia,serif}'
    + '.tc-head p{margin:2px 0 0;font-size:12.5px;opacity:.72}'
    + '.tc-x{margin-left:auto;width:34px;height:34px;flex:none;border:0;border-radius:9px;cursor:pointer;'
    + 'background:rgba(244,241,234,.12);color:#F4F1EA;font-size:19px;line-height:1}'
    + '.tc-x:hover{background:rgba(244,241,234,.22)}'
    + '.tc-x:focus-visible{outline:2px solid #E7C37B;outline-offset:2px}'
    + '.tc-log{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:#F4F1EA}'
    + '.tc-msg{max-width:88%;padding:11px 14px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}'
    + '.tc-msg b{font-weight:600}'
    + '.tc-me{align-self:flex-end;background:#1F3D34;color:#F4F1EA;border-bottom-right-radius:5px}'
    + '.tc-bot{align-self:flex-start;background:#FCFAF6;border:1px solid rgba(22,34,30,.1);border-bottom-left-radius:5px}'
    + '.tc-tool{align-self:flex-start;font-size:12px;color:#5D6B65;padding:0 4px;display:flex;align-items:center;gap:6px}'
    + '.tc-tool span{width:5px;height:5px;border-radius:50%;background:#C99A4B;flex:none}'
    + '.tc-hint{padding:0 18px 14px;display:flex;flex-wrap:wrap;gap:8px;background:#F4F1EA}'
    + '.tc-hint button{border:1px solid rgba(22,34,30,.16);background:#FCFAF6;color:#16221E;cursor:pointer;'
    + 'padding:8px 13px;border-radius:999px;font:14px "Onest",sans-serif}'
    + '.tc-hint button:hover{border-color:#1F3D34;background:#fff}'
    + '.tc-hint button:focus-visible{outline:2px solid #C99A4B;outline-offset:2px}'
    + '.tc-form{display:flex;gap:9px;padding:13px;border-top:1px solid rgba(22,34,30,.1);background:#FCFAF6}'
    + '.tc-form input{flex:1;min-width:0;padding:12px 14px;border:1px solid rgba(22,34,30,.18);border-radius:10px;'
    + 'font:15px "Onest",sans-serif;color:#16221E;background:#fff}'
    + '.tc-form input:focus{outline:2px solid #1F3D34;outline-offset:-1px;border-color:transparent}'
    + '.tc-send{flex:none;width:46px;border:0;border-radius:10px;background:#1F3D34;color:#F4F1EA;cursor:pointer;font-size:17px}'
    + '.tc-send:disabled{opacity:.45;cursor:default}'
    + '.tc-send:focus-visible{outline:2px solid #C99A4B;outline-offset:2px}'
    + '.tc-note{padding:0 18px 12px;font-size:11.5px;color:#8E9A94;background:#F4F1EA}'
    + '.tc-typing{display:flex;gap:4px;align-items:center;padding:12px 15px}'
    + '.tc-typing i{width:6px;height:6px;border-radius:50%;background:#8E9A94;animation:tcb 1.1s infinite}'
    + '.tc-typing i:nth-child(2){animation-delay:.16s}.tc-typing i:nth-child(3){animation-delay:.32s}'
    + '@keyframes tcb{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'
    + '@media (max-width:560px){.tc-panel{right:0;bottom:0;width:100%;max-width:100%;height:100dvh;border-radius:0;border:0}'
    + '.tc-btn{right:14px;bottom:14px;padding:12px 17px 12px 14px;font-size:14px}}'
    + '@media (prefers-reduced-motion:reduce){.tc-btn,.tc-typing i{transition:none;animation:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'tc-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Открыть чат с консультантом отдела продаж');
  btn.innerHTML = '<span class="tc-dot" aria-hidden="true"></span>Спросить о квартирах';

  var panel = document.createElement('div');
  panel.className = 'tc-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Консультант отдела продаж');
  panel.innerHTML = ''
    + '<div class="tc-head"><div><h3>Консультант отдела продаж</h3>'
    + '<p>Подберу квартиру и посчитаю ипотеку</p></div>'
    + '<button class="tc-x" type="button" aria-label="Закрыть чат">×</button></div>'
    + '<div class="tc-log" id="tcLog" role="log" aria-live="polite"></div>'
    + '<div class="tc-hint" id="tcHint"></div>'
    + '<p class="tc-note">Демонстрация возможностей. Расчёты предварительные, не оферта.</p>'
    + '<form class="tc-form" id="tcForm">'
    + '<input id="tcInput" type="text" autocomplete="off" placeholder="Двушку до 9 миллионов" aria-label="Ваш вопрос">'
    + '<button class="tc-send" type="submit" aria-label="Отправить">→</button></form>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var log = panel.querySelector('#tcLog');
  var hint = panel.querySelector('#tcHint');
  var form = panel.querySelector('#tcForm');
  var input = panel.querySelector('#tcInput');
  var send = form.querySelector('.tc-send');

  // ——— Вывод сообщений ——————————————————————————————————————

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Модель иногда отвечает списком со звёздочками — приводим к читаемому виду.
  function render(text) {
    return esc(text)
      .replace(/^\s*[*•-]\s+/gm, '— ')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/g, '<b>$1</b>')
      .replace(/&lt;i&gt;([\s\S]*?)&lt;\/i&gt;/g, '<i>$1</i>')
      .replace(/\n{3,}/g, '\n\n');
  }

  function bubble(role, text) {
    var el = document.createElement('div');
    el.className = 'tc-msg ' + (role === 'user' ? 'tc-me' : 'tc-bot');
    el.innerHTML = render(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  var TOOL_NAMES = {
    find_apartments: 'подобрал квартиры',
    calc_mortgage: 'посчитал ипотеку',
    calc_installment: 'посчитал рассрочку',
    building_progress: 'проверил сроки по корпусам',
    free_slots: 'проверил свободное время',
    book_visit: 'записал на просмотр',
    my_visits: 'проверил ваши записи',
    cancel_visit: 'отменил запись',
    remember_client: 'запомнил ваши пожелания',
  };

  function toolLine(used) {
    var names = (used || []).map(function (n) { return TOOL_NAMES[n]; }).filter(Boolean);
    if (!names.length) return;
    var uniq = names.filter(function (n, i) { return names.indexOf(n) === i; });
    var el = document.createElement('div');
    el.className = 'tc-tool';
    el.innerHTML = '<span aria-hidden="true"></span>' + esc(uniq.join(', '));
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function typing() {
    var el = document.createElement('div');
    el.className = 'tc-msg tc-bot tc-typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    el.setAttribute('aria-label', 'Консультант печатает');
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // ——— Подсказки ————————————————————————————————————————————

  var HINTS = [
    'Что есть до 7 миллионов?',
    'Платёж по семейной ипотеке',
    'Когда сдадите второй корпус?',
    'А если дом не достроят?',
  ];

  function drawHints(show) {
    hint.innerHTML = '';
    if (!show) return;
    HINTS.forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', function () { ask(q); });
      hint.appendChild(b);
    });
  }

  // ——— Общение с прослойкой ————————————————————————————————

  function ask(text) {
    if (state.busy || !text.trim()) return;
    state.busy = true;
    send.disabled = true;
    drawHints(false);

    bubble('user', text);
    state.history.push({ role: 'user', content: text });
    save();

    var dots = typing();

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId: state.session,
        history: state.history.slice(-16),
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        dots.remove();
        toolLine(data.used);
        bubble('assistant', data.text || 'Не удалось ответить. Позвоните в отдел продаж.');
        state.history.push({ role: 'assistant', content: data.text || '' });
        save();
      })
      .catch(function () {
        dots.remove();
        bubble('assistant', 'Связь с консультантом прервалась. Обновите страницу или позвоните в отдел продаж.');
      })
      .finally(function () {
        state.busy = false;
        send.disabled = false;
        input.focus();
      });
  }

  // ——— Открытие и закрытие ——————————————————————————————————

  function open() {
    state.open = true;
    panel.hidden = false;
    btn.hidden = true;

    if (!log.childElementCount) {
      if (state.history.length) {
        state.history.forEach(function (m) { bubble(m.role, m.content); });
      } else {
        bubble('assistant', 'Здравствуйте! Я консультант отдела продаж ЖК «Тополиный». Подберу квартиру под бюджет, посчитаю ипотеку и запишу на просмотр. Что вас интересует?');
        drawHints(true);
      }
    }
    setTimeout(function () { input.focus(); }, 60);
  }

  function close() {
    state.open = false;
    panel.hidden = true;
    btn.hidden = false;
    btn.focus();
  }

  // Плашка про cookie висит внизу и на телефоне полностью накрывает кнопку —
  // посетитель просто не может по ней попасть. Пока плашка видна, кнопка стоит выше.
  function liftAboveBanner() {
    var banner = document.querySelector('#cookie, .cookie');
    var visible = banner && !banner.hidden && getComputedStyle(banner).display !== 'none';
    if (!visible) {
      btn.style.bottom = '';
      return;
    }
    var r = banner.getBoundingClientRect();
    var gap = window.innerWidth <= 560 ? 14 : 20;
    btn.style.bottom = Math.round(window.innerHeight - r.top + gap) + 'px';
  }

  liftAboveBanner();
  window.addEventListener('resize', liftAboveBanner);

  var banner = document.querySelector('#cookie, .cookie');
  if (banner && window.MutationObserver) {
    new MutationObserver(liftAboveBanner).observe(banner, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  }

  btn.addEventListener('click', open);
  panel.querySelector('.tc-x').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.open) close();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    ask(text);
  });
})();
