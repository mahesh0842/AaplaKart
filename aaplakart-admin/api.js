// ──────────────────────────────────────────────────────────────────
// API client for AaplaKart Admin Panel — FULL FIRESTORE MODE
// All data reads/writes go directly to Firestore.
// Backend API is used only for: admin login, health check
// ──────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────

function showError(msg) { 
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = msg;
    toast.className = 'toast error show';
    setTimeout(() => toast.className = 'toast', 3000);
  } else { alert(msg); }
}

function showSuccess(msg) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = msg;
    toast.className = 'toast success show';
    setTimeout(() => toast.className = 'toast', 3000);
  }
}

// ── Backend API (only for auth + health) ──────────────────────────

const API_BASE = (() => {
  const stored = localStorage.getItem('admin_api_base');
  if (stored) return stored;
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://aaplakart-backend.up.railway.app/api';
  }
  return 'http://localhost:8000/api';
})();

function getApiBase() { return API_BASE; }

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function apiRequest(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const options = { method, headers: getAuthHeaders() };
  if (body !== null) options.body = JSON.stringify(body);
  const resp = await fetch(url, options);
  const text = await resp.text();
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try { const err = JSON.parse(text); detail = err.detail || detail; } catch {}
    throw new Error(detail);
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function adminLogin(username, password) {
  const resp = await fetch(`${API_BASE}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || 'Login failed');
  return data;
}

function getHealth() { return apiRequest('GET', '/admin/health'); }

// ── Firestore Helpers ─────────────────────────────────────────────

function fsCol(name) { return firestore.collection(name); }
function fsDoc(col, id) { return fsCol(col).doc(id); }

// Generic Firestore CRUD (with timeout to avoid hanging UI)
async function fsGetAll(collection, orderByField = null, desc = true, limit = 500) {
  let q = fsCol(collection);
  if (orderByField) q = q.orderBy(orderByField, desc ? 'desc' : 'asc');
  if (limit) q = q.limit(limit);
  const snap = await fsWithTimeout(q.get(), 4000);
  const results = [];
  snap.forEach(d => results.push({ id: d.id, ...d.data() }));
  return results;
}

async function fsGetWhere(collection, field, op, value, orderByField = null, desc = true, limit = 500) {
  let q = fsCol(collection).where(field, op, value);
  if (orderByField) q = q.orderBy(orderByField, desc ? 'desc' : 'asc');
  if (limit) q = q.limit(limit);
  const snap = await fsWithTimeout(q.get(), 2000);
  const results = [];
  snap.forEach(d => results.push({ id: d.id, ...d.data() }));
  return results;
}

async function fsGetDoc(collection, docId) {
  const snap = await fsWithTimeout(fsDoc(collection, docId).get(), 2000);
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function fsSet(collection, docId, data) {
  await fsWithTimeout(fsDoc(collection, docId).set(data, { merge: false }), 2000);
  return { id: docId, ...data };
}

async function fsUpdate(collection, docId, data) {
  await fsWithTimeout(fsDoc(collection, docId).update(data), 2000);
  return { id: docId };
}

async function fsDelete(collection, docId) {
  await fsWithTimeout(fsDoc(collection, docId).delete(), 2000);
  return { success: true };
}

async function fsAdd(collection, data) {
  const ref = await fsWithTimeout(fsCol(collection).add(data), 2000);
  return { id: ref.id, ...data };
}

// ──────────────────────────────────────────────────────────────────
// ALL DATA OPERATIONS VIA FIRESTORE
// ──────────────────────────────────────────────────────────────────

// ═══════════════════════ ORDERS ═══════════════════════════════════

async function getOrders(params = {}) {
  // Backend API (SQLite) — active orders only. No Firestore fallback.
  const q = new URLSearchParams();
  if (params.status) q.set('status_filter', params.status);
  if (params.page) q.set('page', params.page);
  if (params.page_size) q.set('page_size', params.page_size);
  const res = await apiRequest('GET', `/admin/orders${q.toString() ? '?'+q.toString() : ''}`);
  return res.orders || [];
}

async function updateOrderStatus(orderId, status) {
  // Single API call — backend handles SQLite + Firestore + WebSocket broadcast
  try {
    return await apiRequest('PATCH', `/admin/orders/${orderId}/status`, { status });
  } catch (e) {
    throw new Error(e.message || 'Status update failed');
  }
}

async function updateOrderData(orderId, data) {
  try {
    data.updated_at = new Date().toISOString();
    await fsUpdate('orders', orderId, data);
    return { success: true, order_id: orderId };
  } catch (e) {
    // Fallback to API
    const resp = await fetch(`${API_BASE}/admin/orders/${orderId}/edit`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.detail || 'Update failed');
    return result;
  }
}

// ═══════════════════ BATCH ARCHIVE (Firestore Sync) ══════════════

async function getArchiveStatus() {
  try {
    return await apiRequest('GET', '/admin/orders/archive-status');
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function getPendingSyncCount() {
  try {
    return await apiRequest('GET', '/admin/orders/pending-sync-count');
  } catch (e) {
    return { success: false, pending_sync_count: 0, message: e.message };
  }
}

async function triggerBatchSync() {
  try {
    const res = await apiRequest('POST', '/admin/orders/batch-sync');
    showSuccess(res.message || 'Batch sync started!');
    return res;
  } catch (e) {
    showError(e.message || 'Sync failed');
    return { success: false };
  }
}

async function verifyAndClean(orderIds = null) {
  try {
    const body = orderIds && orderIds.length ? { order_ids: orderIds } : {};
    const res = await apiRequest('POST', '/admin/orders/verify-and-clean', body);
    if (res.deleted_count > 0) {
      showSuccess(`✅ ${res.deleted_count} orders cleaned from SQLite!`);
    } else {
      showSuccess('No orders to clean — all verified.');
    }
    return res;
  } catch (e) {
    showError(e.message || 'Clean failed');
    return { success: false, deleted_count: 0 };
  }
}

// ═══════════════════════ PRODUCTS ═════════════════════════════════

async function fetchProducts(params = {}) {
  // API first (fast JSON), Firestore fallback
  try {
    const q = new URLSearchParams();
    if (params.type) q.set('type', params.type);
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    return await apiRequest('GET', `/products${q.toString() ? '?'+q.toString() : ''}`);
  } catch (e) {
    console.warn('[API] Products failed, trying Firestore:', e.message);
    try {
      let products = await fsGetAll('products', 'name', false);
      if (!products) products = [];
      if (params.type) products = products.filter(p => p.type === params.type);
      if (params.category && params.category !== 'All') products = products.filter(p => p.category === params.category);
      if (params.search) {
        const s = params.search.toLowerCase();
        products = products.filter(p => (p.name||'').toLowerCase().includes(s) || (p.category||'').toLowerCase().includes(s));
      }
      return { success: true, count: products.length, products };
    } catch (e2) {
      return { success: true, count: 0, products: [] };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCTS VIA BACKEND API (JSON-based catalog)
// ═══════════════════════════════════════════════════════════════════

async function createProduct(data) {
  return apiRequest('POST', '/admin/catalog/products', data);
}

async function updateProduct(id, data) {
  return apiRequest('PUT', '/admin/catalog/products/' + id, data);
}

async function deleteProduct(id) {
  return apiRequest('DELETE', '/admin/catalog/products/' + id);
}

async function toggleProductStatus(id, stock) {
  return apiRequest('PATCH', '/admin/catalog/products/' + id + '/stock', { stock });
}

// ═══════════════════════ CATEGORIES / SECTIONS ════════════════════

// ═══════════════════════ SECTIONS & CATEGORIES (Backend API) ════

async function fetchSections(type) {
  try {
    return await apiRequest('GET', `/categories/sections${type ? '?type='+type : ''}`);
  } catch (e) {
    console.warn('[API] Sections failed:', e.message);
    return { success: true, sections: [] };
  }
}

async function createSection(data) {
  return apiRequest('POST', '/admin/catalog/sections', data);
}

async function updateSection(id, data) {
  return apiRequest('PUT', '/admin/catalog/sections/' + id, data);
}

async function deleteSection(id) {
  return apiRequest('DELETE', '/admin/catalog/sections/' + id);
}

async function addCategoryToSection(sectionId, catData) {
  return apiRequest('POST', '/admin/catalog/categories', {
    name: catData.name,
    section_id: sectionId,
    image: catData.image || '',
    subcategories: catData.subcategories || [],
  });
}

async function updateCategoryInSection(sectionId, catId, catData) {
  return apiRequest('PUT', '/admin/catalog/categories/' + catId, catData);
}

async function deleteCategoryFromSection(sectionId, catId) {
  return apiRequest('DELETE', '/admin/catalog/categories/' + catId);
}

// ═══════════════════════ SHOPS ════════════════════════════════════

async function fetchShops() {
  try {
    return await apiRequest('GET', '/admin/shops/');
  } catch (e) {
    console.warn('[API] Shops failed, trying Firestore:', e.message);
    try {
      const shops = await fsGetAll('shops', 'name', false);
      return { success: true, shops: shops || [] };
    } catch (e2) {
      return { success: true, shops: [] };
    }
  }
}

async function createShop(data) {
  try {
    const id = 'shop-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    await fsSet('shops', id, { ...data, id, is_active: true, created_at: new Date().toISOString() });
    return { success: true, shop: { id, ...data } };
  } catch (e) {
    return apiRequest('POST', '/admin/shops/', data);
  }
}

async function updateShop(id, data) {
  try {
    data.updated_at = new Date().toISOString();
    await fsUpdate('shops', id, data);
    return { success: true, shop: { id, ...data } };
  } catch (e) {
    return apiRequest('PUT', `/admin/shops/${id}`, data);
  }
}

async function deleteShopApi(id) {
  try {
    await fsDelete('shops', id);
    return { success: true };
  } catch (e) {
    return apiRequest('DELETE', `/admin/shops/${id}`);
  }
}

function findNearestShop(lat, lon) {
  // Simple: return first active shop from Firestore (no haversine in JS needed for admin)
  return fetchShops().then(res => {
    const shops = (res.shops || []).filter(s => s.is_active);
    if (!shops.length) return { success: false, shop: null };
    // Pick closest by linear distance approximation
    let best = shops[0], bestDist = Infinity;
    shops.forEach(s => {
      const d = Math.abs(s.latitude - lat) + Math.abs(s.longitude - lon);
      if (d < bestDist) { bestDist = d; best = s; }
    });
    return { success: true, shop: best };
  }).catch(() => apiRequest('GET', `/admin/shops/nearest?lat=${lat}&lon=${lon}`));
}

// ═══════════════════════ PROMOS ═══════════════════════════════════

async function fetchAdminPromos(params = {}) {
  try {
    const q = new URLSearchParams();
    if (params.brand) q.set('brand', params.brand);
    if (params.position) q.set('position', params.position);
    return await apiRequest('GET', `/admin/promos${q.toString() ? '?'+q.toString() : ''}`);
  } catch (e) {
    console.warn('[API] Promos failed, trying Firestore:', e.message);
    try {
      let promos = await fsGetAll('promos', 'sortOrder', false);
      if (!promos) promos = [];
      if (params.brand) promos = promos.filter(p => p.brand === params.brand);
      if (params.position) promos = promos.filter(p => p.position === params.position);
      return { success: true, promos };
    } catch (e2) {
      return { success: true, promos: [] };
    }
  }
}

async function createPromo(data) {
  try {
    const id = 'promo-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    await fsSet('promos', id, { ...data, id, created_at: new Date().toISOString() });
    return { success: true, promo: { id, ...data } };
  } catch (e) {
    return apiRequest('POST', '/admin/promos', data);
  }
}

async function updatePromo(id, data) {
  try {
    data.updated_at = new Date().toISOString();
    await fsUpdate('promos', id, data);
    return { success: true, promo: { id, ...data } };
  } catch (e) {
    return apiRequest('PUT', `/admin/promos/${id}`, data);
  }
}

async function deletePromo(id) {
  try {
    await fsDelete('promos', id);
    return { success: true };
  } catch (e) {
    return apiRequest('DELETE', `/admin/promos/${id}`);
  }
}

async function togglePromo(id) {
  try {
    const promo = await fsGetDoc('promos', id);
    if (!promo) throw new Error('Promo not found');
    await fsUpdate('promos', id, { active: !promo.active });
    return { success: true, active: !promo.active };
  } catch (e) {
    return apiRequest('PATCH', `/admin/promos/${id}/toggle`);
  }
}

// ═══════════════════════ CONFIG ═══════════════════════════════════

async function fetchAdminConfig() {
  try {
    return await apiRequest('GET', '/admin/config');
  } catch (e) {
    console.warn('[API] Config failed, trying Firestore:', e.message);
    try {
      const config = await fsGetDoc('config', 'app_config');
      return { success: true, config: config || {} };
    } catch (e2) {
      return { success: true, config: {} };
    }
  }
}

async function updateAdminConfig(data) {
  try {
    data.updated_at = new Date().toISOString();
    await fsSet('config', 'app_config', data);
    return { success: true, config: data };
  } catch (e) {
    return apiRequest('PUT', '/admin/config', data);
  }
}

// ═══════════════════════ USERS ════════════════════════════════════

async function fetchAdminUsers() {
  try {
    return await apiRequest('GET', '/admin/users');
  } catch (e) {
    console.warn('[API] Users failed, trying Firestore:', e.message);
    try {
      const users = await fsGetAll('users', 'created_at', true);
      return { success: true, users: users || [] };
    } catch (e2) {
      return { success: true, users: [] };
    }
  }
}

// ═══════════════════════ STATS ════════════════════════════════════

async function getStats() {
  // API first (fast SQLite), Firestore fallback
  try {
    return await apiRequest('GET', '/admin/stats');
  } catch (e) {
    console.warn('[API] Stats failed, trying Firestore:', e.message);
    try {
      const [orders, products, sections, users] = await Promise.all([
        fsGetAll('orders', 'placed_at', true),
        fsGetAll('products'),
        fsGetAll('sections'),
        fsGetAll('users', 'created_at', true),
      ]);
      const orderStatuses = {};
      let totalRevenue = 0;
      (orders || []).forEach(o => {
        orderStatuses[o.status] = (orderStatuses[o.status] || 0) + 1;
        if (['delivered','confirmed','preparing','out-for-delivery'].includes(o.status)) {
          totalRevenue += Number(o.total || 0);
        }
      });
      return {
        success: true,
        stats: {
          total_products: (products||[]).length,
          kart_products: (products||[]).filter(p => p.type === 'kart').length,
          waffle_products: (products||[]).filter(p => p.type === 'app').length,
          out_of_stock: (products||[]).filter(p => Number(p.stock) === 0).length,
          total_sections: (sections||[]).length,
          total_categories: (sections||[]).reduce((sum, s) => sum + (s.categories||[]).length, 0),
          total_subcategories: (sections||[]).reduce((sum, s) => sum + (s.categories||[]).reduce((s2, c) => s2 + (c.subcategories||[]).length, 0), 0),
          total_users: (users||[]).length,
          total_orders: (orders||[]).length,
          orders_by_status: orderStatuses,
          total_revenue: totalRevenue,
        },
      };
    } catch (e2) {
      return { success: true, stats: {} };
    }
  }
}
