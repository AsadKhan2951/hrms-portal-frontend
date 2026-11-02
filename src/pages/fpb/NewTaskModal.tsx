import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, FileText, Loader2, Paperclip, X } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, type Priority } from "@/pages/fpb/shared";
import { MarkdownEditor } from "./MarkdownEditor";
import { MAX_ATTACHMENT_BYTES, formatBytes, uploadTaskFile } from "./TaskAttachments";

/**
 * Creates a card, with everything a card can carry from the start: a formatted
 * description with @mentions, labels, the people on it, a due date and files.
 */
export function NewTaskModal({
  open, onClose, projectId, subprojectId, columnId, projectTitle, subprojectName,
  members, users, tokens, labels = [], projectOwnerId,
}: {
  open: boolean; onClose: () => void; projectId: string;
  subprojectId: string | null; columnId: string | null;
  projectTitle: string; subprojectName?: string;
  members: string[]; users: any[]; tokens: any;
  /** The project's labels. */
  labels?: any[];
  /** The project's creator, who is on the project too. */
  projectOwnerId?: string | null;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [targetColumn, setTargetColumn] = useState<string>(columnId ?? "");
  const [uploading, setUploading] = useState(false);

  const { data: board } = trpc.fpb.getBoard.useQuery(
    { projectId },
    { enabled: open && Boolean(projectId) }
  );
  const columns = (board?.columns ?? []) as any[];

  // Follow whichever column's "+" was clicked, each time the dialog opens.
  useEffect(() => {
    if (open && columnId) setTargetColumn(columnId);
  }, [open, columnId]);

  // The project's people: assignable, can be put on the card, can be @mentioned.
  const people = useMemo(() => {
    const ids = new Set([...(members ?? []), ...(projectOwnerId ? [projectOwnerId] : [])]);
    return users.filter(u => ids.has(u.id));
  }, [users, members, projectOwnerId]);

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("medium");
    setDueDate(""); setAssignedTo(""); setMemberIds([]); setLabelIds([]); setFiles([]);
  };
  const close = () => { reset(); onClose(); };

  const refresh = () => {
    utils.fpb.getBoard.invalidate({ projectId });
    utils.fpb.getProjects.invalidate();
  };

  const create = trpc.fpb.createTask.useMutation({
    onError: (e: any) => toast.error(e?.message || "Could not add the task"),
  });

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next: File[] = [];
    for (const file of Array.from(picked)) {
      if (file.size > MAX_ATTACHMENT_BYTES) toast.error(`${file.name} is larger than 10 MB`);
      else next.push(file);
    }
    setFiles(f => [...f, ...next]);
  };

  const submit = async () => {
    if (!title.trim() || create.isPending || uploading) return;
    let task: any;
    try {
      task = await create.mutateAsync({
        projectId,
        subprojectId: subprojectId || undefined,
        columnId: targetColumn || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : undefined,
        assignedTo: assignedTo || undefined,
        memberIds: [...new Set([...(assignedTo ? [assignedTo] : []), ...memberIds])],
        labelIds: labelIds.length ? labelIds : undefined,
      });
    } catch {
      return; // onError already said why
    }

    // Files go up once the card exists.
    let failed = 0;
    if (files.length > 0 && task?.id) {
      setUploading(true);
      for (const file of files) {
        try {
          await uploadTaskFile(String(task.id), file);
        } catch (error) {
          failed += 1;
          toast.error(error instanceof Error ? error.message : `Could not upload ${file.name}`);
        }
      }
      setUploading(false);
    }

    refresh();
    const who = assignedTo ? users.find(u => u.id === assignedTo)?.name : null;
    toast.success(
      failed > 0
        ? "Task created, but some files did not upload. Open the card to try again."
        : who
          ? `Task created. ${who} has been notified.`
          : "Task created"
    );
    close();
  };

  const busy = create.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) close(); }}>
      <DialogContent className={`${tokens.dialog} max-w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-semibold">Create task</DialogTitle>
          <DialogDescription className={tokens.textMuted}>
            in {projectTitle}{subprojectName ? ` · ${subprojectName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Title *</label>
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className={tokens.input}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
              }}
            />
          </div>

          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Description</label>
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              people={people}
              tokens={tokens}
              rows={5}
              placeholder="Details, a checklist, links... Type @ to mention someone."
              onSubmit={() => void submit()}
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
                  {people.length === 0 ? (
                    <SelectItem value="__none" disabled>Add team members first</SelectItem>
                  ) : (
                    people.map(u => (
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
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Due date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={tokens.input}
              />
            </div>
          </div>

          {/* People on the card besides the assignee */}
          {people.length > 0 && (
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Members</label>
              <div className="flex flex-wrap gap-1.5">
                {people.map(u => {
                  const on = memberIds.includes(u.id) || u.id === assignedTo;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={u.id === assignedTo}
                      onClick={() => setMemberIds(m => toggle(m, u.id))}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                        on ? "bg-[#4233e0] border-[#4233e0] text-white" : `${tokens.border} ${tokens.textSecondary}`
                      }`}
                    >
                      <Avatar user={u} size={16} /> {u.name || u.employeeId}
                      {on && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Labels */}
          {labels.length > 0 && (
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map(l => {
                  const on = labelIds.includes(String(l.id));
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLabelIds(ids => toggle(ids, String(l.id)))}
                      className={`fpb-label ${on ? "ring-2 ring-offset-1 ring-[#4233e0]" : "opacity-60"}`}
                      style={{ backgroundColor: l.color }}
                      aria-pressed={on}
                    >
                      {on && <Check className="w-3 h-3 mr-1" />}
                      {l.name || " "}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs ${tokens.textMuted}`}>Attachments</label>
              <label
                htmlFor="fpb-new-task-files"
                className={`cursor-pointer rounded px-2 py-1 text-xs font-semibold ${tokens.tagBg}`}
              >
                <Paperclip className="inline w-3 h-3 mr-1 -mt-0.5" /> Add files
              </label>
              <input
                id="fpb-new-task-files"
                type="file"
                multiple
                className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              className={`rounded-lg border border-dashed p-2 ${tokens.border}`}
            >
              {files.length === 0 ? (
                <label htmlFor="fpb-new-task-files" className={`block cursor-pointer py-2 text-center text-xs ${tokens.textMuted}`}>
                  Drop files here or click to attach (any format, up to 10 MB)
                </label>
              ) : (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs">
                      <FileText className={`w-3.5 h-3.5 ${tokens.textMuted}`} />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className={tokens.textMuted}>{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles(list => list.filter((_, j) => j !== i))}
                        className="p-0.5 text-slate-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {people.length === 0 && (
            <p className="text-xs text-amber-500">
              Nobody is on this project yet. Add people from Manage team before assigning work.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={close} disabled={busy} className={tokens.btnGhost}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={!title.trim() || busy}
              className="bg-[#4233e0] hover:bg-[#2a1fb0] text-white"
            >
              {busy
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploading ? "Uploading files..." : "Creating..."}</>
                : "Create task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
