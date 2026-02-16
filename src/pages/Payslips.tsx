import { Card } from "@/components/ui/card";
import LayoutWrapper from "@/components/LayoutWrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";

// Dummy payslip data
const dummyPayslips = [
  {
    id: 1,
    month: "January 2026",
    date: new Date("2026-01-31"),
    basicSalary: 50000,
    allowances: 10000,
    deductions: 5000,
    netSalary: 55000,
    status: "paid",
  },
  {
    id: 2,
    month: "December 2025",
    date: new Date("2025-12-31"),
    basicSalary: 50000,
    allowances: 10000,
    deductions: 5000,
    netSalary: 55000,
    status: "paid",
  },
  {
    id: 3,
    month: "November 2025",
    date: new Date("2025-11-30"),
    basicSalary: 50000,
    allowances: 8000,
    deductions: 4500,
    netSalary: 53500,
    status: "paid",
  },
];

export default function Payslips() {
  const latestPayslip = dummyPayslips[0];

  const handleDownload = (payslipId: number) => {
    // Placeholder for download functionality
    console.log(`Downloading payslip ${payslipId}`);
  };

  return (
    <LayoutWrapper>
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Payslips</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and download your salary payslips
        </p>
      </div>

      {/* Latest Payslip Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Basic Salary</p>
              <p className="text-xl font-bold">PKR {latestPayslip.basicSalary.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Allowances</p>
              <p className="text-xl font-bold">PKR {latestPayslip.allowances.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deductions</p>
              <p className="text-xl font-bold">PKR {latestPayslip.deductions.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs opacity-90">Net Salary</p>
              <p className="text-xl font-bold">PKR {latestPayslip.netSalary.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payslip History */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Payslip History</h2>
        </div>

        <div className="p-4">
          <div className="space-y-3">
            {dummyPayslips.map((payslip) => (
              <Card key={payslip.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{payslip.month}</h3>
                      <p className="text-sm text-muted-foreground">
                        Paid on {format(payslip.date, "MMMM dd, yyyy")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Net Salary</p>
                      <p className="text-xl font-bold">
                        PKR {payslip.netSalary.toLocaleString()}
                      </p>
                    </div>

                    <Badge variant="default" className="capitalize">
                      {payslip.status}
                    </Badge>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(payslip.id)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Basic Salary</p>
                    <p className="font-semibold">PKR {payslip.basicSalary.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Allowances</p>
                    <p className="font-semibold text-green-600">
                      + PKR {payslip.allowances.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deductions</p>
                    <p className="font-semibold text-red-600">
                      - PKR {payslip.deductions.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>
    </div>
    </LayoutWrapper>
  );
}
