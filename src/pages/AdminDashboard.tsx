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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: employeeStatuses = [] } = trpc.admin.getEmployeeStatusSnapshot.useQuery();
  const { data: leaveRequests = [] } = trpc.admin.getLeaveRequests.useQuery();
  const { data: formSubmissions = [] } = trpc.admin.getFormSubmissions.useQuery();
  const { data: projects = [] } = trpc.admin.getProjectsOverview.useQuery();
  const { data: ongoingTasks = [] } = trpc.admin.getOngoingTasks.useQuery();
  const { data: taskStats } = trpc.admin.getTaskStats.useQuery();
  const { data: avgHoursData = [] } = trpc.admin.getAverageHours.useQuery({ days: 5 });

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

  const totalEmployeesCount = employeeStatuses.length;
  const workingNowCount = employeeStatuses.filter((emp: any) => emp.status === "timed_in" || emp.status === "on_break").length;
  const onLeaveCount = employeeStatuses.filter((emp: any) => emp.status === "on_leave").length;
  const mostPunctual = useMemo(() => {
    const active = employeeStatuses.filter((emp: any) => emp.timeIn);
    if (!active.length) return "N/A";
    const earliest = active.sort((a: any, b: any) => new Date(a.timeIn).getTime() - new Date(b.timeIn).getTime())[0];
    return earliest?.name || "N/A";
  }, [employeeStatuses]);

  const taskCompletionRate = useMemo(() => {
    const total = taskStats?.total || 0;
    const completed = taskStats?.completed || 0;
    return total ? (completed / total) * 100 : 0;
  }, [taskStats]);

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
      <Card className="p-4 mb-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold mb-1">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.name || "Admin"}!</h2>
            <p className="text-sm text-muted-foreground mb-3">Here's what's happening with your team today</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span><strong>{workingNowCount}</strong> employees currently working</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span><strong>{pendingLeaves.length}</strong> pending leave requests</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-blue-500" />
                <span><strong>{pendingForms.length}</strong> pending form responses</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <span><strong>{ongoingTasks.length}</strong> tasks in progress</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Online Now</span>
          </div>
          <p className="text-2xl font-bold">{workingNowCount}/{totalEmployeesCount}</p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-4 w-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Most Punctual</span>
          </div>
          <p className="text-sm font-semibold truncate">{mostPunctual}</p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Active Projects</span>
          </div>
          <p className="text-2xl font-bold">{activeProjects.length}</p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <ListTodo className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Ongoing Tasks</span>
          </div>
          <p className="text-2xl font-bold">{ongoingTasks.length}</p>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <h3 className="font-semibold mb-3 text-sm">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">Absence Rate</span>
            </div>
            <p className="text-xl font-bold">
              {totalEmployeesCount ? ((onLeaveCount / totalEmployeesCount) * 100).toFixed(1) : "0.0"}%
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3 w-3 text-orange-500" />
              <span className="text-xs text-muted-foreground">Tardiness</span>
            </div>
            <p className="text-xl font-bold">0%</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">OT %</span>
            </div>
            <p className="text-xl font-bold">0%</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-3 w-3 text-purple-500" />
              <span className="text-xs text-muted-foreground">Capacity</span>
            </div>
            <p className="text-xl font-bold">
              {totalEmployeesCount ? ((workingNowCount / totalEmployeesCount) * 100).toFixed(0) : "0"}%
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">Task Completion</span>
            </div>
            <p className="text-xl font-bold">{taskCompletionRate.toFixed(0)}%</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">All Employees</h3>
            <Link href="/admin/employees">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                Manage All
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {employeeStatuses.map((emp: any) => (
              <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 border">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`h-2 w-2 rounded-full ${getStatusColor(emp.status)}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <Badge variant="secondary" className="text-xs">
                    {getStatusLabel(emp.status)}
                  </Badge>
                  {emp.status === "timed_in" || emp.status === "on_break" ? (
                    <>
                      <span className="text-muted-foreground">
                        {emp.timeIn ? format(new Date(emp.timeIn), "HH:mm") : "--"}
                      </span>
                      <span className="font-semibold">{emp.hours || "--"}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Pending Forms</h3>
            <Badge variant="secondary" className="text-xs">{pendingForms.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingForms.map((form: any) => (
              <div key={form.id} className="p-2 rounded-lg border">
                <p className="text-sm font-medium">{form.user?.name || "Employee"}</p>
                <p className="text-xs text-muted-foreground">{form.formType}</p>
                <p className="text-xs text-muted-foreground">
                  {form.createdAt ? format(new Date(form.createdAt), "MMM dd, HH:mm") : "--"}
                </p>
                <Button size="sm" variant="default" className="h-6 text-xs w-full mt-2">
                  Review
                </Button>
              </div>
            ))}
          </div>
          <Link href="/admin/forms">
            <Button variant="link" className="w-full mt-3 h-8 text-xs">
              View All Forms
            </Button>
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Pending Leaves</h3>
            <Badge variant="secondary" className="text-xs">{pendingLeaves.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingLeaves.map((leave: any) => (
              <div key={leave.id} className="p-2 rounded-lg border">
                <p className="text-sm font-medium">{leave.user?.name || "Employee"}</p>
                <p className="text-xs text-muted-foreground">
                  {leave.leaveType} • {leave.startDate ? format(new Date(leave.startDate), "MMM dd") : "--"} - {leave.endDate ? format(new Date(leave.endDate), "MMM dd") : "--"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leave.createdAt ? format(new Date(leave.createdAt), "MMM dd, HH:mm") : "--"}
                </p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="default" className="h-6 text-xs flex-1">
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs flex-1">
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h3 className="font-semibold mb-3 text-sm">Employee Average Hours (This Week)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={avgHoursData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Ongoing Projects</h3>
          <div className="space-y-3">
            {activeProjects.map((project: any) => (
              <div key={project.id} className="p-2 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{project.name}</p>
                  <span className="text-xs font-semibold">{project.progress || 0}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mb-2">
                  <div
                    className="bg-primary h-1.5 rounded-full"
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

        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Ongoing Tasks</h3>
          <div className="space-y-2">
            {ongoingTasks.map((task: any) => (
              <div key={task.id} className="p-3 rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium flex-1">{task.title}</p>
                  <Badge
                    variant={task.priority === "high" ? "destructive" : "secondary"}
                    className="text-xs ml-2"
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

      <Card className="p-4">
        <h3 className="font-semibold mb-3 text-sm">Advanced Reports</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/admin/reports">
            <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
              <Activity className="h-3 w-3 mr-2" />
              <span className="text-xs">Attendance Summary</span>
            </Button>
          </Link>
          <Link href="/admin/reports">
            <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
              <Clock className="h-3 w-3 mr-2" />
              <span className="text-xs">OT Analysis</span>
            </Button>
          </Link>
          <Link href="/admin/reports">
            <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
              <FileCheck className="h-3 w-3 mr-2" />
              <span className="text-xs">Audit Trail</span>
            </Button>
          </Link>
          <Link href="/admin/reports">
            <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2">
              <AlertCircle className="h-3 w-3 mr-2" />
              <span className="text-xs">Exceptions</span>
            </Button>
          </Link>
        </div>
      </Card>
    </AdminLayout>
  );
}










