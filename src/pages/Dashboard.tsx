import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/useMobile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { isAnyHead, roleLabel } from "@/lib/roles";
import { TimeInOutDialog } from "@/components/TimeInOutDialog";
import { getAvatarById } from "@shared/avatars";
import {
  Clock, 
  Calendar, 
  TrendingUp, 
  FileText, 
  MessageSquare, 
  LogOut,
  Menu,
  X,
  Coffee,
  Sun,
  Moon,
  Home,
  ClipboardList,
  Users,
  Settings,
  Bell,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Shield,
  CheckCircle2,
  Loader2,
  BarChart3,
  List,
  Plus,
  Timer,
  StickyNote,
  LifeBuoy,
  LayoutGrid,
  Check,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { addHours, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, subDays } from "date-fns";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import NowShell, { type NowNavItem } from "@/components/NowShell";
import { GlobalChatWidget } from "@/components/GlobalChatWidget";
import { NotesWidget } from "@/components/NotesWidget";
import { NotificationSidebar } from "@/components/NotificationSidebar";
import { CalendarSidebar } from "@/components/CalendarSidebar";
import { QuickMeetingSidebar } from "@/components/QuickMeetingSidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Today's Calendar Widget Component
function TodayCalendarWidgetContent() {
  const { data: meetings, isLoading } = trpc.meetings.getMyMeetings.useQuery();
  
  const todayMeetings = meetings?.filter((m: any) => {
    const meetingDate = new Date(m.startTime);
    return meetingDate.toDateString() === new Date().toDateString();
  }) || [];

  const { data: events } = trpc.calendar.getMyEvents.useQuery();
  
  const todayEvents = events?.filter(event => {
    const eventDate = new Date(event.startTime);
    return eventDate.toDateString() === new Date().toDateString();
  }) || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const allItems = [
    ...todayMeetings.map((m: any) => ({ type: 'meeting' as const, title: m.title, time: new Date(m.startTime) })),
    ...todayEvents.map((e: any) => ({ type: 'event' as const, title: e.title, time: new Date(e.startTime) }))
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  if (allItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No events scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allItems.slice(0, 3).map((item, idx) => (
        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
          <div className="flex-shrink-0 w-12 text-center">
            <div className="text-sm font-semibold">{format(item.time, 'HH:mm')}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {item.type === 'meeting' ? <Users className="h-4 w-4 text-blue-500" /> : <Calendar className="h-4 w-4 text-green-500" />}
              <span className="font-medium truncate">{item.title}</span>
            </div>
          </div>
        </div>
      ))}
      {allItems.length > 3 && (
        <div className="text-center text-sm text-muted-foreground">
          +{allItems.length - 3} more events
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [breakOverlayOpen, setBreakOverlayOpen] = useState(false);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [breakReason, setBreakReason] = useState("");
  const [notificationSidebarOpen, setNotificationSidebarOpen] = useState(false);
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(false);
  const [meetingSidebarOpen, setMeetingSidebarOpen] = useState(false);
  const [attendanceView, setAttendanceView] = useState<'graph' | 'list'>('graph');
  const [fabOpen, setFabOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackPriority, setFeedbackPriority] = useState<"low" | "medium" | "high">("medium");
  const initialWorkSession = useMemo(() => {
    const now = new Date();
    return {
      date: format(now, "yyyy-MM-dd"),
      start: format(now, "HH:mm"),
      end: format(addHours(now, 2), "HH:mm"),
    };
  }, []);
  const [workSessionOpen, setWorkSessionOpen] = useState(false);
  const [workSessionDate, setWorkSessionDate] = useState(initialWorkSession.date);
  const [workSessionStart, setWorkSessionStart] = useState(initialWorkSession.start);
  const [workSessionEnd, setWorkSessionEnd] = useState(initialWorkSession.end);
  const [workSessionType, setWorkSessionType] = useState<"remote" | "onsite">("remote");
  const [workSessionDescription, setWorkSessionDescription] = useState("");
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [overtimeHours, setOvertimeHours] = useState("1");
  const [overtimeProjectId, setOvertimeProjectId] = useState("");
  const [overtimeTaskId, setOvertimeTaskId] = useState("");
  const [overtimeDescription, setOvertimeDescription] = useState("");
  const currentUserId = user?.id ? String(user.id) : null;

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (error: any) {
      toast.error(error?.message || "Please clock out before logging out");
    }
  };

  // Auto-show time in/out dialog on component mount
  useEffect(() => {
    const hasShownDialog = sessionStorage.getItem("timeDialogShown");
    if (!hasShownDialog) {
      setTimeDialogOpen(true);
      sessionStorage.setItem("timeDialogShown", "true");
    }
  }, []);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: activeEntry } = trpc.timeTracking.getActive.useQuery();
  const updateLocationMutation = trpc.timeTracking.updateLocation.useMutation();
  const locationRequestedForEntry = useRef<string | null>(null);
  const { data: breakLogs } = trpc.timeTracking.getBreakLogs.useQuery();
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

  // Get current month attendance
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const { data: monthAttendance } = trpc.timeTracking.getAttendance.useQuery({
    startDate: monthStart,
    endDate: monthEnd,
  });

  // Get last 7 days for trends
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const { data: weekAttendance } = trpc.timeTracking.getAttendance.useQuery({
    startDate: weekStart,
    endDate: weekEnd,
  });

  // Get project stats
  const { data: projectStats } = trpc.projects.getStats.useQuery();
  const { data: myProjects } = trpc.projects.getMyProjects.useQuery();
  const { data: myTaskStats } = trpc.projects.getMyTaskStats.useQuery();
  const { data: weeklyOvertime = [] } = trpc.timeTracking.getOvertimeByRange.useQuery({
    startDate: weekStart,
    endDate: weekEnd,
  });
  const { data: overtimeTasks = [] } = trpc.projects.getTasks.useQuery(
    { projectId: overtimeProjectId },
    { enabled: Boolean(overtimeProjectId) }
  );

  const utils = trpc.useUtils();

  useEffect(() => {
    if (overtimeProjectId && overtimeTasks.length > 0 && !overtimeTaskId) {
      setOvertimeTaskId(String(overtimeTasks[0].id));
    }
  }, [overtimeProjectId, overtimeTasks, overtimeTaskId]);

  useEffect(() => {
    if (!activeEntry || (activeEntry as any).location) return;
    if (!navigator.geolocation) return;
    const entryId = String((activeEntry as any).id || "");
    if (!entryId || locationRequestedForEntry.current === entryId) return;

    locationRequestedForEntry.current = entryId;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocationMutation.mutate({
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "gps",
          },
        });
      },
      () => {
        // Ignore errors silently; location will stay unavailable.
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [activeEntry, updateLocationMutation]);

  const resetWorkSessionForm = () => {
    const now = new Date();
    setWorkSessionDate(format(now, "yyyy-MM-dd"));
    setWorkSessionStart(format(now, "HH:mm"));
    setWorkSessionEnd(format(addHours(now, 2), "HH:mm"));
    setWorkSessionType("remote");
    setWorkSessionDescription("");
  };

  const buildDateTime = (dateValue: string, timeValue: string) => {
    if (!dateValue || !timeValue) return null;
    const [year, month, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return new Date(year, month - 1, day, hour, minute);
  };

  const resetOvertimeForm = () => {
    setOvertimeDate(format(new Date(), "yyyy-MM-dd"));
    setOvertimeHours("1");
    setOvertimeProjectId("");
    setOvertimeTaskId("");
    setOvertimeDescription("");
  };

  const handleSubmitFeedback = () => {
    if (!feedbackSubject.trim()) {
      toast.error("Please add a subject");
      return;
    }
    if (!feedbackMessage.trim()) {
      toast.error("Please add details for the ticket");
      return;
    }
    submitFeedbackMutation.mutate({
      formType: "feedback",
      subject: feedbackSubject.trim(),
      content: feedbackMessage.trim(),
      priority: feedbackPriority,
    });
  };

  const addOvertimeMutation = trpc.timeTracking.addOvertime.useMutation({
    onSuccess: () => {
      toast.success("Overtime added");
      setOvertimeOpen(false);
      resetOvertimeForm();
      utils.timeTracking.getOvertimeByRange.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add overtime");
    },
  });

  const addWorkSessionMutation = trpc.timeTracking.addWorkSession.useMutation({
    onSuccess: () => {
      toast.success("Work session added");
      setWorkSessionOpen(false);
      resetWorkSessionForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add work session");
    },
  });

  const submitFeedbackMutation = trpc.forms.submit.useMutation({
    onSuccess: () => {
      toast.success("Support ticket submitted");
      setFeedbackOpen(false);
      setFeedbackSubject("");
      setFeedbackMessage("");
      setFeedbackPriority("medium");
      utils.forms.getMyForms.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit feedback");
    },
  });

  const startBreakMutation = trpc.timeTracking.startBreak.useMutation({
    onSuccess: () => {
      toast.success("Break started");
      setBreakOverlayOpen(true);
      setBreakDialogOpen(false);
      setBreakReason("");
      utils.timeTracking.getBreakLogs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start break");
    },
  });

  const endBreakMutation = trpc.timeTracking.endBreak.useMutation({
    onSuccess: (data) => {
      toast.success(`Break ended. Duration: ${data.duration} minutes`);
      setBreakOverlayOpen(false);
      utils.timeTracking.getBreakLogs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to end break");
    },
  });

  const activeBreak = breakLogs?.find(log => !log.breakEnd);
  const breakReasonOptions = ["Smoke", "Meeting", "Lunch", "Outgoing", "Sleeping"];

  const calculateStats = () => {
    if (!monthAttendance) return { avgHours: 0, totalDays: 0, presentDays: 0 };
    
    const completedEntries = monthAttendance.filter(e => e.status !== "active");
    const totalHours = completedEntries.reduce((sum, entry) => {
      return sum + (parseFloat(entry.totalHours as any) || 0);
    }, 0);

    return {
      avgHours: completedEntries.length > 0 ? totalHours / completedEntries.length : 0,
      totalDays: monthAttendance.length,
      presentDays: completedEntries.length,
    };
  };

  const stats = calculateStats();

  const getWeeklyInsights = () => {
    if (!weekAttendance || weekAttendance.length === 0) {
      return {
        avgHours: 0,
        lastDayOff: "No data",
        earlyTimeouts: 0,
        lateShifts: 0,
      };
    }

    const completedEntries = weekAttendance.filter(e => e.status !== "active");
    const totalHours = completedEntries.reduce((sum, entry) => {
      return sum + (parseFloat(entry.totalHours as any) || 0);
    }, 0);

    const earlyTimeouts = completedEntries.filter(e => e.status === "early_out").length;
    const lastEntry = weekAttendance[weekAttendance.length - 1];
    const lastDayOff = lastEntry ? format(new Date(lastEntry.timeIn), "MMM dd, yyyy") : "No data";

    return {
      avgHours: completedEntries.length > 0 ? totalHours / completedEntries.length : 0,
      lastDayOff,
      earlyTimeouts,
      lateShifts: 0,
    };
  };

  const insights = getWeeklyInsights();

  const weeklyTargetHours = 40;
  const weeklyOvertimeHours = useMemo(() => {
    return weeklyOvertime.reduce((sum: number, entry: any) => sum + (Number(entry.hours) || 0), 0);
  }, [weeklyOvertime]);

  const weeklyHoursSummary = useMemo(() => {
    if (!weekAttendance || weekAttendance.length === 0) {
      return {
        total: 0,
        progress: 0,
        missingCount: 0,
        missingPenalty: 0,
      };
    }

    const now = currentTime;
    const todayStart = startOfDay(now).getTime();
    let completedHours = 0;
    let activeTodayHours = 0;
    let missingCount = 0;

    weekAttendance.forEach((entry: any) => {
      const timeIn = new Date(entry.timeIn);
      const isActive = entry.status === "active" || !entry.timeOut;
      if (isActive) {
        const timeInDay = startOfDay(timeIn).getTime();
        if (timeInDay < todayStart) {
          missingCount += 1;
        } else {
          activeTodayHours += (now.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
        }
        return;
      }

      const hours = entry.totalHours
        ? Number(entry.totalHours)
        : entry.timeOut
          ? (new Date(entry.timeOut).getTime() - timeIn.getTime()) / (1000 * 60 * 60)
          : 0;
      completedHours += hours;
    });

    const missingPenalty = missingCount * 8;
    const total = completedHours + activeTodayHours - missingPenalty;
    const progress = weeklyTargetHours
      ? Math.min(100, Math.max(0, (total / weeklyTargetHours) * 100))
      : 0;

    return {
      total: Number(total.toFixed(2)),
      progress,
      missingCount,
      missingPenalty,
    };
  }, [weekAttendance, currentTime]);

  const taskCompletionRate = useMemo(() => {
    const total = myTaskStats?.total || 0;
    const completed = myTaskStats?.completed || 0;
    return total ? (completed / total) * 100 : 0;
  }, [myTaskStats]);

  const minOvertimeDate = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const maxOvertimeDate = format(new Date(), "yyyy-MM-dd");

  // ---- Data for the Now home layout ----
  const { data: myTasks = [] } = trpc.projects.getMyTasks.useQuery();
  const { data: myLeaves = [] } = trpc.leaves.getMyLeaves.useQuery();
  const { data: announcements = [] } = trpc.dashboard.getAnnouncements.useQuery();
  const { data: unreadNotifications = 0 } = trpc.notifications.getUnreadCount.useQuery();
  const { data: myMeetings = [] } = trpc.meetings.getMyMeetings.useQuery();
  const updateTaskMutation = trpc.projects.updateTask.useMutation({
    onSuccess: () => {
      utils.projects.getMyTasks.invalidate();
      utils.projects.getMyTaskStats.invalidate();
    },
    onError: (error: any) => toast.error(error?.message || "Could not update the task"),
  });

  const hourNow = currentTime.getHours();
  const firstName = (user?.name || "").trim().split(/\s+/)[0] || "there";
  const todayStartMs = startOfDay(currentTime).getTime();

  // Open tasks first (late ones on top), then what was finished today.
  const dashboardTasks = useMemo(() => {
    const dueMs = (task: any) =>
      task.completionDate ? new Date(task.completionDate).getTime() : Number.MAX_SAFE_INTEGER;
    const open = (myTasks as any[])
      .filter(task => task.status !== "completed")
      .sort((x, y) => dueMs(x) - dueMs(y));
    const doneToday = (myTasks as any[]).filter(
      task =>
        task.status === "completed" &&
        task.completedAt &&
        new Date(task.completedAt).getTime() >= todayStartMs
    );
    return [...open, ...doneToday].slice(0, 8);
  }, [myTasks, todayStartMs]);
  const doneTaskCount = dashboardTasks.filter((task: any) => task.status === "completed").length;

  // Per project: how many of this person's tasks are done, and how many are late.
  const projectHealth = useMemo(() => {
    const map = new Map<string, { total: number; done: number; late: number }>();
    (myTasks as any[]).forEach(task => {
      const projectId = String(task.project?.id ?? task.projectId ?? "");
      if (!projectId) return;
      const entry = map.get(projectId) ?? { total: 0, done: 0, late: 0 };
      entry.total += 1;
      if (task.status === "completed") entry.done += 1;
      else if (task.completionDate && new Date(task.completionDate).getTime() < todayStartMs) entry.late += 1;
      map.set(projectId, entry);
    });
    return map;
  }, [myTasks, todayStartMs]);

  // Approved leave days taken this calendar year, by type.
  const leaveSummary = useMemo(() => {
    const year = currentTime.getFullYear();
    const totals: Record<string, number> = { annual: 0, casual: 0, sick: 0 };
    (myLeaves as any[]).forEach(leave => {
      if (leave.status !== "approved") return;
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      if (start.getFullYear() !== year) return;
      const days = Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1);
      totals[leave.leaveType] = (totals[leave.leaveType] ?? 0) + days;
    });
    return Object.entries(totals).map(([type, days]) => ({ type, days }));
  }, [myLeaves, currentTime.getFullYear()]);
  const pendingLeaveCount = (myLeaves as any[]).filter(leave => leave.status === "pending").length;

  const latestAnnouncement: any = (announcements as any[])[0] ?? null;

  const elapsedLabel = useMemo(() => {
    if (!activeEntry) return "00:00:00";
    const seconds = Math.max(0, Math.floor((currentTime.getTime() - new Date(activeEntry.timeIn).getTime()) / 1000));
    const two = (n: number) => String(n).padStart(2, "0");
    return `${two(Math.floor(seconds / 3600))}:${two(Math.floor(seconds / 60) % 60)}:${two(seconds % 60)}`;
  }, [activeEntry, currentTime]);

  // The brief: only things that are true right now, each with one action.
  const lateTaskCount = (myTasks as any[]).filter(
    task => task.status !== "completed" && task.completionDate && new Date(task.completionDate).getTime() < todayStartMs
  ).length;
  const openTaskCount = (myTasks as any[]).filter(task => task.status !== "completed").length;
  const meetingsLeftToday = (myMeetings as any[]).filter(meeting => {
    const start = new Date(meeting.startTime).getTime();
    return start >= currentTime.getTime() && start < todayStartMs + 86400000 && meeting.status !== "cancelled";
  }).length;
  const briefItems: { key: string; title: string; detail: string; action: string; href?: string; onClick?: () => void }[] = [];
  if (!activeEntry) {
    briefItems.push({
      key: "clock",
      title: "You haven't clocked in yet",
      detail: "Start your day so your hours count.",
      action: "Clock in",
      onClick: () => setTimeDialogOpen(true),
    });
  }
  if (weeklyHoursSummary.missingCount > 0) {
    briefItems.push({
      key: "missing",
      title: `${weeklyHoursSummary.missingCount} missed clock-out${weeklyHoursSummary.missingCount > 1 ? "s" : ""} this week`,
      detail: `It is costing you ${weeklyHoursSummary.missingPenalty}h on your weekly total.`,
      action: "Review",
      href: "/attendance",
    });
  }
  if (lateTaskCount > 0) {
    briefItems.push({
      key: "late",
      title: `${lateTaskCount} task${lateTaskCount > 1 ? "s are" : " is"} past the due date`,
      detail: `${openTaskCount} open in total.`,
      action: "Open tasks",
      href: "/projects",
    });
  }
  if (meetingsLeftToday > 0) {
    briefItems.push({
      key: "meetings",
      title: `${meetingsLeftToday} meeting${meetingsLeftToday > 1 ? "s" : ""} left today`,
      detail: "See times and links on your calendar.",
      action: "Calendar",
      href: "/calendar",
    });
  }
  if (unreadChatCount > 0) {
    briefItems.push({
      key: "chat",
      title: `${unreadChatCount} unread message${unreadChatCount > 1 ? "s" : ""}`,
      detail: "Someone is waiting on a reply.",
      action: "Open chat",
      href: "/chat",
    });
  }

  const menuItems = [
    { icon: Home, label: "Flow Central", path: "/dashboard" },
    { icon: Clock, label: "Attendance", path: "/attendance" },
    { icon: ClipboardList, label: "Leave Management", path: "/leave" },
    { icon: LayoutGrid, label: "Project Board", path: "/board" },
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
        <div>
          {/* Greeting + quick actions */}
          <header className="now-page-header">
            <div>
              <h1 className="now-page-title">
                {hourNow < 12 ? "Good morning" : hourNow < 18 ? "Good afternoon" : "Good evening"}, {firstName}.
              </h1>
              <div className="now-page-sub">{format(currentTime, "EEEE, d MMMM yyyy")}</div>
            </div>
            <div className="now-header-actions">
              <button type="button" className="now-icon-btn" title="Today's Schedule" aria-label="Today's schedule" onClick={() => setCalendarSidebarOpen(true)}>
                <Calendar className="h-[18px] w-[18px]" />
              </button>
              <button type="button" className="now-icon-btn" title="Quick Meeting" aria-label="Quick meeting" onClick={() => setMeetingSidebarOpen(true)}>
                <Users className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                className="now-icon-btn"
                title={activeEntry ? "Clock out to add a work session" : "Add Work Session"}
                aria-label="Add work session"
                disabled={Boolean(activeEntry)}
                onClick={() => {
                  resetWorkSessionForm();
                  setWorkSessionOpen(true);
                }}
              >
                <Plus className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                className="now-icon-btn"
                title="Add Overtime"
                aria-label="Add overtime"
                onClick={() => {
                  if (myProjects && myProjects.length > 0) {
                    setOvertimeProjectId(String(myProjects[0].id));
                  }
                  setOvertimeTaskId("");
                  setOvertimeDate(format(new Date(), "yyyy-MM-dd"));
                  setOvertimeHours("1");
                  setOvertimeDescription("");
                  setOvertimeOpen(true);
                }}
              >
                <Timer className="h-[18px] w-[18px]" />
              </button>
              <button type="button" className="now-icon-btn" title="Support Ticket" aria-label="Support ticket" onClick={() => setFeedbackOpen(true)}>
                <LifeBuoy className="h-[18px] w-[18px]" />
              </button>
              <Link href="/leave" className="now-icon-btn" title="Apply Leave" aria-label="Apply leave">
                <ClipboardList className="h-[18px] w-[18px]" />
              </Link>
              <button type="button" className="now-icon-btn" title="Notifications" aria-label="Notifications" onClick={() => setNotificationSidebarOpen(true)}>
                <Bell className="h-[18px] w-[18px]" />
                {unreadNotifications > 0 && <span className="dot" />}
              </button>
            </div>
          </header>

          <div className="now-cols">
            <div className="now-col-main">
              {/* Today's brief, worked out from the clock, tasks, chat and calendar */}
              <section className="now-wm">
                <div className="now-wm-label">
                  <img src="/wingman-logo.jpg" alt="" className="h-6 w-6 rounded-md" />
                  <span>Wingman · today</span>
                </div>
                <h2>
                  {briefItems.length === 0
                    ? "You're all caught up."
                    : briefItems.length === 1
                      ? "One thing needs you today."
                      : `${briefItems.length} things need you today.`}
                </h2>
                {briefItems.length > 0 && (
                  <div className="now-brief">
                    {briefItems.map(item => (
                      <div key={item.key}>
                        <div className="min-w-0">
                          <div className="font-semibold">{item.title}</div>
                          <div className="now-small now-muted">{item.detail}</div>
                        </div>
                        {item.href ? (
                          <Link href={item.href} className="now-btn text shrink-0">{item.action}</Link>
                        ) : (
                          <button type="button" className="now-btn text shrink-0" onClick={item.onClick}>{item.action}</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* My tasks */}
              <section className="now-card" style={{ paddingBottom: 8, gap: 0 }}>
                <div className="now-card-head" style={{ marginBottom: 8 }}>
                  <h2 className="now-h2">My tasks</h2>
                  <div className="flex items-baseline gap-4">
                    <span className="now-muted text-sm">{doneTaskCount} of {dashboardTasks.length} done</span>
                    <Link href="/board" className="now-link">Open board</Link>
                  </div>
                </div>
                {dashboardTasks.length === 0 && (
                  <p className="now-muted text-sm py-6 text-center">No tasks assigned to you yet.</p>
                )}
                {dashboardTasks.map((task: any) => {
                  const done = task.status === "completed";
                  const due = task.completionDate ? new Date(task.completionDate) : null;
                  const late = Boolean(due && !done && due.getTime() < startOfDay(currentTime).getTime());
                  return (
                    <div className="now-task-row" key={task.id}>
                      <button
                        type="button"
                        className={`now-check${done ? " done" : ""}`}
                        aria-pressed={done}
                        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
                        disabled={updateTaskMutation.isPending}
                        onClick={() =>
                          updateTaskMutation.mutate({
                            taskId: String(task.id),
                            status: done ? "todo" : "completed",
                          })
                        }
                      >
                        <span><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
                      </button>
                      <div className={`now-task-title truncate${done ? " done" : ""}`}>{task.title}</div>
                      <div className="now-small now-muted now-task-project truncate max-w-[160px]">{task.project?.name || ""}</div>
                      <div className={`now-task-due${late ? " now-warn" : ""}`}>
                        {done ? "Done" : due ? (late ? `Late · ${format(due, "d MMM")}` : format(due, "d MMM")) : task.status === "blocked" ? "Blocked" : ""}
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* Project health */}
              <section className="now-card" style={{ gap: 16 }}>
                <div className="now-card-head">
                  <h2 className="now-h2">Project health</h2>
                  <Link href="/projects" className="now-link">All projects</Link>
                </div>
                {myProjects && myProjects.length > 0 ? (
                  <div className="now-project-grid">
                    {myProjects.slice(0, 4).map((project: any) => {
                      const health = projectHealth.get(String(project.id)) ?? { total: 0, done: 0, late: 0 };
                      const pct = health.total ? Math.round((health.done / health.total) * 100) : 0;
                      const atRisk = health.late > 0 || project.status === "on_hold";
                      return (
                        <div className="now-tile" key={project.id}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-bold text-[17px] truncate">{project.name}</div>
                            <span className={`now-pill ${atRisk ? "risk" : "lime"}`}>
                              {health.late > 0 ? "At risk" : String(project.status || "active").replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="now-bar on-tile">
                            <span className={atRisk ? "risk" : ""} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between gap-3 now-small now-muted">
                            <span>{health.total ? `${health.done} of ${health.total} of your tasks done` : "No tasks for you yet"}</span>
                            <span className="capitalize">{health.late > 0 ? `${health.late} late` : project.role || project.priority || ""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 now-muted">
                    <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No projects assigned yet</p>
                  </div>
                )}
              </section>

              {/* Week at a glance */}
              <section className="now-card" style={{ gap: 18 }}>
                <h2 className="now-h2">Your week at a glance</h2>
                <div className="now-stat-grid">
                  <div>
                    <div className="now-stat-label">Avg hours this week</div>
                    <div className="now-stat-value">{insights.avgHours.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="now-stat-label">Avg hours per day (month)</div>
                    <div className="now-stat-value">{stats.avgHours.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="now-stat-label">Days present this month</div>
                    <div className="now-stat-value">{stats.presentDays}</div>
                  </div>
                  <div>
                    <div className="now-stat-label">Early timeouts</div>
                    <div className={`now-stat-value${insights.earlyTimeouts > 0 ? " now-warn" : ""}`}>{insights.earlyTimeouts}</div>
                  </div>
                  <div>
                    <div className="now-stat-label">OT hours this week</div>
                    <div className="now-stat-value">{weeklyOvertimeHours.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="now-stat-label">Projects assigned</div>
                    <div className="now-stat-value">{projectStats?.totalAssigned || 0}</div>
                  </div>
                  <div>
                    <div className="now-stat-label">Active projects</div>
                    <div className="now-stat-value">{projectStats?.activeProjects || 0}</div>
                  </div>
                  <div>
                    <div className="now-stat-label">Task completion</div>
                    <div className="now-stat-value">{taskCompletionRate.toFixed(0)}%</div>
                    <div className="now-small now-muted">{myTaskStats?.completed || 0}/{myTaskStats?.total || 0} tasks</div>
                  </div>
                  <div>
                    <div className="now-stat-label">Last clock-in</div>
                    <div className="font-semibold mt-1">{insights.lastDayOff}</div>
                  </div>
                </div>
              </section>

              {/* Attendance trends */}
              <section className="now-card">
                <div className="now-card-head" style={{ alignItems: "center" }}>
                  <h2 className="now-h2">Attendance trends</h2>
                  <div className="flex gap-1">
                    <Button
                      variant={attendanceView === 'graph' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setAttendanceView('graph')}
                      className="h-8 px-2.5"
                      aria-label="Graph view"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={attendanceView === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setAttendanceView('list')}
                      className="h-8 px-2.5"
                      aria-label="List view"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {monthAttendance && monthAttendance.length > 0 ? (
                  attendanceView === 'graph' ? (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthAttendance.slice(0, 10).reverse().map((entry) => ({
                          date: format(new Date(entry.timeIn), 'MMM dd'),
                          hours: entry.timeOut
                            ? Number(((new Date(entry.timeOut).getTime() - new Date(entry.timeIn).getTime()) / (1000 * 60 * 60)).toFixed(1))
                            : 0
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                          <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} stroke="var(--border)" width={32} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}
                            labelStyle={{ color: 'var(--foreground)' }}
                          />
                          <Line type="monotone" dataKey="hours" name="Hours" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {monthAttendance.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between px-3 py-2 bg-background rounded-xl text-sm">
                          <div>
                            <p className="font-semibold">{format(new Date(entry.timeIn), "MMM dd")}</p>
                            <p className="now-small now-muted font-mono">
                              {format(new Date(entry.timeIn), "HH:mm")} - {entry.timeOut ? format(new Date(entry.timeOut), "HH:mm") : "Active"}
                            </p>
                          </div>
                          <span className={`now-pill ${entry.status === "completed" || entry.status === "active" ? "lime" : "risk"}`}>
                            {entry.timeOut ? `${((new Date(entry.timeOut).getTime() - new Date(entry.timeIn).getTime()) / (1000 * 60 * 60)).toFixed(1)}h` : 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="text-center now-muted py-8 text-sm">No attendance data available</p>
                )}
              </section>
            </div>

            <div className="now-col-side">
              {/* Time clock */}
              <section className="now-card" style={{ gap: 16 }}>
                <div className="flex items-center justify-between">
                  <h2 className="now-h2">Time clock</h2>
                  <span className={`now-pill md${!activeEntry ? "" : activeBreak ? " risk" : " lime"}`} aria-live="polite">
                    {!activeEntry ? "Clocked out" : activeBreak ? "On break" : "Clocked in"}
                  </span>
                </div>
                <div>
                  <div className="now-timer">{activeEntry ? elapsedLabel : "00:00:00"}</div>
                  <div className="now-muted text-sm mt-2">
                    {!activeEntry
                      ? "You are clocked out."
                      : activeBreak
                        ? `On break since ${format(new Date(activeBreak.breakStart), "HH:mm")}`
                        : `Since ${format(new Date(activeEntry.timeIn), "HH:mm")} today`}
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    className={`now-btn grow ${activeEntry ? "ink" : "lime"}`}
                    onClick={() => setTimeDialogOpen(true)}
                  >
                    {activeEntry ? "Clock out" : "Clock in"}
                  </button>
                  <button
                    type="button"
                    className="now-btn grow"
                    disabled={!activeEntry || endBreakMutation.isPending}
                    onClick={() => (activeBreak ? endBreakMutation.mutate() : setBreakDialogOpen(true))}
                  >
                    {activeBreak ? "End break" : "Start break"}
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="now-muted">This week</span>
                    <span className={`font-semibold${weeklyHoursSummary.total < 0 ? " now-warn" : ""}`}>
                      {weeklyHoursSummary.total.toFixed(1)} of {weeklyTargetHours} h
                    </span>
                  </div>
                  <div className="now-bar mt-2"><span style={{ width: `${weeklyHoursSummary.progress}%` }} /></div>
                  {weeklyHoursSummary.missingCount > 0 && (
                    <p className="now-small now-warn mt-2">
                      Missing clock-outs: {weeklyHoursSummary.missingCount} (-{weeklyHoursSummary.missingPenalty}h)
                    </p>
                  )}
                </div>
              </section>

              {/* Today's schedule */}
              <section className="now-card">
                <div className="now-card-head">
                  <h2 className="now-h2">Rest of today</h2>
                  <Link href="/calendar" className="now-link">Calendar</Link>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <TodayCalendarWidgetContent />
                </div>
              </section>

              {/* Leave */}
              <section className="now-card">
                <div className="now-card-head">
                  <h2 className="now-h2">Leave this year</h2>
                  <Link href="/leave" className="now-link">Apply</Link>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-4">
                  {leaveSummary.map(item => (
                    <div key={item.type}>
                      <div className="now-big-num">{item.days}</div>
                      <div className="now-small now-muted mt-1 capitalize">{item.type}</div>
                    </div>
                  ))}
                </div>
                <div className="now-small now-muted">
                  Days taken (approved){pendingLeaveCount > 0 ? ` · ${pendingLeaveCount} request${pendingLeaveCount > 1 ? "s" : ""} pending` : ""}
                </div>
              </section>

              {/* Latest payslip */}
              <section className="now-card">
                <div className="now-card-head">
                  <h2 className="now-h2">Latest payslip</h2>
                  <Link href="/payslips" className="now-link">All payslips</Link>
                </div>
                <div className="flex items-center gap-3 now-muted">
                  <DollarSign className="h-5 w-5 shrink-0" />
                  <span className="text-sm">Open Payslips to view and download your salary slips.</span>
                </div>
              </section>

              {/* Announcement */}
              {latestAnnouncement && (
                <section className="now-card" style={{ gap: 8 }}>
                  <div className="now-small now-muted">
                    Announcement{latestAnnouncement.createdAt ? ` · ${format(new Date(latestAnnouncement.createdAt), "d MMM")}` : ""}
                  </div>
                  <div className="font-bold">{latestAnnouncement.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-3">{latestAnnouncement.content || latestAnnouncement.message || ""}</div>
                  <Link href="/announcements" className="now-link">Read more</Link>
                </section>
              )}
            </div>
          </div>
        </div>

      {/* Time In/Out Dialog */}
      <TimeInOutDialog open={timeDialogOpen} onOpenChange={setTimeDialogOpen} />

      {/* Add Work Session Dialog */}
      <Dialog open={workSessionOpen} onOpenChange={setWorkSessionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Work Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={workSessionDate}
                onChange={(e) => setWorkSessionDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={workSessionStart}
                  onChange={(e) => setWorkSessionStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input
                  type="time"
                  value={workSessionEnd}
                  onChange={(e) => setWorkSessionEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Session Type *</Label>
              <Select value={workSessionType} onValueChange={(value) => setWorkSessionType(value as "remote" | "onsite")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select session type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={workSessionDescription}
                onChange={(e) => setWorkSessionDescription(e.target.value)}
                placeholder="What did you work on?"
                className="min-h-[90px]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setWorkSessionOpen(false)}
                disabled={addWorkSessionMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const start = buildDateTime(workSessionDate, workSessionStart);
                  const end = buildDateTime(workSessionDate, workSessionEnd);

                  if (!start || !end) {
                    toast.error("Please select date and time");
                    return;
                  }
                  if (end <= start) {
                    toast.error("End time must be after start time");
                    return;
                  }

                  addWorkSessionMutation.mutate({
                    startTime: start,
                    endTime: end,
                    sessionType: workSessionType,
                    description: workSessionDescription.trim() || undefined,
                  });
                }}
                disabled={
                  addWorkSessionMutation.isPending ||
                  !workSessionDate ||
                  !workSessionStart ||
                  !workSessionEnd
                }
              >
                {addWorkSessionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Session"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Overtime Dialog */}
      <Dialog open={overtimeOpen} onOpenChange={setOvertimeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Overtime</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={overtimeDate}
                onChange={(e) => setOvertimeDate(e.target.value)}
                min={minOvertimeDate}
                max={maxOvertimeDate}
              />
              <p className="text-xs text-muted-foreground">You can add OT for today or yesterday.</p>
            </div>

            <div className="space-y-2">
              <Label>Project *</Label>
              <Select
                value={overtimeProjectId}
                onValueChange={(value) => {
                  setOvertimeProjectId(value);
                  setOvertimeTaskId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {myProjects && myProjects.length > 0 ? (
                    myProjects.map((project: any) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No projects available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Task *</Label>
              <Select
                value={overtimeTaskId}
                onValueChange={(value) => setOvertimeTaskId(value)}
                disabled={!overtimeProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={overtimeProjectId ? "Select task" : "Select project first"} />
                </SelectTrigger>
                <SelectContent>
                  {overtimeTasks && overtimeTasks.length > 0 ? (
                    overtimeTasks.map((task: any) => (
                      <SelectItem key={task.id} value={String(task.id)}>
                        {task.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No tasks found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hours *</Label>
              <Input
                type="number"
                min="0.25"
                step="0.25"
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(e.target.value)}
                placeholder="e.g., 2"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={overtimeDescription}
                onChange={(e) => setOvertimeDescription(e.target.value)}
                placeholder="What OT work did you complete?"
                className="min-h-[90px]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setOvertimeOpen(false)}
                disabled={addOvertimeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const hours = Number(overtimeHours);
                  if (!overtimeDate || !overtimeProjectId || !overtimeTaskId) {
                    toast.error("Please select date, project, and task");
                    return;
                  }
                  if (!hours || Number.isNaN(hours) || hours <= 0) {
                    toast.error("Please enter valid OT hours");
                    return;
                  }

                  addOvertimeMutation.mutate({
                    workDate: new Date(`${overtimeDate}T00:00:00`),
                    hours,
                    projectId: overtimeProjectId,
                    taskId: overtimeTaskId,
                    description: overtimeDescription.trim() || undefined,
                  });
                }}
                disabled={
                  addOvertimeMutation.isPending ||
                  !overtimeDate ||
                  !overtimeProjectId ||
                  !overtimeTaskId
                }
              >
                {addOvertimeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add OT"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Break Reason Dialog */}
      <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Break Reason</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={breakReason} onValueChange={setBreakReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose reason" />
                </SelectTrigger>
                <SelectContent>
                  {breakReasonOptions.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!breakReason) {
                  toast.error("Please select a break reason");
                  return;
                }
                startBreakMutation.mutate({ reason: breakReason as any });
              }}
              disabled={startBreakMutation.isPending}
            >
              {startBreakMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Break"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Support Ticket / Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Short summary of the issue"
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={feedbackPriority} onValueChange={(value) => setFeedbackPriority(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Details *</Label>
              <Textarea
                rows={5}
                placeholder="Describe the problem or feedback in detail..."
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSubmitFeedback}
              disabled={submitFeedbackMutation.isPending}
            >
              {submitFeedbackMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Ticket"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Chat Widget */}
      <div className="fixed bottom-6 max-[900px]:bottom-24 right-6 z-40 flex items-center gap-3">
        <Button
          onClick={() => {
            setNotesOpen(true);
            setFabOpen(false);
          }}
          className={`h-12 w-12 rounded-full shadow-premium-lg bg-[#10140f] hover:bg-[#1c221a] text-[#c8f169] transition-all ${
            fabOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6 pointer-events-none"
          }`}
          size="icon"
          title="Notes"
        >
          <StickyNote className="h-5 w-5" />
        </Button>
        <Button
          onClick={() => {
            setChatOpen(true);
            setFabOpen(false);
          }}
          className={`h-12 w-12 rounded-full shadow-premium-lg bg-[#4233e0] hover:bg-[#2a1fb0] text-white transition-all ${
            fabOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6 pointer-events-none"
          }`}
          size="icon"
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button
          onClick={() => setFabOpen(!fabOpen)}
          className="h-14 w-14 rounded-full shadow-premium-lg bg-[#c8f169] hover:bg-[#b9e455] text-[#10140f]"
          size="icon"
          title="Quick Actions"
        >
          {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      <NotesWidget open={notesOpen} onOpenChange={setNotesOpen} hideTrigger />
      <GlobalChatWidget open={chatOpen} onOpenChange={setChatOpen} hideTrigger />

      {/* Notification Sidebar */}
      <NotificationSidebar 
        isOpen={notificationSidebarOpen} 
        onClose={() => setNotificationSidebarOpen(false)} 
      />

      {/* Calendar Sidebar */}
      <CalendarSidebar 
        isOpen={calendarSidebarOpen} 
        onClose={() => setCalendarSidebarOpen(false)} 
      />

      {/* Quick Meeting Sidebar */}
      <QuickMeetingSidebar 
        isOpen={meetingSidebarOpen} 
        onClose={() => setMeetingSidebarOpen(false)} 
      />

      {/* Break Overlay */}
      {breakOverlayOpen && activeBreak && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 text-center space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Coffee className="h-12 w-12 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Break in Progress</h2>
                <p className="text-muted-foreground">
                  You're currently on a break. The dashboard is locked until you end your break.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Break started at: {format(new Date(activeBreak.breakStart), "HH:mm")}
              </div>
              {activeBreak.reason && (
                <div className="text-sm text-muted-foreground">
                  Reason: {activeBreak.reason}
                </div>
              )}
              <div className="text-lg font-semibold">
                Duration: {Math.floor((Date.now() - new Date(activeBreak.breakStart).getTime()) / 60000)} minutes
              </div>
            </div>

            <Button
              onClick={() => endBreakMutation.mutate()}
              disabled={endBreakMutation.isPending}
              size="lg"
              className="w-full"
            >
              {endBreakMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Ending Break...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  End Break
                </>
              )}
            </Button>
          </Card>
        </div>
      )}
    </NowShell>
  );
}
