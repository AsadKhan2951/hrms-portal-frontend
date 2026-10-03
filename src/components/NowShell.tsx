import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { fileUrl } from "@/lib/api";

/**
 * The Now workspace shell: a dark rail on the left with a lime active item,
 * which turns into a bottom tab bar on phones. Shared by the employee layout
 * and the admin layout so both sides of the portal look the same; each layout
 * only decides which menu items it passes in.
 */
export type NowNavItem = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  path: string;
  /** Unread count shown as a badge, e.g. chat messages. */
  count?: number;
};

type NowShellProps = {
  items: NowNavItem[];
  /** Paths (from `items`) pinned to the phone tab bar; the rest sit under "More". */
  tabPaths: string[];
  user?: { name?: string | null; avatar?: string | null; position?: string | null } | null;
  roleLabel?: string;
  /** Small pill under the logo, e.g. "Admin". */
  badge?: string;
  /** Extra links above the user chip, e.g. "Employee View". */
  footerItems?: NowNavItem[];
  onLogout: () => void;
  /** Sticky bar above the page, e.g. the admin search and notifications. */
  topbar?: ReactNode;
  children: ReactNode;
};

function initialsOf(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function NowShell({
  items,
  tabPaths,
  user,
  roleLabel,
  badge,
  footerItems = [],
  onLogout,
  topbar,
  children,
}: NowShellProps) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  // First item whose path matches wins, so two entries that share a path
  // (the admin menu has a couple) do not both light up.
  const activeIndex = items.findIndex(item => item.path === location);
  const visible = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const tabs = tabPaths
    .map(path => items.find(item => item.path === path))
    .filter((item): item is NowNavItem => Boolean(item));
  const hiddenUnread = items
    .filter(item => !tabPaths.includes(item.path))
    .reduce((sum, item) => sum + (item.count ?? 0), 0);
  const avatarSrc = fileUrl(user?.avatar);

  const navList = (onPick?: () => void) => (
    <nav className="now-rail-nav" aria-label="Main">
      {visible.map(({ item, index }) => {
        const Icon = item.icon;
        const active = index === activeIndex;
        return (
          <Link
            key={`${item.path}-${item.label}`}
            href={item.path}
            className={`now-rail-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={onPick}
          >
            <Icon />
            <span>{item.label}</span>
            {item.count ? <span className="now-rail-count">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (onPick?: () => void) => (
    <div className="now-rail-foot">
      {footerItems.map(item => {
        const Icon = item.icon;
        return (
          <Link key={item.path} href={item.path} className="now-rail-link" onClick={onPick}>
            <Icon />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" className="now-rail-link" onClick={toggleTheme}>
        {theme === "dark" ? <Sun /> : <Moon />}
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>
      <button type="button" className="now-rail-link danger" onClick={onLogout}>
        <LogOut />
        <span>Logout</span>
      </button>
      <Link
        href="/account"
        className={`now-rail-user${location === "/account" ? " active" : ""}`}
        onClick={onPick}
      >
        <span className="now-avatar">
          {avatarSrc ? <img src={avatarSrc} alt="" /> : initialsOf(user?.name)}
        </span>
        <span style={{ minWidth: 0 }}>
          <strong className="truncate">{user?.name || "My account"}</strong>
          <small className="truncate">{user?.position || roleLabel || ""}</small>
        </span>
      </Link>
    </div>
  );

  const search = (
    <label className="now-rail-search">
      <Search className="h-4 w-4" />
      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search menu"
        aria-label="Search menu"
      />
    </label>
  );

  return (
    <div className="now-shell">
      <aside className="now-rail">
        <img className="now-rail-logo" src="/new-logo-v2.png" alt="Now" />
        {badge && <span className="now-rail-badge">{badge}</span>}
        {search}
        {navList()}
        {footer()}
      </aside>

      <main className="now-main">
        {topbar}
        <div className="now-main-pad">{children}</div>
      </main>

      {sheetOpen && (
        <div className="now-sheet">
          <img className="now-rail-logo" src="/new-logo-v2.png" alt="Now" />
          {badge && <span className="now-rail-badge">{badge}</span>}
          {search}
          {navList(() => setSheetOpen(false))}
          {footer(() => setSheetOpen(false))}
        </div>
      )}

      <nav className="now-tabbar" aria-label="Main">
        {tabs.map(item => {
          const Icon = item.icon;
          const active = !sheetOpen && item.path === location;
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-label={item.label}
              className={`now-tab${active ? " active" : ""}`}
              onClick={() => setSheetOpen(false)}
            >
              <Icon className="h-[22px] w-[22px]" />
              {item.count ? <span className="dot" /> : null}
            </Link>
          );
        })}
        <button
          type="button"
          aria-label={sheetOpen ? "Close menu" : "All menu items"}
          aria-expanded={sheetOpen}
          className={`now-tab${sheetOpen ? " active" : ""}`}
          onClick={() => setSheetOpen(open => !open)}
        >
          {sheetOpen ? <X className="h-[22px] w-[22px]" /> : <Menu className="h-[22px] w-[22px]" />}
          {!sheetOpen && hiddenUnread > 0 ? <span className="dot" /> : null}
        </button>
      </nav>
    </div>
  );
}
