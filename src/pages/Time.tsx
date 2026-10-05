import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { format } from "date-fns";
import NowPage, { WingmanBanner } from "@/components/now/NowPage";
import { CorrectionDialog, LeaveDialog, OvertimeDialog, WorkSessionDialog } from "@/components/now/RequestDialogs";
import { requestStatusColor, useMyRequests } from "@/components/now/useMyRequests";
import { trpc } from "@/lib/trpc";

/** A "yyyy-MM-dd" key as a local date, so it formats as the day it names. */
const keyDate = (key: string) => new Date(`${key}T00:00:00`);
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type Day = { date: string; kind: string; hours: number | null; timeIn: string | null; timeOut: string | null; note: string };

/**
 * Time: attendance and leave on one page. The last four weeks day by day, what
 * needs fixing, how much leave is left, and what is still waiting on someone.
 */
export default function Time() {
  const search = useSearch();
  const fourWeeks = trpc.time.getFourWeeks.useQuery();
  const balance = trpc.time.getLeaveBalance.useQuery();
  const { rows: myRequests } = useMyRequests();

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [fixDate, setFixDate] = useState<string | null>(null);

  // Wingman and Home link straight to a form: /attendance?overtime=1, ?leave=1, ?fix=2026-09-24.
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.has("overtime")) setOvertimeOpen(true);
    if (params.has("leave")) setLeaveOpen(true);
    const fix = params.get("fix");
    if (fix && /^\d{4}-\d{2}-\d{2}$/.test(fix)) setFixDate(fix);
  }, [search]);

  const days = (fourWeeks.data?.days ?? []) as Day[];
  const stats = fourWeeks.data?.stats;
  const toFix = (fourWeeks.data?.toFix ?? []) as { date: string; reason: string }[];

  // Monday to Friday make the grid; a worked weekend is listed underneath.
  const { weekdays, weekends } = useMemo(() => {
    const isWeekend = (key: string) => [0, 6].includes(keyDate(key).getDay());
    return { weekdays: days.filter(d => !isWeekend(d.date)), weekends: days.filter(d => isWeekend(d.date)) };
  }, [days]);

  // A correction already sent for a day means that day is in hand.
  const pendingFixes = myRequests.filter(r => r.type === "Attendance" && r.open).length;

  return (
    <NowPage title="Time" subtitle="Attendance and leave · last four weeks">
      {toFix.length > 0 && (
        <WingmanBanner
          action={
            <button type="button" className="now-btn indigo sm" onClick={() => setFixDate(toFix[0].date)}>
              Send a correction
            </button>
          }
        >
          {toFix.length === 1 ? "One record needs fixing" : `${toFix.length} records need fixing`}:{" "}
          {toFix.map(d => `${format(keyDate(d.date), "d MMMM")} (${d.reason.toLowerCase()})`).join(", ")}.
          {pendingFixes > 0
            ? ` You have ${pendingFixes} ${pendingFixes === 1 ? "correction" : "corrections"} waiting for approval.`
            : " Until it is corrected, payroll cannot count the day."}
        </WingmanBanner>
      )}

      <section className="now-stat-strip" aria-label="Last four weeks">
        <div>
          <div className="now-stat-label">Days present</div>
          <div className="now-stat-value">{stats ? `${stats.daysPresent} of ${stats.workingDays}` : "--"}</div>
        </div>
        <div>
          <div className="now-stat-label">Average day</div>
          <div className="now-stat-value">{stats ? `${stats.averageHours} h` : "--"}</div>
        </div>
        <div>
          <div className="now-stat-label">Late arrivals</div>
          <div className="now-stat-value">{stats ? stats.lateArrivals : "--"}</div>
        </div>
        <div>
          <div className="now-stat-label">Early outs</div>
          <div className="now-stat-value">{stats ? stats.earlyOuts : "--"}</div>
        </div>
        <div>
          <div className="now-stat-label">Overtime</div>
          <div className="now-stat-value">{stats ? `${stats.overtimeHours} h` : "--"}</div>
        </div>
      </section>

      <div className="now-cols">
        <section className="now-card now-col-main" style={{ gap: 16 }}>
          <div className="now-card-head" style={{ flexWrap: "wrap" }}>
            <h2 className="now-h2">Day by day</h2>
            <div className="now-small now-muted">Hours worked. Notes mark late days, leave and records to fix.</div>
          </div>

          {fourWeeks.isLoading ? (
            <div className="now-muted">Loading your attendance...</div>
          ) : fourWeeks.isError ? (
            <div className="now-warn">Could not load your attendance. Refresh to try again.</div>
          ) : (
            <>
              <div className="now-day-grid">
                {weekdays.map(day => {
                  const label = format(keyDate(day.date), "EEE d MMM");
                  const body = (
                    <>
                      <div>{label}</div>
                      <div>
                        <div className="hrs">
                          {day.kind === "leave" ? "Leave" : day.hours === null ? "--" : day.hours.toFixed(1)}
                        </div>
                        <div className="note">{day.note}</div>
                      </div>
                    </>
                  );
                  // Days with a problem open the correction form for that date.
                  return day.kind === "fix" || day.kind === "absent" ? (
                    <button
                      key={day.date}
                      type="button"
                      className={`now-day ${day.kind}`}
                      onClick={() => setFixDate(day.date)}
                      aria-label={`${label}: ${day.note}. Send a correction`}
                    >
                      {body}
                    </button>
                  ) : (
                    <div key={day.date} className={`now-day ${day.kind}`}>
                      {body}
                    </div>
                  );
                })}
              </div>
              {weekends.length > 0 && (
                <div className="now-small now-muted">
                  Weekend work:{" "}
                  {weekends
                    .map(d => `${format(keyDate(d.date), "EEE d MMM")} · ${d.hours === null ? d.note : `${d.hours.toFixed(1)} h`}`)
                    .join(", ")}
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
            <button type="button" className="now-link" onClick={() => setSessionOpen(true)}>
              Add a work session
            </button>
            <button type="button" className="now-link" onClick={() => setFixDate(format(new Date(), "yyyy-MM-dd"))}>
              Correct a day
            </button>
            <Link href="/attendance/log" className="now-link">
              Full attendance log
            </Link>
          </div>
        </section>

        <div className="now-col-side">
          <section className="now-card">
            <h2 className="now-h2">Leave left</h2>
            {(balance.data?.rows ?? []).map((row: any) => (
              <div key={row.type}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{cap(row.type)}</span>
                  <span style={{ fontWeight: 600 }}>
                    {row.left} of {row.quota}
                  </span>
                </div>
                <div className="now-bar" style={{ marginTop: 6 }}>
                  <span style={{ width: `${row.quota > 0 ? Math.round((row.left / row.quota) * 100) : 0}%` }} />
                </div>
                {row.pending > 0 && (
                  <div className="now-small now-muted" style={{ marginTop: 4 }}>
                    {row.pending} {row.pending === 1 ? "day" : "days"} waiting for approval
                  </div>
                )}
              </div>
            ))}
            {balance.isError && <div className="now-warn">Could not load your leave balance.</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" className="now-btn ink md grow" onClick={() => setLeaveOpen(true)}>
                Apply for leave
              </button>
              <button type="button" className="now-btn ground md grow" onClick={() => setOvertimeOpen(true)}>
                Add overtime
              </button>
            </div>
          </section>

          <section className="now-card">
            <div className="now-card-head">
              <h2 className="now-h2">My requests</h2>
              <Link href="/requests" className="now-link">
                All
              </Link>
            </div>
            {myRequests.length === 0 ? (
              <div className="now-muted">Nothing requested yet.</div>
            ) : (
              myRequests.slice(0, 4).map(row => (
                <div key={row.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="now-row-title">{row.title}</div>
                    <div className="now-row-sub">{row.detail}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: requestStatusColor(row.tone) }}>{row.status}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <LeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
      <OvertimeDialog open={overtimeOpen} onOpenChange={setOvertimeOpen} />
      <WorkSessionDialog open={sessionOpen} onOpenChange={setSessionOpen} />
      <CorrectionDialog open={fixDate !== null} onOpenChange={open => !open && setFixDate(null)} defaultDate={fixDate ?? undefined} />
    </NowPage>
  );
}
