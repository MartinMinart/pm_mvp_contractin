"""
Конвертер CSV → JSON для сайта Process Mining MVP.

Читает:
    data/processed/events.csv
    data/processed/cases.csv

Пишет:
    site/data/overview.json     — KPI-группы (volume / time / quality), динамика по старту кейса
    site/data/process_map.json  — граф процесса с разрезами по категории и импорту
    site/data/bottlenecks.json  — узкие места + нормированный скор и стоимость потерь
    site/data/variants.json     — топ-10 вариантов + покрытие
    site/data/variant_paths.json — топ-15 вариантов с пошаговым составом (данные для конструктора Process Map)

Запуск:
    python tools/csv_to_json.py
"""

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

import pandas as pd

EVENTS_PATH = Path("data/processed/events.csv")
CASES_PATH = Path("data/processed/cases.csv")
OUT_DIR = Path("site/data")

# Колонки events.csv, которые реально нужны агрегатам (файл ~260 МБ, остальное не читаем)
EVENT_COLUMNS = [
    "case_id",
    "activity",
    "timestamp",
    "category",
    "region",
    "procurement_type",
    "supplier",
    "is_import",
    "is_rejected",
    "downtime_cost_per_day",
]

START_ACTIVITY = "Requisition Created"
END_ACTIVITY = "Payment Made"
# Возврат на доработку договора: по этому переходу считаем долю кейсов с итерациями
RETURN_EDGE = ("Legal Review Completed", "Draft Contract Created")

# Статистика ожидания на ребре: частота, среднее/медиана/P90 и уникальные кейсы.
# Возвраты дают несколько переходов на один кейс, поэтому unique_cases ≤ frequency.
EDGE_AGG = {
    "frequency": ("edge_days", "size"),
    "avg_duration_days": ("edge_days", "mean"),
    "median_duration_days": ("edge_days", "median"),
    "p90_duration_days": ("edge_days", lambda s: s.quantile(0.9)),
    "unique_cases": ("case_id", "nunique"),
}
# Колонки длительности, округляемые до 3 знаков после запятой
DURATION_COLS = ("avg_duration_days", "median_duration_days", "p90_duration_days")

log = logging.getLogger("csv_to_json")


