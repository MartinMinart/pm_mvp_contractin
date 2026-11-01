/* global Plotly */
'use strict';

/**
 * Сайт Process Mining MVP.
 * Читает 4 агрегата из site/data, рисует 4 вкладки, без сборки и зависимостей
 * кроме Plotly.js (CDN).
 */
(function () {
  const DATA_URLS = {
    overview: 'data/overview.json',
    processMap: 'data/process_map.json',
    bottlenecks: 'data/bottlenecks.json',
    variants: 'data/variants.json',
    variantPaths: 'data/variant_paths.json',
  };

  const MONTH_NAMES = {
    '01': 'янв', '02': 'фев', '03': 'мар', '04': 'апр', '05': 'май', '06': 'июн',
    '07': 'июл', '08': 'авг', '09': 'сен', '10': 'окт', '11': 'ноя', '12': 'дек',
  };

  const KPI_FORMULAS = {
    total_cases: 'count(distinct case_id)',
    total_suppliers: 'count(distinct supplier)',
    total_activities: 'count(distinct activity)',
    avg_duration_days: 'mean(max(ts) − min(ts))',
    median_duration_days: 'quantile(0.5, duration_days)',
    p90_duration_days: 'quantile(0.9, duration_days)',
    rejected_share: 'count(is_rejected) / count(*)',
    returns_share: 'cases с возвратом / все кейсы',
    import_share: 'count(is_import) / count(*)',
  };

  const METRIC_HINTS = {
    total_cases: 'Одна закупка от заявки до оплаты',
    total_suppliers: 'Обезличенные supplier_XXX',
    total_activities: 'Справочник активностей процесса',
    avg_duration_days: 'От «Requisition Created» до «Payment Made»',
    median_duration_days: 'Устойчива к выбросам',
    p90_duration_days: '90% кейсов укладываются в этот срок',
    rejected_share: 'Не дошли до оплаты',
    returns_share: 'Возврат договора после Legal Review',
    import_share: 'Проходят таможенное оформление',
  };

  const FILTER_LABELS = {
    category: 'Категория',
    region: 'Регион',
    type: 'Тип закупки',
    month: 'Месяц',
  };

  const ACTIVITY_LABELS_RU = {
    'Requisition Created': 'Заявка создана',
    'Technical Review Started': 'Техническая экспертиза начата',
    'Technical Review Completed': 'Техническая экспертиза завершена',
    'RFQ Sent to Suppliers': 'Запрос КП отправлен',
    'Bids Received': 'Коммерческие предложения получены',
    'Evaluation Started': 'Оценка КП начата',
    'Evaluation Completed': 'Победитель выбран',
    'Draft Contract Created': 'Проект договора создан',
    'Legal Review Started': 'Юридическая проверка начата',
    'Legal Review Completed': 'Юридическая проверка завершена',
    'HSE Review Started': 'Проверка ОТиПБ начата',
    'HSE Review Completed': 'Проверка ОТиПБ завершена',
    'Negotiation Started': 'Переговоры начаты',
    'Revised Draft Created': 'Проект договора доработан',
    'Signature Requested': 'Запрошена подпись',
    'Signed by Buyer': 'Подписано заказчиком',
    'Signed by Supplier': 'Подписано поставщиком',
    'PO Issued': 'Заказ на поставку выдан',
    'Goods Shipped': 'Отгружено поставщиком',
    'Customs Clearance': 'Таможенное оформление',
    'Inbound to Central Warehouse': 'Поступило на ЦС',
    'Dispatch to Mine Site': 'Отправлено на рудник',
    'Goods Received at Site': 'Получено на площадке',
    'Invoice Received': 'Счёт получен',
    'Payment Made': 'Оплата произведена',
  };

  const NODE_LABELS = Object.assign({}, ACTIVITY_LABELS_RU);

  // Подписи на графе — в две строки для компактности
  const NODE_GRAPH_LABELS = {
    'Requisition Created': 'Заявка<br>создана',
    'Technical Review Started': 'Техэкспертиза<br>начата',
    'Technical Review Completed': 'Техэкспертиза<br>завершена',
    'RFQ Sent to Suppliers': 'Запрос КП<br>отправлен',
    'Bids Received': 'КП<br>получены',
    'Evaluation Started': 'Оценка КП<br>начата',
    'Evaluation Completed': 'Победитель<br>выбран',
    'Draft Contract Created': 'Проект<br>договора',
    'Legal Review Started': 'Юр. проверка<br>начата',
    'Legal Review Completed': 'Юр. проверка<br>завершена',
    'HSE Review Started': 'ОТиПБ<br>начата',
    'HSE Review Completed': 'ОТиПБ<br>завершена',
    'Negotiation Started': 'Переговоры<br>начаты',
    'Signature Requested': 'Подпись<br>запрошена',
    'Signed by Buyer': 'Подп. заказч.',
    'Signed by Supplier': 'Подп. пост.',
    'PO Issued': 'Заказ<br>выдан',
    'Revised Draft Created': 'Договор<br>доработан',
    'Customs Clearance': 'Таможенное<br>оформление',
    'Goods Shipped': 'Отгружено<br>поставщиком',
    'Inbound to Central Warehouse': 'Поступило<br>на ЦС',
    'Dispatch to Mine Site': 'Отправлено<br>на рудник',
    'Goods Received at Site': 'Получено<br>на площадке',
    'Invoice Received': 'Счёт<br>получен',
    'Payment Made': 'Оплата<br>произведена',
  };

  const state = {
    tab: 'overview',
    mode: readStorage('pm-mode', 'executive'),
    theme: readStorage('pm-theme', 'light'),
    filters: { category: '', region: '', type: '', month: '' },
    processCategory: '',
    edgeLimit: 'all',
    edgeStatsMetric: 'median_duration_days',
    edgeStatsPage: 0,
    bottleneckSort: 'normalized',
    bottleneckRows: 10,
    mapMode: 'dfg',
    mapVariantRank: 1,
    mapRangeFrom: 1,
    mapRangeTo: 15,
    mapStepFrom: 1,
    mapStepTo: 22,
    dfgLayout: 'breadthfirst',
    dfgLabels: true,
  };

  const data = {};
  const debouncedRenderOverview = debounce(renderOverview, 200);
  const handlersBound = { monthly: false, process: false, processSingle: false, processSingleClick: false, processRangeClick: false };

  /* ============ УТИЛИТЫ ============ */

  function readStorage(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      /* приватный режим — просто не сохраняем */
    }
  }

  const intFmt = new Intl.NumberFormat('ru-RU');
  const oneFmt = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const twoFmt = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtInt = (value) => intFmt.format(Math.round(Number(value) || 0));
  const fmtDays = (value) => oneFmt.format(Number(value) || 0);
  const fmtPct = (value) => twoFmt.format(Number(value) || 0);

  function fmtMoney(value) {
    const v = Number(value) || 0;
    if (Math.abs(v) >= 1e9) return oneFmt.format(v / 1e9) + ' млрд ₽';
    if (Math.abs(v) >= 1e6) return oneFmt.format(v / 1e6) + ' млн ₽';
    return fmtInt(v) + ' ₽';
  }

  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function fmtMonth(month) {
    const [year, mm] = String(month).split('-');
    return (MONTH_NAMES[mm] || mm) + ' ' + year;
  }

  // Русская плюрализация: 1 активность / 2 активности / 5 активностей
  function plural(n, forms) {
    const abs = Math.abs(Number(n) || 0) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function themeColors() {
    const css = getComputedStyle(document.documentElement);
    const get = (name) => css.getPropertyValue(name).trim();
    return {
      text: get('--text-secondary'),
      muted: get('--text-muted'),
      secondary: get('--text-secondary'),
      grid: get('--border-color'),
      accent: get('--accent-color'),
      accentSoft: get('--accent-soft'),
      danger: get('--danger'),
      success: get('--success'),
      warning: get('--warning'),
      surface: get('--bg-surface'),
      soft: get('--bg-surface-soft'),
      primary: get('--text-primary'),
      palette: [1, 2, 3, 4, 5, 6, 7].map((n) => get('--chart-' + n)),
    };
  }

  function baseLayout(extra) {
    const c = themeColors();
    return Object.assign({
      margin: { l: 52, r: 24, t: 12, b: 40 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Segoe UI, Roboto, Arial, sans-serif', size: 12, color: c.text },
      hoverlabel: { bgcolor: c.surface, bordercolor: c.grid, font: { color: c.primary, size: 12 } },
      showlegend: false,
      xaxis: { gridcolor: c.grid, zeroline: false, tickfont: { color: c.muted, size: 11 } },
      yaxis: { gridcolor: c.grid, zeroline: false, tickfont: { color: c.muted, size: 11 } },
    }, extra || {});
  }

  function plotlyAvailable(node) {
    if (typeof Plotly === 'undefined') {
      node.innerHTML = '<p class="plot-fallback">График недоступен: Plotly не загрузился (CDN). Таблицы ниже работают.</p>';
      return false;
    }
    return true;
  }

  function plot(node, traces, layout, config) {
    if (!plotlyAvailable(node)) return;
    Plotly.react(node, traces, layout, Object.assign({ displayModeBar: false, responsive: true }, config || {}));
  }

  /* ============ ТЕМА И РЕЖИМ ============ */

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const icon = el('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
    const toggle = el('theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
      toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
    writeStorage('pm-theme', theme);
    renderActiveTab();
  }

  function applyMode(mode) {
    state.mode = mode;
    document.documentElement.setAttribute('data-mode', mode);
    document.querySelectorAll('.segmented-btn[data-mode]').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    writeStorage('pm-mode', mode);
    renderActiveTab();
  }

  /* ============ ВКЛАДКИ ============ */

  function activateTab(tab) {
    closePanel();
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      const active = panel.id === 'tab-' + tab;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    renderTab(tab);
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }

  function renderActiveTab() {
    if (!data.overview) return;
    renderTab(state.tab);
  }

  function renderTab(tab) {
    if (tab === 'overview') renderOverview();
    if (tab === 'process') renderProcessMap();
    if (tab === 'bottlenecks') renderBottlenecks();
    if (tab === 'variants') renderVariants();
  }

  /* ============ ЗАГРУЗКА ============ */

  async function loadData() {
    const entries = await Promise.all(Object.entries(DATA_URLS).map(async ([key, url]) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(url + ' · HTTP ' + response.status);
      return [key, await response.json()];
    }));
    entries.forEach(([key, payload]) => {
      data[key] = payload;
    });
    const overlay = el('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function showLoadError(error) {
    const banner = el('status-banner');
    const overlay = el('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
    const isFile = window.location.protocol === 'file:';
    banner.hidden = false;
    banner.innerHTML = '<strong>Не удалось загрузить данные.</strong> ' +
      escapeHtml(String(error && error.message ? error.message : error)) + '<br>' +
      (isFile
        ? 'Страница открыта через <code>file://</code> — браузер блокирует fetch. Запустите <code>python -m http.server 8000</code> в корне проекта и откройте <code>http://localhost:8000/site/</code>.'
        : 'Проверьте, что JSON лежат в <code>site/data/</code>. Пересобрать: <code>python tools/csv_to_json.py</code>.');
  }

  /* ============ OVERVIEW ============ */

  function metricValue(metric) {
    if (!metric) return '—';
    if (metric.format === 'int') return fmtInt(metric.value);
    if (metric.format === 'percent') return fmtPct(metric.value);
    return fmtDays(metric.value);
  }

  // Тренд «последний месяц к предыдущему»: отдельного ряда трендов в JSON нет,
  // но месячный ряд содержит все три опорные метрики.
  function monthTrend(field) {
    const rows = data.overview.monthly.slice().sort((a, b) => a.month.localeCompare(b.month));
    if (rows.length < 2) return null;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last[field] == null || prev[field] == null || !Number(prev[field])) return null;
    return ((last[field] - prev[field]) / prev[field]) * 100;
  }

  function trendHtml(pct, invert) {
    if (pct == null || !isFinite(pct)) return '';
    const dir = Math.abs(pct) < 0.05 ? 'flat' : (pct > 0 ? 'up' : 'down');
    const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
    let cls = 'flat';
    if (dir !== 'flat') cls = (invert ? pct < 0 : pct > 0) ? 'good' : 'bad';
    return '<span class="kpi-trend kpi-trend--' + cls + '" title="Последний месяц к предыдущему">' +
      arrow + ' ' + fmtPct(Math.abs(pct)) + '% · мес.</span>';
  }

  function sparkline(field) {
    const rows = data.overview.monthly.slice().sort((a, b) => a.month.localeCompare(b.month));
    const values = rows.map((row) => Number(row[field]) || 0);
    if (values.length < 2) return '';
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = max - min || 1;
    return '<div class="kpi-spark" aria-hidden="true">' + values.map((value, index) => {
      const height = 22 + ((value - min) / span) * 78;
      return '<span' + (index === values.length - 1 ? ' class="is-last"' : '') +
        ' style="height:' + height.toFixed(1) + '%"></span>';
    }).join('') + '</div>';
  }

  function renderKpiGroups() {
    const slice = computeSlice();
    const groups = [
      { key: 'volume', title: 'Объём', trendField: 'cases', invert: false, primaryKey: 'total_cases' },
      { key: 'time', title: 'Сроки', trendField: 'avg_duration_days', invert: true, primaryKey: 'avg_duration_days' },
      { key: 'quality', title: 'Качество', trendField: 'rejected_share', invert: true, primaryKey: 'rejected_share' },
    ];

    const cards = groups.map((group) => {
      if (slice.kind === 'global') {
        const metrics = data.overview.kpi_groups[group.key] || [];
        const primary = metrics.find((metric) => metric.key === group.primaryKey) || metrics[0];
        if (!primary) return '';
        const secondary = metrics.filter((metric) => metric !== primary).map((metric) => (
          '<div><span>' + escapeHtml(metric.label) + '</span><b>' + metricValue(metric) +
          (metric.unit ? ' ' + escapeHtml(metric.unit) : '') + '</b></div>'
        )).join('');
        return '<div class="kpi-card" title="' + escapeHtml(primary.hint || '') + '">' +
          '<h3>' + group.title + '</h3>' +
          '<div class="kpi-primary"><span class="kpi-value">' + metricValue(primary) + '</span>' +
          (primary.unit ? '<span class="unit">' + escapeHtml(primary.unit) + '</span>' : '') + '</div>' +
          '<div class="kpi-primary-label">' + escapeHtml(primary.label) + '</div>' +
          trendHtml(monthTrend(group.trendField), group.invert) +
          sparkline(group.trendField) +
          '<div class="kpi-secondary">' + secondary + '</div></div>';
      }

      // Срез: показываем только то, что есть в предагрегированном срезе.
      const row = slice.kpiRow || {};
      const defs = {
        volume: {
          value: row.total_cases != null ? fmtInt(row.total_cases) : '—', unit: '', label: 'Кейсов в срезе',
          secondary: [['Потери от простоя', row.total_cost != null ? fmtMoney(row.total_cost) : '—']],
        },
        time: {
          value: row.avg_duration_days != null ? fmtDays(row.avg_duration_days) : '—', unit: 'дн',
          label: 'Средняя длительность', secondary: [],
        },
        quality: {
          value: row.rejected_share != null ? fmtPct(row.rejected_share) : '—', unit: '%',
          label: 'Отменённые кейсы', secondary: [['Доля возвратов', '—']],
        },
      };
      const def = defs[group.key];
      return '<div class="kpi-card">' +
        '<h3>' + group.title + '</h3>' +
        '<div class="kpi-primary"><span class="kpi-value">' + def.value + '</span>' +
        (def.unit ? '<span class="unit">' + escapeHtml(def.unit) + '</span>' : '') + '</div>' +
        '<div class="kpi-primary-label">' + escapeHtml(def.label) + '</div>' +
        '<div class="kpi-secondary">' + def.secondary.map(([label, value]) => (
          '<div><span>' + escapeHtml(label) + '</span><b>' + value + '</b></div>'
        )).join('') + '</div></div>';
    }).join('');

    el('kpi-grid').innerHTML = cards;
  }

  function monthlySeries() {
    const dimensions = activeFilters().filter(([key]) => DIM_KEYS.includes(key));
    if (dimensions.length > 1) return [];

    let rows;
    if (dimensions.length) {
      const [key, value] = dimensions[0];
      const source = key === 'category' ? data.overview.monthly_by_category
        : key === 'region' ? data.overview.monthly_by_region : data.overview.monthly_by_type;
      const field = key === 'type' ? 'procurement_type' : key;
      rows = source.filter((row) => row[field] === value);
    } else {
      rows = data.overview.monthly;
    }
    return rows
      .filter((row) => !state.filters.month || row.month === state.filters.month)
      .map((row) => ({
        month: row.month,
        cases: row.cases,
        avg_duration_days: row.avg_duration_days,
        total_cost: row.total_cost,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  function renderMonthlyChart() {
    const node = el('monthly-chart');
    if (!plotlyAvailable(node)) return;
    const rows = monthlySeries();
    const c = themeColors();
    if (!rows.length) {
      plot(node, [], baseLayout({
        annotations: [{
          text: 'Нет предагрегированных данных для выбранного среза',
          showarrow: false, x: 0.5, y: 0.5, xref: 'paper', yref: 'paper',
          font: { size: 12, color: c.muted },
        }],
      }));
      return;
    }

    // Только месяц: год одинаковый (2024), а длинные подписи браузер поворачивает и они наезжают.
    const labels = rows.map((row) => MONTH_NAMES[String(row.month).split('-')[1]] || row.month);
    const selected = state.filters.month;

    const values = rows.map((row) => row.avg_duration_days);
    const hasLosses = rows.every((row) => Number.isFinite(Number(row.total_cost)));
    const losses = hasLosses ? rows.map((row) => row.total_cost / 1e9) : [];
    const minValue = Math.min.apply(null, values);
    const maxValue = Math.max.apply(null, values);
    const pad = Math.max(0.2, (maxValue - minValue) * 0.6);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    const traces = [{
      type: 'scatter',
      mode: 'lines+markers',
      x: labels,
      y: values,
      line: { color: c.accent, width: 2.5, shape: 'spline' },
      fill: 'tozeroy',
      fillcolor: 'rgba(74,144,217,0.06)',
      marker: {
        size: rows.map((row) => (row.month === selected ? 11 : 7)),
        color: rows.map((row) => (row.month === selected ? c.danger : c.accent)),
        line: { color: c.surface, width: 2 },
      },
      customdata: rows.map((row) => [fmtMonth(row.month), row.cases, row.month]),
      hovertemplate: '<b>%{customdata[0]}</b><br>Средняя длительность: %{y:.2f} дн' +
        '<br>Кейсов: %{customdata[1]:,.0f}<extra></extra>',
    }];
    if (hasLosses) traces.push({
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Потери от простоя',
      x: labels,
      y: losses,
      yaxis: 'y2',
      line: { color: c.danger, width: 2, shape: 'spline', dash: 'dot' },
      marker: { size: 5, color: c.danger },
      hovertemplate: '<b>%{x}</b><br>Потери: %{y:.2f} млрд ₽<extra></extra>',
    });

    const layout = baseLayout({
      margin: { l: 48, r: 24, t: 8, b: 36 },
      hovermode: 'closest',
      xaxis: { gridcolor: 'rgba(0,0,0,0)', zeroline: false, tickangle: -45, tickfont: { color: c.muted, size: 11 } },
      yaxis: {
        title: { text: 'дней', font: { size: 11, color: c.muted } },
        gridcolor: c.grid, zeroline: false,
        range: [Math.max(0, minValue - pad), maxValue + pad],
        tickformat: '.1f',
      },
      yaxis2: hasLosses ? {
        overlaying: 'y', side: 'right', showgrid: false, zeroline: false,
        title: { text: 'потери, млрд ₽', font: { size: 10, color: c.danger } },
        tickfont: { size: 9, color: c.danger },
      } : { visible: false },
      shapes: [{
        // Коридор ±5% вокруг среднего: выход месячной точки за полосу — признак сезонности.
        // Зелёная заливка и пунктирные границы, чтобы не сливался с областью под линией.
        type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1,
        y0: mean * 0.95, y1: mean * 1.05,
        fillcolor: 'rgba(40,167,69,0.08)',
        line: { width: 0 }, layer: 'below',
      },
      {
        type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1,
        y0: mean * 0.95, y1: mean * 0.95,
        line: { color: c.success, width: 1, dash: 'dot' }, layer: 'below',
      },
      {
        type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1,
        y0: mean * 1.05, y1: mean * 1.05,
        line: { color: c.success, width: 1, dash: 'dot' }, layer: 'below',
      }].concat(selected ? [{
        type: 'line', xref: 'x', yref: 'paper', x0: labels[rows.findIndex((row) => row.month === selected)],
        x1: labels[rows.findIndex((row) => row.month === selected)],
        y0: 0, y1: 1, line: { color: c.danger, width: 1.5, dash: 'dot' },
      }] : []),
    });

    plot(node, traces, layout);

    if (!handlersBound.monthly) {
      handlersBound.monthly = true;
      node.on('plotly_click', (event) => {
        const point = event.points && event.points[0];
        const month = point && point.customdata && point.customdata[2];
        if (!month) return;
        state.filters.month = state.filters.month === month ? '' : month;
        el('filter-month').value = state.filters.month;
        renderOverview();
      });
    }
  }

  function renderCategoryTable() {
    const table = el('category-table');
    const rows = sliceRowsFor('category');
    if (rows == null) {
      table.innerHTML = '<tbody><tr><td colspan="4" class="slice-missing">' +
        'Для этой комбинации фильтров нет предагрегированного среза по категориям.</td></tr></tbody>';
      return;
    }
    const sorted = rows.slice().sort((a, b) => b.total_cases - a.total_cases).slice(0, 5);
    const body = sorted.map((row) => {
      const selected = state.filters.category === row.label ? ' is-highlight' : '';
      return '<tr class="clickable' + selected + '" tabindex="0" data-category="' + escapeHtml(row.label) + '">' +
        '<td>' + escapeHtml(row.label) + '</td>' +
        '<td class="num">' + fmtInt(row.total_cases) + '</td>' +
        '<td class="num">' + fmtDays(row.avg_duration_days) + '</td>' +
        '<td class="num">' + (row.total_cost != null ? fmtMoney(row.total_cost) : '—') + '</td>' +
        '</tr>';
    }).join('');

    table.innerHTML =
      '<thead><tr><th>Категория</th><th class="num">Кейсов</th>' +
      '<th class="num">Ср. длит., дн</th><th class="num">Потери, ₽</th></tr></thead>' +
      '<tbody>' + body + '</tbody>';

    table.querySelectorAll('tr[data-category]').forEach((tr) => {
      const pick = () => {
        state.filters.category = state.filters.category === tr.dataset.category ? '' : tr.dataset.category;
        el('filter-category').value = state.filters.category;
        renderOverview();
      };
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); }
      });
    });

    initTableSorting('category-table');
  }

  function renderFilterChips() {
    const node = el('filter-chips');
    if (!node) return;
    const active = activeFilters();
    const resetBtn = el('filters-reset');
    if (resetBtn) resetBtn.hidden = active.length === 0;
    if (!active.length) {
      node.innerHTML = '<span class="graph-caption">Все данные · фильтры не применены</span>';
      return;
    }
    node.innerHTML = active.map(([key, value]) => {
      const shown = key === 'month' ? fmtMonth(value) : value;
      return '<span class="filter-chip">' + escapeHtml(FILTER_LABELS[key] || key) + ': ' +
        escapeHtml(shown) +
        '<button type="button" class="chip-remove" data-remove="' + key +
        '" aria-label="Убрать фильтр ' + escapeHtml(FILTER_LABELS[key] || key) + '">×</button></span>';
    }).join('');

    node.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.remove;
        state.filters[key] = '';
        const select = el('filter-' + key);
        if (select) select.value = '';
        renderOverview();
      });
    });
  }

  // Потери по категориям: берём маргинальный срез, а при фильтре региона/типа —
  // парный, чтобы диаграмма реагировала на фильтры. Тройного среза в JSON нет.
  function categoryLossRows() {
    const f = state.filters;
    if (f.month || (f.region && f.type)) return null;
    const pick = (row) => ({ category: row.category, total_cost: row.total_cost, total_cases: row.total_cases });
    const rows = f.region
      ? data.overview.by_category_region.filter((row) => row.region === f.region)
      : f.type
        ? data.overview.by_category_type.filter((row) => row.procurement_type === f.type)
        : data.overview.by_category;
    return rows.filter((row) => !f.category || row.category === f.category).map(pick);
  }

  function renderOverviewDonut() {
    const node = el('overview-donut');
    if (!node || !plotlyAvailable(node)) return;
    const c = themeColors();
    const rows = categoryLossRows();
    if (!rows) {
      plot(node, [], baseLayout({
        annotations: [{
          text: 'Нет предагрегированных потерь для выбранного среза',
          showarrow: false, x: 0.5, y: 0.5, xref: 'paper', yref: 'paper',
          font: { size: 11, color: c.muted },
        }],
      }));
      return;
    }
    const all = rows.filter((row) => Number(row.total_cost) > 0)
      .sort((a, b) => b.total_cost - a.total_cost);
    if (!all.length) { plot(node, [], baseLayout({ showlegend: false })); return; }

    const top = all.slice(0, 5);
    const rest = all.slice(5);
    const labels = top.map((row) => row.category);
    const values = top.map((row) => row.total_cost);
    if (rest.length) {
      labels.push('Прочие');
      values.push(rest.reduce((sum, row) => sum + row.total_cost, 0));
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    const selected = state.filters.category;
    const colors = labels.map((label, index) => (
      label === 'Прочие' ? c.palette[6] : c.palette[index % 6]
    ));
    const text = values.map((value) => {
      const share = total ? (value / total) * 100 : 0;
      return share >= 5 ? fmtPct(share) + '%' : '';
    });

    plot(node, [{
      type: 'pie',
      hole: 0.68,
      sort: false,
      direction: 'clockwise',
      labels: labels,
      values: values,
      text: text,
      textinfo: 'text',
      textposition: 'inside',
      insidetextorientation: 'radial',
      textfont: { size: 9.5, color: '#ffffff' },
      marker: {
        colors: colors,
        line: {
          color: labels.map((label) => (label === selected ? c.primary : c.surface)),
          width: labels.map((label) => (label === selected ? 2.5 : 1)),
        },
      },
      domain: { x: [0, 0.56], y: [0, 1] },
      customdata: labels.map((label, index) => [
        label,
        total ? (values[index] / total) * 100 : 0,
        values[index],
      ]),
      hovertemplate: '<b>%{customdata[0]}</b><br>Потери: %{customdata[2]:,.0f} ₽' +
        '<br>Доля: %{customdata[1]:.1f}%<extra></extra>',
    }], baseLayout({
      showlegend: true,
      margin: { l: 0, r: 0, t: 2, b: 2 },
      legend: {
        orientation: 'v', x: 0.6, y: 0.5, xanchor: 'left', yanchor: 'middle',
        font: { size: 9, color: c.muted }, traceorder: 'normal',
      },
      annotations: [{
        text: '<b>' + fmtMoney(total) + '</b><br><span style="font-size:9px">потери от простоя</span>',
        showarrow: false, x: 0.28, y: 0.5, xref: 'paper', yref: 'paper',
        xanchor: 'center', yanchor: 'middle',
        font: { size: 10, color: c.primary }, align: 'center',
      }],
    }));
  }

  // Stacked bar: типы закупки по оси Y, категории — стек.
  // Источник by_category_type: в by_procurement_type нет разбивки на стек.
  function renderOverviewStacked() {
    const node = el('overview-stacked');
    if (!node || !plotlyAvailable(node)) return;
    const c = themeColors();
    if (state.filters.month || state.filters.region) {
      plot(node, [], baseLayout({
        annotations: [{
          text: 'Нет предагрегированного распределения для выбранного среза',
          showarrow: false, x: 0.5, y: 0.5, xref: 'paper', yref: 'paper',
          font: { size: 11, color: c.muted },
        }],
      }));
      return;
    }
    const categories = data.overview.by_category
      .slice().sort((a, b) => b.total_cases - a.total_cases).map((row) => row.category);
    const types = data.overview.by_procurement_type
      .slice().sort((a, b) => b.total_cases - a.total_cases).map((row) => row.procurement_type);
    const f = state.filters;
    const activeCategories = f.category ? categories.filter((name) => name === f.category) : categories;
    const activeTypes = f.type ? types.filter((name) => name === f.type) : types;

    const lookup = new Map();
    data.overview.by_category_type.forEach((row) => {
      lookup.set(row.category + '\u0001' + row.procurement_type, row.total_cases);
    });

    const traces = activeCategories.map((category) => {
      const color = c.palette[Math.max(0, categories.indexOf(category)) % 6];
      return {
        type: 'bar',
        orientation: 'h',
        name: category,
        y: activeTypes,
        x: activeTypes.map((type) => lookup.get(category + '\u0001' + type) || 0),
        marker: { color: color, line: { color: c.surface, width: 0.5 } },
        hovertemplate: '<b>' + escapeHtml(category) + '</b><br>%{y}<br>Кейсов: %{x:,.0f}<extra></extra>',
      };
    }).filter((trace) => trace.x.some((value) => value > 0));

    if (!traces.length) { plot(node, [], baseLayout({ showlegend: false })); return; }

    plot(node, traces, baseLayout({
      barmode: 'stack',
      bargap: 0.32,
      showlegend: true,
      margin: { l: 118, r: 10, t: 2, b: 26 },
      legend: {
        orientation: 'h', x: 0, y: -0.03, xanchor: 'left', yanchor: 'top',
        font: { size: 8.5, color: c.muted }, itemwidth: 1,
      },
      xaxis: {
        gridcolor: c.grid, zeroline: false, tickformat: ',.0f',
        tickfont: { size: 9.5, color: c.muted },
        title: { text: 'кейсов', font: { size: 9, color: c.muted } },
      },
      yaxis: {
        gridcolor: 'rgba(0,0,0,0)', zeroline: false,
        tickfont: { size: 9.5, color: c.text }, automargin: false,
      },
    }));
  }

  function renderEmptyOverview() {
    const node = el('monthly-chart');
    if (plotlyAvailable(node)) plot(node, [], baseLayout({}));
    el('kpi-grid').innerHTML =
      '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⛳</div>' +
      '<b>Для этого среза нет данных</b>' +
      '<p>Комбинация из трёх и более фильтров не предагрегирована. Сбросьте один фильтр — виджеты пересчитаются.</p></div>';
    el('category-table').innerHTML = '<tbody><tr><td class="slice-missing">Срез не предагрегирован.</td></tr></tbody>';
    ['overview-donut', 'overview-stacked'].forEach((id) => {
      const chart = el(id);
      if (chart && plotlyAvailable(chart)) plot(chart, [], baseLayout({ showlegend: false }));
    });
  }

  function renderMiniKpi() {
    const node = el('mini-kpi');
    if (!node || !data.overview) return;
    node.hidden = activeFilters().length > 0;
    if (node.hidden) {
      node.innerHTML = '';
      return;
    }
    const o = data.overview;
    node.innerHTML = [
      { label: 'Всего событий', value: fmtInt(o.total_events) },
      { label: 'Средняя стоимость кейса', value: fmtMoney(o.cost_per_case) },
      { label: 'Импортируемые кейсы', value: fmtPct(o.import_share) + '%' },
    ].map((item) => (
      '<div class="mini-kpi-card"><div class="mini-kpi-label">' + escapeHtml(item.label) +
      '</div><div class="mini-kpi-value">' + item.value + '</div></div>'
    )).join('');
  }

  function renderOverview() {
    if (!data.overview) return;
    renderMiniKpi();
    renderExecutive();
    renderFilterChips();
    // 3+ активных фильтра — тройного среза нет: empty state вместо виджетов.
    if (computeSlice().kind === 'empty') {
      renderEmptyOverview();
      return;
    }
    renderKpiGroups();
    renderMonthlyChart();
    renderCategoryTable();
    renderOverviewDonut();
    renderOverviewStacked();
  }

  function populateFilters() {
    const fill = (select, values, allLabel) => {
      if (!select) return;
      select.innerHTML = '<option value="">' + allLabel + '</option>' +
        values.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join('');
    };
    fill(el('filter-category'), data.overview.by_category.map((row) => row.category), 'Все категории');
    fill(el('filter-region'), data.overview.by_region.map((row) => row.region), 'Все регионы');
    fill(el('filter-type'), data.overview.by_procurement_type.map((row) => row.procurement_type), 'Все типы');
    const months = data.overview.monthly.map((row) => row.month).sort();
    fill(el('filter-month'), months, 'Все месяцы');
    el('filter-month').innerHTML = '<option value="">Все месяцы</option>' +
      months.map((month) => '<option value="' + month + '">' + fmtMonth(month) + '</option>').join('');

    document.querySelectorAll('select[data-filter]').forEach((select) => {
      select.addEventListener('change', () => {
        state.filters[select.dataset.filter] = select.value;
        debouncedRenderOverview();
      });
    });
    el('filters-reset').addEventListener('click', resetFilters);
  }

  function resetFilters() {
    state.filters = { category: '', region: '', type: '', month: '' };
    ['category', 'region', 'type', 'month'].forEach((key) => {
      const select = el('filter-' + key);
      if (select) select.value = '';
    });
    renderOverview();
  }

  /* ============ СРЕЗЫ ФИЛЬТРОВ ============ */

  const DIM_KEYS = ['category', 'region', 'type'];

  function activeFilters() {
    return Object.entries(state.filters).filter(([, value]) => value);
  }

  function filterDescriptions() {
    return activeFilters().map(([key, value]) => {
      const label = key === 'category' ? 'категория' : key === 'region' ? 'регион'
        : key === 'type' ? 'тип закупки' : 'месяц';
      return label + ' «' + (key === 'month' ? fmtMonth(value) : value) + '»';
    });
  }

  // Маргинальный срез: строки одного измерения за весь период.
  // Приводим к общей форме {label, total_cases, total_cost, avg_duration_days}.
  function marginalRows(dim) {
    const pick = (rows, field) => rows.map((row) => ({
      label: row[field],
      total_cases: row.total_cases,
      total_cost: row.total_cost,
      avg_duration_days: row.avg_duration_days,
    }));
    if (dim === 'category') return pick(data.overview.by_category, 'category');
    if (dim === 'region') return pick(data.overview.by_region, 'region');
    return pick(data.overview.by_procurement_type, 'procurement_type');
  }

  // Парный срез: строки измерения `dim` внутри значения другого измерения.
  function pairRows(dim, otherKey, otherValue) {
    const pick = (rows, otherField, ownField) => rows
      .filter((row) => row[otherField] === otherValue)
      .map((row) => ({
        label: row[ownField],
        total_cases: row.total_cases,
        total_cost: row.total_cost,
        avg_duration_days: row.avg_duration_days,
      }));
    if (dim === 'category') {
      return otherKey === 'region'
        ? pick(data.overview.by_category_region, 'region', 'category')
        : pick(data.overview.by_category_type, 'procurement_type', 'category');
    }
    if (dim === 'region') {
      return otherKey === 'category'
        ? pick(data.overview.by_category_region, 'category', 'region')
        : pick(data.overview.by_region_type, 'procurement_type', 'region');
    }
    return otherKey === 'category'
      ? pick(data.overview.by_category_type, 'category', 'procurement_type')
      : pick(data.overview.by_region_type, 'region', 'procurement_type');
  }

  // Строки таблицы для измерения dim с учётом остальных фильтров.
  // null — тройного среза нет (например, категория × регион × тип).
  function sliceRowsFor(dim) {
    const others = activeFilters().filter(([key]) => key !== dim);
    if (others.length >= 2) return null;
    let rows;
    if (!others.length) {
      rows = marginalRows(dim);
    } else {
      const [otherKey, otherValue] = others[0];
      if (otherKey === 'month') {
        const source = dim === 'category' ? data.overview.monthly_by_category
          : dim === 'region' ? data.overview.monthly_by_region : data.overview.monthly_by_type;
        const field = dim === 'type' ? 'procurement_type' : dim;
        rows = source.filter((row) => row.month === otherValue).map((row) => ({
          label: row[field],
          total_cases: row.cases,
          total_cost: null,
          avg_duration_days: row.avg_duration_days,
        }));
      } else {
        rows = pairRows(dim, otherKey, otherValue);
      }
    }
    const own = state.filters[dim];
    if (own) rows = rows.filter((row) => row.label === own);
    return rows;
  }

  // KPI-строка текущего среза: global → null; иначе {total_cases, avg_duration_days,
  // total_cost?, rejected_share?, month_scoped?}. Поля, которых нет в агрегате среза, не подмешиваем.
  function computeSlice() {
    const active = activeFilters();
    if (!active.length) return { kind: 'global', kpiRow: null };
    if (active.length >= 3) return { kind: 'empty', kpiRow: null };

    const nonMonth = active.filter(([key]) => DIM_KEYS.includes(key));
    const month = state.filters.month;

    if (nonMonth.length === 2) {
      const row = pairRows(nonMonth[1][0], nonMonth[0][0], nonMonth[0][1])
        .find((item) => item.label === nonMonth[1][1]);
      return {
        kind: 'pair',
        kpiRow: row
          ? { total_cases: row.total_cases, total_cost: row.total_cost, avg_duration_days: row.avg_duration_days }
          : null,
      };
    }

    if (nonMonth.length === 1) {
      const [key, value] = nonMonth[0];
      const row = marginalRows(key).find((item) => item.label === value);
      let kpiRow = row
        ? { total_cases: row.total_cases, total_cost: row.total_cost, avg_duration_days: row.avg_duration_days }
        : null;
      if (month && kpiRow) {
        // Месяц уточняет срез: берём числа из месячного ряда. Стоимость простоя
        // и доли за месяц×измерение не предагрегированы — не показываем их вовсе.
        const monthlyRows = key === 'category' ? data.overview.monthly_by_category
          : key === 'region' ? data.overview.monthly_by_region : data.overview.monthly_by_type;
        const dimField = key === 'type' ? 'procurement_type' : key;
        const monthlyRow = monthlyRows.find((item) => item.month === month && item[dimField] === value);
        if (monthlyRow) {
          kpiRow = { total_cases: monthlyRow.cases, avg_duration_days: monthlyRow.avg_duration_days, month_scoped: true };
        }
      }
      return { kind: 'marginal', kpiRow };
    }

    const row = data.overview.monthly.find((item) => item.month === month);
    return {
      kind: 'marginal',
      kpiRow: row
        ? {
          total_cases: row.cases,
          avg_duration_days: row.avg_duration_days,
          total_cost: row.total_cost,
          rejected_share: row.rejected_share,
        }
        : null,
    };
  }

  function renderExecutive() {
    const node = el('executive-summary');
    if (!node || !data.overview) return;
    const slice = computeSlice();

    if (slice.kind === 'empty') {
      node.innerHTML = '<div class="empty-state"><div class="empty-icon">⛳</div>' +
        '<b>Для этого среза нет данных</b>' +
        '<p>Комбинация из трёх и более фильтров не предагрегирована в overview.json. ' +
        'Сбросьте один из фильтров в блоке «Фильтры» — виджеты пересчитаются.</p></div>';
      return;
    }

    const ex = data.overview.executive || {
      headline: 'Средняя длительность ' + fmtDays(data.overview.avg_duration_days) + ' дн при ' +
        fmtPct(data.overview.rejected_share) + '% отмен и ' + fmtPct(data.overview.returns_share) + '% возвратов',
      drivers: [
        { key: 'avg_duration_days', label: 'Средняя длительность', value: data.overview.avg_duration_days, unit: 'дн' },
        { key: 'rejected_share', label: 'Отменённые кейсы', value: data.overview.rejected_share, unit: '%' },
        { key: 'returns_share', label: 'Кейсы с возвратом', value: data.overview.returns_share, unit: '%' },
      ],
      action: 'Сфокусироваться на узких местах по времени ожидания и снизить долю возвратов',
    };

    // В срезе показываем только то, что реально есть в агрегате: иначе global-цифра
    // рядом с суффиксом «(срез: …)» выглядела бы как цифра среза.
    const row = slice.kind === 'global' ? null : slice.kpiRow;

    // Заголовок для среза пересобираем из его цифр: глобальные «35,7 дн при 4,8% отмен»
    // рядом с срезом вводили бы в заблуждение, а доли отмен/возвратов в срезе нет.
    let headline = slice.kind === 'global'
      ? ex.headline
      : 'Для выбранного среза нет предагрегированных метрик';
    if (row && row.avg_duration_days != null) {
      headline = 'Средняя длительность ' + fmtDays(row.avg_duration_days) + ' дн · ' +
        fmtInt(row.total_cases) + ' кейсов';
    }
    const driverValue = (driver) => {
      if (slice.kind === 'global') return driver.unit === '%' ? fmtPct(driver.value) : fmtDays(driver.value);
      if (!row) return '—';
      if (driver.key === 'avg_duration_days') return row.avg_duration_days != null ? fmtDays(row.avg_duration_days) : '—';
      if (driver.key === 'rejected_share') return row.rejected_share != null ? fmtPct(row.rejected_share) : '—';
      return '—';
    };

    const periodStart = data.overview.period_start || (data.overview.monthly[0] && data.overview.monthly[0].month);
    const periodEnd = data.overview.period_end || (data.overview.monthly[data.overview.monthly.length - 1] &&
      data.overview.monthly[data.overview.monthly.length - 1].month);
    const period = [periodStart, periodEnd].filter(Boolean).join(' – ') +
      (data.overview.source_version ? ' · ' + data.overview.source_version : '');

    const suffix = slice.kind !== 'global'
      ? ' <span class="exec-suffix">(срез: ' + escapeHtml(filterDescriptions().join(', ')) + ')</span>'
      : '';

    const driversHtml = (ex.drivers || []).map((driver) => (
      '<div class="driver-card">' +
      '<div class="driver-label">' + escapeHtml(driver.label) + '</div>' +
      '<div class="driver-value">' + driverValue(driver) +
      (driver.unit && driverValue(driver) !== '—' ? '<span class="unit">' + escapeHtml(driver.unit) + '</span>' : '') +
      '</div></div>'
    )).join('');

    node.innerHTML =
      '<div class="exec-top"><h2>Executive summary</h2>' +
      '<span class="exec-period">' + escapeHtml(period) + '</span></div>' +
      '<p class="exec-headline">' + escapeHtml(headline) + suffix + '</p>' +
      '<div class="exec-drivers">' + driversHtml + '</div>' +
      '<div class="exec-action"><b>Рекомендация:</b> ' + escapeHtml(ex.action) + '</div>';
  }

  /* ============ PROCESS MAP ============ */

  function currentEdges() {
    if (state.processCategory === 'import' || state.processCategory === 'no-import') {
      const segmented = data.processMap.edges_by_import &&
        data.processMap.edges_by_import[state.processCategory];
      if (Array.isArray(segmented)) return segmented;
      const includesCustoms = (edge) =>
        edge.activity === 'Customs Clearance' || edge.next_activity === 'Customs Clearance';
      return (data.processMap.edges || []).filter((edge) =>
        includesCustoms(edge) === (state.processCategory === 'import')
      );
    }
    if (state.processCategory && data.processMap.edges_by_category && data.processMap.edges_by_category[state.processCategory]) {
      return data.processMap.edges_by_category[state.processCategory];
    }
    return data.processMap.edges;
  }

  function currentVariants() {
    const variants = data.variantPaths && Array.isArray(data.variantPaths.variants)
      ? data.variantPaths.variants : [];
    if (state.processCategory !== 'import' && state.processCategory !== 'no-import') return variants;
    const needsCustoms = state.processCategory === 'import';
    return variants.filter((variant) => {
      const hasCustoms = Array.isArray(variant.steps) &&
        variant.steps.some((step) => step.activity === 'Customs Clearance');
      return hasCustoms === needsCustoms;
    });
  }

  function currentVariantByRank(rank) {
    return currentVariants().find((variant, index) =>
      Number(variant.rank || index + 1) === Number(rank)
    ) || null;
  }

  function nodeCases(name) {
    if (state.processCategory === 'import' || state.processCategory === 'no-import') {
      const frequencies = data.processMap.frequency_by_import &&
        data.processMap.frequency_by_import[state.processCategory];
      if (frequencies && Number.isFinite(Number(frequencies[name]))) {
        return Number(frequencies[name]);
      }
      if (name === 'Customs Clearance') {
        return state.processCategory === 'import'
          ? (data.processMap.nodes_metadata[name] && data.processMap.nodes_metadata[name].cases)
          : 0;
      }
      return null;
    }
    if (state.processCategory && data.processMap.frequency_by_category && data.processMap.frequency_by_category[state.processCategory]) {
      const map = data.processMap.frequency_by_category[state.processCategory] || {};
      return map[name] || 0;
    }
    return data.processMap.nodes_metadata[name] ? data.processMap.nodes_metadata[name].cases : 0;
  }

  const ROW_Y = [1.9, 0, -1.9];

  function layoutNodes() {
    const meta = data.processMap.nodes_metadata;
    const ordered = data.processMap.nodes.slice()
      .sort((a, b) => meta[a].avg_position - meta[b].avg_position);
    const rows = [[], [], []];
    ordered.forEach((name) => {
      const position = meta[name].avg_position;
      const row = position < 7 ? 0 : position < 16 ? 1 : 2;
      rows[row].push(name);
    });
    const positions = {};
    const maxLength = Math.max(rows[0].length, rows[1].length, rows[2].length);
    rows.forEach((list, rowIndex) => {
      const reversed = rowIndex === 1;
      list.forEach((name, index) => {
        const rawX = reversed ? list.length - 1 - index : index;
        const offset = (maxLength - list.length) / 2;
        const branch = name === 'Negotiation Started' || name === 'Revised Draft Created';
        positions[name] = {
          x: rawX + offset,
          y: ROW_Y[rowIndex] + (branch ? -0.5 : 0),
          row: rowIndex,
          branch: branch,
        };
      });
    });
    return positions;
  }

  function renderProcessCategories() {
    const categories = data.overview.by_category.map((row) => row.category);
    const html = ['<button type="button" class="chip is-active" data-category="">Все</button>']
      .concat(categories.map((category) => '<button type="button" class="chip" data-category="' +
        escapeHtml(category) + '">' + escapeHtml(category) + '</button>'))
      .join('');
    const catEl = el('process-categories');
    if (catEl) catEl.innerHTML = html;
    const importChip = document.querySelector('#tab-process [data-filter="import"]');
    const noImportChip = document.querySelector('#tab-process [data-filter="no-import"]');
    const syncFilters = () => {
      if (importChip) importChip.classList.toggle('is-active', state.processCategory === 'import');
      if (noImportChip) noImportChip.classList.toggle('is-active', state.processCategory === 'no-import');
      if (catEl) {
        catEl.querySelectorAll('[data-category]').forEach((item) => {
          item.classList.toggle('is-active', item.dataset.category === state.processCategory);
        });
      }
    };
    [importChip, noImportChip].forEach((chip) => {
      if (!chip) return;
      chip.addEventListener('click', () => {
        state.processCategory = chip.dataset.filter;
        syncFilters();
        populateVariantSelect();
        renderProcessMap();
      });
    });
    if (catEl) {
      catEl.querySelectorAll('[data-category]').forEach((chip) => {
        chip.addEventListener('click', () => {
          state.processCategory = chip.dataset.category;
          syncFilters();
          renderProcessMap();
        });
      });
    }
    syncFilters();
  }

  function edgeKey(edge) {
    return edge.activity + '\u0001' + edge.next_activity;
  }

  function renderProcessChart() {
    let node = el('scatter-plot');
    if (!plotlyAvailable(node)) {
      node = el('process-chart');
    }
    if (!plotlyAvailable(node)) return;
    const c = themeColors();
    const meta = data.processMap.nodes_metadata;
    const positions = layoutNodes();
    const edgesAll = currentEdges().slice().sort((a, b) => b.frequency - a.frequency);
    const activeEdgeNodes = new Set(edgesAll.flatMap((edge) => [edge.activity, edge.next_activity]));
    // apply step filter to DFG nodes/edges if positions indicate step order? use avg_position
    const sFrom = state.mapStepFrom != null ? state.mapStepFrom : 1;
    const sTo = state.mapStepTo != null ? state.mapStepTo : 22;
    const allowedNodes = new Set();
    Object.keys(meta).forEach((name) => {
      if (!activeEdgeNodes.has(name)) return;
      const pos = meta[name].avg_position;
      if (pos == null) { allowedNodes.add(name); return; }
      // map approx by position ranges? use position index 1-based
      const p1 = Math.floor(pos) + 1;
      if (p1 >= sFrom && p1 <= sTo) allowedNodes.add(name);
      else {
        // also check exact by scanning order? fallback allow if in range
      }
    });
    // better: include node if any edge in range touches or if position in range
    // recompute allowed by scanning positions set intersection
    const allowedNodes2 = new Set();
    Object.keys(meta).forEach((name) => {
      const pos = meta[name].avg_position;
      if (pos == null) { allowedNodes2.add(name); return; }
      // rough 1-based by position
      let p1 = Math.round(pos) + 1;
      if (p1 < 1) p1 = 1;
      if (p1 >= sFrom && p1 <= sTo) allowedNodes2.add(name);
    });
    const edges = edgesAll.filter((e) => allowedNodes2.has(e.activity) && allowedNodes2.has(e.next_activity));
    const visibleEdges = state.edgeLimit === 'all' ? edges : edges.slice(0, state.edgeLimit);
    const maxFrequency = edges.length ? Math.max(...edges.map((e) => e.frequency)) : 1;

    const traces = [];

    visibleEdges.forEach((edge) => {
      const from = positions[edge.activity];
      const to = positions[edge.next_activity];
      if (!from || !to) return;
      const backward = meta[edge.next_activity].avg_position < meta[edge.activity].avg_position;
      const mid = {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2 + (backward ? 0.42 : 0.12),
      };
      const width = 1 + 5 * (edge.frequency / maxFrequency);
      const avgDays = edge.avg_duration_days != null ? edge.avg_duration_days
        : (edge.median_duration_days != null ? edge.median_duration_days : 0);
      let color = c.muted;
      if (avgDays <= 0.5) color = c.success;
      else if (avgDays <= 2) color = c.warning;
      else color = c.danger;
      if (backward) color = c.danger;
      const uniqueCases = edge.unique_cases != null ? edge.unique_cases : 0;
      const medianDays = edge.median_duration_days != null ? edge.median_duration_days : 0;
      const customdataRow = [edge.frequency, uniqueCases, medianDays];
      const steps = 8;
      const xs = [];
      const ys = [];
      const customdataArr = [];
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const oneMinusT = 1 - t;
        xs.push(oneMinusT * oneMinusT * from.x + 2 * oneMinusT * t * mid.x + t * t * to.x);
        ys.push(oneMinusT * oneMinusT * from.y + 2 * oneMinusT * t * mid.y + t * t * to.y);
        customdataArr.push(customdataRow);
      }

      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: xs,
        y: ys,
        line: {
          color: color,
          width: width,
          shape: 'spline',
          smoothing: 0.6,
          dash: backward ? 'dot' : 'solid',
        },
        opacity: backward ? 0.85 : 0.55,
        customdata: customdataArr,
        meta: edgeKey(edge),
        hovertemplate: '<b>' + escapeHtml(ACTIVITY_LABELS_RU[edge.activity] || edge.activity) + ' → ' +
          escapeHtml(ACTIVITY_LABELS_RU[edge.next_activity] || edge.next_activity) + '</b><br>' +
          'Переходов: %{customdata[0]}<br>Уникальных кейсов: %{customdata[1]}<br>Медиана: %{customdata[2]} дн<extra></extra>',
        showlegend: false,
      });
    });

    const byType = { start: [], end: [], bottleneck: [], normal: [] };
    const sFrom2 = state.mapStepFrom != null ? state.mapStepFrom : 1;
    const sTo2 = state.mapStepTo != null ? state.mapStepTo : 22;
    data.processMap.nodes.forEach((name) => {
      if (!activeEdgeNodes.has(name)) return;
      const type = meta[name].type;
      const pos = meta[name].avg_position;
      if (pos != null) {
        let p1 = Math.round(pos) + 1;
        if (p1 < 1) p1 = 1;
        if (!(p1 >= sFrom2 && p1 <= sTo2)) return;
      }
      (byType[type] || byType.normal).push(name);
    });

    const colorByType = {
      start: c.success,
      end: c.secondary || c.muted,
      bottleneck: c.danger,
      normal: c.accent,
    };

    Object.keys(byType).forEach((type) => {
      const names = byType[type];
      if (!names.length) return;
      const isBottleneck = type === 'bottleneck';
      const texts = names.map((name) => NODE_GRAPH_LABELS[name] || ACTIVITY_LABELS_RU[name] || name);
      traces.push({
        type: 'scatter',
        mode: 'markers+text',
        name: { start: 'Старт', end: 'Конец', bottleneck: 'Узкое место', normal: 'Обычная' }[type],
        x: names.map((name) => positions[name].x),
        y: names.map((name) => positions[name].y),
        text: texts,
        textposition: names.map(name => {
          if (name === 'Revised Draft Created') return 'middle left';
          if (name === 'Goods Shipped') return 'top center';
          if (name === 'Draft Contract Created') return 'top center';
          if (name === 'Legal Review Started') return 'top right';
          if (name === 'Legal Review Completed') return 'bottom right';
          return 'top center';
        }),
        textfont: { size: 10, color: c.text },
        cliponaxis: false,
        marker: {
          size: names.map((name) => {
            const cases = nodeCases(name);
            const base = isBottleneck ? 16 : type === 'normal' ? 12 : 14;
            return base + 8 * Math.sqrt((Number(cases) || 0) / 50000);
          }),
          color: colorByType[type] || c.accent,
          line: { color: c.surface, width: 2 },
        },
        customdata: names.map((name) => name),
        hovertemplate: '<b>%{customdata}</b><extra></extra>',
        showlegend: false,
      });
    });

    // Hover для узлов собираем вручную: Plotly не умеет подставлять вычисленные поля
    traces.forEach((trace) => {
      if (trace.mode !== 'markers+text') return;
      trace.customdata = trace.customdata.map((name) => {
        const info = meta[name];
        const cases = nodeCases(name);
        return [
          name,
          cases == null ? '—' : fmtInt(cases),
          info.avg_days != null ? fmtDays(info.avg_days) : '—',
          info.bottleneck_score_normalized != null ? twoFmt.format(info.bottleneck_score_normalized) : '—',
          ACTIVITY_LABELS_RU[name] || name,
        ];
      });
      trace.hovertemplate = '<b>%{customdata[4]}</b><br>Кейсов: %{customdata[1]}' +
        '<br>Ожидание: %{customdata[2]} дн<br>Норм. скор: %{customdata[3]}<extra></extra>';
    });

    const layout = baseLayout({
      showlegend: false,
      margin: { l: 80, r: 40, t: 30, b: 20 },
      xaxis: { visible: false, range: [-0.9, 9.9], fixedrange: true },
      yaxis: {
        visible: true,
        range: [-2.95, 2.55],
        fixedrange: true,
        tickvals: ROW_Y,
        ticktext: ['Снабжение', 'Контрактация', 'Логистика'],
        tickfont: { size: 10, color: c.muted },
        showgrid: false,
        zeroline: false,
        ticklen: 0,
      },
      hovermode: 'closest',
    });

    plot(node, traces, layout);

    if (!handlersBound.process) {
      handlersBound.process = true;
      node.on('plotly_click', (event) => {
        const point = event.points && event.points[0];
        if (!point) return;
        if (point.data.mode === 'markers+text') {
          openNodeDetails(point.customdata[0]);
          return;
        }
        if (point.data.type === 'scatter' && point.data.mode === 'lines') {
          if (typeof point.data.meta === 'string') {
            const edgeAllCur = currentEdges();
            const edge = edgeAllCur.find((item) => edgeKey(item) === point.data.meta);
            if (edge) {
              const sFrom3 = state.mapStepFrom != null ? state.mapStepFrom : 1;
              const sTo3 = state.mapStepTo != null ? state.mapStepTo : 22;
              const mFrom = data.processMap.nodes_metadata[edge.activity];
              const mTo = data.processMap.nodes_metadata[edge.next_activity];
              if (mFrom && mTo) {
                let p1 = Math.round(mFrom.avg_position) + 1;
                let p2 = Math.round(mTo.avg_position) + 1;
                if (p1 < 1) p1 = 1;
                if (p2 < 1) p2 = 1;
                if (p1 < sFrom3 || p1 > sTo3 || p2 < sFrom3 || p2 > sTo3) {
                  return;
                }
              }
              openEdgeDetails(edge);
              return;
            }
          }
        }
        if (typeof point.data.meta === 'string') {
          const edgeAllCur = currentEdges();
          const edge = edgeAllCur.find((item) => edgeKey(item) === point.data.meta);
          if (edge) {
            const sFrom3 = state.mapStepFrom != null ? state.mapStepFrom : 1;
            const sTo3 = state.mapStepTo != null ? state.mapStepTo : 22;
            const mFrom = data.processMap.nodes_metadata[edge.activity];
            const mTo = data.processMap.nodes_metadata[edge.next_activity];
            if (mFrom && mTo) {
              let p1 = Math.round(mFrom.avg_position) + 1;
              let p2 = Math.round(mTo.avg_position) + 1;
              if (p1 < 1) p1 = 1;
              if (p2 < 1) p2 = 1;
              if (p1 < sFrom3 || p1 > sTo3 || p2 < sFrom3 || p2 > sTo3) {
                return;
              }
            }
            openEdgeDetails(edge);
            return;
          }
        }
      });
    }
  }

  // Переходы выбранного варианта: частоты и длительности берём из общего DFG,
  // а если перехода там нет — показываем число кейсов варианта.
  function variantEdgeRows() {
    const rank = state.mapVariantRank || 1;
    const variant = currentVariantByRank(rank);
    if (!variant || !Array.isArray(variant.steps)) return [];
    const steps = variant.steps.slice()
      .sort((a, b) => (a.position != null ? a.position : 0) - (b.position != null ? b.position : 0));
    const rows = [];
    for (let i = 0; i < steps.length - 1; i += 1) {
      const from = steps[i];
      const to = steps[i + 1];
      const global = currentEdges().find((edge) =>
        edge.activity === from.activity && edge.next_activity === to.activity);
      rows.push(global || {
        activity: from.activity,
        next_activity: to.activity,
        frequency: to.cases || from.cases || 0,
        unique_cases: to.cases || from.cases || 0,
        avg_duration_days: null,
        median_duration_days: null,
        p90_duration_days: null,
      });
    }
    return rows;
  }

  function variantsInRange() {
    const variants = currentVariants();
    const from = Math.max(1, Number(state.mapRangeFrom) || 1);
    const to = Math.min(80, Number(state.mapRangeTo) || from);
    return variants.filter((variant) => {
      const rank = Number(variant.rank) || 0;
      return rank >= from && rank <= to && rank >= 1;
    }).slice(0, Math.min(to, variants.length));
  }

  function stepsInRange(variant) {
    if (!Array.isArray(variant.steps)) return [];
    const steps = variant.steps.slice()
      .sort((a, b) => (a.position != null ? a.position : 0) - (b.position != null ? b.position : 0));
    const from = state.mapStepFrom != null ? state.mapStepFrom : 1;
    const to = state.mapStepTo != null ? state.mapStepTo : (steps.length || 22);
    return steps.filter((step, index) => {
      const position = step.position != null ? Number(step.position) + 1 : index + 1;
      return position >= from && position <= to;
    });
  }

  function renderEdgeList() {
    const single = state.mapMode === 'single';
    const edges = single
      ? variantEdgeRows().slice().sort((a, b) => b.frequency - a.frequency)
      : currentEdges().slice().sort((a, b) => b.frequency - a.frequency);
    const visible = single || state.edgeLimit !== 'all' ? edges.slice(0, 10) : edges;
    const badge = el('edges-badge');
    if (badge) {
      badge.textContent = single
        ? 'топ-10 из ' + edges.length
        : (state.edgeLimit === 'all' ? 'все ' + edges.length : 'топ-10 по частоте');
    }

    const list = el('edge-list');
    if (!list) return;
    list.innerHTML = visible.map((edge, index) => (
      '<li><button type="button" class="edge-btn" data-index="' + index + '">' +
      '<span class="edge-rank">' + (index + 1) + '</span>' +
      '<span><span class="edge-name">' + escapeHtml(ACTIVITY_LABELS_RU[edge.activity] || edge.activity) + '<span class="arrow">→</span>' +
      escapeHtml(ACTIVITY_LABELS_RU[edge.next_activity] || edge.next_activity) + '</span>' +
      '<span class="edge-meta">' + (edge.avg_duration_days != null
        ? fmtDays(edge.avg_duration_days) + ' дн в среднем'
        : fmtInt(edge.frequency) + ' кейсов') + '</span></span>' +
      '<span class="edge-freq">' + fmtInt(edge.frequency) + '</span>' +
      '</button></li>'
    )).join('');

    list.querySelectorAll('.edge-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEdgeDetails(visible[Number(btn.dataset.index)]));
    });
  }

  function fmtEdgeDays(value) {
    return value == null ? '—' : twoFmt.format(Number(value) || 0);
  }

  function renderEdgeStats(processMap, metric) {
    const table = el('edge-stats-table');
    if (!table || !processMap) return;

    const allowed = ['avg_duration_days', 'median_duration_days', 'p90_duration_days'];
    const metricKey = allowed.indexOf(metric) === -1 ? 'median_duration_days' : metric;
    const edges = currentEdges().slice()
      .sort((a, b) => b.frequency - a.frequency);

    const badge = el('edge-stats-badge');
    if (badge) {
      const filterLabel = {
        import: 'Таможня',
        'no-import': 'Без таможни',
      }[state.processCategory] || state.processCategory || 'все переходы';
      badge.textContent = filterLabel + ' · ' + edges.length;
    }

    if (!edges.length) {
      table.innerHTML = '<tbody><tr><td colspan="5" class="muted">Нет переходов для выбранного среза.</td></tr></tbody>';
      const emptyPager = el('edge-stats-pager');
      if (emptyPager) { emptyPager.hidden = true; emptyPager.innerHTML = ''; }
      return;
    }

    const metricClass = (key) => 'num' + (key === metricKey ? ' metric-active' : '');
    const head = '<thead><tr><th>Переход</th>' +
      '<th class="num">Частота</th>' +
      '<th class="' + metricClass('avg_duration_days') + '">Среднее, дн</th>' +
      '<th class="' + metricClass('median_duration_days') + '">Медиана, дн</th>' +
      '<th class="' + metricClass('p90_duration_days') + '">P90, дн</th>' +
      '</tr></thead>';

    const pageSize = 5;
    const pageCount = Math.max(1, Math.ceil(edges.length / pageSize));
    const page = Math.min(Math.max(0, state.edgeStatsPage || 0), pageCount - 1);
    state.edgeStatsPage = page;
    const pageRows = edges.slice(page * pageSize, (page + 1) * pageSize);

    const body = pageRows.map((edge) => (
      '<tr>' +
      '<td><span class="edge-stats-name">' + escapeHtml((ACTIVITY_LABELS_RU[edge.activity] || edge.activity).replace('Юрпроверка', 'Юр. проверка')) +
      '<span class="edge-arrow">→</span>' + escapeHtml((ACTIVITY_LABELS_RU[edge.next_activity] || edge.next_activity).replace('Юрпроверка', 'Юр. проверка')) + '</span></td>' +
      '<td class="num">' + fmtInt(edge.frequency) + '</td>' +
      '<td class="' + metricClass('avg_duration_days') + '">' + fmtEdgeDays(edge.avg_duration_days) + '</td>' +
      '<td class="' + metricClass('median_duration_days') + '">' + fmtEdgeDays(edge.median_duration_days) + '</td>' +
      '<td class="' + metricClass('p90_duration_days') + '">' + fmtEdgeDays(edge.p90_duration_days) + '</td>' +
      '</tr>'
    )).join('');

    table.innerHTML = head + '<tbody>' + body + '</tbody>';

    const pager = el('edge-stats-pager');
    if (!pager) return;
    if (edges.length <= pageSize) {
      pager.hidden = true;
      pager.innerHTML = '';
      return;
    }
    pager.hidden = false;
    const start = page * pageSize + 1;
    const end = Math.min(edges.length, (page + 1) * pageSize);
pager.innerHTML = '<span>' + start + '–' + end + ' из ' + edges.length + '</span>' +
      '<div class="pagination-controls">' +
      '<button type="button" class="pager-btn" data-page="prev"' + (page === 0 ? ' disabled' : '') + ' aria-label="Предыдущая страница">←</button>' +
      '<span>' + (page + 1) + ' / ' + pageCount + '</span>' +
      '<button type="button" class="pager-btn" data-page="next"' + (page === pageCount - 1 ? ' disabled' : '') + ' aria-label="Следующая страница">→</button>' +
      '</div>';
    initTableSorting('edge-stats-table');
  }

  function populateVariantSelect() {
    const select = el('map-variant-select');
    if (!select) return;
    const variants = currentVariants();
    const opts = variants.map((v, index) => {
      const rank = v.rank || index + 1;
      const pct = v.share_percent != null ? Number(v.share_percent).toFixed(2) : '0.00';
      return '<option value="' + rank + '">Топ-' + rank + ' (' + pct + '%)</option>';
    }).join('');
    select.innerHTML = opts;
    if (!variants.some((variant, index) =>
      Number(variant.rank || index + 1) === Number(state.mapVariantRank)
    )) {
      state.mapVariantRank = variants.length ? Number(variants[0].rank || 1) : 0;
    }
    select.value = state.mapVariantRank ? String(state.mapVariantRank) : '';
  }

  function renderSingleVariant() {
    let node = el('scatter-plot');
    if (!plotlyAvailable(node)) {
      node = el('process-chart');
    }
    if (!plotlyAvailable(node)) return;
    const rank = state.mapVariantRank || 1;
    const variant = currentVariantByRank(rank);
    if (!variant || !Array.isArray(variant.steps)) {
      plot(node, [], baseLayout({ showlegend: false }));
      return;
    }
    let steps = variant.steps.slice().sort((a, b) => (a.position != null ? a.position : 0) - (b.position != null ? b.position : 0));
    // apply step filter (1-based by position or index)
    const sFrom = state.mapStepFrom != null ? state.mapStepFrom : 1;
    const sTo = state.mapStepTo != null ? state.mapStepTo : (steps.length || 22);
    steps = steps.filter((st) => {
      const pos = st.position != null ? Number(st.position) + 1 : steps.indexOf(st) + 1;
      return pos >= sFrom && pos <= sTo;
    });
    const c = themeColors();
    const textColor = c.text || '#1a2332';
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6c757d';
    const xs = [];
    const ys = [];
    steps.forEach((step, idx) => {
      xs.push(0);
      ys.push(idx);
    });
    const traces = [];
    traces.push({
      type: 'scatter',
      mode: 'markers+text',
      x: xs,
      y: ys,
      text: steps.map((step) => {
        const label = (ACTIVITY_LABELS_RU[step.activity] || step.activity || '').replace('Юрпроверка', 'Юр. проверка');
        return label + ' (' + fmtInt(step.cases != null ? step.cases : 0) + ')';
      }),
      textposition: 'middle right',
      textfont: { size: 10, color: textColor },
      cliponaxis: false,
      marker: {
        size: 11,
        color: c.accent,
        line: { color: c.surface, width: 2 },
      },
      customdata: steps.map((step) => step.activity),
      hovertemplate: '<b>%{customdata}</b><extra></extra>',
      showlegend: false,
    });
    for (let i = 0; i < steps.length - 1; i += 1) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [0, 0],
        y: [i, i + 1],
        line: { color: mutedColor, width: 2 },
        hoverinfo: 'skip',
        showlegend: false,
      });
    }
    const layout = baseLayout({
      showlegend: false,
      margin: { l: 24, r: 250, t: 10, b: 10 },
      xaxis: { visible: false, fixedrange: true, range: [-0.08, 0.6] },
      yaxis: { visible: false, fixedrange: true, autorange: 'reversed' },
      hovermode: 'closest',
    });
    plot(node, traces, layout);
    if (!handlersBound.processSingle) {
      handlersBound.processSingle = true;
    }
    try {
      if (!handlersBound.processSingleClick) {
        handlersBound.processSingleClick = true;
        node.on('plotly_click', (event) => {
          const point = event.points && event.points[0];
          if (!point) return;
          if (point.data.mode === 'markers+text' && Array.isArray(point.data.customdata) && point.data.customdata[point.pointIndex] != null) {
            const name = point.data.customdata[point.pointIndex];
            if (!name) return;
            const variantCur = currentVariantByRank(state.mapVariantRank || 1);
            const stepCur = variantCur && Array.isArray(variantCur.steps) ? variantCur.steps.find((s) => s.activity === name) : null;
            openPanel(
              '<h3>' + escapeHtml(ACTIVITY_LABELS_RU[name] || name) + '</h3>' +
              '<p class="drilldown-sub">Активность варианта</p>' +
              '<ul class="detail-list">' +
              '<li><span class="detail-label">Кейсов</span><span class="detail-value">' + fmtInt(stepCur && stepCur.cases != null ? stepCur.cases : 0) + '</span></li>' +
              '</ul>'
            );
            return;
          }
        });
      }
    } catch (e) {}
  }

  function renderVariantRange() {
    let node = el('scatter-plot');
    if (!plotlyAvailable(node)) {
      node = el('process-chart');
    }
    if (!plotlyAvailable(node)) return;
    if (!data.variantPaths || !Array.isArray(data.variantPaths.variants)) {
      plot(node, [], baseLayout({ showlegend: false }));
      return;
    }
    let from = state.mapRangeFrom != null ? state.mapRangeFrom : 1;
    let to = state.mapRangeTo != null ? state.mapRangeTo : from;
    if (from < 1) from = 1;
    if (to > 80) to = 80;
    if (from > to) { const tmp = from; from = to; to = tmp; }
    state.mapRangeFrom = from;
    state.mapRangeTo = to;
    const variants = currentVariants();
    const totalAvail = variants.length;
    const rangeWrapFrom = el('map-range-from');
    const rangeWrapTo = el('map-range-to');
    if (rangeWrapFrom) rangeWrapFrom.value = String(from);
    if (rangeWrapTo) rangeWrapTo.value = String(to);
    const selected = variantsInRange();
    if (from === to && selected.length === 1) {
      state.mapMode = 'single';
      document.querySelectorAll('[data-map-mode]').forEach((item) => {
        const active = item.dataset.mapMode === 'single';
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const singleWrap = el('map-variant-single');
      if (singleWrap) singleWrap.hidden = false;
      const rangeWrap = el('map-variant-range');
      if (rangeWrap) rangeWrap.hidden = true;
      state.mapVariantRank = selected[0].rank || from;
      const vs = el('map-variant-select');
      if (vs) vs.value = String(state.mapVariantRank);
      renderSingleVariant();
      return;
    }
    // build merged graph
    const nodeMap = new Map();
    const edgeMap = new Map();
    selected.forEach((variant) => {
      const steps = stepsInRange(variant);
      if (!steps.length) return;
      const caseCount = Number(variant.frequency) || 0;
      new Set(steps.map((step) => step.activity)).forEach((keyN) => {
        if (!nodeMap.has(keyN)) {
          nodeMap.set(keyN, { activity: keyN, cases: 0, count: 0 });
        }
        const nm = nodeMap.get(keyN);
        nm.cases += caseCount;
        nm.count += 1;
      });
      for (let i = 0; i < steps.length - 1; i += 1) {
        const a = steps[i].activity;
        const b = steps[i + 1].activity;
        const ek = a + '\u0001' + b;
        if (!edgeMap.has(ek)) {
          edgeMap.set(ek, { activity: a, next_activity: b, frequency: 0 });
        }
        edgeMap.get(ek).frequency += 1;
      }
    });
    const nodesList = Array.from(nodeMap.values());
    const edgesList = Array.from(edgeMap.values());
    if (nodesList.length === 0) {
      plot(node, [], baseLayout({ showlegend: false }));
      return;
    }
    const c = themeColors();
    const textColor = c.text || '#1a2332';
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6c757d';
    // simple layout: assign y by first appearance order across merged sequence
    const order = [];
    const seen = new Set();
    selected.forEach((variant) => {
      if (!Array.isArray(variant.steps)) return;
      const steps = stepsInRange(variant);
      steps.forEach((st) => {
        if (!seen.has(st.activity)) {
          seen.add(st.activity);
          order.push(st.activity);
        }
      });
    });
    const positions = {};
    const rows = 4;
    const columns = Math.ceil(order.length / rows);
    order.forEach((act, idx) => {
      const column = Math.floor(idx / rows);
      const row = idx % rows;
      positions[act] = { x: column * 3.6, y: row * 2.2 };
    });
    const traces = [];
    const edgeLabelX = [];
    const edgeLabelY = [];
    const edgeLabels = [];
    edgesList.forEach((e) => {
      const a = positions[e.activity];
      const b = positions[e.next_activity];
      if (!a || !b) return;
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [a.x, b.x],
        y: [a.y, b.y],
        line: { color: mutedColor, width: 2 },
        hoverinfo: 'skip',
        showlegend: false,
      });
      if (e.frequency >= 2) {
        edgeLabelX.push((a.x + b.x) / 2);
        edgeLabelY.push((a.y + b.y) / 2);
        edgeLabels.push(fmtInt(e.frequency));
      }
    });
    if (edgeLabels.length) {
      traces.push({
        type: 'scatter',
        mode: 'text',
        x: edgeLabelX,
        y: edgeLabelY,
        text: edgeLabels,
        textposition: 'middle center',
        textfont: { size: 9, color: '#6b7688', family: 'Arial' },
        cliponaxis: false,
        hoverinfo: 'skip',
        showlegend: false,
      });
    }
    traces.push({
      type: 'scatter',
      mode: 'markers+text',
      x: order.map((a) => positions[a].x),
      y: order.map((a) => positions[a].y),
      text: order.map((a) => {
        const label = NODE_GRAPH_LABELS[a] || ACTIVITY_LABELS_RU[a] || a;
        return String(label).split(/<br\s*\/?>|\n/i).map(escapeHtml).join('<br>');
      }),
      textposition: 'top center',
      textfont: { size: 9, color: textColor, family: 'Arial' },
      cliponaxis: false,
      marker: { size: 16, color: c.accent, line: { color: c.surface, width: 2 } },
      customdata: order.map((activity) => [
        activity,
        fmtInt(nodeMap.get(activity) ? nodeMap.get(activity).cases : 0),
      ]),
      hovertemplate: '<b>%{customdata[0]}</b><br>Кейсов: %{customdata[1]}<extra></extra>',
      showlegend: false,
    });
    const layout = baseLayout({
      showlegend: false,
      margin: { l: 20, r: 20, t: 56, b: 20 },
      xaxis: { visible: false, fixedrange: true, range: [-1, Math.max(2, columns * 3.6)] },
      yaxis: { visible: false, fixedrange: true, range: [rows * 2.2 + 1, -1] },
      hovermode: 'closest',
    });
    plot(node, traces, layout);
    try {
      if (!handlersBound.processRangeClick) {
        handlersBound.processRangeClick = true;
        node.on('plotly_click', (event) => {
          const point = event.points && event.points[0];
          if (!point) return;
          if (point.data.mode === 'markers+text' && Array.isArray(point.data.customdata) && point.data.customdata[point.pointIndex] != null) {
            const details = point.data.customdata[point.pointIndex];
            const name = Array.isArray(details) ? details[0] : details;
            const nm = nodeMap.get(name);
            const caseCount = Array.isArray(details)
              ? details[1] : fmtInt(nm ? nm.cases : 0);
            openPanel(
              '<h3>' + escapeHtml(ACTIVITY_LABELS_RU[name] || name) + '</h3>' +
              '<p class="drilldown-sub">Активность (объединённый диапазон)</p>' +
              '<ul class="detail-list">' +
              '<li><span class="detail-label">Кейсов</span><span class="detail-value">' + escapeHtml(caseCount) + '</span></li>' +
              '</ul>'
            );
            return;
          }
        });
      }
    } catch (e) {}
  }

  function syncProcessLayout() {
    const dfg = document.querySelector('[data-process-dfg]');
    const side = document.querySelector('[data-process-side]');
    const single = state.mapMode === 'single';
    if (dfg) {
      dfg.classList.toggle('col-8', true);
      dfg.classList.toggle('col-12', false);
    }
    if (side) side.hidden = false;
  }

  function processCaption(modeText) {
    const total = nodeCases('Requisition Created');
    const edgesCount = currentEdges().length;
    const filterLabel = {
      import: 'Таможня',
      'no-import': 'Без таможни',
    }[state.processCategory] || state.processCategory || 'Весь лог';
    el('process-caption').innerHTML = escapeHtml(filterLabel) + ' · ' +
      fmtInt(total) + ' кейсов · ' + edgesCount + ' переходов · ' +
      '<span id="map-mode-caption">' + escapeHtml(modeText) + '</span>';
  }

  let cyDfg = null;
  let dagreRegistered = false;
  let visualizationResizeTimer = null;

  window.addEventListener('resize', () => {
    window.clearTimeout(visualizationResizeTimer);
    visualizationResizeTimer = window.setTimeout(() => {
      if (window.Plotly && window.Plotly.Plots && typeof window.Plotly.Plots.resize === 'function') {
        document.querySelectorAll('.js-plotly-plot').forEach((plotNode) => {
          const bounds = plotNode.getBoundingClientRect();
          if (plotNode.isConnected && plotNode.getClientRects().length > 0 &&
              getComputedStyle(plotNode).display !== 'none' && bounds.width > 0 && bounds.height > 0) {
            window.Plotly.Plots.resize(plotNode);
          }
        });
      }

      const cyContainer = cyDfg && cyDfg.container();
      if (cyContainer && cyContainer.isConnected && cyContainer.getClientRects().length > 0 &&
          cyContainer.clientWidth > 0 && cyContainer.clientHeight > 0) {
        cyDfg.resize();
      }
    }, 200);
  });

  function renderDfg() {
    const container = el('dfg-container');
    if (!container || typeof cytoscape === 'undefined' || !data.processMap) return;
    if (!container.isConnected || container.getClientRects().length === 0) return;
    const bounds = container.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      window.requestAnimationFrame(() => {
        const nextBounds = container.getBoundingClientRect();
        if (state.tab === 'process' && container.isConnected &&
            container.getClientRects().length > 0 && nextBounds.width > 0 && nextBounds.height > 0) {
          renderDfg();
        }
      });
      return;
    }
    const meta = data.processMap.nodes_metadata;
    const sFrom = state.mapStepFrom != null ? state.mapStepFrom : 1;
    const sTo = state.mapStepTo != null ? state.mapStepTo : 22;
    const allowedNodes = new Set();
    const rangeNodeCases = new Map();
    let modeEdges = [];
    let activeEdgeNodes = null;

    if (state.mapMode === 'single') {
      const rank = state.mapVariantRank || 1;
      const variant = currentVariantByRank(rank);
      if (variant && Array.isArray(variant.steps)) {
        let steps = variant.steps.slice().sort((a, b) => (a.position != null ? a.position : 0) - (b.position != null ? b.position : 0));
        steps = steps.filter((st) => {
          const pos = st.position != null ? Number(st.position) + 1 : steps.indexOf(st) + 1;
          return pos >= sFrom && pos <= sTo;
        });
        steps.forEach((st) => allowedNodes.add(st.activity));
        modeEdges = variantEdgeRows().filter((e) => allowedNodes.has(e.activity) && allowedNodes.has(e.next_activity));
      }
    } else if (state.mapMode === 'range') {
      const rangeEdges = new Map();
      variantsInRange().forEach((variant) => {
        const steps = stepsInRange(variant);
        const caseCount = Number(variant.frequency) || 0;
        const activitiesInVariant = new Set(steps.map((step) => step.activity));
        activitiesInVariant.forEach((name) => {
          allowedNodes.add(name);
          rangeNodeCases.set(name, (rangeNodeCases.get(name) || 0) + caseCount);
        });
        for (let index = 0; index < steps.length - 1; index += 1) {
          const activity = steps[index].activity;
          const nextActivity = steps[index + 1].activity;
          const key = activity + '\u0001' + nextActivity;
          const edge = rangeEdges.get(key) || {
            activity: activity,
            next_activity: nextActivity,
            frequency: 0,
          };
          edge.frequency += caseCount;
          rangeEdges.set(key, edge);
        }
      });
      activeEdgeNodes = new Set(allowedNodes);
      modeEdges = Array.from(rangeEdges.values());
    } else {
      modeEdges = currentEdges().slice();
      activeEdgeNodes = new Set();
      modeEdges.forEach((edge) => {
        activeEdgeNodes.add(edge.activity);
        activeEdgeNodes.add(edge.next_activity);
      });
      Object.keys(meta).forEach((name) => {
        if (!activeEdgeNodes.has(name)) return;
        const pos = meta[name].avg_position;
        if (pos == null) { allowedNodes.add(name); return; }
        let p1 = Math.round(pos) + 1;
        if (p1 < 1) p1 = 1;
        if (p1 >= sFrom && p1 <= sTo) allowedNodes.add(name);
      });
    }

    const edgesAll = modeEdges.slice().sort((a, b) => b.frequency - a.frequency);
    const maxFrequency = edgesAll.length ? Math.max(...edgesAll.map((e) => e.frequency)) : 1;
    const c = themeColors();

    const nodes = data.processMap.nodes
      .filter((name) => allowedNodes.has(name))
      .map((name) => ({
        data: {
          id: name,
          label: NODE_GRAPH_LABELS[name] || ACTIVITY_LABELS_RU[name] || name,
          cases: state.mapMode === 'range' ? (rangeNodeCases.get(name) || 0) : nodeCases(name),
          avg_days: meta[name].avg_days,
          type: meta[name].type,
          bottleneck_score: meta[name].bottleneck_score_normalized,
        },
      }));

    const edges = edgesAll
      .filter((e) => allowedNodes.has(e.activity) && allowedNodes.has(e.next_activity))
      .map((e) => {
        const backward = meta[e.next_activity].avg_position < meta[e.activity].avg_position;
        const avgDays = e.avg_duration_days != null ? e.avg_duration_days
          : (e.median_duration_days != null ? e.median_duration_days : 0);
        return {
          data: {
            id: edgeKey(e),
            source: e.activity,
            target: e.next_activity,
            frequency: e.frequency,
            avg_days: avgDays,
            backward: backward,
          },
        };
      });

    const style = [
      {
        selector: 'node',
        style: {
          'shape': (ele) => {
            const type = ele.data('type');
            if (type === 'start') return 'ellipse';
            return 'rectangle';
          },
          'width': (ele) => {
            const type = ele.data('type');
            if (type === 'start') return 60;
            return 'label';
          },
          'height': (ele) => {
            const type = ele.data('type');
            if (type === 'start') return 60;
            return 36;
          },
          'padding': '8px',
          'background-color': (ele) => {
            if (ele.data('id') === 'Payment Made') return '#666666';
            const type = ele.data('type');
            if (type === 'start') return '#28a745';
            if (type === 'end') return '#666666';
            if (type === 'bottleneck') return '#ff6b6b';
            return '#b8d4f0';
          },
          'border-width': 1,
          'border-color': '#4a90d9',
          'label': (ele) => {
            const type = ele.data('type');
            if (type === 'start') return 'Заявка создана';
            const name = ACTIVITY_LABELS_RU[ele.data('id')] || ele.data('id');
            const cases = ele.data('cases');
            return String(name).replace(/<br\s*\/?>/gi, ' ') + ' (' +
              (cases == null ? '—' : fmtInt(cases)) + ')';
          },
          'font-size': (ele) => {
            const type = ele.data('type');
            if (type === 'start') return '9px';
            return '10px';
          },
          'text-valign': 'center',
          'text-halign': 'center',
          'color': (ele) => {
            const type = ele.data('type');
            if (type === 'start') return '#ffffff';
            return '#000000';
          },
          'text-wrap': 'wrap',
          'text-max-width': (ele) => {
            const type = ele.data('type');
            if (type === 'start') return '50px';
            return '80px';
          },
          'text-opacity': 1,
        },
      },
      {
        selector: 'edge',
        style: {
          'width': (ele) => {
            const freq = ele.data('frequency') || 1;
            const maxFreq = 50000;
            return Math.max(1, (freq / maxFreq) * 8);
          },
          'line-color': (ele) => {
            if (ele.data('backward')) return '#dc3545';
            const days = Number(ele.data('avg_days')) || 0;
            if (days < 1) return '#28a745';
            if (days <= 4) return '#ffc107';
            return '#dc3545';
          },
          'target-arrow-color': (ele) => {
            if (ele.data('backward')) return '#dc3545';
            const days = Number(ele.data('avg_days')) || 0;
            if (days < 1) return '#28a745';
            if (days <= 4) return '#ffc107';
            return '#dc3545';
          },
          'target-arrow-shape': 'triangle',
          'curve-style': (ele) => (ele.data('backward') ? 'bezier' : 'straight'),
          'line-style': (ele) => (ele.data('backward') ? 'dashed' : 'solid'),
          'label': (ele) => String(ele.data('frequency')),
          'font-size': '9px',
          'color': '#555555',
          'text-rotation': '0deg',
          'text-margin-y': -8,
          'text-background-color': '#ffffff',
          'text-background-opacity': 0.8,
          'text-background-padding': '2px',
        },
      },
      {
        selector: ':selected',
        style: { 'border-width': 3, 'border-color': '#ffffff' },
      },
    ];

    const layoutName = state.dfgLayout || 'dagre';
    let layoutOpts;
    if (state.mapMode === 'range') {
      layoutOpts = { name: 'cose', animate: true, animationDuration: 400, padding: 10 };
    } else if (layoutName === 'breadthfirst') {
      layoutOpts = { name: 'breadthfirst', directed: true, padding: 10, animate: true, animationDuration: 400 };
    } else if (layoutName === 'cose') {
      layoutOpts = { name: 'cose', animate: true, animationDuration: 400 };
    } else {
      layoutOpts = { name: 'circle', animate: true, animationDuration: 400 };
    }

    if (!dagreRegistered && typeof cytoscapeDagre !== 'undefined') {
      try { cytoscape.use(cytoscapeDagre); dagreRegistered = true; } catch (err) { /* already registered */ }
    }
    if (!cyDfg) {
      cyDfg = cytoscape({
        container: container,
        elements: { nodes: nodes, edges: edges },
        style: style,
        layout: layoutOpts,
        userZooming: true,
        wheelSensitivity: 0.3,
        userPanning: true,
        boxSelectionEnabled: false,
        selectionType: 'single',
      });
      cyDfg.on('tap', 'node', (evt) => {
        openNodeDetails(evt.target.data('id'));
      });
      cyDfg.on('tap', 'edge', (evt) => {
        const d = evt.target.data();
        const edge = currentEdges().find((e) => edgeKey(e) === d.id);
        if (edge) openEdgeDetails(edge);
      });
    } else {
      cyDfg.style(style);
      cyDfg.elements().remove();
      cyDfg.add([...nodes, ...edges]);
      const layout = cyDfg.layout(layoutOpts);
      layout.run();
      try { cyDfg.fit(); } catch (e) {}
    }
    try { if (cyDfg) cyDfg.fit(); } catch (e) {}
  }

  function wireDfgToolbar() {
    const zoomIn = el('dfg-zoom-in');
    const zoomOut = el('dfg-zoom-out');
    const fit = el('dfg-fit');
    const layoutSelect = el('dfg-layout');
    const toggleLabels = el('dfg-toggle-labels');

    if (zoomIn) zoomIn.addEventListener('click', () => { if (cyDfg) cyDfg.zoom(cyDfg.zoom() * 1.2); });
    if (zoomOut) zoomOut.addEventListener('click', () => { if (cyDfg) cyDfg.zoom(cyDfg.zoom() / 1.2); });
    if (fit) fit.addEventListener('click', () => { if (cyDfg) cyDfg.fit(); });
    if (layoutSelect) {
      layoutSelect.value = state.dfgLayout || 'breadthfirst';
      layoutSelect.addEventListener('change', () => {
        state.dfgLayout = layoutSelect.value;
        if (cyDfg) {
          let opts;
          if (state.mapMode === 'range') {
            opts = { name: 'cose', animate: true, animationDuration: 400, padding: 10 };
          } else {
            opts = layoutSelect.value === 'breadthfirst'
              ? { name: 'breadthfirst', directed: true, padding: 10, animate: true, animationDuration: 400 }
              : (layoutSelect.value === 'cose'
                ? { name: 'cose', animate: true, animationDuration: 400 }
                : { name: 'circle', animate: true, animationDuration: 400 });
          }
          cyDfg.layout(opts).run();
          try { cyDfg.fit(); } catch (e) {}
        }
      });
    }
    if (toggleLabels && toggleLabels.parentElement) {
      toggleLabels.parentElement.style.display = 'none';
    }
  }
  function renderProcessMap() {
    if (!data.processMap) return;
    syncProcessLayout();
    state.edgeStatsPage = 0;
    renderEdgeList();
    renderEdgeStats(data.processMap, state.edgeStatsMetric);

    const dfgContainer = el('dfg-container');
    if (dfgContainer) dfgContainer.style.display = 'block';

    if (state.mapMode === 'single') {
      const rank = state.mapVariantRank || 1;
      const variant = currentVariantByRank(rank);
      const pct = variant ? variant.share_percent : null;
      processCaption('Один вариант, Топ-' + rank +
        (pct != null ? ' (' + pct.toFixed(2) + '%)' : ''));
      renderSingleVariant();
      renderDfg();
    } else if (state.mapMode === 'range') {
      let from = state.mapRangeFrom || 1;
      let to = state.mapRangeTo || from;
      if (from < 1) from = 1;
      if (to > 80) to = 80;
      const totalAvail = data.variantPaths && Array.isArray(data.variantPaths.variants)
        ? data.variantPaths.variants.length : 80;
      processCaption(to > totalAvail
        ? 'Диапазон, показано ' + totalAvail + ' из ' + totalAvail
        : 'Диапазон вариантов, Топ-' + from + '–Топ-' + to);
      renderVariantRange();
      renderDfg();
    } else {
      if (state.processCategory === 'import') {
        processCaption('DFG');
      } else if (state.processCategory === 'no-import') {
        processCaption('DFG');
      } else {
        processCaption('DFG, все переходы');
      }
      renderProcessChart();
      renderDfg();
    }

  }

  /* ============ BOTTLENECKS ============ */

  function sortedBottlenecks() {
    const rows = data.bottlenecks.bottlenecks.slice();
    const field = {
      normalized: 'bottleneck_score_normalized',
      raw: 'bottleneck_score',
      duration: 'avg_days',
      cost: 'cost_of_delay_rub',
    }[state.bottleneckSort] || 'bottleneck_score_normalized';
    rows.sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0));
    return rows;
  }

  function renderBottleneckNote() {
    const rows = data.bottlenecks.bottlenecks;
    const top = rows[0];
    const second = rows[1];
    if (!top || !second) return;
    const caption = el('bottleneck-caption');
    if (caption) {
      caption.textContent = rows.length + ' активностей · лидер: ' +
        (NODE_LABELS[top.activity] || top.activity) + ' · ' + sortLabel();
    }
  }

  function sortLabel() {
    return {
      normalized: 'нормированный скор',
      raw: 'сырой скор',
      duration: 'среднее ожидание',
      cost: 'стоимость потерь',
    }[state.bottleneckSort] || 'нормированный скор';
  }

  function renderTop3() {
    const rows = sortedBottlenecks().slice(0, 3);
    el('top3-grid').innerHTML = rows.map((row, index) => (
      '<div class="top3-card">' +
      '<div class="rank">#' + (index + 1) + ' · ' + sortLabel() + '</div>' +
      '<h4>' + escapeHtml(NODE_LABELS[row.activity] || row.activity) + '</h4>' +
      '<div class="top3-metrics">' +
      '<div><b>' + fmtDays(row.avg_days) + '</b>дней ожидания</div>' +
      '<div class="metric-danger"><b>' + twoFmt.format(row.bottleneck_score_normalized) + '</b>норм. скор</div>' +
      '<div><b>' + fmtMoney(row.cost_of_delay_rub) + '</b>потери</div>' +
      '</div>' +
      '<div class="top3-metrics" style="margin-top:8px">' +
      '<div class="analyst-only"><b>' + twoFmt.format(row.share_of_cases) + '</b>переходов на кейс</div>' +
      '<div><b>' + fmtInt(row.transitions) + '</b>переходов</div>' +
      '</div>' +
      '</div>'
    )).join('');
  }

  function renderBottleneckChart() {
    const node = el('bottleneck-chart');
    if (!plotlyAvailable(node)) return;
    const c = themeColors();
    // Переключатель «Все 24» управляет таблицей: 24 столбца в узкой карточке
    // делают подписи нечитаемыми, поэтому график всегда показывает топ-10.
    const rows = sortedBottlenecks().slice(0, 10).slice().reverse();
    const values = rows.map((row) => row.avg_days);
    const leader = sortedBottlenecks()[0];
    const colors = rows.map((row) => (leader && row.activity === leader.activity ? c.danger : c.accent));

    plot(node, [{
      type: 'bar',
      orientation: 'h',
      x: values,
      y: rows.map((row) => NODE_LABELS[row.activity] || row.activity),
      marker: { color: colors, opacity: 0.88 },
      customdata: rows.map((row) => [
        row.activity,
        row.bottleneck_score_normalized,
        row.cost_of_delay_rub,
      ]),
      hovertemplate: '<b>%{customdata[0]}</b><br>Ожидание: %{x:.2f} дн' +
        '<br>Норм. скор: %{customdata[1]:.3f}<br>Потери: %{customdata[2]:,.0f} ₽<extra></extra>',
    }], baseLayout({
      margin: { l: 180, r: 14, t: 4, b: 30 },
      xaxis: {
        gridcolor: c.grid, zeroline: false,
        title: { text: 'дней', font: { size: 10, color: c.muted } },
        tickfont: { size: 9.5, color: c.muted },
      },
      yaxis: {
        gridcolor: 'rgba(0,0,0,0)', zeroline: false,
        tickfont: { size: 9.5, color: c.text },
      },
      bargap: 0.28,
    }), { responsive: true });
  }

  // Ожидание vs. потери: точка = активность, размер = число переходов.
  // Подписываем только три крайние точки, чтобы 24 подписи не наезжали.
  function renderBottleneckScatter() {
    const node = el('bottleneck-scatter');
    if (!node || !plotlyAvailable(node)) return;
    const c = themeColors();
    const rows = data.bottlenecks.bottlenecks.slice();
    if (!rows.length) { plot(node, [], baseLayout({ showlegend: false })); return; }

    const maxTransitions = Math.max.apply(null, rows.map((row) => row.transitions || 1));
    const medianX = rows.map((row) => row.avg_days).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
    const medianY = (rows.map((row) => row.cost_of_delay_rub).sort((a, b) => a - b)[Math.floor(rows.length / 2)]);
    const byCost = rows.slice().sort((a, b) => b.cost_of_delay_rub - a.cost_of_delay_rub);
    const byScore = rows.slice().sort((a, b) => b.bottleneck_score_normalized - a.bottleneck_score_normalized);
    // Подписываем только два явных лидера: третий ярлык попадал в плотное
    // облако дешёвых активностей и наезжал на соседние подписи.
    const labelled = new Set([byCost[0] && byCost[0].activity, byScore[0] && byScore[0].activity].filter(Boolean));

    plot(node, [{
      type: 'scatter',
      mode: 'markers+text',
      x: rows.map((row) => row.avg_days),
      y: rows.map((row) => row.cost_of_delay_rub),
      text: rows.map((row) => (labelled.has(row.activity) ? (NODE_LABELS[row.activity] || row.activity) : '')),
      textposition: rows.map((row) => (
        byCost[0] && row.activity === byCost[0].activity ? 'top left' : 'top center'
      )),
      textfont: { size: 8.5, color: c.text },
      cliponaxis: false,
      marker: {
        size: rows.map((row) => 8 + 12 * Math.sqrt((row.transitions || 1) / maxTransitions)),
        color: rows.map((row) => (
          byScore[0] && row.activity === byScore[0].activity ? c.danger : c.accent
        )),
        opacity: 0.72,
        line: { color: c.surface, width: 1 },
      },
      customdata: rows.map((row) => [
        row.activity,
        row.avg_days,
        row.cost_of_delay_rub,
        row.bottleneck_score_normalized,
        row.transitions,
      ]),
      hovertemplate: '<b>%{customdata[0]}</b><br>Ожидание: %{x:.2f} дн' +
        '<br>Потери: %{y:,.0f} ₽<br>Переходов: %{marker.size}<extra></extra>',
    }], baseLayout({
      margin: { l: 48, r: 14, t: 34, b: 38 },
      shapes: [
        { type: 'line', xref: 'x', yref: 'paper', x0: medianX, x1: medianX, y0: 0, y1: 1, line: { color: c.muted, width: 1, dash: 'dot' } },
        { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: medianY, y1: medianY, line: { color: c.muted, width: 1, dash: 'dot' } },
      ],
      xaxis: {
        gridcolor: c.grid, zeroline: false,
        title: { text: 'ожидание, дней', font: { size: 9.5, color: c.muted } },
        tickfont: { size: 9, color: c.muted },
      },
      yaxis: {
        gridcolor: c.grid, zeroline: false,
        title: { text: 'потери, ₽', font: { size: 9.5, color: c.muted } },
        tickfont: { size: 9, color: c.muted },
        rangemode: 'tozero',
        range: [0, Math.max.apply(null, rows.map((row) => row.cost_of_delay_rub)) * 1.12],
      },
    }));
  }

  function renderBottleneckTable() {
    const rows = sortedBottlenecks();
    const showAll = state.bottleneckRows === 'all';
    const visible = showAll ? rows : rows.slice(0, 10);
    const analyst = state.mode === 'analyst';

    const head = '<thead><tr><th>Активность</th><th class="num">Ср. ожидание, дн</th>' +
      '<th class="num">Доля кейсов, %</th><th class="num">Потери, ₽</th></tr></thead>';

    const body = visible.map((row, index) => (
      '<tr>' +
      '<td>' + escapeHtml(NODE_LABELS[row.activity] || row.activity) + '</td>' +
      '<td class="num">' + fmtDays(row.avg_days) + '</td>' +
      '<td class="num">' + twoFmt.format(row.share_of_cases) + '</td>' +
      '<td class="num">' + fmtMoney(row.cost_of_delay_rub) + '</td>' +
      '</tr>'
    )).join('');

    el('bottleneck-table').innerHTML = head + '<tbody>' + body + '</tbody>';

    const badge = el('bottleneck-badge');
    if (badge) {
      badge.textContent = showAll
        ? ('все ' + rows.length + ' · ' + sortLabel())
        : ('топ-10 из ' + rows.length + ' · ' + sortLabel());
    }

    // «Все 24» — внутренний скролл таблицы вместо роста страницы.
    const wrap = el('bottleneck-table-wrap');
    if (wrap) wrap.classList.toggle('is-scrollable', showAll);

    initTableSorting('bottleneck-table');
  }

  function renderBottlenecks() {
    if (!data.bottlenecks) return;
    syncBottleneckSort();
    renderBottleneckNote();
    renderTop3();
    renderBottleneckChart();
    renderBottleneckScatter();
    renderBottleneckTable();
  }

  // В Executive режиме сырого скора нет — убираем опцию и сбрасываем сортировку.
  function syncBottleneckSort() {
    const select = el('bottleneck-sort');
    const rawOption = select.querySelector('option[value="raw"]');
    const executive = state.mode !== 'analyst';
    if (rawOption) {
      rawOption.disabled = executive;
      rawOption.hidden = executive;
      rawOption.textContent = executive ? 'Сырой скор (режим Analyst)' : 'Сырой скор';
    }
    if (executive && state.bottleneckSort === 'raw') state.bottleneckSort = 'normalized';
    select.value = state.bottleneckSort;
  }

  /* ============ VARIANTS ============ */

  function renderHappyPath() {
    const node = el('happy-path');
    if (!node) return;
    if (!data.variants || !Array.isArray(data.variants.variants) || !data.variants.variants.length) {
      node.innerHTML = '<div class="empty-state">Нет данных о вариантах процесса.</div>';
      return;
    }
    const top = data.variants.variants[0];
    const steps = [...new Set(top.variant.split(' → '))];
    node.innerHTML = '<div class="happy-path-summary">' +
      '<div class="happy-path-metric"><strong>' + fmtInt(top.frequency) +
      '</strong><span>кейсов</span></div>' +
      '<div class="happy-path-metric"><strong>' + fmtInt(steps.length) +
      '</strong><span>события</span></div></div>' +
      '<div class="happy-path-context">' + fmtPct(top.share_percent) +
      '% всех кейсов · ' + fmtDays(top.avg_duration_days) + ' дн в среднем</div>' +
      '<ol class="happy-path-steps" aria-label="Последовательность событий идеального маршрута">' +
      steps.map((step, index) => (
        '<li><span class="happy-path-step-number">' + (index + 1) +
        '</span><span>' + escapeHtml(ACTIVITY_LABELS_RU[step] || step) + '</span></li>'
      )).join('') + '</ol>';
  }

  function renderVariants() {
    if (!data.variants) return;
    const { total_variants: totalVariants, top10_coverage_percent: coverage, top10_cases: top10cases } = data.variants;
    const variants = Array.isArray(data.variants.variants) ? data.variants.variants : [];
    el('variants-badge').textContent = fmtInt(totalVariants) + ' вариантов · топ-10 покрывают ' +
      fmtPct(coverage) + '% кейсов (' + fmtInt(top10cases) + ')' +
      (variants.length ? ' · Идеальный маршрут: ' + fmtPct(variants[0].share_percent) + '%' : '');

    renderVariantsPareto();
    renderHappyPath();
    renderVariantsTable();
  }

  function renderCoverageChart() {
    const node = el('coverage-chart');
    if (!plotlyAvailable(node)) return;
    const c = themeColors();
    const rows = data.variants.variants;
    const coverage = data.variants.top10_coverage_percent;
    const restVariants = data.variants.total_variants - rows.length;

    let cumulative = 0;
    const xs = rows.map((row, index) => index + 1);
    const ys = rows.map((row) => {
      cumulative += row.share_percent;
      return cumulative;
    });
    // Последняя точка — не «11-й вариант», а весь остаток распределения.
    // Иначе кривая выглядела бы так, будто один вариант покрывает 11.6%.
    xs.push(rows.length + 1);
    ys.push(100);

    plot(node, [{
      type: 'scatter',
      mode: 'lines+markers',
      x: xs,
      y: ys,
      line: { color: c.accent, width: 2.5, shape: 'spline' },
      marker: { size: 7, color: c.accent, line: { color: c.surface, width: 2 } },
      fill: 'tozeroy',
      fillcolor: 'rgba(74,144,217,0.12)',
      customdata: xs.map((x) => (x === rows.length + 1
        ? 'остальные ' + restVariants + ' вариантов'
        : 'топ-' + x)),
      hovertemplate: '%{customdata}: %{y:.2f}% кейсов<extra></extra>',
    }], baseLayout({
      margin: { l: 48, r: 20, t: 8, b: 40 },
      xaxis: {
        gridcolor: 'rgba(0,0,0,0)',
        zeroline: false,
        tickvals: xs,
        ticktext: xs.map((x) => (x === rows.length + 1 ? '+' + restVariants : String(x))),
        tickfont: { color: c.muted, size: 11 },
      },
      yaxis: {
        gridcolor: c.grid, zeroline: false, range: [0, 104], ticksuffix: '%',
        tickfont: { color: c.muted, size: 11 },
      },
      shapes: [{
        type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: coverage, y1: coverage,
        line: { color: c.muted, width: 1, dash: 'dot' },
      }],
      annotations: [{
        x: rows.length, y: coverage + 5, xref: 'x', yref: 'y',
        text: 'топ-10 = ' + fmtPct(coverage) + '%',
        showarrow: false, font: { size: 11, color: c.muted }, xanchor: 'right',
      }],
    }));
  }

  // Pareto: 10 самых частых вариантов + агрегированный остаток («прочие»).
  // Столбцы — доля кейсов, линия на второй оси — накопленный процент.
  function renderVariantsPareto() {
    const node = el('variants-pareto');
    if (!plotlyAvailable(node)) return;
    const c = themeColors();
    const rows = Array.isArray(data.variants.variants) ? data.variants.variants : [];
    if (!rows.length) {
      plot(node, [], baseLayout({
        annotations: [{
          text: 'Нет данных о вариантах процесса',
          showarrow: false, x: 0.5, y: 0.5, xref: 'paper', yref: 'paper',
          font: { size: 12, color: c.muted },
        }],
      }));
      return;
    }
    const restVariants = Math.max(0, data.variants.total_variants - rows.length);
    const restShare = Math.max(0, 100 - data.variants.top10_coverage_percent);

    const labels = rows.map((row, index) => 'V' + (index + 1));
    const shares = rows.map((row) => row.share_percent);
    const hoverText = rows.map((row, index) => 'Вариант ' + (index + 1) + ' · ' +
      fmtInt(row.frequency) + ' кейсов · ' + fmtDays(row.avg_duration_days) + ' дн');

    if (restVariants > 0) {
      labels.push('прочие');
      shares.push(restShare);
      hoverText.push(restVariants + ' вариантов');
    }

    let cumulative = 0;
    const cumulativeY = shares.map((share) => {
      cumulative += share;
      return Math.min(100, cumulative);
    });

    plot(node, [
      {
        type: 'bar',
        x: labels,
        y: shares,
        name: 'доля кейсов',
        marker: {
          color: labels.map((label) => (label === 'прочие' ? c.muted : c.accent)),
          opacity: 0.85,
        },
        customdata: hoverText,
        hovertemplate: '%{customdata}<br>Доля: %{y:.1f}%<extra></extra>',
        text: shares.map((share) => twoFmt.format(share) + '%'),
        textposition: 'outside',
        textfont: { size: 8.5, color: c.text },
        cliponaxis: false,
      },
      {
        type: 'scatter',
        mode: 'lines+markers',
        x: labels,
        y: cumulativeY,
        name: 'накоплено',
        yaxis: 'y2',
        line: { color: c.danger, width: 2 },
        marker: { size: 5, color: c.danger },
        hovertemplate: 'Накоплено: %{y:.1f}%<extra></extra>',
      },
    ], baseLayout({
      margin: { l: 42, r: 48, t: 22, b: 40 },
      showlegend: false,
      xaxis: {
        gridcolor: 'rgba(0,0,0,0)', zeroline: false,
        tickfont: { size: 9.5, color: c.muted },
      },
      yaxis: {
        gridcolor: c.grid, zeroline: false,
        range: [0, Math.max.apply(null, shares) * 1.38],
        ticksuffix: '%',
        tickfont: { size: 9, color: c.muted },
        title: { text: 'доля', font: { size: 9, color: c.muted } },
      },
      yaxis2: {
        overlaying: 'y', side: 'right', range: [0, 108], ticksuffix: '%',
        showgrid: false, zeroline: false,
        tickfont: { size: 9, color: c.text },
      },
      bargap: 0.34,
    }));
  }

  function renderVariantsTable() {
    const rows = Array.isArray(data.variants.variants) ? data.variants.variants : [];
    const table = el('variants-table');
    if (!rows.length) {
      table.innerHTML = '<thead><tr><th>Вариант</th></tr></thead>' +
        '<tbody><tr><td class="muted">Нет данных о вариантах процесса.</td></tr></tbody>';
      return;
    }
    const analyst = state.mode === 'analyst';
    const maxShare = data.variants.variants[0].share_percent;
    const minAvg = Math.min.apply(null, rows.map((row) => row.avg_duration_days));

    const durations = rows.map((row) => row.avg_duration_days);
    const meanDur = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const stdDur = Math.sqrt(durations.reduce((sum, value) => sum + (value - meanDur) ** 2, 0) / durations.length) || 1;

    const head = '<thead><tr><th class="num">#</th><th>Вариант</th>' +
      '<th class="num analyst-only">Кейсов</th><th class="num">Доля</th>' +
      '<th class="num">Ср. длит., дн</th><th class="num">+ к минимуму, дн</th></tr></thead>';

    const body = rows.map((row, index) => {
      const steps = row.variant.split(' → ').map((step) => ACTIVITY_LABELS_RU[step] || step);
      const preview = steps.length > 4
        ? steps.slice(0, 2).join(' → ') + ' → … → ' + steps.slice(-2).join(' → ')
        : steps.join(' → ');
      const isOutlier = Math.abs(row.avg_duration_days - meanDur) > 1.5 * stdDur;
      return '<tr class="variant-row' + (isOutlier ? ' variant-outlier' : '') + '" data-variant="' + index + '" tabindex="0" aria-expanded="false">' +
        '<td class="num muted">' + (index + 1) + '</td>' +
        '<td><div class="variant-preview">' + escapeHtml(preview) + '</div>' +
        '<div class="variant-full">' + escapeHtml(steps.join(' → ')) + '</div>' +
        '<button type="button" class="variant-toggle" data-toggle="' + index + '">' +
        'раскрыть · ' + steps.length + ' ' + plural(steps.length, ['активность', 'активности', 'активностей']) + '</button></td>' +
        '<td class="num analyst-only">' + fmtInt(row.frequency) + '</td>' +
        '<td class="num"><span class="share-cell">' + fmtPct(row.share_percent) + '%' +
        '<span class="row-bar" style="width:' + Math.max(4, Math.round((row.share_percent / maxShare) * 48)) + 'px"></span></span></td>' +
        '<td class="num">' + fmtDays(row.avg_duration_days) + '</td>' +
        '<td class="num">' + (row.avg_duration_days - minAvg).toFixed(1) + '</td>' +
        '</tr>';
    }).join('');

    const totalRow = analyst
      ? '<tr><td></td><td><b>Итого топ-10</b></td><td class="num">' + fmtInt(data.variants.top10_cases) +
        '</td><td class="num"><b>' + fmtPct(data.variants.top10_coverage_percent) + '%</b></td><td></td><td></td></tr>'
      : '';

    table.innerHTML = head + '<tbody>' + body + totalRow + '</tbody>';

    const toggleRow = (tr) => {
      const open = tr.classList.toggle('is-open');
      tr.setAttribute('aria-expanded', open ? 'true' : 'false');
      const btn = tr.querySelector('.variant-toggle');
      if (btn) {
        const count = btn.textContent.split('·').pop().trim();
        btn.textContent = (open ? 'свернуть' : 'раскрыть') + ' · ' + count;
      }
    };

    table.querySelectorAll('.variant-row').forEach((tr) => {
      tr.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        toggleRow(tr);
      });
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleRow(tr);
        }
      });
    });

    table.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => toggleRow(btn.closest('tr')));
    });

    initTableSorting('variants-table');
  }

  /* ============ DRILLDOWN ============ */

  function openPanel(html) {
    el('drilldown-content').innerHTML = html;
    const panel = el('drilldown');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    el('drilldown-close').focus();
  }

  function closePanel() {
    const panel = el('drilldown');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function openEdgeDetails(edge) {
    if (!edge) return;
    // Частота ребра — это число переходов, а не кейсов: у Legal Review их > 1 на кейс.
    const perCase = edge.unique_cases ? edge.frequency / edge.unique_cases : 0;
    const outgoing = currentEdges()
      .filter((item) => item.activity === edge.next_activity)
      .sort((a, b) => b.frequency - a.frequency)[0];
    const backward = data.processMap.nodes_metadata[edge.next_activity].avg_position <
      data.processMap.nodes_metadata[edge.activity].avg_position;

    openPanel(
      '<h3>' + escapeHtml(ACTIVITY_LABELS_RU[edge.activity] || edge.activity) + ' → ' +
      escapeHtml(ACTIVITY_LABELS_RU[edge.next_activity] || edge.next_activity) + '</h3>' +
      '<p class="drilldown-sub">Переход в графе процесса' + (backward ? ' · возврат' : '') +
      (state.processCategory ? ' · категория: ' + escapeHtml(state.processCategory) : '') + '</p>' +
      '<ul class="detail-list">' +
      '<li><span class="detail-label">Переходов</span><span class="detail-value">' + fmtInt(edge.frequency) + '</span></li>' +
      '<li><span class="detail-label">Уникальных кейсов</span><span class="detail-value">' + fmtInt(edge.unique_cases) + '</span></li>' +
      '<li><span class="detail-label">Переходов на кейс</span><span class="detail-value">' + twoFmt.format(perCase) + '</span></li>' +
      '<li><span class="detail-label">Средняя длительность</span><span class="detail-value">' + fmtEdgeDays(edge.avg_duration_days) + ' дн</span></li>' +
      '<li><span class="detail-label">Медиана</span><span class="detail-value">' + fmtEdgeDays(edge.median_duration_days) + ' дн</span></li>' +
      '<li><span class="detail-label">P90</span><span class="detail-value">' + fmtEdgeDays(edge.p90_duration_days) + ' дн</span></li>' +
      '<li><span class="detail-label">Следующий шаг</span><span class="detail-value">' +
      (outgoing ? escapeHtml(outgoing.next_activity) + ' · ' + fmtInt(outgoing.frequency) : '—') + '</span></li>' +
      '</ul>' +
      '<div class="drilldown-note">Значение «переходов на кейс» больше 1 означает, что переход встречается в кейсе повторно. В JSON нет case-level данных, поэтому список конкретных кейсов появится на втором этапе.</div>' +
      '<div class="drilldown-actions"><button type="button" class="btn btn-sm" id="drilldown-copy">Скопировать как текст</button></div>' +
      '<div class="sr-only" id="copy-status"></div>'
    );

    const copy = el('drilldown-copy');
    if (copy) {
      copy.addEventListener('click', () => {
        const text = edge.activity + ' → ' + edge.next_activity + ': ' + fmtInt(edge.frequency) +
          ' переходов, ' + fmtInt(edge.unique_cases) + ' уникальных кейсов, медиана ' +
          fmtEdgeDays(edge.median_duration_days) + ' дн';
        const done = () => {
          copy.textContent = 'Скопировано';
          setTimeout(() => { copy.textContent = 'Скопировать как текст'; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {});
        }
      });
    }
  }

  function openNodeDetails(name) {
    if (!name) return;
    const meta = data.processMap.nodes_metadata[name];
    if (!meta) return;
    const incoming = currentEdges().filter((edge) => edge.next_activity === name);
    const outgoing = currentEdges().filter((edge) => edge.activity === name);
    const cases = nodeCases(name);

    openPanel(
      '<h3>' + escapeHtml(ACTIVITY_LABELS_RU[name] || name) + '</h3>' +
      '<p class="drilldown-sub">Активность · ' + ({ start: 'старт', end: 'конец', bottleneck: 'узкое место', normal: 'обычная' }[meta.type] || 'обычная') +
      (state.processCategory ? ' · категория: ' + escapeHtml(state.processCategory) : '') + '</p>' +
      '<ul class="detail-list">' +
      '<li><span class="detail-label">Кейсов с активностью</span><span class="detail-value">' +
      (cases == null ? '—' : fmtInt(cases)) + '</span></li>' +
      '<li><span class="detail-label">Среднее ожидание</span><span class="detail-value">' + (meta.avg_days != null ? fmtDays(meta.avg_days) + ' дн' : '—') + '</span></li>' +
      '<li><span class="detail-label">Норм. скор</span><span class="detail-value">' +
      (meta.bottleneck_score_normalized != null ? twoFmt.format(meta.bottleneck_score_normalized) : '—') + '</span></li>' +
      '<li><span class="detail-label">Средняя позиция в кейсе</span><span class="detail-value">' + fmtDays(meta.avg_position) + '</span></li>' +
      '<li><span class="detail-label">Входящих переходов</span><span class="detail-value">' + incoming.length + '</span></li>' +
      '<li><span class="detail-label">Исходящих переходов</span><span class="detail-value">' + outgoing.length + '</span></li>' +
      '</ul>' +
      '<div class="drilldown-note">Ожидание и норм. скор посчитаны по всему логу — в JSON нет разбивки по категориям. Число кейсов — по выбранному срезу.</div>'
    );
  }

  /* ============ ИНИЦИАЛИЗАЦИЯ ============ */

  /* ============ СОРТИРОВКА ТАБЛИЦ ============ */

  const tableSortState = {};

  function getSortKey(td) {
    const text = (td.innerText || td.textContent || '').replace(/\s|\u00a0/g, '');
    const match = text.match(/[-+]?\d+(?:[,.]\d+)?/);
    if (!match) return NaN;
    let value = Number(match[0].replace(',', '.'));
    if (text.includes('млрд')) value *= 1e9;
    else if (text.includes('млн')) value *= 1e6;
    else if (text.includes('тыс')) value *= 1e3;
    return value;
  }

  function initTableSorting(tableId) {
    const table = el(tableId);
    if (!table) return;

    let sortState = tableSortState[tableId];
    if (!sortState) {
      sortState = { column: null, direction: 1 };
      tableSortState[tableId] = sortState;
    }

    const thead = table.querySelector('thead');
    if (!thead) return;

    // Event delegation: single handler on thead for all th elements
    thead.addEventListener('click', (event) => {
      const th = event.target.closest('th');
      if (!th) return;

      // Get column index among the first row's cells
      const firstRow = thead.querySelector('tr');
      if (!firstRow) return;
      const cells = firstRow.children;
      let colIndex = 0;
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] === th) {
          colIndex = i;
          break;
        }
      }

      // Toggle direction if same column, otherwise start desc
      if (sortState.column === colIndex) {
        sortState.direction *= -1;
      } else {
        sortState.column = colIndex;
        sortState.direction = 1;
      }

      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      const isAsc = sortState.direction === 1;

      // Get all rows and sort
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const aCells = a.querySelectorAll('td');
        const bCells = b.querySelectorAll('td');
        if (colIndex >= aCells.length || colIndex >= bCells.length) return 0;

        const aKey = getSortKey(aCells[colIndex]);
        const bKey = getSortKey(bCells[colIndex]);

        if (Number.isNaN(aKey) && Number.isNaN(bKey)) {
          return String(aCells[colIndex].innerText).localeCompare(String(bCells[colIndex].innerText));
        }
        if (Number.isNaN(aKey)) return 1;
        if (Number.isNaN(bKey)) return -1;

        const diff = (aKey - bKey) * (isAsc ? 1 : -1);
        return diff !== 0 ? diff : String(aCells[colIndex].innerText).localeCompare(String(bCells[colIndex].innerText));
      });

      // Reappend sorted rows
      const fragment = document.createDocumentFragment();
      rows.forEach((row) => fragment.appendChild(row));
      tbody.innerHTML = '';
      tbody.appendChild(fragment);

      // Update sort arrows: remove existing, add new one to clicked header
      const existingArrows = thead.querySelectorAll('.sort-arrow');
      existingArrows.forEach((a) => a.remove());

      // Remove sorted classes from all header cells
      const headerCells = thead.querySelectorAll('th');
      headerCells.forEach((cell) => {
        cell.classList.remove('sorted-asc', 'sorted-desc');
      });

      const newTh = thead.querySelector('tr').children[colIndex];
      if (newTh) {
        const arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.textContent = isAsc ? '▲' : '▼';
        newTh.appendChild(arrow);
        // Add sorted class for visual highlighting
        newTh.classList.add('sorted-' + (isAsc ? 'asc' : 'desc'));
      }
    });
  }

  function wireHeader() {
    // Только кнопки режима: applyMode ставит data-mode на <html>, и селектор
    // [data-mode] поймал бы сам документ — тогда любой клик перерисовывал вкладку.
    document.querySelectorAll('.segmented-btn[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => applyMode(btn.dataset.mode));
    });
    el('theme-toggle').addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }

  function wireTabs() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
      btn.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const tabs = Array.from(document.querySelectorAll('.tab'));
        const index = tabs.indexOf(btn);
        const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        activateTab(next.dataset.tab);
      });
    });
  }

  function wireProcessToolbar() {
    document.querySelectorAll('[data-edges]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.edgeLimit = btn.dataset.edges === 'all' ? 'all' : 10;
        document.querySelectorAll('[data-edges]').forEach((item) => {
          const active = item === btn;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        renderProcessMap();
      });
    });

    document.querySelectorAll('[data-map-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.mapMode;
        state.mapMode = m === 'single' ? 'single' : (m === 'range' ? 'range' : 'dfg');
        document.querySelectorAll('[data-map-mode]').forEach((item) => {
          const active = item === btn;
          item.classList.toggle('is-active', active);
          if (item.hasAttribute('aria-pressed')) {
            item.setAttribute('aria-pressed', active ? 'true' : 'false');
          }
        });
        const singleWrap = el('map-variant-single');
        if (singleWrap) {
          singleWrap.hidden = state.mapMode !== 'single';
        }
        const rangeWrap = el('map-variant-range');
        if (rangeWrap) {
          rangeWrap.hidden = state.mapMode !== 'range';
        }
        const modeCaption = el('map-mode-caption');
        if (modeCaption) {
          if (state.mapMode === 'single') {
            const rank = state.mapVariantRank || 1;
            const variant = currentVariantByRank(rank);
            const pct = variant ? variant.share_percent : null;
            modeCaption.textContent = pct != null ? 'Один вариант, Топ-' + rank + ' (' + pct.toFixed(2) + '%)' : 'Один вариант, Топ-' + rank;
          } else if (state.mapMode === 'range') {
            const from = state.mapRangeFrom || 1;
            const to = state.mapRangeTo || from;
            const totalAvail = data.variantPaths && Array.isArray(data.variantPaths.variants)
              ? data.variantPaths.variants.length : 80;
            if (to > totalAvail) {
              modeCaption.textContent = 'Диапазон вариантов, показано ' + totalAvail + ' из ' + totalAvail;
            } else {
              modeCaption.textContent = 'Диапазон вариантов, Топ-' + from + '–Топ-' + to;
            }
          } else {
            modeCaption.textContent = 'DFG, все переходы';
          }
        }
        renderProcessMap();
      });
    });

    const variantSelect = el('map-variant-select');
    if (variantSelect) {
      variantSelect.addEventListener('change', () => {
        const val = Number(variantSelect.value);
        state.mapVariantRank = isNaN(val) ? 1 : val;
        const modeCaption = el('map-mode-caption');
        if (modeCaption && state.mapMode === 'single') {
          const variant = currentVariantByRank(state.mapVariantRank);
          const pct = variant ? variant.share_percent : null;
          modeCaption.textContent = pct != null ? 'Один вариант, Топ-' + state.mapVariantRank + ' (' + pct.toFixed(2) + '%)' : 'Один вариант, Топ-' + state.mapVariantRank;
        }
        renderProcessMap();
      });
    }

    const rangeFrom = el('map-range-from');
    const rangeTo = el('map-range-to');
    if (rangeFrom) {
      rangeFrom.addEventListener('change', () => {
        let v = Number(rangeFrom.value);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 80) v = 80;
        state.mapRangeFrom = v;
        if (state.mapRangeTo < state.mapRangeFrom) {
          state.mapRangeTo = state.mapRangeFrom;
          if (rangeTo) rangeTo.value = String(state.mapRangeTo);
        }
        const modeCaption = el('map-mode-caption');
        if (modeCaption && state.mapMode === 'range') {
          const totalAvail = data.variantPaths && Array.isArray(data.variantPaths.variants) ? data.variantPaths.variants.length : 80;
          if (state.mapRangeTo > totalAvail) {
            modeCaption.textContent = 'Диапазон вариантов, показано ' + totalAvail + ' из ' + totalAvail;
          } else {
            modeCaption.textContent = 'Диапазон вариантов, Топ-' + state.mapRangeFrom + '–Топ-' + state.mapRangeTo;
          }
        }
        renderProcessMap();
      });
    }
    if (rangeTo) {
      rangeTo.addEventListener('change', () => {
        let v = Number(rangeTo.value);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 80) v = 80;
        state.mapRangeTo = v;
        if (state.mapRangeFrom > state.mapRangeTo) {
          state.mapRangeFrom = state.mapRangeTo;
          if (rangeFrom) rangeFrom.value = String(state.mapRangeFrom);
        }
        const modeCaption = el('map-mode-caption');
        if (modeCaption && state.mapMode === 'range') {
          const totalAvail = data.variantPaths && Array.isArray(data.variantPaths.variants) ? data.variantPaths.variants.length : 80;
          if (state.mapRangeTo > totalAvail) {
            modeCaption.textContent = 'Диапазон вариантов, показано ' + totalAvail + ' из ' + totalAvail;
          } else {
            modeCaption.textContent = 'Диапазон вариантов, Топ-' + state.mapRangeFrom + '–Топ-' + state.mapRangeTo;
          }
        }
        renderProcessMap();
      });
    }

    const stepFrom = el('map-step-from');
    const stepTo = el('map-step-to');
    if (stepFrom) {
      stepFrom.addEventListener('change', () => {
        let v = Number(stepFrom.value);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 22) v = 22;
        state.mapStepFrom = v;
        if (state.mapStepTo < state.mapStepFrom) {
          state.mapStepTo = state.mapStepFrom;
          if (stepTo) stepTo.value = String(state.mapStepTo);
        }
        renderProcessMap();
      });
    }
    if (stepTo) {
      stepTo.addEventListener('change', () => {
        let v = Number(stepTo.value);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 22) v = 22;
        state.mapStepTo = v;
        if (state.mapStepFrom > state.mapStepTo) {
          state.mapStepFrom = state.mapStepTo;
          if (stepFrom) stepFrom.value = String(state.mapStepFrom);
        }
        renderProcessMap();
      });
    }

    const metricSelect = el('edge-stats-metric');
    if (metricSelect) {
      metricSelect.addEventListener('change', () => {
        state.edgeStatsMetric = metricSelect.value;
        if (data.processMap) renderEdgeStats(data.processMap, state.edgeStatsMetric);
      });
    }

    const pager = el('edge-stats-pager');
    if (pager) {
      pager.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-page]');
        if (!btn || btn.disabled || !data.processMap) return;
        state.edgeStatsPage = Math.max(0, (state.edgeStatsPage || 0) + (btn.dataset.page === 'next' ? 1 : -1));
        renderEdgeStats(data.processMap, state.edgeStatsMetric);
      });
    }
  }

  function wireBottleneckToolbar() {
    el('bottleneck-sort').addEventListener('change', (event) => {
      state.bottleneckSort = event.target.value;
      renderBottlenecks();
    });
    document.querySelectorAll('[data-rows]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.bottleneckRows = btn.dataset.rows === 'all' ? 'all' : 10;
        document.querySelectorAll('[data-rows]').forEach((item) => {
          const active = item === btn;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        renderBottlenecks();
      });
    });
  }

  function wireDrilldown() {
    el('drilldown-close').addEventListener('click', closePanel);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePanel();
    });
  }

  async function init() {
    applyTheme(state.theme);
    applyMode(state.mode);
    wireHeader();
    wireTabs();
    wireProcessToolbar();
    wireDfgToolbar();
    wireBottleneckToolbar();
    wireDrilldown();

    try {
      await loadData();
    } catch (error) {
      showLoadError(error);
      return;
    }

    el('header-subtitle').textContent = 'Синтетический лог · ' + fmtInt(data.overview.total_cases) +
      ' кейсов · ' + fmtInt(data.overview.total_events) + ' событий · ' + data.overview.monthly.length + ' месяцев';
    populateFilters();
    renderProcessCategories();
    populateVariantSelect();
    const rf = el('map-range-from');
    const rt = el('map-range-to');
    if (rf) rf.value = String(state.mapRangeFrom || 1);
    if (rt) rt.value = String(state.mapRangeTo || 15);
    const sf = el('map-step-from');
    const stv = el('map-step-to');
    if (sf) sf.value = String(state.mapStepFrom || 1);
    if (stv) stv.value = String(state.mapStepTo || 22);

    activateTab(state.tab);
  }

  // Resizer for DFG panel
  (function() {
    const resizer = document.getElementById('dfg-resizer');
    const leftPanel = document.querySelector('.dfg-left-panel');
    const container = document.querySelector('.process-map-layout');
    if (!resizer || !leftPanel || !container) return;
    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const containerRect = container.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const percent = (newWidth / containerRect.width) * 100;
      if (percent > 20 && percent < 60) {
        leftPanel.style.width = percent + '%';
      }
    });
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try { if (window.cy) window.cy.resize(); } catch (e) {}
        try { if (window.Plotly && window.scatterPlot) Plotly.Plots.resize(window.scatterPlot); } catch (e) {}
      }
    });
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
