# Данные проекта: что есть, как их читать

Этот документ — памятка по данным. Здесь описано, откуда берутся данные, как они выглядят, какие есть ограничения, и как быстро проверить их качество.

## 1) Источники данных

- **Тип данных:** синтетические (сгенерированы скриптом `tools/generate_synthetic.py`)
- **Объём**: **50 000** кейсов, **1 094 474** событий, **25** активностей.
- **Seed:** фиксированный `SEED = 42`
- **Период:** 2024-01 — 2024-12 (12 месяцев)
- **Генератор:** `tools/generate_synthetic.py`
- **Валидация:** `tools/validate.py`
- **Агрегация для сайта:** `tools/csv_to_json.py`
- **Данные обезличенные**: только `supplier_001..`, роли исполнителей, без ПДн.

## 2) Локальные файлы (data/processed)

Файлы генерируются локально, **не коммитятся** в репозиторий.

| Файл | Описание | Статус |
|---|---|---|
| `data/processed/cases.csv` | Атрибуты кейса. 1 строка = 1 кейс. Содержит `case_id`, `category`, `procurement_type`, `region`, `department`, `supplier`, `currency`, `amount`, `downtime_cost_per_day`, `is_import`, `is_rejected`. | Генерируется локально |
| `data/processed/events.csv` | Event log. Сортирован по кейсу/времени. Содержит `case_id`, `activity`, `timestamp`, `resource`, `phase`, `source_system`, `document_type`, `document_status`, `category`, `procurement_type`, `region`, `supplier`, `is_import`, `is_rejected`, `downtime_cost_per_day`. | Генерируется локально (~259 МБ) |

## 3) Структура полей

### cases.csv - `data/processed/cases.csv` (атрибуты кейса)
Фактическая структура (11 колонок):

| Поле | Тип | Описание |
|---|---|---|
| `case_id` | object | Уникальный ID кейса (`CASE-000001`) |
| `category` | object | Категория закупки (ЗИП (запчасти), Подрядные работы, Спецтехника, Обслуживание оборудования, Химические реагенты) |
| `procurement_type` | object | Тип закупки (Тендер, Запрос котировок, Рамочный договор, Единственный поставщик) |
| `region` | object | Регион (Кировск, Апатиты, Ковдор, Мурманск) |
| `department` | object | Подразделение |
| `supplier` | object | Поставщик (`Поставщик_XXX`) |
| `currency` | object | Валюта (RUB) |
| `amount` | float64 | Сумма контракта, руб. |
| `downtime_cost_per_day` | int | Стоимость простоя, руб/день |
| `is_import` | int64 | 0/1 — импортный кейс |
| `is_rejected` | int64 | 0/1 — кейс отменён |

### events.csv (17 колонок)
Помимо полей кейса (`case_id`, `category`, `procurement_type`, `region`, `department`, `supplier`, `amount`, `is_import`, `is_rejected`, `downtime_cost_per_day`), содержит события процесса:

| Поле | Тип | Описание |
|---|---|---|
| `case_id` | object | ID кейса |
| `activity` | object | Активность (см. `spec/activity_dictionary.md`) |
| `timestamp` | object (ISO 8601) | Время события |
| `resource` | object | Роль |
| `phase` | object | Фаза (`sourcing`, `contracting`, `logistics`, `execution`) |
| `source_system` | object | Система-источник (`SAP SRM`, `SAP ERP`) |
| `document_type` | object | Тип документа (пусто) |
| `document_status` | object | Статус документа (пусто) |
| `category` | object | Категория |
| `procurement_type` | object | Тип закупки |
| `region` | object | Регион |
| `department` | object | Подразделение |
| `supplier` | object | Поставщик |
| `amount` | float64 | Сумма |
| `is_import` | int64 | 0/1 |
| `is_rejected` | int64 | 0/1 |
| `downtime_cost_per_day` | int64 | Стоимость простоя |

## 4) Статистика

### Фактическая

| Показатель | Значение |
| --- | --- |
| Всего кейсов | 50 000 |
| Всего событий | 1 094 474 |
| Всего активностей | 25 |
| Период | 2024-01 — 2024-12 |
| Средняя длительность кейса | 35.68 дн. |
| Медианная длительность кейса | 33.33 дн. |
| P90 длительности кейса | 54.29 дн. |
| Общая стоимость простоя | 534 392 476 278 ₽ |
| Доля отменённых (`is_rejected=1`) | 4.824% |
| Доля возвратов | 14.824% |
| Доля импортных (`is_import=1`) | 39.872% |
| Пропуски `document_type` | **100%** (пусто) |
| Пропуски `document_status` | **100%** (пусто) |

