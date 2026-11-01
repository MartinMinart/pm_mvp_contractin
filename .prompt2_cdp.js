/* Временная проверка hover через Chrome DevTools Protocol. */
const fs = require('fs');
const path = require('path');

const base = 'http://127.0.0.1:9224';
const out = path.join(process.env.TEMP, 'pm_prompt2_shot', 'hover.png');

(async () => {
  const targets = await (await fetch(base + '/json')).json();
  const page = targets.find((target) => target.url.includes('8767'));
  if (!page) throw new Error('page target not found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };

  await send('Page.enable');
  const state = await evaluate(`({
    activeTab: document.querySelector('.tab.is-active') && document.querySelector('.tab.is-active').dataset.tab,
    rows: document.querySelectorAll('#edge-stats-table tbody tr').length,
    plotly: typeof Plotly !== 'undefined',
    graph: !!document.getElementById('process-chart')._fullData
  })`);
  console.log('STATE', state);

  const info = await evaluate(`(() => {
    const gd = document.getElementById('process-chart');
    const index = gd._fullData.findIndex((trace) => trace.mode === 'lines' && trace.meta && trace.customdata);
    return {
      index,
      meta: gd._fullData[index] && gd._fullData[index].meta,
      points: gd._fullData[index] && gd._fullData[index].x.length,
      customdata: gd._fullData[index] && gd._fullData[index].customdata[4],
      hovertemplate: gd._fullData[index] && gd._fullData[index].hovertemplate,
    };
  })()`);
  console.log('EDGE', info);

  await evaluate(`(() => {
    const gd = document.getElementById('process-chart');
    const index = gd._fullData.findIndex((trace) => trace.mode === 'lines' && trace.meta && trace.customdata);
    Plotly.Fx.hover(gd, [{ curveNumber: index, pointNumber: 4 }]);
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('SHOT', out, fs.statSync(out).size);

  const panel = await evaluate(`(() => {
    const gd = document.getElementById('process-chart');
    const index = gd._fullData.findIndex((trace) => trace.mode === 'lines' && trace.meta && trace.customdata);
    const trace = gd._fullData[index];
    gd.emit('plotly_click', { points: [{ data: trace, curveNumber: index, pointNumber: 4 }] });
    return {
      open: document.getElementById('drilldown').classList.contains('open'),
      title: document.querySelector('#drilldown h3') && document.querySelector('#drilldown h3').textContent,
      details: [...document.querySelectorAll('#drilldown .detail-label')].map((node) => node.textContent)
    };
  })()`);
  console.log('CLICK', panel);
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
