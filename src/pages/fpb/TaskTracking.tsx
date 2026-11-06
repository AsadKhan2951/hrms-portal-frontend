import { History, Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Switch } from "@/components/ui/switch";
import { STATUS_LABELS, TASK_STAGES, formatDuration } from "@/pages/fpb/shared";

/**
 * The card's tracking history. Everything that happens to a task is recorded
 * from the moment it is created; this switch only shows the timeline: each
 * stage it went through, when, who moved it, and how long it stayed.
 */
export function TaskTracking({
  task, tokens, onToggle, busy,
}: {
  task: any;
  tokens: any;
  onToggle: (on: boolean) => void;
  busy: boolean;
}) {
  const on = Boolean(task?.trackingEnabled);
  const { data, isLoading } = trpc.fpb.getTaskTracking.useQuery(
    { taskId: String(task?.id ?? "") },
    { enabled: on && Boolean(task?.id) }
  );
  const tracking = data as any;
  const totals: Record<string, number> = tracking?.totals ?? {};
  const totalMs = Object.values(totals).reduce((n, v) => n + v, 0);
  const color = (status: string) => TASK_STAGES.find(s => s.value === status)?.color ?? "#ef4444";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${tokens.textPrimary}`}>
          <History className="mr-1 -mt-0.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Tracking history
        </h3>
        <label className="flex items-center gap-2 text-xs">
          <span className={tokens.textMuted}>{on ? "On" : "Off"}</span>
          <Switch checked={on} disabled={busy} onCheckedChange={v => onToggle(Boolean(v))} aria-label="Show tracking history" />
        </label>
      </div>

      {!on ? (
        <p className={`text-xs ${tokens.textMuted}`}>
          Turn on to see every stage this task went through and how long it stayed in each.
        </p>
      ) : isLoading ? (
        <div className={`flex items-center gap-2 text-xs ${tokens.textMuted}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history
        </div>
      ) : (
        <div className="space-y-3">
          {/* Time per stage */}
          {totalMs > 0 && (
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden="true">
                {Object.entries(totals).map(([status, ms]) => (
                  <span key={status} style={{ width: `${(ms / totalMs) * 100}%`, background: color(status) }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {Object.entries(totals).map(([status, ms]) => (
                  <span key={status} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: color(status) }} />
                    {STATUS_LABELS[status] ?? status}: <strong>{formatDuration(ms)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Each change */}
          <ol className="space-y-1.5 text-xs">
            {((tracking?.events ?? []) as any[]).map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-1.5">
                <span className={tokens.textMuted}>{new Date(e.at).toLocaleString()}</span>
                <span className="font-medium">{e.userName}</span>
                <span>
                  {e.fromStatus
                    ? <>moved it from <strong>{STATUS_LABELS[e.fromStatus] ?? e.fromStatus}</strong> to <strong>{STATUS_LABELS[e.toStatus] ?? e.toStatus}</strong></>
                    : <>created it in <strong>{STATUS_LABELS[e.toStatus] ?? e.toStatus}</strong></>}
                </span>
              </li>
            ))}
            {((tracking?.events ?? []) as any[]).length === 0 && (
              <li className={tokens.textMuted}>No stage changes recorded yet.</li>
            )}
          </ol>
        </div>
      )}
    </section>
  );
}
