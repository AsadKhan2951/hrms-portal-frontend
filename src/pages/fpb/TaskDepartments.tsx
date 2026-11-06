import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Check, Crown, Loader2, Pencil } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/pages/fpb/shared";

const NOBODY = "__nobody__";

/**
 * Which departments a task is with, who owns it, and who each department's
 * head put on it. The project manager chooses the departments; each head
 * chooses the person from their own department. Nobody else can do either.
 */
export function TaskDepartments({
  task, myId, orgWide, canEditDepartments, tokens, onChanged,
}: {
  task: any;
  myId: string | null;
  orgWide: boolean;
  /** The project manager (or an admin): may change the departments. */
  canEditDepartments: boolean;
  tokens: any;
  onChanged: () => void;
}) {
  const { data: departments = [] } = trpc.fpb.getDepartments.useQuery();
  const taskDepartments: string[] = ((task?.departmentIds ?? []) as any[]).map(String);
  const ownerId = task?.ownerDepartmentId ? String(task.ownerDepartmentId) : taskDepartments[0] ?? null;
  const assignees: { departmentId: string; userId: string }[] = ((task?.assignees ?? []) as any[]).map(a => ({
    departmentId: String(a.departmentId),
    userId: String(a.userId),
  }));
  const onTask = (departments as any[]).filter(d => taskDepartments.includes(d.id));

  const onError = (e: any) => toast.error(e?.message || "Something went wrong");
  const assign = trpc.fpb.assignForDepartment.useMutation({
    onSuccess: () => { onChanged(); toast.success("Assigned"); },
    onError,
  });
  const setDepartments = trpc.fpb.setTaskDepartments.useMutation({
    onSuccess: () => { onChanged(); toast.success("Departments updated"); },
    onError,
  });

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${tokens.textPrimary}`}>
          <Building2 className="mr-1 -mt-0.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Departments
        </h3>
        {canEditDepartments && (
          <DepartmentEditor
            departments={departments as any[]}
            current={taskDepartments}
            ownerId={ownerId}
            busy={setDepartments.isPending}
            tokens={tokens}
            onSave={(ids, owner) => setDepartments.mutate({ taskId: String(task.id), departmentIds: ids, ownerDepartmentId: owner ?? undefined })}
          />
        )}
      </div>

      {onTask.length === 0 ? (
        <p className={`text-xs ${tokens.textMuted}`}>
          Not with any department yet.
          {canEditDepartments ? " Use Edit to send it to one or more departments." : ""}
        </p>
      ) : (
        <div className="space-y-2">
          {onTask.map(d => {
            const mineToAssign = orgWide || (d.headUserId && d.headUserId === myId);
            const current = assignees.find(a => a.departmentId === d.id)?.userId ?? null;
            return (
              <div key={d.id} className={`rounded-xl border p-2.5 ${tokens.border}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">{d.name}</span>
                  {ownerId === d.id && onTask.length > 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                      <Crown className="h-3 w-3" aria-hidden="true" /> Owner
                    </span>
                  )}
                  <span className={tokens.textMuted}>
                    Head: {d.headName ?? "none yet"}
                  </span>
                </div>
                <div className="mt-2">
                  {mineToAssign ? (
                    <DepartmentAssignee
                      departmentId={d.id}
                      value={current}
                      busy={assign.isPending}
                      tokens={tokens}
                      onPick={userId => assign.mutate({ taskId: String(task.id), departmentId: d.id, userId })}
                    />
                  ) : (
                    <AssigneeLabel userId={current} tokens={tokens} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AssigneeLabel({ userId, tokens }: { userId: string | null; tokens: any }) {
  const { data: users = [] } = trpc.fpb.getUsers.useQuery();
  const person = userId ? (users as any[]).find(u => u.id === userId) : null;
  if (!person) {
    return <span className={`text-xs ${tokens.textMuted}`}>Waiting for the head to assign someone</span>;
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <Avatar user={person} size={18} /> {person.name}
    </span>
  );
}

/** The head's own picker: only people from their department. */
function DepartmentAssignee({
  departmentId, value, busy, tokens, onPick,
}: {
  departmentId: string;
  value: string | null;
  busy: boolean;
  tokens: any;
  onPick: (userId: string | null) => void;
}) {
  const { data: people = [], isLoading } = trpc.fpb.getDepartmentPeople.useQuery({ departmentId });
  return (
    <Select
      value={value ?? NOBODY}
      disabled={busy || isLoading}
      onValueChange={v => onPick(v === NOBODY ? null : v)}
    >
      <SelectTrigger className={`h-8 text-xs ${tokens.select}`}>
        <SelectValue placeholder="Assign someone" />
      </SelectTrigger>
      <SelectContent className={tokens.selectContent}>
        <SelectItem value={NOBODY} className="text-xs">Nobody yet</SelectItem>
        {(people as any[]).map(p => (
          <SelectItem key={p.id} value={p.id} className="text-xs">
            <span className="flex items-center gap-2">
              <Avatar user={p} size={16} /> {p.name}
              {p.position ? <span className="opacity-60">· {p.position}</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The project manager's control: which departments, and which one owns it. */
function DepartmentEditor({
  departments, current, ownerId, busy, tokens, onSave,
}: {
  departments: any[];
  current: string[];
  ownerId: string | null;
  busy: boolean;
  tokens: any;
  onSave: (ids: string[], owner: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(current);
  const [owner, setOwner] = useState<string | null>(ownerId);
  const chosen = useMemo(() => departments.filter(d => picked.includes(d.id)), [departments, picked]);
  const effectiveOwner = chosen.find(d => d.id === owner)?.id ?? chosen[0]?.id ?? null;

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (o) { setPicked(current); setOwner(ownerId); }
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className={`h-7 text-xs ${tokens.btnGhost}`}>
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={`w-72 p-3 ${tokens.selectContent}`}>
        <p className={`pb-2 text-xs font-semibold ${tokens.textMuted}`}>Send this task to</p>
        <div className="flex flex-wrap gap-1.5">
          {departments.map(d => {
            const on = picked.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(list => (on ? list.filter(x => x !== d.id) : [...list, d.id]))}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  on ? "border-[#4233e0] bg-[#4233e0] text-white" : `${tokens.border} ${tokens.textSecondary}`
                }`}
              >
                {on && <Check className="h-3 w-3" />} {d.name}
              </button>
            );
          })}
        </div>
        {chosen.length > 1 && (
          <div className="mt-3">
            <p className={`pb-1 text-xs ${tokens.textMuted}`}>Owner department</p>
            <Select value={effectiveOwner ?? ""} onValueChange={setOwner}>
              <SelectTrigger className={`h-8 text-xs ${tokens.select}`}><SelectValue /></SelectTrigger>
              <SelectContent className={tokens.selectContent}>
                {chosen.map(d => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={picked.length === 0 || busy}
            onClick={() => { onSave(picked, effectiveOwner); setOpen(false); }}
            className="h-8 bg-[#4233e0] text-xs text-white hover:bg-[#2a1fb0]"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
