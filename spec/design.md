# Design System: Process Mining MVP

**Версия:** 1.0
**Основа:** `index.html` (портфолио аналитика IT-систем) + дополнения для Process Mining.

---

## 1. Философия

Четыре принципа:

1. **Данные — главное.** UI не должен конкурировать с графиками. Минимум декора, максимум читаемости.
2. **Один акцент.** Синий `#4a90d9` — для интерактивных элементов (кнопки, фильтры, активные вкладки). Цвета статусов (красный/жёлтый/зелёный) — отдельно, только для метрик.
3. **Мягкие поверхности.** Карточки лежат на фоне: тонкая граница + мягкая тень. Без «вырезанных» блоков.
4. **Две темы по умолчанию.** Светлая — основная, тёмная — альтернативная. Все цвета — через CSS-переменные.

Годится для: дашбордов, аналитических панелей, портфолио.

---

## 2. Цветовые токены

### Светлая тема (по умолчанию)

| Токен | HEX | Где применять |
|---|---|---|
| `--bg-page` | `#f5f7fa` | Фон страницы |
| `--bg-surface` | `#ffffff` | Карточки, модалки |
| `--bg-surface-soft` | `#f8f9fa` | Вложенные блоки, вторичные поверхности |
| `--bg-header` | `linear-gradient(135deg, #1a2332 0%, #2c3e50 100%)` | Шапка |
| `--text-primary` | `#1a2332` | Основной текст |
| `--text-secondary` | `#3d4145` | Вторичный текст |
| `--text-muted` | `#6c757d` | Подписи, мета |
| `--border-color` | `#e9ecef` | Границы, разделители |
| `--accent-color` | `#4a90d9` | Главные кнопки, ссылки, активные вкладки |
| `--accent-hover` | `#3a7bc8` | Hover акцента |
| `--accent-soft` | `rgba(74, 144, 217, 0.15)` | Мягкий фон под акцентом |
| `--success` | `#28a745` | «В норме», положительный статус |
| `--warning` | `#ffc107` | «Среднее», внимание |
| `--danger` | `#dc3545` | «Узкое место», критичное |
| `--shadow-color` | `rgba(0, 0, 0, 0.04)` | Базовая тень |
| `--shadow-hover` | `rgba(0, 0, 0, 0.08)` | Тень при hover |

### Тёмная тема

| Токен | HEX |
|---|---|
| `--bg-page` | `#161922` |
| `--bg-surface` | `#1e2230` |
| `--bg-surface-soft` | `#252a38` |
| `--bg-header` | `linear-gradient(135deg, #0d1117 0%, #161b22 100%)` |
| `--text-primary` | `#e2e8f0` |
| `--text-secondary` | `#b0b8c8` |
| `--text-muted` | `#8892a4` |
| `--border-color` | `#2d3348` |
| `--accent-color` | `#5ba0e6` |
| `--accent-hover` | `#7bb3ed` |
| `--accent-soft` | `rgba(91, 160, 230, 0.15)` |
| `--success` | `#34ce57` |
| `--warning` | `#ffd43b` |
| `--danger` | `#e4606d` |

### Смысловые цвета (отдельно от акцента)

| Токен | Использование |
|---|---|
| `--status-ok` | `#28a745` — кейс завершён в норме |
| `--status-warn` | `#ffc107` — кейс с задержкой |
| `--status-critical` | `#dc3545` — кейс с простоем, узкое место |
| `--node-default` | `#4a90d9` — обычная активность в графе |
| `--node-bottleneck` | `#dc3545` — узкое место в графе |

**Правило:** акцент (синий) никогда не используется для статусов. Статусы — только через `--status-*`.

---

## 3. Типографика

**Шрифты:** системный стек, без внешних.

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
font-family-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

**Размеры:**

| Элемент | Размер | Вес | Line-height |
|---|---|---|---|
| H1 (шапка) | `clamp(20px, 4vw, 32px)` | 700 | 1.25 |
| H2 (секции) | 22px | 700 | 1.3 |
| H3 (карточки) | 14px | 600 | 1.35 |
| Основной текст | 14px | 400 | 1.6 |
| Метрика (KPI value) | `clamp(20px, 3vw, 28px)` | 700 | 1.2 |
| Метрика (KPI label) | 11px | 400 | 1.4, uppercase |
| Мелкие подписи | 12px | 400 | 1.5 |
| Моноширинный (код) | 13px | 400 | 1.5 |

