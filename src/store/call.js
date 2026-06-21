import { create } from "zustand";

export const useCallStore = create((set) => ({
  incomingCall: null,   // { fromId, fromName, fromHandle, fromAvatar, code }
  activeCall: null,     // { code } — set when in a call
  setIncomingCall: (call) => set({ incomingCall: call }),
  clearIncomingCall: () => set({ incomingCall: null }),
  setActiveCall: (call) => set({ activeCall: call }),
  clearActiveCall: () => set({ activeCall: null }),
}));
