import { useMemo, useState, ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  Users, 
  FileCheck, 
  MessageSquareText, 
  DollarSign, 
  FolderKanban,
  LayoutGrid,
  BarChart3,
  Calendar,
  Clock,
  Menu,
  X,
  LogOut,
  Shield,
  Home,
  Search,
  Bell,
  MessageCircle,
  Activity,
  Settings,
  Mail,
  FileText,
  Building2
} from "lucide-react";
import { Link, Redirect } from "wouter";
import { hasRank, isAnyHead, roleLabel, type Role } from "@/lib/roles";
import NowShell, { type NowNavItem } from "./NowShell";
import { trpc } from "@/lib/trpc";
import { useRealtime } from "@/_core/hooks/useRealtime";
import { toast } from "sonner";
import { GlobalChatWidget } from "./GlobalChatWidget";
import { NotesWidget } from "./NotesWidget";
import { AnnouncementPopup } from "./AnnouncementPopup";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const currentUserId = user?.id ? String(user.id) : null;
  useRealtime();

  const { data: chatMessages } = trpc.chat.getMessages.useQuery(
    { limit: 100 },
    { refetchInterval: 10000 }
  );
  const { data: notifications = [] } = trpc.notifications.getAll.useQuery();

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
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error(error?.message || "Please clock out before logging out");
    }
  };

  // Check if user is admin
  if (user && !isAnyHead(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  const menuItems = [
    // `minRole` keeps a department head out of the organisation-wide pages
    // they can reach the shell for. The backend refuses them anyway; this is
    // so they are not shown doors that will not open.
    { icon: Home, label: "Overview", path: "/admin", minRole: "head_of_ops" },
    { icon: Users, label: "My Team", path: "/admin/team", minRole: "dept_head" },
    { icon: Users, label: "Employees", path: "/admin/employees", minRole: "head_of_ops" },
    { icon: Building2, label: "Organisation", path: "/admin/organisation", minRole: "head_of_ops" },
    { icon: FileCheck, label: "Leaves", path: "/admin/leaves", minRole: "dept_head" },
    { icon: MessageSquareText, label: "Forms", path: "/admin/forms", minRole: "head_of_ops" },
    { icon: DollarSign, label: "Payslips", path: "/admin/payslips", minRole: "head_of_ops" },
    { icon: LayoutGrid, label: "Project Board", path: "/board", minRole: "dept_head" },
    { icon: Calendar, label: "Calendar", path: "/calendar", minRole: "dept_head" },
    { icon: Users, label: "Schedule Meeting", path: "/schedule-meeting", minRole: "dept_head" },
    { icon: Bell, label: "Announcements", path: "/admin/announcements", minRole: "head_of_ops" },
    { icon: BarChart3, label: "Reports", path: "/admin/reports", minRole: "head_of_ops" },
    { icon: BarChart3, label: "Employee Reports", path: "/reports", minRole: "head_of_ops" },
    { icon: Clock, label: "Clock-Out Reports", path: "/admin/reports", minRole: "head_of_ops" },
    { icon: Mail, label: "Email", path: "/chat", minRole: "dept_head" },
    { icon: FileText, label: "Notes", path: "/forms", minRole: "dept_head" },
  ].filter(item => hasRank(user?.role, item.minRole as Role));

  const recentNotifications = [
    ...(unreadChatCount > 0
      ? [
          {
            id: "chat",
            type: "chat",
            message: `You have ${unreadChatCount} unread chat message${unreadChatCount > 1 ? "s" : ""}.`,
            time: "Just now",
          },
        ]
      : []),
    ...notifications.slice(0, 5).map((n: any) => ({
      id: n.id,
      type: n.type,
      message: n.title ? `${n.title} — ${n.message}` : n.message,
      time: n.createdAt ? new Date(n.createdAt).toLocaleString() : "",
    })),
  ];

  const navItems: NowNavItem[] = menuItems.map(({ icon, label, path }) => ({
    icon,
    label,
    path,
    count: path === "/chat" ? unreadChatCount : undefined,
  }));

  const topbar = (
    <div className="now-topbar">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground truncate">Welcome back, {user?.name}</p>
      </div>

      <div className="flex items-center gap-2">
        {/* Universal Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees, reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-72 h-[42px] rounded-xl bg-card border-transparent"
          />
        </div>

        {/* Chat Widget Button */}
        <button
          type="button"
          className="now-icon-btn"
          aria-label="Chat"
          onClick={() => setShowChat(!showChat)}
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          {unreadChatCount > 0 && <span className="dot" />}
        </button>

        {/* Notification Center */}
        <div className="relative">
          <button
            type="button"
            className="now-icon-btn"
            aria-label="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="h-[18px] w-[18px]" />
            {(unreadChatCount > 0 || recentNotifications.length > 0) && <span className="dot" />}
          </button>

          {showNotifications && (
            <Card className="absolute right-0 top-12 w-80 p-4 shadow-lg gap-0 border-border">
              <h3 className="font-semibold mb-3 text-sm">Recent Activity</h3>
              <div className="space-y-3">
                {recentNotifications.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing new.</p>
                )}
                {recentNotifications.map((notif) => (
                  <div key={notif.id} className="flex gap-2 text-xs">
                    <Activity className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{notif.message}</p>
                      <p className="text-muted-foreground">{notif.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/notifications">
                <Button variant="link" className="w-full mt-3 h-8 text-xs">
                  View All Notifications
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <NowShell
      items={navItems}
      tabPaths={["/admin", "/admin/team", "/admin/leaves", "/board"]}
      user={user}
      roleLabel={roleLabel(user?.role)}
      badge="Admin"
      footerItems={[{ icon: Home, label: "Employee View", path: "/dashboard" }]}
      onLogout={handleLogout}
      topbar={topbar}
    >
      {children}

      {/* Global Chat Widget */}
      {showChat && (
        <div className="fixed bottom-4 right-4 z-50">
          <GlobalChatWidget />
        </div>
      )}

      <NotesWidget />

      {/* Company announcements, shown once as a popup when new ones are posted */}
      <AnnouncementPopup />
    </NowShell>
  );
}
