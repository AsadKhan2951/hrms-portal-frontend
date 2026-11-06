import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft, Calendar, Check, History, Loader2, MessageSquare, Paperclip, Pencil, Plus, Tag,
  Trash2, UserPlus, X,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { isOrgWide } from "@/lib/roles";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Avatar, PRIORITY_COLORS, STATUS_LABELS, formatDate, type Priority,
} from "@/pages/fpb/shared";
import { Markdown } from "./Markdown";
import { MarkdownEditor } from "./MarkdownEditor";
import { toggleChecklistLine } from "./markdownParser";
import { TaskAttachments, attachmentInputId } from "./TaskAttachments";
import { TaskDepartments } from "./TaskDepartments";
import { TaskTracking } from "./TaskTracking";

/** Trello's label palette. */
export const LABEL_COLORS = [
  "#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7", "#3b82f6",
  "#06b6d4", "#84cc16", "#ec4899", "#64748b",
];

/** Activity lines the comment thread already shows, so the feed does not repeat them. */
const COMMENT_ACTIONS = new Set(["commented on", "edited a comment", "deleted a comment"]);

/**
 * A card opened up, laid out like Trello: the card's content on the left
 * (labels, members, description, checklist, comments and history) and the
 * actions on the right. A dialog rather than a route, so the board stays put.
 */
