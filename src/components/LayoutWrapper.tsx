import { useEffect, useMemo, ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isAnyHead, roleLabel } from "@/lib/roles";
import NowShell, { type NowNavItem } from "@/components/NowShell";
import { useRealtime } from "@/_core/hooks/useRealtime";
import {
  Clock,
  FileText,
  MessageSquare,
  Home,
  Calendar,
  Shield,
  LayoutGrid,
  Sparkles,
  CreditCard,
  Megaphone,
} from "lucide-react";
import { GlobalChatWidget } from "@/components/GlobalChatWidget";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import { toast } from "sonner";

interface LayoutWrapperProps {
  children: ReactNode;
  /**
   * The floating chat button. Off by default: Chat is one click away in the
   * menu, and the button sat on top of the bottom-right corner of every page.
   */
  chatWidget?: boolean;
}

/** "2026-10-05" for today in the browser's own timezone. */
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * Wingman's clock-out reminder: once a day, from 19:00, while the portal is
 * open and the person is still clocked in. It only reminds; it never clocks
 * anyone out.
 */
function useClockOutReminder() {
  const { data: activeEntry } = trpc.timeTracking.getActive.useQuery(undefined, { refetchInterval: 60000 });
  const { data: settings } = trpc.wingman.getSettings.useQuery();
  const [, navigate] = useLocation();
  const clockedIn = Boolean(activeEntry);
  const enabled = settings?.clockOutReminder === true;

  useEffect(() => {
    if (!clockedIn || !enabled) return;
    const check = () => {
      if (new Date().getHours() < 19) return;
      const key = "now-clock-out-reminded";
      try {
        if (localStorage.getItem(key) === todayKey()) return;
        localStorage.setItem(key, todayKey());
      } catch {
        // No storage: remind anyway rather than never.
      }
      toast("You are still clocked in.", {
        description: "It is past 19:00. Clock out when you are done for the day.",
        duration: 15000,
        action: { label: "Go to Home", onClick: () => navigate("/dashboard") },
      });
    };
    check();
    const timer = window.setInterval(check, 60000);
    return () => window.clearInterval(timer);
  }, [clockedIn, enabled, navigate]);
}

export default function LayoutWrapper({ children, chatWidget = false }: LayoutWrapperProps) {
  useClockOutReminder();
  const { user, logout } = useAuth();
  const currentUserId = user?.id ? String(user.id) : null;
  useRealtime();

  const { data: chatMessages } = trpc.chat.getMessages.useQuery(
    { limit: 100 },
    { refetchInterval: 10000 }
  );

  const unreadChatCount = useMemo(() => {
    if (!currentUserId || !chatMessages) return 0;
    return chatMessages.filter((msg: any) => {
      if (msg.isRead) return false;
      if (String(msg.senderId) === currentUserId) return false;
      const recipientId = msg.recipientId ? String(msg.recipientId) : null;
      return !recipientId || recipientId === currentUserId;
    }).length;
  }, [chatMessages, currentUserId]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (error: any) {
      toast.error(error?.message || "Please clock out before logging out");
    }
  };

  // The nine places from the design. Leave, forms and meetings are reached from
  // inside Time, Requests and Calendar; reports from Work.
  const menuItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Sparkles, label: "Wingman", path: "/wingman" },
    { icon: LayoutGrid, label: "Work", path: "/board" },
    { icon: Clock, label: "Time", path: "/attendance" },
    { icon: Calendar, label: "Calendar", path: "/calendar" },
    { icon: MessageSquare, label: "Chat", path: "/chat" },
    { icon: FileText, label: "Requests", path: "/requests" },
    { icon: CreditCard, label: "Pay", path: "/payslips" },
    { icon: Megaphone, label: "News", path: "/announcements" },
  ];

  const navItems: NowNavItem[] = menuItems.map(item =>
    item.path === "/chat" ? { ...item, count: unreadChatCount } : item
  );

  return (
    <NowShell
      items={navItems}
      tabPaths={["/dashboard", "/board", "/wingman", "/attendance", "/chat"]}
      user={user}
      roleLabel={roleLabel(user?.role)}
      footerItems={isAnyHead(user?.role) ? [{ icon: Shield, label: "Admin Panel", path: "/admin" }] : []}
      onLogout={handleLogout}
      compact
    >
      {/* Global Chat Widget */}
      {chatWidget && <GlobalChatWidget />}

      {/* Company announcements, shown once as a popup when new ones are posted */}
      <AnnouncementPopup />

      {children}
    </NowShell>
  );
}
