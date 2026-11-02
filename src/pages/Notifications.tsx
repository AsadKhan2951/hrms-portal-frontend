import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { toast } from "sonner";
import NowPage, { Segmented, WingmanBanner } from "@/components/now/NowPage";
import { trpc } from "@/lib/trpc";

type Filter = "all" | "unread" | "projects" | "attendance" | "hours";

const KIND: Record<string, string> = {
  project_assigned: "Project",
  task_assigned: "Task",
  attendance_issue: "Attendance",
  hours_shortfall: "Hours",
  leave_approved: "Leave",
  leave_rejected: "Leave",
  announcement: "Announcement",
  payslip_issued: "Pay",
  system_alert: "Update",
  project_member_added: "Project",
  task_comment: "Comment",
  task_completed: "Task",
  task_mention: "Mention",
  task_due_soon: "Deadline",
  task_overdue: "Deadline",
};

/** Project-board notifications, for the "Projects" filter. */
const PROJECT_TYPES = new Set([
  "project_assigned", "task_assigned", "project_member_added", "task_comment",
  "task_completed", "task_mention", "task_due_soon", "task_overdue",
]);

/** Only in-app paths are followed; anything else stays put. */
function safeLink(link: unknown): string | null {
  return typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : null;
}

const MATCHES: Record<Filter, (n: any) => boolean> = {
  all: () => true,
  unread: n => !n.isRead,
  projects: n => PROJECT_TYPES.has(n.type),
  attendance: n => n.type === "attendance_issue",
  hours: n => n.type === "hours_shortfall",
};

/** Notifications: what happened, newest first, with the one thing that needs action called out. */
export default function Notifications() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const { data = [], isLoading, isError } = trpc.notifications.getAll.useQuery();
  const fourWeeks = trpc.time.getFourWeeks.useQuery();

  const refresh = async () => {
    await Promise.all([utils.notifications.getAll.invalidate(), utils.notifications.getUnreadCount.invalidate()]);
  };
  const markRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: refresh,
    onError: () => toast.error("Could not mark it as read"),
  });
  const markAll = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: refresh,
    onError: () => toast.error("Could not mark them as read"),
  });
  const remove = trpc.notifications.delete.useMutation({
    onSuccess: refresh,
    onError: () => toast.error("Could not delete it"),
  });

  /** Opening a notification marks it read and goes to what it is about. */
  const open = (n: any) => {
    const link = safeLink(n.link);
    if (!link) return;
    if (!n.isRead) markRead.mutate({ notificationId: String(n.id) });
    navigate(link);
  };

  const items = data as any[];
  const unread = items.filter(n => !n.isRead).length;
  const shown = useMemo(() => items.filter(MATCHES[filter]), [items, filter]);
  const toFix = (fourWeeks.data?.toFix ?? []) as { date: string }[];

  return (
    <NowPage
      title="Notifications"
      subtitle={isLoading ? "Loading..." : unread ? `${unread} unread` : "All caught up"}
      actions={
        <button type="button" className="now-btn white md" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
          Mark all as read
        </button>
      }
    >
      {toFix.length > 0 && (
        <div style={{ maxWidth: 880 }}>
          <WingmanBanner
            action={
              <Link href={`/attendance?fix=${toFix[0].date}`} className="now-btn indigo sm">
                Fix it now
              </Link>
            }
          >
            One thing here needs action: {toFix.length === 1 ? "an attendance record" : `${toFix.length} attendance records`} to
            fix. The rest are updates.
          </WingmanBanner>
        </div>
      )}

      <Segmented
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "unread", label: "Unread" },
          { value: "projects", label: "Projects" },
          { value: "attendance", label: "Attendance" },
          { value: "hours", label: "Hours" },
        ]}
      />

      <section className="now-card" style={{ padding: "8px 24px", gap: 0, maxWidth: 880 }}>
        {isError ? (
          <div className="now-warn" style={{ padding: "18px 0" }}>
            Could not load your notifications. Refresh to try again.
          </div>
        ) : isLoading ? (
          <div className="now-muted" style={{ padding: "18px 0" }}>
            Loading...
          </div>
        ) : shown.length === 0 ? (
          <div className="now-muted" style={{ padding: "18px 0" }}>
            {filter === "all" ? "No notifications yet." : "Nothing here."}
          </div>
        ) : (
          shown.map((n, index) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "18px 0",
                borderBottom: index < shown.length - 1 ? "1px solid var(--secondary)" : undefined,
              }}
            >
              <span
                aria-hidden="true"
                style={{ flex: "0 0 10px", height: 10, marginTop: 6, borderRadius: "50%", background: n.isRead ? "transparent" : "var(--now-indigo)" }}
              />
              <div
                style={{ flex: "1 1 0", minWidth: 0, cursor: safeLink(n.link) ? "pointer" : undefined }}
                role={safeLink(n.link) ? "link" : undefined}
                tabIndex={safeLink(n.link) ? 0 : undefined}
                onClick={() => open(n)}
                onKeyDown={e => { if (e.key === "Enter") open(n); }}
                aria-label={safeLink(n.link) ? `Open: ${n.title}` : undefined}
              >
                <div style={{ fontWeight: n.isRead ? 600 : 700 }}>{n.title}</div>
                <div className="now-body-2">{n.message}</div>
                <div className="now-small now-muted" style={{ marginTop: 4 }}>
                  {KIND[n.type] ?? "Update"} · {format(new Date(n.createdAt), "d MMM, HH:mm")}
                </div>
              </div>
              {n.isRead ? (
                <button
                  type="button"
                  className="now-btn text sm"
                  style={{ color: "var(--muted-foreground)" }}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ notificationId: String(n.id) })}
                  aria-label={`Delete notification: ${n.title}`}
                >
                  Delete
                </button>
              ) : (
                <button
                  type="button"
                  className="now-btn text sm"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate({ notificationId: String(n.id) })}
                  aria-label={`Mark as read: ${n.title}`}
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </NowPage>
  );
}
