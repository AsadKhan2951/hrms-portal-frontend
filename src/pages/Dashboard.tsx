import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TimeInOutDialog } from "@/components/TimeInOutDialog";
import {
  Calendar, 
  MessageSquare, 
  X,
  Coffee,
  Users,
  FolderKanban,
  CheckCircle2,
  Loader2,
  Plus,
  StickyNote,
  Check,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay } from "date-fns";
import { toast } from "sonner";
import { Link } from "wouter";
import LayoutWrapper from "@/components/LayoutWrapper";
import { NowHeaderTools } from "@/components/now/NowPage";
import { GlobalChatWidget } from "@/components/GlobalChatWidget";
import { NotesWidget } from "@/components/NotesWidget";
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
  const { user } = useAuth();
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [breakOverlayOpen, setBreakOverlayOpen] = useState(false);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [breakReason, setBreakReason] = useState("");
  const [fabOpen, setFabOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const currentUserId = user?.id ? String(user.id) : null;

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

  // This week's entries, for the hours bar on the time clock
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const { data: weekAttendance } = trpc.timeTracking.getAttendance.useQuery({
    startDate: weekStart,
    endDate: weekEnd,
  });

  const { data: myProjects } = trpc.projects.getMyProjects.useQuery();
  const utils = trpc.useUtils();

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

  const weeklyTargetHours = 40;
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

  // ---- Data for the Now home layout ----
  const { data: myTasks = [] } = trpc.projects.getMyTasks.useQuery();
  const { data: myLeaves = [] } = trpc.leaves.getMyLeaves.useQuery();
  const { data: announcements = [] } = trpc.dashboard.getAnnouncements.useQuery();
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

  // Days left this year by type, from the same balance the Time page shows.
  const { data: leaveBalance } = trpc.time.getLeaveBalance.useQuery();
  const leaveRows = ((leaveBalance?.rows ?? []) as { type: string; left: number }[]);
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
  const { data: fourWeeks } = trpc.time.getFourWeeks.useQuery();
  const daysToFix = (fourWeeks?.toFix ?? []) as { date: string; reason: string }[];
  const { data: wingmanSettings } = trpc.wingman.getSettings.useQuery();
  // On unless the person turned it off under Wingman settings.
  const showBrief = wingmanSettings?.morningBrief !== false;
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
  for (const day of daysToFix.slice(0, 2)) {
    briefItems.push({
      key: `fix-${day.date}`,
      title: `${day.reason} on ${format(new Date(`${day.date}T00:00:00`), "d MMMM")}`,
      detail: "Payroll cannot count the day until it is corrected.",
      action: "Fix it",
      href: `/attendance?fix=${day.date}`,
    });
  }
  if (lateTaskCount > 0) {
    briefItems.push({
      key: "late",
      title: `${lateTaskCount} task${lateTaskCount > 1 ? "s are" : " is"} past the due date`,
      detail: `${openTaskCount} open in total.`,
      action: "Open tasks",
      href: "/board",
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

  return (
    <LayoutWrapper>
        <div>
          {/* Greeting, Ask Wingman and notifications */}
          <header className="now-page-header">
            <div>
              <h1 className="now-page-title">
                {hourNow < 12 ? "Good morning" : hourNow < 18 ? "Good afternoon" : "Good evening"}, {firstName}
              </h1>
              <div className="now-page-sub">{format(currentTime, "EEEE, d MMMM yyyy")}</div>
            </div>
            <NowHeaderTools />
          </header>

          <div className="now-cols">
            <div className="now-col-main">
              {/* Today's brief, worked out from the clock, tasks, chat and calendar */}
{showBrief && (
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
              )}

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

              {/* Leave left this year */}
              <section className="now-card">
                <div className="now-card-head">
                  <h2 className="now-h2">Leave left</h2>
                  <Link href="/requests?new=leave" className="now-link">Apply</Link>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-4">
                  {leaveRows.map(row => (
                    <div key={row.type}>
                      <div className="now-big-num">{row.left}</div>
                      <div className="now-small now-muted mt-1 capitalize">{row.type}</div>
                    </div>
                  ))}
                </div>
                {pendingLeaveCount > 0 && (
                  <div className="now-small now-muted">
                    {pendingLeaveCount} request{pendingLeaveCount > 1 ? "s" : ""} waiting for approval
                  </div>
                )}
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

      {/* Global Chat Widget */}
      <div className="fixed bottom-6 max-[900px]:bottom-24 right-6 z-40 flex items-center gap-3">
        <Button
          onClick={() => {
            setNotesOpen(true);
            setFabOpen(false);
          }}
          className={`h-12 w-12 rounded-full shadow-premium-lg bg-[#10140f] hover:bg-[#1c221a] text-[#ff9068] transition-all ${
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
          className="h-14 w-14 rounded-full shadow-premium-lg bg-[linear-gradient(135deg,#ff4b1f,#ff9068)] hover:brightness-95 text-[#10140f]"
          size="icon"
          title="Quick Actions"
        >
          {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      <NotesWidget open={notesOpen} onOpenChange={setNotesOpen} hideTrigger />
      <GlobalChatWidget open={chatOpen} onOpenChange={setChatOpen} hideTrigger />

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
    </LayoutWrapper>
  );
}
