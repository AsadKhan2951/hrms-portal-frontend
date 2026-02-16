import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileCheck, 
  Check, 
  X, 
  Calendar,
  User,
  Clock,
  MessageSquare
} from "lucide-react";
import { Redirect } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

// Dummy data - will be replaced with real data from tRPC
const dummyLeaveRequests = [
  {
    id: 1,
    employeeName: "Hassan",
    employeeId: "EMP001",
    leaveType: "Annual Leave",
    startDate: new Date("2026-03-01"),
    endDate: new Date("2026-03-05"),
    days: 5,
    reason: "Family vacation",
    status: "pending",
    appliedAt: new Date("2026-02-10"),
  },
  {
    id: 2,
    employeeName: "Talha",
    employeeId: "EMP002",
    leaveType: "Sick Leave",
    startDate: new Date("2026-02-20"),
    endDate: new Date("2026-02-22"),
    days: 3,
    reason: "Medical appointment and recovery",
    status: "pending",
    appliedAt: new Date("2026-02-12"),
  },
];

export default function LeaveApproval() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");

  // Check if user is admin
  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const filteredRequests = dummyLeaveRequests.filter((req) => {
    if (filter === "all") return true;
    return req.status === filter;
  });

  const openActionDialog = (leave: any, action: "approve" | "reject") => {
    setSelectedLeave(leave);
    setActionType(action);
    setComments("");
    setActionDialogOpen(true);
  };

  const handleAction = () => {
    // TODO: Implement with tRPC mutation
    toast.success(`Leave request ${actionType === "approve" ? "approved" : "rejected"} successfully`);
    setActionDialogOpen(false);
    setSelectedLeave(null);
    setComments("");
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive", className: string }> = {
      pending: { variant: "secondary", className: "bg-yellow-500/10 text-yellow-600" },
      approved: { variant: "default", className: "bg-green-500/10 text-green-600" },
      rejected: { variant: "destructive", className: "bg-red-500/10 text-red-600" },
    };

    const { variant, className } = config[status] || config.pending;

    return (
      <Badge variant={variant} className={className}>
        {status}
      </Badge>
    );
  };

  const pendingCount = dummyLeaveRequests.filter(r => r.status === "pending").length;

  return (
    <AdminLayout title="Leave Approval">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck className="h-6 w-6" />
            Leave Approval
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount} pending
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage employee leave requests
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("pending")}
        >
          Pending ({pendingCount})
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "approved" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("approved")}
        >
          Approved
        </Button>
        <Button
          variant={filter === "rejected" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("rejected")}
        >
          Rejected
        </Button>
      </div>

      {/* Leave Requests List */}
      <div className="grid gap-4">
        {filteredRequests.map((request) => (
          <Card key={request.id} className="p-6">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{request.employeeName}</h3>
                    <p className="text-sm text-muted-foreground">{request.employeeId}</p>
                  </div>
                </div>
                {getStatusBadge(request.status)}
              </div>

              {/* Leave Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Leave Type</p>
                  <p className="font-medium">{request.leaveType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="font-medium">{request.days} days</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                  <p className="font-medium">{format(request.startDate, "MMM dd, yyyy")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">End Date</p>
                  <p className="font-medium">{format(request.endDate, "MMM dd, yyyy")}</p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm">{request.reason}</p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Applied on {format(request.appliedAt, "MMM dd, yyyy 'at' HH:mm")}
                </div>

                {request.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openActionDialog(request, "reject")}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openActionDialog(request, "approve")}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}

        {filteredRequests.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leave requests found</p>
              <p className="text-sm mt-1">
                {filter === "pending" 
                  ? "All leave requests have been reviewed" 
                  : "Try adjusting your filter"}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" 
                ? "Confirm approval of this leave request" 
                : "Provide a reason for rejecting this leave request"}
            </DialogDescription>
          </DialogHeader>

          {selectedLeave && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Employee:</span>
                  <span className="text-sm">{selectedLeave.employeeName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Leave Type:</span>
                  <span className="text-sm">{selectedLeave.leaveType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Duration:</span>
                  <span className="text-sm">{selectedLeave.days} days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Dates:</span>
                  <span className="text-sm">
                    {format(selectedLeave.startDate, "MMM dd")} - {format(selectedLeave.endDate, "MMM dd, yyyy")}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {actionType === "approve" ? "Comments (Optional)" : "Rejection Reason *"}
                </label>
                <Textarea
                  placeholder={actionType === "approve" 
                    ? "Add any comments or notes..." 
                    : "Explain why this request is being rejected..."}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              className={actionType === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {actionType === "approve" ? "Approve Leave" : "Reject Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
