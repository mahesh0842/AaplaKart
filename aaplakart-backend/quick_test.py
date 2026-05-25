"""Quick test: delivery login + check active orders."""
import httpx, asyncio

async def main():
    async with httpx.AsyncClient() as c:
        # Login
        r = await c.post("http://localhost:8000/api/auth/delivery-login", json={
            "phone_number": "+919999999999", "otp": "123456"
        })
        print(f"Login: {r.status_code}")
        data = r.json()
        token = data.get("token", "")
        print(f"Token: {token[:30]}...")

        # Check orders
        r2 = await c.get("http://localhost:8000/api/delivery/orders",
            headers={"Authorization": f"Bearer {token}"})
        d2 = r2.json()
        print(f"Orders: {d2.get('count', 0)} active")
        for o in d2.get("orders", []):
            print(f"  {o['id']}: {o['status']} | {o.get('address_city','?')}")

asyncio.run(main())
