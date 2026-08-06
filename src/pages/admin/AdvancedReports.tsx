import AdminLayout from "@/components/AdminLayout";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { downloadCsv } from "@/lib/csv";

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
  present: "text-green-600",
  absent: "text-red-600",
  leave: "text-blue-600",
  off: "text-muted-foreground",
  upcoming: "text-muted-foreground",
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
  const employees = employeeData.filter((emp: any) => emp?.role === "user");

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

  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

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
          fmtTime(d.timeOut),
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

  const renderReportContent = () => {
    if (NOT_IMPLEMENTED[selectedReport]) {
      return (
        <Card className="p-10 border-dashed">
          <div className="text-center text-muted-foreground max-w-lg mx-auto">
            <BarChart3 className="h-10 w-10 mx-auto mb-4 opacity-40" />
            <p className="font-medium text-foreground mb-2">Not built yet</p>
            <p className="text-sm">{NOT_IMPLEMENTED[selectedReport]}</p>
          </div>
        </Card>
      );
    }

    if (selectedReport === "realtime-dashboard") {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Currently Working", count: employeeStatuses.filter((e: any) => e.status === "timed_in").length, cls: "green" },
              { label: "On Break", count: employeeStatuses.filter((e: any) => e.status === "on_break").length, cls: "blue" },
              { label: "On Leave Today", count: employeeStatuses.filter((e: any) => e.status === "on_leave").length, cls: "red" },
            ].map(card => (
              <Card key={card.label} className="p-6">
                <div className={`p-3 bg-${card.cls}-500/10 rounded-lg w-fit mb-2`}>
                  <Users className={`h-6 w-6 text-${card.cls}-500`} />
                </div>
                <h3 className="text-2xl font-bold mb-1">{card.count}</h3>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </Card>
            ))}
          </div>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Live Status</h3>
            <div className="space-y-3">
              {employeeStatuses.map((emp: any) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${emp.status === "timed_in" ? "bg-green-500" : emp.status === "on_break" ? "bg-blue-500" : emp.status === "on_leave" ? "bg-amber-500" : "bg-gray-500"}`} />
                    <span className="font-medium">{emp.name}</span>
                  </div>
                  <Badge variant="outline">
                    {emp.status === "timed_in" ? "Working" : emp.status === "on_break" ? "On Break" : emp.status === "on_leave" ? "On Leave" : "Offline"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading {periodLabel}...
        </div>
      );
    }

    if (error) {
      return (
        <Card className="p-8 border-destructive/40">
          <p className="text-center text-destructive">{error.message}</p>
        </Card>
      );
    }

    if (rows.length === 0) {
      return (
        <Card className="p-10">
          <p className="text-center text-muted-foreground">
            No employees found for {periodLabel}
          </p>
        </Card>
      );
    }

    switch (selectedReport) {
      case "employee-detail": {
        if (!singleEmployee) {
          return (
            <Card className="p-10 border-dashed">
              <p className="text-center text-muted-foreground">
                Pick a single employee above to see their day-by-day month.
              </p>
            </Card>
          );
        }
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Present", value: singleEmployee.presentDays, cls: "text-green-600" },
                { label: "Absent", value: singleEmployee.absentDays, cls: "text-red-600" },
                { label: "Leave", value: singleEmployee.leaveDays, cls: "text-blue-600" },
                { label: "Total Hours", value: `${singleEmployee.totalHours}h`, cls: "" },
              ].map(s => (
                <Card key={s.label} className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                </Card>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Date</th>
                    <th className="text-left p-3 font-semibold">Day</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-right p-3 font-semibold">Time In</th>
                    <th className="text-right p-3 font-semibold">Time Out</th>
                    <th className="text-right p-3 font-semibold">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {singleEmployee.days.map((d: any) => (
                    <tr key={d.date} className={`border-b hover:bg-muted/50 ${d.isWorkingDay ? "" : "bg-muted/20"}`}>
                      <td className="p-3">{d.date}</td>
                      <td className="p-3 text-muted-foreground">{fmtDay(d.date)}</td>
                      <td className={`p-3 capitalize font-medium ${STATUS_STYLES[d.status]}`}>
                        {d.status === "off" ? "Weekend" : d.status}
                        {d.missingClockOut && (
                          <span className="ml-2 text-xs text-amber-600">no clock-out</span>
                        )}
                      </td>
                      <td className="p-3 text-right">{fmtTime(d.timeIn)}</td>
                      <td className="p-3 text-right">{fmtTime(d.timeOut)}</td>
                      <td className="p-3 text-right font-medium">{d.hours || "--"}</td>
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
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span><b className="text-green-600">P</b> Present</span>
              <span><b className="text-red-600">A</b> Absent</span>
              <span><b className="text-blue-600">L</b> Leave</span>
              <span><b>–</b> Weekend</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold sticky left-0 bg-background min-w-[140px]">Employee</th>
                    {days.map((d: any) => (
                      <th key={d.date} className={`p-1 font-semibold w-7 ${d.isWorkingDay ? "" : "text-muted-foreground"}`}>
                        {new Date(`${d.date}T00:00:00`).getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.userId} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium sticky left-0 bg-background whitespace-nowrap">{r.name}</td>
                      {r.days.map((d: any) => (
                        <td key={d.date} className={`p-1 text-center font-semibold ${STATUS_STYLES[d.status]}`}>
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
          return (
            <Card className="p-10">
              <p className="text-center text-muted-foreground">
                No exceptions in {periodLabel}
              </p>
            </Card>
          );
        }
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Employee</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Exception</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e: any, i: number) => (
                  <tr key={`${e.employee}-${e.date}-${i}`} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{e.employee}</td>
                    <td className="p-3">{e.date} ({fmtDay(e.date)})</td>
                    <td className="p-3">
                      {e.missingClockOut ? (
                        <span className="text-amber-600">Missing clock-out</span>
                      ) : (
                        <span className="text-red-600">Absent on a working day</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Employee</th>
                  <th className="text-right p-3 font-semibold">Days Worked</th>
                  <th className="text-right p-3 font-semibold">Total Hours</th>
                  <th className="text-right p-3 font-semibold">Overtime (beyond 8h/day)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.userId} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-right">{r.presentDays}</td>
                    <td className="p-3 text-right">{r.totalHours}</td>
                    <td className="p-3 text-right font-semibold">{r.overtimeHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "productivity":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Employee</th>
                  <th className="text-right p-3 font-semibold">Days Worked</th>
                  <th className="text-right p-3 font-semibold">Total Hours</th>
                  <th className="text-right p-3 font-semibold">Avg Hours/Day</th>
                  <th className="text-right p-3 font-semibold">Short Days (&lt;6.5h)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.userId} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-right">{r.presentDays}</td>
                    <td className="p-3 text-right">{r.totalHours}</td>
                    <td className="p-3 text-right font-semibold">{r.averageHours}</td>
                    <td className="p-3 text-right text-amber-600">{r.shortDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "key-metrics":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {keyMetrics.map(metric => (
              <Card key={metric.label} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{metric.label}</h3>
                  {metric.good ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <p className="text-3xl font-bold">{metric.value}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Across {rows.length} employee{rows.length === 1 ? "" : "s"} in {periodLabel}
                </p>
              </Card>
            ))}
          </div>
        );

      case "attendance-summary":
      default:
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Employee</th>
                  <th className="text-right p-3 font-semibold">Working Days</th>
                  <th className="text-right p-3 font-semibold">Present</th>
                  <th className="text-right p-3 font-semibold">Absent</th>
                  <th className="text-right p-3 font-semibold">Leave</th>
                  <th className="text-right p-3 font-semibold">Total Hours</th>
                  <th className="text-right p-3 font-semibold">Payable Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.userId} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">
                      {r.name}
                      {r.employeeId && (
                        <span className="text-xs text-muted-foreground ml-2">{r.employeeId}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">{r.workingDays}</td>
                    <td className="p-3 text-right text-green-600">{r.presentDays}</td>
                    <td className="p-3 text-right text-red-600">{r.absentDays}</td>
                    <td className="p-3 text-right text-blue-600">{r.leaveDays}</td>
                    <td className="p-3 text-right">{r.totalHours}</td>
                    <td className="p-3 text-right font-semibold">{r.presentDays + r.leaveDays}</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3" />
                    <td className="p-3 text-right text-green-600">{totals.presentDays}</td>
                    <td className="p-3 text-right text-red-600">{totals.absentDays}</td>
                    <td className="p-3 text-right text-blue-600">{totals.leaveDays}</td>
                    <td className="p-3 text-right">{totals.totalHours}</td>
                    <td className="p-3 text-right">{totals.presentDays + totals.leaveDays}</td>
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
      <div className="space-y-6">
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Report Type</label>
              <Select value={selectedReport} onValueChange={setSelectedReport}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">{reportName}</h2>
              <p className="text-sm text-muted-foreground">
                {periodLabel}
                {employeeId !== ALL_EMPLOYEES && singleEmployee ? ` • ${singleEmployee.name}` : ""}
                {report?.period?.workingDays ? ` • ${report.period.workingDays} working days` : ""}
              </p>
            </div>
            {exportable && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>

          {renderReportContent()}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reportCategories.map(category => (
            <Card key={category.title} className="p-6">
              <h3 className="font-semibold mb-4">{category.title}</h3>
              <div className="space-y-2">
                {category.reports.map(r => (
                  <Button
                    key={r.id}
                    variant={selectedReport === r.id ? "default" : "ghost"}
                    className="w-full justify-start text-sm h-auto py-2"
                    onClick={() => setSelectedReport(r.id)}
                  >
                    <r.icon className="h-4 w-4 mr-2 shrink-0" />
                    <span className="text-left line-clamp-2">{r.name}</span>
                    {NOT_IMPLEMENTED[r.id] && (
                      <Badge variant="outline" className="ml-auto text-[10px]">soon</Badge>
                    )}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
