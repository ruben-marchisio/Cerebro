import { create } from "zustand";

type Theme = "dark" | "light";

type UIState = {
  theme: Theme;
  toggleTheme: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  theme: "dark",
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "dark" ? "light" : "dark",
    })),
}));
