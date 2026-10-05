import type { ReactNode } from "react";
import { Link } from "wouter";
import { Bell } from "lucide-react";
import LayoutWrapper from "@/components/LayoutWrapper";
import { trpc } from "@/lib/trpc";

/** The four-point star that marks anything Wingman says or offers. */
export function WingmanMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z" />
    </svg>
  );
}

/** "Ask Wingman or search" plus the notifications bell, shown top right of every page. */
export function NowHeaderTools({ hideAsk = false }: { hideAsk?: boolean }) {
  const { data: unread = 0 } = trpc.notifications.getUnreadCount.useQuery(undefined, { refetchInterval: 60000 });
  return (
    <div className="now-header-tools">
      {!hideAsk && (
        <Link href="/wingman" className="now-ask">
          <WingmanMark className="text-[var(--now-indigo)]" />
          <span>Ask Wingman or search</span>
        </Link>
      )}
      <Link
        href="/notifications"
        className="now-icon-btn"
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="dot" />}
      </Link>
    </div>
  );
}

type NowPageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Shown before the title, e.g. the avatar on the account page. */
  lead?: ReactNode;
  /** Replaces the Ask Wingman and bell tools, e.g. "Mark all as read". */
  actions?: ReactNode;
  hideAsk?: boolean;
};

export function NowPageHeader({ title, subtitle, lead, actions, hideAsk }: NowPageHeaderProps) {
  return (
    <header className="now-page-header">
      <div className="now-page-heading">
        {lead}
        <div style={{ minWidth: 0 }}>
          <h1 className="now-page-title">{title}</h1>
          {subtitle ? <div className="now-page-sub">{subtitle}</div> : null}
        </div>
      </div>
      {actions ?? <NowHeaderTools hideAsk={hideAsk} />}
    </header>
  );
}

/** A full employee page: the shell, the standard header, then the page body. */
export default function NowPage({ children, ...header }: NowPageHeaderProps & { children: ReactNode }) {
  return (
    <LayoutWrapper>
      <div className="now-page">
        <NowPageHeader {...header} />
        {children}
      </div>
    </LayoutWrapper>
  );
}

/** The indigo strip Wingman uses to point at one thing and offer to deal with it. */
export function WingmanBanner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <section className="now-banner">
      <WingmanMark size={20} className="shrink-0 text-[var(--now-indigo)]" />
      <div className="now-banner-text">{children}</div>
      {action}
    </section>
  );
}

/** A row of buttons where one is selected: Week / Month, All / Open / Closed. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = "ink",
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** "ink" fills the chosen one black; "soft" lifts it on a tinted track. */
  tone?: "ink" | "soft";
  label: string;
}) {
  return (
    <div className={`now-seg ${tone}`} role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={option.value === value ? "on" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A switch that is a real button, so the keyboard and screen readers reach it. */
export function NowSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="now-switch-btn"
      onClick={() => onChange(!checked)}
    >
      <span className={`now-switch${checked ? " on" : ""}`} />
    </button>
  );
}
