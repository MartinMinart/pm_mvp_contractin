# Данные проекта: что есть, что можно строить

Подробное описание полей и статистики см. в глобальной `docs/data_overview.md`.

## 1) Исходные данные (локальные)
- `data/processed/cases.csv` (8 МБ) — атрибуты кейса: `case_id`, `category`, `procurement_type`, `region`, `department`, `supplier`, `currency`, `amount`, `downtime_cost_per_day`, `is_import`, `is_rejected`. Одно строка = один кейс (50 000).
- `data/processed/events.csv` (~259 МБ) — события процесса: `case_id`, `activity`, `timestamp`, `category`, `region`, `procurement_type`, `supplier`, `is_import`, `is_rejected`, `downtime_cost_per_day`. Сортирован по кейсу/времени. 1 094 474 события.

**Seed:** `SEED = 42` (воспроизводимость). Данные синтетические, обезличенные.

## 2) Агрегаты для сайта (site/data/*.json)
| Файл | Назначение | Содержимое |
|---|---|---|
| `overview.json` | Executive + фильтры Overview | `total_cases/events/cost`, KPI-группы, `monthly`, `monthly_by_category/region/type`, `by_category/region/procurement_type`, `by_category_region/type`, `by_region_type`, `best/worst_month`, `executive`, метаданные `generated_at/period_start/period_end/source_version` |
| `process_map.json` | DFG + узлы/рёбра | `nodes`, `edges`, `nodes_metadata` (phase/role/type/avg_position), `edges_by_category`, `frequency_by_category` |
| `bottlenecks.json` | Узкие места | `bottlenecks[]` (activity, transitions, avg_days, std_days, share_of_cases, bottleneck_score/normalized, cost_of_delay_rub) |
| `variants.json` | Варианты | `variants[]` (rank, variant, frequency, share_percent, cumulative_percent, avg_duration_days), `top10_cases`, `top10_coverage_percent` |
| `variant_paths.json` | Конструктор карт процесса | `variants[]` с `steps[]` (position, activity, cases) — топ-15 из ~80 |

## 3) Ключевые метрики
- **Длительность кейса**: от `Requisition Created` до `Payment Made` (дни)
- **Потери от простоя**: `duration_days * downtime_cost_per_day` по кейсу (оценка). В Bottlenecks `cost_of_delay_rub` — сумма ожиданий, умноженных на `downtime_cost_per_day`.
- **Возвраты**: переход `Legal Review Completed -> Draft Contract Created` (доля кейсов с итерациями)
- **Импорт**: `is_import = 1` (таможенное оформление)
- **Отмены**: `is_rejected = 1`

## 4) Какие графики можно построить
| Класс | Примеры | Пояснение |
|---|---|---|
| Process Discovery | DFG, вертикальный flowchart (вариант/диапазон) | Карта реального потока |
| Performance | Heatmap длительности по переходам, boxplot/percentiles (avg/median/P90) | Узкие места по времени |
| Conformance/Variants | Кривая покрытия вариантов, Pareto-топ вариантов | Степень "стандартизации" процесса |
| Time-series | Динамика средней длительности по месяцам старта, разброс, коридор ±5% | Тренды/аномалии |
| Срезы | По категории/региону/типу закупки/месяцу | Фильтрация под бизнес |
| Cost/Impact | Топ-активности по `cost_of_delay_rub`, потери по срезам | Экономический эффект |

## 5) Ограничения данных
- Синтетика (SEED=42), портфолио-демо
- 25 активностей, 4 фазы (sourcing/contracting/logistics/execution)
- Только 1 процесс "закупка->контрактация"
- Фильтры по 4 измерениям
- `variant_paths.json` частичен (топ-15) относительно `total_variants: 80`
