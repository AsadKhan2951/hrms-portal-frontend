import AdminLayout from "@/components/AdminLayout";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { NowPageHeader } from "@/components/now/NowPage";
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
  Upload,
  FileText,
  Download,
  Loader2,
  Check,
  Trash2,
} from "lucide-react";
import { Redirect } from "wouter";
import { isOrgWide, isStaff } from "@/lib/roles";
import { toast } from "sonner";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { apiUrl, fileUrl } from "@/lib/api";
import "./adminA.css";

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
  // Department heads and the head of operations draw payslips too; the old
  // role === "user" test dropped them once they became their own roles.
  const employees = employeeData.filter((emp: any) => isStaff(emp?.role));
  const { data: payslips = [], isLoading: payslipsLoading } = trpc.admin.getPayslips.useQuery();

  const createPayslipMutation = trpc.admin.createPayslip.useMutation();
  const setPaidMutation = trpc.admin.setPayslipPaid.useMutation();
  const deleteMutation = trpc.admin.deletePayslip.useMutation();
  const [pendingPaidId, setPendingPaidId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  /**
   * Deleting is for a payslip issued to the wrong person, so it removes it from
   * that employee's portal as well. There is no undo, hence the confirmation
   * naming who it belongs to - the whole point is that the wrong name was
   * picked once already.
   */
  const deletePayslip = async (payslip: any) => {
    const who = payslip.user?.name || "this employee";
    const period = payslip.month && payslip.year
      ? new Date(payslip.year, payslip.month - 1).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        })
      : "this period";

    const confirmed = window.confirm(
      `Delete the ${period} payslip for ${who}?\n\n` +
        `It will disappear from their portal too, along with the notification ` +
        `about it. This cannot be undone.`
    );
    if (!confirmed) return;

    setPendingDeleteId(payslip.id);
    try {
      await deleteMutation.mutateAsync({ payslipId: payslip.id });
      await utils.admin.getPayslips.invalidate();
      toast.success(`Deleted. It is no longer on ${who}'s portal.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete the payslip"
      );
    } finally {
      setPendingDeleteId(null);
    }
  };

  // Kept above the redirect so the hook order never changes between renders.
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

  if (user && !isOrgWide(user.role)) {
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

  const paidCount = payslips.filter((payslip: any) => payslip.paidAt).length;
  const unpaidCount = payslips.length - paidCount;

  return (
    <AdminLayout title="Payslip Management">
      <div className="now-page">
        <NowPageHeader
          title="Payslips"
          subtitle="Upload and manage employee payslips"
          actions={
            <div className="now-header-actions">
              <button type="button" className="now-btn white sm" onClick={() => setBulkUploadDialogOpen(true)}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Bulk Upload
              </button>
              <button type="button" className="now-btn lime sm" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload Payslip
              </button>
            </div>
          }
        />

        <div className="now-stat-strip">
          <div>
            <div className="now-stat-label">Total payslips</div>
            <div className="now-stat-value tabular-nums">{payslipsLoading ? "--" : payslips.length}</div>
            <div className="now-stat-label">issued so far</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="now-stat-label">Latest month</div>
            <div className="now-stat-value truncate">{latestMonth}</div>
            <div className="now-stat-label">most recent payslip</div>
          </div>
          <div>
            <div className="now-stat-label">Employees</div>
            <div className="now-stat-value tabular-nums">{employeesLoading ? "--" : employees.length}</div>
            <div className="now-stat-label">on the payroll</div>
          </div>
          <div>
            <div className="now-stat-label">Not paid yet</div>
            <div className={`now-stat-value tabular-nums${!payslipsLoading && unpaidCount ? " now-warn" : ""}`}>
              {payslipsLoading ? "--" : unpaidCount}
            </div>
            <div className="now-stat-label">{payslipsLoading ? "" : `${paidCount} marked as paid`}</div>
          </div>
        </div>

        <section className="now-card flush" aria-labelledby="payslips-recent">
          <div className="now-card-head" style={{ marginBottom: 8 }}>
            <h2 className="now-h2" id="payslips-recent">Recent Payslips</h2>
            {!payslipsLoading && payslips.length > 0 ? (
              <span className="now-pill">{payslips.length}</span>
            ) : null}
          </div>
          {payslipsLoading ? (
            <div className="now-row now-muted" style={{ borderTop: 0 }}>
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading payslips...
              </span>
            </div>
          ) : payslips.length === 0 ? (
            <div className="now-row now-muted justify-center py-10" style={{ borderTop: 0 }}>
              No payslips found
            </div>
          ) : (
            payslips.map((payslip: any, index: number) => {
              const docHref = fileUrl(payslip.documentUrl);
              return (
                <div
                  key={payslip.id}
                  className="now-row wrap"
                  style={{ padding: "16px 0", borderTop: index === 0 ? 0 : undefined }}
                >
                  <div className="aa-row-main" style={{ alignItems: "center" }}>
                    <div className="now-icon-btn ground" aria-hidden="true" style={{ cursor: "default" }}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="aa-clamp">
                      <div className="now-row-title">{payslip.user?.name || "Employee"}</div>
                      <div className="now-row-sub">
                        <span className="tabular-nums">{payslip.user?.employeeId || "--"}</span> &bull; {payslip.month && payslip.year ? format(new Date(payslip.year, payslip.month - 1, 1), "MMMM yyyy") : "--"}
                      </div>
                    </div>
                  </div>

                  <div className="aa-row-side" style={{ gap: 12 }}>
                    <div style={{ minWidth: 110 }}>
                      <div className="font-bold tabular-nums">PKR {Number(payslip.netSalary || 0).toLocaleString()}</div>
                      <div className="now-row-sub tabular-nums">
                        {payslip.createdAt ? format(new Date(payslip.createdAt), "MMM dd, yyyy") : "--"}
                      </div>
                    </div>

                    {payslip.paidAt ? (
                      <span className="now-pill aa-ok aa-plain">
                        Paid {format(new Date(payslip.paidAt), "MMM dd")}
                      </span>
                    ) : (
                      <span className="now-pill warn-soft">Pending</span>
                    )}

                    <div className="flex items-center gap-2" style={{ marginLeft: "auto" }}>
                      <button
                        type="button"
                        className={`now-btn sm ${payslip.paidAt ? "text" : "ink"}`}
                        disabled={pendingPaidId === payslip.id}
                        onClick={() => togglePaid(payslip)}
                      >
                        {pendingPaidId === payslip.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : payslip.paidAt ? (
                          "Mark unpaid"
                        ) : (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Mark as paid
                          </>
                        )}
                      </button>

                      {docHref ? (
                        <a
                          className="now-icon-btn ground"
                          href={docHref as string}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Download payslip PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="now-icon-btn ground"
                          disabled
                          title="No file attached"
                          aria-label="No file attached"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        className="now-icon-btn ground"
                        style={{ color: "var(--destructive)" }}
                        onClick={() => deletePayslip(payslip)}
                        disabled={pendingDeleteId === payslip.id}
                        aria-label="Delete payslip"
                        title="Delete this payslip, on the employee's side too"
                      >
                        {pendingDeleteId === payslip.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Payslip</DialogTitle>
              <DialogDescription>
                Upload a payslip for a specific employee
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="aa-field">
                <Label htmlFor="employee">Employee *</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger id="employee">
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
                <div className="aa-field">
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

                <div className="aa-field">
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

              <div className="aa-field">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="aa-field">
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

                <div className="aa-field">
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

              <div className="aa-sub" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
                <span className="now-small now-muted">Net Salary</span>
                <span className={`now-lede tabular-nums${netSalaryPreview < 0 ? " now-warn" : ""}`}>
                  PKR {netSalaryPreview.toLocaleString()}
                </span>
              </div>

              <div className="aa-field">
                <Label htmlFor="file">Payslip File (PDF)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="now-small now-muted">
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
              <p className="-mt-2 now-small now-muted">
                Unchecked payslips show as &quot;pending&quot; on the employee&apos;s
                portal.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <button
                type="button"
                className="now-btn ground sm"
                onClick={() => setUploadDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button type="button" className="now-btn ink sm" onClick={handleUploadPayslip} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  "Issue Payslip"
                )}
              </button>
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

            <div className="aa-sub now-body-2">
              <p>
                Bulk upload needs server-side ZIP extraction, which is not
                implemented yet. Nothing was being saved before, so the button
                has been left here as a placeholder rather than silently
                reporting success.
              </p>
              <p>
                For now, issue payslips one employee at a time with{" "}
                <span className="font-semibold text-foreground">Upload Payslip</span>.
              </p>
            </div>

            <DialogFooter>
              <button type="button" className="now-btn ground sm" onClick={() => setBulkUploadDialogOpen(false)}>
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
