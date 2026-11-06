import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ChevronDown, Loader2, Search } from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { NowPageHeader, Segmented } from "@/components/now/NowPage";
import { trpc } from "@/lib/trpc";
import { Avatar, formatDate, scopeLabel } from "@/pages/fpb/shared";
import { DepartmentKpis } from "./DepartmentKpis";

type StatusFilter = "active" | "all";

/**
 * The owner's view of the project board: every project at once, grouped by
 * the department that runs it, with progress and overdue work. A card opens
 * that project's board.
 */
export default function ProjectsOverview() {
  const [, navigate] = useLocation();
  // Departments first: the owner asked to see each department's load and KPIs.
  const [view, setView] = useState<"departments" | "projects">("departments");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = trpc.fpb.getOverview.useQuery(
    status === "active" ? { status: "active" } : undefined
  );
  const report = data as any;

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((report?.departments ?? []) as any[])
      .map(d => ({
        ...d,
        projects: (d.projects as any[]).filter(
          p =>
            (!onlyOverdue || p.overdueTasks > 0) &&
            (!q ||
              p.title.toLowerCase().includes(q) ||
              d.name.toLowerCase().includes(q) ||
              p.people.some((u: any) => u.name.toLowerCase().includes(q)))
        ),
      }))
      .filter(d => d.projects.length > 0);
  }, [report, search, onlyOverdue]);

  const totals = report?.totals;
  const progress = totals && totals.taskCount > 0
    ? Math.round((totals.completedTasks / totals.taskCount) * 100)
    : 0;

  const toggle = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <AdminLayout title="All Projects">
      <div className="now-page">
        <NowPageHeader
          title="All projects"
          subtitle={
            totals
              ? `${totals.projects} project${totals.projects === 1 ? "" : "s"} across ${report.departments.length} department${report.departments.length === 1 ? "" : "s"}`
              : "Every department's projects in one place"
          }
        />

        <Segmented
          label="View"
          tone="ink"
          value={view}
          onChange={setView}
          options={[
            { value: "departments", label: "Departments & KPIs" },
            { value: "projects", label: "Projects" },
          ]}
        />

        {view === "departments" ? <DepartmentKpis /> : (<>

        <div className="now-stat-strip">
          <div>
            <div className="now-stat-label">Projects</div>
            <div className="now-stat-value">{totals?.projects ?? 0}</div>
            <div className="now-stat-label">{status === "active" ? "active now" : "in total"}</div>
          </div>
          <div>
            <div className="now-stat-label">Open tasks</div>
            <div className="now-stat-value">{totals?.openTasks ?? 0}</div>
            <div className="now-stat-label">not done yet</div>
          </div>
          <div>
            <div className="now-stat-label">Overdue</div>
            <div className={`now-stat-value${totals?.overdueTasks ? " now-warn" : ""}`}>{totals?.overdueTasks ?? 0}</div>
            <div className="now-stat-label">tasks past their due date</div>
          </div>
          <div>
            <div className="now-stat-label">Progress</div>
            <div className="now-stat-value">{progress}%</div>
            <div className="now-stat-label">{totals?.completedTasks ?? 0} of {totals?.taskCount ?? 0} tasks done</div>
          </div>
        </div>

        <div className="now-overview-bar">
          <div className="now-input-wrap" style={{ minHeight: 46, flex: "1 1 260px", maxWidth: 380 }}>
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects, departments or people"
              aria-label="Search projects, departments or people"
            />
          </div>
          <Segmented
            label="Status"
            tone="pick"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "all", label: "All" },
            ]}
          />
          <button
            type="button"
            className={`now-btn sm ${onlyOverdue ? "ink" : "white"}`}
            aria-pressed={onlyOverdue}
            onClick={() => setOnlyOverdue(v => !v)}
          >
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> Only overdue
          </button>
        </div>

        {isLoading ? (
          <div className="now-card items-center py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading projects
          </div>
        ) : isError ? (
          <div className="now-card py-10 now-warn">Could not load projects. Refresh to try again.</div>
        ) : sections.length === 0 ? (
          <div className="now-card items-center py-14 text-center">
            <div className="now-lede">Nothing to show</div>
            <p className="now-muted">
              {search || onlyOverdue ? "No project matches these filters." : "No projects have been created yet."}
            </p>
          </div>
        ) : (
          sections.map(d => {
            const key = d.id ?? "none";
            const isOpen = !collapsed.has(key);
            return (
              <section key={key} className="now-overview-dept" aria-label={d.name}>
                <button
                  type="button"
                  className="now-overview-dept-head"
                  aria-expanded={isOpen}
                  onClick={() => toggle(key)}
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                    aria-hidden="true"
                  />
                  <span className="now-overview-dept-name">{d.name}</span>
                  {d.headName && <span className="now-row-sub">Head: {d.headName}</span>}
                  <span className="grow" />
                  <span className="now-pill">{d.projects.length} project{d.projects.length === 1 ? "" : "s"}</span>
                  <span className="now-pill">{d.openTasks} open</span>
                  {d.overdueTasks > 0 && <span className="now-pill risk">{d.overdueTasks} overdue</span>}
                </button>

                {isOpen && (
                  <div className="now-overview-grid">
                    {d.projects.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        className="now-overview-card"
                        onClick={() => navigate(`/board?project=${p.id}`)}
                        aria-label={`Open ${p.title}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="now-overview-title">{p.title}</span>
                          {p.overdueTasks > 0 && <span className="now-pill risk">{p.overdueTasks} overdue</span>}
                        </div>
                        <div className="now-row-sub">
                          {scopeLabel(p.scopes)}
                          {p.status !== "active" ? ` · ${p.status.replace("_", " ")}` : ""}
                          {p.startDate ? ` · ${formatDate(p.startDate)}` : ""}
                          {p.dueDate ? ` → ${formatDate(p.dueDate)}` : ""}
                        </div>

                        <div className="now-overview-progress" aria-label={`${p.progress}% done`}>
                          <span style={{ width: `${p.progress}%` }} />
                        </div>
                        <div className="now-row-sub">
                          {p.taskCount === 0
                            ? "No tasks yet"
                            : `${p.completedTasks}/${p.taskCount} done · ${p.openTasks} open`}
                        </div>

                        <div className="now-overview-foot">
                          <span className="flex items-center">
                            {p.people.slice(0, 5).map((u: any, i: number) => (
                              <span key={u.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                                <Avatar user={u} size={24} />
                              </span>
                            ))}
                            {p.people.length > 5 && (
                              <span className="now-row-sub ml-1">+{p.people.length - 5}</span>
                            )}
                          </span>
                          {p.alsoDepartments.length > 0 && (
                            <span className="now-row-sub truncate" title={p.alsoDepartments.join(", ")}>
                              with {p.alsoDepartments.join(", ")}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
        <p className="text-xs text-muted-foreground">
          A project sits under the department of the person who created it. Other departments with people on it are shown on the card.
        </p>
        </>)}
      </div>
    </AdminLayout>
  );
}
