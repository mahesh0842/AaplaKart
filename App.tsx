import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, Image, StyleSheet, StatusBar,
  Alert, Dimensions, Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// ─── PUT YOUR LOGO IN assets/logo.png ────────────────────
const LOGO = require('./assets/logo.png');

const { width: SW } = Dimensions.get('window');

// ─── THEME ───────────────────────────────────────────────
const C = {
  green: '#0C831F', greenDark: '#064E12', greenLight: '#E8F5E9',
  orange: '#F97316', orangeLight: '#FFF3E9', yellow: '#FFC700',
  bg: '#F3F4F6', card: '#FFFFFF', text: '#1C1C1C', muted: '#6B7280',
  border: '#E5E7EB', red: '#EF4444', redLight: '#FEE2E2',
};

// ─── PRODUCTS ────────────────────────────────────────────
type Product = {
  id: number; name: string; nameM: string; cat: string; sub: string;
  price: number; unit: string; emoji: string; stock: number; available: boolean;
};

const INIT_PRODUCTS: Product[] = [
  { id: 1,  name: 'Tomato',          nameM: 'टोमॅटो',          cat: 'Vegetables', sub: 'Essentials',   price: 30,  unit: '500g',  emoji: '🍅', stock: 50,  available: true  },
  { id: 2,  name: 'Onion',           nameM: 'कांदा',            cat: 'Vegetables', sub: 'Essentials',   price: 25,  unit: '500g',  emoji: '🧅', stock: 80,  available: true  },
  { id: 3,  name: 'Potato',          nameM: 'बटाटा',            cat: 'Vegetables', sub: 'Essentials',   price: 28,  unit: '500g',  emoji: '🥔', stock: 100, available: true  },
  { id: 4,  name: 'Spinach',         nameM: 'पालक',             cat: 'Vegetables', sub: 'Leafy Greens', price: 20,  unit: '250g',  emoji: '🥬', stock: 30,  available: true  },
  { id: 5,  name: 'Carrot',          nameM: 'गाजर',             cat: 'Vegetables', sub: 'Root Vegs',    price: 35,  unit: '500g',  emoji: '🥕', stock: 40,  available: true  },
  { id: 6,  name: 'Capsicum',        nameM: 'सिमला मिर्ची',     cat: 'Vegetables', sub: 'Essentials',   price: 45,  unit: '250g',  emoji: '🫑', stock: 25,  available: true  },
  { id: 7,  name: 'Cauliflower',     nameM: 'फूलकोबी',          cat: 'Vegetables', sub: 'Seasonal',     price: 40,  unit: '1 pc',  emoji: '🥦', stock: 0,   available: false },
  { id: 8,  name: 'Cucumber',        nameM: 'काकडी',            cat: 'Vegetables', sub: 'Seasonal',     price: 22,  unit: '2 pcs', emoji: '🥒', stock: 60,  available: true  },
  { id: 9,  name: 'Brinjal',         nameM: 'वांगी',            cat: 'Vegetables', sub: 'Essentials',   price: 30,  unit: '500g',  emoji: '🍆', stock: 15,  available: true  },
  { id: 10, name: 'Bitter Gourd',    nameM: 'कारले',            cat: 'Vegetables', sub: 'Seasonal',     price: 35,  unit: '250g',  emoji: '🫛', stock: 0,   available: false },
  { id: 11, name: 'Full Cream Milk', nameM: 'पूर्ण मलई दूध',   cat: 'Dairy',      sub: 'Milk',         price: 28,  unit: '500ml', emoji: '🥛', stock: 200, available: true  },
  { id: 12, name: 'Toned Milk',      nameM: 'टोन्ड दूध',       cat: 'Dairy',      sub: 'Milk',         price: 24,  unit: '500ml', emoji: '🍼', stock: 150, available: true  },
  { id: 13, name: 'Fresh Paneer',    nameM: 'ताजे पनीर',        cat: 'Dairy',      sub: 'Paneer',       price: 89,  unit: '200g',  emoji: '🧀', stock: 45,  available: true  },
  { id: 14, name: 'Malai Paneer',    nameM: 'मलई पनीर',        cat: 'Dairy',      sub: 'Paneer',       price: 110, unit: '200g',  emoji: '🫙', stock: 20,  available: true  },
  { id: 15, name: 'Dahi (Curd)',     nameM: 'दही',              cat: 'Dairy',      sub: 'Curd',         price: 45,  unit: '400g',  emoji: '🥣', stock: 80,  available: true  },
  { id: 16, name: 'A2 Ghee',         nameM: 'देसी तूप',         cat: 'Dairy',      sub: 'Ghee',         price: 180, unit: '250g',  emoji: '✨', stock: 30,  available: true  },
  { id: 17, name: 'Butter',          nameM: 'लोणी',             cat: 'Dairy',      sub: 'Butter',       price: 65,  unit: '100g',  emoji: '🧈', stock: 0,   available: false },
  { id: 18, name: 'Lassi',           nameM: 'लस्सी',            cat: 'Dairy',      sub: 'Drinks',       price: 35,  unit: '300ml', emoji: '🧋', stock: 50,  available: true  },
  { id: 19, name: 'Shrikhand',       nameM: 'श्रीखंड',          cat: 'Dairy',      sub: 'Sweets',       price: 75,  unit: '200g',  emoji: '🍮', stock: 25,  available: true  },
  { id: 20, name: 'Buttermilk',      nameM: 'ताक',              cat: 'Dairy',      sub: 'Drinks',       price: 20,  unit: '500ml', emoji: '🥤', stock: 90,  available: true  },
];

