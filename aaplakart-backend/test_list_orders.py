"""Test list my orders with mock token."""
import httpx, asyncio, json

async def test():
    async with httpx.AsyncClient() as c:
        r = await c.post('http://localhost:8000/api/auth/mock-login')
        d = r.json()
        token = d['id_token']
        print('Mock login OK')
        
        # List my orders
        r2 = await c.get('http://localhost:8000/api/orders/', headers={'Authorization': 'Bearer ' + token})
        print('Status:', r2.status_code)
        data = r2.json()
        if isinstance(data, list):
            print('Orders count:', len(data))
            for o in data:
                print('  -', o['id'], ':', o['status'])
        else:
            print('Response:', json.dumps(data, indent=2)[:500])

asyncio.run(test())
