import { API_BASE } from '../utils/constants';

let _token = null;

export function setAuthToken(token) { _token = token; }
export function clearAuthToken() { _token = null; }
export function getAuthToken() { return _token; }

async function request(method, path, body = null, timeoutMs = 15000) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;
  let response;
  try { response = await fetch(`${API_BASE}${path}`, options); }
  finally { clearTimeout(timeoutId); }
  const text = await response.text();
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try { detail = JSON.parse(text).detail || detail; } catch {}
    throw new Error(detail);
  }
  try { return JSON.parse(text); } catch { return text; }
}

export async function deliveryLogin(phone, otp) {
  return request('POST', '/auth/delivery-login', { phone_number: phone, otp });
}

export async function deliveryLoginWithToken(token) {
  setAuthToken(token);
  return request('GET', '/auth/me');
}

export async function fetchAssignedOrders() {
  return request('GET', '/delivery/orders?radius_km=10');
}

export async function fetchActiveOrders() {
  return request('GET', '/delivery/orders');
}

export async function updateOrderStatus(orderId, newStatus) {
  return request('PATCH', `/delivery/orders/${orderId}/status`, { status: newStatus });
}

export async function fetchOrderDetail(orderId) {
  return request('GET', `/orders/${orderId}`);
}

export async function fetchAllOrders() {
  return request('GET', '/admin/orders');
}

export async function fetchActiveShop() {
  return request('GET', '/shops/active');
}

/** Accept an order — notify backend that delivery partner has claimed it */
export async function acceptOrderApi(orderId) {
  return request('POST', `/delivery/orders/${orderId}/accept`);
}

/** Reject an order — notify backend that delivery partner doesn't want it */
export async function rejectOrderApi(orderId) {
  return request('POST', `/delivery/orders/${orderId}/reject`);
}
