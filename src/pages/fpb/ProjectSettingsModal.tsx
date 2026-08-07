import { useMemo } from "react";
import { toast } from "sonner";
import { Activity as ActivityIcon, Check, Loader2, Trash2, Users } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, formatDate, getTypeInfo } from "@/pages/fpb/shared";

/** Team, project settings and activity for one project (Jira's project settings). */
export function ProjectSettingsModal({
  open, onClose, projectId, users, tokens, isAdmin, onDeleted,
}: {
  open: boolean; onClose: () => void; projectId: string; users: any[];
  tokens: any; isAdmin: boolean; onDeleted: () => void;
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
                {(project as any).description && (
                  <p className={`text-sm ${tokens.textSecondary}`}>{(project as any).description}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Status</label>
                    <Select
                      value={(project as any).status}
                      onValueChange={v => updateProject.mutate({ id: projectId, status: v as any })}
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
                    <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Priority</label>
                    <Select
                      value={(project as any).priority}
                      onValueChange={v => updateProject.mutate({ id: projectId, priority: v as any })}
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

                {isAdmin && (
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
