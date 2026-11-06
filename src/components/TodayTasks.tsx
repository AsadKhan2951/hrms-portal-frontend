import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS } from "@/pages/fpb/shared";

export type TodaySummary = {
  /** Board tasks finished today, as work-log lines. */
  doneLines: string[];
  /** Open tasks moved or worked on today, as work-log lines. */
  progressLines: string[];
};

const STAGES = ["backlog", "todo", "in_progress", "in_review", "blocked", "done"];

/**
 * Clock-out's "what did you do today": the caller's board tasks finished
 * today, their open tasks (each can be moved to its stage right here), and a
 * quick way to log something done today that is not on the board yet.
 */
export function TodayTasks({ onSummary }: { onSummary: (summary: TodaySummary) => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.fpb.getMyDay.useQuery();
  const { data: projects = [] } = trpc.fpb.getProjects.useQuery();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [done, setDone] = useState(true);

  const day = data as any;
  const doneToday = (day?.doneToday ?? []) as any[];
  const open = (day?.open ?? []) as any[];

  useEffect(() => {
    if (!projectId && (projects as any[]).length > 0) setProjectId(String((projects as any[])[0].id));
  }, [projects, projectId]);

  const summary = useMemo<TodaySummary>(() => ({
    doneLines: doneToday.map(t => `[${t.projectTitle}] ${t.title} (done)`),
    progressLines: open
      .filter(t => t.touchedToday)
      .map(t => `[${t.projectTitle}] ${t.title} (${STATUS_LABELS[t.status] ?? t.status})`),
    // Keyed on the query data, not the derived arrays, so a render with no data
    // does not hand the parent a "new" summary every time (and loop).
  }), [data]);
  useEffect(() => { onSummary(summary); }, [summary]);

  const refresh = () => {
    utils.fpb.getMyDay.invalidate();
    utils.fpb.getBoard.invalidate();
    utils.fpb.getDepartmentBoard.invalidate();
  };
  const setStage = trpc.fpb.setTaskStage.useMutation({
    onSuccess: () => { refresh(); toast.success("Task updated"); },
    onError: (e: any) => toast.error(e?.message || "Could not update the task"),
  });
  const logWork = trpc.fpb.logMyWork.useMutation({
    onSuccess: () => { refresh(); setTitle(""); toast.success("Added to today's work"); },
    onError: (e: any) => toast.error(e?.message || "Could not add the task"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your tasks
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">
          Done today <span className="font-normal text-muted-foreground">({doneToday.length})</span>
        </p>
        {doneToday.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">Nothing marked done on the board today.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {doneToday.map(t => (
              <li key={t.id} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span className="min-w-0">
                  <span className="block font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.projectTitle}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open.length > 0 && (
        <div>
          <p className="text-sm font-semibold">
            Still open <span className="font-normal text-muted-foreground">({open.length})</span>
          </p>
          <p className="text-xs text-muted-foreground">Update where each one stands before you leave.</p>
          <ul className="mt-2 space-y-1.5">
            {open.map(t => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t.projectTitle}{t.touchedToday ? " · worked on today" : ""}
                  </span>
                </span>
                <Select
                  value={STAGES.includes(t.status) ? t.status : "todo"}
                  disabled={setStage.isPending}
                  onValueChange={v => setStage.mutate({ taskId: t.id, status: v as any })}
                >
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {/* A department task is finished by its owner department's
                        head, so its people send it for review instead. */}
                    {STAGES.filter(s => !(t.departmentTask && s === "done")).map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-semibold">Add something you did today</p>
        <p className="text-xs text-muted-foreground">For work that is not on the board yet. It is added to your project and assigned to you.</p>
        {(projects as any[]).length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">You are not on any project yet.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                {(projects as any[]).map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What did you do?"
              className="h-9"
            />
            <Select value={done ? "done" : "in_progress"} onValueChange={v => setDone(v === "done")}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              className="now-btn ink sm"
              disabled={!title.trim() || !projectId || logWork.isPending}
              onClick={() => logWork.mutate({ projectId, title: title.trim(), done })}
            >
              {logWork.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 inline h-4 w-4" />Add</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
