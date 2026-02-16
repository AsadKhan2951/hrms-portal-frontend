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
  MessageSquareText, 
  Eye, 
  CheckCircle2,
  Clock,
  User
} from "lucide-react";
import { Redirect } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

// Dummy data - will be replaced with real data from tRPC
const dummyForms = [
  {
    id: 1,
    employeeName: "Hassan",
    employeeId: "EMP001",
    formType: "IT Support Request",
    subject: "Laptop Performance Issue",
    message: "My laptop has been running very slow lately. It takes a long time to boot up and applications are freezing frequently. Could IT help diagnose and fix this issue?",
    status: "pending",
    submittedAt: new Date("2026-02-13T10:30:00"),
  },
  {
    id: 2,
    employeeName: "Talha",
    employeeId: "EMP002",
    formType: "Facility Request",
    subject: "Additional Monitor Request",
    message: "I would like to request an additional monitor for my workstation to improve productivity. Currently working with a single screen makes multitasking difficult.",
    status: "pending",
    submittedAt: new Date("2026-02-12T14:20:00"),
  },
];

export default function FormResponses() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "resolved">("pending");
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState("");

  // Check if user is admin
  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const filteredForms = dummyForms.filter((form) => {
    if (filter === "all") return true;
    return form.status === filter;
  });

  const openViewDialog = (form: any) => {
    setSelectedForm(form);
    setResponseText("");
    setViewDialogOpen(true);
  };

  const handleRespond = (status: "reviewed" | "resolved") => {
    // TODO: Implement with tRPC mutation
    toast.success(`Form marked as ${status} successfully`);
    setViewDialogOpen(false);
    setSelectedForm(null);
    setResponseText("");
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive", className: string }> = {
      pending: { variant: "secondary", className: "bg-yellow-500/10 text-yellow-600" },
      reviewed: { variant: "default", className: "bg-blue-500/10 text-blue-600" },
      resolved: { variant: "default", className: "bg-green-500/10 text-green-600" },
    };

    const { variant, className } = config[status] || config.pending;

    return (
      <Badge variant={variant} className={className}>
        {status}
      </Badge>
    );
  };

  const pendingCount = dummyForms.filter(f => f.status === "pending").length;

  return (
    <AdminLayout title="Form Responses">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquareText className="h-6 w-6" />
            Form Responses
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount} pending
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and respond to employee form submissions
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
          variant={filter === "reviewed" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("reviewed")}
        >
          Reviewed
        </Button>
        <Button
          variant={filter === "resolved" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("resolved")}
        >
          Resolved
        </Button>
      </div>

      {/* Forms List */}
      <div className="grid gap-4">
        {filteredForms.map((form) => (
          <Card key={form.id} className="p-6">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{form.employeeName}</h3>
                    <p className="text-sm text-muted-foreground">{form.employeeId}</p>
                  </div>
                </div>
                {getStatusBadge(form.status)}
              </div>

              {/* Form Details */}
              <div>
                <Badge variant="outline" className="mb-2">
                  {form.formType}
                </Badge>
                <h4 className="font-semibold mb-2">{form.subject}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {form.message}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Submitted on {format(form.submittedAt, "MMM dd, yyyy 'at' HH:mm")}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openViewDialog(form)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View & Respond
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredForms.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <MessageSquareText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No form submissions found</p>
              <p className="text-sm mt-1">
                {filter === "pending" 
                  ? "All forms have been reviewed" 
                  : "Try adjusting your filter"}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* View & Respond Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Form Submission Details</DialogTitle>
            <DialogDescription>
              Review and respond to this form submission
            </DialogDescription>
          </DialogHeader>

          {selectedForm && (
            <div className="space-y-4 py-4">
              {/* Form Info */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Employee:</span>
                  <span className="text-sm">{selectedForm.employeeName} ({selectedForm.employeeId})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Form Type:</span>
                  <Badge variant="outline">{selectedForm.formType}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(selectedForm.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Submitted:</span>
                  <span className="text-sm">{format(selectedForm.submittedAt, "MMM dd, yyyy 'at' HH:mm")}</span>
                </div>
              </div>

              {/* Subject & Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{selectedForm.subject}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedForm.message}</p>
                </div>
              </div>

              {/* Response */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Response</label>
                <Textarea
                  placeholder="Add your response or action taken..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => handleRespond("reviewed")}
            >
              Mark as Reviewed
            </Button>
            <Button
              onClick={() => handleRespond("resolved")}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
