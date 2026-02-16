import { useState, ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Clock,
  FileText,
  MessageSquare,
  LogOut,
  Sun,
  Moon,
  Home,
  ClipboardList,
  Settings,
  Bell,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Menu,
  X,
  FolderKanban,
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { GlobalChatWidget } from "@/components/GlobalChatWidget";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
      window.location.href = "/";
    },
  });

  const menuItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Calendar, label: "Attendance", path: "/attendance" },
    { icon: ClipboardList, label: "Leave Management", path: "/leave" },
    { icon: FolderKanban, label: "Projects", path: "/projects" },
    { icon: FileText, label: "Forms", path: "/forms" },
    { icon: MessageSquare, label: "Chat", path: "/chat" },
    { icon: DollarSign, label: "Payslips", path: "/payslips" },
    { icon: Bell, label: "Announcements", path: "/announcements" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const filteredMenuItems = menuItems.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } bg-card border-r transition-all duration-300 flex flex-col fixed lg:relative inset-y-0 left-0 z-50 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo & Toggle */}
        <div className="p-4 border-b flex items-center justify-between">
          {!sidebarCollapsed && (
            <img src="/radflow-logo.png" alt="Rad.flow" className="h-8" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex"
          >
            {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        {/* Search */}
        {!sidebarCollapsed && (
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full ${sidebarCollapsed ? "justify-center px-0" : "justify-start"}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Theme Toggle & Logout */}
        <div className="p-2 border-t space-y-1">
          <Button
            variant="ghost"
            onClick={toggleTheme}
            className={`w-full ${sidebarCollapsed ? "justify-center px-0" : "justify-start"}`}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            className={`w-full ${sidebarCollapsed ? "justify-center px-0" : "justify-start"} text-red-500 hover:text-red-600 hover:bg-red-500/10`}
          >
            <LogOut className="h-5 w-5" />
            {!sidebarCollapsed && <span className="ml-3">Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Global Chat Widget */}
      <GlobalChatWidget />

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-30 bg-card border-b p-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <img src="/radflow-logo.png" alt="Rad.flow" className="h-8" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
