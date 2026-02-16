import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
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
  Activity
} from "lucide-react";
import { Redirect } from "wouter";
import { toast } from "sonner";

export default function AdvancedReports() {
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState("attendance-summary");
  const [selectedMonth, setSelectedMonth] = useState("February 2026");

  // Check if user is admin
  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const handleExport = (format: "pdf" | "excel") => {
    // TODO: Implement export functionality
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  const reportCategories = [
    {
      title: "Payroll & Compliance Reports",
      reports: [
        { id: "attendance-summary", name: "Detailed Attendance Summary (Pre-Payroll)", icon: FileText },
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

  const months = [
    "January 2026", "February 2026", "March 2026", "April 2026",
    "May 2026", "June 2026", "July 2026", "August 2026",
    "September 2026", "October 2026", "November 2026", "December 2026"
  ];

  // Dummy data for demonstration
  const attendanceSummaryData = [
    { employee: "Hassan", totalDays: 20, present: 18, absent: 2, leaves: 0, payableDays: 18 },
    { employee: "Talha", totalDays: 20, present: 19, absent: 1, leaves: 0, payableDays: 19 },
  ];

  const otAnalysisData = [
    { employee: "Hassan", regularOT: 5, weekendOT: 2, holidayOT: 0, totalOT: 7 },
    { employee: "Talha", regularOT: 3, weekendOT: 1, holidayOT: 0, totalOT: 4 },
  ];

  const keyMetrics = [
    { label: "Absence Rate", value: "5.2%", trend: "down", color: "green" },
    { label: "Tardiness Rate", value: "12.5%", trend: "up", color: "red" },
    { label: "Overtime Percentage", value: "8.3%", trend: "down", color: "green" },
    { label: "Capacity Utilization", value: "94.8%", trend: "up", color: "green" },
  ];

  const renderReportContent = () => {
    switch (selectedReport) {
      case "attendance-summary":
        return (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Employee</th>
                    <th className="text-right p-3 font-semibold">Total Days</th>
                    <th className="text-right p-3 font-semibold">Present</th>
                    <th className="text-right p-3 font-semibold">Absent</th>
                    <th className="text-right p-3 font-semibold">Leaves</th>
                    <th className="text-right p-3 font-semibold">Payable Days</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceSummaryData.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{row.employee}</td>
                      <td className="p-3 text-right">{row.totalDays}</td>
                      <td className="p-3 text-right text-green-600">{row.present}</td>
                      <td className="p-3 text-right text-red-600">{row.absent}</td>
                      <td className="p-3 text-right text-blue-600">{row.leaves}</td>
                      <td className="p-3 text-right font-semibold">{row.payableDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "ot-analysis":
        return (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Employee</th>
                    <th className="text-right p-3 font-semibold">Regular OT (hrs)</th>
                    <th className="text-right p-3 font-semibold">Weekend OT (hrs)</th>
                    <th className="text-right p-3 font-semibold">Holiday OT (hrs)</th>
                    <th className="text-right p-3 font-semibold">Total OT (hrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {otAnalysisData.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{row.employee}</td>
                      <td className="p-3 text-right">{row.regularOT}</td>
                      <td className="p-3 text-right">{row.weekendOT}</td>
                      <td className="p-3 text-right">{row.holidayOT}</td>
                      <td className="p-3 text-right font-semibold">{row.totalOT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "key-metrics":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {keyMetrics.map((metric, idx) => (
              <Card key={idx} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{metric.label}</h3>
                  {metric.trend === "up" ? (
                    <TrendingUp className={`h-5 w-5 ${metric.color === "green" ? "text-green-500" : "text-red-500"}`} />
                  ) : (
                    <TrendingDown className={`h-5 w-5 ${metric.color === "green" ? "text-green-500" : "text-red-500"}`} />
                  )}
                </div>
                <p className="text-3xl font-bold">{metric.value}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {metric.trend === "up" ? "Increased" : "Decreased"} from last month
                </p>
              </Card>
            ))}
          </div>
        );

      case "realtime-dashboard":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Users className="h-6 w-6 text-green-500" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-1">2</h3>
                <p className="text-sm text-muted-foreground">Currently Working</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <Users className="h-6 w-6 text-red-500" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-1">0</h3>
                <p className="text-sm text-muted-foreground">Absent Today</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Clock className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-1">0</h3>
                <p className="text-sm text-muted-foreground">On Break</p>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Live Status</h3>
              <div className="space-y-3">
                {attendanceSummaryData.map((emp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium">{emp.employee}</span>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">
                      Working
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );

      default:
        return (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Report data will be displayed here</p>
              <p className="text-sm mt-1">Select a report type to view detailed analytics</p>
            </div>
          </Card>
        );
    }
  };

  return (
    <AdminLayout title="Advanced Reports">
      <div className="space-y-6">
      {/* Export Buttons */}
      <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleExport("excel")}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={() => handleExport("pdf")}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Type</label>
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reportCategories.map((category) => (
                  <div key={category.title}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {category.title}
                    </div>
                    {category.reports.map((report) => (
                      <SelectItem key={report.id} value={report.id}>
                        {report.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-1">
            {reportCategories
              .flatMap(c => c.reports)
              .find(r => r.id === selectedReport)?.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Report for {selectedMonth}
          </p>
        </div>

        {renderReportContent()}
      </Card>

      {/* Report Categories Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCategories.map((category, idx) => (
          <Card key={idx} className="p-6">
            <h3 className="font-semibold mb-4">{category.title}</h3>
            <div className="space-y-2">
              {category.reports.map((report) => (
                <Button
                  key={report.id}
                  variant={selectedReport === report.id ? "default" : "ghost"}
                  className="w-full justify-start text-sm h-auto py-2"
                  onClick={() => setSelectedReport(report.id)}
                >
                  <report.icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="text-left line-clamp-2">{report.name}</span>
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