**Правила:**
- Заголовки — только `font-weight: 700` или `600`.
- Длинные тексты — `max-width: 720px`.
- Кириллица: «ё» сохраняется, тире — em-dash (`—`).

---

## 4. Сетка и размеры

**Контейнер:**

```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;
}
```

**Почему 1280:** дашборды с таблицами и графами требуют ширины. 1280 — оптимум для десктопа.

**Внутренние отступы:**

| Компонент | Padding |
|---|---|
| Карточка | 22px |
| Карточка на мобильном | 16px |
| KPI-карточка | 14px 18px |
| Кнопка lg | 13px / 20px |
| Кнопка md | 10px / 18px |
| Кнопка sm | 6px / 12px |
| Бейдж / чип | 3px / 10px |
| Поле фильтра | 8px / 12px |

**Вертикальный ритм:** кратен 4px (8 / 12 / 16 / 22 / 26 / 32).

**Topbar / Header:**

```css
.header {
  background: var(--bg-header);
  color: white;
  padding: 24px 0 20px;
  border-bottom: 3px solid var(--accent-color);
}
```

---

## 5. Радиусы, тени, границы

**Радиусы:**

| Элемент | Радиус |
|---|---|
| Карточка | 12px |
| KPI-карточка | 12px |
| Кнопка | 6–8px |
| Селект / инпут | 6px |
| Бейдж (pill) | 999px |
| Прогресс-бар / чип | 999px |

**Тени:**
- Только на карточках и модалках.
- `--shadow-color` — базовая тень; `--shadow-hover` — при hover.
- Не тените текст, не тените кнопки (кроме hover).

**Границы:**
- Тонкие: `1px solid var(--border-color)`.
- Толще 2px — только состояние «фокус» (outline 3px).
- Разделители внутри карточек — `1px solid var(--border-color)`.

---

## 6. Компоненты

### 6.1 Карточки

**KPI-карточка (Overview):**

```css
.metric-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 18px;
  box-shadow: 0 1px 3px var(--shadow-color);
  text-align: center;
  transition: transform 0.15s, box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-hover);
}

.metric-card .label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-card .value {
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 2px;
}

.metric-card .trend {
  font-size: 12px;
  color: var(--success);
}

.metric-card .trend.down {
  color: var(--danger);
}
```

**Карточка с графиком:**

```css
.chart-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px var(--shadow-color);
}

.chart-card h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-card .info-badge {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  background: var(--bg-surface-soft);
  padding: 0 10px;
  border-radius: 12px;
}
```

### 6.2 Кнопки

```css
.btn {
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
}

.btn:hover {
  border-color: var(--accent-color);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
  font-weight: 500;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
```

### 6.3 Фильтры (с чипами)

**Строка фильтров:**

```css
.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  background: var(--bg-surface);
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px var(--shadow-color);
  align-items: flex-end;
}

.filters-bar .filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filters-bar label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.filters-bar select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-surface-soft);
  color: var(--text-primary);
  min-width: 140px;
  height: 38px;
  cursor: pointer;
}

.filters-bar select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.filters-bar .filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
```

**Чипы активных фильтров:**

```css
.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-soft);
  color: var(--accent-color);
  border: 1px solid var(--accent-color);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
}

.filter-chip .remove {
  cursor: pointer;
  font-weight: 700;
  margin-left: 4px;
}
```

### 6.4 Таблица «Узкие места» (Bottlenecks)

```css
.table-wrapper {
  overflow-x: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  padding: 12px 16px;
  background: var(--bg-surface-soft);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover {
  background: var(--bg-surface-soft);
}

.data-table .status-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.status-pill.critical { background: rgba(220, 53, 69, 0.15); color: var(--danger); }
.status-pill.warning  { background: rgba(255, 193, 7, 0.15); color: #856404; }
.status-pill.ok       { background: rgba(40, 167, 69, 0.15); color: var(--success); }
```

### 6.5 Граф процесса (Process Map)

**Контейнер:**

```css
.process-map-container {
  width: 100%;
  height: 520px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}
```

**Узлы (активности):**

