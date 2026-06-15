import urllib.request
import json
import websocket
import time

# Get remote debugging targets
try:
    print("Fetching Chrome targets...")
    res = urllib.request.urlopen("http://localhost:9222/json")
    targets = json.loads(res.read().decode('utf-8'))
    page_target = None
    for t in targets:
        if t.get('type') == 'page':
            page_target = t
            break
    if not page_target:
        raise Exception("No page target found!")
    
    ws_url = page_target['webSocketDebuggerUrl']
    print(f"Connecting to page WebSocket: {ws_url}")
    ws = websocket.create_connection(ws_url)
    
    # Enable Page and Runtime domains
    ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
    ws.recv()
    ws.send(json.dumps({"id": 2, "method": "Runtime.enable"}))
    ws.recv()
    
    # Navigate to http://localhost:8080
    print("Navigating to http://localhost:8080...")
    ws.send(json.dumps({
        "id": 3,
        "method": "Page.navigate",
        "params": {"url": "http://localhost:8080"}
    }))
    ws.recv()
    
    # Wait for page to load
    print("Waiting for page load...")
    time.sleep(3.0)
    
    # Helper to run JS
    def eval_js(expr):
        ws.send(json.dumps({
            "id": 4,
            "method": "Runtime.evaluate",
            "params": {"expression": expr, "returnByValue": True}
        }))
        res_data = json.loads(ws.recv())
        # Drain other potential async events until we get id: 4
        while res_data.get('id') != 4:
            res_data = json.loads(ws.recv())
        result = res_data.get('result', {})
        if 'exceptionDetails' in result:
            return f"Exception: {result['exceptionDetails']}"
        return result.get('result', {}).get('value')
    
    # Let's inspect some values
    title = eval_js("document.title")
    print(f"Page Title: {title}")
    
    webapp_url = eval_js("settingsEngine.getWebAppUrl()")
    print(f"settingsEngine.getWebAppUrl(): {webapp_url}")
    
    is_configured = eval_js("sheetsService.isConfigured()")
    print(f"sheetsService.isConfigured(): {is_configured}")
    
    is_signed_in = eval_js("sheetsService.isSignedIn")
    print(f"sheetsService.isSignedIn: {is_signed_in}")
    
    settings_raw = eval_js("localStorage.getItem('gos_settings_v3')")
    if settings_raw:
        settings = json.loads(settings_raw)
        print("localStorage 'gos_settings_v3' keys:", list(settings.keys()))
        print("localStorage WebApp URL:", settings.get('sheets', {}).get('webAppUrl'))
        print("localStorage tabMappings:", settings.get('sheets', {}).get('tabMappings'))
    else:
        print("localStorage 'gos_settings_v3' is empty or null.")
        
    v2_raw = eval_js("localStorage.getItem('gos_settings_v2')")
    if v2_raw:
        print("localStorage 'gos_settings_v2' is present.")
    else:
        print("localStorage 'gos_settings_v2' is empty or null.")

    ws.close()
except Exception as e:
    print("Error:", e)
