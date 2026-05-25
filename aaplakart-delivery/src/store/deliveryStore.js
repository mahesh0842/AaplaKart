import { create } from 'zustand';
import { fetchActiveOrders, updateOrderStatus, fetchActiveShop } from '../services/api';
import { SHOP_LOCATION as FALLBACK_SHOP, DELIVERY_RADIUS_KM, getDistanceInKm } from '../utils/constants';

export const useDeliveryStore = create((set, get) => ({
  orders: [],
  isLoading: false,
  lastFetch: null,
  shop: null, // Dynamic shop from backend (null = use fallback)

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

  updateStatus: async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      set((s) => ({ orders: s.orders.map((o) => o.id === orderId ? { ...o, status: newStatus } : o) }));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  },
}));
