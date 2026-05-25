"""Test the complete delivery flow end-to-end."""
import httpx
import asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient() as c:
        # 1. Test delivery login
        r = await c.post(f"{BASE}/auth/delivery-login", json={
            "phone_number": "+919999999999",
            "otp": "123456"
        })
        print(f"1. Delivery Login: {r.status_code}")
        data = r.json()
        token = data.get("token", "")
        print(f"   Token: {token[:30]}...")
        assert r.status_code == 200, f"Delivery login failed: {data}"
        
        # 2. Test delivery orders endpoint
        headers = {"Authorization": f"Bearer {token}"}
        r2 = await c.get(f"{BASE}/delivery/orders", headers=headers)
        print(f"\n2. Delivery Orders: {r2.status_code}")
        orders_data = r2.json()
        print(f"   Success: {orders_data.get('success')}")
        print(f"   Count: {orders_data.get('count', 0)}")
        for o in orders_data.get("orders", []):
            print(f"   - {o['id']}: {o['status']} | {o.get('address_city','?')} | Rs.{o['total']}")
        
        # 3. Verify admin can see it
        r3 = await c.post(f"{BASE}/auth/admin-login", json={
            "username": "admin",
            "password": "admin@123"
        })
        admin_token = r3.json()["id_token"]
        r4 = await c.get(f"{BASE}/admin/orders", headers={"Authorization": f"Bearer {admin_token}"})
        admin_data = r4.json()
        pending = [o for o in admin_data.get("orders", []) if o["status"] == "pending"]
        print(f"\n3. Admin Pending Orders: {len(pending)}")
        for o in pending:
            print(f"   - {o['id']}: {o['status']} | Rs.{o['total']}")
        
        if pending:
            # 4. Admin confirms the order
            oid = pending[0]["id"]
            r5 = await c.patch(
                f"{BASE}/admin/orders/{oid}/status",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"status": "confirmed"}
            )
            print(f"\n4. Admin Confirm: {r5.status_code}")
            print(f"   {r5.json()}")
            
            # 5. Delivery sees it as confirmed now
            r6 = await c.get(f"{BASE}/delivery/orders", headers=headers)
            d2 = r6.json()
            print(f"\n5. Delivery Orders After Confirm: {d2.get('count')}")
            for o in d2.get("orders", []):
                print(f"   - {o['id']}: {o['status']}")
            
            # 6. Delivery partner picks up
            r7 = await c.patch(
                f"{BASE}/delivery/orders/{oid}/status",
                headers=headers,
                json={"status": "picked_up"}
            )
            print(f"\n6. Delivery Pick Up: {r7.status_code}")
            print(f"   {r7.json()}")
            
            # 7. Out for delivery
            r8 = await c.patch(
                f"{BASE}/delivery/orders/{oid}/status",
                headers=headers,
                json={"status": "out-for-delivery"}
            )
            print(f"\n7. Out for Delivery: {r8.status_code}")
            
            # 8. Delivered!
            r9 = await c.patch(
                f"{BASE}/delivery/orders/{oid}/status",
                headers=headers,
                json={"status": "delivered"}
            )
            print(f"\n8. Delivered: {r9.status_code}")
            print(f"   {r9.json()}")
        
        print("\n✅ Delivery flow test complete!")

asyncio.run(main())
