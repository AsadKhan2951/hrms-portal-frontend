import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format, isBefore, isThisWeek, isToday, startOfWeek } from "date-fns";
import { toast } from "sonner";
import NowPage, { Segmented, WingmanMark } from "@/components/now/NowPage";
import { trpc } from "@/lib/trpc";

type Filter = "today" | "week" | "earlier";

/** News: company announcements, newest first, with the dates worth knowing alongside. */
export default function Announcements() {
  const utils = trpc.useUtils();
  // Opens on this week, or on earlier posts when this week has none yet.
  const [chosen, setFilter] = useState<Filter | null>(null);

  const { data: announcements = [], isLoading, isError } = trpc.dashboard.getAnnouncements.useQuery();
  const { data: readIds = [] } = trpc.dashboard.getAnnouncementReadIds.useQuery();
  const fourWeeks = trpc.time.getFourWeeks.useQuery();
  const meetings = trpc.meetings.getMyMeetings.useQuery();
  const events = trpc.calendar.getMyEvents.useQuery();
  const leaves = trpc.leaves.getMyLeaves.useQuery();

  const markRead = trpc.dashboard.markAnnouncementRead.useMutation({
    onSuccess: () => utils.dashboard.getAnnouncementReadIds.invalidate(),
    onError: () => toast.error("Could not mark it as read"),
  });

  const read = useMemo(() => new Set((readIds as unknown[]).filter(Boolean).map(String)), [readIds]);
  const toFix = (fourWeeks.data?.toFix ?? []) as { date: string }[];

  const filter: Filter =
    chosen ?? ((announcements as any[]).some(item => isThisWeek(new Date(item.createdAt), { weekStartsOn: 1 })) ? "week" : "earlier");

  const shown = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sorted = [...(announcements as any[])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted.filter(item => {
      const date = new Date(item.createdAt);
      if (filter === "today") return isToday(date);
      if (filter === "week") return isThisWeek(date, { weekStartsOn: 1 });
      return isBefore(date, weekStart);
    });
  }, [announcements, filter]);

  // The next few things on this person's own calendar.
  const dates = useMemo(() => {
    const now = new Date();
    const list: { when: Date; title: string; detail: string }[] = [];
    for (const meeting of (meetings.data ?? []) as any[]) {
      if (meeting.status === "cancelled") continue;
      list.push({ when: new Date(meeting.startTime), title: meeting.title, detail: `Meeting · ${format(new Date(meeting.startTime), "HH:mm")}` });
    }
    for (const event of (events.data ?? []) as any[]) {
      const type = String(event.eventType ?? "event");
      list.push({ when: new Date(event.startTime), title: event.title, detail: type.charAt(0).toUpperCase() + type.slice(1) });
    }
    for (const leave of (leaves.data ?? []) as any[]) {
      if (leave.status !== "approved") continue;
      const type = String(leave.leaveType);
      list.push({ when: new Date(leave.startDate), title: `${type.charAt(0).toUpperCase() + type.slice(1)} leave starts`, detail: "Approved" });
    }
    return list
      .filter(item => !Number.isNaN(item.when.getTime()) && item.when >= now)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, 6);
  }, [meetings.data, events.data, leaves.data]);

  return (
    <NowPage title="News" subtitle="Company announcements and updates">
      <Segmented
        label="Posted"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "today", label: "Today" },
          { value: "week", label: "This week" },
          { value: "earlier", label: "Earlier" },
        ]}
      />

      <div className="now-cols">
        <div className="now-col-main" style={{ gap: 16 }}>
          {isError ? (
            <section className="now-card now-warn">Could not load announcements. Refresh to try again.</section>
          ) : isLoading ? (
            <section className="now-card now-muted">Loading...</section>
          ) : shown.length === 0 ? (
            <section className="now-card now-muted">
              {filter === "today" ? "Nothing posted today." : filter === "week" ? "Nothing posted this week." : "No earlier announcements."}
            </section>
          ) : (
            shown.map((item, index) => {
              const id = String(item.id);
              const urgent = item.priority === "high";
              const lead = index === 0;
              return (
                <article key={id} className="now-card" style={{ padding: lead ? 28 : "24px 28px", gap: lead ? 12 : 8 }}>
                  <div className="now-small now-muted" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                    {urgent && <span className="now-pill warn-soft" style={{ textTransform: "none" }}>Action needed</span>}
                    <span>{format(new Date(item.createdAt), "d MMMM, HH:mm")}</span>
                    {!read.has(id) && <span style={{ color: "var(--primary)", fontWeight: 700 }}>New</span>}
                  </div>
                  <h2
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: lead ? 26 : 20,
                      lineHeight: 1.15,
                      letterSpacing: lead ? "-0.02em" : "-0.01em",
                    }}
                  >
                    {item.title}
                  </h2>
                  <p style={{ maxWidth: 640, fontSize: lead ? 16 : 15, whiteSpace: "pre-wrap" }} className={lead ? "" : "now-body-2"}>
                    {item.content}
                  </p>
                  {/* Only said on an urgent post, and only when this person really has a record to fix. */}
                  {urgent && toFix.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        marginTop: 4,
                        padding: "12px 12px 12px 16px",
                        borderRadius: 14,
                        background: "var(--now-indigo-tint)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <WingmanMark className="shrink-0 text-[var(--now-indigo)]" />
                        <div>
                          You have {toFix.length} attendance {toFix.length === 1 ? "record" : "records"} to fix:{" "}
                          {toFix.map(d => format(new Date(`${d.date}T00:00:00`), "d MMMM")).join(", ")}.
                        </div>
                      </div>
                      <Link href={`/attendance?fix=${toFix[0].date}`} className="now-btn indigo sm">
                        Fix it now
                      </Link>
                    </div>
                  )}
                  {!read.has(id) && (
                    <button
                      type="button"
                      className="now-link"
                      style={{ alignSelf: "flex-start" }}
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate({ announcementId: id })}
                    >
                      Mark as read
                    </button>
                  )}
                </article>
              );
            })
          )}
        </div>

        <section className="now-card now-col-side">
          <h2 className="now-h2">Dates to know</h2>
          {dates.length === 0 ? (
            <div className="now-muted">Nothing coming up on your calendar.</div>
          ) : (
            dates.map((item, index) => (
              <div key={index} className="now-dated">
                <div className="when">{format(item.when, "EEE d")}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="now-row-title">{item.title}</div>
                  <div className="now-row-sub">{item.detail}</div>
                </div>
              </div>
            ))
          )}
          <Link href="/calendar" className="now-link">
            Open calendar
          </Link>
        </section>
      </div>
    </NowPage>
  );
}
