import { Fragment, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { downloadCsv } from "@/lib/csv";
import { Segmented } from "@/components/now/NowPage";
import { Avatar } from "@/pages/fpb/shared";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Current month in office time (Asia/Karachi), so a late-night visit lands on the right month. */
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
 * Employee performance from the board, month by month: how many tasks each
 * person completed (on time or late), on which projects, and what is still
 * open or overdue, grouped by department. For this project, or across every
 * project the viewer can see (admins everyone, heads their departments).
 */
export function PerformanceView({
  projectId, projectTitle, users, wideScopeLabel,
}: {
  projectId: string;
  projectTitle: string;
  users: any[];
  /** "Whole company" for admins, "My departments" for heads, "Just me" for others. */
  wideScopeLabel: string;
}) {
  const [period, setPeriod] = useState(currentMonth);
  const [scope, setScope] = useState<"project" | "all">("project");
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, isError } = trpc.fpb.getPerformance.useQuery({
    month: period.month,
    year: period.year,
    projectId: scope === "project" ? projectId : undefined,
  });

  const shift = (delta: number) =>
    setPeriod(p => {
      const index = p.year * 12 + (p.month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  const now = currentMonth();
  const atCurrent = period.year === now.year && period.month === now.month;

  const report = data as any;
  const departments = (report?.departments ?? []) as any[];
  const totals = report?.totals;
  const onTimeRate =
    totals && totals.completedOnTime + totals.completedLate > 0
      ? Math.round((totals.completedOnTime / (totals.completedOnTime + totals.completedLate)) * 100)
      : null;

  const exportCsv = () => {
    const rows: unknown[][] = [];
    for (const d of departments) {
      for (const e of d.employees) {
        rows.push([
          d.name, e.name, e.position, e.completed, e.completedOnTime, e.completedLate,
          e.completedNoDueDate, e.open, e.overdue,
          e.projects.map((p: any) => `${p.title} (${p.completed})`).join("; "),
        ]);
      }
    }
    const scopeName = scope === "project" ? projectTitle : wideScopeLabel;
    downloadCsv(
      `performance-${scopeName}-${period.year}-${String(period.month).padStart(2, "0")}`,
      ["Department", "Employee", "Position", "Completed", "On time", "Late", "No due date", "Open now", "Overdue now", "Projects"],
      rows
    );
  };

  return (
    <section className="now-card" aria-label="Team performance" style={{ gap: 16 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className="now-icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[150px] text-center font-bold">
            {MONTHS[period.month - 1]} {period.year}
          </div>
          <button
            type="button"
            className="now-icon-btn"
            aria-label="Next month"
            disabled={atCurrent}
            onClick={() => shift(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Scope"
            tone="pick"
            value={scope}
            onChange={setScope}
            options={[
              { value: "project", label: "This project" },
              { value: "all", label: wideScopeLabel },
            ]}
          />
          <button type="button" className="now-btn white sm" onClick={exportCsv} disabled={departments.length === 0}>
            <Download className="mr-1 inline h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="now-muted flex items-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading performance
        </div>
      ) : isError ? (
        <div className="now-warn py-8">Could not load performance. Refresh to try again.</div>
      ) : (
        <>
          <div className="now-stat-strip" style={{ margin: 0 }}>
            <div>
              <div className="now-stat-label">Tasks completed</div>
              <div className="now-stat-value">{totals?.completed ?? 0}</div>
              <div className="now-stat-label">in {MONTHS[period.month - 1]}</div>
            </div>
            <div>
              <div className="now-stat-label">On time</div>
              <div className="now-stat-value">{onTimeRate === null ? "--" : `${onTimeRate}%`}</div>
              <div className="now-stat-label">
                {totals?.completedOnTime ?? 0} on time, {totals?.completedLate ?? 0} late
              </div>
            </div>
            <div>
              <div className="now-stat-label">Open now</div>
              <div className="now-stat-value">{totals?.open ?? 0}</div>
              <div className="now-stat-label">assigned and not done</div>
            </div>
            <div>
              <div className="now-stat-label">Overdue now</div>
              <div className={`now-stat-value${totals?.overdue ? " now-warn" : ""}`}>{totals?.overdue ?? 0}</div>
              <div className="now-stat-label">past their due date</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Employee</th>
                  <th className="py-2 px-3 text-right font-semibold">Completed</th>
                  <th className="py-2 px-3 text-right font-semibold">On time</th>
                  <th className="py-2 px-3 text-right font-semibold">Late</th>
                  <th className="py-2 px-3 text-right font-semibold">Open</th>
                  <th className="py-2 px-3 text-right font-semibold">Overdue</th>
                  <th className="py-2 pl-3 font-semibold">Projects</th>
                </tr>
              </thead>
              <tbody>
                {departments.map(d => (
                  <Fragment key={d.id ?? "none"}>
                    <tr className="border-t border-border">
                      <td colSpan={7} className="pt-4 pb-1 font-bold">
                        {d.name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {d.completed} completed · {d.open} open · {d.overdue} overdue
                        </span>
                      </td>
                    </tr>
                    {d.employees.map((e: any) => {
                      const expanded = open === e.userId;
                      const user = users.find(u => u.id === e.userId) ?? { name: e.name };
                      return (
                        <Fragment key={e.userId}>
                          <tr
                            className="cursor-pointer border-t border-border/60 hover:bg-background"
                            onClick={() => setOpen(expanded ? null : e.userId)}
                          >
                            <td className="py-2 pr-3">
                              <span className="flex items-center gap-2">
                                <ChevronDown
                                  className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
                                />
                                <Avatar user={user} size={22} />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">{e.name}</span>
                                  {e.position && <span className="block truncate text-xs text-muted-foreground">{e.position}</span>}
                                </span>
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-base font-bold">{e.completed}</td>
                            <td className="py-2 px-3 text-right">{e.completedOnTime}</td>
                            <td className={`py-2 px-3 text-right ${e.completedLate ? "now-warn" : ""}`}>{e.completedLate}</td>
                            <td className="py-2 px-3 text-right">{e.open}</td>
                            <td className={`py-2 px-3 text-right ${e.overdue ? "now-warn" : ""}`}>{e.overdue}</td>
                            <td className="py-2 pl-3 text-xs text-muted-foreground">
                              {e.projects.length === 0
                                ? "--"
                                : e.projects.slice(0, 3).map((p: any) => `${p.title} (${p.completed})`).join(", ")}
                              {e.projects.length > 3 && ` +${e.projects.length - 3}`}
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={7} className="pb-3 pl-10">
                                {e.completedTasks.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No tasks completed this month.</p>
                                ) : (
                                  <ul className="space-y-1 text-xs">
                                    {e.completedTasks.map((t: any) => (
                                      <li key={t.id} className="flex flex-wrap gap-x-2">
                                        <span className="font-medium">{t.title}</span>
                                        <span className="text-muted-foreground">{t.projectTitle}</span>
                                        <span className="text-muted-foreground">
                                          {new Date(t.completedAt).toLocaleDateString()}
                                        </span>
                                        {t.onTime === true && <span className="text-emerald-600">on time</span>}
                                        {t.onTime === false && <span className="now-warn">late</span>}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {departments.length === 0 && <p className="now-muted py-6">Nobody to show for this view.</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            A task counts for the person it was assigned to when it was completed, in the month it was completed.
            Tasks finished before 2 Nov 2026 use their assignee and last update, so those are approximate.
          </p>
        </>
      )}
    </section>
  );
}
