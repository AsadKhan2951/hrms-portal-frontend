import { useEffect, useMemo, useState } from "react";
import LayoutWrapper from "@/components/LayoutWrapper";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ClipboardList,
  FolderKanban,
  Timer,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { isOrgWide, isStaff } from "@/lib/roles";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { NowPageHeader } from "@/components/now/NowPage";
import "./admin/adminB.css";

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = isOrgWide(user?.role);
  const defaultEnd = format(new Date(), "yyyy-MM-dd");
  const defaultStart = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  const { data: employeeData = [] } = trpc.employees.list.useQuery(undefined, {
    enabled: isAdmin,
  });
  const employees = employeeData.filter((emp: any) => isStaff(emp?.role));

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) {
      setSelectedEmployeeId(String(user.id));
      return;
    }
    if (selectedEmployeeId) return;
    if (employees.length > 0) {
      setSelectedEmployeeId(String(employees[0].id));
    }
  }, [employees, isAdmin, selectedEmployeeId, user]);

  const rangeValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    return new Date(endDate).getTime() >= new Date(startDate).getTime();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!rangeValid && startDate && endDate) {
      toast.error("End date must be after start date");
    }
  }, [rangeValid, startDate, endDate]);

  const targetEmployeeId = isAdmin ? selectedEmployeeId : user?.id ? String(user.id) : "";

  const attendanceQuery = isAdmin
    ? trpc.admin.getEmployeeAttendance.useQuery(
        {
          employeeId: targetEmployeeId,
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T23:59:59`),
        },
        { enabled: Boolean(targetEmployeeId) && rangeValid }
      )
    : trpc.timeTracking.getAttendance.useQuery(
        {
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T23:59:59`),
        },
        { enabled: rangeValid }
      );

  // Projects and tasks from the board: the chosen employee's for an admin,
  // otherwise the viewer's own.
  const workQuery = trpc.fpb.getPersonWork.useQuery(
    isAdmin ? { employeeId: targetEmployeeId || undefined } : undefined,
    { enabled: !isAdmin || Boolean(targetEmployeeId) }
  );

  const attendanceEntries = attendanceQuery.data || [];
  const projects = useMemo(
    () => (((workQuery.data as any)?.projects ?? []) as any[]).map(p => ({ ...p, name: p.title })),
    [workQuery.data]
  );
  const tasks = useMemo(
    () =>
      (((workQuery.data as any)?.tasks ?? []) as any[]).map(t => ({
        ...t,
        status: t.done ? "completed" : t.status,
        completionDate: t.dueDate,
        project: { id: t.projectId, name: t.projectTitle },
      })),
    [workQuery.data]
  );

  const attendanceMetrics = useMemo(() => {
    const uniqueDays = new Set<string>();
    let totalHours = 0;
    let missingClockouts = 0;

    attendanceEntries.forEach((entry: any) => {
      const timeIn = entry.timeIn ? new Date(entry.timeIn) : null;
      const timeOut = entry.timeOut ? new Date(entry.timeOut) : null;
      if (timeIn) {
        uniqueDays.add(timeIn.toDateString());
      }
      if (!timeOut || entry.status === "active" || entry.autoClockedOut) {
        missingClockouts += 1;
        return;
      }
      const hours = entry.totalHours
        ? Number(entry.totalHours)
        : (timeOut.getTime() - timeIn!.getTime()) / (1000 * 60 * 60);
      totalHours += hours;
    });

    return {
      daysPresent: uniqueDays.size,
      totalHours: Number(totalHours.toFixed(1)),
      missingClockouts,
    };
  }, [attendanceEntries]);

  const projectMetrics = useMemo(() => {
    const active = projects.filter((p: any) => p.status === "active").length;
    const archived = projects.filter((p: any) => p.status === "completed" || p.status === "archived").length;
    return {
      total: projects.length,
      active,
      archived,
    };
  }, [projects]);

  const taskMetrics = useMemo(() => {
    const completed = tasks.filter((t: any) => t.status === "completed").length;
    return {
      total: tasks.length,
      completed,
      pending: Math.max(0, tasks.length - completed),
    };
  }, [tasks]);

  const statusPill = (status: string) =>
    status === "completed" || status === "done"
      ? "now-pill nb-ok-soft"
      : status === "active" || status === "in_progress"
        ? "now-pill nb-info-soft"
        : status === "cancelled" || status === "early_out"
          ? "now-pill risk"
          : "now-pill";

  const content = (
    <div className="now-page">
      <NowPageHeader
        title="Employee reports"
        subtitle="Attendance and project activity for the selected time range"
      />

      <section className="now-card" aria-label="Report filters">
        <div className="flex flex-wrap items-end gap-4">
          {isAdmin && (
            <div className="min-w-0" style={{ flex: "1 1 240px", maxWidth: 360 }}>
              <label className="nb-label">Employee</label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No employees available
                    </SelectItem>
                  ) : (
                    employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.employeeId || "ID"})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="min-w-0" style={{ flex: "2 1 300px" }}>
            <label className="nb-label flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Date range
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                aria-label="Start date"
                className="min-w-0"
                style={{ flex: "1 1 140px" }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="now-small now-muted">to</span>
              <Input
                type="date"
                aria-label="End date"
                className="min-w-0"
                style={{ flex: "1 1 140px" }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        {!rangeValid && startDate && endDate && (
          <p className="now-small now-warn">End date must be after start date.</p>
        )}
      </section>

      <div className="now-stat-strip">
        <div>
          <div className="now-stat-label flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Attendance Summary
          </div>
          <div className="now-stat-value">{attendanceMetrics.totalHours} hrs</div>
          <div className="now-stat-label">Days present: {attendanceMetrics.daysPresent}</div>
          <div className={`now-stat-label${attendanceMetrics.missingClockouts > 0 ? " now-warn" : ""}`}>
            Missing clock outs: {attendanceMetrics.missingClockouts}
          </div>
        </div>
        <div>
          <div className="now-stat-label flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" /> Projects
          </div>
          <div className="now-stat-value">{projectMetrics.total}</div>
          <div className="now-stat-label">Active: {projectMetrics.active}</div>
          <div className="now-stat-label">Archived: {projectMetrics.archived}</div>
        </div>
        <div>
          <div className="now-stat-label flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" /> Tasks
          </div>
          <div className="now-stat-value">{taskMetrics.total}</div>
          <div className="now-stat-label">Completed: {taskMetrics.completed}</div>
          <div className="now-stat-label">Pending: {taskMetrics.pending}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="now-card flush min-w-0" aria-label="Attendance entries">
          <div className="now-card-head pb-2">
            <h3 className="now-h2">Attendance Entries</h3>
            <span className="now-pill">{attendanceEntries.length}</span>
          </div>
          {attendanceEntries.length === 0 ? (
            <div className="now-row now-muted">No attendance entries</div>
          ) : (
            <div className="nb-scroll">
              {attendanceEntries.map((entry: any) => (
                <div key={entry.id} className="now-row tight">
                  <div className="min-w-0">
                    <div className="now-row-title">
                      {entry.timeIn ? format(new Date(entry.timeIn), "MMM dd, yyyy") : "--"}
                    </div>
                    <div className={`now-row-sub tabular-nums${entry.autoClockedOut ? " now-warn" : ""}`}>
                      {entry.timeIn ? format(new Date(entry.timeIn), "HH:mm") : "--"} -
                      {entry.autoClockedOut
                        ? " missed clock-out"
                        : entry.timeOut ? ` ${format(new Date(entry.timeOut), "HH:mm")}` : " --"}
                    </div>
                  </div>
                  <span className={statusPill(entry.status || "unknown")}>
                    {entry.status || "unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="now-card flush min-w-0" aria-label="Projects">
          <div className="now-card-head pb-2">
            <h3 className="now-h2">Projects</h3>
            <span className="now-pill">{projects.length}</span>
          </div>
          {projects.length === 0 ? (
            <div className="now-row now-muted">No projects assigned</div>
          ) : (
            <div className="nb-scroll">
              {projects.map((project: any) => (
                <div key={project.id} className="now-row tight">
                  <div className="min-w-0">
                    <div className="now-row-title truncate">{project.name}</div>
                    <div className="now-row-sub">
                      {project.startDate || project.dueDate ? (
                        <span>
                          {project.startDate
                            ? format(new Date(project.startDate), "MMM dd, yyyy")
                            : "--"} -
                          {project.dueDate
                            ? ` ${format(new Date(project.dueDate), "MMM dd, yyyy")}`
                            : " --"}
                        </span>
                      ) : (
                        <span>No timeline set</span>
                      )}
                    </div>
                  </div>
                  <span className={statusPill(project.status || "active")}>
                    {project.status || "active"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="now-card flush" aria-label="Tasks">
        <div className="now-card-head pb-2">
          <h3 className="now-h2">Tasks</h3>
          <span className="now-pill">{tasks.length}</span>
        </div>
        {tasks.length === 0 ? (
          <div className="now-row now-muted">No tasks assigned</div>
        ) : (
          <div className="nb-scroll tall">
            {tasks.map((task: any) => (
              <div key={task.id} className="now-row tight">
                <div className="min-w-0">
                  <div className="now-row-title">{task.title}</div>
                  <div className="now-row-sub">
                    Project: {task.project?.name || "Unknown"}
                    {" · "}
                    Timeline: {task.completionDate ? format(new Date(task.completionDate), "MMM dd, yyyy") : "Ongoing"}
                  </div>
                </div>
                <span className={statusPill(task.status || "todo")}>{(task.status || "todo").replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout title="Employee Reports">{content}</AdminLayout>;
  }

  return <LayoutWrapper>{content}</LayoutWrapper>;
}
