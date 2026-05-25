"""Test main app API endpoints."""
import httpx, asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient() as c:
        # 1. Health
        r = await c.get(f"{BASE}/admin/health", headers={"Authorization": "Bearer admin-dev-test"})
        print(f"1. Health: {r.status_code}")
        if r.status_code == 200:
            d = r.json()
            print(f"   Overall: {d['overall_status']}")
        
        # 2. Products
        r = await c.get(f"{BASE}/products")
        print(f"\n2. Products: {r.status_code}")
        if r.status_code == 200:
            d = r.json()
            print(f"   Count: {len(d) if isinstance(d, list) else d.get('count', 0)}")
        
        # 3. Categories
        r = await c.get(f"{BASE}/categories")
        print(f"\n3. Categories: {r.status_code}")
        
        # 4. Config
        r = await c.get(f"{BASE}/config")
        print(f"\n4. Config: {r.status_code}")
        
        # 5. Mock login (like main app does)
        r = await c.post(f"{BASE}/auth/mock-login")
        print(f"\n5. Mock Login: {r.status_code}")
        if r.status_code == 200:
            d = r.json()
            token = d.get("id_token", "")
            print(f"   Token: {token[:30]}...")
            
            # 6. Try fetching with mock token
            headers = {"Authorization": f"Bearer {token}"}
            r2 = await c.get(f"{BASE}/products", headers=headers)
            print(f"\n6. Products (authed): {r2.status_code}")

asyncio.run(main())
