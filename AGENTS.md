# AGENTS.md — Конституция проекта pm_mvp_contracting

## 1. Что за проект

**Process Mining MVP для закупок/контрактации в горнодобывающем холдинге (контекст ЕвроХим / Центр компетенций).**

Задача: показать, что Process Mining можно строить **без закупки Celonis**, используя:
- открытые библиотеки (pm4py, pandas, Plotly);
- внутреннюю корпоративную LLM как оркестратор и генератор кода;
- локальный DuckDB для аналитики и GitHub Pages для демо.

Проект — **портфолио-демо** для собеседования в Центре компетенций (центр компетенций Process Mining). Он должен показать:
1. Понимание процесса «закупка → контрактация» в горнодобыче.
2. Умение строить event log и применять Process Mining (discovery, performance, bottlenecks).
3. Навык разворачивать инфраструктуру (Docker, облако, MCP, LLM).
4. Способность работать по методологии SDD (spec → plan → tasks → code).

## 2. Структура проекта
pm_mvp_contracting/
├── spec/ # Спецификации и дизайн
│ ├── spec.md # Главная спецификация (гибрид TAD + ЕвроХим)
│ ├── design.md # Дизайн-система (на основе index.html)
│ ├── data_model.md # Модель данных event log
│ ├── activity_dictionary.md
│ └── prompt_for_new_chat.md
├── data/
│ ├── raw/ # Сырые данные (не в Git)
│ └── processed/ # events.csv, cases.csv (не в Git, генерируются локально)
├── tools/
│ ├── generate_synthetic.py # Генератор синтетики
│ ├── csv_to_json.py # CSV → JSON для GitHub Pages
│ └── validate.py # Валидация лога (XES-совместимость)
├── notebooks/
│ └── 01_pm4py_analysis.ipynb # DFG, Petri net, variant analysis, bottlenecks
├── site/ # Статика для GitHub Pages
│ ├── index.html
│ ├── assets/
│ │ ├── style.css
│ │ └── app.js
│ └── data/ # Агрегаты JSON (не сырые события)
├── harness/ # Скрипты Harness (генерация, валидация)
├── docs/ # Документация (C4, ADR, decision-log)
├── logs/ # Логи (не в Git)
├── .gitignore
├── AGENTS.md # этот файл
└── README.md

## 3. Стек

| Слой | Технология | Почему |
|---|---|---|
| Данные (локально) | **DuckDB** | Embedded, без сервера, 8 ГБ RAM. Статус: задел на drill-down до case-level (AC-8), второй этап — в MVP пайплайн CSV → pandas → JSON, DuckDB не используется |
| Данные (демо) | **CSV + JSON** | Для GitHub Pages, без бэкенда |
| Генерация | **Python 3.11+, pandas, numpy** | Стандарт для data |
| Process Mining | **pm4py** | Открытый движок, альтернатива Celonis |
| Визуализация (ноутбук) | **matplotlib, seaborn** | Для скриншотов в README |
| Визуализация (сайт) | **Plotly.js** | Как в `index.html`, интерактив |
| Документация | **Markdown, Mermaid** | Для C4, графов, диаграмм |
| Хостинг | **GitHub Pages** | Бесплатно, без лимита трафика |
| Оркестратор (опционально) | **Внутренняя LLM** | Генерация кода, анализ |

**Запрещено в MVP:**
- PostgreSQL / Neon (только вторым этапом).
- Docker / Kubernetes (локально не нужны).
- Celonis / Disco / UiPath (только как эталон для сравнения в спеке).
- n8n / AI-агент в рантайме (только как слой на будущее в спеке).

## 4. Правила работы с данными

- **Синтетика генерируется скриптом**, а не руками.
- **Seed фиксирован** (`SEED = 42`) — воспроизводимость.
- **Данные не коммитятся:** `events.csv` (259 МБ) и `cases.csv` (8 МБ) генерируются локально с `SEED = 42`. `.gitignore` — источник истины по исключениям.
- **Сырые логи ЕвроХима не используются** (их нет и не должно быть в портфолио).
- **Никаких ПДн**, только обезличенные `supplier_001`, `employee_role`.

## 5. Правила работы с кодом

- **Python:** PEP 8, type hints, docstrings на русском.
- **JS/CSS:** без фреймворков, только vanilla + Plotly.js.
- **Тесты:** pytest для генератора и валидатора; для сайта — ручная проверка в браузере.
- **Коммиты:** `тип: область, описание` (например, `feat: generator, добавлен HSE review`).
- **Вывод:** в CLI-инструментах (`validate.py`, `csv_to_json.py`) допустим `print()` для пользовательского вывода; в библиотечном коде — только `logging`. `validate.py` — CLI, `print` разрешён.

## 6. Правила работы с внутренней LLM

- **LLM не считает метрики сам** — только генерирует код для pandas/pm4py.
- **Данные не уходят в LLM** — передаём только схему (имена колонок, типы, примеры).
- **Проверка обязательна:** любой сгенерированный код запускается и проверяется.
- **Промпт для LLM** — в `spec/prompt_for_new_chat.md`.

## 7. Что нельзя делать

- ❌ Менять `generate_synthetic.py` без обновления `activity_dictionary.md`.
- ❌ Коммитить `.duckdb`, `.env`, `logs/`.
- ❌ Использовать Celonis API или копировать его UI 1:1.
- ❌ Добавлять зависимости без обоснования в `docs/decision-log.md`.
- ❌ Генерировать данные, которые не проходят `validate.py`.
- ❌ Врать в README про «промышленное внедрение» — это портфолио-демо.

## 8. Definition of Done для MVP

MVP считается готовым, когда:
1. `events.csv` и `cases.csv` сгенерированы и проходят `validate.py`.
2. Ноутбук `01_pm4py_analysis.ipynb` строит DFG, Petri net, variant analysis, bottlenecks.
3. `site/index.html` показывает 3 вкладки: **Overview**, **Process Map**, **Bottlenecks**.
4. `README.md` содержит: описание, скриншоты, ссылку на GitHub Pages, инструкцию запуска.
5. `docs/c4.md` содержит C4-диаграммы (Context, Container).
6. `spec/prompt_for_new_chat.md` готов для передачи в новый чат.