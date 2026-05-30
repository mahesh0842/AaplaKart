/**
 * WebSocket service for real-time order updates.
 * Connects to backend WebSocket, refreshes orders on updates,
 * and plays notification sounds for new/critical updates.
 */

import { API_BASE } from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';

let _ws = null;
let _reconnectTimer = null;
let _pingInterval = null;
let _lastOrderCount = 0;

function getWsUrl() {
  const base = API_BASE.replace('http://', 'ws://').replace('https://', 'wss://');
  const serverBase = base.replace(/\/api$/, '');
  return `${serverBase}/ws/orders`;
}

/** Play a simple beep for new orders (uses expo-sound if available) */
function playAlertSound() {
  try {
    // Try to use a simple sound API — falls back silently
    const Audio = require('expo-av').Audio;
    const sound = new Audio.Sound();
    sound.loadAsync({ uri: 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@latest/builtins/notification.wav' })
      .then(() => sound.playAsync())
      .catch(() => {});
  } catch {}
}

export function connectWebSocket() {
  disconnectWebSocket();

  const url = getWsUrl();
  console.log('[WS] Connecting to', url);

  try {
    _ws = new WebSocket(url);

    _ws.onopen = () => {
      console.log('[WS] Connected');
      _pingInterval = setInterval(() => {
        if (_ws && _ws.readyState === WebSocket.OPEN) {
          _ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    _ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[WS] Message:', msg.type);

        if (msg.type === 'order_update') {
          const status = msg.order?.status || msg.status;
          useDeliveryStore.getState().loadOrders();
          // Play sound for delivered (success) or cancelled (important)
          if (status === 'delivered' || status === 'cancelled') {
            playAlertSound();
          }
        } else if (msg.type === 'new_order') {
          useDeliveryStore.getState().loadOrders();
          playAlertSound();
        }
      } catch (e) {
        console.log('[WS] Parse error:', e);
      }
    };

    _ws.onclose = () => {
      console.log('[WS] Disconnected — reconnect in 5s');
      clearInterval(_pingInterval);
      _pingInterval = null;
      _ws = null;
      _reconnectTimer = setTimeout(connectWebSocket, 5000);
    };

    _ws.onerror = () => {
      console.log('[WS] Error');
      if (_ws) _ws.close();
    };
  } catch (e) {
    console.log('[WS] Failed:', e);
    _reconnectTimer = setTimeout(connectWebSocket, 10000);
  }
}

export function disconnectWebSocket() {
  clearTimeout(_reconnectTimer);
  clearInterval(_pingInterval);
  _reconnectTimer = null;
  _pingInterval = null;
  if (_ws) {
    _ws.onclose = null;
    _ws.close();
    _ws = null;
  }
}

/**
 * Start real-time updates: WebSocket + polling fallback.
 */
export function startRealtime(intervalMs = 10000) {
  connectWebSocket();
  const interval = setInterval(() => {
    useDeliveryStore.getState().loadOrders();
  }, intervalMs);
  return () => {
    disconnectWebSocket();
    clearInterval(interval);
  };
}
