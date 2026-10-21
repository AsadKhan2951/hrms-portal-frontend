import { useMemo, useState } from "react";
import {
  addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * Client meetings across every project the viewer can see, on a month grid.
 * A meeting comes from a project's monthly client round ("Meeting scheduled").
 */
type Meeting = {
  roundId: string;
  projectId: string;
  projectTitle: string;
  monthLabel: string;
  meetingAt: string | Date;
  meetingDoneAt: string | Date | null;
  meetingNotes: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MeetingsCalendar({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  // Midnight after the last Sunday on the grid; exclusive.
  const gridEnd = addDays(startOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 7);

  const { data = [], isLoading } = trpc.clientRounds.meetings.useQuery({ from: gridStart, to: gridEnd });
  const meetings = data as Meeting[];

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) list.push(d);
    return list;
  }, [gridStart.getTime(), gridEnd.getTime()]);

  const onDay = (date: Date) => meetings.filter(m => isSameDay(new Date(m.meetingAt), date));
  const thisMonthMeetings = meetings.filter(m => isSameMonth(new Date(m.meetingAt), month));
  const today = new Date();

  return (
    <section className="now-card now-cal" aria-label="Client meetings">
      <div className="now-cal-head">
        <div>
          <div className="now-h2">{format(month, "MMMM yyyy")}</div>
          <div className="now-row-sub">
            {isLoading
              ? "Loading meetings"
              : `${thisMonthMeetings.length} client meeting${thisMonthMeetings.length === 1 ? "" : "s"} across your projects`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="now-icon-btn ground" aria-label="Previous month" onClick={() => setMonth(m => addMonths(m, -1))}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" className="now-btn ground sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</button>
          <button type="button" className="now-icon-btn ground" aria-label="Next month" onClick={() => setMonth(m => addMonths(m, 1))}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="now-cal-grid" role="grid" aria-label={format(month, "MMMM yyyy")}>
        {WEEKDAYS.map(name => (
          <div key={name} className="now-cal-wd" role="columnheader">{name}</div>
        ))}
        {days.map(date => {
          const items = onDay(date);
          return (
            <div
              key={date.toISOString()}
              role="gridcell"
              className={`now-cal-day${isSameMonth(date, month) ? "" : " out"}${isSameDay(date, today) ? " today" : ""}`}
            >
              <span className="now-cal-num">{format(date, "d")}</span>
              {items.map(item => (
                <button
                  key={item.roundId}
                  type="button"
                  className={`now-cal-item${item.meetingDoneAt ? " done" : ""}`}
                  title={`${item.projectTitle} · ${item.monthLabel}${item.meetingDoneAt ? " · done" : ""}`}
                  onClick={() => onOpenProject(item.projectId)}
                >
                  <span className="t">{format(new Date(item.meetingAt), "HH:mm")}</span>
                  <span className="p">{item.projectTitle}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* The same meetings as a list, which reads better on a phone. */}
      <div className="now-cal-list">
        {isLoading && (
          <div className="now-row-sub flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</div>
        )}
        {!isLoading && thisMonthMeetings.length === 0 && (
          <p className="now-row-sub">No client meetings this month. Set one from a project's Client tab.</p>
        )}
        {thisMonthMeetings.map(item => (
          <button key={item.roundId} type="button" className="now-list-row" onClick={() => onOpenProject(item.projectId)}>
            <span className="now-cal-when">{format(new Date(item.meetingAt), "EEE d MMM, HH:mm")}</span>
            <span className="now-kcard-title">{item.projectTitle}</span>
            <span className={`now-kcard-tag ${item.meetingDoneAt ? "done" : new Date(item.meetingAt) < today ? "late" : "muted"}`}>
              {item.meetingDoneAt
                ? <><Check className="inline h-3.5 w-3.5" aria-hidden="true" /> Done</>
                : new Date(item.meetingAt) < today ? "Not marked done" : "Upcoming"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
