import { useCallback, useEffect, useState } from "react";

export type FPBTheme = "dark" | "light";

/**
 * Light/dark tokens for the Flow Project Board.
 *
 * The board keeps its own preference because it is a dense, full-bleed surface
 * that people often want light while the rest of the portal stays dark. Unlike
 * the reference version this never touches document.documentElement — doing so
 * fought the app's own ThemeContext and left the portal stuck in dark mode
 * after leaving the board.
 */
const STORAGE_KEY = "fpb-theme";

export function useFPBTheme() {
  const [theme, setTheme] = useState<FPBTheme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "light" || stored === "dark" ? stored : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing; the choice just will not persist.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(current => (current === "dark" ? "light" : "dark"));
  }, []);

  const dark = theme === "dark";

  const t = {
    bg: dark ? "bg-[#0a0a0f]" : "bg-[#f4f5f7]",
    card: dark ? "bg-[#0f0f13]" : "bg-white",
    cardHover: dark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50",
    surface: dark ? "bg-white/[0.02]" : "bg-slate-100/80",
    surfaceHover: dark ? "hover:bg-white/[0.04]" : "hover:bg-slate-200/60",
    border: dark ? "border-white/10" : "border-slate-200",
    borderMd: dark ? "border-white/10" : "border-slate-200",
    borderDashed: dark ? "border-white/10" : "border-slate-300",
    textPrimary: dark ? "text-white" : "text-slate-900",
    textSecondary: dark ? "text-slate-400" : "text-slate-600",
    textMuted: dark ? "text-slate-500" : "text-slate-400",
    input: dark
      ? "bg-white/5 border-white/10 text-white placeholder:text-slate-600"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    select: dark
      ? "bg-white/5 border-white/10 text-white"
      : "bg-white border-slate-200 text-slate-900",
    selectContent: dark
      ? "bg-[#1a1a24] border-white/10 text-white"
      : "bg-white border-slate-200 text-slate-900",
    dialog: dark
      ? "bg-[#0f0f13] border-white/10 text-white"
      : "bg-white border-slate-200 text-slate-900",
    btnGhost: dark
      ? "hover:bg-white/10 text-slate-400 hover:text-white"
      : "hover:bg-slate-100 text-slate-500 hover:text-slate-900",
    btnOutline: dark
      ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900",
    dragOver: dark
      ? "bg-violet-500/5 border border-violet-500/20"
      : "bg-violet-50 border border-violet-200",
    divider: dark ? "bg-white/10" : "bg-slate-200",
    tagBg: dark ? "bg-white/10" : "bg-slate-100",
    emptyIcon: dark ? "text-slate-600" : "text-slate-400",
    canvasBg: dark ? "#0f0f13" : "#f8fafc",
    canvasText: dark ? "#94a3b8" : "#64748b",
  };

  return { theme, toggle, t };
}
