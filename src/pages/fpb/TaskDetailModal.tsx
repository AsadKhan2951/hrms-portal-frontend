import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

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
import {
  Avatar, PRIORITY_COLORS, STATUS_LABELS, formatDate, type Priority,
} from "@/pages/fpb/shared";

/**
 * A task card opened up: description, status, assignee, subtasks and comments.
 * A dialog rather than a route, so the board never leaves the screen.
 */
export function TaskDetailModal({
  taskId, onClose, projectId, members, users, tokens,
}: {
  taskId: string | null; onClose: () => void; projectId: string;
  members: string[]; users: any[]; tokens: any;
}) {
  const utils = trpc.useUtils();
  const open = taskId !== null;

  const { data, isLoading } = trpc.fpb.getTask.useQuery(
    { id: taskId ?? "" },
    { enabled: open, retry: false }
  );

  const task = data?.task as any;
  const subtasks = (data?.subtasks ?? []) as any[];
  const comments = (data?.comments ?? []) as any[];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [commentText, setCommentText] = useState("");

  // Load the server's copy whenever a different task is opened; local edits
  // are only kept while that same task stays open.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
  }, [task?.id]);

  const onError = (e: any) => toast.error(e?.message || "Something went wrong");
  const refresh = () => {
    utils.fpb.getTask.invalidate({ id: taskId ?? "" });
    utils.fpb.getBoard.invalidate({ projectId });
    utils.fpb.getProjects.invalidate();
  };

  const updateTask = trpc.fpb.updateTask.useMutation({ onSuccess: refresh, onError });
  const deleteTask = trpc.fpb.deleteTask.useMutation({
    onSuccess: () => { refresh(); toast.success("Task deleted"); onClose(); },
    onError,
  });
  const createSubtask = trpc.fpb.createSubtask.useMutation({
    onSuccess: () => { refresh(); setNewSubtask(""); }, onError,
  });
  const updateSubtask = trpc.fpb.updateSubtask.useMutation({ onSuccess: refresh, onError });
  const deleteSubtask = trpc.fpb.deleteSubtask.useMutation({ onSuccess: refresh, onError });
  const addComment = trpc.fpb.addTaskComment.useMutation({
    onSuccess: () => { refresh(); setCommentText(""); }, onError,
  });
  const deleteComment = trpc.fpb.deleteTaskComment.useMutation({ onSuccess: refresh, onError });

  const assignable = users.filter(u => members.includes(u.id));
  const doneSubs = subtasks.filter(s => s.completed).length;

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!task || !trimmed || trimmed === task.title) return;
    updateTask.mutate({ id: task.id, title: trimmed });
  };
  const saveDescription = () => {
    if (!task || description === (task.description ?? "")) return;
    updateTask.mutate({ id: task.id, description });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${tokens.dialog} max-w-2xl max-h-[90vh] overflow-y-auto`}>
        {isLoading || !task ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className={`w-5 h-5 animate-spin ${tokens.textMuted}`} />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">{task.title}</DialogTitle>
              <DialogDescription className="sr-only">Task details</DialogDescription>
              <div className="flex items-start gap-2.5 pr-8">
                <button
                  aria-label={task.completed ? "Mark as not done" : "Mark as done"}
                  onClick={() => updateTask.mutate({ id: task.id, completed: !task.completed })}
                  className={`mt-1.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                    task.completed ? "bg-emerald-500 border-emerald-500" : `${tokens.border} hover:border-violet-400`
                  }`}
                >
                  {task.completed && <Check className="w-2.5 h-2.5 text-white" />}
                </button>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className={`flex-1 bg-transparent text-lg font-semibold outline-none rounded px-1 -mx-1 ${
                    tokens.textPrimary
                  } ${task.completed ? "line-through opacity-60" : ""} focus:bg-white/5`}
                />
              </div>
            </DialogHeader>

            <div className="space-y-5 mt-1">
              {/* Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Status</label>
                  <Select
                    value={task.status}
                    onValueChange={v => updateTask.mutate({ id: task.id, status: v as any })}
                  >
                    <SelectTrigger className={`h-8 text-xs ${tokens.select}`}><SelectValue /></SelectTrigger>
                    <SelectContent className={tokens.selectContent}>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Priority</label>
                  <Select
                    value={task.priority}
                    onValueChange={v => updateTask.mutate({ id: task.id, priority: v as Priority })}
                  >
                    <SelectTrigger className={`h-8 text-xs ${tokens.select}`}><SelectValue /></SelectTrigger>
                    <SelectContent className={tokens.selectContent}>
                      {(["low", "medium", "high", "urgent"] as Priority[]).map(p => (
                        <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Assignee</label>
                  <Select
                    value={task.assignedTo ?? ""}
                    onValueChange={v => updateTask.mutate({ id: task.id, assignedTo: v })}
                  >
                    <SelectTrigger className={`h-8 text-xs ${tokens.select}`}>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent className={tokens.selectContent}>
                      {assignable.length === 0 ? (
                        <SelectItem value="__none" disabled>No team members</SelectItem>
                      ) : (
                        assignable.map(u => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            <span className="flex items-center gap-2">
                              <Avatar user={u} size={16} /> {u.name || u.employeeId}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
                  PRIORITY_COLORS[task.priority as Priority] ?? PRIORITY_COLORS.medium
                }`}>
                  {task.priority}
                </span>
                {task.dueDate && (
                  <span className={`text-xs ${tokens.textMuted}`}>Due {formatDate(task.dueDate)}</span>
                )}
                <Input
                  type="date"
                  value={task.dueDate ? String(task.dueDate).slice(0, 10) : ""}
                  onChange={e =>
                    updateTask.mutate({
                      id: task.id,
                      dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null,
                    })
                  }
                  className={`h-7 w-36 text-xs ${tokens.input}`}
                />
              </div>

              {/* Description */}
              <div>
                <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Description</label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  placeholder="Add more detail..."
                  rows={3}
                  className={`${tokens.input} resize-none text-sm`}
                />
              </div>

              {/* Subtasks */}
              <div>
                <label className={`text-xs mb-1.5 block ${tokens.textMuted}`}>
                  Subtasks {subtasks.length > 0 && `(${doneSubs}/${subtasks.length})`}
                </label>
                <div className="space-y-1.5">
                  {subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => updateSubtask.mutate({ id: sub.id, completed: !sub.completed })}
                        className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                          sub.completed ? "bg-emerald-500 border-emerald-500" : tokens.border
                        }`}
                      >
                        {sub.completed && <Check className="w-2 h-2 text-white" />}
                      </button>
                      <span className={`text-xs flex-1 ${
                        sub.completed ? `line-through ${tokens.textMuted}` : tokens.textSecondary
                      }`}>
                        {sub.title}
                      </span>
                      <button
                        onClick={() => deleteSubtask.mutate({ id: sub.id })}
                        className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    placeholder="Add a subtask..."
                    className={`h-7 text-xs ${tokens.input}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newSubtask.trim()) {
                        createSubtask.mutate({ taskId: task.id, title: newSubtask.trim() });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!newSubtask.trim()}
                    onClick={() => createSubtask.mutate({ taskId: task.id, title: newSubtask.trim() })}
                    className={`h-7 ${tokens.btnOutline}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className={`text-xs mb-1.5 block ${tokens.textMuted}`}>
                  Comments {comments.length > 0 && `(${comments.length})`}
                </label>
                <div className="space-y-2.5">
                  {comments.map(c => {
                    const author = users.find(u => u.id === c.userId);
                    return (
                      <div key={c.id} className="flex items-start gap-2 group">
                        <Avatar user={author} size={20} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] ${tokens.textMuted}`}>
                            {author?.name ?? "Someone"} · {new Date(c.createdAt).toLocaleString()}
                          </p>
                          <p className={`text-xs whitespace-pre-wrap ${tokens.textSecondary}`}>
                            {c.comment}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteComment.mutate({ id: c.id })}
                          className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className={`h-8 text-xs ${tokens.input}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" && commentText.trim()) {
                        addComment.mutate({ taskId: task.id, comment: commentText.trim() });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!commentText.trim() || addComment.isPending}
                    onClick={() => addComment.mutate({ taskId: task.id, comment: commentText.trim() })}
                    className="h-8 bg-violet-600 hover:bg-violet-700 text-white text-xs"
                  >
                    Send
                  </Button>
                </div>
              </div>

              <div className={`flex justify-between items-center pt-3 border-t ${tokens.border}`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirm("Delete this task?") && deleteTask.mutate({ id: task.id })}
                  className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Task
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose} className={tokens.btnGhost}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
