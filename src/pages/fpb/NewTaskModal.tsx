import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, type Priority } from "@/pages/fpb/shared";

/**
 * Creates a task card inside one column of a project's board. Opened as a
 * dialog from the column header or the board toolbar — never its own page.
 */
export function NewTaskModal({
  open, onClose, projectId, columnId, projectTitle, members, users, tokens,
}: {
  open: boolean; onClose: () => void; projectId: string; columnId: string | null;
  projectTitle: string; members: string[]; users: any[]; tokens: any;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [targetColumn, setTargetColumn] = useState<string>(columnId ?? "");

  const { data: board } = trpc.fpb.getBoard.useQuery(
    { projectId },
    { enabled: open && Boolean(projectId) }
  );
  const columns = (board?.columns ?? []) as any[];

  // Follow whichever column's "+" was clicked, each time the dialog opens.
  useEffect(() => {
    if (open && columnId) setTargetColumn(columnId);
  }, [open, columnId]);

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("medium");
    setDueDate(""); setAssignedTo("");
  };

  const create = trpc.fpb.createTask.useMutation({
    onSuccess: () => {
      utils.fpb.getBoard.invalidate({ projectId });
      utils.fpb.getProjects.invalidate();
      toast.success(
        assignedTo
          ? `Task created. ${users.find(u => u.id === assignedTo)?.name ?? "They"} has been notified.`
          : "Task created"
      );
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Could not add the task"),
  });

  // Only people on the project can be assigned its work; this mirrors the API.
  const assignable = users.filter(u => members.includes(u.id));

  const submit = () => {
    if (!title.trim()) return;
    create.mutate({
      projectId,
      columnId: targetColumn || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : undefined,
      assignedTo: assignedTo || undefined,
      memberIds: assignedTo ? [assignedTo] : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className={`${tokens.dialog} max-w-lg max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-semibold">Create Task</DialogTitle>
          <DialogDescription className={tokens.textMuted}>in {projectTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Task Title *</label>
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className={tokens.input}
              onKeyDown={e => {
                // Enter submits from the title field, as most trackers do.
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
            />
          </div>

          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any detail worth capturing..."
              rows={3}
              className={`${tokens.input} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Column</label>
              <Select value={targetColumn} onValueChange={setTargetColumn}>
                <SelectTrigger className={tokens.select}>
                  <SelectValue placeholder="First column" />
                </SelectTrigger>
                <SelectContent className={tokens.selectContent}>
                  {columns.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Assignee</label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className={tokens.select}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className={tokens.selectContent}>
                  {assignable.length === 0 ? (
                    <SelectItem value="__none" disabled>Add team members first</SelectItem>
                  ) : (
                    assignable.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="flex items-center gap-2">
                          <Avatar user={u} size={18} /> {u.name || u.employeeId}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Priority</label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger className={tokens.select}><SelectValue /></SelectTrigger>
                <SelectContent className={tokens.selectContent}>
                  {(["low", "medium", "high", "urgent"] as Priority[]).map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={tokens.input}
              />
            </div>
          </div>

          {assignable.length === 0 && (
            <p className="text-xs text-amber-500">
              Nobody is on this project yet. Add people from Team before assigning work.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { reset(); onClose(); }} className={tokens.btnGhost}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!title.trim() || create.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {create.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
