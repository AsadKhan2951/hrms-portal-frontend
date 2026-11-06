import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { STATUS_LABELS, TASK_STAGES } from "@/pages/fpb/shared";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "numeric",
  }).formatToParts(new Date());
  return {
    month: Number(parts.find(p => p.type === "month")?.value ?? new Date().getMonth() + 1),
    year: Number(parts.find(p => p.type === "year")?.value ?? new Date().getFullYear()),
  };
}

/**
 * The owner's department view: for each department, how much work it holds
 * and where that work sits, what is late or nobody has picked up, how much it
 * finished this month (on time, and how fast), and how active it has been.
 * A department opens its activity log.
 */
export function DepartmentKpis() {
  const [period, setPeriod] = useState(currentMonth);
  const [openDept, setOpenDept] = useState<{ id: string; name: string } | null>(null);
  const { data, isLoading, isError } = trpc.fpb.getDepartmentKpis.useQuery(period);
  const kpis = (data ?? []) as any[];

  const shift = (delta: number) =>
    setPeriod(p => {
      const index = p.year * 12 + (p.month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  const now = currentMonth();
  const atCurrent = period.year === now.year && period.month === now.month;

  const sum = (key: string) => kpis.reduce((n, k) => n + (k[key] ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="now-icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-[150px] text-center font-bold">
          {MONTHS[period.month - 1]} {period.year}
        </div>
        <button type="button" className="now-icon-btn" aria-label="Next month" disabled={atCurrent} onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="now-row-sub ml-2">
          Completed figures are for this month; open work is as of now. A task shared by two departments counts for each.
        </span>
      </div>

      {isLoading ? (
        <div className="now-card items-center py-14 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading department KPIs
        </div>
      ) : isError ? (
        <div className="now-card py-10 now-warn">Could not load the department KPIs. Refresh to try again.</div>
      ) : kpis.length === 0 ? (
        <div className="now-card items-center py-14 text-center">
          <div className="now-lede">No departments yet</div>
          <p className="now-muted">Add departments under Organisation, then send tasks to them from the board.</p>
        </div>
      ) : (
        <>
          <div className="now-stat-strip">
            <div>
              <div className="now-stat-label">Open tasks</div>
              <div className="now-stat-value">{sum("openTasks")}</div>
              <div className="now-stat-label">across {kpis.length} departments</div>
            </div>
            <div>
              <div className="now-stat-label">Not assigned yet</div>
              <div className={`now-stat-value${sum("unassignedTasks") ? " now-warn" : ""}`}>{sum("unassignedTasks")}</div>
              <div className="now-stat-label">waiting for a head</div>
            </div>
            <div>
              <div className="now-stat-label">Overdue</div>
              <div className={`now-stat-value${sum("overdueTasks") ? " now-warn" : ""}`}>{sum("overdueTasks")}</div>
              <div className="now-stat-label">past their due date</div>
            </div>
            <div>
              <div className="now-stat-label">Completed</div>
              <div className="now-stat-value">{sum("completedInPeriod")}</div>
              <div className="now-stat-label">in {MONTHS[period.month - 1]}</div>
            </div>
          </div>

          <div className="now-overview-grid">
            {kpis.map(k => {
              const total = Object.values(k.byStage as Record<string, number>).reduce((n, v) => n + v, 0);
              return (
                <button
                  key={k.id}
                  type="button"
                  className="now-overview-card"
                  onClick={() => setOpenDept({ id: k.id, name: k.name })}
                  aria-label={`${k.name}: open activity log`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="now-overview-title">{k.name}</span>
                    {k.overdueTasks > 0 && <span className="now-pill risk">{k.overdueTasks} overdue</span>}
                  </div>
                  <div className="now-row-sub">
                    {k.headName ? `Head: ${k.headName}` : "No head yet"} · {k.projects} project{k.projects === 1 ? "" : "s"}
                  </div>

                  {/* Where the department's work sits */}
                  {total > 0 ? (
                    <div className="flex h-2 overflow-hidden rounded-full bg-[var(--secondary)]" aria-hidden="true">
                      {TASK_STAGES.map(s => (
                        <span key={s.value} style={{ width: `${((k.byStage[s.value] ?? 0) / total) * 100}%`, background: s.color }} />
                      ))}
                      <span style={{ width: `${((k.byStage.blocked ?? 0) / total) * 100}%`, background: "#ef4444" }} />
                    </div>
                  ) : (
                    <div className="now-row-sub">No tasks yet</div>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {[...TASK_STAGES.map(s => s.value), "blocked"]
                      .filter(stage => (k.byStage[stage] ?? 0) > 0)
                      .map(stage => (
                        <span key={stage}>{STATUS_LABELS[stage] ?? stage}: <strong>{k.byStage[stage]}</strong></span>
                      ))}
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span>Open: <strong>{k.openTasks}</strong></span>
                    <span className={k.unassignedTasks ? "now-warn" : ""}>Not assigned: <strong>{k.unassignedTasks}</strong></span>
                    <span>Done this month: <strong>{k.completedInPeriod}</strong></span>
                    <span>On time: <strong>{k.onTimeRate === null ? "--" : `${k.onTimeRate}%`}</strong></span>
                    <span>Avg time to finish: <strong>{k.avgCycleDays === null ? "--" : `${k.avgCycleDays}d`}</strong></span>
                    <span>Activity (7 days): <strong>{k.activityLast7Days}</strong></span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {openDept && <DepartmentActivity department={openDept} onClose={() => setOpenDept(null)} />}
    </>
  );
}

/** One department's activity log, newest first. */
function DepartmentActivity({ department, onClose }: { department: { id: string; name: string }; onClose: () => void }) {
  const { data = [], isLoading } = trpc.fpb.getDepartmentActivity.useQuery({ departmentId: department.id, limit: 100 });
  const items = data as any[];
  return (
    <section className="now-card" aria-label={`${department.name} activity`} style={{ gap: 10 }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="now-lede">{department.name}: activity</div>
          <div className="now-row-sub">Every change to this department's tasks, newest first.</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/department-board" className="now-link">Open board</Link>
          <button type="button" className="now-icon-btn" aria-label="Close activity" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </div>
      ) : items.length === 0 ? (
        <p className="now-muted">No activity yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map(a => (
            <li key={a.id} className="flex flex-wrap gap-x-1.5 border-b border-border/60 pb-2 last:border-0">
              <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
              <span className="font-semibold">{a.userName}</span>
              <span>{a.action}</span>
              {a.detail && <span className="font-medium">"{a.detail}"</span>}
              {a.fromStatus && a.toStatus && (
                <span className="text-muted-foreground">
                  ({STATUS_LABELS[a.fromStatus] ?? a.fromStatus} → {STATUS_LABELS[a.toStatus] ?? a.toStatus})
                </span>
              )}
              <span className="text-muted-foreground">· {a.projectTitle}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
