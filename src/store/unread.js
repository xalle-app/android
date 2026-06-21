import { create } from "zustand";

export const useUnreadStore = create(set => ({
  messages:      0,
  notifications: 0,
  setMessages:      n  => set({ messages: Math.max(0, n) }),
  setNotifications: n  => set({ notifications: Math.max(0, n) }),
  incMessages:      () => set(s => ({ messages: s.messages + 1 })),
  incNotifications: () => set(s => ({ notifications: s.notifications + 1 })),
  clearMessages:    () => set({ messages: 0 }),
}));
