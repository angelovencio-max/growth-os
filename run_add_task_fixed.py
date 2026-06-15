import urllib.request
import json
import websocket

res = urllib.request.urlopen("http://localhost:9222/json")
targets = json.loads(res.read().decode('utf-8'))
page_target = None
for t in targets:
    if t.get('type') == 'page':
        page_target = t
        break

ws_url = page_target['webSocketDebuggerUrl']
ws = websocket.create_connection(ws_url)

ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
ws.recv()

js_code = """
(async () => {
  try {
    app._addRecordTarget = 'tasks';
    let form = document.getElementById('add-form');
    if (!form) {
      form = document.createElement('form');
      form.id = 'add-form';
      document.body.appendChild(form);
    }
    form.innerHTML = `
      <input name="title" value="Headless Browser Task Test Fixed">
      <input name="priority" value="High">
      <input name="dueAt" value="2026-06-16">
      <input name="dueTime" value="10:00">
      <input name="startDate" value="2026-06-15">
      <input name="startTime" value="09:00">
      <textarea name="notes">Fixed headless test task</textarea>
    `;
    
    let fetchCalled = false;
    let fetchArgs = null;
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      fetchCalled = true;
      fetchArgs = args;
      console.log("SPY FETCH CALLED:", args[0]);
      try {
        const res = await origFetch(...args);
        console.log("SPY FETCH SUCCESS:", res.status);
        return res;
      } catch (err) {
        console.error("SPY FETCH ERROR:", err);
        throw err;
      }
    };

    console.log("Calling handleAddRecord...");
    app.handleAddRecord();
    
    // Wait for fetch to complete
    await new Promise(r => setTimeout(r, 2000));
    
    window.fetch = origFetch;
    
    return {
      success: true,
      fetchCalled: fetchCalled,
      fetchArgs: fetchArgs ? { url: fetchArgs[0], method: fetchArgs[1].method, body: fetchArgs[1].body } : null,
      tasksCount: app.data.tasks.length,
      lastTask: app.data.tasks[app.data.tasks.length - 1]
    };
  } catch (err) {
    return { success: false, error: err.message || String(err), stack: err.stack };
  }
})()
"""

ws.send(json.dumps({
    "id": 2,
    "method": "Runtime.evaluate",
    "params": {
        "expression": js_code,
        "awaitPromise": True,
        "returnByValue": True
    }
}))

res_data = json.loads(ws.recv())
while res_data.get('id') != 2:
    res_data = json.loads(ws.recv())

print("Result:")
print(json.dumps(res_data.get('result', {}).get('result', {}).get('value'), indent=2))

ws.close()
