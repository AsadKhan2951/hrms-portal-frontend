import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { format } from "date-fns";
import NowPage, { Segmented, WingmanBanner } from "@/components/now/NowPage";
import {
  CorrectionDialog,
  FormDialog,
  LeaveDialog,
  OvertimeDialog,
  TicketDialog,
  type FormKind,
} from "@/components/now/RequestDialogs";
import { requestStatusColor, useMyRequests } from "@/components/now/useMyRequests";

type Kind = "leave" | "overtime" | "correction" | "ticket" | FormKind;

const TYPES: { kind: Kind; name: string; desc: string }[] = [
  { kind: "leave", name: "Leave", desc: "Annual, casual or sick, full or half day" },
  { kind: "overtime", name: "Overtime", desc: "Log extra hours for today or yesterday" },
  { kind: "correction", name: "Attendance correction", desc: "Fix a missing clock in or out" },
  { kind: "ticket", name: "Support ticket", desc: "IT, equipment or portal problems" },
  { kind: "grievance", name: "Grievance", desc: "Report a workplace issue in confidence" },
  { kind: "feedback", name: "Feedback", desc: "Share an idea or suggestion" },
];

/** Requests: every kind of request starts here, and every one made is listed here. */
export default function Requests() {
  const search = useSearch();
  const { rows, isLoading, isError } = useMyRequests();
  const [open, setOpen] = useState<Kind | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const close = (isOpen: boolean) => !isOpen && setOpen(null);

  // /requests?new=ticket opens that form, so other pages can link to one.
  useEffect(() => {
    const wanted = new URLSearchParams(search).get("new");
    if (wanted && [...TYPES.map(t => t.kind), "resignation"].includes(wanted as Kind)) setOpen(wanted as Kind);
  }, [search]);

  const shown = rows.filter(row => (filter === "all" ? true : filter === "open" ? row.open : !row.open));

  return (
    <NowPage title="Requests" subtitle="Leave, overtime, corrections, tickets and forms in one place">
      <WingmanBanner
        action={
          <Link href="/wingman" className="now-btn indigo sm">
            Ask Wingman
          </Link>
        }
      >
        Skip the form. Tell Wingman what you need, and it fills the request for you to approve.
      </WingmanBanner>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="now-h2">Start a request</h2>
        <div className="now-tile-grid">
          {TYPES.map(type => (
            <button key={type.kind} type="button" className="now-tile-btn" onClick={() => setOpen(type.kind)}>
              <strong>{type.name}</strong>
              <span>{type.desc}</span>
            </button>
          ))}
        </div>
        <div className="now-body-2">
          Leaving the company?{" "}
          <button type="button" className="now-link" onClick={() => setOpen("resignation")}>
            Start a resignation
          </button>
        </div>
      </section>

      <section className="now-card flush">
        <div className="now-card-head" style={{ flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <h2 className="now-h2">My requests</h2>
          <Segmented
            label="Show"
            tone="soft"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
            ]}
          />
        </div>
        {isError && <div className="now-row now-warn">Some of your requests could not be loaded. Refresh to try again.</div>}
        {isLoading ? (
          <div className="now-row now-muted">Loading your requests...</div>
        ) : shown.length === 0 ? (
          <div className="now-row now-muted">
            {filter === "all" ? "You have not made any requests yet." : `No ${filter} requests.`}
          </div>
        ) : (
          shown.map(row => (
            <div key={row.key} className="now-row wrap" style={{ padding: "16px 0" }}>
              <div style={{ flex: "2 1 240px", minWidth: 0 }}>
                <div className="now-row-title">{row.title}</div>
                <div className="now-row-sub">{row.detail}</div>
              </div>
              <div className="now-muted" style={{ flex: "1 1 120px", fontSize: 14 }}>
                {row.type}
              </div>
              <div className="now-muted" style={{ flex: "1 1 120px", fontSize: 14 }}>
                {format(row.when, "d MMM")}
              </div>
              <div style={{ flex: "0 0 96px", textAlign: "right", fontSize: 14, fontWeight: 700, color: requestStatusColor(row.tone) }}>
                {row.status}
              </div>
            </div>
          ))
        )}
      </section>

      <LeaveDialog open={open === "leave"} onOpenChange={close} />
      <OvertimeDialog open={open === "overtime"} onOpenChange={close} />
      <CorrectionDialog open={open === "correction"} onOpenChange={close} />
      <TicketDialog open={open === "ticket"} onOpenChange={close} />
      {(["grievance", "feedback", "resignation"] as FormKind[]).map(kind => (
        <FormDialog key={kind} kind={kind} open={open === kind} onOpenChange={close} />
      ))}
    </NowPage>
  );
}
