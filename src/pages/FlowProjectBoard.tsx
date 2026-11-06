import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  DragDropContext, Draggable, Droppable, type DraggableProvidedDragHandleProps, type DropResult,
} from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Columns3, FolderPlus, GripVertical, Layers, Loader2,
  MoreHorizontal, Pencil, Plus, Search, Settings, Trash2,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { useFPBTheme } from "@/hooks/useFPBTheme";
import { trpc } from "@/lib/trpc";
import { isAnyHead, isOrgWide } from "@/lib/roles";
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
import { ClientRounds } from "@/pages/fpb/ClientRounds";
import { MeetingsCalendar } from "@/pages/fpb/MeetingsCalendar";
import { PerformanceView } from "@/pages/fpb/PerformanceView";
import { EmployeePicker } from "@/pages/fpb/EmployeePicker";
import {
  PROJECT_SCOPES, boardStats, formatDate, initialsOf, scopeLabel, taskTag,
} from "@/pages/fpb/shared";

const SELECTED_KEY = "fpb-selected-project";
const VIEW_KEY = "fpb-view";
/** Up to this many projects sit side by side as buttons; more become a picker. */
const INLINE_PROJECTS = 4;

type BoardView = "board" | "list" | "metrics" | "client" | "meetings";
const VIEWS: BoardView[] = ["board", "list", "metrics", "client", "meetings"];

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
    try {
      const stored = localStorage.getItem(VIEW_KEY) as BoardView | null;
      return stored && VIEWS.includes(stored) ? stored : "board";
    } catch { return "board"; }
  });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newSubprojectOpen, setNewSubprojectOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"team" | "settings" | "activity">("team");
  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  // Which sub-project's board is showing; null lets the server pick the first.
  const [subId, setSubId] = useState<string | null>(null);

  // Heads (and admins) can switch to one of their employees and see that
  // person's projects and boards instead of their own.
  const canPickEmployee = isAnyHead((user as any)?.role);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const { data: teamPeople = [] } = trpc.fpb.getTeamMembers.useQuery(undefined, {
    enabled: canPickEmployee,
  });
  const employee = (teamPeople as any[]).find(p => p.id === employeeId) ?? null;
  // Whose load the board highlights: the chosen employee's, else the viewer's.
  const focusId = employeeId ?? myId;

  const { data: projects = [], isLoading: projectsLoading } =
    trpc.fpb.getProjects.useQuery(
      filterType !== "all" || employeeId
        ? {
            ...(filterType !== "all" ? { scope: filterType } : {}),
            ...(employeeId ? { employeeId } : {}),
          }
        : undefined
    );
  const { data: users = [] } = trpc.fpb.getUsers.useQuery();
  const { data: departments = [] } = trpc.fpb.getDepartments.useQuery();
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
    // An employee's project is a visit, not the viewer's own last choice.
    if (!activeId || employeeId) return;
    try { localStorage.setItem(SELECTED_KEY, activeId); } catch { /* private mode */ }
  }, [activeId, employeeId]);

  const chooseEmployee = (id: string | null) => {
    setEmployeeId(id);
    setSearch("");
    // Their first project; back on your own, the one you last had open.
    try { setSelectedId(id ? null : localStorage.getItem(SELECTED_KEY)); } catch { setSelectedId(null); }
  };

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ }
  }, [view]);

  // Switching projects clears the sub-project choice, so the server falls back
  // to the new project's first sub-project rather than one from the old board.
  useEffect(() => { setSubId(null); }, [activeId]);

  // Opened from a notification: /board?project=<id>&task=<id> lands on the
  // project and opens the task, then the address is tidied so a refresh or
  // closing the task does not reopen it.
  const routeSearch = useSearch();
  const [, navigate] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(routeSearch);
    const linkedProject = params.get("project");
    const linkedTask = params.get("task");
    if (!linkedProject && !linkedTask) return;
    if (linkedProject) {
      setSelectedId(linkedProject);
      setView("board");
    }
    if (linkedTask) setOpenTaskId(linkedTask);
    navigate("/board", { replace: true });
  }, [routeSearch, navigate]);

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
  const reorderColumns = trpc.fpb.reorderColumns.useMutation({
    onSuccess: refreshBoard,
    // The optimistic order is thrown away and the server's order shown again.
    onError: (e: any) => { refreshBoard(); onError(e); },
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
  const labels = ((board as any)?.labels ?? []) as any[];
  const tasks = (board?.tasks ?? []) as any[];
  const project = board?.project as any;
  const subprojects = (board?.subprojects ?? []) as any[];
  // The sub-project actually being shown, as resolved by the server.
  const activeSubId = (board?.activeSubprojectId ?? null) as string | null;
  const activeSub = subprojects.find(s => s.id === activeSubId);
  // Deleting columns, sub-projects or the project: its owner, a department
  // head or an admin. The server checks this too.
  const canManage =
    isAdmin || isAnyHead((user as any)?.role) || String(project?.createdBy ?? "") === myId;

  const deleteTask = trpc.fpb.deleteTask.useMutation({
    onSuccess: () => { refreshBoard(); utils.fpb.getProjects.invalidate(); toast.success("Task deleted"); },
    onError,
  });
  const deleteProject = trpc.fpb.deleteProject.useMutation({
    onSuccess: () => {
      utils.fpb.getProjects.invalidate();
      setSelectedId(null);
      toast.success("Project deleted");
    },
    onError,
  });

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

  const stats = useMemo(() => boardStats(tasks, focusId), [tasks, focusId]);

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects as any[];
    return (projects as any[]).filter(p => p.title.toLowerCase().includes(q));
  }, [projects, search]);

  /** Shows a new column order straight away, then saves it. */
  const applyColumnOrder = useCallback(
    (orderedIds: string[]) => {
      if (!activeId) return;
      const key = { projectId: activeId, subprojectId: subId ?? undefined };
      utils.fpb.getBoard.setData(key, (old: any) => {
        if (!old) return old;
        const byId = new Map((old.columns as any[]).map(c => [c.id, c]));
        return {
          ...old,
          columns: orderedIds.map((id, position) => ({ ...byId.get(id), position })),
        };
      });
      reorderColumns.mutate({ projectId: activeId, columnIds: orderedIds });
    },
    [activeId, subId, utils, reorderColumns]
  );

  /** Moves a column one place left (-1) or right (+1), for the column menu. */
  const shiftColumn = useCallback(
    (columnId: string, delta: -1 | 1) => {
      const ids = columns.map(c => String(c.id));
      const from = ids.indexOf(columnId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      applyColumnOrder(ids);
    },
    [columns, applyColumnOrder]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId, type } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      // A whole column dragged to a new place on the board.
      if (type === "COLUMN") {
        const ids = columns.map(c => String(c.id));
        const [moved] = ids.splice(source.index, 1);
        ids.splice(destination.index, 0, moved);
        applyColumnOrder(ids);
        return;
      }

      moveTask.mutate({
        id: draggableId,
        columnId: destination.droppableId,
        position: destination.index,
      });
    },
    [columns, moveTask, applyColumnOrder]
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
            {canPickEmployee && (isAdmin || (teamPeople as any[]).length > 0) && (
              <EmployeePicker
                people={teamPeople as any[]}
                value={employeeId}
                onChange={chooseEmployee}
                meLabel={isAdmin ? "All projects" : "My projects"}
              />
            )}
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
                      <SelectValue placeholder="All scopes" />
                    </SelectTrigger>
                    <SelectContent className={t.selectContent}>
                      <SelectItem value="all">All scopes</SelectItem>
                      {PROJECT_SCOPES.map(ps => (
                        <SelectItem key={ps.value} value={ps.value}>{ps.label}</SelectItem>
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
                            {scopeLabel(p.scopes)} · {p.completedTasks}/{p.taskCount} done
                          </span>
                        </span>
                        {p.id === activeId && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {project && (view === "board" || view === "list") && (
              <SubprojectSwitcher
                subprojects={subprojects}
                activeId={activeSubId}
                onSelect={id => setSubId(id)}
                onCreate={() => setNewSubprojectOpen(true)}
                canDelete={canManage}
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
                options={[
                  { value: "board", label: "Board" },
                  { value: "list", label: "List" },
                  { value: "metrics", label: "Metrics" },
                  { value: "client", label: "Client" },
                  { value: "meetings", label: "Meetings" },
                ]}
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
                      <DropdownMenuItem
                        onClick={() => { setSettingsTab("team"); setSettingsOpen(true); }}
                        className="cursor-pointer"
                      >
                        <Settings className="mr-2 h-4 w-4" /> Manage team ({(project.memberIds ?? []).length})
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setSettingsTab("settings"); setSettingsOpen(true); }}
                        className="cursor-pointer"
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit project
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAddColumnOpen(true)} className="cursor-pointer">
                        <Columns3 className="mr-2 h-4 w-4" /> Add column
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setNewSubprojectOpen(true)} className="cursor-pointer">
                        <Layers className="mr-2 h-4 w-4" /> New sub-project
                      </DropdownMenuItem>
                      {canManage && (
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Delete "${project.title}", its board and every task on it? This cannot be undone.`)) {
                              deleteProject.mutate({ id: project.id });
                            }
                          }}
                          className="cursor-pointer text-red-500 focus:text-red-500"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete project
                        </DropdownMenuItem>
                      )}
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
            {project && (view === "board" || view === "list") && (
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
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {employee ? ` Loading ${employee.name}'s projects` : " Loading your projects"}
          </div>
        )}

        {!activeId && !projectsLoading && (
          <div className="now-card items-center py-14 text-center">
            <div className="now-lede">{employee ? `${employee.name} is on no projects yet` : "No projects yet"}</div>
            <p className="now-muted" style={{ maxWidth: 420 }}>
              {employee
                ? "Once they create a project or are added to one, its board shows here."
                : filterType !== "all"
                ? "No project with this scope. Choose another scope in the project picker."
                : mayCreate
                  ? "Create your first project and its board appears here."
                  : "You will see a project here once you are added to one."}
            </p>
            {mayCreate && filterType === "all" && !employee && (
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

        {activeId && !boardLoading && project && view === "client" && (
          <ClientRounds projectId={activeId} projectTitle={project.title} />
        )}

        {activeId && !boardLoading && project && view === "metrics" && (
          <PerformanceView
            projectId={activeId}
            projectTitle={project.title}
            users={users as any[]}
            wideScopeLabel={
              isAdmin ? "Whole company" : isAnyHead((user as any)?.role) ? "My departments" : "All my projects"
            }
          />
        )}

        {activeId && !boardLoading && view === "meetings" && (
          <MeetingsCalendar
            onOpenProject={id => {
              setSelectedId(id);
              setView("client");
            }}
          />
        )}

        {activeId && !boardLoading && project && (view === "board" || view === "list") && (
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
              <div
                role="button"
                tabIndex={0}
                title="See each person's completed tasks this month"
                style={{ cursor: "pointer" }}
                onClick={() => setView("metrics")}
                onKeyDown={e => { if (e.key === "Enter") setView("metrics"); }}
              >
                <div className="now-stat-label">
                  {employee ? `${employee.name.split(" ")[0]}'s load` : "My load"} · Team performance →
                </div>
                <div className="now-stat-value">{stats.mine} task{stats.mine === 1 ? "" : "s"}</div>
                <div className="now-stat-label">
                  {stats.mineOverdue > 0
                    ? `${stats.mineOverdue} of them overdue`
                    : employee ? "open and assigned to them" : "open and assigned to you"}
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
                  {/* Columns are draggable by their header; cards inside them too. */}
                  <Droppable droppableId="board-columns" type="COLUMN" direction="horizontal">
                    {boardProvided => (
                      <div
                        className="now-board-cols"
                        ref={boardProvided.innerRef}
                        {...boardProvided.droppableProps}
                      >
                        {columns.map((col, colIndex) => {
                          const colTasks = tasksByColumn.get(col.id) ?? [];
                          return (
                            <Draggable key={col.id} draggableId={`col-${col.id}`} index={colIndex}>
                              {(colProvided, colSnapshot) => (
                                <div
                                  ref={colProvided.innerRef}
                                  {...colProvided.draggableProps}
                                  className={`now-board-col${colSnapshot.isDragging ? " dragging" : ""}`}
                                >
                                  <ColumnHeader
                                    column={col}
                                    count={colTasks.length}
                                    dragHandleProps={colProvided.dragHandleProps}
                                    canMoveLeft={colIndex > 0}
                                    canMoveRight={colIndex < columns.length - 1}
                                    onMove={delta => shiftColumn(String(col.id), delta)}
                                    canDelete={canManage}
                                    onRename={(id, name) => updateColumn.mutate({ id, name })}
                                    onDelete={id => {
                                      if (confirm("Delete this column? Its tasks move to the previous column.")) {
                                        deleteColumn.mutate({ id });
                                      }
                                    }}
                                    tokens={t}
                                  />
                                  <Droppable droppableId={String(col.id)} type="TASK">
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
                                            labels={labels}
                                            departments={departments as any[]}
                                            myId={focusId}
                                            onOpen={() => setOpenTaskId(task.id)}
                                            onDelete={() => {
                                              if (confirm(`Delete "${task.title}"?`)) deleteTask.mutate({ id: task.id });
                                            }}
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
                              )}
                            </Draggable>
                          );
                        })}
                        {boardProvided.placeholder}
                        {columns.length === 0 && (
                          <div className="now-card items-center py-10 text-center" style={{ flex: "1 1 auto" }}>
                            <p className="now-muted">This board has no columns yet.</p>
                            <button type="button" className="now-btn ink sm" onClick={() => setAddColumnOpen(true)}>
                              Add column
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
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
                                className={`now-kavatar${focusId && assignee.id === focusId ? " me" : ""}`}
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
            labels={labels}
            projectOwnerId={project?.createdBy ? String(project.createdBy) : null}
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
            canDelete={canManage}
            initialTab={settingsTab}
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
        columns={columns}
        labels={labels}
        projectOwnerId={project?.createdBy ? String(project.createdBy) : null}
        canManage={canManage}
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
  subprojects, activeId, onSelect, onCreate, onDelete, canDelete, tokens,
}: {
  subprojects: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (sp: any) => void;
  /** Only the project's owner (or an admin) may delete a sub-project. */
  canDelete: boolean;
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
            {canDelete && subprojects.length > 1 && (
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
  dragHandleProps, canMoveLeft, canMoveRight, onMove, canDelete,
}: {
  column: any; count: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  tokens: any;
  /** The header is the handle for dragging the whole column. */
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (delta: -1 | 1) => void;
  canDelete: boolean;
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
    <div className="now-board-col-head" {...(editing ? {} : dragHandleProps ?? {})}>
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
        <span className="flex min-w-0 items-center gap-1" title="Drag to move this column">
          <GripVertical className="now-board-grip h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate font-bold">{column.name}</span>
        </span>
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
              disabled={!canMoveLeft}
              onClick={() => onMove(-1)}
              className="cursor-pointer"
            >
              <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMoveRight}
              onClick={() => onMove(1)}
              className="cursor-pointer"
            >
              <ArrowRight className="mr-2 h-3.5 w-3.5" /> Move right
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(column.id)}
                  className="cursor-pointer text-red-500 focus:text-red-500"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete column
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}
