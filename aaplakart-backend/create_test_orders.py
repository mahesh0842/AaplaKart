"""Create fresh pending test orders for delivery app UI testing."""
import httpx
import asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient() as c:
        # Admin login
        r = await c.post(f"{BASE}/auth/admin-login", json={"username": "admin", "password": "admin@123"})
        token = r.json()["id_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create 2 fresh pending orders
        for i in range(2):
            order = {
                "items": [
                    {"product_id": f"p{i*2+1}", "name": "Fresh Milk", "price": 60, "quantity": 2, "weight": "1L"},
                    {"product_id": f"p{i*2+2}", "name": "Bread", "price": 35, "quantity": 1, "weight": "400g"}
                ],
                "subtotal": 155, "delivery_fee": 0, "total": 155,
                "payment_method": "cod", "delivery_slot": "asap", "delivery_slot_label": "ASAP",
                "address_full_name": f"Customer {i+1}",
                "address_phone": f"+9198765432{i}0",
                "address_line1": f"{100+i} Test Street",
                "address_city": "Navi Mumbai", "address_pincode": "400701",
            }
            r2 = await c.post(f"{BASE}/orders/", json=order, headers=headers)
            d = r2.json()
            print(f"Order {i+1}: {d['id']} - {d['status']} - Rs.{d['total']}")

        # Verify via delivery endpoint
        r3 = await c.post(f"{BASE}/auth/delivery-login", json={"phone_number": "+919999999999", "otp": "123456"})
        dt = r3.json()["token"]
        r4 = await c.get(f"{BASE}/delivery/orders", headers={"Authorization": f"Bearer {dt}"})
        d4 = r4.json()
        print(f"\nDelivery sees {d4['count']} active orders:")
        for o in d4["orders"]:
            print(f"  {o['id']}: {o['status']} | {o['address_city']}")

asyncio.run(main())
