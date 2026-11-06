import { useMemo, useState } from "react";
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { useFPBTheme } from "@/hooks/useFPBTheme";
import { trpc } from "@/lib/trpc";
import LayoutWrapper from "@/components/LayoutWrapper";
import { NowPageHeader, Segmented } from "@/components/now/NowPage";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TaskCard } from "@/pages/fpb/TaskCard";
import { TaskDetailModal } from "@/pages/fpb/TaskDetailModal";
import { TASK_STAGES, daysOverdue, isTaskDone } from "@/pages/fpb/shared";

const EVERYONE = "__all__";
const UNASSIGNED = "__unassigned__";

/** Which column a task sits in: its stage, with "blocked" shown under In Progress. */
function stageOf(task: any) {
  if (isTaskDone(task)) return "done";
  if (task.status === "blocked") return "in_progress";
  return TASK_STAGES.some(s => s.value === task.status) ? task.status : "todo";
}

/**
 * A department's board: every task the project managers handed to this
 * department, from every project, by stage. New work lands in Backlog; the
 * head assigns it to someone in the team from the card. Moving a card here
 * moves it on the project's board too: a task has one status for everyone.
 */
export default function DepartmentBoard() {
  const { user } = useAuth();
  const myId = (user as any)?.id ? String((user as any).id) : null;
  const utils = trpc.useUtils();
  const { t } = useFPBTheme();

  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [who, setWho] = useState(EVERYONE);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<{ taskId: string; projectId: string; memberIds: string[] } | null>(null);

  const queryInput = departmentId ? { departmentId } : undefined;
  const { data, isLoading, isError, error } = trpc.fpb.getDepartmentBoard.useQuery(queryInput);
  const { data: users = [] } = trpc.fpb.getUsers.useQuery();
  const { data: allDepartments = [] } = trpc.fpb.getDepartments.useQuery();

  const board = data as any;
  const department = board?.department ?? null;
  const departments = (board?.departments ?? []) as any[];
  const people = (board?.people ?? []) as any[];
  const tasks = (board?.tasks ?? []) as any[];

  const assigneeHere = (task: any) =>
    ((task.assignees ?? []) as any[]).find(a => String(a.departmentId) === department?.id)?.userId ?? null;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(task => {
      const assignee = assigneeHere(task);
      if (who === UNASSIGNED && assignee) return false;
      if (who !== EVERYONE && who !== UNASSIGNED && String(assignee ?? "") !== who) return false;
      if (q && !`${task.title} ${task.projectTitle}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, who, search, department?.id]);

  const byStage = useMemo(() => {
    const map = new Map<string, any[]>(TASK_STAGES.map(s => [s.value, []]));
    for (const task of shown) map.get(stageOf(task))!.push(task);
    return map;
  }, [shown]);

  const open_ = tasks.filter(task => !isTaskDone(task));
  const stats = {
    open: open_.length,
    unassigned: open_.filter(task => !assigneeHere(task)).length,
    overdue: open_.filter(task => daysOverdue(task) > 0).length,
    projects: new Set(tasks.map(task => String(task.projectId))).size,
  };

  const setStage = trpc.fpb.setTaskStage.useMutation({
    onSuccess: () => {
      utils.fpb.getDepartmentBoard.invalidate();
      utils.fpb.getBoard.invalidate();
      utils.fpb.getProjects.invalidate();
    },
    onError: (e: any) => {
      utils.fpb.getDepartmentBoard.invalidate();
      toast.error(e?.message || "Could not move the task");
    },
  });

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const status = destination.droppableId;
    // Show the move straight away; the server has the last word.
    utils.fpb.getDepartmentBoard.setData(queryInput, (old: any) =>
      old
        ? {
            ...old,
            tasks: old.tasks.map((task: any) =>
              String(task.id) === draggableId
                ? { ...task, status, completed: status === "done" }
                : task
            ),
          }
        : old
    );
    setStage.mutate({ taskId: draggableId, status: status as any });
  };

  return (
    <LayoutWrapper>
      <div className="now-page">
        <NowPageHeader
          title={department ? `${department.name} board` : "Department board"}
          subtitle={
            department
              ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} from ${stats.projects} project${stats.projects === 1 ? "" : "s"}${department.headName ? ` · Head: ${department.headName}` : ""}`
              : "Every task handed to your department, from every project"
          }
        />

        {isLoading ? (
          <div className="now-card items-center py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading the board
          </div>
        ) : isError ? (
          <div className="now-card py-10 now-warn">{(error as any)?.message || "Could not load the board."}</div>
        ) : !department ? (
          <div className="now-card items-center py-14 text-center">
            <div className="now-lede">No department yet</div>
            <p className="now-muted">You are not in a department. An admin sets this under Organisation.</p>
          </div>
        ) : (
          <>
            <div className="now-overview-bar">
              {departments.length > 1 && (
                departments.length <= 4 ? (
                  <Segmented
                    label="Department"
                    tone="ink"
                    value={department.id}
                    onChange={id => { setDepartmentId(id); setWho(EVERYONE); }}
                    options={departments.map(d => ({ value: d.id, label: d.name }))}
                  />
                ) : (
                  <Select value={department.id} onValueChange={id => { setDepartmentId(id); setWho(EVERYONE); }}>
                    <SelectTrigger className={`h-11 w-56 rounded-xl ${t.select}`}><SelectValue /></SelectTrigger>
                    <SelectContent className={t.selectContent}>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              )}
              <div className="now-input-wrap" style={{ minHeight: 44, flex: "1 1 220px", maxWidth: 320 }}>
                <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tasks or projects"
                  aria-label="Search tasks or projects"
                />
              </div>
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger className={`h-11 w-56 rounded-xl ${t.select}`}><SelectValue /></SelectTrigger>
                <SelectContent className={t.selectContent}>
                  <SelectItem value={EVERYONE}>Everyone's tasks</SelectItem>
                  <SelectItem value={UNASSIGNED}>Not assigned yet</SelectItem>
                  {people.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="now-stat-strip">
              <div>
                <div className="now-stat-label">Open tasks</div>
                <div className="now-stat-value">{stats.open}</div>
              </div>
              <div>
                <div className="now-stat-label">Not assigned yet</div>
                <div className={`now-stat-value${stats.unassigned ? " now-warn" : ""}`}>{stats.unassigned}</div>
                {board?.canAssign && stats.unassigned > 0 && (
                  <div className="now-stat-label">open a card to assign it</div>
                )}
              </div>
              <div>
                <div className="now-stat-label">Overdue</div>
                <div className={`now-stat-value${stats.overdue ? " now-warn" : ""}`}>{stats.overdue}</div>
              </div>
              <div>
                <div className="now-stat-label">Projects</div>
                <div className="now-stat-value">{stats.projects}</div>
              </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <div className="now-dept-cols">
                {TASK_STAGES.map(stage => {
                  const list = byStage.get(stage.value) ?? [];
                  return (
                    <Droppable key={stage.value} droppableId={stage.value}>
                      {(provided, snapshot) => (
                        <section
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`now-dept-col${snapshot.isDraggingOver ? " over" : ""}`}
                          aria-label={stage.label}
                        >
                          <div className="now-dept-col-head">
                            <span className="dot" style={{ background: stage.color }} />
                            {stage.label}
                            <span className="ml-auto text-sm font-normal text-muted-foreground">{list.length}</span>
                          </div>
                          {list.map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              users={users as any[]}
                              departments={allDepartments as any[]}
                              projectTitle={task.projectTitle}
                              myId={myId}
                              note={!isTaskDone(task) && !assigneeHere(task) ? "Needs an assignee" : undefined}
                              onOpen={() =>
                                setOpen({
                                  taskId: String(task.id),
                                  projectId: String(task.projectId),
                                  memberIds: (task.memberIds ?? []).map(String),
                                })
                              }
                            />
                          ))}
                          {provided.placeholder}
                          {list.length === 0 && (
                            <p className="px-1 text-xs text-muted-foreground">Nothing here.</p>
                          )}
                        </section>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </DragDropContext>
          </>
        )}
      </div>

      <TaskDetailModal
        taskId={open?.taskId ?? null}
        onClose={() => {
          setOpen(null);
          utils.fpb.getDepartmentBoard.invalidate();
        }}
        projectId={open?.projectId ?? ""}
        members={open?.memberIds ?? []}
        users={users as any[]}
        tokens={t}
        columns={[]}
        labels={[]}
      />
    </LayoutWrapper>
  );
}
