/**
 * Real-time order sync service (Customer App).
 * Uses polling as PRIMARY mechanism (reliable, works everywhere).
 * Also connects to global WebSocket for instant updates when available.
 */

import { getApiBase, listMyOrders } from './api';
import { useOrdersStore } from '../store/ordersStore';
import { notifyOrderStatus, requestPermissions } from './notificationService';

let _ws = null;
let _reconnectTimer = null;
let _pingInterval = null;
let _pollInterval = null;
let _permsRequested = false;

function getWsUrl() {
  const base = getApiBase().replace('http://', 'ws://').replace('https://', 'wss://');
  const serverBase = base.replace(/\/api$/, '');
  return `${serverBase}/ws/orders`;
}

/** Sync local orders with backend data */
async function syncOrders() {
  try {
    const res = await listMyOrders();
    const backendOrders = Array.isArray(res) ? res : (res?.orders || []);
    if (!backendOrders.length) return;
    const { orders, updateOrderStatus, updateOrderId } = useOrdersStore.getState();
    for (const bo of backendOrders) {
      // Try to match by ID or backendId
      let local = orders.find(o => o.id === bo.id || o.backendId === bo.id);
      // If no match found but this order is in pending state locally, assign backendId
      if (!local) {
        local = orders.find(o => o.status === 'pending' && !o.backendId);
        if (local) updateOrderId(local.id, bo.id);
      }
      // Update status if changed
      if (local && local.status !== bo.status) {
        const oldStatus = local.status;
        updateOrderStatus(bo.id, bo.status);
        if (local.backendId && local.backendId !== bo.id) {
          updateOrderStatus(local.backendId, bo.status);
        }
        // Send local notification for status change
        notifyOrderStatus({ ...local, status: bo.status }, bo.status);
      }
    }
  } catch {}
}

/**
 * Try to connect WebSocket for instant updates (non-critical).
 * Polling always runs regardless.
 */
function tryConnectWs() {
  const url = getWsUrl();
  try {
    _ws = new WebSocket(url);
    _ws.onopen = () => {
      console.log('[WS] Connected');
      _pingInterval = setInterval(() => {
        if (_ws?.readyState === WebSocket.OPEN) _ws.send(JSON.stringify({ type: 'ping' }));
      }, 30000);
    };
    _ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'order_update' || msg.type === 'new_order') {
          syncOrders(); // Just trigger a sync on any message
        }
      } catch {}
    };
    _ws.onclose = () => {
      clearInterval(_pingInterval);
      _pingInterval = null;
      _ws = null;
      _reconnectTimer = setTimeout(tryConnectWs, 10000);
    };
    _ws.onerror = () => { if (_ws) _ws.close(); };
  } catch {}
}

export function connectWebSocket() {
  tryConnectWs();
}

export function disconnectWebSocket() {
  clearTimeout(_reconnectTimer);
  clearInterval(_pingInterval);
  clearInterval(_pollInterval);
  _reconnectTimer = null;
  _pingInterval = null;
  _pollInterval = null;
  if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
}

export function startRealtime() {
  // Request notification permissions once
  if (!_permsRequested) {
    _permsRequested = true;
    requestPermissions();
  }
  // Initial sync
  syncOrders();
  // Poll every 5 seconds (primary)
  _pollInterval = setInterval(syncOrders, 5000);
  // Try WebSocket (bonus)
  tryConnectWs();
  return () => disconnectWebSocket();
}
