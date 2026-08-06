import sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import requests', 'import httpx\n\n_client = httpx.AsyncClient(timeout=5.0)')
content = content.replace('requests.get(', 'await _client.get(')
content = content.replace('def fetch_weather(', 'async def fetch_weather(')
content = content.replace('def fetch_aqi(', 'async def fetch_aqi(')
content = content.replace('def fetch_platform_status(', 'async def fetch_platform_status(')
content = content.replace('def fetch_social_signals(', 'async def fetch_social_signals(')

with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.write(content)
