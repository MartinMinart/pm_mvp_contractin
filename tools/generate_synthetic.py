# tools/generate_synthetic.py
"""
Генератор синтетического event log для Process Mining.
Домен: закупки/контрактация в горнодобывающем холдинге (ЕвроХим-подобный).
Выход:
  - data/processed/events.csv  (case_id, activity, timestamp, resource, ...)
  - data/processed/cases.csv   (case_id, атрибуты кейса)
"""

import os
import uuid
import random
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

# ---------- Настройки ----------
SEED = 42
N_CASES = 50_000
START_DATE = datetime(2024, 1, 1)
END_DATE = datetime(2024, 12, 31)
OUT_DIR = os.path.join("data", "processed")

np.random.seed(SEED)
random.seed(SEED)

# ---------- Справочники ----------
CATEGORIES = [
    "ЗИП (запчасти)",
    "Химические реагенты",
    "Спецтехника",
    "Подрядные работы",
    "Обслуживание оборудования",
]
PROCUREMENT_TYPES = ["Тендер", "Запрос котировок", "Единственный поставщик", "Рамочный договор"]
REGIONS = ["Кировск", "Апатиты", "Ковдор", "Мурманск"]
DEPARTMENTS = ["Горный департамент", "Главный механик", "Логистика", "Инженерный", "ОТиПБ"]
SUPPLIERS = [f"Поставщик_{i:03d}" for i in range(1, 101)]
CURRENCIES = ["RUB"]  # для простоты

# ---------- Роли (привязка к активностям) ----------
ROLE_MAP = {
    "Requisition Created": "Специалист по закупкам",
    "Technical Review Started": "Главный механик",
    "Technical Review Completed": "Главный механик",
    "RFQ Sent to Suppliers": "Специалист по закупкам",
    "Bids Received": "Специалист по закупкам",
    "Evaluation Started": "Специалист по закупкам",
    "Evaluation Completed": "Специалист по закупкам",
    "Draft Contract Created": "Специалист по договорам",
    "Legal Review Started": "Юрист",
    "Legal Review Completed": "Юрист",
    "HSE Review Started": "Специалист ОТиПБ",
    "HSE Review Completed": "Специалист ОТиПБ",
    "Negotiation Started": "Специалист по закупкам",
    "Revised Draft Created": "Специалист по договорам",
    "Signature Requested": "Специалист по договорам",
    "Signed by Buyer": "Руководитель",
    "Signed by Supplier": "Поставщик",
    "PO Issued": "Специалист по закупкам",
    "Goods Shipped": "Поставщик",
    "Customs Clearance": "Логист",
    "Inbound to Central Warehouse": "Логист",
    "Dispatch to Mine Site": "Логист",
    "Goods Received at Site": "Кладовщик",
    "Invoice Received": "Бухгалтер",
    "Payment Made": "Бухгалтер",
}

# ---------- Активности и фазы ----------
ACTIVITIES = [
    # (activity, phase, обязательна, тип задержки)
    ("Requisition Created", "sourcing", True, "fast"),
    ("Technical Review Started", "sourcing", True, "slow"),
    ("Technical Review Completed", "sourcing", True, "slow"),
    ("RFQ Sent to Suppliers", "sourcing", True, "fast"),
    ("Bids Received", "sourcing", True, "medium"),
    ("Evaluation Started", "sourcing", True, "medium"),
    ("Evaluation Completed", "sourcing", True, "medium"),
    ("Draft Contract Created", "contracting", True, "fast"),
    ("Legal Review Started", "contracting", True, "slow"),
    ("Legal Review Completed", "contracting", True, "slow"),
    ("HSE Review Started", "contracting", True, "medium"),
    ("HSE Review Completed", "contracting", True, "medium"),
    ("Negotiation Started", "contracting", False, "medium"),
    ("Revised Draft Created", "contracting", False, "fast"),
    ("Signature Requested", "contracting", True, "fast"),
    ("Signed by Buyer", "contracting", True, "fast"),
    ("Signed by Supplier", "contracting", True, "fast"),
    ("PO Issued", "execution", True, "fast"),
    ("Goods Shipped", "logistics", True, "medium"),
    ("Customs Clearance", "logistics", False, "very_slow"),
    ("Inbound to Central Warehouse", "logistics", True, "medium"),
    ("Dispatch to Mine Site", "logistics", True, "medium"),
    ("Goods Received at Site", "execution", True, "fast"),
    ("Invoice Received", "execution", True, "fast"),
    ("Payment Made", "execution", True, "medium"),
]

# ---------- Распределения задержек (часы) ----------
DELAY_PARAMS = {
    "fast":      (np.log(4),   1.0),   # медиана ~4 ч
    "medium":    (np.log(24),  1.0),   # медиана ~1 день
    "slow":      (np.log(72),  0.8),   # медиана ~3 дня
    "very_slow": (np.log(168), 1.2),   # медиана ~7 дней, тяжёлый хвост
}


def sample_delay(delay_type: str) -> int:
    mu, sigma = DELAY_PARAMS[delay_type]
    h = int(np.random.lognormal(mu, sigma))
    return max(1, min(h, 24 * 30))  # от 1 часа до 30 дней


