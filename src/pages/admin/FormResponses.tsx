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
  MessageSquareText,
  Eye,
  CheckCircle2,
  Clock,
  User,
  Loader2,
} from "lucide-react";
import { Redirect } from "wouter";
import { isOrgWide } from "@/lib/roles";
import { toast } from "sonner";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import "./adminB.css";

export default function FormResponses() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "resolved">("pending");
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState("");

  const utils = trpc.useUtils();
  const { data: formSubmissions = [], isLoading } = trpc.admin.getFormSubmissions.useQuery();
  const updateFormMutation = trpc.admin.updateFormSubmission.useMutation({
    onSuccess: () => utils.admin.getFormSubmissions.invalidate(),
  });

  const statusMap: Record<string, "pending" | "reviewed" | "resolved"> = {
    submitted: "pending",
    under_review: "reviewed",
    resolved: "resolved",
    closed: "resolved",
  };

  const filteredForms = useMemo(() => {
    return formSubmissions.filter((form: any) => {
      if (filter === "all") return true;
      return statusMap[form.status] === filter;
    });
  }, [formSubmissions, filter]);

  // Checked after every hook has run so the hook order never changes.
  if (user && !isOrgWide(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  const openViewDialog = (form: any) => {
    setSelectedForm(form);
    setResponseText(form.response || "");
    setViewDialogOpen(true);
  };

  const handleRespond = async (status: "reviewed" | "resolved") => {
    if (!selectedForm) return;
    const mappedStatus = status === "reviewed" ? "under_review" : "resolved";
    await updateFormMutation.mutateAsync({
      id: selectedForm.id,
      status: mappedStatus,
      response: responseText,
    });
    toast.success(`Form marked as ${status} successfully`);
    setViewDialogOpen(false);
    setSelectedForm(null);
    setResponseText("");
  };

  const getStatusBadge = (status: string) => {
    const normalized = statusMap[status] || "pending";
    const config: Record<string, string> = {
      pending: "now-pill warn-soft",
      reviewed: "now-pill nb-info-soft",
      resolved: "now-pill nb-ok-soft",
    };

    return (
      <span className={config[normalized] || config.pending}>
        {normalized}
      </span>
    );
  };

  const pendingCount = formSubmissions.filter((f: any) => statusMap[f.status] === "pending").length;

  return (
    <AdminLayout title="Form Responses">
      <div className="now-page">
        <NowPageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              Form responses
              {pendingCount > 0 && (
                <span className="now-pill risk md" style={{ fontFamily: "var(--font-body)", letterSpacing: 0 }}>
                  {pendingCount} pending
                </span>
              )}
            </span>
          }
          subtitle="Review and respond to employee form submissions"
        />

        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "pending", label: `Pending (${pendingCount})` },
            { value: "all", label: "All" },
            { value: "reviewed", label: "Reviewed" },
            { value: "resolved", label: "Resolved" },
          ]}
        />

        <section className="now-card flush" style={{ paddingTop: 8 }} aria-label="Form submissions">
          {isLoading ? (
            <div className="now-row now-muted" style={{ borderTop: 0 }}>
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading...
              </span>
            </div>
          ) : (
            filteredForms.map((form: any, index: number) => (
              <article
                key={form.id}
                className="now-row wrap"
                style={{ padding: "16px 0", alignItems: "flex-start", borderTop: index === 0 ? 0 : undefined }}
              >
                <div style={{ flex: "2 1 300px", minWidth: 0 }}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="now-pill nb-plain">{form.formType}</span>
                    {getStatusBadge(form.status)}
                  </div>
                  <div className="now-row-title">{form.subject}</div>
                  <div className="now-row-sub flex items-center gap-1.5">
                    <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {form.user?.name || "Employee"} · {form.user?.employeeId || "--"}
                  </div>
                  <p className="now-body-2 mt-1.5 line-clamp-2">
                    {form.content}
                  </p>
                  <div className="now-row-sub mt-1.5 flex items-center gap-1.5">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Submitted on {form.createdAt ? format(new Date(form.createdAt), "MMM dd, yyyy 'at' HH:mm") : "--"}
                  </div>
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  <button
                    type="button"
                    className="now-btn sm ground"
                    onClick={() => openViewDialog(form)}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    View & Respond
                  </button>
                </div>
              </article>
            ))
          )}

          {!isLoading && filteredForms.length === 0 && (
            <div className="now-row" style={{ borderTop: 0, justifyContent: "center", padding: "40px 0 48px" }}>
              <div className="text-center">
                <MessageSquareText className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" aria-hidden="true" />
                <p className="now-lede">No form submissions found</p>
                <p className="now-muted mt-1 text-sm">
                  {filter === "pending" ? "All forms have been reviewed" : "Try adjusting your filter"}
                </p>
              </div>
            </div>
          )}
        </section>

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Form Submission Details</DialogTitle>
              <DialogDescription>
                Review and respond to this form submission
              </DialogDescription>
            </DialogHeader>

            {selectedForm && (
              <div className="flex flex-col gap-4 py-2">
                <div className="nb-well nb-kv">
                  <div>
                    <span>Employee</span>
                    <span>{selectedForm.user?.name || "Employee"} ({selectedForm.user?.employeeId || "--"})</span>
                  </div>
                  <div>
                    <span>Form Type</span>
                    <span className="now-pill nb-plain" style={{ background: "var(--card)" }}>{selectedForm.formType}</span>
                  </div>
                  <div>
                    <span>Status</span>
                    {getStatusBadge(selectedForm.status)}
                  </div>
                  <div>
                    <span>Submitted</span>
                    <span>
                      {selectedForm.createdAt ? format(new Date(selectedForm.createdAt), "MMM dd, yyyy 'at' HH:mm") : "--"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="nb-label">Subject</span>
                  <div className="nb-well">
                    <p className="text-sm font-semibold">{selectedForm.subject}</p>
                  </div>
                </div>

                <div>
                  <span className="nb-label">Message</span>
                  <div className="nb-well">
                    <p className="text-sm whitespace-pre-wrap break-words">{selectedForm.content}</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="form-response" className="nb-label">Your Response</label>
                  <Textarea
                    id="form-response"
                    placeholder="Add your response or action taken..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2">
              <button type="button" className="now-btn sm ground" onClick={() => setViewDialogOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="now-btn sm tint"
                onClick={() => handleRespond("reviewed")}
                disabled={updateFormMutation.isPending}
              >
                Mark as Reviewed
              </button>
              <button
                type="button"
                className="now-btn sm ink"
                onClick={() => handleRespond("resolved")}
                disabled={updateFormMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {updateFormMutation.isPending ? "Saving..." : "Mark as Resolved"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
