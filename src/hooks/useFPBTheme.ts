import { useTheme } from "@/contexts/ThemeContext";

export type FPBTheme = "dark" | "light";

/**
 * Class names for the Work board and its dialogs.
 *
 * The board used to keep a light/dark choice of its own. It now follows the
 * portal's theme, so every token is written against the portal's colour
 * variables and one set serves both modes.
 */
export function useFPBTheme() {
  const { theme, toggleTheme } = useTheme();

  const t = {
    bg: "bg-background",
    card: "bg-card",
    cardHover: "hover:bg-background",
    surface: "bg-background",
    surfaceHover: "hover:bg-background",
    border: "border-border",
    borderMd: "border-border",
    borderDashed: "border-border",
    textPrimary: "text-foreground",
    textSecondary: "text-foreground/80",
    textMuted: "text-muted-foreground",
    input: "bg-card border-border text-foreground placeholder:text-muted-foreground",
    select: "bg-card border-border text-foreground",
    selectContent: "bg-card border-border text-foreground",
    dialog: "bg-card border-border text-foreground",
    btnGhost: "hover:bg-background text-muted-foreground hover:text-foreground",
    btnOutline: "bg-card border-border text-foreground hover:bg-background",
    dragOver: "bg-[var(--now-indigo-tint)]",
    divider: "bg-border",
    tagBg: "bg-background",
    emptyIcon: "text-muted-foreground",
    canvasBg: theme === "dark" ? "#171c15" : "#f5f6f3",
    canvasText: theme === "dark" ? "#94a3b8" : "#64748b",
  };

  return { theme: theme as FPBTheme, toggle: toggleTheme ?? (() => {}), t };
}
