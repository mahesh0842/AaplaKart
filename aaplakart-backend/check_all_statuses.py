"""Check all order statuses that delivery app would see."""
import httpx, asyncio, json

async def main():
    async with httpx.AsyncClient() as c:
        r = await c.post("http://localhost:8000/api/auth/admin-login", json={
            "username": "admin", "password": "admin@123"
        })
        token = r.json()["id_token"]
        
        r2 = await c.get("http://localhost:8000/api/admin/orders?page_size=100",
            headers={"Authorization": f"Bearer {token}"})
        data = r2.json()
        
        statuses = {}
        for o in data["orders"]:
            s = o["status"]
            statuses[s] = statuses.get(s, 0) + 1
        
        print("All orders by status:")
        for k, v in sorted(statuses.items()):
            print(f"  {k}: {v}")
        
        active_statuses = ["pending", "confirmed", "preparing", "picked_up", "out-for-delivery"]
        active = [o for o in data["orders"] if o["status"] in active_statuses]
        
        print(f"\nOrders delivery app would fetch ({len(active)}):")
        for o in active:
            print(f"  {o['id'][:25]:27s} | {o['status']:15s} | Rs.{o['total']:>8.0f} | {o['address_city']}")

asyncio.run(main())
