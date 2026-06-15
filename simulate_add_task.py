import urllib.request
import json
import websocket
import time
import threading

# Get page target
res = urllib.request.urlopen("http://localhost:9222/json")
targets = json.loads(res.read().decode('utf-8'))
page_target = None
for t in targets:
    if t.get('type') == 'page':
        page_target = t
        break

ws_url = page_target['webSocketDebuggerUrl']
print(f"Connecting to: {ws_url}")
ws = websocket.create_connection(ws_url)

network_requests = {}
network_responses = {}
console_messages = []

def listener():
    try:
        while True:
            msg = json.loads(ws.recv())
            method = msg.get('method')
            params = msg.get('params', {})
            
            if method == 'Runtime.consoleAPICalled':
                args = params.get('args', [])
                text = " ".join([str(arg.get('value', '')) for arg in args])
                console_messages.append(f"[{params.get('type')}] {text}")
            elif method == 'Runtime.exceptionThrown':
                details = params.get('exceptionDetails', {})
                console_messages.append(f"[Exception] {details.get('text')}")
            elif method == 'Network.requestWillBeSent':
                req_id = params.get('requestId')
                req = params.get('request', {})
                network_requests[req_id] = {
                    'url': req.get('url'),
                    'method': req.get('method'),
                    'payload': req.get('postData', ''),
                    'headers': req.get('headers', {})
                }
            elif method == 'Network.responseReceived':
                req_id = params.get('requestId')
                resp = params.get('response', {})
                network_responses[req_id] = {
                    'status': resp.get('status'),
                    'statusText': resp.get('statusText'),
                    'headers': resp.get('headers', {})
                }
            elif method == 'Network.loadingFailed':
                req_id = params.get('requestId')
                err_text = params.get('errorText', '')
                if req_id in network_requests:
                    network_requests[req_id]['error'] = err_text
    except Exception as e:
        pass

t = threading.Thread(target=listener, daemon=True)
t.start()

ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
ws.send(json.dumps({"id": 2, "method": "Network.enable"}))
ws.send(json.dumps({"id": 3, "method": "Page.enable"}))

# Navigate
ws.send(json.dumps({"id": 4, "method": "Page.navigate", "params": {"url": "http://localhost:8080"}}))
time.sleep(3.0)

# Connect sheets (ensure connected)
print("Ensuring sheet is connected...")
ws.send(json.dumps({
    "id": 5,
    "method": "Runtime.evaluate",
    "params": {
        "expression": "app.connectSheets()",
        "awaitPromise": True
    }
}))
time.sleep(2.0)

# Trigger add task
print("Triggering handleAddRecord on tasks...")
add_js = """
(() => {
  app._addRecordTarget = 'tasks';
  let form = document.getElementById('add-form');
  if (!form) {
    form = document.createElement('form');
    form.id = 'add-form';
    document.body.appendChild(form);
  }
  form.innerHTML = `
    <input name="title" value="Headless Browser Task Test">
    <input name="priority" value="High">
    <input name="dueAt" value="2026-06-16">
    <input name="dueTime" value="10:00">
    <input name="startDate" value="2026-06-15">
    <input name="startTime" value="09:00">
    <textarea name="notes">This is a headless browser test task</textarea>
  `;
  app.handleAddRecord();
  return "Triggered";
})()
"""
ws.send(json.dumps({
    "id": 6,
    "method": "Runtime.evaluate",
    "params": {
        "expression": add_js,
        "returnByValue": True
    }
}))
time.sleep(5.0)

print("\n--- CONSOLE LOGS ---")
for msg in console_messages:
    print(msg)

print("\n--- NETWORK REQUESTS ---")
for req_id, req in network_requests.items():
    url = req['url']
    if 'script.google.com' in url or 'localhost:8080' not in url:
        resp = network_responses.get(req_id, {})
        print(f"URL: {url}")
        print(f"Method: {req['method']}")
        print(f"Headers: {json.dumps(req['headers'], indent=2)}")
        print(f"Payload: {req['payload']}")
        print(f"Status: {resp.get('status')} {resp.get('statusText')}")
        if 'error' in req:
            print(f"Error: {req['error']}")
        print("---")

ws.close()
