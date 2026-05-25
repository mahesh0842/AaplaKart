// API client for AaplaKart Admin Panel
// Auto-detects environment based on hostname
// - Production: aaplakart.org ya Railway URL use hota hai
// - Development: localhost:8000 use hota hai

const API_BASE = (() => {
  // 1. Override via localStorage (for testing)
  const stored = localStorage.getItem('admin_api_base');
  if (stored) return stored;

  // 2. Production domain — backend.aaplakart.org (subdomain)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://aaplakart-backend.up.railway.app/api';
  }

  // 3. Local development
  return 'http://localhost:8000/api';
})();

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function getApiBase() { return API_BASE; }

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

async function apiRequest(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: getAuthHeaders(),
  };
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

// ── Auth ──
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

// ── Admin APIs ──
function getHealth() { return apiRequest('GET', '/admin/health'); }
function getStats() { return apiRequest('GET', '/admin/stats'); }
function getOrders(params = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status_filter', params.status);
  if (params.page) q.set('page', params.page);
  if (params.page_size) q.set('page_size', params.page_size);
  const qs = q.toString();
  return apiRequest('GET', `/admin/orders${qs ? '?'+qs : ''}`);
}
function updateOrderStatus(orderId, status) {
  return apiRequest('PATCH', `/admin/orders/${orderId}/status`, { status });
}

// ── Product APIs ──
function fetchProducts(params = {}) {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.category) q.set('category', params.category);
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return apiRequest('GET', `/products${qs ? '?'+qs : ''}`);
}
function createProduct(data) { return apiRequest('POST', '/products', data); }
function updateProduct(id, data) { return apiRequest('PUT', `/products/${id}`, data); }
function deleteProduct(id) { return apiRequest('DELETE', `/products/${id}`); }
function toggleProductStatus(id, stock) { return apiRequest('PATCH', `/products/${id}/status`, { stock }); }

// ── Category APIs ──
function fetchSections(type) {
  const q = type ? `?type=${type}` : '';
  return apiRequest('GET', `/categories/sections${q}`);
}
function createSection(data) { return apiRequest('POST', '/admin/categories/section', data); }
function deleteSection(id) { return apiRequest('DELETE', `/admin/categories/section/${id}`); }

// ── Shop APIs ──
function fetchShops() { return apiRequest('GET', '/admin/shops/'); }
function createShop(data) { return apiRequest('POST', '/admin/shops/', data); }
function updateShop(id, data) { return apiRequest('PUT', `/admin/shops/${id}`, data); }
function deleteShopApi(id) { return apiRequest('DELETE', `/admin/shops/${id}`); }
function findNearestShop(lat, lon) { return apiRequest('GET', `/admin/shops/nearest?lat=${lat}&lon=${lon}`); }

// ── Promo APIs ──
function fetchAdminPromos(params = {}) {
  const q = new URLSearchParams();
  if (params.brand) q.set('brand', params.brand);
  if (params.position) q.set('position', params.position);
  const qs = q.toString();
  return apiRequest('GET', `/admin/promos${qs ? '?'+qs : ''}`);
}
function createPromo(data) { return apiRequest('POST', '/admin/promos', data); }
function updatePromo(id, data) { return apiRequest('PUT', `/admin/promos/${id}`, data); }
function deletePromo(id) { return apiRequest('DELETE', `/admin/promos/${id}`); }
function togglePromo(id) { return apiRequest('PATCH', `/admin/promos/${id}/toggle`); }

// ── Config API ──
function fetchAdminConfig() { return apiRequest('GET', '/admin/config'); }
function updateAdminConfig(data) { return apiRequest('PUT', '/admin/config', data); }

// ── User API ──
function fetchAdminUsers() { return apiRequest('GET', '/admin/users'); }