export function TaskDetailModal({
  taskId, onClose, projectId, members, users, tokens, columns = [], labels = [], projectOwnerId,
  canManage: canManageProp,
}: {
  taskId: string | null; onClose: () => void; projectId: string;
  /** The project's members (ids). */
  members: string[]; users: any[]; tokens: any;
  /** The project's columns, for "in list X" and Move. */
  columns?: any[];
  /** The project's labels. */
  labels?: any[];
  /** The project's creator: on the project, so assignable and mentionable. */
  projectOwnerId?: string | null;
  /** Owner, department head or admin: may remove anyone's files and labels. */
  canManage?: boolean;
}) {
  const utils = trpc.useUtils();
  const open = taskId !== null;
  const { user } = useAuth();
  const myId = (user as any)?.id ? String((user as any).id) : null;
  const orgWide = isOrgWide((user as any)?.role);
  const canManageLabels = canManageProp ?? (orgWide || (projectOwnerId ?? "") === myId);

  const { data, isLoading } = trpc.fpb.getTask.useQuery(
    { id: taskId ?? "" },
    { enabled: open, retry: false }
  );

  const task = data?.task as any;
  const subtasks = (data?.subtasks ?? []) as any[];
  const comments = (data?.comments ?? []) as any[];
  const activity = ((data as any)?.activity ?? []) as any[];
  const attachments = ((data as any)?.attachments ?? []) as any[];
  const cardMemberIds = ((data as any)?.memberIds ?? []) as string[];
  // A department task: handed to departments, whose heads assign it.
  const departmentTask = ((task?.departmentIds ?? []) as unknown[]).length > 0;
  const { data: mayCreateProjects = false } = trpc.fpb.canCreateProjects.useQuery(undefined, { enabled: open });
  const canEditDepartments = orgWide || (projectOwnerId ?? "") === myId || Boolean(mayCreateProjects);

  const [title, setTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // Load the server's copy whenever a different task is opened; local edits
  // are only kept while that same task stays open.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setEditingDescription(false);
    setEditingCommentId(null);
    setCommentText("");
  }, [task?.id]);

  const onError = (e: any) => toast.error(e?.message || "Something went wrong");
  const refresh = () => {
    utils.fpb.getTask.invalidate({ id: taskId ?? "" });
    utils.fpb.getBoard.invalidate({ projectId });
    utils.fpb.getProjects.invalidate();
    utils.fpb.getDepartmentBoard.invalidate();
    utils.fpb.getTaskTracking.invalidate({ taskId: taskId ?? "" });
  };

  const updateTask = trpc.fpb.updateTask.useMutation({ onSuccess: refresh, onError });
  const updateMembers = trpc.fpb.updateTaskMembers.useMutation({ onSuccess: refresh, onError });
  const moveTask = trpc.fpb.moveTask.useMutation({
    onSuccess: () => { refresh(); toast.success("Card moved"); },
    onError,
  });
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
  const editComment = trpc.fpb.editTaskComment.useMutation({
    onSuccess: () => { refresh(); setEditingCommentId(null); },
    onError,
  });

  // The project's people: assignable, can be put on the card, can be @mentioned.
  const projectPeople = useMemo(() => {
    const ids = new Set([...(members ?? []), ...(projectOwnerId ? [projectOwnerId] : [])]);
    return users.filter(u => ids.has(u.id));
  }, [users, members, projectOwnerId]);

  const nameOf = (id?: string | null) =>
    id === myId ? "You" : users.find(u => u.id === id)?.name ?? "Someone";

  const column = columns.find(c => String(c.id) === String(task?.columnId));
  const cardLabels = labels.filter(l => (task?.labelIds ?? []).map(String).includes(String(l.id)));
  const cardPeople = users.filter(
    u => u.id === task?.assignedTo || cardMemberIds.includes(u.id)
  );
  const doneSubs = subtasks.filter(s => s.completed).length;
  const liveComments = comments.filter(c => !c.isDeleted).length;

  // Comments and (optionally) the card's history, newest first, like Trello.
  const feed = useMemo(() => {
    const items: { kind: "comment" | "activity"; at: number; data: any }[] = comments.map(c => ({
      kind: "comment" as const, at: new Date(c.createdAt).getTime(), data: c,
    }));
    if (showDetails) {
      for (const a of activity) {
        if (COMMENT_ACTIONS.has(a.action)) continue;
        items.push({ kind: "activity", at: new Date(a.createdAt).getTime(), data: a });
      }
    }
    return items.sort((a, b) => b.at - a.at);
  }, [comments, activity, showDetails]);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!task || !trimmed || trimmed === task.title) return;
    updateTask.mutate({ id: task.id, title: trimmed });
  };
  const startEditingDescription = () => {
    setDescription(task?.description ?? "");
    setEditingDescription(true);
  };
  const cancelDescription = () => {
    setDescription(task?.description ?? "");
    setEditingDescription(false);
  };
  const saveDescription = () => {
    if (!task) return;
    if (description !== (task.description ?? "")) {
      updateTask.mutate({ id: task.id, description });
    }
    setEditingDescription(false);
  };
  const toggleLabel = (labelId: string) => {
    const current: string[] = (task?.labelIds ?? []).map(String);
    const next = current.includes(labelId)
      ? current.filter(id => id !== labelId)
      : [...current, labelId];
    updateTask.mutate({ id: task.id, labelIds: next });
  };
  const toggleMember = (userId: string) => {
    const next = cardMemberIds.includes(userId)
      ? cardMemberIds.filter(id => id !== userId)
      : [...cardMemberIds, userId];
    updateMembers.mutate({ taskId: task.id, memberIds: next });
  };
  const sendComment = () => {
    if (!task || !commentText.trim() || addComment.isPending) return;
    addComment.mutate({ taskId: task.id, comment: commentText.trim() });
  };
  const saveEdit = (id: string) => {
    if (editText.trim()) editComment.mutate({ id, comment: editText.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${tokens.dialog} max-w-[calc(100%-1.5rem)] sm:max-w-4xl max-h-[92vh] overflow-y-auto`}>
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
                    task.completed ? "bg-emerald-500 border-emerald-500" : `${tokens.border} hover:border-[#8f86ff]`
                  }`}
                >
                  {task.completed && <Check className="w-2.5 h-2.5 text-white" />}
                </button>
                <div className="flex-1 min-w-0 text-left">
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    aria-label="Task title"
                    className={`w-full bg-transparent text-lg font-semibold outline-none rounded px-1 -mx-1 ${
                      tokens.textPrimary
                    } ${task.completed ? "line-through opacity-60" : ""} focus:bg-background`}
                  />
                  {column && (
                    <p className={`text-xs ${tokens.textMuted}`}>
                      in list <span className="font-semibold">{column.name}</span>
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_200px] mt-2">
              {/* ───────────────────────────── Main */}
              <div className="space-y-6 min-w-0">
                {/* Members, labels, due date at a glance */}
                {(cardPeople.length > 0 || cardLabels.length > 0 || task.dueDate) && (
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {cardPeople.length > 0 && (
                      <div>
                        <p className={`text-[11px] font-semibold mb-1 ${tokens.textMuted}`}>Members</p>
                        <div className="flex -space-x-1">
                          {cardPeople.map(u => (
                            <span key={u.id} title={`${u.name}${u.id === task.assignedTo ? " (assignee)" : ""}`}>
                              <Avatar user={u} size={28} />
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {cardLabels.length > 0 && (
                      <div>
                        <p className={`text-[11px] font-semibold mb-1 ${tokens.textMuted}`}>Labels</p>
                        <div className="flex flex-wrap gap-1">
                          {cardLabels.map(l => (
                            <span
                              key={l.id}
                              className="fpb-label"
                              style={{ backgroundColor: l.color }}
                              title={l.name || undefined}
                            >
                              {l.name || " "}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {task.dueDate && (
                      <div>
                        <p className={`text-[11px] font-semibold mb-1 ${tokens.textMuted}`}>Due date</p>
                        <span className={`text-xs px-2 py-1 rounded ${tokens.tagBg}`}>{formatDate(task.dueDate)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status, priority, assignee (a department task's people are
                    chosen per department, below) */}
                <div className={`grid gap-3 ${departmentTask ? "grid-cols-2" : "grid-cols-3"}`}>
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
                          <SelectItem key={p} value={p} className="text-xs capitalize">
                            <span className={`px-1.5 rounded ${PRIORITY_COLORS[p]}`}>{p}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!departmentTask && (<div>
                    <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Assignee</label>
                    {/* Only an admin assigns people directly; everyone else
                        sends the task to departments (below). */}
                    <Select
                      value={task.assignedTo ?? ""}
                      disabled={!orgWide}
                      onValueChange={v => updateTask.mutate({ id: task.id, assignedTo: v })}
                    >
                      <SelectTrigger className={`h-8 text-xs ${tokens.select}`}>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent className={tokens.selectContent}>
                        {projectPeople.length === 0 ? (
                          <SelectItem value="__none" disabled>No team members</SelectItem>
                        ) : (
                          projectPeople.map(u => (
                            <SelectItem key={u.id} value={u.id} className="text-xs">
                              <span className="flex items-center gap-2">
                                <Avatar user={u} size={16} /> {u.name || u.employeeId}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>)}
                </div>

                <TaskDepartments
                  task={task}
                  myId={myId}
                  orgWide={orgWide}
                  canEditDepartments={canEditDepartments}
                  tokens={tokens}
                  onChanged={refresh}
                />

                {/* Description */}
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className={`text-sm font-semibold ${tokens.textPrimary}`}>Description</h3>
                    {!editingDescription && task.description && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={startEditingDescription}
                        className={`h-7 text-xs ${tokens.btnGhost}`}
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                  {editingDescription ? (
                    <div className="space-y-2">
                      <MarkdownEditor
                        value={description}
                        onChange={setDescription}
                        people={projectPeople}
                        tokens={tokens}
                        rows={7}
                        autoFocus
                        placeholder="Add a more detailed description... Type @ to mention someone."
                        onSubmit={saveDescription}
                        onCancel={cancelDescription}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm" onClick={saveDescription} disabled={updateTask.isPending}
                          className="h-8 bg-[#4233e0] hover:bg-[#2a1fb0] text-white text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm" variant="ghost" onClick={cancelDescription}
                          className={`h-8 text-xs ${tokens.btnGhost}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : task.description ? (
                    <div
                      className="cursor-text rounded-lg px-1 -mx-1 py-1 hover:bg-background"
                      onClick={startEditingDescription}
                    >
                      <Markdown
                        source={task.description}
                        users={users}
                        // Ticking a checklist box in the description saves straight away.
                        onToggleCheck={line =>
                          updateTask.mutate({
                            id: task.id,
                            description: toggleChecklistLine(task.description ?? "", line),
                          })
                        }
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditingDescription}
                      className={`w-full text-left text-sm rounded-lg px-3 py-3 ${tokens.tagBg} ${tokens.textMuted} hover:text-foreground`}
                    >
                      Add a more detailed description...
                    </button>
                  )}
                </section>

                {/* Files on the card */}
                <TaskAttachments
                  taskId={task.id}
                  attachments={attachments}
                  users={users}
                  tokens={tokens}
                  myId={myId}
                  canManage={canManageLabels}
                  onChanged={refresh}
                />

                {/* Checklist (the card's subtasks) */}
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className={`text-sm font-semibold ${tokens.textPrimary}`}>Checklist</h3>
                    {subtasks.length > 0 && (
                      <span className={`text-xs ${tokens.textMuted}`}>{doneSubs}/{subtasks.length}</span>
                    )}
                  </div>
                  {subtasks.length > 0 && (
                    <div className="now-bar mb-2" aria-hidden="true">
                      <span style={{ width: `${Math.round((doneSubs / subtasks.length) * 100)}%` }} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {subtasks.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2 group">
                        <button
                          aria-label={sub.completed ? "Mark item not done" : "Mark item done"}
                          onClick={() => updateSubtask.mutate({ id: sub.id, completed: !sub.completed })}
                          className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                            sub.completed ? "bg-emerald-500 border-emerald-500" : tokens.border
                          }`}
                        >
                          {sub.completed && <Check className="w-2 h-2 text-white" />}
                        </button>
                        <span className={`text-sm flex-1 ${
                          sub.completed ? `line-through ${tokens.textMuted}` : tokens.textSecondary
                        }`}>
                          {sub.title}
                        </span>
                        <button
                          aria-label="Delete item"
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
                      placeholder="Add an item..."
                      className={`h-8 text-xs ${tokens.input}`}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newSubtask.trim()) {
                          createSubtask.mutate({ taskId: task.id, title: newSubtask.trim() });
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Add item"
                      disabled={!newSubtask.trim()}
                      onClick={() => createSubtask.mutate({ taskId: task.id, title: newSubtask.trim() })}
                      className={`h-8 ${tokens.btnOutline}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </section>

                <TaskTracking
                  task={task}
                  tokens={tokens}
                  busy={updateTask.isPending}
                  onToggle={on => updateTask.mutate({ id: task.id, trackingEnabled: on })}
                />

                {/* Comments and activity */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-semibold ${tokens.textPrimary}`}>
                      <MessageSquare className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-hidden="true" />
                      Comments and activity {liveComments > 0 && `(${liveComments})`}
                    </h3>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setShowDetails(v => !v)}
                      className={`h-7 text-xs ${tokens.btnGhost}`}
                    >
                      {showDetails ? "Hide details" : "Show details"}
                    </Button>
                  </div>

                  <div className="flex items-start gap-2 mb-4">
                    <Avatar user={user} size={24} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <MarkdownEditor
                        value={commentText}
                        onChange={setCommentText}
                        people={projectPeople}
                        tokens={tokens}
                        rows={2}
                        compact
                        placeholder="Write a comment... Type @ to mention someone. Ctrl+Enter to send."
                        onSubmit={sendComment}
                      />
                      {commentText.trim() && (
                        <Button
                          size="sm"
                          disabled={addComment.isPending}
                          onClick={sendComment}
                          className="h-8 bg-[#4233e0] hover:bg-[#2a1fb0] text-white text-xs"
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {feed.map(item => {
                      if (item.kind === "activity") {
                        const a = item.data;
                        return (
                          <div key={`a-${a.id}`} className="flex items-start gap-2">
                            <Avatar user={users.find(u => u.id === a.userId)} size={20} />
                            <p className={`text-xs ${tokens.textMuted}`}>
                              <span className={`font-semibold ${tokens.textSecondary}`}>{nameOf(a.userId)}</span>{" "}
                              {a.action}
                              {a.detail && String(a.action).includes("checklist") ? `: ${a.detail}` : ""}
                              {" · "}{new Date(a.createdAt).toLocaleString()}
                            </p>
                          </div>
                        );
                      }

                      const c = item.data;
                      const author = users.find(u => u.id === c.userId);

                      // A deleted comment keeps its place: who removed it and when.
                      if (c.isDeleted) {
                        return (
                          <div key={c.id} className="flex items-start gap-2">
                            <Avatar user={author} size={24} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] italic ${tokens.textMuted}`}>
                                <Trash2 className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />
                                {c.deletedBy && c.deletedBy !== c.userId
                                  ? `${nameOf(c.deletedBy)} deleted ${author?.name ?? "someone"}'s comment`
                                  : `${nameOf(c.deletedBy ?? c.userId)} deleted this comment`}
                                {c.deletedAt && ` · ${new Date(c.deletedAt).toLocaleString()}`}
                              </p>
                              {/* Org-wide roles still get the original text from the server. */}
                              {orgWide && c.comment && (
                                <div className="text-xs line-through opacity-60">
                                  <Markdown source={c.comment} users={users} />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const mine = c.userId === myId;
                      const editing = editingCommentId === c.id;
                      return (
                        <div key={c.id} className="flex items-start gap-2">
                          <Avatar user={author} size={24} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] ${tokens.textMuted}`}>
                              <span className={`font-semibold ${tokens.textSecondary}`}>{author?.name ?? "Someone"}</span>
                              {" · "}{new Date(c.createdAt).toLocaleString()}
                              {c.editedAt && (
                                <span title={`Edited ${new Date(c.editedAt).toLocaleString()}`}> · (edited)</span>
                              )}
                            </p>
                            {editing ? (
                              <div className="mt-1 space-y-1.5">
                                <MarkdownEditor
                                  value={editText}
                                  onChange={setEditText}
                                  people={projectPeople}
                                  tokens={tokens}
                                  rows={3}
                                  compact
                                  autoFocus
                                  onSubmit={() => saveEdit(c.id)}
                                  onCancel={() => setEditingCommentId(null)}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    disabled={!editText.trim() || editComment.isPending}
                                    onClick={() => saveEdit(c.id)}
                                    className="h-7 bg-[#4233e0] hover:bg-[#2a1fb0] text-white text-xs"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => setEditingCommentId(null)}
                                    className={`h-7 text-xs ${tokens.btnGhost}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className={`mt-0.5 rounded-lg px-2.5 py-1.5 text-sm ${tokens.tagBg} ${tokens.textSecondary}`}>
                                <Markdown source={c.comment} users={users} />
                              </div>
                            )}
                            {/* Earlier versions, for org-wide roles only (the server strips them otherwise). */}
                            {orgWide && Array.isArray(c.edits) && c.edits.length > 0 && !editing && (
                              <details className={`mt-1 text-[11px] ${tokens.textMuted}`}>
                                <summary className="cursor-pointer select-none">
                                  <History className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />
                                  {c.edits.length} earlier version{c.edits.length === 1 ? "" : "s"}
                                </summary>
                                {c.edits.map((e: any, i: number) => (
                                  <p key={i} className="whitespace-pre-wrap mt-1 pl-4">
                                    {new Date(e.editedAt).toLocaleString()}: {e.comment}
                                  </p>
                                ))}
                              </details>
                            )}
                            {!editing && (mine || orgWide) && (
                              <div className={`mt-0.5 flex gap-2 text-[11px] ${tokens.textMuted}`}>
                                {mine && (
                                  <button
                                    type="button"
                                    onClick={() => { setEditingCommentId(c.id); setEditText(c.comment); }}
                                    className="underline-offset-2 hover:underline"
                                  >
                                    Edit
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Delete this comment? Everyone will see that you deleted it.")) {
                                      deleteComment.mutate({ id: c.id });
                                    }
                                  }}
                                  className="underline-offset-2 hover:underline hover:text-red-400"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {feed.length === 0 && (
                      <p className={`text-xs ${tokens.textMuted}`}>No comments yet.</p>
                    )}
                  </div>
                </section>
              </div>

              {/* ───────────────────────────── Sidebar actions */}
              <aside className="space-y-4">
                <div className="space-y-1.5">
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${tokens.textMuted}`}>Add to card</p>

                  {/* Members */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className={`fpb-side-btn ${tokens.tagBg}`}>
                        <UserPlus className="w-3.5 h-3.5" /> Members
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className={`w-64 p-2 ${tokens.selectContent}`}>
                      <p className={`text-xs font-semibold px-1 pb-1.5 ${tokens.textMuted}`}>Project members</p>
                      {projectPeople.length === 0 && (
                        <p className={`text-xs px-1 ${tokens.textMuted}`}>Nobody else is on this project.</p>
                      )}
                      <div className="max-h-64 overflow-y-auto">
                        {projectPeople.map(u => {
                          const on = cardMemberIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleMember(u.id)}
                              disabled={updateMembers.isPending}
                              className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-xs hover:bg-background"
                            >
                              <Avatar user={u} size={20} />
                              <span className="flex-1 truncate">{u.name || u.employeeId}</span>
                              {on && <Check className="w-3.5 h-3.5 text-[#8f86ff]" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Labels */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className={`fpb-side-btn ${tokens.tagBg}`}>
                        <Tag className="w-3.5 h-3.5" /> Labels
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className={`w-72 p-2 ${tokens.selectContent}`}>
                      <LabelPicker
                        projectId={projectId}
                        labels={labels}
                        selected={(task.labelIds ?? []).map(String)}
                        onToggle={toggleLabel}
                        canDelete={canManageLabels}
                        tokens={tokens}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Attachment: opens the file picker of the Attachments section */}
                  <label htmlFor={attachmentInputId(task.id)} className={`fpb-side-btn cursor-pointer ${tokens.tagBg}`}>
                    <Paperclip className="w-3.5 h-3.5" /> Attachment
                  </label>

                  {/* Due date */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className={`fpb-side-btn ${tokens.tagBg}`}>
                        <Calendar className="w-3.5 h-3.5" /> Dates
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className={`w-64 p-3 space-y-2 ${tokens.selectContent}`}>
                      <label className={`text-xs block ${tokens.textMuted}`}>Due date</label>
                      <Input
                        type="date"
                        value={task.dueDate ? String(task.dueDate).slice(0, 10) : ""}
                        onChange={e =>
                          updateTask.mutate({
                            id: task.id,
                            dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null,
                          })
                        }
                        className={`h-8 text-xs ${tokens.input}`}
                      />
                      {task.dueDate && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => updateTask.mutate({ id: task.id, dueDate: null })}
                          className={`h-7 w-full text-xs ${tokens.btnGhost}`}
                        >
                          <X className="w-3 h-3 mr-1" /> Remove due date
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${tokens.textMuted}`}>Actions</p>

                  {/* Move to another column */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className={`fpb-side-btn ${tokens.tagBg}`}>
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Move
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className={`w-56 p-1 ${tokens.selectContent}`}>
                      {columns.map(col => {
                        const here = String(col.id) === String(task.columnId);
                        return (
                          <button
                            key={col.id}
                            type="button"
                            disabled={here || moveTask.isPending}
                            onClick={() =>
                              // To the bottom of the chosen column; the server clamps the index.
                              moveTask.mutate({ id: task.id, columnId: String(col.id), position: 100000 })
                            }
                            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-background disabled:opacity-50"
                          >
                            <span className="truncate">{col.name}</span>
                            {here && <span className={tokens.textMuted}>current</span>}
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>

                  <button
                    type="button"
                    onClick={() => confirm("Delete this task?") && deleteTask.mutate({ id: task.id })}
                    className="fpb-side-btn text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pick a card's labels, create new ones, and (for the owner) delete them. */
function LabelPicker({
  projectId, labels, selected, onToggle, canDelete, tokens,
}: {
  projectId: string;
  labels: any[];
  selected: string[];
  onToggle: (id: string) => void;
  canDelete: boolean;
  tokens: any;
}) {
  const utils = trpc.useUtils();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);
  const onError = (e: any) => toast.error(e?.message || "Something went wrong");
  const refresh = () => utils.fpb.getBoard.invalidate({ projectId });

  const createLabel = trpc.fpb.createLabel.useMutation({
    onSuccess: () => { refresh(); setCreating(false); setName(""); },
    onError,
  });
  const deleteLabel = trpc.fpb.deleteLabel.useMutation({
    onSuccess: () => { refresh(); utils.fpb.getTask.invalidate(); },
    onError,
  });
  const create = () => createLabel.mutate({ projectId, name: name.trim(), color });

  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold px-1 ${tokens.textMuted}`}>Labels</p>
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {labels.length === 0 && !creating && (
          <p className={`text-xs px-1 ${tokens.textMuted}`}>This project has no labels yet.</p>
        )}
        {labels.map(l => {
          const on = selected.includes(String(l.id));
          return (
            <div key={l.id} className="flex items-center gap-1.5 group">
              <button
                type="button"
                onClick={() => onToggle(String(l.id))}
                className="flex flex-1 items-center gap-2 rounded text-left"
                aria-pressed={on}
              >
                <span
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    on ? "bg-[#4233e0] border-[#4233e0]" : tokens.border
                  }`}
                >
                  {on && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="fpb-label flex-1" style={{ backgroundColor: l.color }}>
                  {l.name || " "}
                </span>
              </button>
              {canDelete && (
                <button
                  type="button"
                  aria-label={`Delete label ${l.name}`}
                  onClick={() => {
                    if (confirm("Delete this label? It comes off every card that has it.")) {
                      deleteLabel.mutate({ id: String(l.id) });
                    }
                  }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {creating ? (
        <div className={`space-y-2 border-t pt-2 ${tokens.border}`}>
          <Input
            autoFocus
            value={name}
            maxLength={40}
            onChange={e => setName(e.target.value)}
            placeholder="Label name (optional)"
            className={`h-8 text-xs ${tokens.input}`}
            onKeyDown={e => { if (e.key === "Enter") create(); }}
          />
          <div className="flex flex-wrap gap-1.5">
            {LABEL_COLORS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded ${color === c ? "ring-2 ring-offset-1 ring-[#4233e0]" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={createLabel.isPending}
              onClick={create}
              className="h-7 bg-[#4233e0] hover:bg-[#2a1fb0] text-white text-xs"
            >
              Create
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={() => setCreating(false)}
              className={`h-7 text-xs ${tokens.btnGhost}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm" variant="ghost"
          onClick={() => setCreating(true)}
          className={`h-7 w-full text-xs ${tokens.btnGhost}`}
        >
          <Plus className="w-3 h-3 mr-1" /> Create a new label
        </Button>
      )}
    </div>
  );
}
