// GUI category: App state. Stores placed orders persistently with Zustand + AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ORDER_STATUS } from '../utils/constants';

const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AAPL-${timestamp}${random}`;
};

export const useOrdersStore = create(
  persist(
    (set) => ({
      orders: [],

      placeOrder: (orderData) => {
        const now = new Date();
        const deliverySlotMinutes = {
          asap: 60,
          morning: 7 * 60,
          afternoon: 12 * 60,
          evening: 17 * 60,
        };
        const addMinutes = deliverySlotMinutes[orderData.deliverySlot] || 60;
        const newOrder = {
          id: generateOrderId(),
          items: orderData.items || [],
          subtotal: orderData.subtotal || 0,
          deliveryFee: orderData.deliveryFee || 0,
          total: orderData.total || 0,
          paymentMethod: orderData.paymentMethod || 'cod',
          address: orderData.address || {},
          latitude: orderData.latitude || null,
          longitude: orderData.longitude || null,
          deliverySlot: orderData.deliverySlot || 'asap',
          deliverySlotLabel: orderData.deliverySlotLabel || 'ASAP',
          status: ORDER_STATUS.PENDING,
          placedAt: now.toISOString(),
          updatedAt: now.toISOString(),
          estimatedDelivery: new Date(
            now.getTime() + addMinutes * 60 * 1000
          ).toISOString(),
        };

        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));

        return newOrder;
      },

      updateOrderStatus: (orderId, status) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
          ),
        })),

      updateOrderId: (localId, backendId) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === localId ? { ...order, backendId } : order
          ),
        })),

      clearOrders: () => set({ orders: [] }),
    }),
    {
      name: 'aaplakart-orders',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