### Описательная статистика (по `cases.csv`)
| Метрика | amount (руб) | downtime_cost_per_day (руб/день) |
|---|---|---|
| count | 50000 | 50000 |
| mean | ~2 500 000 | ~300 000 |
| std | ~1 400 000 | ~115 000 |
| min | ~50 000 | ~100 000 |
| 25% | ~1 400 000 | ~200 000 |
| 50% (медиана) | ~2 500 000 | ~300 000 |
| 75% | ~3 600 000 | ~400 000 |
| max | ~5 000 000 | ~500 000 |

*(Значения ориентировочные по синтетике с SEED=42; точные — смотреть в ноутбуке диагностики).*

## 5) Примеры строк

### cases.csv (первые строки)
```csv
case_id,category,procurement_type,region,department,supplier,currency,amount,downtime_cost_per_day,is_import,is_rejected
CASE-000001,ЗИП (запчасти),Тендер,Ковдор,Главный механик,Поставщик_029,RUB,3695532.51,454785,0,0
CASE-000002,Химические реагенты,Тендер,Апатиты,ОТиПБ,Поставщик_054,RUB,2273584.78,245852,0,1
CASE-000003,Химические реагенты,Единственный поставщик,Кировск,Горный департамент,Поставщик_049,RUB,1826947.93,280331,0,0
```
| case_id | category | procurement_type | region | department | supplier | currency | amount | downtime_cost_per_day | is_import | is_rejected |
|---|---|---|---|---|---|---|---|---|---|---|
| CASE-000001 | ЗИП (запчасти) | Тендер | Кировск | Горный департамент | Поставщик_042 | RUB | 1234567.89 | 1500000 | 1 | 0 |

### events.csv (фрагмент кейса)
```csv
case_id,activity,timestamp,resource,phase,source_system,document_type,document_status,category,procurement_type,region,department,supplier,amount,is_import,is_rejected,downtime_cost_per_day
CASE-000001,Requisition Created,2024-02-17T11:00:00,Специалист по закупкам,sourcing,SAP SRM,,,ЗИП (запчасти),Тендер,Ковдор,Главный механик,Поставщик_029,3695532.51,0,0,454785
CASE-000001,Technical Review Started,2024-02-17T17:00:00,Главный механик,sourcing,SAP SRM,,,ЗИП (запчасти),Тендер,Ковдор,Главный механик,Поставщик_029,3695532.51,0,0,454785
CASE-000001,Technical Review Completed,2024-02-20T09:00:00,Главный механик,sourcing,SAP SRM,,,ЗИП (запчасти),Тендер,Ковдор,Главный механик,Поставщик_029,3695532.51,0,0,454785
```

| case_id | activity | timestamp | resource | phase | source_system | document_type | document_status | category | procurement_type | region | department | supplier | amount | is_import | is_rejected | downtime_cost_per_day |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CASE-000001 | Requisition Created | 2024-03-15T09:00:00 | Специалист по закупкам | sourcing | SAP SRM | | | ЗИП (запчасти) | Тендер | Кировск | Горный департамент | Поставщик_042 | 1234567.89 | 1 | 0 | 1500000 |

## 6) Агрегаты для сайта (site/data/*.json)

Статический сайт читает только предагрегированные JSON (без сырых событий).

| Файл | Назначение |
|---|---|
| `site/data/overview.json` | KPI, фильтры Overview (по категориям/регионам/типам/месяцам), executive summary |
| `site/data/process_map.json` | Узлы/рёбра DFG, метаданные узлов, срезы по категориям и по импорту |
| `site/data/bottlenecks.json` | 24 активности, метрики узких мест, топ-3 |
| `site/data/variants.json` | Топ-10 вариантов + «прочие», покрытие 88.4% |
| `site/data/variant_paths.json` | Пути вариантов для режимов «Один вариант»/«Диапазон» в Process Map |

## 7) Как проверить качество данных

1. **Валидация лога**: `python tools/validate.py` — проверяет колонки, NULL, монотонность времени, дубли, соответствие кейсов.
2. **Диагностика**: `data/processed/data_diagnostics.ipynb` — EDA, проверки качества, сводные статистики.
3. **Сайт**: запустить локальный сервер (`python -m http.server 8000` в корне) и открыть `http://localhost:8000/site/` — визуальная проверка всех вкладок.
