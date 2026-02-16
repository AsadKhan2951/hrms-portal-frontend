import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FolderKanban, 
  Plus, 
  Users,
  Calendar,
  CheckCircle2
} from "lucide-react";
import { Redirect } from "wouter";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Dummy data - will be replaced with real data from tRPC
const dummyEmployees = [
  { id: 1, employeeId: "EMP001", name: "Hassan", department: "Engineering" },
  { id: 2, employeeId: "EMP002", name: "Talha", department: "Design" },
];

const dummyProjects = [
  {
    id: 1,
    name: "Website Redesign",
    description: "Complete overhaul of company website",
    assignedTo: ["Hassan", "Talha"],
    status: "active",
    priority: "high",
    createdAt: new Date("2026-02-01"),
  },
];

export default function ProjectAssignment() {
  const { user } = useAuth();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectPriority, setProjectPriority] = useState("medium");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);

  // Check if user is admin
  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const handleAssignProject = () => {
    if (!projectName || selectedEmployees.length === 0) {
      toast.error("Please enter project name and select at least one employee");
      return;
    }
    // TODO: Implement with tRPC mutation
    toast.success(`Project assigned to ${selectedEmployees.length} employee(s)`);
    setAssignDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setProjectName("");
    setProjectDescription("");
    setProjectPriority("medium");
    setSelectedEmployees([]);
  };

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { className: string }> = {
      high: { className: "bg-red-500/10 text-red-500" },
      medium: { className: "bg-yellow-500/10 text-yellow-600" },
      low: { className: "bg-green-500/10 text-green-600" },
    };

    const { className } = config[priority] || config.medium;

    return (
      <Badge variant="outline" className={className}>
        {priority}
      </Badge>
    );
  };

  return (
    <AdminLayout title="Project Assignment">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6" />
            Project Assignment
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign and manage employee projects
          </p>
        </div>

        <Button onClick={() => setAssignDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign New Project
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <FolderKanban className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-1">{dummyProjects.length}</h3>
          <p className="text-sm text-muted-foreground">Active Projects</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Users className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-1">{dummyEmployees.length}</h3>
          <p className="text-sm text-muted-foreground">Total Employees</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-purple-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-1">0</h3>
          <p className="text-sm text-muted-foreground">Completed Projects</p>
        </Card>
      </div>

      {/* Projects List */}
      <div className="grid gap-4">
        {dummyProjects.map((project) => (
          <Card key={project.id} className="p-6">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    {getPriorityBadge(project.priority)}
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                      {project.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                </div>
              </div>

              {/* Assigned Employees */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Assigned To:</p>
                <div className="flex flex-wrap gap-2">
                  {project.assignedTo.map((emp, idx) => (
                    <Badge key={idx} variant="secondary">
                      {emp}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Created on {project.createdAt.toLocaleDateString()}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {dummyProjects.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No projects assigned yet</p>
              <p className="text-sm mt-1">Create and assign your first project</p>
            </div>
          </Card>
        )}
      </div>

      {/* Assign Project Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign New Project</DialogTitle>
            <DialogDescription>
              Create a project and assign it to employees
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                placeholder="Website Redesign"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                placeholder="Project description and objectives..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select value={projectPriority} onValueChange={setProjectPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assign To Employees *</Label>
              <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
                {dummyEmployees.map((employee) => (
                  <div key={employee.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`emp-${employee.id}`}
                      checked={selectedEmployees.includes(employee.id)}
                      onCheckedChange={() => toggleEmployee(employee.id)}
                    />
                    <label
                      htmlFor={`emp-${employee.id}`}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {employee.employeeId} • {employee.department}
                        </p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedEmployees.length} employee(s) selected
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignProject}>
              Assign Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
