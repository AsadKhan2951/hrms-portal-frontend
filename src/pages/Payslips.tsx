import { useMemo, useState } from "react";
import { Link } from "wouter";
import { addMonths, format } from "date-fns";
import NowPage, { WingmanMark } from "@/components/now/NowPage";
import { fileUrl } from "@/lib/api";
import { trpc } from "@/lib/trpc";

const money = (value: unknown) => Number(value || 0).toLocaleString();
const periodOf = (payslip: any) =>
  payslip?.month && payslip?.year ? format(new Date(payslip.year, payslip.month - 1, 1), "MMMM yyyy") : "Payslip";

/**
 * The next payday, taken from the day of the month the last payslip was paid.
 * Null when nothing has been paid yet, because then there is no pattern to
 * read a date from.
 */
function nextPayday(payslips: any[], now: Date): Date | null {
  const lastPaid = payslips.find(p => p.paidAt);
  if (!lastPaid) return null;
  let next = addMonths(new Date(lastPaid.paidAt), 1);
  for (let guard = 0; next < now && guard < 24; guard += 1) next = addMonths(next, 1);
  return next;
}

/** Pay: the latest payslip with amounts hidden until asked for, then the history. */
export default function Payslips() {
  const { data: payslips = [], isLoading, isError } = trpc.dashboard.getPayslips.useQuery();
  const fourWeeks = trpc.time.getFourWeeks.useQuery();
  const [shown, setShown] = useState(false);

  const now = useMemo(() => new Date(), []);
  const monthRange = useMemo(() => ({ startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: now }), [now]);
  const overtime = trpc.timeTracking.getOvertimeByRange.useQuery(monthRange);
  const leaves = trpc.leaves.getMyLeaves.useQuery();

  const latest = (payslips as any[])[0];
  const latestPdf = fileUrl(latest?.documentUrl);
  const amount = (value: unknown) => (shown ? money(value) : "••••••");
  const payday = nextPayday(payslips as any[], now);
  const toFix = (fourWeeks.data?.toFix ?? []) as { date: string; reason: string }[];

  const overtimeHours = ((overtime.data ?? []) as any[]).reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  // Approved leave days that fall in the current month.
  const leaveDays = useMemo(() => {
    let total = 0;
    for (const leave of (leaves.data ?? []) as any[]) {
      if (leave.status !== "approved") continue;
      const end = new Date(leave.endDate);
      for (let day = new Date(leave.startDate), guard = 0; day <= end && guard < 366; day.setDate(day.getDate() + 1), guard += 1) {
        if (day.getMonth() === now.getMonth() && day.getFullYear() === now.getFullYear()) total += 1;
      }
    }
    return total;
  }, [leaves.data, now]);

  return (
    <NowPage title="Pay" subtitle="Payslips and what goes into them">
      <div className="now-cols">
        <div className="now-col-main">
          <section className="now-card roomy" style={{ gap: 20 }}>
            {isLoading ? (
              <div className="now-muted">Loading your payslips...</div>
            ) : isError ? (
              <div className="now-warn">Could not load your payslips. Refresh to try again.</div>
            ) : !latest ? (
              <div>
                <div className="now-lede">No payslip yet</div>
                <div className="now-muted" style={{ marginTop: 6 }}>
                  Your first payslip appears here when HR issues it.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div className="now-small now-muted">
                      Latest payslip · {periodOf(latest)} ·{" "}
                      {latest.paidAt ? `paid ${format(new Date(latest.paidAt), "d MMMM")}` : "not paid yet"}
                    </div>
                    <div
                      style={{ marginTop: 6, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 44, lineHeight: 1, letterSpacing: "-0.03em" }}
                      aria-live="polite"
                    >
                      PKR {amount(latest.netSalary)}
                    </div>
                    <div className="now-body-2" style={{ marginTop: 6 }}>
                      {shown ? "Net pay." : "Net pay. Amounts stay hidden until you choose to show them."}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className="now-btn ground md" aria-pressed={shown} onClick={() => setShown(value => !value)}>
                      {shown ? "Hide amounts" : "Show amounts"}
                    </button>
                    {latestPdf ? (
                      <a className="now-btn ink md" href={latestPdf} target="_blank" rel="noreferrer">
                        Download PDF
                      </a>
                    ) : (
                      <button type="button" className="now-btn ink md" disabled title="No PDF is attached to this payslip">
                        Download PDF
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 40px" }}>
                  <div>
                    <div className="now-small now-muted" style={{ paddingBottom: 8 }}>
                      Earnings
                    </div>
                    <div className="now-row tight">
                      <span>Basic salary</span>
                      <span className="tabular-nums">{amount(latest.basicSalary)}</span>
                    </div>
                    <div className="now-row tight">
                      <span>Allowances</span>
                      <span className="tabular-nums">{amount(latest.allowances)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="now-small now-muted" style={{ paddingBottom: 8 }}>
                      Deductions
                    </div>
                    <div className="now-row tight">
                      <span>Total deductions</span>
                      <span className="tabular-nums">{amount(latest.deductions)}</span>
                    </div>
                    <div className="now-row tight">
                      <span>Days present</span>
                      <span className="tabular-nums">
                        {latest.presentDays || 0} of {latest.workingDays || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="now-card flush">
            <h2 className="now-h2" style={{ marginBottom: 8 }}>
              History
            </h2>
            {(payslips as any[]).length === 0 ? (
              <div className="now-row now-muted">{isLoading ? "Loading..." : "No payslips yet."}</div>
            ) : (
              (payslips as any[]).map(payslip => {
                const pdf = fileUrl(payslip.documentUrl);
                return (
                  <div key={payslip.id} className="now-row tight">
                    <div style={{ minWidth: 0 }}>
                      <div className="now-row-title">{periodOf(payslip)}</div>
                      <div className="now-row-sub">
                        {payslip.paidAt ? `Paid ${format(new Date(payslip.paidAt), "d MMMM")}` : "Not paid yet"}
                        {payslip.workingDays ? ` · ${payslip.workingDays} working days` : ""}
                        {shown ? ` · PKR ${money(payslip.netSalary)}` : ""}
                      </div>
                    </div>
                    {pdf ? (
                      <a className="now-btn text sm" href={pdf} target="_blank" rel="noreferrer" aria-label={`Download ${periodOf(payslip)} payslip`}>
                        Download
                      </a>
                    ) : (
                      <span className="now-small now-muted" style={{ padding: "0 12px" }}>
                        No PDF
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </div>

        <div className="now-col-side">
          {toFix.length > 0 && (
            <section className="now-card tinted">
              <div className="now-eyebrow">
                <WingmanMark size={16} className="text-[var(--now-indigo)]" />
                <span>Wingman · {format(now, "MMMM")} pay</span>
              </div>
              <div className="now-lede">
                {toFix.length === 1 ? "One open day could come off your pay." : `${toFix.length} open days could come off your pay.`}
              </div>
              <div className="now-body-2">
                {toFix.map(d => format(new Date(`${d.date}T00:00:00`), "d MMMM")).join(", ")}{" "}
                {toFix.length === 1 ? "has" : "have"} no usable clock-out. Payroll cannot count a day until it is corrected.
              </div>
              <Link href={`/attendance?fix=${toFix[0].date}`} className="now-btn indigo sm" style={{ alignSelf: "flex-start" }}>
                Fix it now
              </Link>
            </section>
          )}

          <section className="now-card" style={{ gap: 12 }}>
            <h2 className="now-h2">Next payday</h2>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, lineHeight: 1.1 }}>
              {payday ? format(payday, "d MMMM") : "Not set yet"}
            </div>
            {payday ? (
              <div className="now-small now-muted">Based on when your last payslip was paid.</div>
            ) : (
              <div className="now-small now-muted">It shows here once a payslip has been marked paid.</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--secondary)" }}>
              <span className="now-muted">Overtime this month</span>
              <span style={{ fontWeight: 600 }}>{Math.round(overtimeHours * 10) / 10} h</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="now-muted">Leave taken this month</span>
              <span style={{ fontWeight: 600 }}>
                {leaveDays} {leaveDays === 1 ? "day" : "days"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="now-muted">Days to fix</span>
              <span style={{ fontWeight: 600, color: toFix.length ? "var(--now-warn)" : undefined }}>{toFix.length}</span>
            </div>
          </section>
        </div>
      </div>
    </NowPage>
  );
}
