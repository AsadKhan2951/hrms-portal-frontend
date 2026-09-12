import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, MoreHorizontal, Pencil, Plus, Search, Settings2,
  Sun, Moon, Trash2, Users,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { useFPBTheme } from "@/hooks/useFPBTheme";
import { trpc } from "@/lib/trpc";
import { isOrgWide } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TaskCard } from "@/pages/fpb/TaskCard";
import { NewProjectModal } from "@/pages/fpb/NewProjectModal";
import { NewTaskModal } from "@/pages/fpb/NewTaskModal";
import { TaskDetailModal } from "@/pages/fpb/TaskDetailModal";
import { ProjectSettingsModal } from "@/pages/fpb/ProjectSettingsModal";
import { AddColumnModal } from "@/pages/fpb/AddColumnModal";
import { PROJECT_TYPES, getTypeInfo, initialOf } from "@/pages/fpb/shared";

const SELECTED_KEY = "fpb-selected-project";

export default function FlowProjectBoard() {
  const { user } = useAuth();
  const isAdmin = isOrgWide((user as any)?.role);
  const utils = trpc.useUtils();
  const { theme, toggle, t } = useFPBTheme();

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_KEY); } catch { return null; }
  });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data: projects = [], isLoading: projectsLoading } =
    trpc.fpb.getProjects.useQuery(filterType !== "all" ? { projectType: filterType } : undefined);
  const { data: users = [] } = trpc.fpb.getUsers.useQuery();

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

  const { data: board, isLoading: boardLoading } = trpc.fpb.getBoard.useQuery(
    { projectId: activeId ?? "" },
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

  const columns = (board?.columns ?? []) as any[];
  const tasks = (board?.tasks ?? []) as any[];
  const project = board?.project as any;

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

  return (
    <div className={`flex h-screen ${t.bg} overflow-hidden`}>
      {/* ─────────────────────────────── Projects sidebar */}
      <aside className={`w-64 flex-shrink-0 border-r ${t.border} flex flex-col ${t.card}`}>
        <div className={`px-4 py-4 border-b ${t.border}`}>
          <Link href="/dashboard">
            <button className={`flex items-center gap-1.5 text-xs mb-3 ${t.textMuted} hover:opacity-80`}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to portal
            </button>
          </Link>
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Projects</h2>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="px-3 pt-3 space-y-2">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className={`h-8 pl-8 text-xs ${t.input}`}
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className={`h-8 text-xs ${t.select}`}>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className={t.selectContent}>
              <SelectItem value="all">All types</SelectItem>
              {PROJECT_TYPES.map(pt => (
                <SelectItem key={pt.value} value={pt.value}>
                  <span className={`flex items-center gap-1.5 ${pt.color}`}>{pt.icon} {pt.short}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {projectsLoading && (
            <div className={`flex items-center gap-2 text-xs px-2 py-3 ${t.textMuted}`}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
            </div>
          )}
          {!projectsLoading && visibleProjects.length === 0 && (
            <p className={`text-xs px-2 py-6 text-center ${t.textMuted}`}>
              {search ? "No match" : "No projects yet"}
            </p>
          )}
          {visibleProjects.map(p => {
            const info = getTypeInfo(p.projectType);
            const active = p.id === activeId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${
                  active ? "bg-violet-600/20 border border-violet-500/40" : `border border-transparent ${t.surfaceHover}`
                }`}
              >
                <div className={`flex items-center gap-1.5 mb-1 ${info.color}`}>
                  {info.icon}
                  <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">
                    {info.short}
                  </span>
                </div>
                <p className={`text-sm leading-snug line-clamp-2 ${
                  active ? t.textPrimary : t.textSecondary
                }`}>
                  {p.title}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[10px] ${t.textMuted}`}>
                    {p.completedTasks}/{p.taskCount} tasks
                  </span>
                  <div className="flex -space-x-1">
                    {(p.memberIds ?? []).slice(0, 3).map((id: string) => (
                      <span
                        key={id}
                        className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[8px] text-white font-bold"
                      >
                        {initialOf((users as any[]).find(u => u.id === id))}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Anyone can open a space of their own and invite whoever they need. */}
        <div className={`p-3 border-t ${t.border}`}>
          <Button
            onClick={() => setNewProjectOpen(true)}
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Project
          </Button>
        </div>
      </aside>

      {/* ─────────────────────────────── Board */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className={`flex items-center justify-between px-6 py-4 border-b ${t.border} flex-shrink-0`}>
          <div className="min-w-0">
            <h1 className={`text-lg font-semibold truncate ${t.textPrimary}`}>
              {project?.title ?? "Flow Project Board"}
            </h1>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>
              {project
                ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} across ${columns.length} column${columns.length === 1 ? "" : "s"}`
                : "Pick a project to see its board"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className={`p-1.5 rounded-lg border transition-colors ${t.btnOutline}`}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            {project && (
              <>
                <Button
                  onClick={() => setSettingsOpen(true)}
                  variant="outline"
                  size="sm"
                  className={`h-8 text-xs ${t.btnOutline}`}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Team ({(project.memberIds ?? []).length})
                </Button>
                <Button
                  onClick={() => setAddColumnOpen(true)}
                  variant="outline"
                  size="sm"
                  className={`h-8 text-xs ${t.btnOutline}`}
                >
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Add Column
                </Button>
                <Button
                  onClick={() => columns.length > 0 && setNewTaskColumn(columns[0].id)}
                  size="sm"
                  disabled={columns.length === 0}
                  className="bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> New Task
                </Button>
              </>
            )}
          </div>
        </header>

        {!activeId && !projectsLoading && (
          <div className={`flex-1 flex flex-col items-center justify-center gap-2 ${t.textMuted}`}>
            <p className="text-sm">No projects yet.</p>
            <p className="text-xs">Create your own space from the sidebar to get started.</p>
          </div>
        )}

        {activeId && boardLoading && (
          <div className={`flex-1 flex items-center justify-center gap-2 text-sm ${t.textMuted}`}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading board...
          </div>
        )}

        {activeId && !boardLoading && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-4 p-6 h-full min-w-max">
                {columns.map(col => {
                  const colTasks = tasksByColumn.get(col.id) ?? [];
                  return (
                    <div key={col.id} className="flex flex-col w-72 flex-shrink-0">
                      <ColumnHeader
                        column={col}
                        count={colTasks.length}
                        onRename={(id, name) => updateColumn.mutate({ id, name })}
                        onDelete={id => {
                          if (confirm("Delete this column? Its tasks move to the previous column.")) {
                            deleteColumn.mutate({ id });
                          }
                        }}
                        onAddTask={() => setNewTaskColumn(col.id)}
                        tokens={t}
                      />
                      <Droppable droppableId={String(col.id)}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 min-h-[120px] rounded-xl p-2 overflow-y-auto transition-colors ${
                              snapshot.isDraggingOver ? t.dragOver : `${t.surface} border ${t.border}`
                            }`}
                          >
                            {colTasks.map((task, index) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                index={index}
                                users={users as any[]}
                                onOpen={() => setOpenTaskId(task.id)}
                                tokens={t}
                                theme={theme}
                              />
                            ))}
                            {provided.placeholder}
                            {colTasks.length === 0 && !snapshot.isDraggingOver && (
                              <button
                                onClick={() => setNewTaskColumn(col.id)}
                                className={`w-full flex flex-col items-center justify-center h-24 text-xs ${t.emptyIcon} hover:opacity-80`}
                              >
                                <Plus className="w-5 h-5 mb-1 opacity-50" />
                                Add task
                              </button>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}

                <button
                  onClick={() => setAddColumnOpen(true)}
                  className={`flex flex-col items-center justify-center w-56 flex-shrink-0 rounded-xl border border-dashed transition-opacity ${t.borderDashed} ${t.emptyIcon} hover:opacity-80`}
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-xs">Add column</span>
                </button>
              </div>
            </DragDropContext>
          </div>
        )}
      </main>

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
            columnId={newTaskColumn}
            projectTitle={project?.title ?? ""}
            members={project?.memberIds ?? []}
            users={users as any[]}
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
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Column header
function ColumnHeader({
  column, count, onRename, onDelete, onAddTask, tokens,
}: {
  column: any; count: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddTask: () => void;
  tokens: any;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  const save = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
    else setName(column.name);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") { setName(column.name); setEditing(false); }
            }}
            className={`rounded px-2 py-0.5 text-sm w-full outline-none border ${tokens.input}`}
          />
        ) : (
          <span
            className={`text-sm font-semibold truncate cursor-pointer ${tokens.textPrimary}`}
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {column.name}
          </span>
        )}
        <span className={`text-xs ${tokens.textMuted} flex-shrink-0`}>{count}</span>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={onAddTask} className={`p-1 rounded ${tokens.btnGhost}`} title="Add task">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`p-1 rounded ${tokens.btnGhost}`} aria-label="Column actions">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className={tokens.selectContent}>
            <DropdownMenuItem onClick={() => setEditing(true)} className="cursor-pointer">
              <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(column.id)}
              className="cursor-pointer text-red-500 focus:text-red-500"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
