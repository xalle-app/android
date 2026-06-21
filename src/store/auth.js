import { create } from "zustand";
import { storage } from "../lib/storage.js";
import { ws } from "../lib/ws.js";

export const useAuthStore = create((set) => ({
  token: null,
  user:  null,
  ready: false,

  init: async () => {
    try {
      const raw = await storage.get("xalle_session");
      if (raw) {
        const { token, user } = JSON.parse(raw);
        if (token && user) { set({ token, user, ready: true }); return; }
      }
    } catch {}
    set({ ready: true });
  },

  login: async (token, user) => {
    await storage.set("xalle_session", JSON.stringify({ token, user }));
    set({ token, user });
  },

  updateUser: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),

  logout: async () => {
    ws.disconnect();
    await storage.remove("xalle_session");
    set({ token: null, user: null });
  },
}));
