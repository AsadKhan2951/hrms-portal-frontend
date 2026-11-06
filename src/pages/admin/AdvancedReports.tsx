import AdminLayout from "@/components/AdminLayout";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  AlertTriangle,
  FileText,
  Activity,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Redirect } from "wouter";
import { isOrgWide, isStaff } from "@/lib/roles";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { downloadCsv } from "@/lib/csv";
import { NowPageHeader } from "@/components/now/NowPage";
import "./adminB.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ALL_EMPLOYEES = "__all__";

/** Reports that need data the system does not record yet. */
const NOT_IMPLEMENTED: Record<string, string> = {
  "audit-trail":
    "Attendance edits are not recorded anywhere yet, so there is no audit history to show. This needs an audit log on time entries first.",
  "absenteeism-trends":
    "Trends need several months compared side by side. The monthly data is now correct, so this can be built on top of it.",
  "leave-summary":
    "Leave balances need an entitlement policy per employee (annual/sick/casual quotas), which is not configured in the system yet.",
};

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--";

const fmtDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString([], { weekday: "short" });

const STATUS_STYLES: Record<string, string> = {
  present: "nb-ok",
  absent: "nb-bad",
  leave: "nb-info",
  off: "now-muted",
  upcoming: "now-muted",
};

const MUSTER_MARK: Record<string, string> = {
  present: "P",
  absent: "A",
  leave: "L",
  off: "–",
  upcoming: "",
};

