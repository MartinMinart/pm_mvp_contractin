/* Временная проверка консоли через Chrome DevTools Protocol. */
(async () => {
  const targets = await (await fetch('http://127.0.0.1:9224/json')).json();
  const page = targets.find((target) => target.url.includes('8767'));
  if (!page) throw new Error('page target not found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const issues = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      issues.push('exception: ' + (message.params.exceptionDetails.text || 'unknown'));
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      issues.push('console.error: ' + message.params.args.map((arg) => arg.value || arg.description).join(' '));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      issues.push('log: ' + message.params.entry.text);
    }
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

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const state = await send('Runtime.evaluate', {
    expression: `({
      activeTab: document.querySelector('.tab.is-active') && document.querySelector('.tab.is-active').dataset.tab,
      rows: document.querySelectorAll('#edge-stats-table tbody tr').length,
      drilldown: document.getElementById('drilldown').classList.contains('open')
    })`,
    returnByValue: true,
  });
  console.log('STATE', state.result.value);
  console.log('ISSUES', issues.length, issues);
  if (issues.length) process.exitCode = 1;
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
