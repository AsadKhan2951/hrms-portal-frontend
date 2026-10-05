import { Briefcase, Code2, DollarSign, Layers, Lightbulb } from "lucide-react";

/**
 * Shared board vocabulary.
 *
 * Lives in its own module because the board renders the project view and the
 * project view uses these constants; importing them from each other would be a
 * cycle, which ES modules resolve by handing one side a partly-initialised
 * module.
 */

export type ProjectType = "dev" | "lead" | "management" | "accounting" | "other";
export type Priority = "low" | "medium" | "high" | "urgent";

export const PROJECT_TYPES: {
  value: ProjectType; label: string; short: string; icon: React.ReactNode; color: string;
}[] = [
  { value: "dev", label: "Development / Design / Software", short: "Development", icon: <Code2 className="w-4 h-4" />, color: "text-[#8f86ff]" },
  { value: "lead", label: "Lead & New Business", short: "Lead", icon: <Briefcase className="w-4 h-4" />, color: "text-blue-400" },
  { value: "management", label: "Management / Ideas", short: "Management", icon: <Lightbulb className="w-4 h-4" />, color: "text-amber-400" },
  { value: "accounting", label: "Accounting", short: "Accounting", icon: <DollarSign className="w-4 h-4" />, color: "text-emerald-400" },
  { value: "other", label: "Others", short: "Other", icon: <Layers className="w-4 h-4" />, color: "text-slate-400" },
];

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-slate-500/20 text-slate-400",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-amber-500/20 text-amber-400",
  urgent: "bg-red-500/20 text-red-400",
};

export const COLUMN_COLORS = [
  "#6366f1", "#3b82f6", "#f59e0b", "#8b5cf6", "#10b981",
  "#ef4444", "#ec4899", "#14b8a6", "#f97316", "#6b7280",
];

export const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
};

export function getTypeInfo(type: string) {
  return PROJECT_TYPES.find(t => t.value === type) ?? PROJECT_TYPES[4];
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function initialOf(user: any) {
  return String(user?.name || user?.employeeId || "?").charAt(0).toUpperCase();
}

export function Avatar({ user, size = 20 }: { user: any; size?: number }) {
  return (
    <span
      title={user?.name}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="rounded-full bg-gradient-to-br from-[#4233e0] to-[#8f86ff] inline-flex items-center justify-center text-white font-bold flex-shrink-0"
    >
      {initialOf(user)}
    </span>
  );
}

/** "FH" for Fayyaz Hussain; one letter when there is only one name. */
export function initialsOf(user: any) {
  const words = String(user?.name || user?.employeeId || "?").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const DAY_MS = 86400000;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function startOfDay(value: string | Date) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isTaskDone(task: any) {
  return Boolean(task?.completed) || task?.status === "done";
}

/** Whole days a task is past its due date; 0 when it is not late. */
export function daysOverdue(task: any) {
  if (!task?.dueDate || isTaskDone(task)) return 0;
  return Math.max(0, Math.round((startOfToday() - startOfDay(task.dueDate)) / DAY_MS));
}

export type TaskTagTone = "muted" | "late" | "review" | "done";

/** The one line under a card's title: the thing most worth knowing about it. */
export function taskTag(task: any): { label: string; tone: TaskTagTone } {
  if (isTaskDone(task)) return { label: "Done", tone: "done" };
  const late = daysOverdue(task);
  if (late > 0) return { label: `Overdue ${late} day${late === 1 ? "" : "s"}`, tone: "late" };
  if (task.status === "blocked") return { label: "Blocked", tone: "late" };
  if (task.status === "in_review") return { label: "In review", tone: "review" };
  if (task.dueDate) {
    const ahead = Math.round((startOfDay(task.dueDate) - startOfToday()) / DAY_MS);
    if (ahead === 0) return { label: "Due today", tone: "muted" };
    if (ahead === 1) return { label: "Due tomorrow", tone: "muted" };
    if (ahead < 7) {
      return { label: `Due ${new Date(task.dueDate).toLocaleDateString("en-GB", { weekday: "short" })}`, tone: "muted" };
    }
    return { label: `Due ${formatDate(task.dueDate)}`, tone: "muted" };
  }
  return { label: "No due date", tone: "muted" };
}

/** The four figures above the board, worked out from the tasks on show. */
export function boardStats(tasks: any[], myId: string | null) {
  const open = tasks.filter(task => !isTaskDone(task));
  const overdue = open.filter(task => daysOverdue(task) > 0);
  const blocked = open.filter(task => task.status === "blocked");
  const done = tasks.length - open.length;
  const dueThisWeek = open.filter(task => {
    if (!task.dueDate) return false;
    const ahead = Math.round((startOfDay(task.dueDate) - startOfToday()) / DAY_MS);
    return ahead >= 0 && ahead < 7;
  });
  const mine = myId ? open.filter(task => String(task.assignedTo ?? "") === myId) : [];
  const oldest = [...overdue].sort((a, b) => startOfDay(a.dueDate) - startOfDay(b.dueDate))[0] ?? null;
  return {
    total: tasks.length,
    done,
    progress: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
    overdue: overdue.length,
    blocked: blocked.length,
    dueThisWeek: dueThisWeek.length,
    mine: mine.length,
    mineOverdue: mine.filter(task => daysOverdue(task) > 0).length,
    oldestOverdue: oldest,
  };
}
