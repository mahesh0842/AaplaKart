"""Create a demo order to prove the order system works end-to-end."""
import uuid
import httpx
import asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient() as client:
        # Step 1: Login as admin to get token
        print("1. Logging in as admin...")
        resp = await client.post(f"{BASE}/auth/admin-login", json={
            "username": "admin",
            "password": "admin@123"
        })
        data = resp.json()
        token = data["id_token"]
        print(f"   ✅ Token: {token[:30]}...")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Create a demo order
        print("\n2. Creating demo order...")
        order_payload = {
            "items": [
                {
                    "product_id": "kart-potato",
                    "name": "Fresh Potato",
                    "price": 20,
                    "quantity": 2,
                    "weight": "1 kg"
                },
                {
                    "product_id": "kart-spinach",
                    "name": "Green Spinach",
                    "price": 15,
                    "quantity": 1,
                    "weight": "250 g"
                }
            ],
            "subtotal": 55,
            "delivery_fee": 0,
            "total": 55,
            "payment_method": "cod",
            "delivery_slot": "asap",
            "delivery_slot_label": "ASAP",
            "address_full_name": "Rahul Sharma",
            "address_phone": "+919876543210",
            "address_line1": "123, MG Road",
            "address_line2": "Near Shiv Temple",
            "address_landmark": "Opposite Park",
            "address_city": "Mumbai",
            "address_pincode": "400001"
        }
        
        resp = await client.post(f"{BASE}/orders/", json=order_payload, headers=headers)
        
        if resp.status_code == 201:
            order = resp.json()
            print(f"   ✅ Order created successfully!")
            print(f"   📋 Order ID: {order['id']}")
            print(f"   💰 Total: ₹{order['total']}")
            print(f"   📦 Status: {order['status']}")
            print(f"   🏠 Delivery: {order['address_line1']}, {order['address_city']}")
            print(f"   🕐 Placed at: {order['placed_at']}")
        else:
            print(f"   ❌ Failed: {resp.status_code} - {resp.text}")

asyncio.run(main())