const CATS = ['All', 'Vegetables', 'Dairy'];
const SUBCATS: Record<string, string[]> = {
  Vegetables: ['All', 'Essentials', 'Leafy Greens', 'Root Vegs', 'Seasonal'],
  Dairy:      ['All', 'Milk', 'Paneer', 'Curd', 'Ghee', 'Butter', 'Drinks', 'Sweets'],
};

// ─── STOCK BADGE ─────────────────────────────────────────
function StockBadge({ available, stock }: { available: boolean; stock: number }) {
  if (!available || stock === 0)
    return <View style={[st.badge, { backgroundColor: C.redLight }]}><Text style={[st.badgeTxt, { color: C.red }]}>Out of Stock</Text></View>;
  if (stock <= 10)
    return <View style={[st.badge, { backgroundColor: '#FFF7E0' }]}><Text style={[st.badgeTxt, { color: '#B45309' }]}>Only {stock} left!</Text></View>;
  return <View style={[st.badge, { backgroundColor: C.greenLight }]}><Text style={[st.badgeTxt, { color: C.green }]}>In Stock</Text></View>;
}

// ─── PRODUCT CARD ────────────────────────────────────────
function ProductCard({ p, cart, onAdd, onRemove }: { p: Product; cart: Record<number, number>; onAdd: (p: Product) => void; onRemove: (id: number) => void }) {
  const qty = cart[p.id] || 0;
  const oos = !p.available || p.stock === 0;
  return (
    <View style={[st.productCard, { width: (SW - 36) / 2 }]}>
      <View style={[st.emojiBox, { backgroundColor: oos ? '#F3F4F6' : C.greenLight, opacity: oos ? 0.5 : 1 }]}>
        <Text style={{ fontSize: 40 }}>{p.emoji}</Text>
        {oos && (
          <View style={st.oosOverlay}>
            <Text style={st.oosTxt}>Unavailable</Text>
          </View>
        )}
      </View>
      <View style={st.cardBody}>
        <StockBadge available={p.available} stock={p.stock} />
        <Text style={st.productName} numberOfLines={2}>{p.name}</Text>
        <Text style={st.productSub}>{p.nameM} · {p.unit}</Text>
        <View style={st.priceRow}>
          <Text style={st.price}>₹{p.price}</Text>
          {oos ? (
            <TouchableOpacity style={st.notifyBtn}><Text style={st.notifyTxt}>Notify Me</Text></TouchableOpacity>
          ) : qty > 0 ? (
            <View style={st.stepper}>
              <TouchableOpacity onPress={() => onRemove(p.id)} style={[st.stepBtn, { backgroundColor: C.red }]}>
                <Text style={st.stepTxt}>−</Text>
              </TouchableOpacity>
              <Text style={st.stepQty}>{qty}</Text>
              <TouchableOpacity onPress={() => onAdd(p)} style={[st.stepBtn, { backgroundColor: C.green }]}>
                <Text style={st.stepTxt}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => onAdd(p)} style={st.addBtn}>
              <Text style={st.addTxt}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── SPLASH SCREEN ─────────────────────────────────────
function SplashScreen({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 2500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={st.splash}>
      <Image source={LOGO} style={st.splashLogo} resizeMode="contain" />
      <Text style={st.splashTitle}>Aapla <Text style={{ color: C.yellow }}>Kart</Text></Text>
      <Text style={st.splashSub}>लवकर मिळेल, योग्य मिळेल</Text>
    </View>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────
function HomeScreen({ products, cart, onAdd, onRemove, setScreen, search, setSearch }: any) {
  const [activeCat, setActiveCat] = useState('All');
  const [activeSub, setActiveSub] = useState('All');
  
  // Get subcategories based on selected category
  const subs = activeCat === 'All' 
    ? ['All']  // Show only "All" when All category is selected
    : (SUBCATS[activeCat] || ['All']);
    
  const filtered = useMemo(() => products.filter((p: Product) => {
    const matchCat = activeCat === 'All' || p.cat === activeCat;
    const matchSub = activeSub === 'All' || p.sub === activeSub;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.nameM.includes(search);
    return matchCat && matchSub && matchSearch;
  }), [products, activeCat, activeSub, search]);
  
  // Handle category change - reset subcategory to 'All'
  const handleCatChange = (cat: string) => {
    setActiveCat(cat);
    setActiveSub('All');
  };
  const totalQty = Object.values(cart).reduce((a: any, b: any) => a + b, 0) as number;
  const totalPrice = Object.entries(cart).reduce((sum, [id, qty]: any) => {
    const p = products.find((x: Product) => x.id === +id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={[st.header, { backgroundColor: C.green }]}>
        <View style={st.headerTop}>
          <View style={st.headerLeft}>
            <Image source={LOGO} style={st.logoSmall} resizeMode="contain" />
            <View>
              <Text style={st.locationTxt}>📍 Navi Mumbai, MH</Text>
              <Text style={st.brandTxt}>Aapla <Text style={{ color: C.yellow, fontSize: 22 }}>Kart</Text></Text>
            </View>
          </View>
        </View>
        {/* Search */}
        <View style={st.searchBox}>
          <Text style={{ fontSize: 15, color: C.muted }}>🔍</Text>
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Search vegetables, dairy..."
            placeholderTextColor={C.muted}
            style={st.searchInput}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: C.muted, fontSize: 16 }}>✕</Text></TouchableOpacity> : null}
        </View>
      </View>

      {/* Delivery strip - only show when All category is selected */}
      {activeCat === 'All' && (
        <View style={[st.deliveryStrip, { backgroundColor: C.greenDark }]}>
          <Text style={st.deliveryTxt}>⚡ Delivery in 20 minutes</Text>
          <Text style={st.taglineTxt}>लवकर मिळेल, योग्य मिळेल</Text>
        </View>
      )}

      {/* Category Tabs */}
      <View style={st.tabRow}>
        {CATS.map(cat => (
          <TouchableOpacity key={cat} onPress={() => handleCatChange(cat)} style={[st.tab, activeCat === cat && st.tabActive]}>
            <Text style={[st.tabTxt, activeCat === cat && st.tabTxtActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subcategory chips - show for all categories including 'All' */}
      {subs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.subCatRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 7, paddingVertical: 8 }}>
          {subs.map((sub: string) => (
            <TouchableOpacity key={sub} onPress={() => setActiveSub(sub)} style={[st.chip, activeSub === sub && st.chipActive]}>
              <Text style={[st.chipTxt, activeSub === sub && st.chipTxtActive]}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Products */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 10 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={!search && activeCat === 'All' ? (
          <View style={st.promoBanner}>
            <View>
              <Text style={st.promoSub}>🎉 Today's Fresh Picks</Text>
              <Text style={st.promoTitle}>Get 10% off on Dairy</Text>
              <Text style={st.promoCode}>Use code: FRESH10</Text>
            </View>
            <Image source={LOGO} style={{ width: 60, height: 60 }} resizeMode="contain" />
          </View>
        ) : null}
        ListEmptyComponent={
          <View style={st.emptyBox}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>😔</Text>
            <Text style={st.emptyTxt}>कोणताही पदार्थ सापडला नाही</Text>
          </View>
        }
        renderItem={({ item }) => <ProductCard p={item} cart={cart} onAdd={onAdd} onRemove={onRemove} />}
      />

      {/* Cart bar */}
      {totalQty > 0 && (
        <View style={st.cartBar}>
          <TouchableOpacity onPress={() => setScreen('cart')} style={st.cartBarBtn}>
            <View style={st.cartBarBadge}><Text style={st.cartBarBadgeTxt}>{totalQty} item{totalQty > 1 ? 's' : ''}</Text></View>
            <Text style={st.cartBarMid}>View Cart →</Text>
            <Text style={st.cartBarPrice}>₹{totalPrice}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── CART SCREEN ─────────────────────────────────────────
function CartScreen({ products, cart, onAdd, onRemove, setScreen }: any) {
  const cartItems = Object.entries(cart).map(([id, qty]: any) => ({ product: products.find((p: Product) => p.id === +id), qty })).filter((x: any) => x.product);
  const subtotal = cartItems.reduce((s: number, { product, qty }: any) => s + product.price * qty, 0);
  const delivery = subtotal >= 200 ? 0 : 30;
  const total = subtotal + delivery + 2;
  return (
    <View style={{ flex: 1 }}>
      <View style={[st.header, { backgroundColor: C.green, paddingBottom: 14 }]}>
        <View style={st.headerTop}>
          <TouchableOpacity onPress={() => setScreen('home')} style={st.backBtn}>
            <Text style={{ color: '#fff', fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <Image source={LOGO} style={[st.logoSmall, { marginRight: 8 }]} resizeMode="contain" />
          <Text style={[st.brandTxt, { fontSize: 16 }]}>My Cart</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
        {cartItems.length === 0 ? (
          <View style={st.emptyBox}>
            <Text style={{ fontSize: 60 }}>🛒</Text>
            <Text style={[st.emptyTxt, { marginTop: 12, fontSize: 15 }]}>Cart is empty!</Text>
            <TouchableOpacity onPress={() => setScreen('home')} style={[st.addBtn, { marginTop: 20, paddingHorizontal: 28, paddingVertical: 12 }]}>
              <Text style={[st.addTxt, { fontSize: 14 }]}>Shop Now →</Text>
            </TouchableOpacity>
          </View>ccc
        ) : (
          <>
            <View style={[st.deliveryCard, { backgroundColor: C.greenLight, marginBottom: 14 }]}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <View style={{ marginLeft: 8 }}>
                <Text style={[st.productName, { color: C.green }]}>Delivery in 20 minutes</Text>
                <Text style={st.productSub}>Navi Mumbai, Maharashtra</Text>
              </View>
            </View>
            {cartItems.map(({ product: p, qty }: any) => (
              <View key={p.id} style={st.cartItem}>
                <View style={[st.emojiBox, { width: 52, height: 52, borderRadius: 12 }]}><Text style={{ fontSize: 26 }}>{p.emoji}</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={st.productName}>{p.name}</Text>
                  <Text style={st.productSub}>{p.unit}</Text>
                  <Text style={[st.price, { color: C.green }]}>₹{p.price * qty}</Text>
                </View>
                <View style={st.stepper}>
                  <TouchableOpacity onPress={() => onRemove(p.id)} style={[st.stepBtn, { backgroundColor: C.red }]}><Text style={st.stepTxt}>−</Text></TouchableOpacity>
                  <Text style={st.stepQty}>{qty}</Text>
                  <TouchableOpacity onPress={() => onAdd(p)} style={[st.stepBtn, { backgroundColor: C.green }]}><Text style={st.stepTxt}>+</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={st.billCard}>
              <Text style={[st.productName, { fontSize: 14, marginBottom: 12 }]}>Bill Details</Text>
              {[['MRP Total', `₹${subtotal}`], ['Delivery', delivery === 0 ? 'FREE 🎉' : `₹${delivery}`], ['Platform Fee', '₹2']].map(([k, v]) => (
                <View key={k} style={st.billRow}>
                  <Text style={st.billKey}>{k}</Text>
                  <Text style={[st.billVal, v.includes('FREE') && { color: C.green }]}>{v}</Text>
                </View>
              ))}
              <View style={[st.billRow, { borderTopWidth: 1.5, borderTopColor: C.border, borderStyle: 'dashed', marginTop: 8, paddingTop: 10 }]}>
                <Text style={[st.billKey, { fontSize: 14, fontWeight: '800', color: C.text }]}>To Pay</Text>
                <Text style={[st.billVal, { fontSize: 15, fontWeight: '900', color: C.green }]}>₹{total}</Text>
              </View>
              {delivery > 0 && <Text style={{ fontSize: 10, color: C.orange, marginTop: 6, fontWeight: '600' }}>Add ₹{200 - subtotal} more for FREE delivery!</Text>}
            </View>
          </>
        )}
      </ScrollView>
      {cartItems.length > 0 && (
        <View style={st.cartBar}>
          <TouchableOpacity style={[st.cartBarBtn, { justifyContent: 'space-between' }]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>🛍️ Proceed to Payment</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>₹{total} →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── ADMIN SCREEN ────────────────────────────────────────
function AdminScreen({ products, setProducts }: any) {
  const [view, setView] = useState<'list' | 'add'>('list');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ name: '', nameM: '', cat: 'Vegetables', sub: 'Essentials', price: '', unit: '500g', stock: '', emoji: '🥦' });

  const filtered = products.filter((p: Product) =>
    (filterCat === 'All' || p.cat === filterCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: products.length,
    available: products.filter((p: Product) => p.available).length,
    out: products.filter((p: Product) => !p.available || p.stock === 0).length,
    low: products.filter((p: Product) => p.available && p.stock > 0 && p.stock <= 10).length,
  };

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const toggleAvail = (id: number) => setProducts((prev: Product[]) => prev.map(p => p.id === id ? { ...p, available: !p.available } : p));
  const deleteProduct = (id: number) => {
    Alert.alert('Delete', 'Delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setProducts((prev: Product[]) => prev.filter(p => p.id !== id)) },
    ]);
  };
  const updateStock = (id: number, val: string) => {
    const qty = Math.max(0, +val || 0);
    setProducts((prev: Product[]) => prev.map(p => p.id === id ? { ...p, stock: qty, available: qty > 0 ? p.available : false } : p));
  };
  const addProduct = () => {
    if (!form.name || !form.price || !form.stock) { showMsg('⚠️ Fill all required fields!'); return; }
    setProducts((prev: Product[]) => [...prev, { id: Date.now(), ...form, price: +form.price, stock: +form.stock, available: +form.stock > 0, nameM: form.nameM || form.name }]);
    setForm({ name: '', nameM: '', cat: 'Vegetables', sub: 'Essentials', price: '', unit: '500g', stock: '', emoji: '🥦' });
    showMsg('✅ Product added!'); setView('list');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[st.header, { backgroundColor: C.green }]}>
        <View style={st.headerTop}>
          <View style={st.headerLeft}>
            <Image source={LOGO} style={st.logoSmall} resizeMode="contain" />
            <View>
              <Text style={st.locationTxt}>Aapla Kart</Text>
              <Text style={st.brandTxt}>⚙️ Admin Panel</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setView(view === 'add' ? 'list' : 'add')} style={[st.adminToggleBtn, { backgroundColor: view === 'add' ? C.red : C.orange }]}>
            <Text style={st.adminToggleTxt}>{view === 'add' ? '✕ Cancel' : '+ Add Product'}</Text>
          </TouchableOpacity>
        </View>
        <View style={st.statsRow}>
          {[{ label: 'Total', val: stats.total, c: '#fff' }, { label: 'Available', val: stats.available, c: '#86EFAC' }, { label: 'Out', val: stats.out, c: '#FCA5A5' }, { label: 'Low', val: stats.low, c: '#FDE68A' }].map(s => (
            <View key={s.label} style={st.statCard}>
              <Text style={[st.statVal, { color: s.c }]}>{s.val}</Text>
              <Text style={st.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {msg ? <View style={{ backgroundColor: msg.includes('✅') ? C.greenLight : C.orangeLight, padding: 10, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: msg.includes('✅') ? C.greenDark : C.orange }}>{msg}</Text>
      </View> : null}

      {view === 'add' ? (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={[st.productName, { fontSize: 15, marginBottom: 14 }]}>Add New Product</Text>
          {[{ label: 'Product Name (English) *', key: 'name', ph: 'e.g. Fresh Tomato' }, { label: 'Product Name (Marathi)', key: 'nameM', ph: 'e.g. ताजे टोमॅटो' }, { label: 'Unit', key: 'unit', ph: 'e.g. 500g, 1L' }, { label: 'Emoji Icon', key: 'emoji', ph: '🍅' }].map(f => (
            <View key={f.key} style={{ marginBottom: 12 }}>
              <Text style={st.formLabel}>{f.label}</Text>
              <TextInput value={(form as any)[f.key]} onChangeText={t => setForm(p => ({ ...p, [f.key]: t }))} placeholder={f.ph} placeholderTextColor={C.muted} style={st.formInput} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Price (₹) *</Text>
              <TextInput value={form.price} onChangeText={t => setForm(p => ({ ...p, price: t }))} placeholder="0" keyboardType="numeric" placeholderTextColor={C.muted} style={st.formInput} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Stock Qty *</Text>
              <TextInput value={form.stock} onChangeText={t => setForm(p => ({ ...p, stock: t }))} placeholder="0" keyboardType="numeric" placeholderTextColor={C.muted} style={st.formInput} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Category</Text>
              <View style={[st.formInput, { padding: 0 }]}>
                {(['Vegetables', 'Dairy'] as const).map(cat => (
                  <TouchableOpacity key={cat} onPress={() => setForm(p => ({ ...p, cat, sub: 'Essentials' }))} style={[st.pickerOpt, form.cat === cat && st.pickerOptActive]}>
                    <Text style={[st.pickerOptTxt, form.cat === cat && { color: C.green }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={addProduct} style={st.submitBtn}>
            <Text style={st.submitTxt}>✅ Add Product</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[st.adminFilterBar]}>
            <View style={st.adminSearch}>
              <Text style={{ fontSize: 13, color: C.muted }}>🔍</Text>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={C.muted} style={{ flex: 1, fontSize: 12, marginLeft: 8, color: C.text }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {['All', 'Vegetables', 'Dairy'].map(c => (
                <TouchableOpacity key={c} onPress={() => setFilterCat(c)} style={[st.chip, filterCat === c && st.chipActive]}>
                  <Text style={[st.chipTxt, filterCat === c && st.chipTxtActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {filtered.map((p: Product) => (
              <View key={p.id} style={[st.adminCard, { borderColor: !p.available || p.stock === 0 ? C.redLight : C.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[st.emojiBox, { width: 46, height: 46, borderRadius: 12, opacity: p.available ? 1 : 0.4 }]}>
                    <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={st.productName}>{p.name}</Text>
                      <StockBadge available={p.available} stock={p.stock} />
                    </View>
                    <Text style={st.productSub}>{p.cat} · {p.sub} · {p.unit}</Text>
                    <Text style={[st.price, { color: C.green, fontSize: 13 }]}>₹{p.price}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Text style={st.productSub}>Stock:</Text>
                    <TextInput
                      value={String(p.stock)}
                      onChangeText={t => updateStock(p.id, t)}
                      keyboardType="numeric"
                      style={st.stockInput}
                    />
                  </View>
                  <TouchableOpacity onPress={() => toggleAvail(p.id)} style={[st.availBtn, { backgroundColor: p.available ? C.greenLight : C.redLight }]}>
                    <Text style={[st.availTxt, { color: p.available ? C.green : C.red }]}>{p.available ? '✓ Available' : '✗ Unavail.'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteProduct(p.id)} style={[st.availBtn, { backgroundColor: C.redLight }]}>
                    <Text style={{ color: C.red, fontSize: 14 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── BOTTOM NAV ──────────────────────────────────────────
function BottomNav({ screen, setScreen, cartCount }: { screen: string; setScreen: (s: string) => void; cartCount: number }) {
  const tabs = [
    { icon: '🏠', label: 'Home', s: 'home' },
    { icon: '🔍', label: 'Search', s: 'search' },
    { icon: '🛒', label: 'Cart', s: 'cart', badge: cartCount },
    { icon: '⚙️', label: 'Admin', s: 'admin' },
  ];
  return (
    <View style={st.bottomNav}>
      {tabs.map(tab => (
        <TouchableOpacity key={tab.s} onPress={() => setScreen(tab.s)} style={st.navItem}>
          <View style={{ position: 'relative' }}>
            <Text style={{ fontSize: 24 }}>{tab.icon}</Text>
            {(tab.badge ?? 0) > 0 && (
              <View style={st.navBadge}><Text style={st.navBadgeTxt}>{tab.badge}</Text></View>
            )}
          </View>
          <Text style={[st.navLabel, screen === tab.s && { color: C.green }]}>{tab.label}</Text>
          {screen === tab.s && <View style={st.navDot} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── ROOT APP ────────────────────────────────────────────
export default function App() {
  const [products, setProducts] = useState<Product[]>(INIT_PRODUCTS);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [screen, setScreen] = useState('splash');
  const [search, setSearch] = useState('');

  const addToCart = (p: Product) => {
    if (!p.available || p.stock === 0) return;
    setCart(c => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }));
  };
  const removeFromCart = (id: number) => {
    setCart(c => {
      const n = { ...c };
      if (n[id] > 1) n[id]--;
      else delete n[id];
      return n;
    });
  };
  const totalQty = Object.values(cart).reduce((a, b) => a + b, 0);

  const finishSplash = () => setScreen('home');

  // Show splash screen on app start
  if (screen === 'splash') {
    return (
      <SplashScreen onFinish={finishSplash} />
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={st.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={C.green} />
        <View style={{ flex: 1 }}>
          {screen === 'home'  && <HomeScreen  products={products} cart={cart} onAdd={addToCart} onRemove={removeFromCart} setScreen={setScreen} search={search} setSearch={setSearch} />}
          {screen === 'search'&& <HomeScreen  products={products} cart={cart} onAdd={addToCart} onRemove={removeFromCart} setScreen={setScreen} search={search} setSearch={setSearch} />}
          {screen === 'cart'  && <CartScreen  products={products} cart={cart} onAdd={addToCart} onRemove={removeFromCart} setScreen={setScreen} />}
          {screen === 'admin' && <AdminScreen products={products} setProducts={setProducts} />}
        </View>
        <BottomNav screen={screen} setScreen={setScreen} cartCount={totalQty} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const st = StyleSheet.create({
  safeArea:        { flex: 1, backgroundColor: C.green },
  splash:          { flex: 1, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' },
  splashLogo:      { width: 140, height: 140, borderRadius: 20, backgroundColor: '#fff', marginBottom: 20 },
  splashTitle:     { color: '#fff', fontSize: 36, fontWeight: '900' },
  splashSub:       { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8 },
  header:          { paddingTop: Platform.OS === 'android' ? 8 : 0, paddingHorizontal: 14, paddingBottom: 12 },
  headerTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoSmall:       { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', padding: 2 },
  brandTxt:        { color: '#fff', fontSize: 20, fontWeight: '900' },
  locationTxt:     { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600' },
  cartBtn:         { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: 10, position: 'relative' },
  cartBadge:       { position: 'absolute', top: -4, right: -4, backgroundColor: C.orange, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  cartBadgeTxt:    { color: '#fff', fontSize: 10, fontWeight: '900' },
  backBtn:         { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  searchBox:       { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput:     { flex: 1, fontSize: 13, color: C.text, padding: 0 },
  deliveryStrip:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6 },
  deliveryTxt:     { color: '#fff', fontSize: 11, fontWeight: '700', flex: 1 },
  taglineTxt:      { color: 'rgba(255,255,255,0.45)', fontSize: 9 },
  tabRow:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1.5, borderBottomColor: C.border },
  tab:             { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabActive:       { borderBottomColor: C.green },
  tabTxt:          { fontSize: 12, fontWeight: '700', color: C.muted },
  tabTxtActive:    { color: C.green },
  subCatRow:       { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 50 },
  chip:            { minWidth: 70, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#fff', alignItems: 'center' },
  chipActive:      { borderColor: C.green, backgroundColor: C.greenLight },
  chipTxt:         { fontSize: 12, fontWeight: '700', color: C.muted },
  chipTxtActive:   { color: C.green },
  productCard:     { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border },
  emojiBox:        { backgroundColor: C.greenLight, height: 86, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  oosOverlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.65)', justifyContent: 'center', alignItems: 'center' },
  oosTxt:          { fontSize: 10, fontWeight: '700', color: C.muted, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  cardBody:        { padding: 10, gap: 3 },
  badge:           { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeTxt:        { fontSize: 9, fontWeight: '700' },
  productName:     { fontSize: 12, fontWeight: '700', color: C.text, lineHeight: 16 },
  productSub:      { fontSize: 10, color: C.muted },
  priceRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price:           { fontSize: 14, fontWeight: '800', color: C.text },
  addBtn:          { borderWidth: 2, borderColor: C.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  addTxt:          { fontSize: 11, fontWeight: '800', color: C.green },
  notifyBtn:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  notifyTxt:       { fontSize: 10, fontWeight: '700', color: C.muted },
  stepper:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn:         { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stepTxt:         { color: '#fff', fontSize: 16, fontWeight: '900', lineHeight: 20 },
  stepQty:         { fontSize: 13, fontWeight: '800', color: C.green, minWidth: 14, textAlign: 'center' },
  promoBanner:     { marginHorizontal: 12, marginBottom: 14, backgroundColor: C.orange, borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoSub:        { color: '#fff', fontSize: 11, fontWeight: '700' },
  promoTitle:      { color: '#fff', fontSize: 17, fontWeight: '900' },
  promoCode:       { color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 2 },
  emptyBox:        { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTxt:        { fontSize: 13, fontWeight: '600', color: C.muted },
  cartBar:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1.5, borderTopColor: C.border, padding: 10 },
  cartBarBtn:      { backgroundColor: C.green, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartBarBadge:    { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 20 },
  cartBarBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cartBarMid:      { color: '#fff', fontSize: 13, fontWeight: '800' },
  cartBarPrice:    { color: '#fff', fontSize: 13, fontWeight: '800' },
  deliveryCard:    { borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center' },
  cartItem:        { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  billCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: C.border },
  billRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billKey:         { fontSize: 12, color: C.muted },
  billVal:         { fontSize: 12, fontWeight: '600', color: C.text },
  adminToggleBtn:  { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  adminToggleTxt:  { color: '#fff', fontWeight: '800', fontSize: 12 },
  statsRow:        { flexDirection: 'row', gap: 8, marginTop: 12 },
  statCard:        { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 6, alignItems: 'center' },
  statVal:         { fontSize: 16, fontWeight: '900' },
  statLabel:       { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '600' },
  adminFilterBar:  { backgroundColor: '#fff', padding: 10, paddingHorizontal: 12, borderBottomWidth: 1.5, borderBottomColor: C.border },
  adminSearch:     { backgroundColor: C.bg, borderRadius: 10, padding: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  adminCard:       { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1.5 },
  formLabel:       { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 4 },
  formInput:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 13, color: C.text, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  pickerOpt:       { paddingHorizontal: 12, paddingVertical: 8, flex: 1 },
  pickerOptActive: { backgroundColor: C.greenLight },
  pickerOptTxt:    { fontSize: 12, fontWeight: '700', color: C.muted, textAlign: 'center' },
  submitBtn:       { backgroundColor: C.green, borderRadius: 14, padding: 14, alignItems: 'center' },
  submitTxt:       { color: '#fff', fontWeight: '800', fontSize: 14 },
  stockInput:      { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, fontWeight: '700', color: C.text, width: 60 },
  availBtn:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  availTxt:        { fontSize: 10, fontWeight: '800' },
  bottomNav:       { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1.5, borderTopColor: C.border, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  navItem:         { flex: 1, alignItems: 'center', paddingTop: 10, gap: 2, position: 'relative' },
  navLabel:        { fontSize: 10, fontWeight: '700', color: C.muted },
  navBadge:        { position: 'absolute', top: -4, right: -8, backgroundColor: C.red, borderRadius: 9, minWidth: 17, height: 17, justifyContent: 'center', alignItems: 'center' },
  navBadgeTxt:     { color: '#fff', fontSize: 9, fontWeight: '900' },
  navDot:          { width: 20, height: 3, borderRadius: 2, backgroundColor: C.green },
});