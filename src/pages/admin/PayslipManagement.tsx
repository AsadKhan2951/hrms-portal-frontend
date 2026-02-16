import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Download
} from "lucide-react";
import { Redirect } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

// Dummy data - will be replaced with real data from tRPC
const dummyPayslips = [
  {
    id: 1,
    employeeName: "Hassan",
    employeeId: "EMP001",
    month: "January 2026",
    amount: 5000,
    uploadedAt: new Date("2026-02-01"),
  },
  {
    id: 2,
    employeeName: "Talha",
    employeeId: "EMP002",
    month: "January 2026",
    amount: 4500,
    uploadedAt: new Date("2026-02-01"),
  },
];

const dummyEmployees = [
  { id: 1, employeeId: "EMP001", name: "Hassan" },
  { id: 2, employeeId: "EMP002", name: "Talha" },
];

export default function PayslipManagement() {
  const { user } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Check if user is admin
  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const handleUploadPayslip = () => {
    if (!selectedEmployee || !selectedMonth || !amount || !file) {
      toast.error("Please fill all fields and select a file");
      return;
    }
    // TODO: Implement with tRPC mutation
    toast.success("Payslip uploaded successfully");
    setUploadDialogOpen(false);
    resetForm();
  };

  const handleBulkUpload = () => {
    if (!selectedMonth || !file) {
      toast.error("Please select month and upload a file");
      return;
    }
    // TODO: Implement with tRPC mutation
    toast.success("Bulk payslips uploaded successfully");
    setBulkUploadDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedMonth("");
    setAmount("");
    setFile(null);
  };

  const months = [
    "January 2026", "February 2026", "March 2026", "April 2026",
    "May 2026", "June 2026", "July 2026", "August 2026",
    "September 2026", "October 2026", "November 2026", "December 2026"
  ];

  return (
    <AdminLayout title="Payslip Management">
      <div className="space-y-6">
      {/* Header */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-1">{dummyPayslips.length}</h3>
          <p className="text-sm text-muted-foreground">Total Payslips</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Calendar className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-1">January 2026</h3>
          <p className="text-sm text-muted-foreground">Latest Month</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <User className="h-6 w-6 text-purple-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-1">{dummyEmployees.length}</h3>
          <p className="text-sm text-muted-foreground">Employees</p>
        </Card>
      </div>

      {/* Payslips List */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Payslips</h2>
          <div className="space-y-3">
            {dummyPayslips.map((payslip) => (
              <div key={payslip.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-background rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{payslip.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {payslip.employeeId} • {payslip.month}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">${payslip.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(payslip.uploadedAt, "MMM dd, yyyy")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Upload Single Payslip Dialog */}
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
                  {dummyEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.employeeId}>
                      {emp.name} ({emp.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month *</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
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

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Payslip File (PDF) *</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadPayslip}>
              Upload Payslip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Payslips</DialogTitle>
            <DialogDescription>
              Upload multiple payslips at once using a ZIP file
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-month">Month *</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
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

            <div className="space-y-2">
              <Label htmlFor="bulk-file">ZIP File *</Label>
              <Input
                id="bulk-file"
                type="file"
                accept=".zip"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Upload a ZIP file containing PDF payslips named with employee IDs (e.g., EMP001.pdf)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpload}>
              Upload Payslips
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
