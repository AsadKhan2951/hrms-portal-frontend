import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  Check, ChevronDown, Columns3, FolderPlus, Layers, Loader2, MoreHorizontal, Pencil, Plus,
  Search, Settings, Trash2,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { useFPBTheme } from "@/hooks/useFPBTheme";
import { trpc } from "@/lib/trpc";
import { isOrgWide } from "@/lib/roles";
import LayoutWrapper from "@/components/LayoutWrapper";
import { NowPageHeader, Segmented, WingmanBanner } from "@/components/now/NowPage";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { TaskCard } from "@/pages/fpb/TaskCard";
import { NewProjectModal } from "@/pages/fpb/NewProjectModal";
import { NewSubprojectModal } from "@/pages/fpb/NewSubprojectModal";
import { NewTaskModal } from "@/pages/fpb/NewTaskModal";
import { TaskDetailModal } from "@/pages/fpb/TaskDetailModal";
import { ProjectSettingsModal } from "@/pages/fpb/ProjectSettingsModal";
import { AddColumnModal } from "@/pages/fpb/AddColumnModal";
import {
  PROJECT_TYPES, boardStats, formatDate, getTypeInfo, initialsOf, taskTag,
} from "@/pages/fpb/shared";

const SELECTED_KEY = "fpb-selected-project";
const VIEW_KEY = "fpb-view";
/** Up to this many projects sit side by side as buttons; more become a picker. */
const INLINE_PROJECTS = 4;

type BoardView = "board" | "list";

