"""Create fresh test orders with coordinates for delivery app testing."""
import httpx, asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/auth/admin-login", json={"username":"admin","password":"admin@123"})
        token = r.json()["id_token"]
        headers = {"Authorization": f"Bearer {token}"}

        orders_data = [
            {"items": [{"product_id":"p1","name":"Fresh Milk","price":60,"quantity":2,"weight":"1L"}],
             "subtotal":120,"delivery_fee":0,"total":120,"payment_method":"cod",
             "address_full_name":"Amit Sharma","address_phone":"9876543210",
             "address_line1":"Flat 5, Sunrise Apartments, Sector 15",
             "address_city":"Navi Mumbai","address_pincode":"400701",
             "address_latitude":19.0330,"address_longitude":73.0297},
            {"items": [{"product_id":"p2","name":"Bread","price":35,"quantity":3,"weight":"400g"}],
             "subtotal":105,"delivery_fee":0,"total":105,"payment_method":"cod",
             "address_full_name":"Priya Patel","address_phone":"9876543211",
             "address_line1":"B-201, Green Valley, Palm Beach Road",
             "address_city":"Vashi","address_pincode":"400703",
             "address_latitude":19.0750,"address_longitude":72.9989}
        ]

        for i, order in enumerate(orders_data):
            r2 = await c.post(f"{BASE}/orders/", json=order, headers=headers)
            d = r2.json()
            print(f"Order {i+1}: {d['id']} - {d['status']} - Rs.{d['total']}")

        r3 = await c.post(f"{BASE}/auth/delivery-login", json={"phone_number":"+919999999999","otp":"123456"})
        dt = r3.json()["token"]
        r4 = await c.get(f"{BASE}/delivery/orders", headers={"Authorization": f"Bearer {dt}"})
        d4 = r4.json()
        print(f"\nDelivery sees {d4['count']} active orders:")
        for o in d4["orders"]:
            print(f"  {o['id']}: {o['status']} | {o['address_city']} | lat:{o.get('address_latitude','N/A')}")

asyncio.run(main())
