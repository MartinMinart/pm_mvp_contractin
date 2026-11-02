# Activity Dictionary: закупки и контрактация

Этот документ — справочник всех активностей процесса. Он нужен для того, чтобы однозначно понимать, какой шаг скрывается за каждым названием, какая роль и какая система в нем участвуют.

**Версия:** 1.0
**Источник истины** для `tools/generate_synthetic.py` и `tools/validate.py`.

---

## 1. Принципы

1. **Активность = шаг, который фиксируется в системе** (SAP SRM / SAP ERP). Не «действие человека», а «запись в логе».
2. **Каждая активность имеет:**
   - `phase` (sourcing / contracting / logistics / execution);
   - `resource` (роль, не ФИО);
   - `source_system`;
   - `mandatory` (обязательна для всех кейсов или опциональна);
   - `document_type` (если с активностью связан документ).
3. **Порядок активностей** — в `spec/spec.md`, раздел 10. Здесь — только описание каждой.

## 2. Полная таблица активностей (25)

| № | Activity | Phase | Resource | Source System | Mandatory | Document Type | Описание |
|---|---|---|---|---|---|---|---|
| 1 | `Requisition Created` | sourcing | Специалист по закупкам | SAP SRM | Да | Заявка | Заявка на закупку создана в системе |
| 2 | `Technical Review Started` | sourcing | Главный механик | SAP SRM | Да | ТЗ | Инженерная экспертиза начата (проверка совместимости ЗИП с оборудованием) |
| 3 | `Technical Review Completed` | sourcing | Главный механик | SAP SRM | Да | ТЗ | Инженерная экспертиза завершена, ТЗ согласовано |
| 4 | `RFQ Sent to Suppliers` | sourcing | Специалист по закупкам | SAP SRM | Да* | RFQ | Запрос коммерческих предложений отправлен |
| 5 | `Bids Received` | sourcing | Специалист по закупкам | SAP SRM | Да* | КП | Коммерческие предложения получены |
| 6 | `Evaluation Started` | sourcing | Специалист по закупкам | SAP SRM | Да* | Оценочный лист | Начата оценка КП (цена, сроки, наличие) |
| 7 | `Evaluation Completed` | sourcing | Специалист по закупкам | SAP SRM | Да* | Протокол выбора | Победитель выбран |
| 8 | `Draft Contract Created` | contracting | Специалист по договорам | SAP SRM | Да | Проект договора | Черновик договора создан |
| 9 | `Legal Review Started` | contracting | Юрист | SAP SRM | Да | Проект договора | Юридическая экспертиза начата |
| 10 | `Legal Review Completed` | contracting | Юрист | SAP SRM | Да | Проект договора | Юридическая экспертиза завершена |
| 11 | `HSE Review Started` | contracting | Специалист ОТиПБ | SAP SRM | Да | Чек-лист HSE | Проверка требований по охране труда и промбезопасности начата |
| 12 | `HSE Review Completed` | contracting | Специалист ОТиПБ | SAP SRM | Да | Чек-лист HSE | Проверка HSE завершена |
| 13 | `Negotiation Started` | contracting | Специалист по закупкам | SAP SRM | Нет (30%) | Протокол переговоров | Переговоры с поставщиком начаты |
| 14 | `Revised Draft Created` | contracting | Специалист по договорам | SAP SRM | Нет (30%) | Проект договора (v2) | Правки внесены по итогам переговоров |
| 15 | `Signature Requested` | contracting | Специалист по договорам | SAP SRM | Да | — | Запрошена подпись (ЭДО/бумага) |
| 16 | `Signed by Buyer` | contracting | Руководитель | SAP SRM / ЭДО | Да | Подпись | Подписано со стороны заказчика |
| 17 | `Signed by Supplier` | contracting | Поставщик | ЭДО | Да | Подпись | Подписано со стороны поставщика |
| 18 | `PO Issued` | execution | Специалист по закупкам | SAP ERP | Да | PO | Заказ на поставку выдан |
| 19 | `Goods Shipped` | logistics | Поставщик | SAP ERP | Да | ТТН | Отгрузка со склада поставщика |
| 20 | `Customs Clearance` | logistics | Логист | SAP ERP | Нет** | Декларация | Таможенное оформление (только импорт) |
| 21 | `Inbound to Central Warehouse` | logistics | Логист | SAP ERP | Да | Приходная накладная | Приход на центральный склад |
| 22 | `Dispatch to Mine Site` | logistics | Логист | SAP ERP | Да | ТТН | Отгрузка на карьер/рудник |
| 23 | `Goods Received at Site` | execution | Кладовщик | SAP ERP | Да | Акт приёмки | Получение на площадке |
| 24 | `Invoice Received` | execution | Бухгалтер | SAP ERP | Да | Счёт | Счёт получен |
| 25 | `Payment Made` | execution | Бухгалтер | SAP ERP | Да | Платёжное поручение | Оплата произведена |

