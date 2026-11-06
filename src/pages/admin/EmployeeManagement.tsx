import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { NowPageHeader, Segmented } from "@/components/now/NowPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Plus,
  Search,
  Edit,
  UserCheck,
  UserX,
  Loader2,
  Download,
  Upload,
  FileText,
  Award,
  DollarSign,
  Shield,
  History
} from "lucide-react";
import { Redirect } from "wouter";
import { isOrgWide } from "@/lib/roles";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import "./adminA.css";

export default function EmployeeManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: employeeData = [], isLoading: employeesLoading } = trpc.employees.list.useQuery();
  const createEmployeeMutation = trpc.employees.create.useMutation({
    onSuccess: () => {
      utils.employees.list.invalidate();
    },
  });
  const updateEmployeeMutation = trpc.employees.update.useMutation({
    onSuccess: () => {
      utils.employees.list.invalidate();
    },
  });
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to reset password");
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "past">("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [editableEmployee, setEditableEmployee] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    employeeId: "",
    password: "",
    department: "",
    position: "",
  });
  const [cnicFrontFile, setCnicFrontFile] = useState<File | null>(null);
  const [cnicBackFile, setCnicBackFile] = useState<File | null>(null);
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Redirect if not admin
  if (!isOrgWide(user?.role)) {
    return <Redirect to="/" />;
  }

  const employees = employeeData
    .filter((emp: any) => emp?.role !== "admin")
    .map((emp: any) => ({
      ...emp,
      name: emp?.name || "Unknown",
      email: emp?.email || "",
      employeeId: emp?.employeeId || "",
      status: emp?.status || "active",
      department: emp?.department || "General",
      position: emp?.position || "Employee",
      leaveBalance: emp?.leaveBalance || { vacation: 0, sick: 0, casual: 0 },
    }));

  const filteredEmployees = employees.filter((emp: any) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && emp.status === "active") ||
      (filterStatus === "inactive" && emp.status === "inactive");

    const matchesDepartment =
      filterDepartment === "all" || emp.department === filterDepartment;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const handleViewDetails = (employee: any) => {
    setSelectedEmployee(employee);
    setEditableEmployee({ ...employee });
    setResetPasswordValue("");
    setDetailsDialogOpen(true);
  };

  const handleBulkAction = (action: string) => {
    toast.success(`Bulk ${action} action initiated`);
  };

  const apiBaseUrl = import.meta.env.VITE_API_URL?.trim();
  const uploadEndpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/+$/, "")}/api/upload-employee-document`
    : "/api/upload-employee-document";

  const uploadDocument = async (file: File, docType: "cnic_front" | "cnic_back" | "offer_letter") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docType", docType);
    const response = await fetch(uploadEndpoint, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Failed to upload document");
    }
    const payload = await response.json();
    return payload.url as string;
  };

  const handleCreateEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.employeeId || !newEmployee.password || !newEmployee.department || !newEmployee.position) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsCreating(true);
    try {
      const uploads: Array<Promise<string>> = [];
      const uploadMap: Array<"cnic_front" | "cnic_back" | "offer_letter"> = [];
      if (cnicFrontFile) {
        uploads.push(uploadDocument(cnicFrontFile, "cnic_front"));
        uploadMap.push("cnic_front");
      }
      if (cnicBackFile) {
        uploads.push(uploadDocument(cnicBackFile, "cnic_back"));
        uploadMap.push("cnic_back");
      }
      if (offerLetterFile) {
        uploads.push(uploadDocument(offerLetterFile, "offer_letter"));
        uploadMap.push("offer_letter");
      }
      const uploadResults = uploads.length ? await Promise.all(uploads) : [];
      const uploadUrls: Record<string, string> = {};
      uploadResults.forEach((url, idx) => {
        uploadUrls[uploadMap[idx]] = url;
      });

      await createEmployeeMutation.mutateAsync({
        ...newEmployee,
        cnicFrontUrl: uploadUrls.cnic_front,
        cnicBackUrl: uploadUrls.cnic_back,
        offerLetterUrl: uploadUrls.offer_letter,
      });

      toast.success("Employee added successfully");
      setAddDialogOpen(false);
      setNewEmployee({
        name: "",
        email: "",
        employeeId: "",
        password: "",
        department: "",
        position: "",
      });
      setCnicFrontFile(null);
      setCnicBackFile(null);
      setOfferLetterFile(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create employee");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!editableEmployee?.id) return;
    setIsUpdating(true);
    try {
      await updateEmployeeMutation.mutateAsync({
        id: editableEmployee.id,
        name: editableEmployee.name,
        email: editableEmployee.email,
        employeeId: editableEmployee.employeeId,
        department: editableEmployee.department,
        position: editableEmployee.position,
      });
      toast.success("Employee updated successfully");
      setDetailsDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update employee");
    } finally {
      setIsUpdating(false);
    }
  };

  const activeCount = employees.filter((emp: any) => emp.status === "active").length;
  const inactiveCount = employees.filter((emp: any) => emp.status === "inactive").length;
  const departmentCount = new Set(employees.map((emp: any) => emp.department)).size;

  return (
    <AdminLayout title="Employee Management">
      <div className="now-page">
        {/* Header */}
        <NowPageHeader
          title="Employee Management"
          subtitle="Comprehensive employee information and management system"
          actions={
            <div className="now-header-actions">
              <button type="button" className="now-btn white sm" onClick={() => handleBulkAction("export")}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Export
              </button>
              <button type="button" className="now-btn lime sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Employee
              </button>
            </div>
          }
        />

        <div className="now-stat-strip">
          <div>
            <div className="now-stat-label">Employees</div>
            <div className="now-stat-value tabular-nums">{employeesLoading ? "--" : employees.length}</div>
            <div className="now-stat-label">on the portal</div>
          </div>
          <div>
            <div className="now-stat-label">Active</div>
            <div className="now-stat-value tabular-nums">{employeesLoading ? "--" : activeCount}</div>
            <div className="now-stat-label">can sign in and work</div>
          </div>
          <div>
            <div className="now-stat-label">Inactive</div>
            <div className="now-stat-value tabular-nums">{employeesLoading ? "--" : inactiveCount}</div>
            <div className="now-stat-label">switched off</div>
          </div>
          <div>
            <div className="now-stat-label">Departments</div>
            <div className="now-stat-value tabular-nums">{employeesLoading ? "--" : departmentCount}</div>
            <div className="now-stat-label">with people in them</div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-3">
          <div className="now-overview-bar">
            <div className="now-input-wrap" style={{ minHeight: 46, flex: "1 1 260px", maxWidth: 460 }}>
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                placeholder="Search by name, ID, email, department, or skill..."
                aria-label="Search employees"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ flex: "0 1 190px", minWidth: 150 }}>
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                  <SelectItem value="past">Past Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div style={{ flex: "0 1 190px", minWidth: 150 }}>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger aria-label="Filter by department">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              label="View"
              tone="pick"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "list", label: "List View" },
                { value: "grid", label: "Grid View" },
              ]}
            />

            <div className="now-small now-muted">
              {employeesLoading ? "Loading..." : `${filteredEmployees.length} employee${filteredEmployees.length !== 1 ? "s" : ""} found`}
            </div>
          </div>
        </div>

        {/* Employee List/Grid */}
        {viewMode === "list" ? (
          <section className="now-card" aria-label="Employees">
            <div className="aa-scroll">
              <table className="aa-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="tabular-nums now-small">{employee.employeeId}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="now-avatar aa-sm" aria-hidden="true">
                            {employee.name.charAt(0)}
                          </div>
                          <span className="font-semibold">{employee.name}</span>
                        </div>
                      </td>
                      <td className="now-small">{employee.email}</td>
                      <td>{employee.department}</td>
                      <td>{employee.position}</td>
                      <td>
                        <span className={`now-pill flex w-fit items-center gap-1 ${employee.status === "active" ? "aa-ok" : ""}`}>
                          {employee.status === "active" ? (
                            <><UserCheck className="h-3 w-3" aria-hidden="true" /> Active</>
                          ) : (
                            <><UserX className="h-3 w-3" aria-hidden="true" /> Inactive</>
                          )}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="now-icon-btn ground"
                            onClick={() => handleViewDetails(employee)}
                            aria-label={`Edit ${employee.name}`}
                            title="View and edit profile"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!employeesLoading && filteredEmployees.length === 0 ? (
              <p className="now-muted py-6 text-center">No employees match these filters.</p>
            ) : null}
          </section>
        ) : (
          <>
            <div className="now-tile-grid">
              {filteredEmployees.map((employee) => (
                <section key={employee.id} className="now-card" style={{ gap: 16 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="now-avatar aa-lg" aria-hidden="true">
                        {employee.name.charAt(0)}
                      </div>
                      <div className="aa-clamp">
                        <h3 className="now-row-title">{employee.name}</h3>
                        <p className="now-row-sub tabular-nums">{employee.employeeId}</p>
                      </div>
                    </div>
                    <span className={`now-pill ${employee.status === "active" ? "aa-ok" : ""}`}>
                      {employee.status}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="aa-kv">
                      <span>Department</span>
                      <span>{employee.department}</span>
                    </div>
                    <div className="aa-kv">
                      <span>Position</span>
                      <span>{employee.position}</span>
                    </div>
                    <div className="aa-kv">
                      <span>Email</span>
                      <span className="now-small">{employee.email}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="now-btn ground sm"
                    onClick={() => handleViewDetails(employee)}
                  >
                    View Full Profile
                  </button>
                </section>
              ))}
            </div>
            {!employeesLoading && filteredEmployees.length === 0 ? (
              <div className="now-card items-center py-12 text-center">
                <p className="now-muted">No employees match these filters.</p>
              </div>
            ) : null}
          </>
        )}

        {/* Employee Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="now-avatar aa-lg" aria-hidden="true">
                  {(selectedEmployee?.name || "?").charAt(0)}
                </div>
                <div className="min-w-0 text-left">
                  <DialogTitle>
                    Employee Profile: {selectedEmployee?.name}
                  </DialogTitle>
                  <DialogDescription>
                    Comprehensive employee information and management
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {(editableEmployee || selectedEmployee) && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0 gap-4">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="overview" className="min-h-10 flex-none px-3">Overview</TabsTrigger>
                  <TabsTrigger value="employment" className="min-h-10 flex-none px-3">Employment</TabsTrigger>
                  <TabsTrigger value="financial" className="min-h-10 flex-none px-3">Financial</TabsTrigger>
                  <TabsTrigger value="performance" className="min-h-10 flex-none px-3">Performance</TabsTrigger>
                  <TabsTrigger value="documents" className="min-h-10 flex-none px-3">Documents</TabsTrigger>
                  <TabsTrigger value="compliance" className="min-h-10 flex-none px-3">Compliance</TabsTrigger>
                  <TabsTrigger value="audit" className="min-h-10 flex-none px-3">Audit Log</TabsTrigger>
                </TabsList>

                {/* 1. Overview Tab - Core Employee Information */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Personal Information</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Employee ID</Label>
                        <Input
                          value={editableEmployee?.employeeId || ""}
                          onChange={(e) =>
                            setEditableEmployee((prev: any) => ({ ...prev, employeeId: e.target.value }))
                          }
                        />
                      </div>
                      <div className="aa-field">
                        <Label>Full Name</Label>
                        <Input
                          value={editableEmployee?.name || ""}
                          onChange={(e) =>
                            setEditableEmployee((prev: any) => ({ ...prev, name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="aa-field">
                        <Label>Date of Birth</Label>
                        <Input type="date" defaultValue={selectedEmployee?.dateOfBirth} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Gender</Label>
                        <Select value={selectedEmployee?.gender}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="aa-field">
                        <Label>Marital Status</Label>
                        <Select value={selectedEmployee?.maritalStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="aa-field">
                        <Label>Nationality</Label>
                        <Input defaultValue={selectedEmployee?.nationality} onChange={() => {}} />
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Contact Information</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Work Email</Label>
                        <Input
                          value={editableEmployee?.email || ""}
                          onChange={(e) =>
                            setEditableEmployee((prev: any) => ({ ...prev, email: e.target.value }))
                          }
                        />
                      </div>
                      <div className="aa-field">
                        <Label>Personal Email</Label>
                        <Input defaultValue={selectedEmployee?.personalEmail} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Mobile Phone</Label>
                        <Input defaultValue={selectedEmployee?.mobilePhone} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Current Address</Label>
                        <Textarea defaultValue={selectedEmployee?.currentAddress} rows={2} onChange={() => {}} />
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Emergency Contact</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="aa-field">
                        <Label>Contact Name</Label>
                        <Input placeholder="Emergency contact name" />
                      </div>
                      <div className="aa-field">
                        <Label>Relationship</Label>
                        <Input placeholder="e.g., Spouse, Parent" />
                      </div>
                      <div className="aa-field">
                        <Label>Contact Number</Label>
                        <Input placeholder="+971..." />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 2. Employment Tab */}
                <TabsContent value="employment" className="space-y-4">
                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Job Information</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Job Title</Label>
                        <Input
                          value={editableEmployee?.position || ""}
                          onChange={(e) =>
                            setEditableEmployee((prev: any) => ({ ...prev, position: e.target.value }))
                          }
                        />
                      </div>
                      <div className="aa-field">
                        <Label>Department</Label>
                        <Select
                          value={editableEmployee?.department || ""}
                          onValueChange={(value) =>
                            setEditableEmployee((prev: any) => ({ ...prev, department: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Engineering">Engineering</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="aa-field">
                        <Label>Employment Status</Label>
                        <Select value={selectedEmployee?.employmentStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="intern">Intern</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="aa-field">
                        <Label>Work Location</Label>
                        <Input defaultValue={selectedEmployee?.workLocation} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Shift</Label>
                        <Input defaultValue={selectedEmployee?.shift} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Weekly Hours</Label>
                        <Input type="number" defaultValue={selectedEmployee?.weeklyHours} onChange={() => {}} />
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Key Dates</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="aa-field">
                        <Label>Joined Date</Label>
                        <Input type="date" defaultValue={selectedEmployee?.joinedDate} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Probation End Date</Label>
                        <Input type="date" />
                      </div>
                      <div className="aa-field">
                        <Label>Contract End Date</Label>
                        <Input type="date" />
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Account Access</h3>
                    <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2">
                      <div className="aa-field">
                        <Label>Reset Password</Label>
                        <Input
                          type="password"
                          placeholder="Enter new temporary password"
                          value={resetPasswordValue}
                          onChange={(e) => setResetPasswordValue(e.target.value)}
                        />
                        <p className="now-small now-muted">
                          Minimum 6 characters. Employee will use this to sign in.
                        </p>
                      </div>
                      <div className="flex items-center justify-start md:justify-end md:pb-7">
                        <button
                          type="button"
                          className="now-btn ink sm"
                          onClick={() => {
                            if (!selectedEmployee?.id) return;
                            if (resetPasswordValue.trim().length < 6) {
                              toast.error("Password must be at least 6 characters");
                              return;
                            }
                            resetPasswordMutation.mutate({
                              id: selectedEmployee.id,
                              newPassword: resetPasswordValue.trim(),
                            });
                            setResetPasswordValue("");
                          }}
                          disabled={resetPasswordMutation.isPending || resetPasswordValue.trim().length < 6}
                        >
                          {resetPasswordMutation.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          )}
                          Reset Password
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <div className="aa-sub-head">
                      <h3 className="aa-sub-title">Job History</h3>
                      <button type="button" className="now-btn ground sm">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add Entry
                      </button>
                    </div>
                    <div className="now-small now-muted">
                      No job history records found
                    </div>
                  </div>
                </TabsContent>

                {/* 3. Financial Tab */}
                <TabsContent value="financial" className="space-y-4">
                  <div className="aa-sub">
                    <h3 className="aa-sub-title">
                      <DollarSign className="h-4 w-4" aria-hidden="true" />
                      Salary Information
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Annual Salary (AED)</Label>
                        <Input type="number" defaultValue={selectedEmployee.annualSalary} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Monthly Salary (AED)</Label>
                        <Input type="number" defaultValue={selectedEmployee.monthlySalary} onChange={() => {}} />
                      </div>
                      <div className="aa-field">
                        <Label>Basic Pay</Label>
                        <Input type="number" placeholder="Basic pay component" />
                      </div>
                      <div className="aa-field">
                        <Label>Housing Allowance</Label>
                        <Input type="number" placeholder="Housing allowance" />
                      </div>
                      <div className="aa-field">
                        <Label>Transportation Allowance</Label>
                        <Input type="number" placeholder="Transportation" />
                      </div>
                      <div className="aa-field">
                        <Label>Medical Allowance</Label>
                        <Input type="number" placeholder="Medical" />
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Bank Account Details</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Bank Name</Label>
                        <Input placeholder="e.g., Emirates NBD" />
                      </div>
                      <div className="aa-field">
                        <Label>Account Number</Label>
                        <Input placeholder="Account number" />
                      </div>
                      <div className="aa-field">
                        <Label>IBAN</Label>
                        <Input placeholder="AE..." />
                      </div>
                      <div className="aa-field">
                        <Label>SWIFT Code</Label>
                        <Input placeholder="SWIFT/BIC code" />
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Tax & Benefits</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Tax ID</Label>
                        <Input placeholder="Tax identification number" />
                      </div>
                      <div className="aa-field">
                        <Label>Health Insurance</Label>
                        <Input placeholder="Insurance provider & policy" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 4. Performance Tab */}
                <TabsContent value="performance" className="space-y-4">
                  <div className="aa-sub">
                    <div className="aa-sub-head">
                      <h3 className="aa-sub-title">
                        <Award className="h-4 w-4" aria-hidden="true" />
                        Performance Reviews
                      </h3>
                      <button type="button" className="now-btn ground sm">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add Review
                      </button>
                    </div>
                    <div className="now-small now-muted">
                      No performance reviews found
                    </div>
                  </div>

                  <div className="aa-sub">
                    <div className="aa-sub-head">
                      <h3 className="aa-sub-title">Qualifications & Training</h3>
                      <button type="button" className="now-btn ground sm">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add Qualification
                      </button>
                    </div>
                    <div className="now-small now-muted">
                      No qualifications or training records found
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Leave Balance</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="now-tile" style={{ gap: 4 }}>
                        <div className="now-stat-label">Vacation Leave</div>
                        <div className="now-stat-value tabular-nums">{selectedEmployee?.leaveBalance?.vacation ?? 0} days</div>
                      </div>
                      <div className="now-tile" style={{ gap: 4 }}>
                        <div className="now-stat-label">Sick Leave</div>
                        <div className="now-stat-value tabular-nums">{selectedEmployee?.leaveBalance?.sick ?? 0} days</div>
                      </div>
                      <div className="now-tile" style={{ gap: 4 }}>
                        <div className="now-stat-label">Casual Leave</div>
                        <div className="now-stat-value tabular-nums">{selectedEmployee?.leaveBalance?.casual ?? 0} days</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 5. Documents Tab */}
                <TabsContent value="documents" className="space-y-4">
                  <div className="aa-sub">
                    <div className="aa-sub-head">
                      <h3 className="aa-sub-title">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Employee Documents
                      </h3>
                      <button type="button" className="now-btn ground sm">
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        Upload Document
                      </button>
                    </div>
                    <div>
                      <div className="now-row tight" style={{ borderTop: 0 }}>
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <div className="aa-clamp">
                            <div className="now-row-title">Offer Letter</div>
                            <div className="now-row-sub">Uploaded on Jan 15, 2024</div>
                          </div>
                        </div>
                        <button type="button" className="now-icon-btn ground" aria-label="Download Offer Letter">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="now-row tight">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <div className="aa-clamp">
                            <div className="now-row-title">Employment Contract</div>
                            <div className="now-row-sub">Uploaded on Jan 15, 2024</div>
                          </div>
                        </div>
                        <button type="button" className="now-icon-btn ground" aria-label="Download Employment Contract">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 6. Compliance Tab */}
                <TabsContent value="compliance" className="space-y-4">
                  <div className="aa-sub">
                    <h3 className="aa-sub-title">
                      <Shield className="h-4 w-4" aria-hidden="true" />
                      Background Verification
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Verification Status</Label>
                        <Select defaultValue="completed">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="aa-field">
                        <Label>Verification Date</Label>
                        <Input type="date" />
                      </div>
                      <div className="aa-field sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea placeholder="Background check notes..." rows={3} />
                      </div>
                    </div>
                  </div>

                  <div className="aa-sub">
                    <h3 className="aa-sub-title">Work Authorization</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="aa-field">
                        <Label>Work Permit Number</Label>
                        <Input placeholder="Work permit number" />
                      </div>
                      <div className="aa-field">
                        <Label>Work Permit Expiry</Label>
                        <Input type="date" />
                      </div>
                      <div className="aa-field">
                        <Label>Visa Number</Label>
                        <Input placeholder="Visa number" />
                      </div>
                      <div className="aa-field">
                        <Label>Visa Expiry Date</Label>
                        <Input type="date" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 7. Audit Log Tab */}
                <TabsContent value="audit" className="space-y-4">
                  <div className="aa-sub">
                    <h3 className="aa-sub-title">
                      <History className="h-4 w-4" aria-hidden="true" />
                      Change History
                    </h3>
                    <div className="flex flex-col gap-3">
                      <div className="now-tile" style={{ gap: 4, borderLeft: "4px solid var(--now-indigo)" }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="now-row-title">Salary Updated</span>
                          <span className="now-small now-muted">2 days ago</span>
                        </div>
                        <div className="text-sm">
                          Changed by: <span className="font-semibold">{user?.name || "Admin"}</span>
                        </div>
                        <div className="now-small now-muted">
                          Monthly salary changed from AED 14,000 to AED 15,000
                        </div>
                      </div>
                      <div className="now-tile" style={{ gap: 4, borderLeft: "4px solid var(--now-lime)" }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="now-row-title">Department Transfer</span>
                          <span className="now-small now-muted">1 week ago</span>
                        </div>
                        <div className="text-sm">
                          Changed by: <span className="font-semibold">{user?.name || "Admin"}</span>
                        </div>
                        <div className="now-small now-muted">
                          Transferred from Marketing to Engineering
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter className="gap-2">
              <button type="button" className="now-btn ground sm" onClick={() => setDetailsDialogOpen(false)}>
                Close
              </button>
              <button type="button" className="now-btn ink sm" onClick={handleSaveChanges} disabled={isUpdating}>
                {isUpdating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save Changes
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Employee Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>
                Fill in the employee details and upload required documents
              </DialogDescription>
            </DialogHeader>

            <div className="aa-sub">
              <h3 className="aa-sub-title">Employee details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="aa-field">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="John Doe"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="aa-field">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="john@rad.com"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="aa-field">
                  <Label>Employee ID *</Label>
                  <Input
                    placeholder="EMP001"
                    value={newEmployee.employeeId}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, employeeId: e.target.value }))}
                  />
                </div>
                <div className="aa-field">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="aa-field">
                  <Label>Department *</Label>
                  <Input
                    placeholder="Engineering"
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, department: e.target.value }))}
                  />
                </div>
                <div className="aa-field">
                  <Label>Designation *</Label>
                  <Input
                    placeholder="Software Developer"
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, position: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="aa-sub">
              <h3 className="aa-sub-title">Required Documents</h3>
              <div className="flex flex-col gap-3">
                <div className="aa-field">
                  <Label>CNIC Front</Label>
                  <Input type="file" onChange={(e) => setCnicFrontFile(e.target.files?.[0] || null)} />
                </div>
                <div className="aa-field">
                  <Label>CNIC Back</Label>
                  <Input type="file" onChange={(e) => setCnicBackFile(e.target.files?.[0] || null)} />
                </div>
                <div className="aa-field">
                  <Label>Job Offer Letter</Label>
                  <Input type="file" onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <button type="button" className="now-btn ground sm" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="now-btn ink sm"
                onClick={handleCreateEmployee}
                disabled={isCreating || createEmployeeMutation.isPending}
              >
                {(isCreating || createEmployeeMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Create Employee
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
