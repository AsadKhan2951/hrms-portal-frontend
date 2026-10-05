import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { Segmented } from "@/components/now/NowPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type Decision = "approved" | "rejected" | "resolved";
type Row = {
  id: string;
  kind: "attendance_correction" | "support_ticket";
  subject: string;
  details: string;
  workDate: Date | null;
  requestedTimeIn: Date | null;
  requestedTimeOut: Date | null;
  category: string | null;
  status: "pending" | "approved" | "rejected" | "resolved";
  reviewNote: string;
  appliedToAttendance: boolean;
  createdAt: Date;
  user: { id: string; name: string; employeeId: string; department: string } | null;
};

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Attendance corrections and support tickets sent to the person signed in.
 * Approving a correction writes the corrected times onto that day's record.
 */
export default function RequestsReview() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data = [], isLoading, isError } = trpc.requests.getForReview.useQuery();
  const [filter, setFilter] = useState<"pending" | "closed" | "all">("pending");
  const [deciding, setDeciding] = useState<{ row: Row; status: Decision } | null>(null);
  const [note, setNote] = useState("");

  const review = trpc.requests.review.useMutation({
    onSuccess: (result: any) => {
      toast.success(
        deciding?.status === "approved"
          ? result.appliedToAttendance
            ? "Approved. The attendance record has been corrected."
            : "Approved. Nothing could be written to attendance: the request did not give both times for a day with no record."
          : deciding?.status === "resolved"
            ? "Ticket resolved"
            : "Rejected"
      );
      setDeciding(null);
      setNote("");
      utils.requests.getForReview.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not save your decision"),
  });

  const rows = (data as Row[]).filter(row =>
    filter === "all" ? true : filter === "pending" ? row.status === "pending" : row.status !== "pending"
  );
  const pending = (data as Row[]).filter(row => row.status === "pending").length;

  return (
    <AdminLayout title="Requests">
      <div className="space-y-6">
        <div>
          <h1>Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attendance corrections and support tickets sent to you. {pending > 0 ? `${pending} waiting.` : "Nothing waiting."}
          </p>
        </div>

        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "pending", label: "Waiting" },
            { value: "closed", label: "Closed" },
            { value: "all", label: "All" },
          ]}
        />

        <section className="now-card flush" style={{ paddingTop: 8 }}>
          {isError ? (
            <div className="now-row now-warn" style={{ borderTop: 0 }}>
              Could not load requests. Refresh to try again.
            </div>
          ) : isLoading ? (
            <div className="now-row now-muted" style={{ borderTop: 0 }}>
              Loading...
            </div>
          ) : rows.length === 0 ? (
            <div className="now-row now-muted" style={{ borderTop: 0 }}>
              {filter === "pending" ? "No requests are waiting for you." : "Nothing here."}
            </div>
          ) : (
            rows.map((row, index) => {
              const own = row.user?.id === String(user?.id ?? "");
              return (
                <div key={row.id} className="now-row wrap" style={{ padding: "16px 0", borderTop: index === 0 ? 0 : undefined, alignItems: "flex-start" }}>
                  <div style={{ flex: "2 1 300px", minWidth: 0 }}>
                    <div className="now-row-title">{row.subject}</div>
                    <div className="now-row-sub">
                      {row.user ? `${row.user.name}${row.user.employeeId ? ` · ${row.user.employeeId}` : ""}${row.user.department ? ` · ${row.user.department}` : ""}` : "Unknown employee"}
                      {" · sent "}
                      {format(new Date(row.createdAt), "d MMM, HH:mm")}
                    </div>
                    {row.kind === "attendance_correction" && row.workDate && (
                      <div className="now-small" style={{ marginTop: 6 }}>
                        {format(new Date(row.workDate), "EEEE d MMMM")}:{" "}
                        {row.requestedTimeIn ? `in at ${format(new Date(row.requestedTimeIn), "HH:mm")}` : "clock-in unchanged"},{" "}
                        {row.requestedTimeOut ? `out at ${format(new Date(row.requestedTimeOut), "HH:mm")}` : "clock-out unchanged"}
                      </div>
                    )}
                    {row.details && (
                      <div className="now-body-2" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {row.details}
                      </div>
                    )}
                    {row.reviewNote && (
                      <div className="now-small now-muted" style={{ marginTop: 6 }}>
                        Reviewer note: {row.reviewNote}
                      </div>
                    )}
                  </div>
                  <div className="now-muted" style={{ flex: "0 1 140px", fontSize: 14 }}>
                    {row.kind === "support_ticket" ? `Ticket${row.category ? ` · ${cap(row.category)}` : ""}` : "Attendance"}
                  </div>
                  <div style={{ flex: "0 0 auto", display: "flex", gap: 8, alignItems: "center" }}>
                    {row.status !== "pending" ? (
                      <span style={{ fontSize: 14, fontWeight: 700, color: row.status === "rejected" ? "var(--now-warn)" : undefined }}>
                        {cap(row.status)}
                      </span>
                    ) : own ? (
                      <span className="now-small now-muted">Your own request</span>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => setDeciding({ row, status: row.kind === "support_ticket" ? "resolved" : "approved" })}>
                          {row.kind === "support_ticket" ? "Resolve" : "Approve"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeciding({ row, status: "rejected" })}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      <Dialog open={deciding !== null} onOpenChange={open => !open && setDeciding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deciding?.status === "approved" ? "Approve correction" : deciding?.status === "resolved" ? "Resolve ticket" : "Reject request"}
            </DialogTitle>
            <DialogDescription>
              {deciding?.status === "approved"
                ? "The times in this request will replace the ones on that day's attendance record."
                : deciding?.row.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="review-note">Note to the employee{deciding?.status === "rejected" ? "" : " (optional)"}</Label>
              <Textarea id="review-note" value={note} onChange={e => setNote(e.target.value)} className="min-h-[90px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeciding(null)} disabled={review.isPending}>
                Cancel
              </Button>
              <Button
                disabled={review.isPending || (deciding?.status === "rejected" && !note.trim())}
                onClick={() => deciding && review.mutate({ id: deciding.row.id, status: deciding.status, note: note.trim() || undefined })}
              >
                {review.isPending ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
