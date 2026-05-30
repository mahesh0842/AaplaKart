// GUI category: App services. API client for the AaplaKart backend.
// All requests go through here so we can handle auth headers centrally.
// Uses the Expo development host IP when on a device, localhost for web.
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getApiBase = () => {
  // Use env variable if set (highest priority)
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) return `${envUrl}/api`;

  // On web -> localhost works fine
  if (Platform.OS === 'web') return 'http://localhost:8000/api';

  // On mobile -> use the Expo dev server host IP (e.g. 192.168.x.x:8082)
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || '';
  const devIp = hostUri ? hostUri.split(':')[0] : '';
  if (devIp) return `http://${devIp}:8000/api`;

  // Fallback
  return 'http://localhost:8000/api';
};

const API_BASE = getApiBase();

// ── Helpers ─────────────────────────────────────────────────────────

let _idToken = null;
let _uid = null;  // Fallback when no Firebase token (e.g., Google sign-in)

export function setAuthToken(token) {
  _idToken = token;
}

export function clearAuthToken() {
  _idToken = null;
  _uid = null;
}

export function getAuthToken() {
  return _idToken;
}

export function setAuthUid(uid) {
  _uid = uid;
}

export function getAuthUid() {
  return _uid;
}

async function request(method, path, body = null, timeoutMs = 10000) {
  const headers = { 'Content-Type': 'application/json' };

  if (_idToken) {
    headers['Authorization'] = `Bearer ${_idToken}`;
  } else if (_uid) {
    // Fallback: use X-User-ID header for non-Firebase auth (Google sign-in)
    headers['X-User-ID'] = _uid;
  }

  const options = { method, headers };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  // Add timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = JSON.parse(text);
      detail = err.detail || detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Simple version with absolute URL — used by OTP flow which may hit a different host
export async function rawPost(url, body, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await resp.text();
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try { detail = JSON.parse(text).detail || detail; } catch {}
      throw new Error(detail);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Auth ────────────────────────────────────────────────────────────

/**
 * Send OTP to a phone number via the backend.
 * Returns { session_info } which must be passed back to verify-otp.
 */
export async function sendOtp(phoneNumber) {
  return request('POST', '/auth/send-otp', { phone_number: phoneNumber });
}

/**
 * Verify the OTP code with the session_info from send-otp.
 * On success, the auth token is automatically stored.
 */
export async function verifyOtp(phoneNumber, otp, sessionInfo) {
  const result = await request('POST', '/auth/verify-otp', {
    phone_number: phoneNumber,
    otp,
    session_info: sessionInfo,
  });
  if (result.id_token) {
    setAuthToken(result.id_token);
  }
  return result;
}

/**
 * Verify a Firebase ID token with the backend.
 * Call this after the client completes Firebase phone-auth.
 */
export async function verifyFirebaseToken(idToken, phoneNumber = '') {
  const result = await request('POST', '/auth/verify-token', {
    id_token: idToken,
    phone_number: phoneNumber,
  });
  // Store the token for subsequent requests
  setAuthToken(idToken);
  return result;
}

/**
 * Sign in with the test custom token (dev only).
 */
export async function testLogin() {
  const result = await request('POST', '/auth/test-login');
  if (result.id_token) {
    setAuthToken(result.id_token);
  }
  return result;
}

/**
 * Mock login — generates a fresh token via Admin SDK (dev/testing).
 * Used when mock OTP mode is active and test-login token is expired.
 */
export async function mockLogin() {
  const result = await request('POST', '/auth/mock-login');
  if (result.id_token) {
    setAuthToken(result.id_token);
  }
  return result;
}

/**
 * Simple login — accepts ANY phone number, no OTP required (dev mode).
 * Creates/finds user in DB and returns a mock-dev- token.
 * Perfect for development when Firebase SMS is not available.
 */
export async function simpleLogin(phoneNumber, displayName = '', email = '') {
  const result = await request('POST', '/auth/simple-login', {
    phone_number: phoneNumber,
    display_name: displayName,
    email: email,
  });
  if (result.id_token) {
    setAuthToken(result.id_token);
  }
  return result;
}

/**
 * Sign in with Google — sends Google ID token to backend.
 * Backend verifies the token against Google's tokeninfo endpoint,
 * extracts email & name, and creates/finds the user.
 *
 * @param {string} googleIdToken - Google-issued ID token (from expo-auth-session)
 * @param {string} displayName - User's display name from Google
 * @param {string} photoUrl - User's profile photo URL from Google
 * @returns {object} { success, uid, email, display_name, is_new_user, ... }
 */
export async function googleSignIn(googleIdToken, displayName = '', photoUrl = '') {
  const result = await request('POST', '/auth/google', {
    id_token: googleIdToken,
    display_name: displayName,
    photo_url: photoUrl,
  });

  if (result.success) {
    // Store UID for subsequent authenticated requests
    setAuthUid(result.uid);
  }

  return result;
}

/**
 * Sign in with email & password.
 * Backend uses Firebase REST API to authenticate and returns an id_token.
 *
 * @param {string} email
 * @param {string} password
 * @returns {object} { success, uid, email, display_name, id_token, ... }
 */
export async function emailSignIn(email, password) {
  const result = await request('POST', '/auth/email-signin', {
    email,
    password,
  });

  if (result.success && result.id_token) {
    setAuthToken(result.id_token);
  }

  return result;
}

/**
 * Sign up with email, password & display name.
 * Backend creates the account via Firebase REST API and returns an id_token.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {object} { success, uid, email, display_name, id_token, is_new_user, ... }
 */
export async function emailSignUp(email, password, displayName = '') {
  const result = await request('POST', '/auth/email-signup', {
    email,
    password,
    display_name: displayName,
  });

  if (result.success && result.id_token) {
    setAuthToken(result.id_token);
  }

  return result;
}

/**
 * Get the currently authenticated user's profile.
 */
export async function getMyProfile() {
  return request('GET', '/auth/me');
}

/**
 * Update the current user's profile.
 */
export async function updateMyProfile(data) {
  return request('PATCH', '/auth/me', data);
}

// ── Orders ──────────────────────────────────────────────────────────

/**
 * Place a new order (requires auth).
 */
export async function createOrder(orderData) {
  return request('POST', '/orders/', orderData);
}

/**
 * List all orders for the current user.
 */
export async function listMyOrders() {
  return request('GET', '/orders/');
}

/**
 * Get a single order by ID.
 */
export async function getOrder(orderId) {
  return request('GET', `/orders/${orderId}`);
}

// ── Addresses ───────────────────────────────────────────────────────

/**
 * List saved addresses for the current user.
 */
export async function listAddresses() {
  return request('GET', '/addresses/');
}

/**
 * Save a new address.
 */
export async function createAddress(addressData) {
  return request('POST', '/addresses', addressData);
}

/**
 * Delete an address.
 */
export async function deleteAddress(addressId) {
  return request('DELETE', `/addresses/${addressId}`);
}

// ── Products ────────────────────────────────────────────────────────

/**
 * Fetch products with optional filters.
 * @param {object} [params]
 * @param {string} [params.brand] - 'kart' | 'waffle' | 'all'
 * @param {string} [params.category] - category name filter
 * @param {string} [params.subcategory] - subcategory filter
 * @param {string} [params.search] - search term
 */
export async function fetchProducts(params = {}) {
  const query = new URLSearchParams();
  if (params.brand && params.brand !== 'all') query.set('brand', params.brand);
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.subcategory) query.set('subcategory', params.subcategory);
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return request('GET', `/products${qs ? `?${qs}` : ''}`);
}

/**
 * Create a new product (admin).
 */
export async function createProduct(productData) {
  return request('POST', '/products', productData);
}

/**
 * Update an existing product (admin).
 */
export async function updateProduct(productId, updates) {
  return request('PUT', `/products/${productId}`, updates);
}

/**
 * Delete a product (admin).
 */
export async function deleteProduct(productId) {
  return request('DELETE', `/products/${productId}`);
}

/**
 * Get list of categories.
 */
export async function fetchCategories(brand) {
  const query = brand ? `?brand=${brand}` : '';
  return request('GET', `/products/categories/list${query}`);
}

// ── Categories (Sections Hierarchy) ─────────────────────────────────

/**
 * Fetch sections with nested categories/subcategories.
 * @param {object} [params]
 * @param {string} [params.type] - 'kart' | 'app' | 'all'
 */
export async function fetchSections(params = {}) {
  const query = new URLSearchParams();
  if (params.type && params.type !== 'all') query.set('type', params.type);
  const qs = query.toString();
  return request('GET', `/categories/sections${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch flat list of categories.
 * @param {object} [params]
 * @param {string} [params.type] - 'kart' | 'app' | 'all'
 * @param {string} [params.section_id] - filter by section
 */
export async function fetchCategoriesList(params = {}) {
  const query = new URLSearchParams();
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.section_id) query.set('section_id', params.section_id);
  const qs = query.toString();
  return request('GET', `/categories${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch subcategories, optionally filtered.
 * @param {object} [params]
 * @param {string} [params.category_id] - filter by category
 * @param {string} [params.type] - 'kart' | 'app'
 */
export async function fetchSubcategories(params = {}) {
  const query = new URLSearchParams();
  if (params.category_id) query.set('category_id', params.category_id);
  if (params.type) query.set('type', params.type);
  const qs = query.toString();
  return request('GET', `/categories/subcategories${qs ? `?${qs}` : ''}`);
}


/**
 * Create a Razorpay order via the backend.
 * @param {object} body - { amount: number (paise), currency: string, receipt?: string }
 */
export async function createRazorpayOrder(body) {
  return request('POST', '/payments/create-order', body);
}

/**
 * Verify a Razorpay payment signature via the backend.
 * @param {object} body - { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export async function verifyRazorpayPayment(body) {
  return request('POST', '/payments/verify-payment', body);
}

// ── Config & Promos ──────────────────────────────────────────────────

/**
 * Fetch global app configuration (delivery fee, thresholds, razorpay key, etc.)
 */
export async function fetchAppConfig() {
  return request('GET', '/config');
}

/**
 * Fetch promo banners/slides.
 * @param {object} [params]
 * @param {string} [params.brand] - 'kart' | 'waffle' | 'all'
 * @param {string} [params.position] - 'home_banner' | 'waffle_offer'
 * @param {boolean} [params.active_only] - only active promos
 */
export async function fetchPromos(params = {}) {
  const query = new URLSearchParams();
  if (params.brand && params.brand !== 'all') query.set('brand', params.brand);
  if (params.position) query.set('position', params.position);
  if (params.active_only === false) query.set('active_only', 'false');
  const qs = query.toString();
  return request('GET', `/config/promos${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch delivery time slots from backend.
 */
export async function fetchDeliverySlots() {
  return request('GET', '/config/delivery-slots');
}

/**
 * Fetch payment methods from backend.
 */
export async function fetchPaymentMethods() {
  return request('GET', '/config/payment-methods');
}

/**
 * Fetch order status labels from backend.
 */
export async function fetchOrderStatuses() {
  return request('GET', '/config/order-statuses');
}

// ── Admin endpoints removed — admin panel is now a separate website. ──
// See D:\\AaplaKart_Native\\Admin_panel\\
