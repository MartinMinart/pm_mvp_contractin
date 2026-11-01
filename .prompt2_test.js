/* Временный smoke-тест DFG и таблицы в jsdom. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(process.env.JSDOM_PATH);

const ROOT = process.cwd();
const html = fs.readFileSync(path.join(ROOT, 'site/index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'site/assets/app.js'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost/site/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const errors = [];
window.addEventListener('error', (event) => errors.push(event.error || event.message));
window.HTMLElement.prototype.on = function on(event, handler) {
  this.__handlers = this.__handlers || {};
  this.__handlers[event] = handler;
};

const captures = [];
window.Plotly = {
  react(node, traces, layout, config) {
    captures.push({ node, traces, layout, config });
  },
};

const dataDir = path.join(ROOT, 'site');
window.fetch = async (url) => {
  const clean = String(url).replace(/^\.?\//, '');
  const file = path.join(dataDir, clean);
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(fs.readFileSync(file, 'utf8')),
  };
};

window.eval(app);
Object.defineProperty(window.document.getElementById('process-chart'), 'clientWidth', {
  value: 900,
  configurable: true,
});
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

const waitFor = async (fn, label) => {
  for (let i = 0; i < 100; i += 1) {
    if (fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('timeout: ' + label);
};

(async () => {
  await waitFor(() => window.document.querySelectorAll('#kpi-grid .kpi-group').length === 3, 'kpi');
  const processTab = window.document.querySelector('[data-tab="process"]');
  processTab.click();
  await waitFor(() => window.document.querySelectorAll('#edge-stats-table tbody tr').length > 0, 'edge table');

  const table = window.document.querySelector('#edge-stats-table');
  const rows = table.querySelectorAll('tbody tr');
  const headers = table.querySelectorAll('thead th');
  const selectedBefore = table.querySelectorAll('.metric-active');
  const processCapture = captures[captures.length - 1];
  const edgeTraces = processCapture.traces.filter((trace) => trace.mode === 'lines');
  const labelTraces = processCapture.traces.filter((trace) => trace.mode === 'text');
  const oldMarkers = processCapture.traces.filter((trace) => trace.mode === 'markers' && trace.marker && trace.marker.opacity === 0.01);

  console.log(JSON.stringify({
    kpiGroups: window.document.querySelectorAll('#kpi-grid .kpi-group').length,
    edgeRows: rows.length,
    headers: [...headers].map((h) => h.textContent),
    selectedBefore: selectedBefore.length,
    edgeTraces: edgeTraces.length,
    labelTraces: labelTraces.length,
    oldInvisibleMarkers: oldMarkers.length,
    firstEdge: {
      mode: edgeTraces[0].mode,
      meta: edgeTraces[0].meta,
      customdata: edgeTraces[0].customdata[0],
      hasHoverTemplate: /Уникальных кейсов/.test(edgeTraces[0].hovertemplate),
      label: labelTraces[0].text[0],
    },
  }, null, 2));

  const metric = window.document.querySelector('#edge-stats-metric');
  metric.value = 'p90_duration_days';
  metric.dispatchEvent(new window.Event('change', { bubbles: true }));
  const selectedAfter = table.querySelectorAll('.metric-active');
  console.log('selectedAfterP90', selectedAfter.length,
    [...selectedAfter].map((cell) => cell.textContent.trim()));

  const handler = window.document.querySelector('#process-chart').__handlers.plotly_click;
  handler({ points: [{ data: edgeTraces[0] }] });
  const panel = window.document.querySelector('#drilldown');
  console.log('drilldownOpen', panel.classList.contains('open'),
    'title', panel.querySelector('h3') && panel.querySelector('h3').textContent);
  console.log('details', [...panel.querySelectorAll('.detail-label')].map((x) => x.textContent));
  console.log('ERRORS', errors.length, errors);
  if (errors.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
