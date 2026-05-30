// Global user display name store — allows AddressFormSheet to update
// the name and App.js/ProfileScreen to react immediately.
import { create } from 'zustand';

export const useUserNameStore = create((set) => ({
  displayName: '',
  setDisplayName: (name) => set({ displayName: name }),
}));
