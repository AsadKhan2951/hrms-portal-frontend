import { useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  Activity,
  Target,
  Briefcase,
  ListTodo,
  Users,
  FileCheck,
  MessageSquareText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar } from "recharts";
import { trpc } from "@/lib/trpc";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: employeeStatuses = [] } = trpc.admin.getEmployeeStatusSnapshot.useQuery();
  const { data: leaveRequests = [] } = trpc.admin.getLeaveRequests.useQuery();
  const { data: formSubmissions = [] } = trpc.admin.getFormSubmissions.useQuery();
  const { data: projects = [] } = trpc.admin.getProjectsOverview.useQuery();
  const { data: ongoingTasks = [] } = trpc.admin.getOngoingTasks.useQuery();
  const { data: avgHoursData = [] } = trpc.admin.getAverageHours.useQuery({ days: 5 });
  const { data: resourcePerformance = [] } = trpc.admin.getResourcePerformance.useQuery();

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

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Greeting */}
        <Card className="p-6 border border-primary/30 bg-gradient-to-r from-primary/15 via-background to-background/10 shadow-[0_0_0_1px_rgba(255,69,0,0.15)]">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.name || "Admin"}! 👋
            </h2>
            <p className="text-sm text-muted-foreground">
              Here's what's happening with your team today
            </p>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span><strong className="text-foreground">{workingNowCount}</strong> employees currently working</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span><strong className="text-foreground">{pendingLeaves.length}</strong> pending leave requests</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-blue-500" />
                <span><strong className="text-foreground">{pendingForms.length}</strong> pending form responses</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <span><strong className="text-foreground">{ongoingTasks.length}</strong> tasks in progress</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="h-4 w-4 text-green-500" />
              Online Now
            </div>
            <div className="text-2xl font-bold">{workingNowCount}/{totalEmployeesCount}</div>
          </Card>
          <Card className="p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Award className="h-4 w-4 text-yellow-500" />
              Most Punctual
            </div>
            <div className="text-base font-semibold truncate">{mostPunctual}</div>
          </Card>
          <Card className="p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Briefcase className="h-4 w-4 text-blue-500" />
              Active Projects
            </div>
            <div className="text-2xl font-bold">{activeProjects.length}</div>
          </Card>
          <Card className="p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <ListTodo className="h-4 w-4 text-purple-500" />
              Ongoing Tasks
            </div>
            <div className="text-2xl font-bold">{ongoingTasks.length}</div>
          </Card>
        </div>

        {/* Key Metrics */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold mb-4">Key Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                Absence Rate
              </div>
              <div className="text-2xl font-bold">
                {totalEmployeesCount ? ((onLeaveCount / totalEmployeesCount) * 100).toFixed(1) : "0.0"}%
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5 text-orange-500" />
                Tardiness
              </div>
              <div className="text-2xl font-bold">5.2%</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                OT %
              </div>
              <div className="text-2xl font-bold">12%</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Target className="h-3.5 w-3.5 text-purple-500" />
                Capacity
              </div>
              <div className="text-2xl font-bold">
                {totalEmployeesCount ? ((workingNowCount / totalEmployeesCount) * 100).toFixed(0) : "0"}%
              </div>
            </div>
          </div>
        </Card>

        {/* Employees + Pending Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-6 lg:col-span-2 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">All Employees</h3>
              <Link href="/admin/employees">
                <Button variant="link" className="p-0 h-auto text-primary">
                  Manage All
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {employeeStatuses.map((emp: any) => (
                <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor(emp.status)}`} />
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.designation}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {getStatusLabel(emp.status)}
                    </Badge>
                    {emp.status === "timed_in" || emp.status === "on_break" ? (
                      <>
                        <span>{emp.timeIn ? format(new Date(emp.timeIn), "hh:mm a") : "--"}</span>
                        <span className="font-semibold text-foreground">{emp.hours || "--"}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Pending Forms</h3>
              <Badge variant="secondary" className="text-xs">{pendingForms.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendingForms.map((form: any) => (
                <div key={form.id} className="p-3 rounded-xl border bg-muted/30">
                  <p className="text-sm font-medium">{form.user?.name || "Employee"}</p>
                  <p className="text-xs text-muted-foreground">{form.subject || form.formType}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.createdAt
                      ? formatDistanceToNow(new Date(form.createdAt), { addSuffix: true })
                      : "--"}
                  </p>
                  <Button className="w-full mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
                    Review
                  </Button>
                </div>
              ))}
            </div>
            <Link href="/admin/forms">
              <Button variant="link" className="w-full mt-4 h-8 text-primary">
                View All Forms
              </Button>
            </Link>
          </Card>
        </div>

        {/* Pending Leaves + Average Hours */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Pending Leaves</h3>
              <Badge variant="secondary" className="text-xs">{pendingLeaves.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendingLeaves.map((leave: any) => (
                <div key={leave.id} className="p-3 rounded-xl border bg-muted/30 space-y-2">
                  <div>
                    <p className="text-sm font-medium">{leave.user?.name || "Employee"}</p>
                    <p className="text-xs text-muted-foreground">
                      {leave.leaveType} • {leave.startDate ? format(new Date(leave.startDate), "MMM dd") : "--"} - {leave.endDate ? format(new Date(leave.endDate), "MMM dd") : "--"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                      Approve
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2 rounded-2xl">
            <h3 className="font-semibold mb-4">Employee Average Hours (This Week)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={avgHoursData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Ongoing Projects + Ongoing Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold mb-4">Ongoing Projects</h3>
            <div className="space-y-4">
              {activeProjects.map((project: any) => (
                <div key={project.id} className="p-3 rounded-xl border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{project.name}</p>
                    <span className="text-xs font-semibold">{project.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mb-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${project.progress || 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project.assignees?.join(", ") || "Unassigned"}</span>
                    <span>{project.tasks || 0} tasks</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold mb-4">Ongoing Tasks</h3>
            <div className="space-y-3">
              {ongoingTasks.map((task: any) => (
                <div key={task.id} className="p-3 rounded-xl border bg-muted/30">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium">{task.title}</p>
                    <Badge
                      variant={task.priority === "high" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {(task.assignees || [])
                      .map((assignee: any) => assignee?.name || assignee?.employeeId || "Employee")
                      .filter(Boolean)
                      .join(", ") || "Employee"}
                  </p>
                  <p className="text-xs text-muted-foreground">{task.project?.name || "Project"}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Resource Performance */}
        <Card className="p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Resource Performance</h3>
            <span className="text-xs text-muted-foreground">
              Tasks completed vs pending with active projects
            </span>
          </div>
          {performanceData.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              No performance data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="tasksCompleted" stackId="tasks" fill="#22c55e" />
                <Bar yAxisId="left" dataKey="tasksPending" stackId="tasks" fill="#f97316" />
                <Line yAxisId="right" type="monotone" dataKey="activeProjects" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
              Tasks completed
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#f97316]" />
              Tasks pending
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
              Active projects
            </span>
          </div>
        </Card>

        {/* Advanced Reports */}
        <Card className="p-4 rounded-2xl">
          <h3 className="font-semibold mb-4">Advanced Reports</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/admin/reports">
              <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
                <Activity className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs">Attendance Summary</span>
              </Button>
            </Link>
            <Link href="/admin/reports">
              <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
                <Clock className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs">OT Analysis</span>
              </Button>
            </Link>
            <Link href="/admin/reports">
              <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
                <FileCheck className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs">Audit Trail</span>
              </Button>
            </Link>
            <Link href="/admin/reports">
              <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
                <AlertCircle className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs">Exceptions</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}










