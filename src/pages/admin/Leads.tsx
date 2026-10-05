import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import AdminLayout from "@/components/AdminLayout";
import { Segmented } from "@/components/now/NowPage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  teamSize: string;
  plan: string;
  source: string;
  status: "new" | "contacted" | "closed";
  note: string;
  createdAt: Date;
};

/** One CSV cell. Quoted, and never allowed to start a spreadsheet formula. */
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Sign-ups from the website's landing page, newest first. */
export default function Leads() {
  const utils = trpc.useUtils();
  const { data = [], isLoading, isError } = trpc.leads.list.useQuery(undefined, { refetchInterval: 60000 });
  const [filter, setFilter] = useState<"new" | "contacted" | "closed" | "all">("new");

  const update = trpc.leads.update.useMutation({
    onSuccess: () => utils.leads.list.invalidate(),
    onError: (error: any) => toast.error(error.message || "Could not update the sign-up"),
  });

  const leads = data as Lead[];
  const rows = useMemo(() => leads.filter(lead => filter === "all" || lead.status === filter), [leads, filter]);
  const count = (status: Lead["status"]) => leads.filter(lead => lead.status === status).length;

  const download = () => {
    const header = ["Received", "Name", "Company", "Email", "Team size", "Plan", "Status", "Note"];
    const lines = leads.map(lead =>
      [format(new Date(lead.createdAt), "yyyy-MM-dd HH:mm"), lead.name, lead.company, lead.email, lead.teamSize, lead.plan, lead.status, lead.note]
        .map(value => cell(String(value ?? "")))
        .join(",")
    );
    // The BOM makes Excel read names with accents correctly.
    const blob = new Blob(["﻿" + [header.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `now-sign-ups-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Sign-ups">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1>Sign-ups</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              People who filled in the form on nowhrms.com. {count("new")} new, {leads.length} in total.
            </p>
          </div>
          <Button variant="outline" onClick={download} disabled={leads.length === 0}>
            Download CSV
          </Button>
        </div>

        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "new", label: `New (${count("new")})` },
            { value: "contacted", label: "Contacted" },
            { value: "closed", label: "Closed" },
            { value: "all", label: "All" },
          ]}
        />

        <section className="now-card flush" style={{ paddingTop: 8 }}>
          {isError ? (
            <div className="now-row now-warn" style={{ borderTop: 0 }}>
              Could not load sign-ups. Refresh to try again.
            </div>
          ) : isLoading ? (
            <div className="now-row now-muted" style={{ borderTop: 0 }}>
              Loading...
            </div>
          ) : rows.length === 0 ? (
            <div className="now-row now-muted" style={{ borderTop: 0 }}>
              {leads.length === 0 ? "No sign-ups yet." : "Nothing here."}
            </div>
          ) : (
            rows.map((lead, index) => (
              <div key={lead.id} className="now-row wrap" style={{ padding: "16px 0", borderTop: index === 0 ? 0 : undefined }}>
                <div style={{ flex: "2 1 260px", minWidth: 0 }}>
                  <div className="now-row-title">
                    {lead.name} · {lead.company}
                  </div>
                  <div className="now-row-sub">
                    <a href={`mailto:${lead.email}`} className="now-link" style={{ fontSize: 13 }}>
                      {lead.email}
                    </a>
                  </div>
                </div>
                <div className="now-muted" style={{ flex: "1 1 140px", fontSize: 14 }}>
                  {[lead.plan, lead.teamSize].filter(Boolean).join(" · ") || "No plan chosen"}
                </div>
                <div className="now-muted tabular-nums" style={{ flex: "0 1 130px", fontSize: 13 }}>
                  {format(new Date(lead.createdAt), "d MMM, HH:mm")}
                </div>
                <div style={{ flex: "0 0 150px" }}>
                  <Select
                    value={lead.status}
                    onValueChange={status => update.mutate({ id: lead.id, status })}
                    disabled={update.isPending}
                  >
                    <SelectTrigger aria-label={`Status of ${lead.name}'s sign-up`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