def random_start_dt():
    delta = (END_DATE - START_DATE).days
    d = random.randint(0, delta)
    base = START_DATE + timedelta(days=d, hours=random.randint(8, 17))
    return base


def build_sequence(case_attrs):
    """Собирает последовательность активностей с учётом вариативности."""
    seq = [a for a in ACTIVITIES if a[2]]  # обязательные

    # Вариативность: переговоры (30%)
    if random.random() < 0.30:
        idx = [i for i, x in enumerate(seq) if x[0] == "Legal Review Completed"][0]
        seq.insert(idx + 1, ("Negotiation Started", "contracting", False, "medium"))
        seq.insert(idx + 2, ("Revised Draft Created", "contracting", False, "fast"))

    # Вариативность: возврат на доработку (15%)
    if random.random() < 0.15:
        idx = [i for i, x in enumerate(seq) if x[0] == "Legal Review Completed"][0]
        seq.insert(idx + 1, ("Draft Contract Created", "contracting", True, "fast"))
        seq.insert(idx + 2, ("Legal Review Started", "contracting", True, "slow"))
        seq.insert(idx + 3, ("Legal Review Completed", "contracting", True, "slow"))

    # Вариативность: таможня ТОЛЬКО для импорта (явно добавляем)
    if case_attrs["is_import"]:
        idx = [i for i, x in enumerate(seq) if x[0] == "Goods Shipped"][0]
        seq.insert(idx + 1, ("Customs Clearance", "logistics", False, "very_slow"))

    # Вариативность: единственный поставщик — без RFQ/Bids/Evaluation
    if case_attrs["procurement_type"] == "Единственный поставщик":
        skip = {"RFQ Sent to Suppliers", "Bids Received",
                "Evaluation Started", "Evaluation Completed"}
        seq = [a for a in seq if a[0] not in skip]

    # Отменённый кейс: обрываем на случайном этапе (не доходим до Payment Made)
    if case_attrs["is_rejected"]:
        # Обрываем на этапе от 30% до 70% длины
        cut = random.randint(int(len(seq) * 0.3), int(len(seq) * 0.7))
        seq = seq[:cut]

    return seq


def generate_case(case_idx: int):
    case_id = f"CASE-{case_idx:06d}"
    category = random.choice(CATEGORIES)
    procurement_type = random.choice(PROCUREMENT_TYPES)
    region = random.choice(REGIONS)
    department = random.choice(DEPARTMENTS)
    supplier = random.choice(SUPPLIERS)
    currency = random.choice(CURRENCIES)

    amount = round(random.uniform(50_000, 5_000_000), 2)
    downtime_cost = random.randint(100_000, 500_000)
    is_import = random.random() < 0.4
    is_rejected = random.random() < 0.05

    case_attrs = {
        "case_id": case_id,
        "category": category,
        "procurement_type": procurement_type,
        "region": region,
        "department": department,
        "supplier": supplier,
        "currency": currency,
        "amount": amount,
        "downtime_cost_per_day": downtime_cost,
        "is_import": int(is_import),
        "is_rejected": int(is_rejected),
    }

    seq = build_sequence(case_attrs)
    t = random_start_dt()
    events = []

    for activity, phase, mandatory, delay_type in seq:
        resource = ROLE_MAP.get(activity, "Система")
        events.append({
            "case_id": case_id,
            "activity": activity,
            "timestamp": t.isoformat(timespec="seconds"),
            "resource": resource,
            "phase": phase,
            "source_system": "SAP SRM" if phase in ("sourcing", "contracting") else "SAP ERP",
            "document_type": "",
            "document_status": "",
        })
        t = t + timedelta(hours=sample_delay(delay_type))

    return case_attrs, events


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    all_events = []
    all_cases = []

    for i in range(1, N_CASES + 1):
        attrs, evs = generate_case(i)
        # добавляем атрибуты кейса в каждое событие (денормализация для PM)
        for e in evs:
            e.update({
                "category": attrs["category"],
                "procurement_type": attrs["procurement_type"],
                "region": attrs["region"],
                "department": attrs["department"],
                "supplier": attrs["supplier"],
                "amount": attrs["amount"],
                "is_import": attrs["is_import"],
                "is_rejected": attrs["is_rejected"],
                "downtime_cost_per_day": attrs["downtime_cost_per_day"],
            })
        all_events.extend(evs)
        all_cases.append(attrs)

        if i % 5000 == 0:
            print(f"  сгенерировано кейсов: {i:,}")

    df_events = pd.DataFrame(all_events)
    df_cases = pd.DataFrame(all_cases)

    events_path = os.path.join(OUT_DIR, "events.csv")
    cases_path = os.path.join(OUT_DIR, "cases.csv")

    df_events.to_csv(events_path, index=False, encoding="utf-8")
    df_cases.to_csv(cases_path, index=False, encoding="utf-8")

    print(f"\n✅ events.csv: {len(df_events):,} строк -> {events_path}")
    print(f"✅ cases.csv:  {len(df_cases):,} строк -> {cases_path}")
    print(f"   Уникальных кейсов: {df_events['case_id'].nunique():,}")
    print(f"   Уникальных активностей: {df_events['activity'].nunique()}")


if __name__ == "__main__":
    main()