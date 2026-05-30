
// ── State ──
let currentPage = 'login';
let allProducts = [];
let allSections = [];
let allOrders = [];
let statsData = null;
let healthData = null;

// ── Security: HTML escape to prevent XSS ──
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ── Router ──
function navigate(page) {
  currentPage = page;
  render();
}

// ── App Renderer ──
function render() {
  const token = localStorage.getItem('admin_token');
  if (!token) { currentPage = 'login'; }
  else if (currentPage === 'login') { currentPage = 'dashboard'; }
  
  const app = document.getElementById('app');
  if (currentPage === 'login') { renderLogin(app); }
  else { renderDashboard(app); }
}

// ════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ════════════════════════════════════════════════════════════════
function renderLogin(container) {
  container.innerHTML = `
    <div class="login-bg">
      <div class="login-card">
        <img src="logo.png" alt="AaplaKart" style="height:64px;margin-bottom:8px" />
        <h1>AaplaKart Admin</h1>
        <p class="login-sub">Enter credentials to manage your store</p>
        <div id="login-error" class="login-error" style="display:none"></div>
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="login-user" placeholder="Enter username" value="admin" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="login-pass" placeholder="Enter password" value="admin@123" onkeydown="if(event.key==='Enter') handleLogin()" />
        </div>
        <button onclick="handleLogin()" id="login-btn" class="btn-primary btn-full">Sign In</button>
        <p class="login-hint">Default: admin / admin@123</p>
      </div>
    </div>
  `;
}

async function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  
  if (!user || !pass) { showError('Please enter username and password'); return; }
  
  btn.disabled = true; btn.textContent = 'Signing in...';
  errEl.style.display = 'none';
  
  try {
    const res = await adminLogin(user, pass);
    localStorage.setItem('admin_token', res.id_token);
    localStorage.setItem('admin_user', user);
    btn.disabled = false;
    navigate('dashboard');
  } catch(e) {
    errEl.textContent = e.message || 'Login failed';
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
let activeTab = 'dashboard';

function renderDashboard(container) {
  const user = localStorage.getItem('admin_user') || 'Admin';
  container.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-brand">
        <img src="logo.png" alt="AaplaKart" style="height:36px;width:36px;border-radius:8px" />
        <span class="sidebar-title">AaplaKart</span>
        <span id="backend-status-wrap" class="status-ring-wrap" title="Backend status">
          <span id="backend-status-ring" class="status-ring"></span>
          <span id="backend-status-text" class="status-ring-text">...</span>
        </span>
      </div>
      <div class="sidebar-user">👤 ${user}</div>
      <nav class="sidebar-nav">
        <a class="nav-item ${activeTab==='dashboard'?'active':''}" onclick="switchTab('dashboard')">📊 Dashboard</a>
        <a class="nav-item ${activeTab==='products'?'active':''}" onclick="switchTab('products')">📦 Products</a>
        <a class="nav-item ${activeTab==='orders'?'active':''}" onclick="switchTab('orders')">📋 Orders</a>
        <a class="nav-item" href="catalog.html" target="_blank" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border-radius:10px;margin:4px 0;">📦 Catalog Manager</a>
        <a class="nav-item ${activeTab==='categories'?'active':''}" onclick="switchTab('categories')">🏷️ Categories</a>
        <a class="nav-item ${activeTab==='promos'?'active':''}" onclick="switchTab('promos')">🎯 Promos</a>
        <a class="nav-item ${activeTab==='health'?'active':''}" onclick="switchTab('health')">🔬 System Health</a>
        <a class="nav-item ${activeTab==='perf'?'active':''}" onclick="switchTab('perf')">⚡ API Perf</a>
        <a class="nav-item ${activeTab==='config'?'active':''}" onclick="switchTab('config')">⚙️ Config</a>
        <a class="nav-item ${activeTab==='shops'?'active':''}" onclick="switchTab('shops')">🏪 Shops</a>
        <a class="nav-item ${activeTab==='users'?'active':''}" onclick="switchTab('users')">👥 Users</a>
        <a class="nav-item" onclick="seedToFirestore()" title="Sync all backend data to Firestore">🔄 Sync to Firestore</a>
      </nav>
      <div class="sidebar-footer">
        <a class="nav-item" onclick="handleLogout()">🚪 Logout</a>
      </div>
    </div>
    <div class="main-content">
      <div class="topbar">
        <h2 id="page-title">Dashboard</h2>
        <div class="topbar-right">
          <span id="clock" class="clock"></span>
          <button class="btn-refresh" onclick="refreshCurrent()" title="Refresh">🔄</button>
        </div>
      </div>
      <div id="tab-content" class="tab-content"></div>
    </div>
  `;
  
  updateClock();
  setInterval(updateClock, 1000);
  switchTab(activeTab);
}

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleString('en-IN');
}

function handleLogout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  activeTab = 'dashboard';
  navigate('login');
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[onclick*="'${tab}'"]`);
  if (navItem) navItem.classList.add('active');
  
  const titles = { dashboard: '📊 Dashboard', products: '📦 Products', orders: '📋 Orders', categories: '🏷️ Categories', promos: '🎯 Promos', shops: '🏪 Shops', health: '🔬 System Health', perf: '⚡ API Perf', config: '⚙️ Config', users: '👥 Users' };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[tab] || 'Dashboard';
  
  const content = document.getElementById('tab-content');
  if (!content) return;
  
  if (tab === 'dashboard') renderDashboardTab(content);
  else if (tab === 'products') renderProductsTab(content);
  else if (tab === 'orders') renderOrdersTab(content);
  else if (tab === 'categories') renderCategoriesTab(content);
  else if (tab === 'promos') renderPromosTab(content);
  else if (tab === 'health') renderHealthTab(content);
  else if (tab === 'perf') renderApiPerfTab(content);
  else if (tab === 'config') renderConfigTab(content);
  else if (tab === 'shops') renderShopsTab(content);
  else if (tab === 'users') renderUsersTab(content);
}

function refreshCurrent() { switchTab(activeTab); }

