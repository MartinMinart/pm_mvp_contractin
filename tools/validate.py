"""
Валидатор event log для Process Mining MVP.

Проверяет:
- обязательные колонки;
- NULL в case_id, timestamp;
- монотонность timestamp внутри кейса;
- дубли (case_id, activity, timestamp);
- referential integrity events → cases;
- логическую согласованность (is_import → Customs Clearance);
- парсинг timestamp как ISO 8601.

Запуск:
    python tools/validate.py
"""

import sys
from pathlib import Path
import pandas as pd

EVENTS_PATH = Path("data/processed/events.csv")
CASES_PATH = Path("data/processed/cases.csv")

WARNINGS: list[str] = []

REQUIRED_EVENT_COLS = {
    "case_id", "activity", "timestamp", "resource",
    "phase", "source_system", "category", "procurement_type",
    "region", "department", "supplier", "amount",
    "is_import", "is_rejected", "downtime_cost_per_day",
}
REQUIRED_CASE_COLS = {
    "case_id", "category", "procurement_type", "region",
    "department", "supplier", "amount", "downtime_cost_per_day",
    "is_import", "is_rejected",
}

def fail(msg: str) -> None:
    print(f"❌ FAIL: {msg}")
    sys.exit(1)

def warn(msg: str) -> None:
    WARNINGS.append(msg)
    print(f"⚠️  WARN: {msg}")

def find_non_monotonic_cases(df_events: pd.DataFrame) -> list[str]:
    """Возвращает кейсы, где timestamp нарушает монотонность в порядке файла.

    Сортировка не применяется: она бы скрыла нарушение (любой
    отсортированный ряд монотонен), а по data_model.md кейс-аномалия
    должен быть исключён из DFG.
    """
    if df_events.empty:
        return []
    diffs = df_events.groupby("case_id")["timestamp_parsed"].diff()
    return df_events.loc[diffs < pd.Timedelta(0), "case_id"].unique().tolist()

def main() -> None:
    sys.stdout.reconfigure(errors="replace")
    print("=" * 60)
    print("Валидация event log")
    print("=" * 60)

    # 1. Файлы
    if not EVENTS_PATH.exists():
        fail(f"Нет файла {EVENTS_PATH}. Запусти: python tools/generate_synthetic.py")
    if not CASES_PATH.exists():
        fail(f"Нет файла {CASES_PATH}")

    print(f"\n📂 Читаю {EVENTS_PATH}...")
    df_events = pd.read_csv(EVENTS_PATH, usecols=sorted(REQUIRED_EVENT_COLS))
    print(f"   Строк: {len(df_events):,}")

    print(f"📂 Читаю {CASES_PATH}...")
    df_cases = pd.read_csv(CASES_PATH)
    print(f"   Строк: {len(df_cases):,}")

    # 2. Колонки
    missing_events = REQUIRED_EVENT_COLS - set(df_events.columns)
    if missing_events:
        fail(f"В events.csv нет колонок: {missing_events}")

    missing_cases = REQUIRED_CASE_COLS - set(df_cases.columns)
    if missing_cases:
        fail(f"В cases.csv нет колонок: {missing_cases}")

    print("\n✅ Все обязательные колонки на месте")

    # 3. NULL в case_id, timestamp
    if df_events["case_id"].isna().any():
        fail("В events.csv есть NULL в case_id")
    if df_events["timestamp"].isna().any():
        fail("В events.csv есть NULL в timestamp")

    print("✅ Нет NULL в case_id, timestamp")

    # 4. Парсинг timestamp
    try:
        df_events["timestamp_parsed"] = pd.to_datetime(df_events["timestamp"], errors="raise")
    except Exception as e:
        fail(f"Не парсится timestamp: {e}")

    print("✅ timestamp парсится как ISO 8601")

    # 5. Монотонность внутри кейса (в исходном порядке файла, без сортировки)
    anomalies = find_non_monotonic_cases(df_events)
    if anomalies:
        warn(f"Нарушена монотонность в {len(anomalies)} кейсах: {anomalies[:5]}")
    else:
        print("✅ Монотонность timestamp внутри кейсов")

    # 6. Дубли
    dup_key = ["case_id", "activity", "timestamp"]
    dup_count = df_events.duplicated(subset=dup_key).sum()
    if dup_count > 0:
        warn(f"Дублей по {dup_key}: {dup_count}")
    else:
        print("✅ Нет дублей (case_id, activity, timestamp)")

    # 7. Referential integrity
    events_ids = set(df_events["case_id"].unique())
    cases_ids = set(df_cases["case_id"].unique())
    orphans = events_ids - cases_ids
    if orphans:
        fail(f"В events.csv есть case_id, которых нет в cases.csv: {len(orphans)}")
    print("✅ Referential integrity events → cases")

    # 8. Логическая согласованность: is_import → Customs Clearance
    #    (исключаем отменённые кейсы: они не обязаны доходить до таможни)
    import_cases = set(
        df_cases[(df_cases["is_import"] == 1) & (df_cases["is_rejected"] == 0)]["case_id"]
    )
    customs_cases = set(df_events[df_events["activity"] == "Customs Clearance"]["case_id"])
    missing_customs = import_cases - customs_cases
    if missing_customs:
        warn(f"is_import=1 (не отменённые), но нет Customs Clearance: {len(missing_customs)} кейсов")
    else:
        print("✅ Все импортные (не отменённые) кейсы прошли Customs Clearance")

    # 9. Логическая согласованность: is_rejected → нет Payment Made
    rejected = set(df_cases[df_cases["is_rejected"] == 1]["case_id"])
    paid = set(df_events[df_events["activity"] == "Payment Made"]["case_id"])
    rejected_paid = rejected & paid
    if rejected_paid:
        warn(f"is_rejected=1, но есть Payment Made: {len(rejected_paid)} кейсов")
    else:
        print("✅ Отменённые кейсы не доходят до Payment Made")

    # 10. Статистика
    print("\n" + "=" * 60)
    print("📊 Статистика")
    print("=" * 60)
    print(f"   Кейсов:                    {df_events['case_id'].nunique():,}")
    print(f"   Событий:                   {len(df_events):,}")
    print(f"   Уникальных активностей:    {df_events['activity'].nunique()}")
    print(f"   Уникальных категорий:      {df_events['category'].nunique()}")
    print(f"   Уникальных поставщиков:    {df_events['supplier'].nunique()}")
    print(f"   Период:                    {df_events['timestamp_parsed'].min()} — {df_events['timestamp_parsed'].max()}")

    # Длительность кейсов
    durations = df_events.groupby("case_id")["timestamp_parsed"].agg(["min", "max"])
    durations["days"] = (durations["max"] - durations["min"]).dt.total_seconds() / 86400
    print(f"   Средняя длительность:      {durations['days'].mean():.1f} дней")
    print(f"   Медианная длительность:    {durations['days'].median():.1f} дней")

    # Стоимость простоя
    df_cases["duration_days"] = df_cases["case_id"].map(durations["days"])
    df_cases["total_cost"] = df_cases["duration_days"] * df_cases["downtime_cost_per_day"]
    print(f"   Общая стоимость простоя:   {df_cases['total_cost'].sum():,.0f} руб")
    print(f"   Предупреждений:            {len(WARNINGS)}")

    print("\n✅ Валидация пройдена")


if __name__ == "__main__":
    main()