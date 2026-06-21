import { create } from "zustand";

export const usePlayerStore = create((set) => ({
  track:     null,
  isPlaying: false,
  position:  0,
  duration:  0,

  setTrack:     (track)    => set({ track }),
  setIsPlaying: (v)        => set({ isPlaying: v }),
  setPosition:  (v)        => set({ position: v }),
  setDuration:  (v)        => set({ duration: v }),
  clear:        ()         => set({ track: null, isPlaying: false, position: 0, duration: 0 }),
}));
