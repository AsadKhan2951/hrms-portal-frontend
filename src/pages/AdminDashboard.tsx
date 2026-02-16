import { useState } from "react";
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
  Circle
} from "lucide-react";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  // Dummy data for demonstration
  const totalEmployees = [
    { id: 1, name: "Hassan Ali", designation: "Senior Developer", status: "timed_in", timeIn: "08:45 AM", hours: "5.2h" },
    { id: 2, name: "Talha Khan", designation: "Software Developer", status: "timed_in", timeIn: "09:00 AM", hours: "5.0h" },
    { id: 3, name: "Sara Ahmed", designation: "UI/UX Designer", status: "on_break", timeIn: "08:30 AM", hours: "5.5h" },
    { id: 4, name: "Ali Raza", designation: "QA Engineer", status: "on_leave", timeIn: "-", hours: "0h" },
    { id: 5, name: "Fatima Noor", designation: "Product Manager", status: "offline", timeIn: "-", hours: "0h" },
  ];

  const pendingLeaves = [
    { id: 1, employee: "Hassan Ali", type: "Sick Leave", days: 2, date: "Feb 15-16" },
    { id: 2, employee: "Sara Ahmed", type: "Casual Leave", days: 1, date: "Feb 17" },
  ];

  const pendingForms = [
    { id: 1, employee: "Talha Khan", type: "Reimbursement Request", submitted: "2 hours ago" },
    { id: 2, employee: "Ali Raza", type: "Equipment Request", submitted: "5 hours ago" },
    { id: 3, employee: "Fatima Noor", type: "Feedback Form", submitted: "1 day ago" },
  ];

  const ongoingProjects = [
    { id: 1, name: "HRMS Portal", assignees: ["Hassan", "Talha"], progress: 75, tasks: 12 },
    { id: 2, name: "Mobile App", assignees: ["Sara"], progress: 40, tasks: 8 },
  ];

  const ongoingTasks = [
    { id: 1, title: "Fix authentication bug", assignee: "Hassan Ali", project: "HRMS Portal", priority: "high" },
    { id: 2, title: "Design dashboard mockups", assignee: "Sara Ahmed", project: "Mobile App", priority: "medium" },
    { id: 3, title: "API integration", assignee: "Talha Khan", project: "HRMS Portal", priority: "high" },
  ];

  const avgHoursData = [
    { day: "Mon", hours: 8.2 },
    { day: "Tue", hours: 7.8 },
    { day: "Wed", hours: 8.5 },
    { day: "Thu", hours: 8.0 },
    { day: "Fri", hours: 7.5 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "timed_in": return "bg-green-500";
      case "on_break": return "bg-yellow-500";
      case "on_leave": return "bg-blue-500";
      default: return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "timed_in": return "Timed In";
      case "on_break": return "On Break";
      case "on_leave": return "On Leave";
      default: return "Offline";
    }
  };

  return (
    <AdminLayout title="Admin Dashboard">
      {/* Greeting Insight Bar */}
      <Card className="p-4 mb-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold mb-1">Good afternoon, Aamir! 👋</h2>
            <p className="text-sm text-muted-foreground mb-3">Here's what's happening with your team today</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span><strong>3</strong> employees currently working</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span><strong>2</strong> pending leave requests</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-blue-500" />
                <span><strong>3</strong> pending form responses</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <span><strong>12</strong> tasks in progress</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Insights Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Online Now</span>
          </div>
          <p className="text-2xl font-bold">3/5</p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-4 w-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Most Punctual</span>
          </div>
          <p className="text-sm font-semibold truncate">Hassan Ali</p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Active Projects</span>
          </div>
          <p className="text-2xl font-bold">2</p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <ListTodo className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Ongoing Tasks</span>
          </div>
          <p className="text-2xl font-bold">12</p>
        </Card>
      </div>

      {/* Key Metrics */}
      <Card className="p-4 mb-4">
        <h3 className="font-semibold mb-3 text-sm">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">Absence Rate</span>
            </div>
            <p className="text-xl font-bold">2.5%</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3 w-3 text-orange-500" />
              <span className="text-xs text-muted-foreground">Tardiness</span>
            </div>
            <p className="text-xl font-bold">5.2%</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">OT %</span>
            </div>
            <p className="text-xl font-bold">12%</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-3 w-3 text-purple-500" />
              <span className="text-xs text-muted-foreground">Capacity</span>
            </div>
            <p className="text-xl font-bold">87%</p>
          </div>
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Total Employees List */}
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
            {totalEmployees.map((emp) => (
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
                      <span className="text-muted-foreground">{emp.timeIn}</span>
                      <span className="font-semibold">{emp.hours}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Forms */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Pending Forms</h3>
            <Badge variant="secondary" className="text-xs">{pendingForms.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingForms.map((form) => (
              <div key={form.id} className="p-2 rounded-lg border">
                <p className="text-sm font-medium">{form.employee}</p>
                <p className="text-xs text-muted-foreground">{form.type}</p>
                <p className="text-xs text-muted-foreground">{form.submitted}</p>
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

      {/* Pending Leaves & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Pending Leaves */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Pending Leaves</h3>
            <Badge variant="secondary" className="text-xs">{pendingLeaves.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingLeaves.map((leave) => (
              <div key={leave.id} className="p-2 rounded-lg border">
                <p className="text-sm font-medium">{leave.employee}</p>
                <p className="text-xs text-muted-foreground">{leave.type} • {leave.days} days</p>
                <p className="text-xs text-muted-foreground">{leave.date}</p>
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

        {/* Average Hours Chart */}
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

      {/* Ongoing Projects & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Ongoing Projects */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Ongoing Projects</h3>
          <div className="space-y-3">
            {ongoingProjects.map((project) => (
              <div key={project.id} className="p-2 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{project.name}</p>
                  <span className="text-xs font-semibold">{project.progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mb-2">
                  <div 
                    className="bg-primary h-1.5 rounded-full" 
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{project.assignees.join(", ")}</span>
                  <span>{project.tasks} tasks</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Ongoing Tasks */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Ongoing Tasks</h3>
          <div className="space-y-2">
            {ongoingTasks.map((task) => (
              <div key={task.id} className="p-3 rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium flex-1">{task.title}</p>
                  <Badge 
                    variant={task.priority === 'high' ? 'destructive' : 'secondary'}
                    className="text-xs ml-2"
                  >
                    {task.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{task.assignee}</p>
                <p className="text-xs text-muted-foreground">{task.project}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Reports Access */}
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
