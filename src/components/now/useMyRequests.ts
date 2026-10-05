import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { trpc } from "@/lib/trpc";

/**
 * Everything the signed-in person has asked for, from the four places the
 * portal keeps it (leave, overtime, corrections and tickets, HR forms), as one
 * list with one vocabulary for status.
 */
export type MyRequest = {
  key: string;
  title: string;
  detail: string;
  type: "Leave" | "Overtime" | "Attendance" | "Ticket" | "Grievance" | "Feedback" | "Resignation";
  when: Date;
  status: string;
  /** Still waiting on somebody. */
  open: boolean;
  tone: "muted" | "ink" | "warn";
};

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const day = (value: Date | string) => format(new Date(value), "d MMM");

function leaveDays(start: Date | string, end: Date | string) {
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function useMyRequests() {
  // Stable for the life of the page, so the query key does not change on every render.
  const range = useMemo(() => ({ startDate: subDays(new Date(), 90), endDate: new Date() }), []);
  const leaves = trpc.leaves.getMyLeaves.useQuery();
  const requests = trpc.requests.getMine.useQuery();
  const forms = trpc.forms.getMyForms.useQuery();
  const overtime = trpc.timeTracking.getOvertimeByRange.useQuery(range);

  const rows = useMemo<MyRequest[]>(() => {
    const list: MyRequest[] = [];

    for (const leave of (leaves.data ?? []) as any[]) {
      const single = day(leave.startDate) === day(leave.endDate);
      list.push({
        key: `leave-${leave.id}`,
        title: `${cap(String(leave.leaveType))} leave, ${single ? day(leave.startDate) : `${day(leave.startDate)} to ${day(leave.endDate)}`}`,
        detail: leave.status === "rejected" && leave.rejectionReason ? leave.rejectionReason : leaveDays(leave.startDate, leave.endDate),
        type: "Leave",
        when: new Date(leave.createdAt),
        status: cap(String(leave.status)),
        open: leave.status === "pending",
        tone: leave.status === "pending" ? "muted" : leave.status === "rejected" ? "warn" : "ink",
      });
    }

    for (const request of (requests.data ?? []) as any[]) {
      list.push({
        key: `request-${request.id}`,
        title: request.subject,
        detail: request.reviewNote || request.details || (request.kind === "support_ticket" ? "Support ticket" : "Attendance correction"),
        type: request.kind === "support_ticket" ? "Ticket" : "Attendance",
        when: new Date(request.createdAt),
        status: cap(String(request.status)),
        open: request.status === "pending",
        tone: request.status === "pending" ? "muted" : request.status === "rejected" ? "warn" : "ink",
      });
    }

    for (const form of (forms.data ?? []) as any[]) {
      // Leave used to be raised as a form too; those rows are already in the leave list.
      if (form.formType === "leave") continue;
      const closed = form.status === "resolved" || form.status === "closed";
      list.push({
        key: `form-${form.id}`,
        title: form.subject,
        detail: form.response || cap(String(form.formType)),
        type: cap(String(form.formType)) as MyRequest["type"],
        when: new Date(form.createdAt),
        status: form.status === "under_review" ? "In review" : form.status === "submitted" ? "Pending" : cap(String(form.status)),
        open: !closed,
        tone: closed ? "ink" : "muted",
      });
    }

    for (const entry of (overtime.data ?? []) as any[]) {
      list.push({
        key: `overtime-${entry.id}`,
        title: `Overtime, ${entry.hours} ${entry.hours === 1 ? "hour" : "hours"}`,
        detail: `${day(entry.workDate)}${entry.description ? ` · ${entry.description}` : ""}`,
        type: "Overtime",
        when: new Date(entry.createdAt ?? entry.workDate),
        // Overtime is recorded as soon as it is added; nobody approves it.
        status: "Logged",
        open: false,
        tone: "ink",
      });
    }

    return list.sort((a, b) => b.when.getTime() - a.when.getTime());
  }, [leaves.data, requests.data, forms.data, overtime.data]);

  return {
    rows,
    isLoading: leaves.isLoading || requests.isLoading || forms.isLoading || overtime.isLoading,
    isError: leaves.isError || requests.isError || forms.isError || overtime.isError,
  };
}

export const requestStatusColor = (tone: MyRequest["tone"]) =>
  tone === "warn" ? "var(--now-warn)" : tone === "ink" ? "var(--foreground)" : "var(--muted-foreground)";
