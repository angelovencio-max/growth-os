import urllib.request
import json

url = 'https://script.google.com/macros/s/AKfycbwLCatU2GdBLNurcwfqmuGpbrqRUF97ffXoZErUe74GY_qSWvc2gAYlUgZUsnhz3Jo/exec'

# Old script format test payload
payload = {
  "action": "append",
  "tab": "Tasks",
  "data": {
    "task_id": "TEST-002",
    "title": "Google Sheets Sync Test 2",
    "status": "To Do",
    "due_at": "2026-06-15"
  }
}

data_str = json.dumps(payload).encode('utf-8')

try:
    print("Sending POST request to Apps Script (old format)...")
    req = urllib.request.Request(
        url,
        data=data_str,
        headers={
            'Content-Type': 'text/plain',
            'User-Agent': 'Mozilla/5.0'
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        print("Response HTTP Status:", response.status)
        print("Response Body:", content)
except Exception as e:
    print("Error during POST request:", e)
