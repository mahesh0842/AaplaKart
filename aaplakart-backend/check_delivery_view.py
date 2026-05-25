"""Quick check: what the delivery app would see right now."""
import httpx, asyncio

async def main():
    async with httpx.AsyncClient() as c:
        # 1. Login as delivery
        r = await c.post("http://localhost:8001/api/auth/delivery-login", json={
            "phone_number": "+919999999999", "otp": "123456"
        })
        token = r.json()["token"]
        print(f"Token: {token[:30]}...")

        # 2. Check what delivery app would see
        r2 = await c.get("http://localhost:8001/api/delivery/orders",
            headers={"Authorization": f"Bearer {token}"})
        d = r2.json()
        print(f"\nDelivery App would see: {d['count']} active orders")
        for o in d["orders"]:
            print(f"  {o['id']}: {o['status']} | {o['address_city']} | Rs.{o['total']}")

        # 3. Also check all orders statuses
        r3 = await c.post("http://localhost:8001/api/auth/admin-login", json={
            "username": "admin", "password": "admin@123"
        })
        admin_token = r3.json()["id_token"]
        r4 = await c.get("http://localhost:8001/api/admin/orders?page_size=100",
            headers={"Authorization": f"Bearer {admin_token}"})
        all_orders = r4.json()
        statuses = {}
        for o in all_orders["orders"]:
            s = o["status"]
            statuses[s] = statuses.get(s, 0) + 1
        print(f"\nAll orders by status: {statuses}")

asyncio.run(main())
