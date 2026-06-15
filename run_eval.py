import urllib.request
import json
import websocket
import time

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

# Define the JS code to evaluate
js_code = """
(async () => {
  try {
    console.log("Triggering connectSheets...");
    await app.connectSheets();
    return { success: true, connected: app.sheetsConnected, syncStatus: app.syncStatus, syncError: app.syncError };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
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

# Wait and receive response
res_data = json.loads(ws.recv())
while res_data.get('id') != 2:
    res_data = json.loads(ws.recv())

print("Result:")
print(json.dumps(res_data.get('result', {}).get('result', {}).get('value'), indent=2))

ws.close()