| Тип узла | Цвет | Размер | Описание |
|---|---|---|---|
| Обычный | `--node-default` (#4a90d9) | `38px` круг | Обычная активность |
| Узкое место | `--node-bottleneck` (#dc3545) | `48px` круг | Активность в топ-3 по нормированному `bottleneck_score` |
| Старт | `--success` (#28a745) | `42px` круг | Первая активность (`Requisition Created`) |
| Конец | `--text-secondary` (#3d4145) | `42px` круг | Последняя активность (`Payment Made`) |

**Рёбра (переходы):**

| Параметр | Значение |
|---|---|
| Толщина | `1px + log(frequency) * 2` |
| Цвет (норма) | `--text-muted` (#6c757d) |
| Цвет (узкое место) | `--danger` (#dc3545) |
| Подпись | Частота и средняя длительность |

**Реализация: Plotly.js `scatter` + кастомные линии (решение DATA-T4-03).**

Почему не Sankey (первоначальный вариант этого документа): Sankey не умеет обратные петли, а в логе их
три значимых — `Legal Review Completed → Draft Contract Created` (7 412), `→ Negotiation Started` (14 608),
`Goods Shipped → Customs Clearance` (18 967). Плюс в Sankey нельзя кликнуть по конкретному ребру.

Как устроено:

| Слой | Тип Plotly | Данные |
|---|---|---|
| Рёбра | `scatter`, `mode: "lines"`, `line.shape: "spline"` | 28 рёбер из `process_map.json` (`frequency`, `avg_duration_days`) |
| Узлы | `scatter`, `mode: "markers+text"` | 25 узлов, координаты из `nodes_metadata[node].avg_position` |
| Сайдбар | HTML-список | Топ-10 рёбер по частоте, клик → drill-down |

Правила раскладки и интерактива:

- `x` — `avg_position` (средний индекс события в кейсе), `y` — детерминированное смещение
  (0 / +0.35 / −0.35), чтобы узлы не слипались; раскладка не «прыгает» между фильтрами.
- Легенда обязательна: старт / конец / узкое место / обычная активность.
- Hover узла: активность, число кейсов, среднее ожидание, нормированный скор.
- Hover ребра: «A → B», частота, средняя длительность перехода.
- Клик по ребру → сайдбар/панель drill-down (см. §6.6).
- Фильтр по категории пересчитывает и узлы (`frequency_by_category`), и рёбра (`edges_by_category`).

**Альтернатива:** D3.js (гибче, но дольше). Для MVP — Plotly.

> Узлы без исходящих рёбер — финальные активности, красить в --text-secondary

### 6.6 Drill-down панель (боковая)

Когда пользователь кликает на ребро графа — открывается боковая панель со списком кейсов.

```css
.drilldown-panel {
  position: fixed;
  top: 0;
  right: -420px;
  width: 420px;
  height: 100vh;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-color);
  box-shadow: -4px 0 12px var(--shadow-hover);
  transition: right 0.25s ease;
  z-index: 1000;
  overflow-y: auto;
  padding: 20px;
}

.drilldown-panel.open {
  right: 0;
}

.drilldown-panel .close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-muted);
}

.drilldown-panel h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.case-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.case-item {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.15s;
}

.case-item:hover {
  background: var(--bg-surface-soft);
}

.case-item .case-id {
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--accent-color);
  font-weight: 600;
}

.case-item .case-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
```

### 6.7 Вкладки (Tabs)

```css
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.tab {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}
```

### 6.8 Тема (переключатель)

```css
.theme-toggle {
  background: transparent;
  color: var(--text-inverse, #fff);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.theme-toggle:hover {
  background: rgba(255,255,255,0.1);
}
```

---

## 7. Анимации и переходы

**Длительности:**
- Микро (hover, focus): `0.15s ease`.
- Средние (карточки, прогресс): `0.25s ease`.
- Появление экранов: `0.3s ease`.

**Единый keyframe:**

```css
@keyframes fade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}

.screen { animation: fade 0.3s ease; }
```

**Что анимировать:**
- Смена ширины прогресс-бара,
- Появление нового экрана,
- Hover карточек (только `transform` + `box-shadow`, не размеры),
- Смену темы (`body` — `transition: background 0.25s ease, color 0.25s ease`).

**Что не анимировать:**
- Layout-свойства (width/height/margin) — тормозит.
- Длинные (>0.4s) — раздражает.

---

## 8. Адаптивность

**Брейкпоинты:** 1024px, 768px, 480px.

| Ширина | Что меняется |
|---|---|
| ≤1024px | `.charts-grid` — 1 колонка; `.insights-grid` — 2 колонки; процесс-граф — `height: 420px` |
| ≤768px | Шапка — в столбик; `.filters-bar` — в столбик; `.tabs` — горизонтальный скролл; `.drilldown-panel` — `width: 100%`, `right: -100%` |
| ≤480px | KPI-карточки — 2 в ряд; шрифты −1–2px; `.data-table` — горизонтальный скролл |

**Правила:**
- На мобильном — одна колонка для контентных сеток.
- Кнопки в столбик, `width: 100%`.
- Минимальная тач-зона: 40×40px.

---

## 9. Готовый CSS-каркас

Скопируй в `site/assets/style.css` и заполняй.

```css
/* ===== ROOT TOKENS ===== */
:root {
  /* Light theme (default) */
  --bg-page: #f5f7fa;
  --bg-surface: #ffffff;
  --bg-surface-soft: #f8f9fa;
  --bg-header: linear-gradient(135deg, #1a2332 0%, #2c3e50 100%);

  --text-primary: #1a2332;
  --text-secondary: #3d4145;
  --text-muted: #6c757d;
  --text-inverse: #ffffff;

  --border-color: #e9ecef;
  --shadow-color: rgba(0, 0, 0, 0.04);
  --shadow-hover: rgba(0, 0, 0, 0.08);

  --accent-color: #4a90d9;
  --accent-hover: #3a7bc8;
  --accent-soft: rgba(74, 144, 217, 0.15);

  --success: #28a745;
  --warning: #ffc107;
  --danger: #dc3545;

  --node-default: #4a90d9;
  --node-bottleneck: #dc3545;

  --transition: background-color 0.2s ease, color 0.2s ease,
                border-color 0.2s ease, box-shadow 0.2s ease;
}

html[data-theme="dark"] {
  --bg-page: #161922;
  --bg-surface: #1e2230;
  --bg-surface-soft: #252a38;
  --bg-header: linear-gradient(135deg, #0d1117 0%, #161b22 100%);

  --text-primary: #e2e8f0;
  --text-secondary: #b0b8c8;
  --text-muted: #8892a4;

  --border-color: #2d3348;
  --shadow-color: rgba(0, 0, 0, 0.2);
  --shadow-hover: rgba(0, 0, 0, 0.35);

  --accent-color: #5ba0e6;
  --accent-hover: #7bb3ed;
  --accent-soft: rgba(91, 160, 230, 0.15);

  --success: #34ce57;
  --warning: #ffd43b;
  --danger: #e4606d;

  --node-default: #5ba0e6;
  --node-bottleneck: #e4606d;
}

/* ===== RESET ===== */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  transition: var(--transition);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;
}

/* ===== HEADER ===== */
.header {
  background: var(--bg-header);
  color: var(--text-inverse);
  padding: 24px 0 20px;
  margin-bottom: 24px;
  border-bottom: 3px solid var(--accent-color);
}

/* ... далее — все компоненты из разделов 6.1–6.8 ... */
```

---

## 10. Что менять, а что оставить

**Оставь без изменений:**
- Один акцент (синий).
- Системный шрифт.
- Скругления 12px для карточек, 6–8px для кнопок.
- Смысловые цвета статусов (`--success`, `--warning`, `--danger`).
- Брейкпоинты 1024 / 768 / 480.
- Тени только на карточках.

**Меняй под задачу:**
| Что | Как |
|---|---|
| Акцент | `--accent-color` (например, зелёный ЕвроХима `#176657`) |
| Фон | `--bg-page`, `--bg-surface` |
| Типографика | Можно подключить Inter, но потеряешь офлайн |
| Граф процесса | Plotly Sankey → D3 (если нужна гибкость) |

**Не делай:**
- ❌ Второй акцент (получится «пёстро»).
- ❌ Чистый чёрный `#000` для фона.
- ❌ Анимацию layout-свойств.
- ❌ Контейнер шире 1400px.