export default function FlowProjectBoard() {
  const { user } = useAuth();
  const isAdmin = isOrgWide((user as any)?.role);
  const myId = (user as any)?.id ? String((user as any).id) : null;
  const utils = trpc.useUtils();
  const { t } = useFPBTheme();

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_KEY); } catch { return null; }
  });
  const [view, setView] = useState<BoardView>(() => {
    try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board"; } catch { return "board"; }
  });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newSubprojectOpen, setNewSubprojectOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  // Which sub-project's board is showing; null lets the server pick the first.
  const [subId, setSubId] = useState<string | null>(null);

  const { data: projects = [], isLoading: projectsLoading } =
    trpc.fpb.getProjects.useQuery(filterType !== "all" ? { projectType: filterType } : undefined);
  const { data: users = [] } = trpc.fpb.getUsers.useQuery();
  // Opening a project is a granted right now, so the button is hidden rather
  // than offered and then refused. The server checks this again.
  const { data: mayCreate = false } = trpc.fpb.canCreateProjects.useQuery();

  // Fall back to the first project when nothing is chosen, or when the chosen
  // one has been deleted or filtered out.
  const activeId = useMemo(() => {
    const list = projects as any[];
    if (list.length === 0) return null;
    return list.some(p => p.id === selectedId) ? selectedId : list[0].id;
  }, [projects, selectedId]);

  useEffect(() => {
    if (!activeId) return;
    try { localStorage.setItem(SELECTED_KEY, activeId); } catch { /* private mode */ }
  }, [activeId]);

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ }
  }, [view]);

  // Switching projects clears the sub-project choice, so the server falls back
  // to the new project's first sub-project rather than one from the old board.
  useEffect(() => { setSubId(null); }, [activeId]);

  const { data: board, isLoading: boardLoading } = trpc.fpb.getBoard.useQuery(
    { projectId: activeId ?? "", subprojectId: subId ?? undefined },
    { enabled: Boolean(activeId) }
  );

  const onError = (e: any) => toast.error(e?.message || "Something went wrong");
  const refreshBoard = () => utils.fpb.getBoard.invalidate({ projectId: activeId ?? "" });

  const updateColumn = trpc.fpb.updateColumn.useMutation({ onSuccess: refreshBoard, onError });
  const deleteColumn = trpc.fpb.deleteColumn.useMutation({
    onSuccess: (r: any) => {
      refreshBoard();
      toast.success(
        r?.moved > 0
          ? `Column deleted. ${r.moved} task${r.moved === 1 ? "" : "s"} moved to the previous column.`
          : "Column deleted"
      );
    },
    onError,
  });
  const moveTask = trpc.fpb.moveTask.useMutation({
    onSuccess: () => {
      refreshBoard();
      utils.fpb.getProjects.invalidate();
    },
    onError: (e: any) => { refreshBoard(); onError(e); },
  });

  const deleteSubproject = trpc.fpb.deleteSubproject.useMutation({
    onSuccess: (r: any) => {
      setSubId(null); // fall back to the project's first sub-project
      refreshBoard();
      utils.fpb.getProjects.invalidate();
      toast.success(
        r?.deletedTasks > 0
          ? `Sub-project deleted, along with ${r.deletedTasks} task${r.deletedTasks === 1 ? "" : "s"}.`
          : "Sub-project deleted"
      );
    },
    onError,
  });

  const columns = (board?.columns ?? []) as any[];
  const tasks = (board?.tasks ?? []) as any[];
  const project = board?.project as any;
  const subprojects = (board?.subprojects ?? []) as any[];
  // The sub-project actually being shown, as resolved by the server.
  const activeSubId = (board?.activeSubprojectId ?? null) as string | null;
  const activeSub = subprojects.find(s => s.id === activeSubId);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const task of tasks) {
      const list = map.get(task.columnId);
      if (list) list.push(task);
      else map.set(task.columnId, [task]);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [tasks]);

  const stats = useMemo(() => boardStats(tasks, myId), [tasks, myId]);

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects as any[];
    return (projects as any[]).filter(p => p.title.toLowerCase().includes(q));
  }, [projects, search]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;
      moveTask.mutate({
        id: draggableId,
        columnId: destination.droppableId,
        position: destination.index,
      });
    },
    [moveTask]
  );

  const usePicker = (projects as any[]).length > INLINE_PROJECTS || filterType !== "all";
  const subtitle = project
    ? [
        subprojects.length > 1 ? activeSub?.name : null,
        `${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
        stats.total > 0 ? `${stats.done} done` : null,
      ].filter(Boolean).join(" · ")
    : "Your projects and their tasks";

  const atRisk = stats.overdue > 0 || stats.blocked > 0;
  const healthNote = [
    stats.overdue > 0 ? `${stats.overdue} overdue` : null,
    stats.blocked > 0 ? `${stats.blocked} blocked` : null,
  ].filter(Boolean).join(", ");

  return (
    <LayoutWrapper>
      <div className="now-page">
        <NowPageHeader title={project?.title ?? "Work"} subtitle={subtitle} />

        {/* ───────────────────────── Project, sub-project, view, new task */}
        <div className="now-board-bar">
          <div className="now-board-bar-left">
            {!usePicker && (projects as any[]).length > 1 && (
              <Segmented
                label="Project"
                tone="ink"
                value={activeId ?? ""}
                onChange={id => setSelectedId(id)}
                options={(projects as any[]).map(p => ({ value: p.id, label: p.title }))}
              />
            )}

            {usePicker && (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="now-pick" aria-label="Choose a project">
                    <span className="truncate">{project?.title ?? "Choose a project"}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(340px,calc(100vw-32px))] rounded-2xl border-border bg-card p-3">
                  <div className="now-input-wrap" style={{ minHeight: 44 }}>
                    <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search projects"
                      aria-label="Search projects"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className={`mt-2 h-11 w-full rounded-xl ${t.select}`}>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent className={t.selectContent}>
                      <SelectItem value="all">All types</SelectItem>
                      {PROJECT_TYPES.map(pt => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.short}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 max-h-[320px] overflow-y-auto">
                    {visibleProjects.length === 0 && (
                      <p className="now-muted now-small px-2 py-4 text-center">
                        {search ? "No project matches that." : "No projects of this type."}
                      </p>
                    )}
                    {visibleProjects.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="now-pick-row"
                        aria-current={p.id === activeId}
                        onClick={() => { setSelectedId(p.id); setPickerOpen(false); }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.title}</span>
                          <span className="now-row-sub">
                            {getTypeInfo(p.projectType).short} · {p.completedTasks}/{p.taskCount} done
                          </span>
                        </span>
                        {p.id === activeId && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {project && (
              <SubprojectSwitcher
                subprojects={subprojects}
                activeId={activeSubId}
                onSelect={id => setSubId(id)}
                onCreate={() => setNewSubprojectOpen(true)}
                onDelete={sp => {
                  if (
                    confirm(
                      `Delete the "${sp.name}" sub-project? All of its tasks will be removed. This cannot be undone.`
                    )
                  ) {
                    deleteSubproject.mutate({ id: sp.id });
                  }
                }}
                tokens={t}
              />
            )}

            {project && (
              <Segmented
                label="View"
                tone="pick"
                value={view}
                onChange={setView}
                options={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]}
              />
            )}
          </div>

          <div className="now-board-bar-right">
            {(project || mayCreate) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="now-icon-btn" aria-label="Project options">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`${t.selectContent} min-w-[220px]`}>
                  {project && (
                    <>
                      <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" /> Manage project ({(project.memberIds ?? []).length})
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAddColumnOpen(true)} className="cursor-pointer">
                        <Columns3 className="mr-2 h-4 w-4" /> Add column
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setNewSubprojectOpen(true)} className="cursor-pointer">
                        <Layers className="mr-2 h-4 w-4" /> New sub-project
                      </DropdownMenuItem>
                    </>
                  )}
                  {project && mayCreate && <DropdownMenuSeparator />}
                  {mayCreate && (
                    <DropdownMenuItem onClick={() => setNewProjectOpen(true)} className="cursor-pointer">
                      <FolderPlus className="mr-2 h-4 w-4" /> New project
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {project && (
              <button
                type="button"
                className="now-btn lime lg"
                disabled={columns.length === 0}
                onClick={() => columns.length > 0 && setNewTaskColumn(columns[0].id)}
              >
                New task
              </button>
            )}
          </div>
        </div>

        {/* ───────────────────────── Nothing to show yet */}
        {projectsLoading && (
          <div className="now-card items-center py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading your projects
          </div>
        )}

        {!activeId && !projectsLoading && (
          <div className="now-card items-center py-14 text-center">
            <div className="now-lede">No projects yet</div>
            <p className="now-muted" style={{ maxWidth: 420 }}>
              {filterType !== "all"
                ? "No project of this type. Choose another type in the project picker."
                : mayCreate
                  ? "Create your first project and its board appears here."
                  : "You will see a project here once you are added to one."}
            </p>
            {mayCreate && filterType === "all" && (
              <button type="button" className="now-btn lime lg" onClick={() => setNewProjectOpen(true)}>
                New project
              </button>
            )}
          </div>
        )}

        {activeId && boardLoading && (
          <div className="now-card items-center py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading the board
          </div>
        )}

        {activeId && !boardLoading && project && (
          <>
            {/* ───────────────────── The four figures */}
            <section className="now-stat-strip" aria-label="Project summary">
              <div>
                <div className="now-stat-label">Health</div>
                <div className={`now-stat-value${atRisk ? " now-warn" : ""}`}>
                  {stats.total === 0 ? "No tasks" : atRisk ? "At risk" : "On track"}
                </div>
                <div className="now-stat-label">
                  {stats.total === 0 ? "Add the first one" : atRisk ? healthNote : "Nothing overdue"}
                </div>
              </div>
              <div>
                <div className="now-stat-label">Progress</div>
                <div className="now-stat-value">{stats.progress}%</div>
                <div className="now-bar" style={{ marginTop: 6 }} aria-hidden="true">
                  <span style={{ width: `${stats.progress}%` }} />
                </div>
              </div>
              <div>
                <div className="now-stat-label">Due this week</div>
                <div className="now-stat-value">{stats.dueThisWeek}</div>
                <div className="now-stat-label">in the next 7 days</div>
              </div>
              <div>
                <div className="now-stat-label">My load</div>
                <div className="now-stat-value">{stats.mine} task{stats.mine === 1 ? "" : "s"}</div>
                <div className="now-stat-label">
                  {stats.mineOverdue > 0 ? `${stats.mineOverdue} of them overdue` : "open and assigned to you"}
                </div>
              </div>
            </section>

            {stats.oldestOverdue && (
              <WingmanBanner
                action={<Link href="/wingman" className="now-btn indigo sm">Ask Wingman</Link>}
              >
                {stats.overdue === 1 ? "One task is overdue" : `${stats.overdue} tasks are overdue`}
                {stats.overdue === 1 ? ": " : ". The oldest is "}
                <strong>{stats.oldestOverdue.title}</strong>, due {formatDate(stats.oldestOverdue.dueDate)}.
              </WingmanBanner>
            )}

            {/* ───────────────────── Board */}
            {view === "board" && (
              <section className="now-board" aria-label="Board">
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="now-board-cols">
                    {columns.map(col => {
                      const colTasks = tasksByColumn.get(col.id) ?? [];
                      return (
                        <div key={col.id} className="now-board-col">
                          <ColumnHeader
                            column={col}
                            count={colTasks.length}
                            onRename={(id, name) => updateColumn.mutate({ id, name })}
                            onDelete={id => {
                              if (confirm("Delete this column? Its tasks move to the previous column.")) {
                                deleteColumn.mutate({ id });
                              }
                            }}
                            tokens={t}
                          />
                          <Droppable droppableId={String(col.id)}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`now-board-drop${snapshot.isDraggingOver ? " over" : ""}`}
                              >
                                {colTasks.map((task, index) => (
                                  <TaskCard
                                    key={task.id}
                                    task={task}
                                    index={index}
                                    users={users as any[]}
                                    myId={myId}
                                    onOpen={() => setOpenTaskId(task.id)}
                                  />
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                          <button type="button" className="now-add-task" onClick={() => setNewTaskColumn(col.id)}>
                            + Add task
                          </button>
                        </div>
                      );
                    })}
                    {columns.length === 0 && (
                      <div className="now-card items-center py-10 text-center" style={{ flex: "1 1 auto" }}>
                        <p className="now-muted">This board has no columns yet.</p>
                        <button type="button" className="now-btn ink sm" onClick={() => setAddColumnOpen(true)}>
                          Add column
                        </button>
                      </div>
                    )}
                  </div>
                </DragDropContext>
              </section>
            )}

            {/* ───────────────────── List */}
            {view === "list" && (
              <section className="now-card flush" aria-label="Task list">
                {tasks.length === 0 && <p className="now-muted pb-4">No tasks yet.</p>}
                {columns.map(col => {
                  const colTasks = tasksByColumn.get(col.id) ?? [];
                  if (colTasks.length === 0) return null;
                  return (
                    <div key={col.id} className="now-list-group">
                      <div className="now-list-head">
                        <span>{col.name}</span>
                        <span className="now-board-count">{colTasks.length}</span>
                      </div>
                      {colTasks.map(task => {
                        const tag = taskTag(task);
                        const assignee = (users as any[]).find(u => u.id === task.assignedTo);
                        return (
                          <button
                            key={task.id}
                            type="button"
                            className="now-list-row"
                            onClick={() => setOpenTaskId(task.id)}
                          >
                            <span className={`now-kcard-title${tag.tone === "done" ? " done" : ""}`}>{task.title}</span>
                            <span className={`now-kcard-tag ${tag.tone}`}>{tag.label}</span>
                            {assignee ? (
                              <span
                                title={assignee.name}
                                className={`now-kavatar${myId && assignee.id === myId ? " me" : ""}`}
                              >
                                {initialsOf(assignee)}
                              </span>
                            ) : (
                              <span className="now-kavatar none" aria-label="Nobody assigned" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        users={users as any[]}
        tokens={t}
        onCreated={id => setSelectedId(id)}
      />
      {activeId && (
        <>
          <AddColumnModal
            open={addColumnOpen}
            onClose={() => setAddColumnOpen(false)}
            projectId={activeId}
            tokens={t}
          />
          <NewTaskModal
            open={newTaskColumn !== null}
            onClose={() => setNewTaskColumn(null)}
            projectId={activeId}
            subprojectId={activeSubId}
            columnId={newTaskColumn}
            projectTitle={project?.title ?? ""}
            subprojectName={activeSub?.name}
            members={project?.memberIds ?? []}
            users={users as any[]}
            tokens={t}
          />
          <NewSubprojectModal
            open={newSubprojectOpen}
            onClose={() => setNewSubprojectOpen(false)}
            projectId={activeId}
            projectTitle={project?.title ?? ""}
            onCreated={id => setSubId(id)}
            tokens={t}
          />
          <ProjectSettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            projectId={activeId}
            users={users as any[]}
            tokens={t}
            // Only the owner (or an admin) may delete a space; a member invited
            // into it must not be able to destroy it.
            canDelete={isAdmin || String(project?.createdBy ?? "") === (user as any)?.id}
            onDeleted={() => { setSettingsOpen(false); setSelectedId(null); }}
          />
        </>
      )}
      <TaskDetailModal
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        projectId={activeId ?? ""}
        members={project?.memberIds ?? []}
        users={users as any[]}
        tokens={t}
      />
    </LayoutWrapper>
  );
}

// ─────────────────────────────────────────────────────── Sub-project switcher
/**
 * Chooses which sub-project's board to show, and creates a new one. A project
 * (a brand, say) is divided into sub-projects — Social Media, Development, SEO,
 * Marketing — each with its own cards on the shared columns.
 */
function SubprojectSwitcher({
  subprojects, activeId, onSelect, onCreate, onDelete, tokens,
}: {
  subprojects: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (sp: any) => void;
  tokens: any;
}) {
  const active = subprojects.find(s => s.id === activeId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="now-pick" title="Switch sub-project, or create a new one">
          <Layers className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
          <span className="truncate">{active?.name ?? "Sub-project"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${tokens.selectContent} min-w-[220px]`}>
        {subprojects.map(s => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="group flex cursor-pointer items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Check className={`h-3.5 w-3.5 shrink-0 ${s.id === activeId ? "opacity-100" : "opacity-0"}`} />
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color || "#4233e0" }}
              />
              <span className="truncate">{s.name}</span>
            </span>
            {subprojects.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(s); }}
                className="shrink-0 rounded p-0.5 opacity-0 hover:!opacity-100 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-70"
                title="Delete sub-project"
                aria-label={`Delete ${s.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </DropdownMenuItem>
        ))}
        {subprojects.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onCreate} className="cursor-pointer">
          <Plus className="mr-2 h-3.5 w-3.5" /> New sub-project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ───────────────────────────────────────────────────────────── Column header
function ColumnHeader({
  column, count, onRename, onDelete, tokens,
}: {
  column: any; count: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  tokens: any;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  useEffect(() => { setName(column.name); }, [column.name]);

  const save = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
    else setName(column.name);
    setEditing(false);
  };

  return (
    <div className="now-board-col-head">
      {editing ? (
        <input
          autoFocus
          value={name}
          aria-label="Column name"
          onChange={e => setName(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setName(column.name); setEditing(false); }
          }}
          className="now-input"
          style={{ minHeight: 36, height: 36, padding: "0 10px", fontSize: 15 }}
        />
      ) : (
        <span className="truncate font-bold">{column.name}</span>
      )}
      <span className="flex shrink-0 items-center gap-1">
        <span className="now-board-count">{count}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="now-board-more" aria-label={`${column.name} column options`}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={tokens.selectContent}>
            <DropdownMenuItem onClick={() => setEditing(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(column.id)}
              className="cursor-pointer text-red-500 focus:text-red-500"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}
