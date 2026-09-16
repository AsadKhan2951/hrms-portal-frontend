import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity as ActivityIcon, Check, Loader2, Save, Trash2, Users } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, PROJECT_TYPES, formatDate, getTypeInfo } from "@/pages/fpb/shared";

/** A project's dueDate (ISO or Date) as the YYYY-MM-DD an <input type=date> wants. */
function toDateInput(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Team, project settings and activity for one project (Jira's project settings). */
export function ProjectSettingsModal({
  open, onClose, projectId, users, tokens, canDelete, onDeleted,
}: {
  open: boolean; onClose: () => void; projectId: string; users: any[];
  tokens: any; canDelete: boolean; onDeleted: () => void;
}) {
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.fpb.getProject.useQuery(
    { id: projectId },
    { enabled: open && Boolean(projectId), retry: false }
  );
  const { data: activity = [] } = trpc.fpb.getActivity.useQuery(
    { projectId, limit: 30 },
    { enabled: open && Boolean(projectId) }
  );

  const onError = (e: any) => toast.error(e?.message || "Something went wrong");

  const updateMembers = trpc.fpb.updateProjectMembers.useMutation({
    onSuccess: () => {
      utils.fpb.getProject.invalidate({ id: projectId });
      utils.fpb.getBoard.invalidate({ projectId });
      utils.fpb.getProjects.invalidate();
      toast.success("Team updated");
    },
    onError,
  });
  const updateProject = trpc.fpb.updateProject.useMutation({
    onSuccess: () => {
      utils.fpb.getProject.invalidate({ id: projectId });
      utils.fpb.getBoard.invalidate({ projectId });
      utils.fpb.getProjects.invalidate();
    },
    onError,
  });

  // Editable copy of the project's own fields. Seeded whenever a different
  // project is opened; status and priority still save on change, the rest
  // through the Save button so a half-typed name is not written on every key.
  const [form, setForm] = useState({
    title: "", description: "", projectType: "other", dueDate: "",
  });
  useEffect(() => {
    if (!project) return;
    const p = project as any;
    setForm({
      title: p.title ?? "",
      description: p.description ?? "",
      projectType: p.projectType ?? "other",
      dueDate: toDateInput(p.dueDate),
    });
  }, [(project as any)?.id]);

  const dirty =
    Boolean(project) &&
    (form.title.trim() !== ((project as any).title ?? "") ||
      form.description !== ((project as any).description ?? "") ||
      form.projectType !== ((project as any).projectType ?? "other") ||
      form.dueDate !== toDateInput((project as any).dueDate));

  const saveDetails = () => {
    if (!form.title.trim()) {
      toast.error("A project needs a name");
      return;
    }
    updateProject.mutate(
      {
        id: projectId,
        title: form.title.trim(),
        description: form.description,
        projectType: form.projectType as any,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`) : null,
      },
      { onSuccess: () => toast.success("Project updated") }
    );
  };
  const deleteProject = trpc.fpb.deleteProject.useMutation({
    onSuccess: () => {
      utils.fpb.getProjects.invalidate();
      toast.success("Project deleted");
      onDeleted();
    },
    onError,
  });

  const memberIds: string[] = (project as any)?.memberIds ?? [];
  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  const toggleMember = (id: string) => {
    const next = memberSet.has(id) ? memberIds.filter(m => m !== id) : [...memberIds, id];
    updateMembers.mutate({ projectId, memberIds: next });
  };

  const typeInfo = getTypeInfo((project as any)?.projectType ?? "other");

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${tokens.dialog} max-w-lg max-h-[90vh] overflow-y-auto`}>
        {isLoading || !project ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className={`w-5 h-5 animate-spin ${tokens.textMuted}`} />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-semibold">{(project as any).title}</DialogTitle>
              <DialogDescription className={tokens.textMuted}>
                <span className={typeInfo.color}>{typeInfo.short}</span>
                {(project as any).dueDate && ` · due ${formatDate((project as any).dueDate)}`}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="team" className="mt-1">
              <TabsList className={tokens.surface}>
                <TabsTrigger value="team">Team ({memberIds.length})</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="team" className="mt-4">
                <p className={`text-xs mb-3 ${tokens.textMuted}`}>
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Only people on this project can be assigned its tasks.
                </p>
                <div className="flex flex-wrap gap-2">
                  {users.map(u => {
                    const on = memberSet.has(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleMember(u.id)}
                        disabled={updateMembers.isPending}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-all disabled:opacity-50 ${
                          on
                            ? "bg-violet-600/30 border-violet-500 text-violet-200"
                            : `${tokens.tagBg} ${tokens.border} ${tokens.textSecondary} hover:border-violet-400`
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

              <TabsContent value="settings" className="mt-4 space-y-4">
                <div>
                  <Label className={`text-xs mb-1 block ${tokens.textMuted}`}>Project name</Label>
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className={`h-9 text-sm ${tokens.input}`}
                  />
                </div>

                <div>
                  <Label className={`text-xs mb-1 block ${tokens.textMuted}`}>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="What is this project about?"
                    className={`${tokens.input} resize-none text-sm`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className={`text-xs mb-1 block ${tokens.textMuted}`}>Type</Label>
                    <Select
                      value={form.projectType}
                      onValueChange={v => setForm(f => ({ ...f, projectType: v }))}
                    >
                      <SelectTrigger className={`h-8 text-xs ${tokens.select}`}><SelectValue /></SelectTrigger>
                      <SelectContent className={tokens.selectContent}>
                        {PROJECT_TYPES.map(pt => (
                          <SelectItem key={pt.value} value={pt.value} className="text-xs">
                            <span className={`flex items-center gap-1.5 ${pt.color}`}>{pt.icon} {pt.short}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={`text-xs mb-1 block ${tokens.textMuted}`}>Due date</Label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                      className={`h-8 text-xs ${tokens.input}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveDetails}
                    disabled={!dirty || updateProject.isPending}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {updateProject.isPending
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</>
                      : <><Save className="w-3.5 h-3.5 mr-1.5" />Save changes</>}
                  </Button>
                </div>

                {/* Status and priority save the moment they change - they are
                    the two people flip most often. */}
                <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${tokens.border}`}>
                  <div>
                    <Label className={`text-xs mb-1 block ${tokens.textMuted}`}>Status</Label>
                    <Select
                      value={(project as any).status}
                      onValueChange={v =>
                        updateProject.mutate({ id: projectId, status: v as any },
                          { onSuccess: () => toast.success("Status updated") })
                      }
                    >
                      <SelectTrigger className={`h-8 text-xs ${tokens.select}`}><SelectValue /></SelectTrigger>
                      <SelectContent className={tokens.selectContent}>
                        {["active", "on_hold", "completed", "archived"].map(s => (
                          <SelectItem key={s} value={s} className="text-xs capitalize">
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={`text-xs mb-1 block ${tokens.textMuted}`}>Priority</Label>
                    <Select
                      value={(project as any).priority}
                      onValueChange={v =>
                        updateProject.mutate({ id: projectId, priority: v as any },
                          { onSuccess: () => toast.success("Priority updated") })
                      }
                    >
                      <SelectTrigger className={`h-8 text-xs ${tokens.select}`}><SelectValue /></SelectTrigger>
                      <SelectContent className={tokens.selectContent}>
                        {["low", "medium", "high", "urgent"].map(p => (
                          <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {canDelete && (
                  <div className={`pt-3 border-t ${tokens.border}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        confirm("Delete this project, its board and every task on it?") &&
                        deleteProject.mutate({ id: projectId })
                      }
                      className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Project
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                {activity.length === 0 && (
                  <p className={`text-sm text-center py-8 ${tokens.textMuted}`}>Nothing recorded yet.</p>
                )}
                <ul className="space-y-2.5">
                  {(activity as any[]).map(item => (
                    <li key={item.id} className="flex items-start gap-2.5">
                      <ActivityIcon className={`w-3.5 h-3.5 mt-0.5 ${tokens.textMuted}`} />
                      <div>
                        <p className={`text-xs ${tokens.textSecondary}`}>
                          <span className={tokens.textPrimary}>{item.userName}</span> {item.action}
                          {item.detail && <span className={tokens.textMuted}> — {item.detail}</span>}
                        </p>
                        <p className={`text-[10px] ${tokens.textMuted}`}>
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
