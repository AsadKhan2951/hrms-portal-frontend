import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { NowPageHeader } from "@/components/now/NowPage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  Activity,
  Target,
  FileCheck,
  AlertCircle,
  RefreshCcw,
  MapPin,
  Wifi,
  Bell,
} from "lucide-react";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar } from "recharts";
import { trpc } from "@/lib/trpc";
import { format, formatDistanceToNow } from "date-fns";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { isOrgWide } from "@/lib/roles";
import "./admin/adminA.css";

/* Chart colours: the Now indigo plus a done-green and a waiting-amber that read on both themes. */
const CHART_INDIGO = "#4233e0";
const CHART_DONE = "#16a34a";
const CHART_WAITING = "#f59e0b";
const chartTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
  fontSize: 13,
};

export default function AdminDashboard() {
  const { user } = useAuth();
  // This overview is organisation-wide - every widget it draws is gated to
  // head_of_ops and above, so a department head landing here would see nothing
  // but errors. Send them to the view that is actually theirs. The queries
  // below stay disabled for them so no forbidden request is even fired; the
  // redirect itself is returned after the hooks, to keep their order stable.
  const orgWide = isOrgWide(user?.role);
  const q = { enabled: orgWide };
  const { data: employeeStatuses = [] } = trpc.admin.getEmployeeStatusSnapshot.useQuery(undefined, q);
  const { data: leaveRequests = [] } = trpc.admin.getLeaveRequests.useQuery(undefined, q);
  const { data: formSubmissions = [] } = trpc.admin.getFormSubmissions.useQuery(undefined, q);
  // Projects, tasks and performance come from the board.
  const thisMonth = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
  const { data: boardProjects = [] } = trpc.fpb.getProjects.useQuery(undefined, q);
  const { data: boardUsers = [] } = trpc.fpb.getUsers.useQuery(undefined, q);
  const { data: boardOngoing = [] } = trpc.fpb.getOngoingTasks.useQuery(undefined, q);
  const { data: avgHoursData = [] } = trpc.admin.getAverageHours.useQuery({ days: 5 }, q);
  const { data: performance } = trpc.fpb.getPerformance.useQuery(thisMonth, q);
  const { data: departmentKpis = [] } = trpc.fpb.getDepartmentKpis.useQuery(thisMonth, q);
  const userName = useMemo(
    () => new Map((boardUsers as any[]).map(u => [String(u.id), u.name || u.employeeId || "Employee"])),
    [boardUsers]
  );
  const projects = useMemo(
    () =>
      (boardProjects as any[]).map(p => ({
        ...p,
        name: p.title,
        tasks: p.taskCount ?? 0,
        assignees: ((p.memberIds ?? []) as string[]).map(id => userName.get(String(id))).filter(Boolean),
      })),
    [boardProjects, userName]
  );
  const ongoingTasks = useMemo(
    () =>
      (boardOngoing as any[]).map(t => ({
        ...t,
        priority: String(t.status ?? "").replace(/_/g, " "),
        assignees: ((t.assignees ?? []) as string[]).map(name => ({ name })),
        project: { name: t.projectTitle },
      })),
    [boardOngoing]
  );
  // This month's top people on the board: done vs still open, and their projects.
  const resourcePerformance = useMemo(
    () =>
      (((performance as any)?.departments ?? []) as any[])
        .flatMap(d => d.employees as any[])
        .filter(e => e.completed > 0 || e.open > 0)
        .sort((a, b) => b.completed - a.completed || b.open - a.open)
        .slice(0, 10)
        .map(e => ({
          name: String(e.name).split(" ")[0],
          tasksCompleted: e.completed,
          tasksPending: e.open,
          activeProjects: e.projects.length,
        })),
    [performance]
  );
  // Summed per department: a task shared by two departments counts for each,
  // as it is late (or waiting) for each of them.
  const overdueBoardTasks = (departmentKpis as any[]).reduce((n, k) => n + (k.overdueTasks ?? 0), 0);
  const unassignedBoardTasks = (departmentKpis as any[]).reduce((n, k) => n + (k.unassignedTasks ?? 0), 0);
  const { data: notifications = [] } = trpc.notifications.getAll.useQuery();
  const utils = trpc.useUtils();
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});
  const [addressLoading, setAddressLoading] = useState(false);

  const refreshAll = () => {
    utils.admin.getEmployeeStatusSnapshot.invalidate();
    utils.admin.getLeaveRequests.invalidate();
    utils.admin.getFormSubmissions.invalidate();
    utils.fpb.getProjects.invalidate();
    utils.fpb.getOngoingTasks.invalidate();
    utils.admin.getAverageHours.invalidate();
    utils.fpb.getPerformance.invalidate();
    utils.fpb.getDepartmentKpis.invalidate();
    utils.notifications.getAll.invalidate();
  };

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((req: any) => req.status === "pending"),
    [leaveRequests]
  );
  const pendingForms = useMemo(
    () => formSubmissions.filter((form: any) => form.status === "submitted" || form.status === "under_review"),
    [formSubmissions]
  );

  const activeProjects = useMemo(
    () => projects.filter((project: any) => project.status === "active"),
    [projects]
  );
  const onlineEmployees = useMemo(
    () => employeeStatuses.filter((emp: any) => emp.status === "timed_in" || emp.status === "on_break"),
    [employeeStatuses]
  );
  const mapTarget = onlineEmployees.find((emp: any) => emp.location?.lat && emp.location?.lng);
  const mapUrl = mapTarget
    ? `https://www.google.com/maps?q=${mapTarget.location.lat},${mapTarget.location.lng}`
    : undefined;
  const getLocationKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

  const resolveAddress = async (lat: number, lng: number) => {
    const key = getLocationKey(lat, lng);
    if (addressCache[key]) return addressCache[key];
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      if (!response.ok) return null;
      const data = await response.json();
      const address = data?.display_name;
      if (address) {
        setAddressCache((prev) => ({ ...prev, [key]: address }));
        return address;
      }
    } catch {
      // ignore
    }
    return null;
  };

  useEffect(() => {
    const targets = onlineEmployees
      .filter((emp: any) => emp?.location?.lat && emp?.location?.lng)
      .filter((emp: any) => {
        const key = getLocationKey(emp.location.lat, emp.location.lng);
        return !emp.location.address && !addressCache[key];
      });

    if (targets.length === 0) return;

    targets.slice(0, 6).forEach((emp: any) => {
      resolveAddress(emp.location.lat, emp.location.lng);
    });
  }, [onlineEmployees, addressCache]);

  const getLocationLabel = (location: any) => {
    if (!location?.lat || !location?.lng) return "Location not available";
    const key = getLocationKey(location.lat, location.lng);
    return location.address || addressCache[key] || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  };

  const handleLocationOpen = async (emp: any) => {
    if (!emp?.location?.lat || !emp?.location?.lng) return;
    setSelectedLocation(emp);
    setLocationDialogOpen(true);
    const key = getLocationKey(emp.location.lat, emp.location.lng);
    if (!emp.location.address && !addressCache[key]) {
      setAddressLoading(true);
      await resolveAddress(emp.location.lat, emp.location.lng);
      setAddressLoading(false);
    }
  };

  const performanceData = useMemo(() => {
    return resourcePerformance.map((item: any) => ({
      name: item.name,
      tasksCompleted: item.tasksCompleted || 0,
      tasksPending: item.tasksPending || 0,
      activeProjects: item.activeProjects || 0,
      completionRate: item.completionRate || 0,
    }));
  }, [resourcePerformance]);

  const totalEmployeesCount = employeeStatuses.length;
  const workingNowCount = employeeStatuses.filter((emp: any) => emp.status === "timed_in" || emp.status === "on_break").length;
  const onLeaveCount = employeeStatuses.filter((emp: any) => emp.status === "on_leave").length;
  const mostPunctual = useMemo(() => {
    const active = employeeStatuses.filter((emp: any) => emp.timeIn);
    if (!active.length) return "N/A";
    const earliest = active.sort((a: any, b: any) => new Date(a.timeIn).getTime() - new Date(b.timeIn).getTime())[0];
    return earliest?.name || "N/A";
  }, [employeeStatuses]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "timed_in":
        return "bg-green-500";
      case "on_break":
        return "bg-yellow-500";
      case "on_leave":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "timed_in":
        return "Timed In";
      case "on_break":
        return "On Break";
      case "on_leave":
        return "On Leave";
      default:
        return "Offline";
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "NA";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return `${first}${last}`.toUpperCase();
  };
  const selectedCoords = selectedLocation?.location;
  const selectedAddress = selectedCoords ? getLocationLabel(selectedCoords) : "Location not available";
  const selectedMapSrc =
    selectedCoords?.lat && selectedCoords?.lng
      ? `https://www.google.com/maps?q=${selectedCoords.lat},${selectedCoords.lng}&output=embed`
      : "";
  const capturedLabel = selectedCoords?.capturedAt
    ? formatDistanceToNow(new Date(selectedCoords.capturedAt), { addSuffix: true })
    : null;

  // After every hook, so their order never changes: a department head who
  // reaches this org-wide overview is sent to their own team instead.
  if (user && !orgWide) {
    return <Redirect to="/admin/team" />;
  }

  const greeting = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening";

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="now-page">
        <NowPageHeader
          title={`Good ${greeting}, ${user?.name || "Admin"}!`}
          subtitle={`${format(new Date(), "EEEE, d MMMM yyyy")} · Here's what's happening with your team today`}
          actions={
            <div className="now-header-actions">
              <button type="button" className="now-btn white sm" onClick={refreshAll}>
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </button>
            </div>
          }
        />

        {/* KPI strip */}
        <div className="now-stat-strip" aria-label="Today at a glance">
          <div>
            <div className="now-stat-label">Online now</div>
            <div className="now-stat-value tabular-nums">
              {workingNowCount}/{totalEmployeesCount}
            </div>
            <div className="now-stat-label">employees currently working</div>
          </div>
          <div>
            <div className="now-stat-label">Pending leaves</div>
            <div className={`now-stat-value tabular-nums${pendingLeaves.length ? " now-warn" : ""}`}>{pendingLeaves.length}</div>
            <div className="now-stat-label">
              <Link href="/admin/leaves" className="now-link" style={{ fontSize: 13 }}>
                waiting for a decision
              </Link>
            </div>
          </div>
          <div>
            <div className="now-stat-label">Pending forms</div>
            <div className={`now-stat-value tabular-nums${pendingForms.length ? " now-warn" : ""}`}>{pendingForms.length}</div>
            <div className="now-stat-label">
              <Link href="/admin/forms" className="now-link" style={{ fontSize: 13 }}>
                responses to review
              </Link>
            </div>
          </div>
          <div>
            <div className="now-stat-label">Active projects</div>
            <div className="now-stat-value tabular-nums">{activeProjects.length}</div>
            <div className="now-stat-label">{ongoingTasks.length} ongoing tasks</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="now-stat-label flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              Most punctual
            </div>
            <div className="now-stat-value truncate" style={{ fontSize: 20 }} title={mostPunctual}>
              {mostPunctual}
            </div>
            <div className="now-stat-label">earliest clock-in today</div>
          </div>
        </div>

        {/* Key metrics */}
        <section className="now-card" aria-labelledby="admin-key-metrics">
          <div className="now-card-head">
            <h2 className="now-h2" id="admin-key-metrics">Key metrics</h2>
          </div>
          <div className="now-stat-grid">
            <div>
              <div className="now-stat-label flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                Absence rate
              </div>
              <div className="now-stat-value tabular-nums">
                {totalEmployeesCount ? ((onLeaveCount / totalEmployeesCount) * 100).toFixed(1) : "0.0"}%
              </div>
            </div>
            <div>
              <div className="now-stat-label flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Overdue tasks
              </div>
              <div className={`now-stat-value tabular-nums${overdueBoardTasks ? " now-warn" : ""}`}>{overdueBoardTasks}</div>
            </div>
            <div>
              <div className="now-stat-label flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                Tasks not assigned
              </div>
              <div className="now-stat-value tabular-nums">{unassignedBoardTasks}</div>
            </div>
            <div>
              <div className="now-stat-label flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                Capacity
              </div>
              <div className="now-stat-value tabular-nums">
                {totalEmployeesCount ? ((workingNowCount / totalEmployeesCount) * 100).toFixed(0) : "0"}%
              </div>
            </div>
          </div>
        </section>

        <div className="now-cols">
          <div className="now-col-main">
            {/* Currently online */}
            <section className="now-card flush" aria-labelledby="admin-online">
              <div className="now-card-head" style={{ marginBottom: 8, flexWrap: "wrap" }}>
                <div className="flex items-center gap-2">
                  <h2 className="now-h2" id="admin-online">Currently online</h2>
                  <span className="now-pill aa-ok flex items-center gap-1.5">
                    <span className="aa-dot" style={{ background: CHART_DONE }} aria-hidden="true" />
                    Live
                  </span>
                </div>
                <div className="flex items-center gap-3 now-small now-muted">
                  <span>Updated just now</span>
                  {mapUrl ? (
                    <a className="now-link" href={mapUrl} target="_blank" rel="noreferrer">
                      View map
                    </a>
                  ) : null}
                </div>
              </div>
              {onlineEmployees.length === 0 ? (
                <div className="now-row now-muted" style={{ borderTop: 0 }}>
                  No employees are online right now.
                </div>
              ) : (
                onlineEmployees.map((emp: any, index: number) => {
                  const distanceLabel =
                    typeof emp.locationDistanceKm === "number"
                      ? `${emp.locationDistanceKm.toFixed(1)} km from office`
                      : null;
                  const locationLabel = getLocationLabel(emp.location);
                  const hasLocation = Boolean(emp.location?.lat && emp.location?.lng);
                  const officeTag =
                    emp.locationTag === "office" ? "Office" : emp.locationTag === "remote" ? "Remote" : null;

                  return (
                    <div
                      key={emp.id}
                      className="now-row wrap"
                      style={{ alignItems: "flex-start", borderTop: index === 0 ? 0 : undefined }}
                    >
                      <div className="aa-row-main">
                        <div className="now-avatar" aria-hidden="true">
                          {getInitials(emp.name)}
                        </div>
                        <div className="aa-clamp" style={{ flex: "1 1 0" }}>
                          <div className="now-row-title">{emp.name}</div>
                          <div className="now-row-sub">
                            {emp.designation}
                            {emp.designation ? " · " : ""}
                            Clocked in at{" "}
                            <span className="tabular-nums">{emp.timeIn ? format(new Date(emp.timeIn), "hh:mm a") : "--"}</span>
                          </div>
                          <button
                            type="button"
                            className={`mt-1 flex max-w-full items-center gap-1.5 text-left now-small now-muted ${hasLocation ? "hover:text-foreground transition-colors" : "cursor-default"}`}
                            onClick={() => hasLocation && handleLocationOpen(emp)}
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{locationLabel}</span>
                            {distanceLabel ? (
                              <span className="shrink-0 now-warn">({distanceLabel})</span>
                            ) : null}
                          </button>
                        </div>
                      </div>
                      <div className="aa-row-side">
                        {officeTag ? (
                          <span className="now-pill lime flex items-center gap-1">
                            <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                            {officeTag}
                          </span>
                        ) : null}
                        <span className="now-pill tabular-nums aa-plain">{emp.hours || "--"}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            {/* Average hours */}
            <section className="now-card" aria-labelledby="admin-avg-hours">
              <div className="now-card-head">
                <h2 className="now-h2" id="admin-avg-hours">Employee average hours</h2>
                <span className="now-small now-muted">This week</span>
              </div>
              <div className="aa-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={avgHoursData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" />
                    <YAxis tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" width={32} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="hours" stroke={CHART_INDIGO} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Ongoing projects */}
            <section className="now-card" style={{ gap: 16 }} aria-labelledby="admin-projects">
              <div className="now-card-head">
                <h2 className="now-h2" id="admin-projects">Ongoing projects</h2>
                <span className="now-pill">{activeProjects.length}</span>
              </div>
              {activeProjects.length === 0 ? (
                <p className="now-muted text-sm">No active projects.</p>
              ) : (
                <div className="now-project-grid">
                  {activeProjects.map((project: any) => (
                    <div key={project.id} className="now-tile">
                      <div className="flex items-start justify-between gap-2">
                        <span className="now-row-title aa-clamp">{project.name}</span>
                        <span className="text-sm font-bold tabular-nums">{project.progress || 0}%</span>
                      </div>
                      <div className="now-bar on-tile">
                        <span style={{ width: `${project.progress || 0}%` }} />
                      </div>
                      <div className="flex items-center justify-between gap-2 now-row-sub">
                        <span className="aa-clamp">{project.assignees?.join(", ") || "Unassigned"}</span>
                        <span className="shrink-0">{project.tasks || 0} tasks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Resource performance */}
            <section className="now-card" aria-labelledby="admin-performance">
              <div className="now-card-head" style={{ flexWrap: "wrap" }}>
                <h2 className="now-h2" id="admin-performance">Resource performance</h2>
                <span className="now-small now-muted">
                  This month on the board: tasks done vs still open, and projects per person
                </span>
              </div>
              {performanceData.length === 0 ? (
                <div className="now-muted py-10 text-center">
                  No performance data available
                </div>
              ) : (
                <div className="aa-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" width={32} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" width={32} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar yAxisId="left" dataKey="tasksCompleted" stackId="tasks" fill={CHART_DONE} />
                      <Bar yAxisId="left" dataKey="tasksPending" stackId="tasks" fill={CHART_WAITING} radius={[6, 6, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="activeProjects" stroke={CHART_INDIGO} strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex flex-wrap gap-4 now-small now-muted">
                <span className="flex items-center gap-2">
                  <span className="aa-dot" style={{ background: CHART_DONE }} />
                  Tasks completed
                </span>
                <span className="flex items-center gap-2">
                  <span className="aa-dot" style={{ background: CHART_WAITING }} />
                  Tasks pending
                </span>
                <span className="flex items-center gap-2">
                  <span className="aa-dot" style={{ background: CHART_INDIGO }} />
                  Active projects
                </span>
              </div>
            </section>
          </div>

          <div className="now-col-side">
            {/* Pending leaves */}
            <section className="now-card flush" aria-labelledby="admin-pending-leaves">
              <div className="now-card-head" style={{ marginBottom: 8 }}>
                <h2 className="now-h2" id="admin-pending-leaves">Pending leaves</h2>
                <div className="flex items-center gap-3">
                  <span className={`now-pill${pendingLeaves.length ? " warn-soft" : ""}`}>{pendingLeaves.length}</span>
                  <Link href="/admin/leaves" className="now-link">Open</Link>
                </div>
              </div>
              {pendingLeaves.length === 0 ? (
                <div className="now-row now-muted" style={{ borderTop: 0 }}>
                  No leave requests waiting.
                </div>
              ) : (
                pendingLeaves.map((leave: any, index: number) => (
                  <div
                    key={leave.id}
                    className="flex flex-col gap-3 py-4"
                    style={{ borderTop: index === 0 ? 0 : "1px solid var(--secondary)" }}
                  >
                    <div className="aa-clamp">
                      <div className="now-row-title">{leave.user?.name || "Employee"}</div>
                      <div className="now-row-sub">
                        <span className="capitalize">{leave.leaveType}</span> · {leave.startDate ? format(new Date(leave.startDate), "MMM dd") : "--"} - {leave.endDate ? format(new Date(leave.endDate), "MMM dd") : "--"}
                      </div>
                    </div>
                    <Link href="/admin/leaves" className="now-btn ink sm grow text-center">
                      Review
                    </Link>
                  </div>
                ))
              )}
            </section>

            {/* Pending forms */}
            <section className="now-card flush" aria-labelledby="admin-pending-forms">
              <div className="now-card-head" style={{ marginBottom: 8 }}>
                <h2 className="now-h2" id="admin-pending-forms">Pending forms</h2>
                <span className={`now-pill${pendingForms.length ? " warn-soft" : ""}`}>{pendingForms.length}</span>
              </div>
              {pendingForms.length === 0 ? (
                <div className="now-row now-muted" style={{ borderTop: 0 }}>
                  No form responses waiting.
                </div>
              ) : (
                pendingForms.map((form: any, index: number) => (
                  <div
                    key={form.id}
                    className="flex flex-col gap-3 py-4"
                    style={{ borderTop: index === 0 ? 0 : "1px solid var(--secondary)" }}
                  >
                    <div className="aa-clamp">
                      <div className="now-row-title">{form.user?.name || "Employee"}</div>
                      <div className="now-row-sub">{form.subject || form.formType}</div>
                      <div className="now-row-sub">
                        {form.createdAt
                          ? formatDistanceToNow(new Date(form.createdAt), { addSuffix: true })
                          : "--"}
                      </div>
                    </div>
                    <Link href="/admin/forms" className="now-btn tint sm text-center">
                      Review
                    </Link>
                  </div>
                ))
              )}
              <div className="py-3 text-center" style={{ borderTop: "1px solid var(--secondary)" }}>
                <Link href="/admin/forms" className="now-link">
                  View all forms
                </Link>
              </div>
            </section>

            {/* Notifications */}
            <section className="now-card flush" aria-labelledby="admin-notifications">
              <div className="now-card-head" style={{ marginBottom: 8 }}>
                <h2 className="now-h2 flex items-center gap-2" id="admin-notifications">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  Notifications
                </h2>
                <Link href="/notifications" className="now-link">
                  View all
                </Link>
              </div>
              {notifications.length === 0 ? (
                <div className="now-row now-muted justify-center py-10" style={{ borderTop: 0 }}>
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 4).map((notif: any, index: number) => (
                  <div
                    key={notif.id}
                    className="py-3 aa-clamp"
                    style={{ borderTop: index === 0 ? 0 : "1px solid var(--secondary)" }}
                  >
                    <div className="text-sm font-semibold">{notif.title || "Notification"}</div>
                    <div className="now-row-sub">{notif.message}</div>
                    <div className="now-row-sub">
                      {notif.createdAt
                        ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })
                        : "--"}
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Ongoing tasks */}
            <section className="now-card flush" aria-labelledby="admin-ongoing-tasks">
              <div className="now-card-head" style={{ marginBottom: 8 }}>
                <h2 className="now-h2" id="admin-ongoing-tasks">Ongoing tasks</h2>
                <span className="now-pill">{ongoingTasks.length}</span>
              </div>
              {ongoingTasks.length === 0 ? (
                <div className="now-row now-muted" style={{ borderTop: 0 }}>
                  No ongoing tasks.
                </div>
              ) : (
                ongoingTasks.map((task: any, index: number) => (
                  <div
                    key={task.id}
                    className="py-3"
                    style={{ borderTop: index === 0 ? 0 : "1px solid var(--secondary)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold aa-clamp">{task.title}</span>
                      <span className={`now-pill${task.priority === "high" ? " risk" : ""}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="now-row-sub mt-1">
                      {(task.assignees || [])
                        .map((assignee: any) => assignee?.name || assignee?.employeeId || "Employee")
                        .filter(Boolean)
                        .join(", ") || "Employee"}
                    </div>
                    <div className="now-row-sub">{task.project?.name || "Project"}</div>
                  </div>
                ))
              )}
            </section>
          </div>
        </div>

        {/* Advanced reports */}
        <section className="flex flex-col gap-3" aria-labelledby="admin-reports">
          <h2 className="now-h2" id="admin-reports">Advanced reports</h2>
          <div className="now-tile-grid">
            <Link href="/admin/reports" className="now-tile-btn">
              <Activity className="h-5 w-5 text-[var(--now-indigo)]" aria-hidden="true" />
              <strong>Attendance Summary</strong>
              <span>Who was in, late or away</span>
            </Link>
            <Link href="/admin/reports" className="now-tile-btn">
              <Clock className="h-5 w-5 text-[var(--now-indigo)]" aria-hidden="true" />
              <strong>OT Analysis</strong>
              <span>Overtime by person and team</span>
            </Link>
            <Link href="/admin/reports" className="now-tile-btn">
              <FileCheck className="h-5 w-5 text-[var(--now-indigo)]" aria-hidden="true" />
              <strong>Audit Trail</strong>
              <span>Changes made in the portal</span>
            </Link>
            <Link href="/admin/reports" className="now-tile-btn">
              <AlertCircle className="h-5 w-5 text-[var(--now-indigo)]" aria-hidden="true" />
              <strong>Exceptions</strong>
              <span>Missed punches and odd records</span>
            </Link>
          </div>
        </section>

        <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Location Details</DialogTitle>
            </DialogHeader>
            {selectedCoords ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl" style={{ background: "var(--card)" }}>
                  <iframe
                    src={selectedMapSrc}
                    className="w-full h-56"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <div className="aa-sub" style={{ gap: 8 }}>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--now-indigo)]" aria-hidden="true" />
                    <span className="aa-clamp">{addressLoading ? "Fetching address..." : selectedAddress}</span>
                  </div>
                  <div className="now-small now-muted tabular-nums">
                    {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}
                  </div>
                  {typeof selectedCoords.accuracy === "number" ? (
                    <div className="now-small now-muted">
                      Accuracy: {Math.round(selectedCoords.accuracy)} m
                    </div>
                  ) : null}
                  {capturedLabel ? (
                    <div className="now-small now-muted">
                      Captured {capturedLabel}
                    </div>
                  ) : null}
                  {selectedLocation?.locationTag ? (
                    <span className="now-pill lime w-fit">
                      {selectedLocation.locationTag === "office" ? "Office" : "Remote"}
                    </span>
                  ) : null}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${selectedCoords.lat},${selectedCoords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="now-link"
                >
                  Open in Maps
                </a>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No location selected</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
