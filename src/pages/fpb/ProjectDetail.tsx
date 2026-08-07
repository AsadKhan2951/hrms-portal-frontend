import { useMemo, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { toast } from "sonner";
import {
  Activity as ActivityIcon, ArrowLeft, Calendar, Check, ChevronDown, ChevronRight,
  Loader2, MessageSquare, Plus, Trash2, Users,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { useFPBTheme } from "@/hooks/useFPBTheme";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_COLORS, formatDate, getTypeInfo, initialOf, type Priority,
} from "@/pages/FlowProjectBoard";

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
};

function Avatar({ user, size = 20 }: { user: any; size?: number }) {
  return (
    <span
      title={user?.name}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="rounded-full bg-gradient-to-br from-violet-500 to-blue-500 inline-flex items-center justify-center text-white font-bold flex-shrink-0"
    >
      {initialOf(user)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────── Task row
function TaskRow({
  task, users, projectId, tokens,
}: { task: any; users: any[]; projectId: string; tokens: any }) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  const refresh = () => utils.fpb.getTasks.invalidate({ projectId });
  const onError = (e: any) => toast.error(e?.message || "Something went wrong");

  const updateTask = trpc.fpb.updateTask.useMutation({ onSuccess: refresh, onError });
  const deleteTask = trpc.fpb.deleteTask.useMutation({ onSuccess: refresh, onError });
  const createSubtask = trpc.fpb.createSubtask.useMutation({
    onSuccess: () => { refresh(); setNewSubtask(""); }, onError,
  });
  const updateSubtask = trpc.fpb.updateSubtask.useMutation({ onSuccess: refresh, onError });
  const deleteSubtask = trpc.fpb.deleteSubtask.useMutation({ onSuccess: refresh, onError });

  const { data: detail } = trpc.fpb.getTask.useQuery(
    { id: task.id },
    { enabled: showComments }
  );
  const addComment = trpc.fpb.addTaskComment.useMutation({
    onSuccess: () => { utils.fpb.getTask.invalidate({ id: task.id }); setCommentText(""); },
    onError,
  });
  const deleteComment = trpc.fpb.deleteTaskComment.useMutation({
    onSuccess: () => utils.fpb.getTask.invalidate({ id: task.id }),
    onError,
  });

  const subtasks: any[] = task.subtasks ?? [];
  const doneSubs = subtasks.filter(s => s.completed).length;
  const memberIds: string[] = task.memberIds ?? [];
  const assignee = users.find(u => u.id === task.assignedTo);

  return (
    <div className={`${tokens.surface} border ${tokens.border} rounded-lg overflow-hidden mb-2`}>
      <div className="flex items-start gap-2.5 p-3">
        <button
          aria-label={task.completed ? "Mark as not done" : "Mark as done"}
          onClick={() => updateTask.mutate({ id: task.id, completed: !task.completed })}
          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
            task.completed ? "bg-emerald-500 border-emerald-500" : `${tokens.border} hover:border-violet-400`
          }`}
        >
          {task.completed && <Check className="w-2.5 h-2.5 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${
            task.completed ? `line-through ${tokens.textMuted}` : tokens.textPrimary
          }`}>
            {task.title}
          </p>
          {task.description && (
            <p className={`text-xs mt-0.5 ${tokens.textMuted}`}>{task.description}</p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Select
              value={task.status}
              onValueChange={v => updateTask.mutate({ id: task.id, status: v as any })}
            >
              <SelectTrigger className={`h-6 text-[10px] w-28 ${tokens.select}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={tokens.selectContent}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
              PRIORITY_COLORS[task.priority as Priority] ?? PRIORITY_COLORS.medium
            }`}>
              {task.priority}
            </span>

            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] ${tokens.textMuted}`}>
                <Calendar className="w-2.5 h-2.5" /> {formatDate(task.dueDate)}
              </span>
            )}

            {assignee && (
              <span className={`flex items-center gap-1 text-[10px] ${tokens.textMuted}`}>
                <Avatar user={assignee} size={14} /> {assignee.name}
              </span>
            )}

            {memberIds.length > 0 && (
              <span className="flex -space-x-1">
                {memberIds.slice(0, 3).map(id => (
                  <Avatar key={id} user={users.find(u => u.id === id)} size={16} />
                ))}
              </span>
            )}

            {subtasks.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1 text-[10px] ${tokens.textMuted} hover:opacity-80`}
              >
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {doneSubs}/{subtasks.length} subtasks
              </button>
            )}

            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1 text-[10px] ${tokens.textMuted} hover:opacity-80`}
            >
              <MessageSquare className="w-3 h-3" /> Comments
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(true)}
            className={`p-1 rounded ${tokens.btnGhost}`}
            title="Add subtask"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => confirm("Delete this task?") && deleteTask.mutate({ id: task.id })}
            className="p-1 rounded text-slate-500 hover:text-red-400"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className={`border-t ${tokens.border} px-3 py-2 space-y-1.5`}>
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
          <div className="flex gap-2 pt-1">
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
          </div>
        </div>
      )}

      {showComments && (
        <div className={`border-t ${tokens.border} px-3 py-2 space-y-2`}>
          {(detail?.comments ?? []).map((c: any) => {
            const author = users.find(u => u.id === c.userId);
            return (
              <div key={c.id} className="flex items-start gap-2 group">
                <Avatar user={author} size={18} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] ${tokens.textMuted}`}>
                    {author?.name ?? "Someone"} · {formatDate(c.createdAt)}
                  </p>
                  <p className={`text-xs ${tokens.textSecondary}`}>{c.comment}</p>
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
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className={`h-7 text-xs ${tokens.input}`}
              onKeyDown={e => {
                if (e.key === "Enter" && commentText.trim()) {
                  addComment.mutate({ taskId: task.id, comment: commentText.trim() });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────── New task modal
function NewTaskModal({
  open, onClose, projectId, projectTitle, members, users, tokens,
}: {
  open: boolean; onClose: () => void; projectId: string; projectTitle: string;
  members: string[]; users: any[]; tokens: any;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<string>("todo");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("medium");
    setStatus("todo"); setDueDate(""); setAssignedTo("");
  };

  const create = trpc.fpb.createTask.useMutation({
    onSuccess: async (task: any) => {
      // A status other than the default needs a follow-up write; createTask
      // always starts a task at "todo".
      if (status !== "todo" && task?.id) {
        await utils.client.fpb.updateTask.mutate({ id: task.id, status: status as any });
      }
      utils.fpb.getTasks.invalidate({ projectId });
      utils.fpb.getProjects.invalidate();
      toast.success(
        assignedTo && assignedTo !== "none"
          ? `Task created and assigned. ${users.find(u => u.id === assignedTo)?.name ?? "They"} has been notified.`
          : "Task created"
      );
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Could not add task"),
  });

  // Only people on the project can be assigned its work; this mirrors the API.
  const assignable = users.filter(u => members.includes(u.id));

  const submit = () => {
    if (!title.trim()) return;
    create.mutate({
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : undefined,
      assignedTo: assignedTo && assignedTo !== "none" ? assignedTo : undefined,
      memberIds: assignedTo && assignedTo !== "none" ? [assignedTo] : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className={`${tokens.dialog} max-w-lg max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-semibold">Create Task</DialogTitle>
          <DialogDescription className={tokens.textMuted}>
            in {projectTitle}
          </DialogDescription>
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
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Assignee</label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className={tokens.select}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className={tokens.selectContent}>
                  {assignable.length === 0 ? (
                    <SelectItem value="none" disabled>Add team members first</SelectItem>
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
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={tokens.select}><SelectValue /></SelectTrigger>
                <SelectContent className={tokens.selectContent}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
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
              Nobody is on this project yet. Add people on the Team tab before assigning work.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => { reset(); onClose(); }}
              className={tokens.btnGhost}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!title.trim() || create.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {create.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
              ) : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────── Page
export default function ProjectDetail() {
  const [, params] = useRoute("/board/project/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const { t } = useFPBTheme();
  const utils = trpc.useUtils();
  const projectId = params?.id ?? "";
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const { data: project, isLoading, error } = trpc.fpb.getProject.useQuery(
    { id: projectId },
    { enabled: Boolean(projectId), retry: false }
  );
  const { data: tasks = [] } = trpc.fpb.getTasks.useQuery(
    { projectId },
    { enabled: Boolean(projectId) }
  );
  const { data: users = [] } = trpc.fpb.getUsers.useQuery();
  const { data: activity = [] } = trpc.fpb.getActivity.useQuery(
    { projectId, limit: 30 },
    { enabled: Boolean(projectId) }
  );

  const updateMembers = trpc.fpb.updateProjectMembers.useMutation({
    onSuccess: () => {
      utils.fpb.getProject.invalidate({ id: projectId });
      utils.fpb.getProjects.invalidate();
      toast.success("Team updated");
    },
    onError: (e: any) => toast.error(e?.message || "Could not update the team"),
  });
  const deleteProject = trpc.fpb.deleteProject.useMutation({
    onSuccess: () => {
      utils.fpb.getProjects.invalidate();
      toast.success("Project deleted");
      navigate("/board");
    },
    onError: (e: any) => toast.error(e?.message || "Could not delete the project"),
  });

  const memberIds: string[] = (project as any)?.memberIds ?? [];
  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  const toggleMember = (id: string) => {
    const next = memberSet.has(id) ? memberIds.filter(m => m !== id) : [...memberIds, id];
    updateMembers.mutate({ projectId, memberIds: next });
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-screen ${t.bg}`}>
        <Loader2 className={`w-5 h-5 animate-spin ${t.textMuted}`} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen gap-3 ${t.bg}`}>
        <p className={t.textSecondary}>{(error as any)?.message ?? "Project not found"}</p>
        <Link href="/board">
          <Button variant="outline" className={t.btnOutline}>Back to board</Button>
        </Link>
      </div>
    );
  }

  const typeInfo = getTypeInfo((project as any).projectType);
  const done = tasks.filter((x: any) => x.completed).length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className={`h-screen overflow-y-auto ${t.bg}`}>
      <header className={`border-b ${t.border} px-6 py-4 sticky top-0 z-10 ${t.card}`}>
        <div className="flex items-start justify-between gap-4 max-w-5xl mx-auto">
          <div className="min-w-0">
            <Link href="/board">
              <button className={`flex items-center gap-1.5 text-xs mb-2 ${t.textMuted} hover:opacity-80`}>
                <ArrowLeft className="w-3.5 h-3.5" /> Board
              </button>
            </Link>
            <div className={`flex items-center gap-1.5 mb-1 ${typeInfo.color}`}>
              {typeInfo.icon}
              <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                {typeInfo.short}
              </span>
            </div>
            <h1 className={`text-xl font-semibold ${t.textPrimary}`}>{(project as any).title}</h1>
            {(project as any).description && (
              <p className={`text-sm mt-1 ${t.textSecondary}`}>{(project as any).description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
                PRIORITY_COLORS[(project as any).priority as Priority] ?? PRIORITY_COLORS.medium
              }`}>
                {(project as any).priority}
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {String((project as any).status).replace("_", " ")}
              </Badge>
              {(project as any).dueDate && (
                <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}>
                  <Calendar className="w-3 h-3" /> Due {formatDate((project as any).dueDate)}
                </span>
              )}
              {tasks.length > 0 && (
                <span className={`text-xs ${t.textMuted}`}>{done}/{tasks.length} tasks · {progress}%</span>
              )}
            </div>
          </div>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                confirm("Delete this project and everything in it?") &&
                deleteProject.mutate({ id: projectId })
              }
              className="text-red-400 border-red-400/30 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <Tabs defaultValue="tasks">
          <TabsList className={t.surface}>
            <TabsTrigger value="tasks">Tasks {tasks.length > 0 && `(${tasks.length})`}</TabsTrigger>
            <TabsTrigger value="team">Team ({memberIds.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4 space-y-2">
            {tasks.length === 0 && (
              <p className={`text-sm text-center py-8 ${t.textMuted}`}>
                No tasks yet. Add the first one below.
              </p>
            )}
            {tasks.map((task: any) => (
              <TaskRow
                key={task.id}
                task={task}
                users={users as any[]}
                projectId={projectId}
                tokens={t}
              />
            ))}
            <div className="pt-2">
              <Button
                onClick={() => setNewTaskOpen(true)}
                variant="outline"
                size="sm"
                className={`w-full ${t.btnOutline}`}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Task
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <p className={`text-xs mb-3 ${t.textMuted}`}>
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Only people on the project can be assigned its tasks.
            </p>
            <div className="flex flex-wrap gap-2">
              {(users as any[]).map(u => {
                const on = memberSet.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
                    disabled={updateMembers.isPending}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-all disabled:opacity-50 ${
                      on
                        ? "bg-violet-600/30 border-violet-500 text-violet-200"
                        : `${t.tagBg} ${t.border} ${t.textSecondary} hover:border-violet-400`
                    }`}
                  >
                    <Avatar user={u} size={18} />
                    <span>
                      {u.name || u.employeeId}
                      {u.designation && <span className="opacity-60"> · {u.designation}</span>}
                    </span>
                    {on && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            {activity.length === 0 && (
              <p className={`text-sm text-center py-8 ${t.textMuted}`}>Nothing recorded yet.</p>
            )}
            <ul className="space-y-2.5">
              {(activity as any[]).map(item => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <ActivityIcon className={`w-3.5 h-3.5 mt-0.5 ${t.textMuted}`} />
                  <div>
                    <p className={`text-xs ${t.textSecondary}`}>
                      <span className={t.textPrimary}>{item.userName}</span> {item.action}
                      {item.detail && <span className={t.textMuted}> — {item.detail}</span>}
                    </p>
                    <p className={`text-[10px] ${t.textMuted}`}>
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </div>

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        projectId={projectId}
        projectTitle={(project as any).title}
        members={memberIds}
        users={users as any[]}
        tokens={t}
      />
    </div>
  );
}
