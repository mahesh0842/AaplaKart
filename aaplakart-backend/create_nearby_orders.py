"""Create test orders near the user's shop (Uttar Pradesh)."""
import httpx, asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/auth/admin-login", json={"username":"admin","password":"admin@123"})
        token = r.json()["id_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Orders near bakhari ki shop (25.356781, 82.456423)
        orders_data = [
            {"items": [{"product_id":"p1","name":"Fresh Milk","price":60,"quantity":2,"weight":"1L"}],
             "subtotal":120,"delivery_fee":0,"total":120,"payment_method":"cod",
             "address_full_name":"Ravi Kumar","address_phone":"9930999562",
             "address_line1":"Village Keshavpur, Post Sarpatha",
             "address_city":"Gyanpur","address_pincode":"221304",
             "address_latitude":25.3677,"address_longitude":82.4631},
            {"items": [{"product_id":"p2","name":"Bread","price":35,"quantity":3,"weight":"400g"}],
             "subtotal":105,"delivery_fee":0,"total":105,"payment_method":"cod",
             "address_full_name":"Sunita Devi","address_phone":"9930999563",
             "address_line1":"Mohalla Bazar, Gyanpur Road",
             "address_city":"Badlapur","address_pincode":"221305",
             "address_latitude":25.3900,"address_longitude":82.4400},
        ]

        for i, order in enumerate(orders_data):
            r2 = await c.post(f"{BASE}/orders/", json=order, headers=headers)
            d = r2.json()
            print(f"Order {i+1}: {d['id']} - {d['status']} - Rs.{d['total']}")

        # Verify delivery sees all orders
        r3 = await c.post(f"{BASE}/auth/delivery-login", json={"phone_number":"+919999999999","otp":"123456"})
        dt = r3.json()["token"]
        r4 = await c.get(f"{BASE}/delivery/orders", headers={"Authorization": f"Bearer {dt}"})
        d4 = r4.json()
        print(f"\nDelivery sees {d4['count']} active orders:")
        for o in d4["orders"]:
            print(f"  {o['id']}: {o['status']} | {o['address_city']} | {o.get('distanceFromShop','N/A')}km from shop")

asyncio.run(main())
