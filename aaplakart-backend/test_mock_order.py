"""Test order creation with mock token (simulating app flow)."""
import httpx
import asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient() as client:
        # Step 1: Mock login (like the app does)
        print("1. Mock login...")
        resp = await client.post(f"{BASE}/auth/mock-login")
        data = resp.json()
        token = data["id_token"]
        print(f"   ✅ Token: {token[:30]}...")
        print(f"   UID: {data.get('uid')}")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Create order with mock token
        print("\n2. Creating order...")
        order_payload = {
            "items": [
                {"product_id": "kart-potato", "name": "Fresh Potato", "price": 20, "quantity": 2, "weight": "1 kg"},
                {"product_id": "kart-spinach", "name": "Green Spinach", "price": 15, "quantity": 1, "weight": "250 g"}
            ],
            "subtotal": 55,
            "delivery_fee": 0,
            "total": 55,
            "payment_method": "cod",
            "delivery_slot": "asap",
            "delivery_slot_label": "ASAP",
            "address_full_name": "Mock User",
            "address_phone": "+10000000000",
            "address_line1": "123 Test St",
            "address_city": "Mumbai",
            "address_pincode": "400001"
        }
        
        resp = await client.post(f"{BASE}/orders/", json=order_payload, headers=headers)
        
        if resp.status_code == 201:
            order = resp.json()
            print(f"   ✅ Order created: {order['id']}")
        else:
            print(f"   ❌ Failed: {resp.status_code} - {resp.text}")

asyncio.run(main())
