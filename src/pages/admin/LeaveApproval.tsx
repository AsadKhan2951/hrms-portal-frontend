import AdminLayout from "@/components/AdminLayout";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { NowPageHeader, Segmented } from "@/components/now/NowPage";
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
  Clock,
  Loader2,
} from "lucide-react";
import { Redirect } from "wouter";
import { isAnyHead } from "@/lib/roles";
import { toast } from "sonner";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import "./adminA.css";

const initials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase() || "?";
};

export default function LeaveApproval() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");

  const utils = trpc.useUtils();
  const { data: leaveRequests = [], isLoading } = trpc.admin.getLeaveRequests.useQuery();
  const updateLeaveMutation = trpc.admin.updateLeaveRequest.useMutation({
    onSuccess: () => {
      utils.admin.getLeaveRequests.invalidate();
    },
  });

  // Kept above the redirect so the hook order never changes between renders.
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((req: any) => (filter === "all" ? true : req.status === filter));
  }, [leaveRequests, filter]);

  if (user && !isAnyHead(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  const openActionDialog = (leave: any, action: "approve" | "reject") => {
    setSelectedLeave(leave);
    setActionType(action);
    setComments("");
    setActionDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedLeave) return;
    if (actionType === "reject" && !comments.trim()) {
      toast.error("Please add a rejection reason");
      return;
    }
    await updateLeaveMutation.mutateAsync({
      id: selectedLeave.id,
      status: actionType === "approve" ? "approved" : "rejected",
      rejectionReason: actionType === "reject" ? comments : undefined,
    });
    toast.success(`Leave request ${actionType === "approve" ? "approved" : "rejected"} successfully`);
    setActionDialogOpen(false);
    setSelectedLeave(null);
    setComments("");
  };

  const getStatusBadge = (status: string) => {
    const tone: Record<string, string> = {
      pending: "warn-soft",
      approved: "aa-ok",
      rejected: "aa-bad",
    };

    return <span className={`now-pill ${tone[status] || tone.pending}`}>{status}</span>;
  };

  const pendingCount = leaveRequests.filter((r: any) => r.status === "pending").length;
  const approvedCount = leaveRequests.filter((r: any) => r.status === "approved").length;
  const rejectedCount = leaveRequests.filter((r: any) => r.status === "rejected").length;

  return (
    <AdminLayout title="Leave Approval">
      <div className="now-page">
        <NowPageHeader
          title="Leave approval"
          subtitle={
            <>
              Review and manage employee leave requests.{" "}
              {pendingCount > 0 ? `${pendingCount} waiting for you.` : "Nothing waiting."}
            </>
          }
          actions={
            pendingCount > 0 ? (
              <div className="now-header-actions">
                <span className="now-pill risk md">{pendingCount} pending</span>
              </div>
            ) : undefined
          }
        />

        <div className="now-stat-strip">
          <div>
            <div className="now-stat-label">Pending</div>
            <div className={`now-stat-value tabular-nums${pendingCount ? " now-warn" : ""}`}>{isLoading ? "--" : pendingCount}</div>
            <div className="now-stat-label">waiting for a decision</div>
          </div>
          <div>
            <div className="now-stat-label">Approved</div>
            <div className="now-stat-value tabular-nums">{isLoading ? "--" : approvedCount}</div>
            <div className="now-stat-label">requests granted</div>
          </div>
          <div>
            <div className="now-stat-label">Rejected</div>
            <div className="now-stat-value tabular-nums">{isLoading ? "--" : rejectedCount}</div>
            <div className="now-stat-label">requests declined</div>
          </div>
          <div>
            <div className="now-stat-label">Total</div>
            <div className="now-stat-value tabular-nums">{isLoading ? "--" : leaveRequests.length}</div>
            <div className="now-stat-label">leave requests</div>
          </div>
        </div>

        <Segmented
          label="Show"
          tone="ink"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "pending", label: `Pending (${pendingCount})` },
            { value: "all", label: "All" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
        />

        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="now-card items-center py-14 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading leave requests</span>
            </div>
          ) : (
            filteredRequests.map((request: any) => {
              const days = request.startDate && request.endDate
                ? Math.floor((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                : 0;
              return (
                <section key={request.id} className="now-card" style={{ gap: 18 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="now-avatar" aria-hidden="true">
                        {initials(request.user?.name)}
                      </div>
                      <div className="aa-clamp">
                        <div className="now-row-title">{request.user?.name || "Employee"}</div>
                        <div className="now-row-sub tabular-nums">{request.user?.employeeId || "--"}</div>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <dl className="aa-facts">
                    <div>
                      <dt>Leave type</dt>
                      <dd className="capitalize">{request.leaveType}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd className="tabular-nums">{days} days</dd>
                    </div>
                    <div>
                      <dt>Start date</dt>
                      <dd className="tabular-nums">{request.startDate ? format(new Date(request.startDate), "MMM dd, yyyy") : "--"}</dd>
                    </div>
                    <div>
                      <dt>End date</dt>
                      <dd className="tabular-nums">{request.endDate ? format(new Date(request.endDate), "MMM dd, yyyy") : "--"}</dd>
                    </div>
                  </dl>

                  <div>
                    <div className="now-stat-label">Reason</div>
                    <p className="now-body-2 mt-0.5" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{request.reason}</p>
                  </div>

                  <div
                    className="flex flex-wrap items-center justify-between gap-3 pt-4"
                    style={{ borderTop: "1px solid var(--secondary)" }}
                  >
                    <div className="flex items-center gap-2 now-small now-muted">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Applied on {request.createdAt ? format(new Date(request.createdAt), "MMM dd, yyyy 'at' HH:mm") : "--"}
                    </div>

                    {request.status === "pending" && (
                      <div className="aa-row-side">
                        <button
                          type="button"
                          className="now-btn ground sm grow-sm"
                          onClick={() => openActionDialog(request, "reject")}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          Reject
                        </button>
                        <button
                          type="button"
                          className="now-btn ink sm grow-sm"
                          onClick={() => openActionDialog(request, "approve")}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              );
            })
          )}

          {!isLoading && filteredRequests.length === 0 && (
            <div className="now-card items-center py-14 text-center">
              <FileCheck className="h-10 w-10 text-muted-foreground opacity-60" aria-hidden="true" />
              <div className="now-lede">No leave requests found</div>
              <p className="now-muted">
                {filter === "pending" ? "All leave requests have been reviewed" : "Try adjusting your filter"}
              </p>
            </div>
          )}
        </div>

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
              <div className="space-y-4 py-2">
                <div className="aa-sub" style={{ gap: 10 }}>
                  <div className="aa-kv">
                    <span>Employee</span>
                    <span>{selectedLeave.user?.name || "Employee"}</span>
                  </div>
                  <div className="aa-kv">
                    <span>Leave type</span>
                    <span className="capitalize">{selectedLeave.leaveType}</span>
                  </div>
                  <div className="aa-kv">
                    <span>Duration</span>
                    <span className="tabular-nums">
                      {selectedLeave.startDate && selectedLeave.endDate
                        ? Math.floor((new Date(selectedLeave.endDate).getTime() - new Date(selectedLeave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                        : 0} days
                    </span>
                  </div>
                  <div className="aa-kv">
                    <span>Dates</span>
                    <span className="tabular-nums">
                      {selectedLeave.startDate ? format(new Date(selectedLeave.startDate), "MMM dd") : "--"} - {selectedLeave.endDate ? format(new Date(selectedLeave.endDate), "MMM dd, yyyy") : "--"}
                    </span>
                  </div>
                </div>

                <div className="aa-field">
                  <label htmlFor="leave-action-comments">
                    {actionType === "approve" ? "Comments (Optional)" : "Rejection Reason *"}
                  </label>
                  <Textarea
                    id="leave-action-comments"
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

            <DialogFooter className="gap-2">
              <button type="button" className="now-btn ground sm" onClick={() => setActionDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAction}
                className={`now-btn sm${actionType === "reject" ? "" : " ink"}`}
                style={actionType === "reject" ? { background: "var(--destructive)", color: "#fff" } : undefined}
                disabled={updateLeaveMutation.isPending}
              >
                {updateLeaveMutation.isPending ? "Saving..." : actionType === "approve" ? "Approve Leave" : "Reject Leave"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
