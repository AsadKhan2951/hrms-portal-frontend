import { useMemo } from "react";
import { Link, Redirect } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { CalendarClock, Clock, Loader2, RefreshCcw, Users } from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isAnyHead } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="h-6 w-6" /> My Team
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {deptLabel ? deptLabel : "Your department"}
              {periodLabel && <> · attendance for {periodLabel}</>}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => utils.team.getOverview.invalidate()}
          >
            <RefreshCcw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your team...
          </div>
        )}

        {isError && (
          <Card className="p-4 border-red-500/40 bg-red-500/5">
            <p className="text-sm text-red-500">
              {error?.message || "Could not load your team."}
            </p>
          </Card>
        )}

        {!isLoading && !isError && members.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              No one is in your department yet. Ask an administrator to add people
              to it on the Organisation page.
            </p>
          </Card>
        )}

        {members.length > 0 && (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Team members" value={String(members.length)} icon={<Users className="h-4 w-4" />} />
              <Tile label="Clocked in now" value={String(clockedIn)} icon={<Clock className="h-4 w-4" />} accent="emerald" />
              <Tile
                label="Pending leave"
                value={String(members.reduce((n, m) => n + m.pendingLeaveCount, 0))}
                icon={<CalendarClock className="h-4 w-4" />}
                accent="amber"
              />
              <Tile
                label="Missing clock-outs"
                value={String(members.reduce((n, m) => n + m.missingClockOuts, 0))}
                icon={<Clock className="h-4 w-4" />}
                accent="amber"
              />
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Present</th>
                      <th className="px-4 py-3 font-medium text-right">Hours</th>
                      <th className="px-4 py-3 font-medium text-right">Overtime</th>
                      <th className="px-4 py-3 font-medium text-right">Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <div className="font-medium flex items-center gap-2">
                            {m.name}
                            {m.isHead && <Badge variant="outline" className="text-[10px]">Head</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.position || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {m.clockedInSince ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-500">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              In · {formatDistanceToNow(new Date(m.clockedInSince))}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                              Out
                            </span>
                          )}
                          {m.missingClockOuts > 0 && (
                            <div className="text-[11px] text-amber-500 mt-0.5">
                              {m.missingClockOuts} forgot to clock out
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{m.presentDays}</td>
                        <td className="px-4 py-3 text-right">{m.totalHours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right">
                          {m.overtimeHours > 0
                            ? <span className="text-violet-400">{m.overtimeHours.toFixed(1)}</span>
                            : <span className="text-muted-foreground">0</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {m.pendingLeaveCount > 0 ? (
                            <Link href="/admin/leaves">
                              <Badge className="cursor-pointer bg-amber-500/20 text-amber-500 border-amber-500/40">
                                {m.pendingLeaveCount} pending
                              </Badge>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <p className="text-xs text-muted-foreground">
              Leave requests from your team come to the{" "}
              <Link href="/admin/leaves"><span className="underline cursor-pointer">Leaves</span></Link>{" "}
              page for you to approve.
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Tile({
  label, value, icon, accent,
}: {
  label: string; value: string; icon: React.ReactNode; accent?: "emerald" | "amber";
}) {
  const tone =
    accent === "emerald" ? "text-emerald-500"
    : accent === "amber" ? "text-amber-500"
    : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</div>
    </Card>
  );
}
