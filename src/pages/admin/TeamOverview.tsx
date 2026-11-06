import { useContext, useMemo } from "react";
import { Link, Redirect } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { CalendarClock, Clock, Loader2, RefreshCcw, Users } from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isAnyHead } from "@/lib/roles";
import { AdminShellContext } from "@/components/portal";
import { NowHeaderTools, NowPageHeader } from "@/components/now/NowPage";
import "./adminB.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A department head's view of their own team. Everything else in the admin
 * shell is organisation-wide and refuses a head; this is the one place scoped
 * to the people they actually lead - who is clocked in, hours this month, and
 * outstanding leave.
 */
export default function TeamOverview() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading, isError, error } = trpc.team.getOverview.useQuery();

  const members = data?.members ?? [];
  const clockedIn = useMemo(
    () => members.filter(m => m.clockedInSince).length,
    [members]
  );

  if (user && !isAnyHead(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  const deptLabel = (data?.departments ?? []).map(d => d.name).join(", ");
  const periodLabel = data ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : "";

  const pendingLeave = members.reduce((n, m) => n + m.pendingLeaveCount, 0);
  const missingClockOuts = members.reduce((n, m) => n + m.missingClockOuts, 0);

  return (
    <AdminLayout>
      <div className="now-page">
        <NowPageHeader
          title="My team"
          subtitle={
            <>
              {deptLabel ? deptLabel : "Your department"}
              {periodLabel && <> · attendance for {periodLabel}</>}
            </>
          }
          actions={
            <div className="now-header-actions">
              <button
                type="button"
                className="now-btn sm white"
                onClick={() => utils.team.getOverview.invalidate()}
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Refresh
              </button>
              <ShellTools />
            </div>
          }
        />

        {isLoading && (
          <div className="now-card items-center py-14 text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading your team...
            </span>
          </div>
        )}

        {isError && (
          <div className="now-card py-8">
            <p className="nb-bad text-sm">
              {error?.message || "Could not load your team."}
            </p>
          </div>
        )}

        {!isLoading && !isError && members.length === 0 && (
          <div className="now-card items-center py-12 text-center">
            <div className="now-lede">No one here yet</div>
            <p className="now-muted max-w-md text-sm">
              No one is in your department yet. Ask an administrator to add people
              to it on the Organisation page.
            </p>
          </div>
        )}

        {members.length > 0 && (
          <>
            {/* Summary */}
            <div className="now-stat-strip">
              <div>
                <div className="now-stat-label flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> Team members
                </div>
                <div className="now-stat-value">{members.length}</div>
              </div>
              <div>
                <div className="now-stat-label flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Clocked in now
                </div>
                <div className={`now-stat-value${clockedIn > 0 ? " nb-ok" : ""}`}>{clockedIn}</div>
              </div>
              <div>
                <div className="now-stat-label flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Pending leave
                </div>
                <div className={`now-stat-value${pendingLeave > 0 ? " now-warn" : ""}`}>{pendingLeave}</div>
              </div>
              <div>
                <div className="now-stat-label flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Missing clock-outs
                </div>
                <div className={`now-stat-value${missingClockOuts > 0 ? " now-warn" : ""}`}>{missingClockOuts}</div>
              </div>
            </div>

            <section className="now-card" aria-label="Team members">
              <div className="now-card-head">
                <h2 className="now-h2">Team</h2>
                <span className="now-row-sub">{periodLabel}</span>
              </div>
              <div className="nb-table-wrap">
                <table className="nb-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Status</th>
                      <th className="num">Present</th>
                      <th className="num">Hours</th>
                      <th className="num">Overtime</th>
                      <th className="num">Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id}>
                        <td>
                          <div className="flex items-center gap-2 font-semibold">
                            {m.name}
                            {m.isHead && <span className="now-pill ink nb-plain" style={{ fontSize: 11 }}>Head</span>}
                          </div>
                          <div className="now-row-sub">
                            {m.position || "—"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          {m.clockedInSince ? (
                            <span className="nb-ok inline-flex items-center gap-1.5 font-semibold">
                              <span className="nb-dot ok" aria-hidden="true" />
                              In · {formatDistanceToNow(new Date(m.clockedInSince))}
                            </span>
                          ) : (
                            <span className="now-muted inline-flex items-center gap-1.5">
                              <span className="nb-dot" aria-hidden="true" />
                              Out
                            </span>
                          )}
                          {m.missingClockOuts > 0 && (
                            <div className="now-warn mt-0.5 text-xs font-medium">
                              {m.missingClockOuts} forgot to clock out
                            </div>
                          )}
                        </td>
                        <td className="num">{m.presentDays}</td>
                        <td className="num">{m.totalHours.toFixed(1)}</td>
                        <td className="num">
                          {m.overtimeHours > 0
                            ? <span className="nb-info font-semibold">{m.overtimeHours.toFixed(1)}</span>
                            : <span className="now-muted">0</span>}
                        </td>
                        <td className="num">
                          {m.pendingLeaveCount > 0 ? (
                            <Link href="/admin/leaves" className="now-pill risk nb-plain cursor-pointer" style={{ fontFamily: "var(--font-body)" }}>
                              {m.pendingLeaveCount} pending
                            </Link>
                          ) : (
                            <span className="now-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-xs text-muted-foreground">
              Leave requests from your team come to the{" "}
              <Link href="/admin/leaves" className="now-link" style={{ fontSize: 12 }}>Leaves</Link>{" "}
              page for you to approve.
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

/**
 * Heads see this page in the employee shell, which has no top bar, so the
 * usual Ask Wingman and bell tools stay in the header there. Read inside the
 * shell, because that is where the Admin Panel provides its context.
 */
function ShellTools() {
  const inAdmin = useContext(AdminShellContext);
  return inAdmin ? null : <NowHeaderTools />;
}
