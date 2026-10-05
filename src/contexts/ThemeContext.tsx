import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
/** What the person chose. "system" follows the device setting. */
export type ThemeMode = Theme | "system";

interface ThemeContextType {
  /** The theme actually showing. */
  theme: Theme;
  /** The choice behind it, which may be "system". */
  mode: ThemeMode;
  setMode?: (mode: ThemeMode) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

const systemQuery = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia?.(systemQuery).matches ? "dark" : "light";
}

function readStoredMode(fallback: Theme): ThemeMode {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => (switchable ? readStoredMode(defaultTheme) : defaultTheme));
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme: Theme = mode === "system" ? system : mode;

  // Follow the device while "system" is chosen.
  useEffect(() => {
    const media = window.matchMedia?.(systemQuery);
    if (!media) return;
    const onChange = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!switchable) return;
    try {
      localStorage.setItem("theme", mode);
    } catch {
      // Private mode: the choice simply lasts for this visit.
    }
  }, [mode, switchable]);

  const setMode = switchable ? (next: ThemeMode) => setModeState(next) : undefined;
  const toggleTheme = switchable ? () => setModeState(theme === "light" ? "dark" : "light") : undefined;

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