\* `RFQ Sent to Suppliers` … `Evaluation Completed` — **не выполняются** для `procurement_type = "Единственный поставщик"`.
\** `Customs Clearance` — **только** для `is_import = 1`.

**Итого:** 25 активностей.

## 3. Маппинг «активность → роль»

| Роль | Активности |
|---|---|
| **Специалист по закупкам** | `Requisition Created`, `RFQ Sent to Suppliers`, `Bids Received`, `Evaluation Started`, `Evaluation Completed`, `Negotiation Started`, `PO Issued` |
| **Главный механик** | `Technical Review Started`, `Technical Review Completed` |
| **Специалист по договорам** | `Draft Contract Created`, `Revised Draft Created`, `Signature Requested` |
| **Юрист** | `Legal Review Started`, `Legal Review Completed` |
| **Специалист ОТиПБ** | `HSE Review Started`, `HSE Review Completed` |
| **Руководитель** | `Signed by Buyer` |
| **Поставщик** | `Signed by Supplier`, `Goods Shipped` |
| **Логист** | `Customs Clearance`, `Inbound to Central Warehouse`, `Dispatch to Mine Site` |
| **Кладовщик** | `Goods Received at Site` |
| **Бухгалтер** | `Invoice Received`, `Payment Made` |

## 4. Маппинг «активность → фаза»

| Фаза | Активности |
| --- | --- |
| **sourcing** | `Requisition Created`, `Technical Review Started`, `Technical Review Completed`, `RFQ Sent to Suppliers`, `Bids Received`, `Evaluation Started`, `Evaluation Completed` |
| **contracting** | `Draft Contract Created`, `Legal Review Started`, `Legal Review Completed`, `HSE Review Started`, `HSE Review Completed`, `Negotiation Started`, `Revised Draft Created`, `Signature Requested`, `Signed by Buyer`, `Signed by Supplier` |
| **logistics** | `Goods Shipped`, `Customs Clearance`, `Inbound to Central Warehouse`, `Dispatch to Mine Site` |
| **execution** | `PO Issued`, `Goods Received at Site`, `Invoice Received`, `Payment Made` |

## 5. Маппинг «активность → система-источник»

| Система | Активности |
| --- | --- |
| **SAP SRM** | Все sourcing + contracting (кроме подписания) |
| **SAP ERP** | `PO Issued` … `Payment Made` (execution + logistics) |
| **ЭДО** | `Signed by Buyer`, `Signed by Supplier` |

## 6. Вариативность (что может меняться)

| Условие | Что меняется |
| --- | --- |
| `procurement_type = "Единственный поставщик"` | Пропускаются `RFQ Sent to Suppliers`, `Bids Received`, `Evaluation Started`, `Evaluation Completed` |
| `is_import = 0` | Пропускается `Customs Clearance` |
| `random() < 0.30` | Добавляются `Negotiation Started`, `Revised Draft Created` (после `Legal Review Completed`) |
| `random() < 0.15` | Добавляется возврат: `Draft Contract Created` → `Legal Review Started` → `Legal Review Completed` (снова) |
| `is_rejected = 1` | Кейс не доходит до `Payment Made`, обрывается на любом этапе |

## 7. Правила изменения словаря

1. **Новая активность** добавляется сюда **первой**, потом в `generate_synthetic.py`.
2. **Удаление активности** — только после проверки, что она не используется в `spec.md` и `data_model.md`.
3. **Изменение роли/фазы** — обновить здесь и в `generate_synthetic.py` (ROLE_MAP).
4. **Изменение `mandatory`** — обновить `build_sequence()` в генераторе.

## 8. Что НЕ входит в словарь (MVP)

- Документы как отдельные активности (`ЕГРЮЛ_получен`, `ТЗ_согласовано`) — второй этап.
- Параллельные ветки (юрист ∥ HSE) — второй этап (сейчас последовательно).
- Пропуски активностей (кроме единственного поставщика и импорта) — второй этап.
- Отмены на конкретном этапе (`is_rejected` на уровне активности) — второй этап.

## 9. Адаптация под ЕвроХим (второй этап)

Для пилота в ЕвроХиме категории можно расширить:

- **Химические реагенты** (флотореагенты, кислоты, щёлочи) — специфика обогащения калия.
- **Удобрения** (готовая продукция для дистрибуции).
- **Логистика** (ж/д вагоны, порты) — ЕвроХим экспортирует через порты.
- **Энергоресурсы** (газ, электроэнергия) — «ЕвроХим-Энерго».

В MVP — 5 базовых категорий, но архитектура позволяет добавить.

**Регионы:** 4 региона (Кировск, Апатиты, Ковдор, Мурманск) — это Ковдорский ГОК и площадки ЕвроХима в Мурманской области. В проде — все площадки холдинга.
