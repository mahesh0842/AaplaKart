"""Debug mock order flow."""
import httpx, asyncio

async def test():
    async with httpx.AsyncClient() as c:
        # Mock login
        r = await c.post('http://localhost:8000/api/auth/mock-login')
        d = r.json()
        token = d['id_token']
        uid = d['uid']
        print('UID from mock:', uid)
        
        # Check auth/me
        r2 = await c.get('http://localhost:8000/api/auth/me', headers={'Authorization': 'Bearer ' + token})
        u = r2.json()
        print('Auth me UID:', u.get('uid'))
        print('Auth me phone:', u.get('phone_number'))
        
        # Now try order
        payload = {
            'items': [{'product_id': 'kart-potato', 'name': 'Fresh Potato', 'price': 20, 'quantity': 2}],
            'subtotal': 40, 'delivery_fee': 0, 'total': 40, 'payment_method': 'cod',
            'delivery_slot': 'asap', 'delivery_slot_label': 'ASAP',
            'address_full_name': 'Test', 'address_phone': '+91', 'address_line1': '123 St',
            'address_city': 'Mumbai', 'address_pincode': '400001'
        }
        r3 = await c.post('http://localhost:8000/api/orders/', json=payload, headers={'Authorization': 'Bearer ' + token})
        print('Order status:', r3.status_code)
        if r3.status_code >= 400:
            print('Error body:', r3.text)

asyncio.run(test())
