import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deliveryLogin, deliveryLoginWithToken, setAuthToken, clearAuthToken } from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (phone, otp) => {
        set({ isLoading: true });

        try {
          const result = await deliveryLogin(phone, otp);
          setAuthToken(result.token);
          set({ user: result.user, token: result.token, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: err.message };
        }
      },
      restoreSession: async () => {
        const { token } = get();
        if (!token) return false;
        setAuthToken(token);
        try {
          const user = await deliveryLoginWithToken(token);
          set({ user });
          return true;
        } catch { set({ user: null, token: null }); clearAuthToken(); return false; }
      },
      logout: () => { set({ user: null, token: null }); clearAuthToken(); AsyncStorage.removeItem('aaplakart-delivery-auth'); },
    }),
    { name: 'aaplakart-delivery-auth', storage: createJSONStorage(() => AsyncStorage), skipHydration: true }
  )
);
