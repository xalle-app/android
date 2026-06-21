import { create } from "zustand";
import { Appearance } from "react-native";

export const LIGHT = {
  ACCENT:   "#c8745a",
  BG:       "#faf7f2",
  SURFACE:  "#ffffff",
  INK:      "#1a1815",
  INK_SOFT: "#8a7f78",
  LINE:     "#e8e2da",
  WARM:     "#f3ede6",
  DARK:     false,
};

export const DARK = {
  ACCENT:   "#d4896f",
  BG:       "#0f0e0c",
  SURFACE:  "#1a1815",
  INK:      "#f0ebe4",
  INK_SOFT: "#7a7068",
  LINE:     "#2a2520",
  WARM:     "#201e1a",
  DARK:     true,
};

const systemScheme = Appearance.getColorScheme();

export const useThemeStore = create((set) => ({
  mode: "system",   // "light" | "dark" | "system"
  colors: systemScheme === "dark" ? DARK : LIGHT,

  setMode: (mode) => {
    let colors = LIGHT;
    if (mode === "dark") colors = DARK;
    else if (mode === "system") colors = Appearance.getColorScheme() === "dark" ? DARK : LIGHT;
    set({ mode, colors });
  },
}));

// Sync with system when in "system" mode
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode, setMode } = useThemeStore.getState();
  if (mode === "system") setMode("system");
});

export function useTheme() {
  return useThemeStore(s => s.colors);
}