// ════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ════════════════════════════════════════════════════════════════
async function renderDashboardTab(container) {
  container.innerHTML = '<div class="loading">Loading dashboard...</div>';
  try {
    const [statsRes, healthRes] = await Promise.all([getStats(), getHealth()]);
    statsData = statsRes.stats || {};
    healthData = healthRes.checks || {};
    
    const s = statsData;
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon" style="background:#fff7ed;color:#f97316">📦</div><div class="stat-num">${s.total_products ?? 'N/A'}</div><div class="stat-label">Total Products</div><div class="stat-sub">Kart: ${s.kart_products ?? 'N/A'} · Waffle: ${s.waffle_products ?? 'N/A'}</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fef2f2;color:#ef4444">📋</div><div class="stat-num">${s.total_orders ?? 'N/A'}</div><div class="stat-label">Total Orders</div><div class="stat-sub">${s.total_revenue ? '₹' + Number(s.total_revenue).toFixed(0) : 'N/A'} revenue</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#f0fdf4;color:#22c55e">👥</div><div class="stat-num">${s.total_users ?? 'N/A'}</div><div class="stat-label">Total Users</div><div class="stat-sub">Registered accounts</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fefce8;color:#eab308">🏷️</div><div class="stat-num">${s.total_categories ?? 'N/A'}</div><div class="stat-label">Categories</div><div class="stat-sub">${s.total_sections ?? 'N/A'} sections · ${s.total_subcategories ?? 'N/A'} subcategories</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#eff6ff;color:#3b82f6">⚠️</div><div class="stat-num">${s.out_of_stock ?? 'N/A'}</div><div class="stat-label">Out of Stock</div><div class="stat-sub">Products need attention</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#f5f3ff;color:#8b5cf6">📊</div><div class="stat-num">${s.total_orders ? Object.values(s.orders_by_status || {}).reduce((a,b)=>a+b,0) : 'N/A'}</div><div class="stat-label">Active Orders</div><div class="stat-sub">${s.orders_by_status ? Object.entries(s.orders_by_status).map(([k,v])=>k+':'+v).join(' · ') : ''}</div></div>
      </div>
      <div class="card" style="margin-top:20px">
        <h3>System Health</h3>
        <div class="health-grid">
          ${Object.entries(healthRes.checks || {}).map(([k,v]) => `
            <div class="health-item">
              <span class="health-name">${k}</span>
              <span class="health-status ${v.status === 'ok' || v.status === 'configured' ? 'ok' : 'err'}">${v.status}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="error-card">Failed to load dashboard: ${escapeHtml(e.message)}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
// TAB: PRODUCTS
// ════════════════════════════════════════════════════════════════
async function renderProductsTab(container) {
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select id="product-type-filter" onchange="loadProducts()">
          <option value="">All Types</option>
          <option value="kart">AaplaKart</option>
          <option value="app">The Waffle Guy</option>
        </select>
        <input type="text" id="product-search" placeholder="Search products..." onkeyup="loadProducts()" />
      </div>
      <button class="btn-primary" onclick="showAddProduct()">+ Add Product</button>
    </div>
    <div id="products-loading" class="loading">Loading products...</div>
    <div id="products-table-wrap"></div>
  `;
  await loadProducts();
}

async function loadProducts() {
  const loading = document.getElementById('products-loading');
  const wrap = document.getElementById('products-table-wrap');
  if (!loading || !wrap) return;
  
  loading.style.display = 'block';
  const type = document.getElementById('product-type-filter')?.value || '';
  const search = document.getElementById('product-search')?.value || '';
  
  try {
    const res = await fetchProducts({ type, search });
    allProducts = res.products || [];
    loading.style.display = 'none';
    
    if (allProducts.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No products found</div>';
      return;
    }
    
    wrap.innerHTML = `
      <table class="table">
        <thead><tr>
          <th>Image</th><th>Name</th><th>Price</th><th>Category</th><th>Type</th><th>Stock</th><th>Rating</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${allProducts.map(p => `
            <tr>
              <td><img src="${escapeHtml(p.image || '')}" onerror="this.src='https://via.placeholder.com/40?text=N/A'" style="width:40px;height:40px;border-radius:8px;object-fit:cover" alt="${escapeHtml(p.name || '')}" /></td>
              <td><strong>${escapeHtml(p.name || '')}</strong></td>
              <td>₹${escapeHtml(String(p.price || '0'))}</td>
              <td>${escapeHtml(p.category || '')}</td>
              <td><span class="badge ${p.type==='app'?'badge-waffle':'badge-kart'}">${p.type==='app'?'🧇 Waffle':'🛒 Kart'}</span></td>
              <td><span class="badge ${Number(p.stock) > 0 ? 'badge-instock' : 'badge-ostock'}">${Number(p.stock) > 0 ? escapeHtml(String(p.stock))+' in stock' : 'Out of stock'}</span></td>
              <td>${'⭐'.repeat(Math.round(p.rating || 0))}</td>
              <td class="actions-cell">
                <label class="vt-switch" title="Toggle variant selector" style="margin-right:6px;">
                  <input type="checkbox" ${p.showVariants?'checked':''} onchange="toggleVariants('${escapeHtml(p.id || '')}', this.checked)" tabindex="-1" />
                  <span class="vt-slider"></span>
                </label>
                <button class="btn-sm btn-edit" onclick="showEditProduct('${escapeHtml(p.id || '')}')">✏️</button>
                <button class="btn-sm btn-toggle" onclick="toggleStock('${escapeHtml(p.id || '')}', ${p.stock || 0})">${Number(p.stock) > 0 ? '🔴' : '🟢'}</button>
                <button class="btn-sm btn-del" onclick="showDeleteProduct('${escapeHtml(p.id || '')}','${escapeHtml(p.name || '').replace(/'/g, "\\'")}')">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="table-footer">${allProducts.length} products total</div>
    `;
  } catch(e) {
    loading.style.display = 'none';
    wrap.innerHTML = `<div class="error-card">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function showAddProduct() {
  showFormModal('Add Product', `
    <div class="form-group"><label>Name *</label><input id="pf-name" placeholder="Product name" /></div>
    <div class="form-row">
      <div class="form-group"><label>Category *</label>
        <select id="pf-category"><option value="">Select...</option><option value="Vegetables">Vegetables</option><option value="Dairy">Dairy</option><option value="Fruits">Fruits</option><option value="Grains & Dal">Grains & Dal</option><option value="Spices & Masala">Spices & Masala</option><option value="Biscuits & Cookies">Biscuits & Cookies</option><option value="Beverages">Beverages</option><option value="Snacks">Snacks</option></select>
      </div>
      <div class="form-group"><label>Subcategory</label><input id="pf-subcategory" placeholder="e.g. Leafy Greens" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Type</label><select id="pf-type"><option value="kart">AaplaKart</option><option value="app">The Waffle Guy</option></select></div>
      <div class="form-group"><label>Unit</label><select id="pf-unit"><option value="kg">kg</option><option value="g">g</option><option value="pcs">pcs</option><option value="L">L</option><option value="ml">ml</option><option value="dozen">dozen</option><option value="packet">packet</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Base Price (₹) *</label><input id="pf-baseprice" type="number" placeholder="0" /></div>
      <div class="form-group"><label>Stock</label><input id="pf-stock" type="number" value="10" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Delivery Time</label><input id="pf-delivery" value="20 min" /></div>
      <div class="form-group"><label>Max Qty/Order</label><input id="pf-maxqty" type="number" value="10" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Rating</label><input id="pf-rating" type="number" value="4.5" step="0.1" /></div>
      <div class="form-group"><label>Image URL</label><input id="pf-image" placeholder="https://..." /></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="pf-desc" rows="2" placeholder="Product description"></textarea></div>
    <div class="form-group" style="display:flex;gap:20px;">
      <label style="font-weight:400;gap:6px;display:flex;align-items:center;"><input type="checkbox" id="pf-available" checked /> Available</label>
      <label style="font-weight:400;gap:6px;display:flex;align-items:center;"><input type="checkbox" id="pf-showvars" /> Show Variants</label>
    </div>
    <button class="btn-primary btn-full" onclick="saveProduct()">Save Product</button>
  `);
}

function showEditProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return showError('Product not found');
  showFormModal('Edit Product: ' + p.name, `
    <div class="form-group"><label>Name *</label><input id="pf-name" value="${p.name || ''}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Category *</label><input id="pf-category" value="${p.category || ''}" /></div>
      <div class="form-group"><label>Subcategory</label><input id="pf-subcategory" value="${p.subcategory || ''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Type</label><select id="pf-type"><option value="kart" ${p.type==='kart'?'selected':''}>AaplaKart</option><option value="app" ${p.type==='app'?'selected':''}>The Waffle Guy</option></select></div>
      <div class="form-group"><label>Unit</label><select id="pf-unit"><option value="kg" ${p.unit==='kg'?'selected':''}>kg</option><option value="g" ${p.unit==='g'?'selected':''}>g</option><option value="pcs" ${p.unit==='pcs'?'selected':''}>pcs</option><option value="L" ${p.unit==='L'?'selected':''}>L</option><option value="ml" ${p.unit==='ml'?'selected':''}>ml</option><option value="dozen" ${p.unit==='dozen'?'selected':''}>dozen</option><option value="packet" ${p.unit==='packet'?'selected':''}>packet</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Base Price (₹)</label><input id="pf-baseprice" type="number" value="${p.price || 0}" /></div>
      <div class="form-group"><label>Stock</label><input id="pf-stock" type="number" value="${p.stock || 0}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Max Qty/Order</label><input id="pf-maxqty" type="number" value="${p.maxQuantity || 10}" /></div>
      <div class="form-group"><label>Rating</label><input id="pf-rating" type="number" value="${p.rating || 4.5}" step="0.1" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Delivery Time</label><input id="pf-delivery" value="${p.deliveryTime || '20 min'}" /></div>
      <div class="form-group"><label>Image URL</label><input id="pf-image" value="${p.image || ''}" /></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="pf-desc" rows="2">${p.description || ''}</textarea></div>
    <div class="form-group" style="display:flex;gap:20px;">
      <label style="font-weight:400;gap:6px;display:flex;align-items:center;"><input type="checkbox" id="pf-available" ${p.isAvailable!==false?'checked':''} /> Available</label>
      <label style="font-weight:400;gap:6px;display:flex;align-items:center;"><input type="checkbox" id="pf-showvars" ${p.showVariants?'checked':''} /> Show Variants</label>
    </div>
    <button class="btn-primary btn-full" onclick="saveProduct('${id}')">Update Product</button>
  `);
}

async function saveProduct(editId = null) {
  const data = {
    name: document.getElementById('pf-name').value.trim(),
    category: document.getElementById('pf-category').value,
    subcategory: document.getElementById('pf-subcategory').value.trim(),
    type: document.getElementById('pf-type').value,
    unit: document.getElementById('pf-unit').value,
    price: parseFloat(document.getElementById('pf-baseprice').value) || 0,
    stock: parseInt(document.getElementById('pf-stock').value) || 0,
    max_quantity: parseInt(document.getElementById('pf-maxqty').value) || 10,
    rating: parseFloat(document.getElementById('pf-rating').value) || 4.5,
    delivery_time: document.getElementById('pf-delivery').value,
    image: document.getElementById('pf-image').value.trim(),
    description: document.getElementById('pf-desc').value.trim(),
    is_available: document.getElementById('pf-available').checked,
    show_variants: document.getElementById('pf-showvars').checked,
    brand: document.getElementById('pf-type').value === 'kart' ? 'kart' : 'waffle',
  };
  if (!data.name || !data.category || !data.price) {
    return showError('Name, category and price are required');
  }
  try {
    if (editId) { await updateProduct(editId, data); showSuccess('Product updated!'); }
    else { await createProduct(data); showSuccess('Product created!'); }
    closeModal();
    loadProducts();
    toastAdmin('Product saved! App will reflect changes instantly.');
  } catch(e) { showError(e.message); }
}

async function toggleStock(id, currentStock) {
  try {
    const newStock = currentStock > 0 ? 0 : 10;
    await toggleProductStatus(id, newStock);
    showSuccess(newStock > 0 ? 'Product back in stock!' : 'Product out of stock');
    loadProducts();
  } catch(e) { showError(e.message); }
}

function showDeleteProduct(id, name) {
  if (confirm(`Delete "${name}"? This cannot be undone.`)) {
    deleteProduct(id).then(() => { showSuccess('Product deleted'); loadProducts(); }).catch(e => showError(e.message));
  }
}

async function toggleVariants(pid, show) {
  try {
    await apiRequest('PATCH', `/admin/catalog/products/${pid}/toggle-variants`);
    showSuccess(show ? '🟢 Variants ON — modal with options' : '⚪ Variants OFF — direct add');
    loadProducts();
  } catch(e) { showError(e.message); }
}

// ════════════════════════════════════════════════════════════════
// TAB: ORDERS
// ════════════════════════════════════════════════════════════════
async function renderOrdersTab(container) {
  // Reset table init flag so table is recreated every time (fixes tab navigation)
  _ordersTableInitialized = false;
  container.innerHTML = `
    <div id="sync-status-bar" class="sync-status-bar" style="display:none">
      <div class="sync-status-inner">
        <span id="sync-status-icon">🔄</span>
        <span id="sync-status-text">Checking archive status...</span>
        <span id="sync-status-counts"></span>
        <div class="sync-status-actions">
          <button id="btn-batch-sync" class="btn-sm btn-warning" onclick="handleBatchSync()" style="display:none">🔄 Sync to Firestore</button>
          <button id="btn-verify-clean" class="btn-sm btn-success" onclick="handleVerifyClean()" style="display:none">✅ Verify & Clean SQLite</button>
        </div>
      </div>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <select id="order-status-filter" onchange="loadOrders()">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="out-for-delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span id="ws-status" class="ws-badge" title="WebSocket status">🟢 Live</span>
      </div>
      <div class="toolbar-right">
        <button class="btn-secondary" onclick="exportOrdersCSV()" title="Export as CSV">📥 CSV</button>
      </div>
    </div>
    <div id="orders-loading" class="loading">Loading orders...</div>
    <div id="orders-table-wrap"></div>
  `;
  await loadOrders();
  startPolling();
  refreshSyncStatus(); // Initial load + start periodic refresh
  if (!window._syncStatusInterval) {
    window._syncStatusInterval = setInterval(refreshSyncStatus, 15000); // every 15s
  }
}

function startPolling() {
  if (window._ordersPollTimer) clearInterval(window._ordersPollTimer);
  // Single 10s poll — covers both live updates + fallback refresh
  window._ordersPollTimer = setInterval(() => {
    if (window._updatingOrder || window._pausePolling) return;
    loadOrders();
  }, 10000);
}

function pausePolling(ms = 3000) {
  window._pausePolling = true;
  setTimeout(() => { window._pausePolling = false; }, ms);
}

// ════════════════════════════════════════════════════════════════
// BATCH ARCHIVE: Firestore Sync Status + Actions
// ════════════════════════════════════════════════════════════════

async function refreshSyncStatus() {
  const bar = document.getElementById('sync-status-bar');
  const icon = document.getElementById('sync-status-icon');
  const text = document.getElementById('sync-status-text');
  const counts = document.getElementById('sync-status-counts');
  const btnSync = document.getElementById('btn-batch-sync');
  const btnClean = document.getElementById('btn-verify-clean');

  if (!bar || !text) return;

  try {
    const status = await getArchiveStatus();
    if (!status || !status.success) {
      bar.style.display = 'flex';
      icon.textContent = '⚠️';
      text.textContent = 'Cannot connect to backend';
      return;
    }

    bar.style.display = 'flex';
    const { unsynced, synced_pending_clean, total_delivered, ready_for_batch, last_sync_at, last_sync_count, is_syncing } = status;

    // ── Status icon + text ──
    if (is_syncing) {
      icon.textContent = '🔄';
      text.textContent = 'Syncing to Firestore...';
    } else if (unsynced === 0 && synced_pending_clean === 0) {
      icon.textContent = '✅';
      text.textContent = 'All caught up — nothing to sync';
    } else if (ready_for_batch) {
      icon.textContent = '🔔';
      text.textContent = `${unsynced} orders ready to sync!`;
    } else {
      icon.textContent = '⏳';
      text.textContent = `${unsynced} pending · waiting for ${20 - unsynced} more delivered`;
    }

    // ── Counts ──
    counts.innerHTML = `
      <span class="sync-count-badge unsynced">📦 ${unsynced} unsynced</span>
      <span class="sync-count-badge synced">✅ ${synced_pending_clean} synced (needs clean)</span>
      ${last_sync_at ? `<span class="sync-count-badge last">🕐 Last: ${new Date(last_sync_at).toLocaleTimeString('en-IN')} (${last_sync_count} orders)</span>` : ''}
    `;

    // ── Action buttons ──
    if (is_syncing) {
      btnSync.style.display = 'none';
      btnClean.style.display = 'none';
    } else {
      btnSync.style.display = unsynced >= 20 ? 'inline-block' : 'none';
      btnSync.textContent = `🔄 Sync ${unsynced} to Firestore`;
      btnClean.style.display = synced_pending_clean > 0 ? 'inline-block' : 'none';
      btnClean.textContent = `✅ Verify & Clean (${synced_pending_clean})`;
    }

  } catch (e) {
    bar.style.display = 'flex';
    icon.textContent = '❌';
    text.textContent = 'Status check failed';
    console.error('[SyncStatus]', e);
  }
}

async function handleBatchSync() {
  const btnSync = document.getElementById('btn-batch-sync');
  if (btnSync) { btnSync.disabled = true; btnSync.textContent = '🔄 Syncing...'; }
  
  const res = await triggerBatchSync();
  
  if (btnSync) { btnSync.disabled = false; }
  
  // Wait 3s then refresh
  setTimeout(refreshSyncStatus, 3000);
  setTimeout(refreshSyncStatus, 8000);
}

async function handleVerifyClean() {
  if (!confirm('This will PERMANENTLY delete synced orders from SQLite.\n\nOrders will remain in Firestore as archive.\n\nContinue?')) return;
  
  const btnClean = document.getElementById('btn-verify-clean');
  if (btnClean) { btnClean.disabled = true; btnClean.textContent = '🔄 Verifying...'; }
  
  const res = await verifyAndClean();
  
  if (btnClean) { btnClean.disabled = false; }
  
  // Refresh
  setTimeout(refreshSyncStatus, 2000);
  setTimeout(() => loadOrders(), 3000);
}

let _loadingOrders = false;
let _ordersTableInitialized = false;

async function loadOrders() {
  if (_loadingOrders) return;
  _loadingOrders = true;
  
  const loading = document.getElementById('orders-loading');
  const wrap = document.getElementById('orders-table-wrap');
  if (!loading || !wrap) { _loadingOrders = false; return; }
  
  const status = document.getElementById('order-status-filter')?.value || '';
  
  try {
    const res = await getOrders({ status, page_size: 200 });
    let allFetchedOrders = res || [];
    
    // Hide loading after first successful load
    loading.style.display = 'none';
    
    // Check for new orders (alert) - track TOTAL count, not displayed count
    const totalCount = allFetchedOrders.length;
    if (totalCount > _lastTotalCount && _lastTotalCount > 0) {
      const newCount = totalCount - _lastTotalCount;
      _playAlertSound();
      showSuccess('🔔 ' + newCount + ' new order' + (newCount > 1 ? 's' : '') + ' received! Total: ' + totalCount);
    }
    _lastTotalCount = totalCount;
    _lastOrderCount = totalCount;
    
    // Keep only last 15 orders for display
    allOrders = allFetchedOrders.slice(0, 15);
    
    if (allOrders.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No orders found</div>';
      _ordersTableInitialized = false;
      _loadingOrders = false;
      return;
    }
    
    // ── Smart DOM update (no full table refresh) ──
    if (!_ordersTableInitialized) {
      // First load: create full table structure
      wrap.innerHTML = `
        <div class="table-wrap orders-table-modern">
        <table class="table">
          <thead><tr>
            <th class="col-orderid">Order ID</th>
            <th class="col-user">Customer</th>
            <th class="col-items">Items</th>
            <th class="col-total">Amount</th>
            <th class="col-payment">Payment</th>
            <th class="col-status">Status</th>
            <th class="col-date">Placed</th>
            <th class="col-actions" style="text-align:center">Actions</th>
          </tr></thead>
          <tbody id="orders-tbody"></tbody>
        </table>
        <div id="orders-footer" class="table-footer"></div>
        </div>
      `;
      _ordersTableInitialized = true;
    }
    
    const tbody = document.getElementById('orders-tbody');
    const footer = document.getElementById('orders-footer');
    if (!tbody) { _loadingOrders = false; return; }
    
    // Build a Set of current order IDs for quick lookup
    const currentIds = new Set(allOrders.map(o => o.id));
    const existingRows = {};
    tbody.querySelectorAll('tr').forEach(tr => {
      const id = tr.id.replace('order-row-', '');
      existingRows[id] = tr;
    });
    
    // Remove rows for deleted orders
    Object.keys(existingRows).forEach(id => {
      if (!currentIds.has(id) && existingRows[id]) {
        existingRows[id].remove();
        delete existingRows[id];
      }
    });
    
    // Update or add rows
    let lastRow = null;
    allOrders.forEach((o, idx) => {
      const existingRow = document.getElementById(`order-row-${o.id}`);
      if (existingRow) {
        // Update only status & actions cells (no full row replacement)
        const statusCell = existingRow.querySelector('.col-status');
        const actionsCell = existingRow.querySelector('.col-actions');
        if (statusCell) statusCell.innerHTML = `<span class="badge badge-status-${escapeHtml(o.status)}">${escapeHtml(o.status)}</span>`;
        if (actionsCell) actionsCell.innerHTML = getActionButtons(o);
        // Update payment if changed
        const paymentCell = existingRow.querySelector('.col-payment');
        if (paymentCell) paymentCell.innerHTML = `<span class="pay-badge ${escapeHtml(o.payment_method)}">${o.payment_method === 'cod' ? '💵 COD' : '💳 UPI'}</span>`;
        lastRow = existingRow;
      } else {
        // New order: insert row
        const tr = document.createElement('tr');
        tr.id = `order-row-${o.id}`;
        const statusIcons = { pending: '🕐', confirmed: '✅', preparing: '👨‍🍳', 'out-for-delivery': '🚚', delivered: '🎉', cancelled: '❌' };
        const now = new Date();
        const placed = o.placed_at ? new Date(o.placed_at) : null;
        const timeAgo = placed ? Math.round((now - placed) / 60000) + 'm ago' : '';
        tr.innerHTML = `
          <td class="col-orderid"><span class="order-id-badge">${escapeHtml(o.id || '')}</span></td>
          <td class="col-user"><span class="user-name">${escapeHtml((o.address_full_name || (o.user_uid||'').substring(0,10) || 'Guest').trim())}</span></td>
          <td class="col-items"><a href="javascript:void(0)" class="order-items-link" onclick="showOrderDetail('${escapeHtml(o.id || '')}')">${(o.items||[]).length} item${(o.items||[]).length !== 1 ? 's' : ''} 📋</a></td>
          <td class="col-total"><strong>₹${Number(o.total || 0).toFixed(0)}</strong></td>
          <td class="col-payment"><span class="pay-badge ${o.payment_method}">${o.payment_method === 'cod' ? '💵 COD' : '💳 UPI'}</span></td>
          <td class="col-status"><span class="status-pill ${o.status}">${statusIcons[o.status] || '📋'} ${(o.status || '').replace('-', ' ')}</span></td>
          <td class="col-date"><span class="date-text">${placed ? placed.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—'}</span><span class="time-text">${timeAgo}</span></td>
          <td class="col-actions actions-cell">${getActionButtons(o)}</td>
        `;
        // Insert in correct position (maintain order)
        if (idx === 0) {
          tbody.insertBefore(tr, tbody.firstChild);
        } else if (lastRow && lastRow.nextSibling) {
          tbody.insertBefore(tr, lastRow.nextSibling);
        } else {
          tbody.appendChild(tr);
        }
        lastRow = tr;
        // Highlight new row
        tr.style.transition = 'background-color 0.5s';
        tr.style.backgroundColor = '#fef3c7';
        setTimeout(() => { tr.style.backgroundColor = ''; }, 2000);
      }
    });
    
    // Update footer count (show total orders, not just displayed 15)
    if (footer) footer.textContent = `Showing ${allOrders.length} of ${allFetchedOrders.length} orders total`;
    
  } catch(e) {
    loading.style.display = 'none';
    // Only show error if no table exists
    const tbody = document.getElementById('orders-tbody');
    if (!tbody || !_ordersTableInitialized) {
      wrap.innerHTML = `<div class="error-card">Error: ${escapeHtml(e.message)}</div>`;
    }
  }
  _loadingOrders = false;
}

async function updateOrder(orderId, status) {
  if (!status || window._updatingOrder) return;
  
  // Confirm cancellation
  if (status === 'cancelled') {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
  }
  
  window._updatingOrder = true;
  _stopAlertSound();
  
  // Save previous status for revert
  const idx = allOrders.findIndex(o => o.id === orderId);
  const prevStatus = idx >= 0 ? allOrders[idx].status : null;
  if (idx >= 0) allOrders[idx].status = status;
  
  // Update the row in DOM immediately
  let actionsCell = null;
  const row = document.querySelector('#order-row-' + CSS.escape(orderId));
  if (row) {
    const statusCell = row.querySelector('.col-status');
    actionsCell = row.querySelector('.col-actions');
    if (statusCell) statusCell.innerHTML = getStatusBadge(status);
    if (actionsCell) {
      actionsCell.innerHTML = '<span style="font-size:11px;color:var(--muted)">Updating...</span>';
    }
  }
  
  try {
    await updateOrderStatus(orderId, status);
    showSuccess(orderId + ' -> ' + status);
    // Refresh after update
    if (actionsCell && idx >= 0 && allOrders[idx]) {
      actionsCell.innerHTML = getActionButtons(allOrders[idx]);
    }
  } catch(e) {
    showError(e.message);
    // Revert on error
    if (idx >= 0 && prevStatus && allOrders[idx]) {
      allOrders[idx].status = prevStatus;
      const row2 = document.querySelector('#order-row-' + CSS.escape(orderId));
      if (row2) {
        const sc = row2.querySelector('.col-status');
        const ac = row2.querySelector('.col-actions');
        if (sc) sc.innerHTML = getStatusBadge(prevStatus);
        if (ac) ac.innerHTML = getActionButtons(allOrders[idx]);
      }
    }
  }
  window._updatingOrder = false;
}

function getStatusBadge(status) {
  const icons = { pending: '🕐', confirmed: '✅', preparing: '👨‍🍳', 'out-for-delivery': '🚚', delivered: '🎉', cancelled: '❌' };
  return `<span class="status-pill ${status}">${icons[status] || '📋'} ${status.replace('-', ' ')}</span>`;
}

function getActionButtons(order) {
  if (!order) return '';
  const id = order.id;
  let html = '';
  if (order.status === 'pending') html += '<button class="ab ab-accept" onclick="updateOrder(\'' + id + '\',\'confirmed\')"><span class="ab-icon">✓</span> Accept</button> ';
  if (order.status === 'confirmed') html += '<button class="ab ab-prepare" onclick="updateOrder(\'' + id + '\',\'preparing\')"><span class="ab-icon">👨‍🍳</span> Prepare</button> ';
  if (order.status === 'preparing') html += '<button class="ab ab-dispatch" onclick="updateOrder(\'' + id + '\',\'out-for-delivery\')"><span class="ab-icon">🚚</span> Out for Delivery</button> ';
  if (order.status === 'out-for-delivery') html += '<button class="ab ab-deliver" onclick="updateOrder(\'' + id + '\',\'delivered\')"><span class="ab-icon">🎉</span> Deliver</button> ';
  if (order.status !== 'delivered' && order.status !== 'cancelled') html += '<button class="ab ab-cancel" onclick="updateOrder(\'' + id + '\',\'cancelled\')"><span class="ab-icon">✕</span> Cancel</button> ';
  if (order.status === 'delivered') html += '<span class="ab-final ab-delivered">✅ Delivered</span>';
  if (order.status === 'cancelled') html += '<span class="ab-final ab-cancelled">❌ Cancelled</span>';
  return html;
}

function showOrderDetail(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return showError('Order not found');
  
  const items = order.items || [];
  const itemsHtml = items.length > 0 ? items.map(item => `
    <div class="order-item-row">
      <div class="order-item-info">
        ${item.image_path ? `<img src="${item.image_path}" class="order-item-img" />` : '<div class="order-item-img-placeholder">🛒</div>'}
        <div>
          <strong>${item.name}</strong>
          <span class="order-item-meta">${item.weight ? item.weight + ' · ' : ''}₹${Number(item.price).toFixed(0)} × ${item.quantity}</span>
        </div>
      </div>
      <div class="order-item-total">₹${(item.price * item.quantity).toFixed(0)}</div>
    </div>
  `).join('') : '<div class="empty-state">No items</div>';
  
  const subtotal = Number(order.subtotal || 0).toFixed(0);
  const deliveryFee = Number(order.delivery_fee || 0).toFixed(0);
  const total = Number(order.total || 0).toFixed(0);
  
  const statusMap = { pending: '⏳ Pending', confirmed: '✅ Confirmed', preparing: '👨‍🍳 Preparing', 'out-for-delivery': '🚚 Out for Delivery', delivered: '🎉 Delivered', cancelled: '❌ Cancelled' };
  
  showFormModal(`Order #${order.id}`, `
    <div class="order-detail">
      <div class="order-detail-header">
        <div class="order-detail-badges">
          <span class="badge badge-pay">${order.payment_method === 'cod' ? '💵 COD' : '💳 UPI'}</span>
          <span class="badge badge-status-${order.status}">${statusMap[order.status] || order.status}</span>
        </div>
        <div class="order-detail-date">📅 ${order.placed_at ? new Date(order.placed_at).toLocaleString('en-IN') : 'N/A'}</div>
      </div>
      
      <div class="order-section">
        <h4>🛒 Items (${items.length})</h4>
        <div class="order-items-list">${itemsHtml}</div>
        <div class="order-total-row">
          <span>Subtotal</span><span>₹${subtotal}</span>
        </div>
        <div class="order-total-row">
          <span>Delivery Fee</span><span>${deliveryFee > 0 ? '₹' + deliveryFee : 'FREE'}</span>
        </div>
        <div class="order-total-row order-grand-total">
          <span>Total</span><span>₹${total}</span>
        </div>
      </div>
      
      <div class="order-section">
        <h4>📍 Delivery Address</h4>
        <p style="font-size:12px;color:var(--muted);margin-bottom:6px"><em>Click ✏️ to edit address or totals</em></p>
        <button class="btn-sm btn-edit" onclick="showEditOrderModal('${order.id}')">✏️ Edit Order</button>
        <div class="order-address" style="margin-top:8px">
          <p><strong>${order.address_full_name || 'N/A'}</strong> ${order.address_phone ? '· ' + order.address_phone : ''}</p>
          <p>${order.address_line1 || ''}${order.address_line2 ? ', ' + order.address_line2 : ''}</p>
          <p>${order.address_landmark ? order.address_landmark + ', ' : ''}${order.address_city || ''} - ${order.address_pincode || ''}</p>
        </div>
      </div>
      
      <div class="order-section">
        <h4>⏰ Delivery Slot</h4>
        <p class="order-slot">${order.delivery_slot_label || order.delivery_slot || 'ASAP'}</p>
      </div>
      
      <div class="order-section order-actions">
        <label>Change Status:</label>
        <div class="action-buttons-row">
          ${order.status === 'pending' ? `<button class="btn-primary btn-action" onclick="updateOrderFromDetail('${order.id}','confirmed')">✅ Confirm</button>` : ''}
          ${order.status === 'confirmed' ? `<button class="btn-primary btn-action" onclick="updateOrderFromDetail('${order.id}','preparing')">👨‍🍳 Prepare</button>` : ''}
          ${order.status === 'preparing' ? `<button class="btn-primary btn-action" onclick="updateOrderFromDetail('${order.id}','out-for-delivery')">🚚 Dispatch</button>` : ''}
          ${order.status === 'out-for-delivery' ? `<button class="btn-primary btn-action" onclick="updateOrderFromDetail('${order.id}','delivered')">🎉 Deliver</button>` : ''}
          ${order.status !== 'delivered' && order.status !== 'cancelled' ? `<button class="btn-danger btn-action" onclick="updateOrderFromDetail('${order.id}','cancelled')">❌ Cancel Order</button>` : ''}
          ${order.status === 'delivered' ? `<p class="order-final-status">✅ This order has been delivered.</p>` : ''}
          ${order.status === 'cancelled' ? `<p class="order-final-status">❌ This order has been cancelled.</p>` : ''}
        </div>
      </div>
    </div>
  `);
}

function showEditOrderModal(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return showError('Order not found');
  
  showFormModal('✏️ Edit Order: ' + order.id, `
    <div class="form-group"><label>Customer Name</label><input id="edit-order-name" value="${order.address_full_name || ''}" /></div>
    <div class="form-group"><label>Customer Phone</label><input id="edit-order-phone" value="${order.address_phone || ''}" /></div>
    <div class="form-group"><label>Address Line 1</label><input id="edit-order-addr1" value="${order.address_line1 || ''}" /></div>
    <div class="form-group"><label>City</label><input id="edit-order-city" value="${order.address_city || ''}" /></div>
    <div class="form-group"><label>Pincode</label><input id="edit-order-pincode" value="${order.address_pincode || ''}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Subtotal (₹)</label><input id="edit-order-subtotal" type="number" value="${Number(order.subtotal || 0).toFixed(0)}" /></div>
      <div class="form-group"><label>Delivery Fee (₹)</label><input id="edit-order-delivery" type="number" value="${Number(order.delivery_fee || 0).toFixed(0)}" /></div>
    </div>
    <div class="form-group"><label>Total (₹)</label><input id="edit-order-total" type="number" value="${Number(order.total || 0).toFixed(0)}" /></div>
    <button class="btn-primary btn-full" onclick="saveEditOrder('${order.id}')">💾 Save Changes</button>
  `);
}

async function saveEditOrder(orderId) {
  try {
    const payload = {
      address_full_name: document.getElementById('edit-order-name').value.trim(),
      address_phone: document.getElementById('edit-order-phone').value.trim(),
      address_line1: document.getElementById('edit-order-addr1').value.trim(),
      address_city: document.getElementById('edit-order-city').value.trim(),
      address_pincode: document.getElementById('edit-order-pincode').value.trim(),
      subtotal: parseFloat(document.getElementById('edit-order-subtotal').value) || 0,
      delivery_fee: parseFloat(document.getElementById('edit-order-delivery').value) || 0,
      total: parseFloat(document.getElementById('edit-order-total').value) || 0,
    };
    
    await updateOrderData(orderId, payload);
    showSuccess('✅ Order updated!');
    closeModal();
    loadOrders();
  } catch(e) {
    showError(e.message);
  }
}

async function updateOrderFromDetail(orderId, status) {
  if (!status || window._updatingOrder) return;
  window._updatingOrder = true;
  _stopAlertSound();
  
  // Update local data
  const idx = allOrders.findIndex(o => o.id === orderId);
  if (idx >= 0) allOrders[idx].status = status;
  
  // Update row in DOM
  const row = document.querySelector(`#order-row-${CSS.escape(orderId)}`);
  if (row) {
    const statusCell = row.querySelector('.col-status');
    const actionsCell = row.querySelector('.col-actions');
    if (statusCell) statusCell.innerHTML = getStatusBadge(status);
    if (actionsCell) actionsCell.innerHTML = getActionButtons(allOrders[idx]);
  }
  
  try {
    await updateOrderStatus(orderId, status);
    showSuccess('✅ ' + orderId + ' → ' + status);
    closeModal();
  } catch(e) { showError(e.message); }
  window._updatingOrder = false;
}

// ════════════════════════════════════════════════════════════════
// TAB: API PERFORMANCE
// ════════════════════════════════════════════════════════════════
const API_ENDPOINTS = [
  { name: 'Health Check', method: 'GET', path: '/health' },
  { name: 'Admin Health', method: 'GET', path: '/admin/health', auth: true },
  { name: 'Admin Stats', method: 'GET', path: '/admin/stats', auth: true },
  { name: 'List Orders', method: 'GET', path: '/admin/orders?page_size=5', auth: true },
  { name: 'List Products', method: 'GET', path: '/products?page_size=5' },
  { name: 'Categories', method: 'GET', path: '/categories/sections' },
  { name: 'Promos', method: 'GET', path: '/config/promos' },
  { name: 'App Config', method: 'GET', path: '/config' },
  { name: 'Delivery Slots', method: 'GET', path: '/config/delivery-slots' },
  { name: 'Payment Methods', method: 'GET', path: '/config/payment-methods' },
  { name: 'Admin Login', method: 'POST', path: '/auth/admin-login', body: { username: 'admin', password: 'admin@123' } },
];

async function renderApiPerfTab(container) {
  container.innerHTML = `
    <div class="toolbar">
      <button class="btn-primary" onclick="refreshCurrent()">🔄 Test All APIs</button>
      <span style="font-size:13px;color:var(--muted)">Tests all endpoints and measures response time</span>
    </div>
    <div id="perf-loading" class="loading">Testing APIs...</div>
    <div id="perf-results"></div>
  `;
  await testAllApis();
}

async function testAllApis() {
  const loading = document.getElementById('perf-loading');
  const results = document.getElementById('perf-results');
  if (!loading || !results) return;
  
  loading.style.display = 'block';
  results.innerHTML = '';
  
  // Get auth token first
  let token = localStorage.getItem('admin_token') || '';
  if (!token) {
    try {
      const resp = await fetch(getApiBase() + '/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin@123' }),
      });
      const data = await resp.json();
      if (resp.ok) token = data.id_token;
    } catch(e) {}
  }
  
  const testResults = [];
  
  for (const ep of API_ENDPOINTS) {
    const start = performance.now();
    let status = '❌';
    let time = 0;
    let errorMsg = '';
    
    try {
      const options = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
      if (ep.auth && token) options.headers['Authorization'] = 'Bearer ' + token;
      if (ep.body) options.body = JSON.stringify(ep.body);
      
      const resp = await fetch(getApiBase() + ep.path, options);
      time = Math.round((performance.now() - start) * 10) / 10;
      status = resp.ok ? '✅' : '⚠️';
      if (!resp.ok) errorMsg = 'HTTP ' + resp.status;
    } catch(e) {
      time = Math.round((performance.now() - start) * 10) / 10;
      errorMsg = e.message;
    }
    
    testResults.push({ name: ep.name, method: ep.method, path: ep.path, status, time, error: errorMsg });
  }
  
  loading.style.display = 'none';
  
  const avgTime = Math.round((testResults.reduce((s, r) => s + r.time, 0) / testResults.length) * 10) / 10;
  const okCount = testResults.filter(r => r.status === '✅').length;
  
  // WebSocket status
  const wsConnected = _ws && _ws.readyState === WebSocket.OPEN;
  const wsUrl = getApiBase().replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '') + '/ws/orders';

  results.innerHTML = `
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-icon" style="background:#f0fdf4;color:#22c55e">⚡</div>
        <div class="stat-num">${avgTime}ms</div>
        <div class="stat-label">Avg Response Time</div>
        <div class="stat-sub">${okCount}/${testResults.length} APIs OK</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#eff6ff;color:#3b82f6">📡</div>
        <div class="stat-num">${testResults.length}</div>
        <div class="stat-label">Endpoints Tested</div>
        <div class="stat-sub">Fastest: ${Math.min(...testResults.map(r => r.time))}ms · Slowest: ${Math.max(...testResults.map(r => r.time))}ms</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:${wsConnected ? '#f0fdf4' : '#fef3c7'};color:${wsConnected ? '#22c55e' : '#d97706'}">🔌</div>
        <div class="stat-num">${wsConnected ? '🟢 Connected' : '🟡 Disconnected'}</div>
        <div class="stat-label">WebSocket Status</div>
        <div class="stat-sub" style="font-size:11px;word-break:break-all">${wsUrl}</div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th style="width:25%">Endpoint</th>
          <th style="width:8%;text-align:center">Method</th>
          <th style="width:37%">Path</th>
          <th style="width:10%;text-align:center">Status</th>
          <th style="width:10%;text-align:center">Time (ms)</th>
          <th style="width:10%;text-align:center">Rating</th>
        </tr></thead>
        <tbody>
          ${testResults.map(r => `
            <tr>
              <td><strong>${r.name}</strong></td>
              <td style="text-align:center"><code>${r.method}</code></td>
              <td style="font-size:12px;color:var(--muted)">${r.path}</td>
              <td style="text-align:center">${r.error ? '<span title="' + r.error + '">⚠️</span>' : r.status}</td>
              <td style="text-align:center;font-weight:700;color:${r.time < 50 ? '#15803d' : r.time < 200 ? '#c2410c' : '#dc2626'}">${r.time}ms</td>
              <td style="text-align:center">${r.time < 50 ? '🟢 Fast' : r.time < 200 ? '🟡 OK' : r.time < 500 ? '🟠 Slow' : '🔴 Critical'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="table-footer">Auto-refreshes every 60s · Click 🔄 to test now · WebSocket: ${wsConnected ? '🟢 Live' : '🟡 Disconnected (reconnects every 5s)'}</div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════
// TAB: CONFIG
// ════════════════════════════════════════════════════════════════
async function renderConfigTab(container) {
  container.innerHTML = '<div class="loading">Loading config...</div>';
  try {
    const res = await fetchAdminConfig();
    const c = res.config || {};
    const slots = res.delivery_slots || [];
    
    container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-icon" style="background:#fff7ed;color:#f97316">💵</div>
          <div class="stat-num">₹${c.delivery_fee || 0}</div>
          <div class="stat-label">Delivery Fee</div>
          <div class="stat-sub">Free above ₹${c.free_delivery_threshold || 199}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#f0fdf4;color:#22c55e">🏷️</div>
          <div class="stat-num">${c.promo_code || '—'}</div>
          <div class="stat-label">Promo Code</div>
          <div class="stat-sub">Free Delivery</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#fef2f2;color:#ef4444">🔧</div>
          <div class="stat-num">${c.maintenance_mode ? '🟢 ON' : '⚪ OFF'}</div>
          <div class="stat-label">Maintenance Mode</div>
          <div class="stat-sub">${c.maintenance_mode ? c.maintenance_message || 'Site under maintenance' : 'Everything normal'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#eff6ff;color:#3b82f6">📱</div>
          <div class="stat-num">v${c.app_version || '—'}</div>
          <div class="stat-label">App Version</div>
          <div class="stat-sub">Min: v${c.min_app_version || '—'} ${c.force_update ? '⚠️ Force' : ''}</div>
        </div>
      </div>
      
      <div class="card" style="margin-bottom:16px">
        <h3>⚙️ Settings</h3>
        <div class="form-row">
          <div class="form-group"><label>Delivery Fee (₹)</label><input id="cfg-delivery-fee" type="number" value="${c.delivery_fee || 30}" /></div>
          <div class="form-group"><label>Free Delivery Above (₹)</label><input id="cfg-free-threshold" type="number" value="${c.free_delivery_threshold || 199}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Promo Code</label><input id="cfg-promo-code" value="${c.promo_code || 'FREEDEL'}" /></div>
          <div class="form-group"><label>Support Phone</label><input id="cfg-support-phone" value="${c.support_phone || ''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Razorpay Key ID</label><input id="cfg-razorpay-key" value="${c.razorpay_key_id || ''}" /></div>
          <div class="form-group"><label>Currency</label><input id="cfg-currency" value="${c.currency_symbol || '₹'} ${c.currency_code || 'INR'}" disabled style="background:#f3f4f6" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>App Version</label><input id="cfg-app-version" value="${c.app_version || '1.0.0'}" /></div>
          <div class="form-group"><label>Min App Version</label><input id="cfg-min-version" value="${c.min_app_version || '1.0.0'}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Support Email</label>
            <input id="cfg-support-email" value="${c.support_email || ''}" />
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;gap:12px">
            <label style="display:flex;align-items:center;gap:6px;margin-bottom:0">
              <input type="checkbox" id="cfg-maintenance" ${c.maintenance_mode ? 'checked' : ''} /> Maintenance Mode
            </label>
            <label style="display:flex;align-items:center;gap:6px;margin-bottom:0">
              <input type="checkbox" id="cfg-force-update" ${c.force_update ? 'checked' : ''} /> Force Update
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Maintenance Message</label>
          <input id="cfg-maintenance-msg" value="${c.maintenance_message || ''}" placeholder="e.g. We are upgrading our service..." />
        </div>
        <button class="btn-primary" onclick="saveConfig()">💾 Save Settings</button>
      </div>
      
      <div class="card">
        <h3>⏰ Delivery Slots</h3>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ID</th><th>Label</th><th>Description</th></tr></thead>
            <tbody>
              ${slots.map(s => `
                <tr><td><code>${s.id}</code></td><td><strong>${s.label}</strong></td><td>${s.description}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="error-card">Failed to load config: ${e.message}</div>`;
  }
}

async function saveConfig() {
  try {
    const payload = {
      delivery_fee: Number(document.getElementById('cfg-delivery-fee').value) || 30,
      free_delivery_threshold: Number(document.getElementById('cfg-free-threshold').value) || 199,
      promo_code: document.getElementById('cfg-promo-code').value.trim() || 'FREEDEL',
      support_phone: document.getElementById('cfg-support-phone').value.trim(),
      support_email: document.getElementById('cfg-support-email').value.trim(),
      razorpay_key_id: document.getElementById('cfg-razorpay-key').value.trim(),
      app_version: document.getElementById('cfg-app-version').value.trim() || '1.0.0',
      min_app_version: document.getElementById('cfg-min-version').value.trim() || '1.0.0',
      maintenance_mode: document.getElementById('cfg-maintenance').checked,
      force_update: document.getElementById('cfg-force-update').checked,
      maintenance_message: document.getElementById('cfg-maintenance-msg').value.trim(),
    };
    // Save via API
    await updateAdminConfig(payload);
    showSuccess('✅ Settings saved!');
    switchTab('config');
  } catch(e) { showError(e.message); }
}

// ════════════════════════════════════════════════════════════════
// TAB: SHOPS — Delivery Hub Management
// ════════════════════════════════════════════════════════════════
async function renderShopsTab(container) {
  container.innerHTML = '<div class="loading">Loading shops...</div>';
  try {
    const res = await fetchShops();
    const shops = res.shops || [];

    let rows = shops.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.address || '-')}</td>
        <td>${escapeHtml(String(s.latitude))}, ${escapeHtml(String(s.longitude))}</td>
        <td>${escapeHtml(String(s.delivery_radius_km))} km</td>
        <td>${escapeHtml(s.phone || '-')}</td>
        <td><span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn-sm" onclick='openShopModal(${JSON.stringify(s).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn-sm btn-danger" onclick='deleteShop("${escapeHtml(s.id)}")'>🗑️</button>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div><strong>${shops.length}</strong> shop(s) configured</div>
        <button class="btn" onclick="openShopModal(null)">➕ Add Shop</button>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Name</th><th>Address</th><th>Lat, Lng</th><th>Radius</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="empty">No shops added yet.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load shops: ${e.message}</div>`;
  }
}

function openShopModal(shop) {
  const isEdit = !!shop;
  document.getElementById('modal-title').textContent = isEdit ? 'Edit Shop' : 'Add New Shop';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Shop Name *</label>
      <input id="shop-name" class="input" value="${isEdit ? shop.name : ''}" placeholder="e.g. AaplaKart Hub Vashi" />
    </div>
    <div class="form-group">
      <label>Address</label>
      <input id="shop-address" class="input" value="${isEdit ? (shop.address || '') : ''}" placeholder="Full address" />
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label>Latitude *</label>
        <input id="shop-lat" class="input" type="number" step="0.0001" value="${isEdit ? shop.latitude : ''}" placeholder="e.g. 19.0760" />
      </div>
      <div class="form-group" style="flex:1">
        <label>Longitude *</label>
        <input id="shop-lng" class="input" type="number" step="0.0001" value="${isEdit ? shop.longitude : ''}" placeholder="e.g. 72.8777" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label>Delivery Radius (km)</label>
        <input id="shop-radius" class="input" type="number" step="0.5" value="${isEdit ? shop.delivery_radius_km : '6'}" />
      </div>
      <div class="form-group" style="flex:1">
        <label>Phone</label>
        <input id="shop-phone" class="input" value="${isEdit ? (shop.phone || '') : ''}" placeholder="Phone number" />
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn" onclick="saveShop('${isEdit ? shop.id : ''}')">${isEdit ? 'Update' : 'Create'}</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
  document.getElementById('modal-overlay').style.display = 'flex';
}

async function saveShop(shopId) {
  const name = document.getElementById('shop-name').value.trim();
  const lat = parseFloat(document.getElementById('shop-lat').value);
  const lng = parseFloat(document.getElementById('shop-lng').value);
  if (!name || isNaN(lat) || isNaN(lng)) { showError('Name, Latitude and Longitude are required'); return; }

  const data = {
    name,
    address: document.getElementById('shop-address').value.trim(),
    latitude: lat,
    longitude: lng,
    delivery_radius_km: parseFloat(document.getElementById('shop-radius').value) || 6,
    phone: document.getElementById('shop-phone').value.trim(),
  };

  try {
    if (shopId) {
      await updateShop(shopId, data);
      showSuccess('Shop updated!');
    } else {
      await createShop(data);
      showSuccess('Shop created!');
    }
    closeModal();
    switchTab('shops');
  } catch (e) { showError(e.message); }
}

async function deleteShop(shopId) {
  if (!confirm('Delete this shop?')) return;
  try {
    await deleteShopApi(shopId);
    showSuccess('Shop deleted');
    switchTab('shops');
  } catch (e) { showError(e.message); }
}

// ════════════════════════════════════════════════════════════════
// TAB: USERS
// ════════════════════════════════════════════════════════════════
async function renderUsersTab(container) {
  container.innerHTML = '<div class="loading">Loading users...</div>';
  try {
    const res = await fetchAdminUsers();
    const users = res.users || [];
    
    container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:16px">
        <div class="stat-card">
          <div class="stat-icon" style="background:#f0fdf4;color:#22c55e">👥</div>
          <div class="stat-num">${users.length}</div>
          <div class="stat-label">Total Users</div>
        </div>
      </div>
      ${users.length === 0 ? '<div class="empty-state">No users registered yet</div>' : `
        <table class="table">
          <thead><tr><th>UID</th><th>Phone</th><th>Name</th><th>Email</th><th>Role</th><th>Test</th><th>Joined</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><code>${escapeHtml((u.uid||'').substring(0,16))}</code></td>
                <td>${escapeHtml(u.phone_number || '—')}</td>
                <td>${escapeHtml(u.display_name || '—')}</td>
                <td>${escapeHtml(u.email || '—')}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-instock' : ''}">${escapeHtml(u.role || 'user')}</span></td>
                <td>${u.is_test_user ? '🧪 Yes' : '—'}</td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    `;
  } catch(e) {
    container.innerHTML = `<div class="error-card">Failed to load users: ${e.message}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
// TAB: CATEGORIES
// ════════════════════════════════════════════════════════════════
async function renderCategoriesTab(container) {
  container.innerHTML = '<div class="loading">Loading categories...</div>';
  try {
    const res = await fetchSections();
    allSections = res.sections || [];
    
    container.innerHTML = `
      <div class="toolbar">
        <button class="btn-primary" onclick="showAddSection()">+ Add Section</button>
      </div>
      ${allSections.length === 0 ? '<div class="empty-state">No sections found</div>' :
        allSections.map(sec => `
          <div class="card section-card">
            <div class="section-header">
              <div class="section-info">
                <h3>${escapeHtml(sec.name)}</h3>
                <span class="badge ${sec.type==='app'?'badge-waffle':'badge-kart'}">${sec.type==='app'?'🧇 Waffle':'🛒 Kart'}</span>
              </div>
              <div class="section-actions">
                <button class="btn-sm btn-edit" onclick="showEditSection('${escapeHtml(sec.id)}')" title="Edit Section">✏️</button>
                <button class="btn-sm btn-del" onclick="deleteSectionHandler('${escapeHtml(sec.id)}','${escapeHtml(sec.name)}')" title="Delete Section">🗑️</button>
              </div>
            </div>
            <div class="categories-list">
              ${(sec.categories||[]).map(cat => `
                <div class="category-chip">
                  <div class="cat-info">
                    <span class="cat-name">${escapeHtml(cat.name)}</span>
                    ${cat.image ? `<img src="${escapeHtml(cat.image)}" class="cat-img" />` : ''}
                    <span class="cat-sub-count">${(cat.subcategories||[]).length} sub</span>
                  </div>
                  <div class="cat-actions">
                    <button class="btn-sm btn-edit" onclick="showEditCategory('${escapeHtml(sec.id)}','${escapeHtml(cat.id)}','${escapeHtml(cat.name)}')" title="Edit Category">✏️</button>
                    <button class="btn-sm btn-del" onclick="deleteCategoryHandler('${escapeHtml(sec.id)}','${escapeHtml(cat.id)}','${escapeHtml(cat.name)}')" title="Delete Category">🗑️</button>
                  </div>
                  ${(cat.subcategories||[]).length > 0 ? '<div class="sub-list">' + cat.subcategories.map(function(sub){ return '<span class="sub-chip">' + escapeHtml(sub.name) + ' <button class="btn-sm-sub-del" onclick="deleteSubcategoryHandler(\'' + escapeHtml(sec.id) + '\',\'' + escapeHtml(cat.id) + '\',\'' + escapeHtml(sub.id) + '\',\'' + escapeHtml(sub.name) + '\')" title="Delete">✕</button></span>'; }).join('') + '</div>' : ''}
                </div>
              `).join('')}
              ${(!sec.categories || sec.categories.length === 0) ? '<span class="empty-sub">No categories</span>' : ''}
              <button class="btn-sm btn-add-cat" onclick="showAddCategory('${sec.id}')">+ Add Category</button>
            </div>
          </div>
        `).join('')
      }
    `;
  } catch(e) {
    container.innerHTML = `<div class="error-card">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function showAddSection() {
  showFormModal('Add Section', `
    <div class="form-group"><label>Section Name *</label><input id="sec-name" placeholder="e.g. Grocery & Kitchen" /></div>
    <div class="form-group"><label>Type</label><select id="sec-type"><option value="kart">AaplaKart</option><option value="app">The Waffle Guy</option></select></div>
    <button class="btn-primary btn-full" onclick="saveSection()">Create Section</button>
  `);
}

async function saveSection() {
  const name = document.getElementById('sec-name').value.trim();
  const type = document.getElementById('sec-type').value;
  if (!name) return showError('Section name is required');
  try {
    await createSection({ name, type });
    showSuccess('Section created!');
    closeModal();
    switchTab('categories');
  } catch(e) { showError(e.message); }
}

function deleteSectionHandler(id, name) {
  if (confirm(`Delete section "${name}" and all its categories?`)) {
    deleteSection(id).then(() => { showSuccess('Section deleted'); switchTab('categories'); }).catch(e => showError(e.message));
  }
}

// ── Section Edit ──
function showEditSection(sectionId) {
  const sec = allSections.find(s => s.id === sectionId);
  if (!sec) return showError('Section not found');
  showFormModal('Edit Section', `
    <div class="form-group"><label>Section Name *</label><input id="sec-name" value="${sec.name}" /></div>
    <div class="form-group"><label>Type</label><select id="sec-type"><option value="kart" ${sec.type==='kart'?'selected':''}>AaplaKart</option><option value="app" ${sec.type==='app'?'selected':''}>The Waffle Guy</option></select></div>
    <div class="form-group"><label>Image URL</label><input id="sec-image" value="${sec.image || ''}" placeholder="https://..." /></div>
    <button class="btn-primary btn-full" onclick="saveEditSection('${sectionId}')">💾 Save Changes</button>
  `);
}
async function saveEditSection(sectionId) {
  const name = document.getElementById('sec-name').value.trim();
  const type = document.getElementById('sec-type').value;
  const image = document.getElementById('sec-image').value.trim();
  if (!name) return showError('Section name is required');
  try {
    await updateSection(sectionId, { name, type, image });
    showSuccess('Section updated!');
    closeModal();
    switchTab('categories');
  } catch(e) { showError(e.message); }
}

// ── Category CRUD ──
function showAddCategory(sectionId) {
  showFormModal('Add Category', `
    <div class="form-group"><label>Category Name *</label><input id="cat-name" placeholder="e.g. Vegetables" /></div>
    <div class="form-group"><label>Image URL</label><input id="cat-image" placeholder="https://..." /></div>
    <button class="btn-primary btn-full" onclick="saveAddCategory('${sectionId}')">Create Category</button>
  `);
}
async function saveAddCategory(sectionId) {
  const name = document.getElementById('cat-name').value.trim();
  const image = document.getElementById('cat-image').value.trim();
  if (!name) return showError('Category name is required');
  try {
    await addCategoryToSection(sectionId, { name, image });
    showSuccess('Category created!');
    closeModal();
    switchTab('categories');
  } catch(e) { showError(e.message); }
}
function showEditCategory(sectionId, catId, catName) {
  const sec = allSections.find(s => s.id === sectionId);
  const cat = sec?.categories?.find(c => c.id === catId);
  if (!cat) return showError('Category not found');
  const subs = cat.subcategories || [];
  let html = '<div class="form-group"><label>Category Name *</label><input id="cat-name" value="' + cat.name + '" /></div>';
  html += '<div class="form-group"><label>Image URL</label><input id="cat-image" value="' + (cat.image || '') + '" /></div>';
  html += '<h4 style="margin:16px 0 10px;font-size:14px;font-weight:700">Subcategories</h4>';
  html += '<div id="sub-list-container" style="margin-bottom:12px">';
  subs.forEach(function(sub, i) {
    html += '<div style="display:flex;gap:6px;margin-bottom:6px">';
    html += '<input id="sub-name-' + i + '" value="' + sub.name + '" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px" placeholder="Subcategory name" />';
    html += '<button class="btn-sm btn-del" onclick="this.parentElement.remove()">✕</button></div>';
  });
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:14px">';
  html += '<input id="new-sub-name" placeholder="New subcategory name" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px" />';
  html += '<button class="btn-sm btn-edit" onclick="addSubInput()">+ Add</button></div>';
  html += '<button class="btn-primary btn-full" onclick="saveEditCategory(\'' + sectionId + '\',\'' + catId + '\')">💾 Save Changes</button>';
  window._addSubInputCounter = subs.length;
  showFormModal('Edit Category: ' + catName, html);
}
function addSubInput() {
  const i = window._addSubInputCounter || 0;
  const container = document.getElementById('new-sub-name').closest('div').previousElementSibling;
  const newInput = document.createElement('div');
  newInput.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
  newInput.innerHTML = '<input id="sub-name-' + i + '" value="' + document.getElementById('new-sub-name').value.trim() + '" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px" placeholder="Subcategory name" /><button class="btn-sm btn-del" onclick="this.parentElement.remove()">✕</button>';
  if (container) container.appendChild(newInput);
  document.getElementById('new-sub-name').value = '';
  window._addSubInputCounter = i + 1;
}
async function saveEditCategory(sectionId, catId) {
  const name = document.getElementById('cat-name').value.trim();
  const image = document.getElementById('cat-image').value.trim();
  if (!name) return showError('Category name is required');
  // Collect all subcategories
  const subcategories = [];
  let i = 0;
  while (document.getElementById('sub-name-' + i)) {
    const val = document.getElementById('sub-name-' + i).value.trim();
    if (val) subcategories.push({ id: 'sub-' + val.toLowerCase().replace(/\\s+/g, '-'), name: val });
    i++;
  }
  try {
    await updateCategoryInSection(sectionId, catId, { name, image, subcategories });
    showSuccess('Category updated!');
    closeModal();
    switchTab('categories');
  } catch(e) { showError(e.message); }
}
function deleteCategoryHandler(sectionId, catId, catName) {
  if (confirm('Delete category "' + catName + '" and all its subcategories?')) {
    deleteCategoryFromSection(sectionId, catId)
      .then(() => { showSuccess('Category deleted'); switchTab('categories'); })
      .catch(e => showError(e.message));
  }
}
function deleteSubcategoryHandler(sectionId, catId, subId, subName) {
  if (confirm('Delete subcategory "' + subName + '"?')) {
    const sec = allSections.find(s => s.id === sectionId);
    const cat = sec?.categories?.find(c => c.id === catId);
    const subs = (cat?.subcategories || []).filter(s => s.id !== subId);
    updateCategoryInSection(sectionId, catId, { subcategories: subs })
      .then(() => { showSuccess('Subcategory deleted'); switchTab('categories'); })
      .catch(e => showError(e.message));
  }
}

// ════════════════════════════════════════════════════════════════
// TAB: PROMOS
// ════════════════════════════════════════════════════════════════

let allPromos = [];

async function renderPromosTab(container) {
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select id="promo-brand-filter" onchange="loadPromos()">
          <option value="">All Brands</option>
          <option value="kart">AaplaKart</option>
          <option value="waffle">The Waffle Guy</option>
        </select>
        <select id="promo-position-filter" onchange="loadPromos()">
          <option value="">All Positions</option>
          <option value="home_banner">Home Banner</option>
          <option value="waffle_offer">Waffle Offer</option>
        </select>
      </div>
      <button class="btn-primary" onclick="showAddPromo()">+ Add Promo</button>
    </div>
    <div id="promos-loading" class="loading">Loading promos...</div>
    <div id="promos-table-wrap"></div>
  `;
  await loadPromos();
}

async function loadPromos() {
  const loading = document.getElementById('promos-loading');
  const wrap = document.getElementById('promos-table-wrap');
  if (!loading || !wrap) return;

  loading.style.display = 'block';
  const brand = document.getElementById('promo-brand-filter')?.value || '';
  const position = document.getElementById('promo-position-filter')?.value || '';

  try {
    const res = await fetchAdminPromos({ brand, position });
    allPromos = res.promos || [];
    loading.style.display = 'none';

    if (allPromos.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No promos found. Click "+ Add Promo" to create one.</div>';
      return;
    }

    wrap.innerHTML = `
      <table class="table">
        <thead><tr>
          <th>Image</th><th>Title</th><th>Brand</th><th>Position</th><th>Code</th><th>Active</th><th>Order</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${allPromos.map(p => `
            <tr>
              <td><img src="${p.image || 'https://via.placeholder.com/40?text=📢'}" onerror="this.src='https://via.placeholder.com/40?text=N/A'" style="width:40px;height:40px;border-radius:8px;object-fit:cover" /></td>
              <td><strong>${escapeHtml(p.title)}</strong><br><small style="color:#6b7280">${escapeHtml(p.subtitle || '')}</small></td>
              <td><span class="badge ${p.brand==='waffle'?'badge-waffle':'badge-kart'}">${p.brand==='waffle'?'🧇 Waffle':'🛒 Kart'}</span></td>
              <td><span class="badge badge-pos">${escapeHtml((p.position||'').replace('_',' '))}</span></td>
              <td><code>${escapeHtml(p.code || '-')}</code></td>
              <td><span class="badge ${p.active ? 'badge-instock' : 'badge-ostock'}">${p.active ? '✅ Active' : '❌ Inactive'}</span></td>
              <td>${p.sortOrder || 0}</td>
              <td class="actions-cell">
                <button class="btn-sm btn-edit" onclick="showEditPromo('${escapeHtml(p.id)}')">✏️</button>
                <button class="btn-sm btn-toggle" onclick="handleTogglePromo('${escapeHtml(p.id)}')">${p.active ? '⏸️' : '▶️'}</button>
                <button class="btn-sm btn-del" onclick="showDeletePromo('${escapeHtml(p.id)}','${escapeHtml(p.title)}')">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="table-footer">${allPromos.length} promos total</div>
    `;
  } catch(e) {
    loading.style.display = 'none';
    wrap.innerHTML = `<div class="error-card">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function showAddPromo() {
  showFormModal('Add Promo Banner', `
    <div class="form-group"><label>Title *</label><input id="pm-title" placeholder="e.g. Free Delivery" /></div>
    <div class="form-group"><label>Subtitle</label><input id="pm-subtitle" placeholder="e.g. On orders above ₹199" /></div>
    <div class="form-group"><label>Promo Code</label><input id="pm-code" placeholder="e.g. FREEDEL" /></div>
    <div class="form-row">
      <div class="form-group"><label>Brand</label><select id="pm-brand"><option value="kart">AaplaKart</option><option value="waffle">The Waffle Guy</option></select></div>
      <div class="form-group"><label>Position</label><select id="pm-position"><option value="home_banner">Home Banner</option><option value="waffle_offer">Waffle Offer</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Image URL</label><input id="pm-image" placeholder="https://..." value="https://images.unsplash.com/photo-1542838132-92c53300491e?w=800" /></div>
      <div class="form-group"><label>Sort Order</label><input id="pm-order" type="number" value="1" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>BG Color</label><input id="pm-bg" type="color" value="#f97316" /></div>
      <div class="form-group"><label>Text Color</label><input id="pm-text" type="color" value="#ffffff" /></div>
    </div>
    <div class="form-group"><label><input type="checkbox" id="pm-active" checked /> Active</label></div>
    <button class="btn-primary btn-full" onclick="savePromo()">Create Promo</button>
  `);
}

function showEditPromo(id) {
  const p = allPromos.find(x => x.id === id);
  if (!p) return showError('Promo not found');
  showFormModal('Edit Promo: ' + p.title, `
    <div class="form-group"><label>Title *</label><input id="pm-title" value="${p.title || ''}" /></div>
    <div class="form-group"><label>Subtitle</label><input id="pm-subtitle" value="${p.subtitle || ''}" /></div>
    <div class="form-group"><label>Promo Code</label><input id="pm-code" value="${p.code || ''}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Brand</label><select id="pm-brand"><option value="kart" ${p.brand==='kart'?'selected':''}>AaplaKart</option><option value="waffle" ${p.brand==='waffle'?'selected':''}>The Waffle Guy</option></select></div>
      <div class="form-group"><label>Position</label><select id="pm-position"><option value="home_banner" ${p.position==='home_banner'?'selected':''}>Home Banner</option><option value="waffle_offer" ${p.position==='waffle_offer'?'selected':''}>Waffle Offer</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Image URL</label><input id="pm-image" value="${p.image || ''}" /></div>
      <div class="form-group"><label>Sort Order</label><input id="pm-order" type="number" value="${p.sortOrder || 0}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>BG Color</label><input id="pm-bg" type="color" value="${p.bgColor || '#f97316'}" /></div>
      <div class="form-group"><label>Text Color</label><input id="pm-text" type="color" value="${p.textColor || '#ffffff'}" /></div>
    </div>
    <div class="form-group"><label><input type="checkbox" id="pm-active" ${p.active ? 'checked' : ''} /> Active</label></div>
    <button class="btn-primary btn-full" onclick="savePromo('${id}')">Update Promo</button>
  `);
}

async function savePromo(editId = null) {
  const data = {
    title: document.getElementById('pm-title').value.trim(),
    subtitle: document.getElementById('pm-subtitle').value.trim(),
    code: document.getElementById('pm-code').value.trim(),
    brand: document.getElementById('pm-brand').value,
    position: document.getElementById('pm-position').value,
    image: document.getElementById('pm-image').value.trim(),
    sortOrder: parseInt(document.getElementById('pm-order').value) || 1,
    bgColor: document.getElementById('pm-bg').value,
    textColor: document.getElementById('pm-text').value,
    active: document.getElementById('pm-active').checked,
  };
  if (!data.title) return showError('Title is required');
  try {
    if (editId) { await updatePromo(editId, data); showSuccess('Promo updated!'); }
    else { await createPromo(data); showSuccess('Promo created!'); }
    closeModal();
    loadPromos();
  } catch(e) { showError(e.message); }
}

async function handleTogglePromo(id) {
  try {
    await togglePromo(id);
    showSuccess('Promo status toggled!');
    loadPromos();
  } catch(e) { showError(e.message); }
}

function showDeletePromo(id, name) {
  if (confirm(`Delete promo "${name}"? This cannot be undone.`)) {
    deletePromo(id).then(() => { showSuccess('Promo deleted'); loadPromos(); }).catch(e => showError(e.message));
  }
}

// ════════════════════════════════════════════════════════════════
// TAB: SYSTEM HEALTH
// ════════════════════════════════════════════════════════════════
async function renderHealthTab(container) {
  container.innerHTML = '<div class="loading">Checking system health...</div>';
  try {
    const res = await getHealth();
    healthData = res.checks || {};
    const allOk = res.overall_status === 'healthy';
    
    container.innerHTML = `
      <div class="health-banner ${allOk ? 'ok' : 'degraded'}">
        <strong>${allOk ? '✅ All Systems Operational' : '⚠️ System Degraded'}</strong>
        <span>${res.timestamp ? new Date(res.timestamp).toLocaleString('en-IN') : ''}</span>
      </div>
      <div class="health-grid-full">
        ${Object.entries(healthData).map(([k,v]) => {
          const isOk = v.status === 'ok' || v.status === 'configured';
          return `
            <div class="health-card ${isOk ? 'ok' : 'err'}">
              <div class="health-card-icon">${isOk ? '✅' : '❌'}</div>
              <div class="health-card-info">
                <h4>${k.replace(/_/g,' ')}</h4>
                <span class="health-status ${isOk ? 'ok' : 'err'}">${v.status}</span>
                ${v.message ? `<p class="health-msg">${v.message}</p>` : ''}
                ${v.product_count !== undefined ? `<p class="health-detail">${v.product_count} products</p>` : ''}
                ${v.section_count !== undefined ? `<p class="health-detail">${v.section_count} sections</p>` : ''}
                ${v.key_id_set !== undefined ? `<p class="health-detail">API Keys: ${v.key_id_set ? '✅' : '❌'}</p>` : ''}
                ${v.project_id ? `<p class="health-detail">Project: ${v.project_id}</p>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="error-card">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ALERT SOUND SYSTEM — plays for 2 minutes on new orders
// ════════════════════════════════════════════════════════════════
let _alertTimeout = null;
let _lastOrderCount = 0;
let _lastTotalCount = 0;
let _alertAudioCtx = null;

function _playAlertSound() {
  let audioPlayed = false;
  
  // Method 1: HTML5 Audio (works in most browsers)
  try {
    const audio = new Audio('alert.wav');
    audio.volume = 0.7;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(function() {
        audioPlayed = true;
        // Schedule repeats every 10s for 2 minutes
        let repeatCount = 1;
        const maxRepeats = 12;
        const repeatInterval = setInterval(function() {
          repeatCount++;
          if (repeatCount > maxRepeats) {
            clearInterval(repeatInterval);
            return;
          }
          const a = new Audio('alert.wav');
          a.volume = 0.7;
          a.play().catch(function() {});
        }, 10000);
        _alertTimeout = repeatInterval;
      }).catch(function(e) {
        // HTML5 Audio blocked (Brave/Safari) — fall through to method 2
        console.log('[Alert] HTML5 Audio blocked:', e.message);
        _fallbackAlert();
      });
    }
  } catch(e) {
    _fallbackAlert();
  }
  
  // Method 2: Fallback — Web Audio API (works in Brave)
  function _fallbackAlert() {
    try {
      if (!_alertAudioCtx) {
        _alertAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_alertAudioCtx.state === 'suspended') {
        _alertAudioCtx.resume();
      }
      const now = _alertAudioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const st = now + (i * 0.35);
        const o = _alertAudioCtx.createOscillator();
        const g = _alertAudioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(800, st);
        g.gain.setValueAtTime(0.3, st);
        g.gain.setValueAtTime(0, st + 0.15);
        o.connect(g);
        g.connect(_alertAudioCtx.destination);
        o.start(st);
        o.stop(st + 0.15);
      }
      // Repeat every 10s
      let rc = 1;
      const ri = setInterval(function() {
        rc++;
        if (rc > 12) { clearInterval(ri); return; }
        if (_alertAudioCtx && _alertAudioCtx.state !== 'closed') {
          const t = _alertAudioCtx.currentTime;
          for (let i = 0; i < 3; i++) {
            const s = t + (i * 0.35);
            const o2 = _alertAudioCtx.createOscillator();
            const g2 = _alertAudioCtx.createGain();
            o2.type = 'sine';
            o2.frequency.setValueAtTime(800, s);
            g2.gain.setValueAtTime(0.25, s);
            g2.gain.setValueAtTime(0, s + 0.15);
            o2.connect(g2);
            g2.connect(_alertAudioCtx.destination);
            o2.start(s);
            o2.stop(s + 0.15);
          }
        }
      }, 10000);
      _alertTimeout = ri;
      
      // Method 3: Visual notification — flash page title
      _flashTitle();
    } catch(e2) {
      console.log('[Alert] All audio methods failed:', e2.message);
      _flashTitle();
    }
  }
  
  // Method 3: Visual fallback — flash tab title
  function _flashTitle() {
    const origTitle = document.title;
    let flashCount = 0;
    const flashInterval = setInterval(function() {
      flashCount++;
      document.title = (flashCount % 2 === 0) ? origTitle : '🔔 NEW ORDER!';
      if (flashCount > 20) { // ~10 seconds
        clearInterval(flashInterval);
        document.title = origTitle;
      }
    }, 500);
  }
  
  console.log('[Alert] 🔔 New order alert activated!');
}

function _stopAlertSound() {
  if (_alertTimeout) {
    clearInterval(_alertTimeout);
    _alertTimeout = null;
  }
  if (_alertAudioCtx) {
    _alertAudioCtx.close().catch(function() {});
    _alertAudioCtx = null;
  }
}

function _checkNewOrders() {
  // This uses the total count from loadOrders, not the displayed count
  if (_lastTotalCount > 0 && _lastOrderCount > _lastTotalCount) {
    _playAlertSound();
    showSuccess('🔔 New order received! Total: ' + _lastOrderCount);
    _lastTotalCount = _lastOrderCount;
  }
}

// ════════════════════════════════════════════════════════════════
// WEBSOCKET — Real-time order updates (replaces polling)
// ════════════════════════════════════════════════════════════════
let _ws = null;
let _wsReconnectTimer = null;

function connectWebSocket() {
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  
  // Build WS URL from API_BASE
  const wsBase = getApiBase().replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '');
  const wsUrl = wsBase + '/ws/orders';
  
  try {
    _ws = new WebSocket(wsUrl);
    
    _ws.onopen = function() {
      console.log('[WS] Connected to', wsUrl);
      // Stop auto-refresh timer — WebSocket replaces it
      if (_autoRefreshInterval) {
        clearInterval(_autoRefreshInterval);
        _autoRefreshInterval = null;
      }
    };
    
    _ws.onmessage = function(event) {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'new_order' || msg.type === 'order_update') {
          // Reload current tab silently (only if orders tab is active)
          if (activeTab === 'orders') {
            loadOrders();
          } else if (activeTab === 'dashboard') {
            refreshCurrent();
          }
          // Show notification for new orders
          if (msg.type === 'new_order') {
            showSuccess('🔔 New order: ' + (msg.order.id || '') + ' — ' + (msg.order.address_city || ''));
            _playAlertSound();
          }
        }
      } catch(e) {
        console.log('[WS] Parse error:', e);
      }
    };
    
    _ws.onclose = function() {
      console.log('[WS] Disconnected — will reconnect in 5s');
      _ws = null;
      // Reconnect after 5s
      if (_wsReconnectTimer) clearTimeout(_wsReconnectTimer);
      _wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };
    
    _ws.onerror = function() {
      console.log('[WS] Error — will reconnect');
      if (_ws) _ws.close();
    };
  } catch(e) {
    console.log('[WS] Connection failed:', e);
    // Fall back to polling if WebSocket fails
    if (!_autoRefreshInterval) startAutoRefresh();
  }
}

// ── Keep sending periodic polls as fallback ──
let _autoRefreshInterval = null;

function startAutoRefresh() {
  if (_autoRefreshInterval) clearInterval(_autoRefreshInterval);
  _autoRefreshInterval = setInterval(() => {
    if (activeTab === 'dashboard') {
      refreshCurrent();
    }
    // Orders tab already has its own 10s poll — no duplicate needed
  }, 30000);
}

// ════════════════════════════════════════════════════════════════
// CSV EXPORT
// ════════════════════════════════════════════════════════════════
function exportOrdersCSV() {
  const status = document.getElementById('order-status-filter')?.value || '';
  const url = getApiBase() + '/admin/orders/export' + (status ? '?status_filter=' + status : '');
  
  // Download via fetch + blob
  fetch(url, { headers: getAuthHeaders() })
    .then(resp => {
      if (!resp.ok) throw new Error('Export failed');
      return resp.blob();
    })
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'orders_export.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      showSuccess('✅ CSV exported!');
    })
    .catch(e => showError(e.message));
}

// ════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════════════════════════
function showFormModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ════════════════════════════════════════════════════════════════
// SYNC LAST 20 ORDERS TO FIRESTORE (cost-effective, lightweight)
// ════════════════════════════════════════════════════════════════
async function seedToFirestore() {
  const btn = document.querySelector('.nav-item[onclick*="seed"]');
  if (btn) btn.innerHTML = '⏳ Syncing...';
  
  try {
    // Fetch last 50 delivered orders from backend API (SQLite)
    const res = await apiRequest('GET', '/admin/orders?page_size=50&page=1');
    const allOrders = res.orders || [];
    
    // Only sync DELIVERED orders to Firestore
    const deliveredOrders = allOrders.filter(o => o.status === 'delivered').slice(0, 20);
    
    if (deliveredOrders.length === 0) {
      showFormModal('✅ Sync Complete', `
        <div style="text-align:center;padding:20px">
          <div style="font-size:48px;margin-bottom:12px">📡</div>
          <h3 style="margin-bottom:8px">No Delivered Orders to Sync</h3>
          <p style="color:var(--muted)">All delivered orders are already archived.</p>
          <button class="btn-primary" onclick="closeModal()" style="margin-top:16px">OK</button>
        </div>
      `);
      if (btn) btn.innerHTML = '🔄 Sync to Firestore';
      return;
    }
    
    // ── STEP 1: Sync to Firestore ──────────────────────────────
    let syncedCount = 0;
    const syncedIds = [];
    for (const order of deliveredOrders) {
      try {
        await fsSet('orders', order.id, { ...order, synced_at: new Date().toISOString() });
        syncedCount++;
        syncedIds.push(order.id);
      } catch (e) {
        console.warn('[Sync] Failed to sync order', order.id, e.message);
      }
    }
    
    // ── STEP 2: Delete synced orders from SQLite ───────────────
    let deletedCount = 0;
    if (syncedIds.length > 0) {
      try {
        const cleanupRes = await apiRequest('POST', '/admin/orders/cleanup-synced', { order_ids: syncedIds });
        deletedCount = cleanupRes.deleted_count || 0;
      } catch (e) {
        console.warn('[Cleanup] Failed to delete from SQLite:', e.message);
      }
    }
    
    // ── STEP 3: Show success popup ─────────────────────────────
    showFormModal('✅ Archive Sync Complete', `
      <div style="text-align:center;padding:20px">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <h3 style="margin-bottom:8px">Sync & Cleanup Complete!</h3>
        <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0">
          <div style="font-size:32px;font-weight:900;color:#15803d">${syncedCount}</div>
          <div style="font-size:14px;color:#15803d;font-weight:600">Orders Archived to Firestore</div>
        </div>
        ${deletedCount > 0 ? `
        <div style="background:#fef3c7;border-radius:12px;padding:12px;margin:12px 0">
          <div style="font-size:16px;font-weight:700;color:#92400e">🧹 ${deletedCount} orders cleaned from SQLite</div>
        </div>` : ''}
        <div style="font-size:12px;color:var(--muted);margin-top:8px;text-align:left">
          ✅ Active orders remain in SQLite (source of truth)<br>
          📡 Delivered orders archived to Firestore<br>
          🧹 Synced orders removed from SQLite
        </div>
        <button class="btn-primary" onclick="closeModal()" style="margin-top:16px">OK</button>
      </div>
    `);
    
    showSuccess(`📡 ${syncedCount} delivered orders archived · 🧹 ${deletedCount} cleaned from SQLite`);
  } catch (e) {
    showError('Sync failed: ' + e.message);
  }
  
  if (btn) btn.innerHTML = '🔄 Sync to Firestore';
  refreshCurrent();
}

// ════════════════════════════════════════════════════════════════
// BACKEND STATUS RING — animated indicator in sidebar
// ════════════════════════════════════════════════════════════════
function updateBackendRing() {
  const ring = document.getElementById('backend-status-ring');
  const text = document.getElementById('backend-status-text');
  const wrap = document.getElementById('backend-status-wrap');
  if (!ring) return;
  
  const healthUrl = getApiBase().replace('/api', '/health');
  fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
    .then(res => {
      if (res.ok) {
        ring.className = 'status-ring online';
        if (text) { text.className = 'status-ring-text online'; text.textContent = 'Live'; }
        if (wrap) { wrap.className = 'status-ring-wrap online'; wrap.title = 'Backend Online ✅'; }
      } else {
        ring.className = 'status-ring offline';
        if (text) { text.className = 'status-ring-text offline'; text.textContent = 'Error'; }
        if (wrap) { wrap.className = 'status-ring-wrap offline'; wrap.title = 'Backend Error ⚠️ ' + res.status; }
      }
    })
    .catch(() => {
      ring.className = 'status-ring offline';
      if (text) { text.className = 'status-ring-text offline'; text.textContent = 'Down'; }
      if (wrap) { wrap.className = 'status-ring-wrap offline'; wrap.title = 'Backend Offline ❌'; }
    });
}

// Check backend every 10 seconds
setInterval(updateBackendRing, 10000);
// Initial check after page loads
setTimeout(updateBackendRing, 2000);

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
render();
// Try WebSocket first, fall back to polling
setTimeout(connectWebSocket, 1000);

