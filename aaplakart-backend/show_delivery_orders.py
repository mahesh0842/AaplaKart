"""Show what delivery app fetches from backend."""
import httpx, asyncio

async def main():
    async with httpx.AsyncClient() as c:
        r = await c.post("http://localhost:8000/api/auth/delivery-login", json={
            "phone_number": "+919999999999", "otp": "123456"
        })
        token = r.json()["token"]
        
        r2 = await c.get("http://localhost:8000/api/delivery/orders",
            headers={"Authorization": f"Bearer {token}"})
        data = r2.json()
        
        print(f"Delivery app fetches: GET /api/delivery/orders")
        print(f"Backend filters: status IN (pending, confirmed, preparing, picked_up, out-for-delivery)")
        print(f"Total active orders: {data['count']}")
        print()
        
        for o in data["orders"]:
            items = o.get("items", [])
            item_names = ", ".join([f"{i.get('quantity',1)}x {i.get('name','?')}" for i in items[:2]])
            if len(items) > 2:
                item_names += f" +{len(items)-2} more"
            print(f"  ID:     {o['id']}")
            print(f"  Status: {o['status']}")
            print(f"  Total:  Rs.{o['total']}")
            print(f"  Items:  {item_names}")
            print(f"  Name:   {o['address_full_name']}")
            print(f"  Addr:   {o['address_line1']}, {o['address_city']}")
            print(f"  Phone:  {o['address_phone']}")
            print(f"  Coords: {o.get('address_latitude','N/A')}, {o.get('address_longitude','N/A')}")
            print()

asyncio.run(main())
