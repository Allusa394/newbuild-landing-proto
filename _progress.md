# Прогресс: лендинг новостройки с ипотечным калькулятором

## СЕЙЧАС (25.09.2026): hero-морфинг «стройка → готовый ЖК»

Лендинг опубликован, план ниже — старый. Не сделано только видео в первом экране.

Схема: конечный кадр = уже стоящая в hero картинка `img/hero.jpg`
(копия для Аллы: `C:\Users\alusa\Downloads\zhk-finish-hero.jpg`), начальный кадр
«стройка» генерится из неё редактированием. Делает Алла в Google Flow (Veo 3.1
Quality, 16:9, 8 сек, режим «Кадры»). Как пройти по новому интерфейсу Flow —
jarvis/knowledge/вайбкодинг-лендинг-инструкция.md, раздел «Альтернатива Kling».

Остановились: Алла во Flow, на шаге загрузки кадров. Картинку давала ей через буфер обмена.

**26.09.2026 — видео получено, но ВЕРТИКАЛЬНОЕ 720×1280 (9:16), не 16:9.** Первая секунда — горизонтальный кадр с чёрными полосами и швом дорисовки, звук есть, камера двигается. Решение: морфинг только на телефоне (≤720px, там hero вертикальный), на компьютере остаётся картинка до горизонтальной версии от Аллы.
- [x] Обрезана 1-я секунда, убран звук, H.264 crf 28 + faststart → `img/hero-morph.mp4` (7 с, 2,1 МБ), постер = первый кадр `img/hero-morph-poster.jpg`
- [x] Вставка в hero: видео подгружается скриптом только на телефоне; reduced-motion / экономия трафика / отказ автоплея / ошибка загрузки → остаётся картинка
- [x] Нашлось глазами: на телефоне морфинг прятался под тёмной подложкой — экран на всю высоту, подложка только под текстом
- [x] Автотест `test/qa-hero-video.js` — 23/23 локально; проверен порчей запасного варианта (ловит); `qa-landing.js` 15/15
- [x] Деплой 26.09, на живой ссылке: видео 23/23, лендинг 15/15, консультант 29 проверок без ошибок; скриншоты Алле — jarvis/_смотри-сюда/морфинг-новостройка/
- [x] Горизонтальная версия получена 26.09 (1280×720, 8 с, чистая, последний кадр совпадает с hero.jpg по композиции) → без звука, crf 26 → `img/hero-morph-wide.mp4` (2,1 МБ) + постер
- [x] Скрипт: ширина >720px — горизонтальное, ≤720px — вертикальное; телефон боком получает горизонтальное; каждый качает только своё
- [x] Тест 53/53 локально, проверен подменой ролика (ловит 6 проверок); qa-landing 15/15
- [x] Деплой 26.09, на живой ссылке: видео 53/53, лендинг 15/15, консультант 29 без ошибок. **Hero-морфинг готов на всех экранах.** Не проверено: настоящий айфон (только эмуляция Chrome)

Дальше (моё, после её MP4 и её «да»):
1. Сжать MP4 под веб, положить в `img/`
2. В `.hero__media` — `<video muted playsinline autoplay preload="metadata" poster="img/hero.jpg">`, один проигрыш, по `ended` стоп на последнем кадре, без лупа
3. `prefers-reduced-motion` → только картинка
4. Проверка: `NODE_PATH=<veritas>/node_modules node test/qa-consultant.js <url>` + мобильный, медленная сеть, видео не загрузилось
5. После лендинга — объявление на Авито (см. дневник jarvis 25.09, сессия 3)

Промт кадра «до» (к нему прикрепить hero.jpg):
```
Edit this image. Keep exactly the same camera angle, horizon, perspective, sunset lighting and sky. Turn the finished residential complex into an active construction site: the three buildings stand in the same places with the same heights and outlines, but as bare grey concrete monolithic frames — open floor slabs, columns, no facades, no windows, partial scaffolding and green safety netting. Two yellow tower cranes next to the buildings. Instead of the landscaped courtyard: bare levelled earth, sand, puddles, stacks of rebar and concrete blocks, a construction fence. No trees, no flowers, no people. Keep the left side of the frame open for text overlay. Photorealistic, 16:9.
```

Промт видео (start = стройка, end = hero.jpg):
```
Construction time-lapse of a residential complex, from building site to finished homes. Locked-off static camera, no camera movement. The concrete frames fill in floor by floor: facades and windows appear, scaffolding and safety netting disappear, the tower cranes lower and vanish. Then the ground transforms: paths get paved, lawns and flowerbeds grow, young trees rise, benches and a playground appear. Smooth continuous transformation, sunset light stays constant. Photorealistic, no people, no text.
```
Негатив: `camera shake, zoom, camera movement, people, text, watermark, flicker, warped buildings`

## Что это
Четвёртый прототип витрины Аллы, ниша «недвижимость: новостройки».
Заказан 13.09.2026 вместе с автосервисом. Ниши нет в бэклоге 29 —
добавить туда после сдачи.

## Решения
- Объект: жилой комплекс «Тополиный» (вымышленный), 3 корпуса, сдача очередями.
- Тип сайта: конверсионный, холодный трафик. С первого экрана должно быть
  понятно: что за объект, где, от какой цены, когда сдача.
- Главный инструмент: ипотечный калькулятор (цена, первый взнос, срок,
  ставка по программам: семейная, IT, льготная, базовая) с подсчётом
  ежемесячного платежа. Считает честно, по формуле аннуитета.
- Палитра и шрифты не повторяют другие работы витрины: холодный зелёный
  и тёплый песок, шрифты Manrope? нет, занят VERITAS. Берём Onest + Literata.

## План
1. [ ] Каркас, палитра, типографика
2. [ ] Первый экран: объект, цена от, срок сдачи, одно действие
3. [ ] Ипотечный калькулятор с программами и аннуитетом
4. [ ] Планировки с ценами и площадями
5. [ ] О комплексе: инфраструктура, отделка, паркинг
6. [ ] Ход строительства по корпусам
7. [ ] Как проходит сделка: 4 шага, эскроу
8. [ ] Вопросы и ответы
9. [ ] Форма записи на просмотр + контакты
10. [ ] Юр.блок и пометка «демо»
11. [ ] Картинки под тему
12. [ ] Автотесты, включая проверку расчёта платежа
13. [ ] Публикация на GitHub Pages

## Не забыть
- Считать платёж по формуле, а не выдумывать числа: клиент проверит на калькуляторе банка.
- Эскроу-счета и 214-ФЗ упомянуть: без этого сайт новостройки выглядит несерьёзно.
- Нумерация «1 2 3 4», карточки одной высоты, кнопки по нижней линии.
- Промты морфинга для Аллы: пустой участок с краном → готовый двор с деревьями.
