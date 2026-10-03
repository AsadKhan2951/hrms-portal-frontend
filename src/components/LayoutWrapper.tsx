import { useMemo, ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isAnyHead, roleLabel } from "@/lib/roles";
import NowShell, { type NowNavItem } from "@/components/NowShell";
import { useRealtime } from "@/_core/hooks/useRealtime";
import {
  Clock,
  FileText,
  BarChart3,
  MessageSquare,
  Home,
  ClipboardList,
  Settings,
  Bell,
  DollarSign,
  Calendar,
  Users,
  Shield,
  LayoutGrid,
} from "lucide-react";
import { GlobalChatWidget } from "@/components/GlobalChatWidget";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import { toast } from "sonner";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
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

  const menuItems = [
    { icon: Home, label: "Flow Central", path: "/dashboard" },
    { icon: Clock, label: "Attendance", path: "/attendance" },
    { icon: ClipboardList, label: "Leave Management", path: "/leave" },
    { icon: LayoutGrid, label: "Project Board", path: "/board" },
    { icon: BarChart3, label: "Reports", path: "/reports" },
    { icon: FileText, label: "Forms", path: "/forms" },
    { icon: MessageSquare, label: "Chat", path: "/chat" },
    { icon: Calendar, label: "Calendar", path: "/calendar" },
    { icon: Users, label: "Schedule Meeting", path: "/schedule-meeting" },
    { icon: DollarSign, label: "Payslips", path: "/payslips" },
    { icon: Bell, label: "Announcements", path: "/announcements" },
    { icon: Settings, label: "Account", path: "/account" },
    ...(isAnyHead(user?.role) ? [{ icon: Shield, label: "Admin Panel", path: "/admin" }] : []),
  ];

  const navItems: NowNavItem[] = menuItems.map(item =>
    item.path === "/chat" ? { ...item, count: unreadChatCount } : item
  );

  return (
    <NowShell
      items={navItems}
      tabPaths={["/dashboard", "/board", "/attendance", "/chat"]}
      user={user}
      roleLabel={roleLabel(user?.role)}
      onLogout={handleLogout}
    >
      {/* Global Chat Widget */}
      <GlobalChatWidget />

      {/* Company announcements, shown once as a popup when new ones are posted */}
      <AnnouncementPopup />

      {children}
    </NowShell>
  );
}
