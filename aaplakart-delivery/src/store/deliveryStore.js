import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchActiveOrders, updateOrderStatus, fetchActiveShop, acceptOrderApi, rejectOrderApi } from '../services/api';
import { SHOP_LOCATION as FALLBACK_SHOP, DELIVERY_RADIUS_KM, getDistanceInKm } from '../utils/constants';

const ACCEPTED_KEY = 'aaplakart-delivery-accepted';
const REJECTED_KEY = 'aaplakart-delivery-rejected';

export const useDeliveryStore = create((set, get) => ({
  orders: [],
  isLoading: false,
  lastFetch: null,
  shop: null,
  /** Set of order IDs accepted by this delivery partner */
  acceptedIds: new Set(),
  /** Set of order IDs rejected by this delivery partner */
  rejectedIds: new Set(),

  /** Initialize accepted IDs from storage */
  initAccepted: async () => {
    try {
      const raw = await AsyncStorage.getItem(ACCEPTED_KEY);
      if (raw) set({ acceptedIds: new Set(JSON.parse(raw)) });
      const rejRaw = await AsyncStorage.getItem(REJECTED_KEY);
      if (rejRaw) set({ rejectedIds: new Set(JSON.parse(rejRaw)) });
    } catch {}
  },

  /** Save accepted IDs to storage */
  _persistAccepted: async (ids) => {
    try { await AsyncStorage.setItem(ACCEPTED_KEY, JSON.stringify([...ids])); } catch {}
  },
  /** Save rejected IDs to storage */
  _persistRejected: async (ids) => {
    try { await AsyncStorage.setItem(REJECTED_KEY, JSON.stringify([...ids])); } catch {}
  },

  loadShop: async () => {
    try {
      const result = await fetchActiveShop();
      if (result?.success && result?.shop) {
        set({ shop: result.shop });
      }
    } catch { /* use fallback shop */ }
  },

  getShopLocation: () => {
    const { shop } = get();
    if (shop?.latitude && shop?.longitude) {
      return { latitude: shop.latitude, longitude: shop.longitude, name: shop.name, address: shop.address || '' };
    }
    return FALLBACK_SHOP;
  },

  loadOrders: async () => {
    set({ isLoading: true });
    try {
      const result = await fetchActiveOrders();
      let list = Array.isArray(result) ? result : (result.orders || []);

      const shopLoc = get().getShopLocation();
      list = list.filter((o) => {
        const lat = o.address_latitude;
        const lon = o.address_longitude;
        if (!lat || !lon) return true;
        const dist = getDistanceInKm(shopLoc.latitude, shopLoc.longitude, lat, lon);
        return dist <= DELIVERY_RADIUS_KM;
      });

      list = list.map((o) => {
        if (o.address_latitude && o.address_longitude) {
          return { ...o, distanceFromShop: getDistanceInKm(shopLoc.latitude, shopLoc.longitude, o.address_latitude, o.address_longitude) };
        }
        return { ...o, distanceFromShop: null };
      });

      set({ orders: list, isLoading: false, lastFetch: Date.now() });
    } catch {
      set({ isLoading: false });
    }
  },

  /** Accept an order — update local state AND notify backend */
  acceptOrder: async (orderId) => {
    const { acceptedIds } = get();
    const next = new Set(acceptedIds);
    next.add(orderId);
    set({ acceptedIds: next });
    await get()._persistAccepted(next);

    // Sync with backend — non-blocking, best-effort
    try {
      await acceptOrderApi(orderId);
      console.log('[DeliveryStore] Accepted order synced to backend:', orderId);
    } catch (err) {
      console.warn('[DeliveryStore] Backend accept sync failed:', err?.message);
      // Don't revert local state — order is shown as accepted to the partner.
      // Backend will be updated on next poll/refresh.
    }
  },

  /** Release an order — remove from acceptedIds. Also notify backend if needed. */
  releaseOrder: async (orderId) => {
    const { acceptedIds } = get();
    const next = new Set(acceptedIds);
    next.delete(orderId);
    set({ acceptedIds: next });
    await get()._persistAccepted(next);

    // Notify backend that partner released the order (reset to pending)
    try {
      await updateOrderStatus(orderId, 'pending');
      console.log('[DeliveryStore] Released order reverted to pending:', orderId);
    } catch (err) {
      console.warn('[DeliveryStore] Backend release sync failed:', err?.message);
    }
  },

  /** Reject an order — update local state AND notify backend */
  rejectOrder: async (orderId) => {
    const { rejectedIds } = get();
    const next = new Set(rejectedIds);
    next.add(orderId);
    set({ rejectedIds: next });
    await get()._persistRejected(next);

    // Sync with backend — non-blocking, best-effort
    try {
      await rejectOrderApi(orderId);
      console.log('[DeliveryStore] Rejected order synced to backend:', orderId);
    } catch (err) {
      console.warn('[DeliveryStore] Backend reject sync failed:', err?.message);
    }
  },

  /** Get accepted orders */
  getAcceptedOrders: () => {
    const { orders, acceptedIds } = get();
    return orders.filter((o) => acceptedIds.has(o.id));
  },

  /** Get available (unaccepted, unrejected) orders */
  getAvailableOrders: () => {
    const { orders, acceptedIds, rejectedIds } = get();
    return orders.filter((o) => !acceptedIds.has(o.id) && !rejectedIds.has(o.id));
  },

  updateStatus: async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      set((s) => ({ orders: s.orders.map((o) => o.id === orderId ? { ...o, status: newStatus } : o) }));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  },
}));
