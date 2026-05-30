// GUI category: App state. Stores the cart globally and persists it between app restarts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_MAX_QTY = 10;

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, qty = 1) =>
        set((state) => {
          // Use variant-specific ID: productId_weight → separate cart rows per unit.
          // Only use product.weight (set by variant selector), NOT product.unit (display hint like "kg").
          const weight = product.weight || '';
          const cartId = weight ? `${product.id}_${weight}` : product.id;
          const existingItem = state.items.find((item) => item.id === cartId);
          const maxQty = product.maxQuantity || product.maxQuantity_ || DEFAULT_MAX_QTY;

          if (existingItem) {
            const newQty = Math.min(existingItem.quantity + qty, maxQty);
            if (newQty === existingItem.quantity) return state;
            return {
              items: state.items.map((item) =>
                item.id === cartId
                  ? { ...item, quantity: newQty }
                  : item
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                id: cartId,
                productId: product.id,
                name: product.name,
                price: product.price,
                weight: weight,
                stock: product.stock,
                category: product.category,
                image: product.image || product.firebaseImagePath || '',
                maxQuantity: maxQty,
                quantity: Math.min(qty, maxQty),
              },
            ],
          };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => item.id !== productId)
              : state.items.map((item) => {
                  if (item.id !== productId) return item;
                  const max = item.maxQuantity || DEFAULT_MAX_QTY;
                  return { ...item, quantity: Math.min(quantity, max) };
                }),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'aaplakart-cart',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
