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
  { value: "dev", label: "Development / Design / Software", short: "Development", icon: <Code2 className="w-4 h-4" />, color: "text-violet-400" },
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
