import httpx, asyncio, time
async def t():
    async with httpx.AsyncClient() as c:
        r = await c.post('http://localhost:8000/api/auth/admin-login', json={'username':'admin','password':'admin@123'})
        token = r.json()['id_token']
        print('Token ok')
        
        # 1st call (cold)
        t1 = time.time()
        r2 = await c.get('http://localhost:8000/api/admin/health', headers={'Authorization':'Bearer '+token})
        t2 = time.time()
        print(f'1st call: {int((t2-t1)*1000)}ms')
        
        # 2nd call (cached)
        t1 = time.time()
        r3 = await c.get('http://localhost:8000/api/admin/health', headers={'Authorization':'Bearer '+token})
        t2 = time.time()
        print(f'2nd call: {int((t2-t1)*1000)}ms (should be <5ms cached)')

asyncio.run(t())
