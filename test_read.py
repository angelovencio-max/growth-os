import urllib.request
import json

url = 'https://script.google.com/macros/s/AKfycbwLCatU2GdBLNurcwfqmuGpbrqRUF97ffXoZErUe74GY_qSWvc2gAYlUgZUsnhz3Jo/exec?action=readAll'

try:
    print("Fetching sheet data...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        print("Success! Keys in response:", list(data.keys()))
        for key, rows in data.items():
            print(f"Tab: {key}, Rows: {len(rows)}")
            if len(rows) > 0:
                print(f"  First row headers: {list(rows[0].keys())}")
except Exception as e:
    print("Error:", e)
