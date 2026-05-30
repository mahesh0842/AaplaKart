"""Migrate existing products to add variants (options), units, and maxQuantity."""
import json
import os

PRODUCTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'products.json')

# Category → default unit + variant rules
CATEGORY_CONFIG = {
    'Vegetables': {'unit': 'kg', 'variants': [
        {'weight': '250g', 'price_factor': 0.3, 'stock': 30},
        {'weight': '500g', 'price_factor': 0.55, 'stock': 25},
        {'weight': '1kg', 'price_factor': 1.0, 'stock': 20},
    ]},
    'Fruits': {'unit': 'kg', 'variants': [
        {'weight': '250g', 'price_factor': 0.3, 'stock': 30},
        {'weight': '500g', 'price_factor': 0.55, 'stock': 25},
        {'weight': '1kg', 'price_factor': 1.0, 'stock': 20},
    ]},
    'Dairy': {'unit': 'g', 'variants': [
        {'weight': '200g', 'price_factor': 0.4, 'stock': 25},
        {'weight': '500g', 'price_factor': 0.85, 'stock': 20},
        {'weight': '1kg', 'price_factor': 1.5, 'stock': 15},
    ]},
    'Grains & Dal': {'unit': 'kg', 'variants': [
        {'weight': '500g', 'price_factor': 0.55, 'stock': 25},
        {'weight': '1kg', 'price_factor': 1.0, 'stock': 20},
        {'weight': '5kg', 'price_factor': 4.5, 'stock': 10},
    ]},
    'Spices & Masala': {'unit': 'g', 'variants': [
        {'weight': '50g', 'price_factor': 0.4, 'stock': 30},
        {'weight': '100g', 'price_factor': 0.75, 'stock': 25},
        {'weight': '200g', 'price_factor': 1.3, 'stock': 20},
    ]},
    'Bakery': {'unit': 'pcs', 'variants': [
        {'weight': '1pc', 'price_factor': 1.0, 'stock': 15},
        {'weight': '6pcs', 'price_factor': 5.0, 'stock': 10},
    ]},
    'Biscuits & Cookies': {'unit': 'packet', 'variants': [
        {'weight': 'Small', 'price_factor': 1.0, 'stock': 20},
        {'weight': 'Family', 'price_factor': 1.8, 'stock': 15},
    ]},
    'Beverages': {'unit': 'ml', 'variants': [
        {'weight': '200ml', 'price_factor': 1.0, 'stock': 25},
        {'weight': '500ml', 'price_factor': 2.0, 'stock': 20},
        {'weight': '1L', 'price_factor': 3.5, 'stock': 15},
    ]},
    'Frozen': {'unit': 'packet', 'variants': [
        {'weight': 'Small', 'price_factor': 1.0, 'stock': 15},
        {'weight': 'Large', 'price_factor': 1.8, 'stock': 10},
    ]},
    'Snacks': {'unit': 'g', 'variants': [
        {'weight': '100g', 'price_factor': 1.0, 'stock': 20},
        {'weight': '200g', 'price_factor': 1.8, 'stock': 15},
        {'weight': '400g', 'price_factor': 3.2, 'stock': 10},
    ]},
    'Classic Waffles': {'unit': 'pcs', 'variants': [
        {'weight': '1pc', 'price_factor': 1.0, 'stock': 15},
        {'weight': '2pcs', 'price_factor': 1.8, 'stock': 12},
    ]},
    'Chocolate Waffles': {'unit': 'pcs', 'variants': [
        {'weight': '1pc', 'price_factor': 1.0, 'stock': 15},
        {'weight': '2pcs', 'price_factor': 1.8, 'stock': 12},
    ]},
    'Special Waffles': {'unit': 'pcs', 'variants': [
        {'weight': '1pc', 'price_factor': 1.0, 'stock': 15},
        {'weight': '2pcs', 'price_factor': 1.8, 'stock': 12},
    ]},
}

DEFAULT_CONFIG = {'unit': 'pcs', 'variants': [
    {'weight': '1pc', 'price_factor': 1.0, 'stock': 20},
]}

def migrate():
    with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
        products = json.load(f)

    updated = 0
    for p in products:
        if p.get('options'):  # already has variants
            continue

        cat = p.get('category', '')
        config = CATEGORY_CONFIG.get(cat, DEFAULT_CONFIG)
        base_price = float(p.get('price', 100))

        # Build variant options
        options = []
        for v in config['variants']:
            vprice = round(base_price * v['price_factor'])
            options.append({
                'weight': v['weight'],
                'price': vprice,
                'stock': v['stock'],
                'mrp': round(vprice * 1.15),  # 15% markup for MRP
            })

        p['unit'] = p.get('unit') or config['unit']
        p['options'] = options
        p['price'] = options[0]['price']  # update base price to first variant
        p['maxQuantity'] = p.get('maxQuantity', 10)
        p['isAvailable'] = p.get('isAvailable', True)
        updated += 1

    with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    print(f'Migrated {updated}/{len(products)} products with variants')

if __name__ == '__main__':
    migrate()
