// GUI category: App state. Saves multiple addresses (Home, Office, Other) with AsyncStorage persistence.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const generateAddressId = () => `addr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

export const useAddressStore = create(
  persist(
    (set) => ({
      addresses: [],

      addAddress: (address) =>
        set((state) => ({
          addresses: [
            ...state.addresses,
            { id: generateAddressId(), ...address, createdAt: new Date().toISOString() },
          ],
        })),

      updateAddress: (id, updated) =>
        set((state) => ({
          addresses: state.addresses.map((a) =>
            a.id === id ? { ...a, ...updated } : a
          ),
        })),

      deleteAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
        })),

      clearAddresses: () => set({ addresses: [] }),
    }),
    {
      name: 'aaplakart-addresses',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
    }
  )
);
