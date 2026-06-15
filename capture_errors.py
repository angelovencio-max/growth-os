import urllib.request
import json
import websocket
import time
import threading

# Get remote debugging targets
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

# Keep track of events
console_messages = []
exceptions = []
network_requests = {}
network_responses = {}

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
                exceptions.append(f"Exception: {details.get('text')} at line {details.get('lineNumber')}")
            elif method == 'Network.requestWillBeSent':
                req_id = params.get('requestId')
                req = params.get('request', {})
                network_requests[req_id] = {
                    'url': req.get('url'),
                    'method': req.get('method'),
                    'payload': req.get('postData', '')
                }
            elif method == 'Network.responseReceived':
                req_id = params.get('requestId')
                resp = params.get('response', {})
                network_responses[req_id] = {
                    'status': resp.get('status'),
                    'statusText': resp.get('statusText'),
                    'headers': resp.get('headers')
                }
            elif method == 'Network.loadingFailed':
                req_id = params.get('requestId')
                err_text = params.get('errorText')
                if req_id in network_requests:
                    network_requests[req_id]['error'] = err_text
    except Exception as e:
        pass

# Start background listener thread
t = threading.Thread(target=listener, daemon=True)
t.start()

# Enable domains
ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
ws.send(json.dumps({"id": 2, "method": "Network.enable"}))
ws.send(json.dumps({"id": 3, "method": "Page.enable"}))

# Reload page
print("Reloading page to capture network & logs...")
ws.send(json.dumps({"id": 4, "method": "Page.reload"}))

# Wait for page to load and execute connection
time.sleep(5.0)

print("\n--- CONSOLE LOGS ---")
for msg in console_messages:
    print(msg)

print("\n--- EXCEPTIONS ---")
for exc in exceptions:
    print(exc)

print("\n--- NETWORK REQUESTS ---")
for req_id, req in network_requests.items():
    url = req['url']
    if 'script.google.com' in url:
        resp = network_responses.get(req_id, {})
        print(f"URL: {url}")
        print(f"Method: {req['method']}")
        print(f"Payload: {req['payload']}")
        print(f"Status: {resp.get('status')} {resp.get('statusText')}")
        if 'error' in req:
            print(f"Error: {req['error']}")
        print("---")

ws.close()
