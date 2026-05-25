"""Test full flow: shop → delivery login → orders"""
import httpx, asyncio

async def main():
    async with httpx.AsyncClient() as c:
        # 1. Get active shop
        r = await c.get("http://localhost:8000/api/shops/active")
        data = r.json()
        shop = data["shop"]
        print(f"1. Shop: {shop['name']}")
        print(f"   Location: {shop['latitude']}, {shop['longitude']}")
        print(f"   Radius: {shop['delivery_radius_km']}km")

        # 2. Login as delivery
        r2 = await c.post("http://localhost:8000/api/auth/delivery-login", json={
            "phone_number": "+919999999999", "otp": "123456"
        })
        token = r2.json()["token"]

        # 3. Get delivery orders
        r3 = await c.get("http://localhost:8000/api/delivery/orders",
            headers={"Authorization": f"Bearer {token}"})
        orders = r3.json()

        print(f"\n2. Delivery sees {orders['count']} active orders:")
        for o in orders["orders"]:
            print(f"   {o['id'][:25]:27s} | {o['status']:15s} | {o['address_city']}")

        print("\n✅ Full flow working!")

asyncio.run(main())