def ensure_out_dir() -> None:
    """Создаёт каталог site/data, если его нет."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)


def load_events() -> pd.DataFrame:
    """Читает события (только нужные колонки) и парсит timestamp."""
    df = pd.read_csv(EVENTS_PATH, usecols=EVENT_COLUMNS)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def load_cases() -> pd.DataFrame:
    """Читает атрибуты кейсов (одна строка = один кейс)."""
    return pd.read_csv(CASES_PATH)


def build_case_view(events: pd.DataFrame, cases: pd.DataFrame) -> pd.DataFrame:
    """
    Таблица уровня кейса: старт, финиш, длительность, стоимость простоя, месяц старта.

    Месяц берётся по старту кейса, а не по событию: иначе кейс, идущий 3 месяца,
    попадает в каждый из них, и сумма по месяцам превышает число кейсов.
    """
    bounds = events.groupby("case_id")["timestamp"].agg(start="min", end="max")
    bounds["duration_days"] = (bounds["end"] - bounds["start"]).dt.total_seconds() / 86400

    view = cases.set_index("case_id").join(bounds, how="inner")
    view["total_cost"] = view["duration_days"] * view["downtime_cost_per_day"]
    view["start_month"] = view["start"].dt.to_period("M").astype(str)
    return view


def count_return_cases(events: pd.DataFrame) -> int:
    """Считает кейсы, в которых был возврат «Legal Review Completed → Draft Contract Created»."""
    df = events.sort_values(["case_id", "timestamp"])
    previous = df.groupby("case_id")["activity"].shift(1)
    mask = (previous == RETURN_EDGE[0]) & (df["activity"] == RETURN_EDGE[1])
    return int(df.loc[mask, "case_id"].nunique())


def compute_bottlenecks(events: pd.DataFrame, cases: pd.DataFrame) -> pd.DataFrame:
    """
    Считает узкие места по активностям.

    Ожидание между событиями привязывается к предшествующей активности.
    Скор = (avg_days / Σ avg_days) × std_days, затем нормируется на share_of_cases,
    чтобы активность с малой долей кейсов (Customs Clearance) не выглядела
    в 6 раз хуже, чем процессные этапы с той же задержкой.
    """
    df = events.sort_values(["case_id", "timestamp"])
    df = df.assign(
        next_timestamp=df.groupby("case_id")["timestamp"].shift(-1),
        next_activity=df.groupby("case_id")["activity"].shift(-1),
    )
    df = df.dropna(subset=["next_activity"])

    df["wait_days"] = (df["next_timestamp"] - df["timestamp"]).dt.total_seconds() / 86400
    df["wait_cost"] = df["wait_days"] * df["downtime_cost_per_day"]

    agg = (
        df.groupby("activity")
        .agg(
            transitions=("wait_days", "size"),
            avg_days=("wait_days", "mean"),
            std_days=("wait_days", "std"),
            cost_of_delay_rub=("wait_cost", "sum"),
        )
        .reset_index()
    )

    agg["avg_hours"] = agg["avg_days"] * 24
    agg["std_hours"] = agg["std_days"] * 24

    total_avg = agg["avg_days"].sum()
    agg["bottleneck_score"] = (agg["avg_days"] / total_avg) * agg["std_days"]

    # Доля переходов активности от числа кейсов: у активностей с возвратами может быть > 1.
    agg["share_of_cases"] = agg["transitions"] / len(cases)
    agg["bottleneck_score_normalized"] = agg["bottleneck_score"] * agg["share_of_cases"]

    agg = agg.sort_values("bottleneck_score_normalized", ascending=False).reset_index(drop=True)

    return agg[[
        "activity",
        "avg_hours",
        "std_hours",
        "transitions",
        "avg_days",
        "std_days",
        "bottleneck_score",
        "share_of_cases",
        "bottleneck_score_normalized",
        "cost_of_delay_rub",
    ]]


def to_bottlenecks_json(frame: pd.DataFrame) -> dict:
    """Превращает таблицу узких мест в JSON: полный список + топ-3 для карточек."""
    top3 = frame.head(3)[
        ["activity", "avg_days", "bottleneck_score", "bottleneck_score_normalized"]
    ].to_dict(orient="records")
    return {
        "bottlenecks": frame.to_dict(orient="records"),
        "top3": top3,
    }


def build_process_map(
    events: pd.DataFrame,
    bottlenecks: pd.DataFrame,
    top3_activities: list[str],
) -> dict:
    """
    Строит граф процесса: узлы с метаданными, рёбра с частотой и средней длительностью.

    avg_position — средний индекс события внутри кейса; по нему сайт раскладывает
    узлы слева направо без ручного хардкода координат.
    """
    df = events.sort_values(["case_id", "timestamp"]).copy()
    df["next_timestamp"] = df.groupby("case_id")["timestamp"].shift(-1)
    df["next_activity"] = df.groupby("case_id")["activity"].shift(-1)
    df["position"] = df.groupby("case_id").cumcount()

    edges_src = df.dropna(subset=["next_activity"]).copy()
    edges_src["edge_days"] = (
        edges_src["next_timestamp"] - edges_src["timestamp"]
    ).dt.total_seconds() / 86400

    edges = (
        edges_src.groupby(["activity", "next_activity"])
        .agg(**EDGE_AGG)
        .reset_index()
    )
    edges[list(DURATION_COLS)] = edges[list(DURATION_COLS)].round(3)
    edges = edges.sort_values("frequency", ascending=False).reset_index(drop=True)

    # Рёбра в разрезе категории: фильтр на вкладке Process Map пересчитывает и узлы, и переходы.
    # Иначе граф по категории показывал бы рёбра всего лога (в т.ч. таможню, которой в категории нет).
    per_category_edges = (
        edges_src.groupby(["category", "activity", "next_activity"])
        .agg(**EDGE_AGG)
        .reset_index()
    )
    per_category_edges[list(DURATION_COLS)] = per_category_edges[list(DURATION_COLS)].round(3)

    edges_by_category: dict[str, list[dict]] = {}
    for category, group in per_category_edges.groupby("category"):
        group = group.sort_values("frequency", ascending=False)
        edges_by_category[str(category)] = [
            {
                "activity": str(row.activity),
                "next_activity": str(row.next_activity),
                "frequency": int(row.frequency),
                "avg_duration_days": float(row.avg_duration_days),
                "median_duration_days": float(row.median_duration_days),
                "p90_duration_days": float(row.p90_duration_days),
                "unique_cases": int(row.unique_cases),
            }
            for row in group.itertuples(index=False)
        ]

    per_import_edges = (
        edges_src.groupby(["is_import", "activity", "next_activity"])
        .agg(**EDGE_AGG)
        .reset_index()
    )
    per_import_edges[list(DURATION_COLS)] = per_import_edges[list(DURATION_COLS)].round(3)

    edges_by_import: dict[str, list[dict]] = {"import": [], "no-import": []}
    for is_import, group in per_import_edges.groupby("is_import"):
        key = "import" if int(is_import) else "no-import"
        group = group.sort_values("frequency", ascending=False)
        edges_by_import[key] = [
            {
                "activity": str(row.activity),
                "next_activity": str(row.next_activity),
                "frequency": int(row.frequency),
                "avg_duration_days": float(row.avg_duration_days),
                "median_duration_days": float(row.median_duration_days),
                "p90_duration_days": float(row.p90_duration_days),
                "unique_cases": int(row.unique_cases),
            }
            for row in group.itertuples(index=False)
        ]

    node_position = df.groupby("activity")["position"].mean().sort_values()
    node_cases = df.groupby("activity")["case_id"].nunique()

    scores = bottlenecks.set_index("activity")
    nodes_metadata: dict[str, dict] = {}
    for activity in node_position.index:
        if activity == START_ACTIVITY:
            node_type = "start"
        elif activity == END_ACTIVITY:
            node_type = "end"
        elif activity in top3_activities:
            node_type = "bottleneck"
        else:
            node_type = "normal"

        in_scores = activity in scores.index
        nodes_metadata[str(activity)] = {
            "type": node_type,
            "cases": int(node_cases[activity]),
            "avg_days": round(float(scores.loc[activity, "avg_days"]), 3) if in_scores else None,
            "bottleneck_score_normalized": (
                round(float(scores.loc[activity, "bottleneck_score_normalized"]), 3)
                if in_scores
                else None
            ),
            "avg_position": round(float(node_position[activity]), 2),
        }

    # Частота узла в разрезе категории — для фильтра на вкладке Process Map
    per_category = (
        df.groupby(["category", "activity"])["case_id"]
        .nunique()
        .reset_index(name="cases")
    )
    frequency_by_category: dict[str, dict[str, int]] = {}
    for category, group in per_category.groupby("category"):
        frequency_by_category[str(category)] = {
            str(activity): int(cases_count)
            for activity, cases_count in zip(group["activity"], group["cases"])
        }

    per_import = (
        df.groupby(["is_import", "activity"])["case_id"]
        .nunique()
        .reset_index(name="cases")
    )
    frequency_by_import: dict[str, dict[str, int]] = {"import": {}, "no-import": {}}
    for is_import, group in per_import.groupby("is_import"):
        key = "import" if int(is_import) else "no-import"
        frequency_by_import[key] = {
            str(activity): int(cases_count)
            for activity, cases_count in zip(group["activity"], group["cases"])
        }

    return {
        "nodes": [str(activity) for activity in node_position.index],
        "nodes_metadata": nodes_metadata,
        "edges": edges.to_dict(orient="records"),
        "edges_by_category": edges_by_category,
        "frequency_by_category": frequency_by_category,
        "edges_by_import": edges_by_import,
        "frequency_by_import": frequency_by_import,
    }


def build_overview(
    view: pd.DataFrame,
    cases: pd.DataFrame,
    returns_cases: int,
    total_events: int,
) -> dict:
    """Собирает KPI, динамику по месяцам и срезы для фильтров."""
    monthly = (
        view.groupby("start_month")
        .agg(
            cases=("duration_days", "size"),
            avg_duration_days=("duration_days", "mean"),
            total_cost=("total_cost", "sum"),
            rejected_share=("is_rejected", "mean"),
        )
        .reset_index()
        .rename(columns={"start_month": "month"})
    )
    monthly["avg_duration_days"] = monthly["avg_duration_days"].round(2)
    monthly["rejected_share"] = (monthly["rejected_share"] * 100).round(2)

    monthly_by_category = (
        view.groupby(["start_month", "category"])
        .agg(
            cases=("duration_days", "size"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
        .rename(columns={"start_month": "month"})
    )
    monthly_by_category["avg_duration_days"] = monthly_by_category[
        "avg_duration_days"
    ].round(2)

    def month_summary(row: pd.Series) -> dict:
        return {
            "month": str(row["month"]),
            "avg_duration_days": float(row["avg_duration_days"]),
            "cases": int(row["cases"]),
        }

    best_month = month_summary(monthly.loc[monthly["avg_duration_days"].idxmin()])
    worst_month = month_summary(monthly.loc[monthly["avg_duration_days"].idxmax()])

    total_cost = float(view["total_cost"].sum())
    total_cases = int(len(view))
    avg_duration = float(view["duration_days"].mean())
    median_duration = float(view["duration_days"].median())
    p90_duration = float(view["duration_days"].quantile(0.9))
    rejected_share = 100 * float(view["is_rejected"].mean())
    import_share = 100 * float(view["is_import"].mean())
    returns_share = 100 * returns_cases / total_cases

    def kpi(key: str, label: str, value: float, unit: str, fmt: str, hint: str) -> dict:
        return {
            "key": key,
            "label": label,
            "value": round(float(value), 2),
            "unit": unit,
            "format": fmt,
            "hint": hint,
        }

    kpi_groups = {
        "volume": [
            kpi("total_cases", "Кейсов в логе", total_cases, "", "int",
                "Одна закупка от заявки до оплаты"),
            kpi("total_suppliers", "Поставщиков", cases["supplier"].nunique(), "", "int",
                "Обезличенные supplier_XXX"),
            kpi("total_activities", "Активностей", 25, "", "int",
                "Справочник активностей процесса"),
        ],
        "time": [
            kpi("avg_duration_days", "Средняя длительность", avg_duration, "дн", "days",
                "От «Requisition Created» до «Payment Made»"),
            kpi("median_duration_days", "Медиана длительности", median_duration, "дн", "days",
                "Устойчива к выбросам"),
            kpi("p90_duration_days", "P90 длительности", p90_duration, "дн", "days",
                "90% кейсов укладываются в этот срок"),
        ],
        "quality": [
            kpi("rejected_share", "Отменённые кейсы", rejected_share, "%", "percent",
                "Не дошли до оплаты"),
            kpi("returns_share", "Кейсы с возвратом", returns_share, "%", "percent",
                "Возврат договора на доработку после Legal Review"),
            kpi("import_share", "Импортные кейсы", import_share, "%", "percent",
                "Проходят таможенное оформление"),
        ],
    }

    by_category = (
        view.groupby("category")
        .agg(
            total_cases=("duration_days", "size"),
            total_cost=("total_cost", "sum"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
        .to_dict(orient="records")
    )
    by_region = (
        view.groupby("region")
        .agg(
            total_cases=("duration_days", "size"),
            total_cost=("total_cost", "sum"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
        .to_dict(orient="records")
    )
    by_procurement_type = (
        view.groupby("procurement_type")
        .agg(
            total_cases=("duration_days", "size"),
            total_cost=("total_cost", "sum"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
        .to_dict(orient="records")
    )

    top_category_counts = view["category"].value_counts()

    monthly_by_region = (
        view.groupby(["start_month", "region"])
        .agg(
            cases=("duration_days", "size"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
        .rename(columns={"start_month": "month"})
    )
    monthly_by_region["avg_duration_days"] = monthly_by_region["avg_duration_days"].round(2)

    monthly_by_type = (
        view.groupby(["start_month", "procurement_type"])
        .agg(
            cases=("duration_days", "size"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
        .rename(columns={"start_month": "month"})
    )
    monthly_by_type["avg_duration_days"] = monthly_by_type["avg_duration_days"].round(2)

    by_category_region = (
        view.groupby(["category", "region"])
        .agg(
            total_cases=("duration_days", "size"),
            total_cost=("total_cost", "sum"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
    )
    by_category_region["avg_duration_days"] = by_category_region["avg_duration_days"].round(2)

    by_category_type = (
        view.groupby(["category", "procurement_type"])
        .agg(
            total_cases=("duration_days", "size"),
            total_cost=("total_cost", "sum"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
    )
    by_category_type["avg_duration_days"] = by_category_type["avg_duration_days"].round(2)

    by_region_type = (
        view.groupby(["region", "procurement_type"])
        .agg(
            total_cases=("duration_days", "size"),
            total_cost=("total_cost", "sum"),
            avg_duration_days=("duration_days", "mean"),
        )
        .reset_index()
    )
    by_region_type["avg_duration_days"] = by_region_type["avg_duration_days"].round(2)

    # Контроль: каждый срез покрывает все кейсы лога
    slice_frames = {
        "by_category": by_category,
        "by_region": by_region,
        "by_procurement_type": by_procurement_type,
        "by_category_region": by_category_region,
        "by_category_type": by_category_type,
        "by_region_type": by_region_type,
    }
    for slice_name, frame in slice_frames.items():
        if isinstance(frame, pd.DataFrame):
            slice_total = int(frame["total_cases"].sum())
        else:
            slice_total = int(sum(row["total_cases"] for row in frame))
        if slice_total != total_cases:
            raise AssertionError(
                f"Срез {slice_name}: сумма total_cases {slice_total} != {total_cases}"
            )
    log.info("   контроль срезов: сумма total_cases = %d во всех %d срезах", total_cases, len(slice_frames))

    import datetime as _dt
    generated_at = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    period_start = str(monthly["month"].min()) if not monthly.empty else generated_at[:7]
    period_end = str(monthly["month"].max()) if not monthly.empty else generated_at[:7]

    drivers = [
        {"key": "avg_duration_days", "label": "Средняя длительность", "value": round(float(avg_duration), 2), "unit": "дн"},
        {"key": "rejected_share", "label": "Отменённые кейсы", "value": round(float(rejected_share), 2), "unit": "%"},
        {"key": "returns_share", "label": "Кейсы с возвратом", "value": round(float(returns_share), 2), "unit": "%"},
    ]
    # pick top 3 by impact-ish: just first 3 as requested
    headline = f"Средняя длительность {avg_duration:.1f} дн при {rejected_share:.1f}% отмен и {returns_share:.1f}% возвратов"
    action = "Сфокусироваться на узких местах по времени ожидания и снизить долю возвратов"

    return {
        "generated_at": generated_at,
        "period_start": period_start,
        "period_end": period_end,
        "source_version": "synthetic-v1",
        "total_cases": total_cases,
        "total_events": int(total_events),
        "total_cost": total_cost,
        "cost_per_case": total_cost / total_cases,
        "avg_duration_days": avg_duration,
        "median_duration_days": median_duration,
        "p90_duration_days": p90_duration,
        "top_category": str(top_category_counts.index[0]),
        "top_category_count": int(top_category_counts.iloc[0]),
        "rejected_share": rejected_share,
        "returns_share": returns_share,
        "import_share": import_share,
        "kpi_groups": kpi_groups,
        "monthly": monthly.to_dict(orient="records"),
        "monthly_by_category": monthly_by_category.to_dict(orient="records"),
        "monthly_by_region": monthly_by_region.to_dict(orient="records"),
        "monthly_by_type": monthly_by_type.to_dict(orient="records"),
        "best_month": best_month,
        "worst_month": worst_month,
        "by_category": by_category,
        "by_region": by_region,
        "by_procurement_type": by_procurement_type,
        "by_category_region": by_category_region.to_dict(orient="records"),
        "by_category_type": by_category_type.to_dict(orient="records"),
        "by_region_type": by_region_type.to_dict(orient="records"),
        "executive": {
            "headline": headline,
            "drivers": drivers,
            "action": action,
        },
    }


def build_variants(events: pd.DataFrame, view: pd.DataFrame) -> dict:
    """Топ-10 вариантов процесса + покрытие и средняя длительность."""
    ordered = events.sort_values(["case_id", "timestamp"])
    per_case_variant = ordered.groupby("case_id")["activity"].agg(" → ".join)

    total_cases = int(len(per_case_variant))
    counts = (
        per_case_variant.value_counts()
        .rename_axis("variant")
        .reset_index(name="frequency")
    )

    case_frame = pd.DataFrame(
        {"variant": per_case_variant, "duration_days": view["duration_days"]}
    )
    avg_duration = case_frame.groupby("variant")["duration_days"].mean()

    top = counts.head(10).copy()
    top["share_percent"] = (top["frequency"] / total_cases * 100).round(2)
    top["avg_duration_days"] = top["variant"].map(avg_duration).round(2)

    return {
        "total_variants": int(len(counts)),
        "total_cases": total_cases,
        "top10_cases": int(top["frequency"].sum()),
        # Покрытие считаем по частотам, а не суммой округлённых долей:
        # иначе 88.40% превращается в 88.41% из-за накопления округления.
        "top10_coverage_percent": round(float(top["frequency"].sum()) / total_cases * 100, 2),
        "variants": top.to_dict(orient="records"),
    }


def build_variant_paths(events: pd.DataFrame, view: pd.DataFrame) -> dict:
    """
    Топ-15 вариантов с пошаговым составом — данные для конструктора Process Map.

    Для каждого варианта steps[position] содержит активность и число кейсов группы,
    у которых на этой позиции стоит эта активность. Вариант — точная последовательность
    кейса, поэтому сейчас cases совпадает с frequency на каждой позиции; поле оставлено
    отдельным как задел под префиксные режимы конструктора.
    """
    ordered = events.sort_values(["case_id", "timestamp"])
    per_case_variant = ordered.groupby("case_id")["activity"].agg(" → ".join)

    total_cases = int(len(per_case_variant))
    counts = per_case_variant.value_counts()
    top = counts.head(15)

    # События только кейсов из топ-15: у каждого кейса вариант однозначен,
    # поэтому маппинг case_id → variant корректен для всей его последовательности.
    top_case_ids = per_case_variant.index[per_case_variant.isin(top.index)]
    sub = ordered[ordered["case_id"].isin(top_case_ids)].copy()
    sub["variant"] = sub["case_id"].map(per_case_variant)
    # Позиция события внутри кейса (0-based): одно событие на позицию
    sub["position"] = sub.groupby("case_id").cumcount()

    # Срез (variant, position) → активность и число кейсов группы на этой позиции.
    # size = число событий = число кейсов: cumcount даёт одно событие на позицию кейса.
    step_agg = (
        sub.groupby(["variant", "position"])
        .agg(activity=("activity", "first"), cases=("activity", "size"))
        .reset_index()
    )

    variants_out = []
    for rank, (variant, frequency) in enumerate(top.items(), start=1):
        steps = (
            step_agg[step_agg["variant"] == variant]
            .sort_values("position")
            .reset_index(drop=True)
        )
        case_ids = per_case_variant.index[per_case_variant == variant]
        avg_duration = view.loc[case_ids, "duration_days"].mean()

        variants_out.append({
            "rank": rank,
            "variant": str(variant),
            "frequency": int(frequency),
            "share_percent": round(int(frequency) / total_cases * 100, 2),
            "avg_duration_days": round(float(avg_duration), 2),
            "steps": [
                {
                    "position": int(row.position),
                    "activity": str(row.activity),
                    "cases": int(row.cases),
                }
                for row in steps.itertuples(index=False)
            ],
        })

    return {
        "total_cases": total_cases,
        "total_variants": int(len(counts)),
        "variants": variants_out,
    }


def write_json(name: str, payload: dict) -> None:
    """Пишет JSON в site/data и логирует размер файла."""
    path = OUT_DIR / name
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    path.write_text(text, encoding="utf-8")
    log.info("   ✅ %s — %.0f КБ", name, len(text.encode("utf-8")) / 1024)


def main() -> None:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(message)s", force=True)
    sys.stdout.reconfigure(errors="replace")

    log.info("=" * 60)
    log.info("CSV → JSON")
    log.info("=" * 60)

    if not EVENTS_PATH.exists() or not CASES_PATH.exists():
        log.error("❌ Нет данных. Запусти: python tools/generate_synthetic.py")
        return

    started = time.perf_counter()

    log.info("📂 Читаю %s...", EVENTS_PATH)
    events = load_events()
    log.info("   Строк: %s", f"{len(events):,}".replace(",", " "))

    log.info("📂 Читаю %s...", CASES_PATH)
    cases = load_cases()
    log.info("   Строк: %s", f"{len(cases):,}".replace(",", " "))

    ensure_out_dir()

    view = build_case_view(events, cases)

    log.info("\n🔨 Строю bottlenecks.json...")
    bottlenecks_frame = compute_bottlenecks(events, cases)
    top3_activities = bottlenecks_frame.head(3)["activity"].tolist()
    write_json("bottlenecks.json", to_bottlenecks_json(bottlenecks_frame))

    log.info("🔨 Строю process_map.json...")
    process_map = build_process_map(events, bottlenecks_frame, top3_activities)
    write_json("process_map.json", process_map)

    log.info("🔨 Строю overview.json...")
    returns_cases = count_return_cases(events)
    overview = build_overview(view, cases, returns_cases, total_events=len(events))
    write_json("overview.json", overview)

    log.info("🔨 Строю variants.json...")
    variants = build_variants(events, view)
    write_json("variants.json", variants)

    log.info("🔨 Строю variant_paths.json...")
    variant_paths = build_variant_paths(events, view)
    write_json("variant_paths.json", variant_paths)

    log.info("")
    log.info("Контрольные цифры:")
    log.info("   кейсов:            %s", f"{overview['total_cases']:,}".replace(",", " "))
    log.info("   событий:           %s", f"{overview['total_events']:,}".replace(",", " "))
    log.info("   стоимость простоя: %s ₽", f"{overview['total_cost']:,.0f}".replace(",", " "))
    log.info("   средняя длительность: %.3f дн", overview["avg_duration_days"])
    log.info("   вариантов: %d, покрытие топ-10: %.2f%%",
             variants["total_variants"], variants["top10_coverage_percent"])
    log.info("   узлов/рёбер графа: %d / %d",
             len(process_map["nodes"]), len(process_map["edges"]))
    log.info("   топ-3 узких места: %s", ", ".join(top3_activities))

    top_edge = process_map["edges"][0]
    log.info("   топ-ребро: %s → %s", top_edge["activity"], top_edge["next_activity"])
    log.info("     частота %d · уникальных кейсов %d · медиана %.3f дн · P90 %.3f дн",
             top_edge["frequency"], top_edge["unique_cases"],
             top_edge["median_duration_days"], top_edge["p90_duration_days"])

    first_path = variant_paths["variants"][0]
    log.info("   вариант №%d: %d кейсов · %d шагов · %s … %s",
             first_path["rank"], first_path["frequency"], len(first_path["steps"]),
             first_path["steps"][0]["activity"], first_path["steps"][-1]["activity"])

    log.info("\n✅ Готово за %.1f с. Файлы в %s", time.perf_counter() - started, OUT_DIR)


if __name__ == "__main__":
    main()
