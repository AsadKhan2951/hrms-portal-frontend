import { useState } from "react";
import { toast } from "sonner";
import { Check, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";

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
  Avatar, COLUMN_COLORS, PROJECT_TYPES, type Priority, type ProjectType,
} from "@/pages/fpb/shared";

/** What a brand-new project's board looks like unless the admin edits it. */
const DEFAULT_WORKFLOW = [
  { name: "Backlog", color: "#6b7280" },
  { name: "To Do", color: "#3b82f6" },
  { name: "In Progress", color: "#f59e0b" },
  { name: "In Review", color: "#8b5cf6" },
  { name: "Done", color: "#10b981" },
];

/**
 * Creates a project — a workspace, in Jira's sense. The columns defined here
 * become that project's own board; they are not shared with any other project.
 */
export function NewProjectModal({
  open, onClose, users, tokens, onCreated,
}: {
  open: boolean; onClose: () => void; users: any[]; tokens: any;
  onCreated?: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("dev");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [columns, setColumns] = useState(DEFAULT_WORKFLOW);
  const [newColumn, setNewColumn] = useState("");

  const reset = () => {
    setTitle(""); setDescription(""); setProjectType("dev"); setPriority("medium");
    setDueDate(""); setMemberIds([]); setColumns(DEFAULT_WORKFLOW); setNewColumn("");
  };

  const create = trpc.fpb.createProject.useMutation({
    onSuccess: (project: any) => {
      utils.fpb.getProjects.invalidate();
      toast.success(
        memberIds.length > 0
          ? `Project created. ${memberIds.length} team member${memberIds.length === 1 ? "" : "s"} notified.`
          : "Project created"
      );
      onCreated?.(project.id);
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Could not create the project"),
  });

  const addColumn = () => {
    const name = newColumn.trim();
    if (!name || columns.length >= 12) return;
    setColumns([...columns, { name, color: COLUMN_COLORS[columns.length % COLUMN_COLORS.length] }]);
    setNewColumn("");
  };

  const submit = () => {
    if (!title.trim() || columns.length === 0) return;
    create.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      projectType,
      priority,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : undefined,
      memberIds: memberIds.length > 0 ? memberIds : undefined,
      columns,
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className={`${tokens.dialog} max-w-lg max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-semibold">New Project</DialogTitle>
          <DialogDescription className={tokens.textMuted}>
            A project is its own workspace — it gets the board, columns and team you set up here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Project Name *</label>
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Website Redesign"
              className={tokens.input}
            />
          </div>

          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={2}
              className={`${tokens.input} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Type</label>
              <Select value={projectType} onValueChange={v => setProjectType(v as ProjectType)}>
                <SelectTrigger className={tokens.select}><SelectValue /></SelectTrigger>
                <SelectContent className={tokens.selectContent}>
                  {PROJECT_TYPES.map(pt => (
                    <SelectItem key={pt.value} value={pt.value}>
                      <span className={`flex items-center gap-2 ${pt.color}`}>{pt.icon} {pt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Workflow — becomes this project's columns */}
          <div>
            <label className={`text-xs mb-1.5 block ${tokens.textMuted}`}>
              Board Columns ({columns.length}) — your workflow or departments
            </label>
            <div className="space-y-1.5 mb-2">
              {columns.map((col, i) => (
                <div
                  key={`${col.name}-${i}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${tokens.border} ${tokens.surface}`}
                >
                  <GripVertical className={`w-3.5 h-3.5 ${tokens.textMuted}`} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <input
                    value={col.name}
                    onChange={e => {
                      const next = [...columns];
                      next[i] = { ...col, name: e.target.value };
                      setColumns(next);
                    }}
                    className={`flex-1 bg-transparent text-xs outline-none ${tokens.textPrimary}`}
                  />
                  <button
                    onClick={() => setColumns(columns.filter((_, x) => x !== i))}
                    disabled={columns.length <= 1}
                    className="p-0.5 text-slate-500 hover:text-red-400 disabled:opacity-30"
                    title={columns.length <= 1 ? "A board needs at least one column" : "Remove"}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newColumn}
                onChange={e => setNewColumn(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColumn(); } }}
                placeholder="Add a column — Marketing, Development..."
                className={`h-8 text-xs ${tokens.input}`}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addColumn}
                disabled={!newColumn.trim() || columns.length >= 12}
                className={`h-8 ${tokens.btnOutline}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <label className={`text-xs mb-1.5 block ${tokens.textMuted}`}>
              Team ({memberIds.length}) — only these people can be assigned tasks
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {users.map(u => {
                const on = memberIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setMemberIds(on ? memberIds.filter(m => m !== u.id) : [...memberIds, u.id])
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                      on
                        ? "bg-violet-600/30 border-violet-500 text-violet-200"
                        : `${tokens.tagBg} ${tokens.border} ${tokens.textSecondary} hover:border-violet-400`
                    }`}
                  >
                    <Avatar user={u} size={16} />
                    {u.name || u.employeeId}
                    {on && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

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
                : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
