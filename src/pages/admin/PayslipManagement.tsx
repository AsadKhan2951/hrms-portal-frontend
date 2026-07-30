import AdminLayout from "@/components/AdminLayout";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DollarSign,
  Upload,
  Calendar,
  User,
  FileText,
  Download,
  Loader2,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Redirect } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { apiUrl, fileUrl } from "@/lib/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayslipManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const now = new Date();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [allowances, setAllowances] = useState("");
  const [deductions, setDeductions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [markPaid, setMarkPaid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: employeeData = [], isLoading: employeesLoading } = trpc.employees.list.useQuery();
  const employees = employeeData.filter((emp: any) => emp?.role === "user");
  const { data: payslips = [], isLoading: payslipsLoading } = trpc.admin.getPayslips.useQuery();

  const createPayslipMutation = trpc.admin.createPayslip.useMutation();
  const setPaidMutation = trpc.admin.setPayslipPaid.useMutation();
  const [pendingPaidId, setPendingPaidId] = useState<string | null>(null);

  const togglePaid = async (payslip: any) => {
    const nowPaid = !payslip.paidAt;
    setPendingPaidId(payslip.id);
    try {
      await setPaidMutation.mutateAsync({ payslipId: payslip.id, paid: nowPaid });
      await utils.admin.getPayslips.invalidate();
      const who = payslip.user?.name || "employee";
      toast.success(
        nowPaid
          ? `Marked as paid. ${who} has been notified.`
          : `Marked as pending again for ${who}.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update payment status"
      );
    } finally {
      setPendingPaidId(null);
    }
  };

  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Mirrors the server-side calculation in backend/payroll.ts. The server value
  // is authoritative; this is only a preview for the admin.
  const netSalaryPreview =
    toNumber(basicSalary) + toNumber(allowances) - toNumber(deductions);

  const uploadPayslipFile = async (pdf: File) => {
    const formData = new FormData();
    formData.append("file", pdf);
    formData.append("docType", "payslip");

    const response = await fetch(apiUrl("/api/upload-employee-document"), {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Failed to upload payslip file");
    }

    const payload = await response.json();
    return payload.url as string;
  };

  const handleUploadPayslip = async () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }
    if (!basicSalary.trim()) {
      toast.error("Please enter the basic salary");
      return;
    }
    if (toNumber(basicSalary) <= 0) {
      toast.error("Basic salary must be greater than zero");
      return;
    }
    if (netSalaryPreview < 0) {
      toast.error("Deductions cannot exceed basic salary plus allowances");
      return;
    }

    setIsSaving(true);
    try {
      // The PDF is optional — the payslip figures are what the employee's
      // portal renders, so a missing file must not block issuing it.
      const documentUrl = file ? await uploadPayslipFile(file) : undefined;

      const result = await createPayslipMutation.mutateAsync({
        userId: selectedEmployee,
        month: Number(selectedMonth),
        year: Number(selectedYear),
        basicSalary: toNumber(basicSalary),
        allowances: toNumber(allowances),
        deductions: toNumber(deductions),
        documentUrl,
        markPaid,
      });

      await utils.admin.getPayslips.invalidate();

      const employeeName =
        employees.find((emp: any) => emp.id === selectedEmployee)?.name || "employee";

      toast.success(
        result.wasReplaced
          ? `Payslip updated for ${employeeName}. They have been notified.`
          : `Payslip issued to ${employeeName}. They have been notified.`
      );

      setUploadDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save payslip");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedMonth(String(now.getMonth() + 1));
    setSelectedYear(String(now.getFullYear()));
    setBasicSalary("");
    setAllowances("");
    setDeductions("");
    setFile(null);
    setMarkPaid(true);
  };

  const years = useMemo(() => {
    const current = now.getFullYear();
    return [current + 1, current, current - 1, current - 2].map(String);
  }, [now]);

  const latestMonth = useMemo(() => {
    if (!payslips.length) return "-";
    const latest = payslips[0];
    if (latest.month && latest.year) {
      const date = new Date(latest.year, latest.month - 1, 1);
      return format(date, "MMMM yyyy");
    }
    return "-";
  }, [payslips]);

  return (
    <AdminLayout title="Payslip Management">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Payslip Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload and manage employee payslips
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Payslip
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{payslipsLoading ? "--" : payslips.length}</h3>
            <p className="text-sm text-muted-foreground">Total Payslips</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Calendar className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{latestMonth}</h3>
            <p className="text-sm text-muted-foreground">Latest Month</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <User className="h-6 w-6 text-purple-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">
              {employeesLoading ? "--" : employees.length}
            </h3>
            <p className="text-sm text-muted-foreground">Employees</p>
          </Card>
        </div>

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Payslips</h2>
            <div className="space-y-3">
              {payslipsLoading ? (
                <div className="text-center text-muted-foreground">Loading payslips...</div>
              ) : payslips.length === 0 ? (
                <div className="text-center text-muted-foreground">No payslips found</div>
              ) : (
                payslips.map((payslip: any) => (
                  <div key={payslip.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-background rounded-lg">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{payslip.user?.name || "Employee"}</p>
                        <p className="text-sm text-muted-foreground">
                          {payslip.user?.employeeId || "--"} &bull; {payslip.month && payslip.year ? format(new Date(payslip.year, payslip.month - 1, 1), "MMMM yyyy") : "--"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">PKR {Number(payslip.netSalary || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {payslip.createdAt ? format(new Date(payslip.createdAt), "MMM dd, yyyy") : "--"}
                        </p>
                      </div>

                      {payslip.paidAt ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10">
                          Paid {format(new Date(payslip.paidAt), "MMM dd")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/40">
                          Pending
                        </Badge>
                      )}

                      <Button
                        variant={payslip.paidAt ? "ghost" : "default"}
                        size="sm"
                        disabled={pendingPaidId === payslip.id}
                        onClick={() => togglePaid(payslip)}
                      >
                        {pendingPaidId === payslip.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : payslip.paidAt ? (
                          "Mark unpaid"
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Mark as paid
                          </>
                        )}
                      </Button>

                      {fileUrl(payslip.documentUrl) ? (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={fileUrl(payslip.documentUrl) as string}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Download payslip PDF"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled title="No file attached">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Payslip</DialogTitle>
              <DialogDescription>
                Upload a payslip for a specific employee
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading employees...
                      </SelectItem>
                    ) : employees.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No employees found
                      </SelectItem>
                    ) : (
                      employees.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeId || "N/A"})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Month *</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={month} value={String(index + 1)}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger id="year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="basicSalary">Basic Salary (PKR) *</Label>
                <Input
                  id="basicSalary"
                  type="number"
                  min="0"
                  placeholder="80000"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="allowances">Allowances (PKR)</Label>
                  <Input
                    id="allowances"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={allowances}
                    onChange={(e) => setAllowances(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deductions">Deductions (PKR)</Label>
                  <Input
                    id="deductions"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">Net Salary</span>
                <span className="text-lg font-bold">
                  PKR {netSalaryPreview.toLocaleString()}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Payslip File (PDF)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. The employee sees the salary breakdown either way.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="markPaid"
                  checked={markPaid}
                  onCheckedChange={(checked) => setMarkPaid(checked === true)}
                />
                <Label htmlFor="markPaid" className="font-normal">
                  Mark as paid
                </Label>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Unchecked payslips show as &quot;pending&quot; on the employee&apos;s
                portal.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleUploadPayslip} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Issue Payslip"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Upload Payslips</DialogTitle>
              <DialogDescription>
                Not available yet
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 text-sm text-muted-foreground space-y-2">
              <p>
                Bulk upload needs server-side ZIP extraction, which is not
                implemented yet. Nothing was being saved before, so the button
                has been left here as a placeholder rather than silently
                reporting success.
              </p>
              <p>
                For now, issue payslips one employee at a time with{" "}
                <span className="font-medium text-foreground">Upload Payslip</span>.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