export default function AdvancedReports() {
  const { user } = useAuth();
  const now = new Date();

  const [selectedReport, setSelectedReport] = useState("attendance-summary");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [employeeId, setEmployeeId] = useState(ALL_EMPLOYEES);

  const { data: employeeData = [] } = trpc.employees.list.useQuery();
  const employees = employeeData.filter((emp: any) => isStaff(emp?.role));

  const {
    data: report,
    isLoading,
    error,
  } = trpc.admin.getMonthlyAttendance.useQuery({
    month: Number(month),
    year: Number(year),
    ...(employeeId === ALL_EMPLOYEES ? {} : { employeeId }),
  });

  const { data: employeeStatuses = [] } = trpc.admin.getEmployeeStatusSnapshot.useQuery();

  const rows = report?.rows ?? [];
  const totals = report?.totals;
  const periodLabel = `${MONTHS[Number(month) - 1]} ${year}`;

  const years = useMemo(() => {
    const current = now.getFullYear();
    return [current + 1, current, current - 1, current - 2].map(String);
  }, [now]);

  const reportCategories = [
    {
      title: "Payroll & Compliance Reports",
      reports: [
        { id: "attendance-summary", name: "Detailed Attendance Summary (Pre-Payroll)", icon: FileText },
        { id: "employee-detail", name: "Employee Monthly Detail (Day by Day)", icon: CalendarDays },
        { id: "ot-analysis", name: "Overtime (OT) Analysis Report", icon: Clock },
        { id: "audit-trail", name: "Attendance Audit Trail Report", icon: Activity },
        { id: "exceptions", name: "Exceptions Report (Exceptions Log)", icon: AlertTriangle },
      ],
    },
    {
      title: "Operational & Productivity Reports",
      reports: [
        { id: "realtime-dashboard", name: "Real-Time Attendance Dashboard", icon: Activity },
        { id: "absenteeism-trends", name: "Absenteeism and Late Arrival Trend Report", icon: TrendingDown },
        { id: "productivity", name: "Productivity/Working Hours Report", icon: TrendingUp },
      ],
    },
    {
      title: "Strategic & Summary Reports",
      reports: [
        { id: "muster-roll", name: "Monthly Attendance Muster Roll", icon: Users },
        { id: "leave-summary", name: "Leave and Time-Off Report", icon: Calendar },
        { id: "key-metrics", name: "Key Metrics Dashboard", icon: BarChart3 },
      ],
    },
  ];

  const reportName = reportCategories
    .flatMap(c => c.reports)
    .find(r => r.id === selectedReport)?.name;

  const singleEmployee = rows.length === 1 ? rows[0] : null;

  const keyMetrics = useMemo(() => {
    if (!totals || rows.length === 0) return [];
    const expected = rows.reduce((sum, r) => sum + r.workingDaysElapsed, 0) || 1;
    const worked = totals.presentDays + totals.leaveDays;
    return [
      {
        label: "Absence Rate",
        value: `${((totals.absentDays / expected) * 100).toFixed(1)}%`,
        good: totals.absentDays / expected < 0.05,
      },
      {
        label: "Attendance Rate",
        value: `${((worked / expected) * 100).toFixed(1)}%`,
        good: worked / expected > 0.9,
      },
      {
        label: "Overtime Hours",
        value: `${totals.overtimeHours}h`,
        good: true,
      },
      {
        label: "Missing Clock-Outs",
        value: String(totals.missingClockOuts),
        good: totals.missingClockOuts === 0,
      },
    ];
  }, [totals, rows]);

  // Checked after every hook has run so the hook order never changes.
  if (user && !isOrgWide(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error("Nothing to export for this month");
      return;
    }
    const suffix = `${year}-${String(month).padStart(2, "0")}`;

    if (selectedReport === "employee-detail" && singleEmployee) {
      downloadCsv(
        `attendance-${singleEmployee.employeeId || singleEmployee.name}-${suffix}`,
        ["Date", "Day", "Status", "Time In", "Time Out", "Hours", "Missing Clock Out"],
        singleEmployee.days.map((d: any) => [
          d.date,
          fmtDay(d.date),
          d.status,
          fmtTime(d.timeIn),
          d.missingClockOut && !d.timeOut ? "Missed clock-out" : fmtTime(d.timeOut),
          d.hours,
          d.missingClockOut ? "yes" : "",
        ])
      );
    } else if (selectedReport === "muster-roll") {
      const days = rows[0].days;
      downloadCsv(
        `muster-roll-${suffix}`,
        ["Employee", "Employee ID", ...days.map((d: any) => String(new Date(`${d.date}T00:00:00`).getDate()))],
        rows.map((r: any) => [
          r.name,
          r.employeeId,
          ...r.days.map((d: any) => MUSTER_MARK[d.status] ?? ""),
        ])
      );
    } else {
      downloadCsv(
        `attendance-summary-${suffix}`,
        [
          "Employee", "Employee ID", "Department", "Working Days", "Present",
          "Absent", "Leave", "Total Hours", "Avg Hours/Day", "Overtime",
          "Short Days", "Missing Clock Outs",
        ],
        rows.map((r: any) => [
          r.name, r.employeeId, r.department, r.workingDays, r.presentDays,
          r.absentDays, r.leaveDays, r.totalHours, r.averageHours, r.overtimeHours,
          r.shortDays, r.missingClockOuts,
        ])
      );
    }
    toast.success("CSV downloaded");
  };

  const emptyState = (title: string, body?: string) => (
    <div className="now-card nb-soft items-center py-10 text-center">
      <div className="now-lede">{title}</div>
      {body && <p className="now-muted max-w-lg text-sm">{body}</p>}
    </div>
  );

  const renderReportContent = () => {
    if (NOT_IMPLEMENTED[selectedReport]) {
      return (
        <div className="now-card nb-soft items-center py-10 text-center">
          <BarChart3 className="h-9 w-9 text-muted-foreground opacity-50" aria-hidden="true" />
          <div className="now-lede">Not built yet</div>
          <p className="now-muted max-w-lg text-sm">{NOT_IMPLEMENTED[selectedReport]}</p>
        </div>
      );
    }

    if (selectedReport === "realtime-dashboard") {
      return (
        <div className="flex flex-col gap-6">
          <div className="now-stat-grid">
            {[
              { label: "Currently Working", count: employeeStatuses.filter((e: any) => e.status === "timed_in").length, dot: "ok" },
              { label: "On Break", count: employeeStatuses.filter((e: any) => e.status === "on_break").length, dot: "info" },
              { label: "On Leave Today", count: employeeStatuses.filter((e: any) => e.status === "on_leave").length, dot: "warn" },
            ].map(card => (
              <div key={card.label}>
                <div className="now-stat-label flex items-center gap-2">
                  <span className={`nb-dot ${card.dot}`} aria-hidden="true" />
                  {card.label}
                </div>
                <div className="now-stat-value">{card.count}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="now-row-title mb-1">Live Status</h3>
            {employeeStatuses.length === 0 ? (
              <div className="now-row now-muted" style={{ borderTop: 0 }}>Nobody to show.</div>
            ) : (
              employeeStatuses.map((emp: any, index: number) => (
                <div key={emp.id} className="now-row tight" style={{ borderTop: index === 0 ? 0 : undefined }}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`nb-dot ${emp.status === "timed_in" ? "ok" : emp.status === "on_break" ? "info" : emp.status === "on_leave" ? "warn" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="truncate font-semibold">{emp.name}</span>
                  </div>
                  <span
                    className={`now-pill ${emp.status === "timed_in" ? "nb-ok-soft" : emp.status === "on_break" ? "nb-info-soft" : emp.status === "on_leave" ? "warn-soft" : ""}`}
                  >
                    {emp.status === "timed_in" ? "Working" : emp.status === "on_break" ? "On Break" : emp.status === "on_leave" ? "On Leave" : "Offline"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading {periodLabel}...
        </div>
      );
    }

    if (error) {
      return (
        <div className="now-card nb-soft py-8 text-center">
          <p className="nb-bad">{error.message}</p>
        </div>
      );
    }

    if (rows.length === 0) {
      return emptyState("Nothing to show", `No employees found for ${periodLabel}`);
    }

    switch (selectedReport) {
      case "employee-detail": {
        if (!singleEmployee) {
          return emptyState(
            "Pick one employee",
            "Pick a single employee above to see their day-by-day month."
          );
        }
        return (
          <div className="flex flex-col gap-6">
            <div className="now-stat-grid">
              {[
                { label: "Present", value: singleEmployee.presentDays, cls: "nb-ok" },
                { label: "Absent", value: singleEmployee.absentDays, cls: "nb-bad" },
                { label: "Leave", value: singleEmployee.leaveDays, cls: "nb-info" },
                { label: "Total Hours", value: `${singleEmployee.totalHours}h`, cls: "" },
              ].map(s => (
                <div key={s.label}>
                  <div className="now-stat-label">{s.label}</div>
                  <div className={`now-stat-value ${s.cls}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="nb-table-wrap">
              <table className="nb-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Status</th>
                    <th className="num">Time In</th>
                    <th className="num">Time Out</th>
                    <th className="num">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {singleEmployee.days.map((d: any) => (
                    <tr key={d.date} className={d.isWorkingDay ? "" : "off"}>
                      <td className="tabular-nums whitespace-nowrap">{d.date}</td>
                      <td className="now-muted">{fmtDay(d.date)}</td>
                      <td className={`font-semibold capitalize ${STATUS_STYLES[d.status]}`}>
                        {d.status === "off" ? "Weekend" : d.status}
                        {d.missingClockOut && (
                          <span className="ml-2 text-xs font-medium text-[var(--now-warn)] normal-case">no clock-out</span>
                        )}
                      </td>
                      <td className="num">{fmtTime(d.timeIn)}</td>
                      <td className="num">
                        {d.missingClockOut && !d.timeOut ? (
                          <span className="now-pill risk nb-plain">Missed clock-out</span>
                        ) : (
                          fmtTime(d.timeOut)
                        )}
                      </td>
                      <td className="num font-semibold">{d.hours || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case "muster-roll": {
        const days = rows[0].days;
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="now-pill nb-ok-soft nb-plain">P · Present</span>
              <span className="now-pill nb-bad-soft nb-plain">A · Absent</span>
              <span className="now-pill nb-info-soft nb-plain">L · Leave</span>
              <span className="now-pill nb-plain">– · Weekend</span>
            </div>
            <div className="nb-table-wrap">
              <table className="nb-muster">
                <thead>
                  <tr>
                    <th className="name">Employee</th>
                    {days.map((d: any) => (
                      <th key={d.date} className={d.isWorkingDay ? "" : "opacity-60"}>
                        {new Date(`${d.date}T00:00:00`).getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.userId}>
                      <td className="name">{r.name}</td>
                      {r.days.map((d: any) => (
                        <td key={d.date} className={STATUS_STYLES[d.status]}>
                          {MUSTER_MARK[d.status] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case "exceptions": {
        const exceptions = rows.flatMap((r: any) =>
          r.days
            .filter((d: any) => d.missingClockOut || (d.status === "absent"))
            .map((d: any) => ({ employee: r.name, ...d }))
        );
        if (exceptions.length === 0) {
          return emptyState("All clear", `No exceptions in ${periodLabel}`);
        }
        return (
          <div className="nb-table-wrap">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Exception</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e: any, i: number) => (
                  <tr key={`${e.employee}-${e.date}-${i}`}>
                    <td className="font-semibold">{e.employee}</td>
                    <td className="whitespace-nowrap">
                      <span className="tabular-nums">{e.date}</span> <span className="now-muted">({fmtDay(e.date)})</span>
                    </td>
                    <td>
                      {e.missingClockOut ? (
                        <span className="now-pill risk nb-plain">Missing clock-out</span>
                      ) : (
                        <span className="now-pill nb-bad-soft nb-plain">Absent on a working day</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "ot-analysis":
        return (
          <div className="nb-table-wrap">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Days Worked</th>
                  <th className="num">Total Hours</th>
                  <th className="num">Overtime (beyond 8h/day)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.userId}>
                    <td className="font-semibold">{r.name}</td>
                    <td className="num">{r.presentDays}</td>
                    <td className="num">{r.totalHours}</td>
                    <td className="num font-bold">{r.overtimeHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "productivity":
        return (
          <div className="nb-table-wrap">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Days Worked</th>
                  <th className="num">Total Hours</th>
                  <th className="num">Avg Hours/Day</th>
                  <th className="num">Short Days (&lt;6.5h)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.userId}>
                    <td className="font-semibold">{r.name}</td>
                    <td className="num">{r.presentDays}</td>
                    <td className="num">{r.totalHours}</td>
                    <td className="num font-bold">{r.averageHours}</td>
                    <td className={`num ${r.shortDays > 0 ? "now-warn" : ""}`}>{r.shortDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "key-metrics":
        return (
          <div className="now-project-grid">
            {keyMetrics.map(metric => (
              <div key={metric.label} className="now-tile">
                <div className="flex items-center justify-between gap-2">
                  <span className="now-row-title">{metric.label}</span>
                  {metric.good ? (
                    <span className="now-pill nb-ok-soft nb-plain">
                      <TrendingUp className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                      Good
                    </span>
                  ) : (
                    <span className="now-pill risk nb-plain">
                      <TrendingDown className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                      Watch
                    </span>
                  )}
                </div>
                <div className="now-big-num">{metric.value}</div>
                <p className="now-row-sub">
                  Across {rows.length} employee{rows.length === 1 ? "" : "s"} in {periodLabel}
                </p>
              </div>
            ))}
          </div>
        );

      case "attendance-summary":
      default:
        return (
          <div className="nb-table-wrap">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Working Days</th>
                  <th className="num">Present</th>
                  <th className="num">Absent</th>
                  <th className="num">Leave</th>
                  <th className="num">Total Hours</th>
                  <th className="num">Payable Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.userId}>
                    <td>
                      <div className="font-semibold">{r.name}</div>
                      {r.employeeId && <div className="now-row-sub">{r.employeeId}</div>}
                    </td>
                    <td className="num">{r.workingDays}</td>
                    <td className="num nb-ok">{r.presentDays}</td>
                    <td className="num nb-bad">{r.absentDays}</td>
                    <td className="num nb-info">{r.leaveDays}</td>
                    <td className="num">{r.totalHours}</td>
                    <td className="num font-bold">{r.presentDays + r.leaveDays}</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td />
                    <td className="num nb-ok">{totals.presentDays}</td>
                    <td className="num nb-bad">{totals.absentDays}</td>
                    <td className="num nb-info">{totals.leaveDays}</td>
                    <td className="num">{totals.totalHours}</td>
                    <td className="num">{totals.presentDays + totals.leaveDays}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        );
    }
  };

  const exportable =
    !NOT_IMPLEMENTED[selectedReport] && selectedReport !== "realtime-dashboard" && rows.length > 0;

  return (
    <AdminLayout title="Advanced Reports">
      <div className="now-page">
        <NowPageHeader
          title="Advanced reports"
          subtitle="Attendance, payroll and productivity reports by month"
        />

        <section className="now-card" aria-label="Report filters">
          <div className="nb-filters">
            <div className="wide">
              <label className="nb-label">Report Type</label>
              <Select value={selectedReport} onValueChange={setSelectedReport}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reportCategories.map(category => (
                    <div key={category.title}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {category.title}
                      </div>
                      {category.reports.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="nb-label">Employee</label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_EMPLOYEES}>All employees</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeId || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className="nb-label">Month</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <label className="nb-label">Year</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        <section className="now-card" aria-label={reportName}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="now-h2">{reportName}</h2>
              <p className="now-row-sub mt-1">
                {periodLabel}
                {employeeId !== ALL_EMPLOYEES && singleEmployee ? ` • ${singleEmployee.name}` : ""}
                {report?.period?.workingDays ? ` • ${report.period.workingDays} working days` : ""}
              </p>
            </div>
            {exportable && (
              <button type="button" className="now-btn sm ground" onClick={handleExport}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </button>
            )}
          </div>

          {renderReportContent()}
        </section>

        <div className="now-project-grid">
          {reportCategories.map(category => (
            <section key={category.title} className="now-card" aria-label={category.title}>
              <h3 className="now-eyebrow">{category.title}</h3>
              <div className="nb-report-list">
                {category.reports.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    className="nb-report-btn"
                    aria-pressed={selectedReport === r.id}
                    onClick={() => setSelectedReport(r.id)}
                  >
                    <r.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="label line-clamp-2">{r.name}</span>
                    {NOT_IMPLEMENTED[r.id] && (
                      <span className="now-pill nb-plain" style={{ fontSize: 11 }}>soon</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
