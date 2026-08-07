import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Loader2, Moon, MoreHorizontal, Pencil, Plus,
  Settings2, Sun, Trash2,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { useFPBTheme } from "@/hooks/useFPBTheme";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectDetailBody } from "@/pages/fpb/ProjectDetail";
import {
  COLUMN_COLORS, PRIORITY_COLORS, PROJECT_TYPES,
  formatDate, getTypeInfo, initialOf,
  type Priority, type ProjectType,
} from "@/pages/fpb/shared";

// ─────────────────────────────────────────────────────────── New project modal
function NewProjectModal({
  open, onClose, columnId, users, tokens,
}: {
  open: boolean; onClose: () => void; columnId: string | null; users: any[]; tokens: any;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("other");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const reset = () => {
    setTitle(""); setDescription(""); setProjectType("other");
    setPriority("medium"); setDueDate(""); setSelectedMembers([]);
  };

  const createProject = trpc.fpb.createProject.useMutation({
    onSuccess: () => {
      utils.fpb.getProjects.invalidate();
      toast.success("Project created");
      reset();
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Could not create project"),
  });

  const toggleMember = (id: string) =>
    setSelectedMembers(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));

  const submit = () => {
    if (!title.trim() || !columnId) return;
    createProject.mutate({
      columnId,
      title: title.trim(),
      description: description.trim() || undefined,
      projectType,
      priority,
      // The date input gives a local calendar day; noon avoids it sliding a day
      // either way once it is serialised to UTC.
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : undefined,
      memberIds: selectedMembers,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${tokens.dialog} max-w-lg max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-semibold">New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Project Title *</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter project title..."
              className={tokens.input}
              autoFocus
            />
          </div>

          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className={`${tokens.input} resize-none`}
            />
          </div>

          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Project Type *</label>
            <Select value={projectType} onValueChange={v => setProjectType(v as ProjectType)}>
              <SelectTrigger className={tokens.select}><SelectValue /></SelectTrigger>
              <SelectContent className={tokens.selectContent}>
                {PROJECT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className={`flex items-center gap-2 ${t.color}`}>{t.icon} {t.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div>
            <label className={`text-xs mb-2 block ${tokens.textMuted}`}>
              Team Members {selectedMembers.length > 0 && `(${selectedMembers.length})`}
            </label>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {users.length === 0 && (
                <span className={`text-xs ${tokens.textMuted}`}>No employees found</span>
              )}
              {users.map((u: any) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleMember(u.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                    selectedMembers.includes(u.id)
                      ? "bg-violet-600/30 border-violet-500 text-violet-200"
                      : `${tokens.tagBg} ${tokens.border} ${tokens.textSecondary} hover:border-violet-400`
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[9px] text-white font-bold">
                    {initialOf(u)}
                  </span>
                  {u.name || u.employeeId}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} className={tokens.btnGhost}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={!title.trim() || createProject.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {createProject.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
              ) : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────── Add column
function AddColumnModal({
  open, onClose, tokens,
}: { open: boolean; onClose: () => void; tokens: any }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLUMN_COLORS[0]);

  const createColumn = trpc.fpb.createColumn.useMutation({
    onSuccess: () => {
      utils.fpb.getBoard.invalidate();
      toast.success("Column added");
      setName("");
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Could not add column"),
  });

  const submit = () => {
    if (name.trim()) createColumn.mutate({ name: name.trim(), color });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${tokens.dialog} max-w-sm`}>
        <DialogHeader><DialogTitle>Add Column</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Column name..."
            className={tokens.input}
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
          />
          <div>
            <label className={`text-xs mb-2 block ${tokens.textMuted}`}>Colour</label>
            <div className="flex gap-2 flex-wrap">
              {COLUMN_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c ? "border-violet-400 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} className={tokens.btnGhost}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={!name.trim() || createColumn.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Add Column
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────── Column header
function ColumnHeader({
  column, count, isAdmin, onRename, onDelete, onAddProject, tokens,
}: {
  column: any; count: number; isAdmin: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddProject: () => void;
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
            className={`text-sm font-semibold truncate ${tokens.textPrimary} ${isAdmin ? "cursor-pointer" : ""}`}
            onClick={() => isAdmin && setEditing(true)}
            title={isAdmin ? "Click to rename" : undefined}
          >
            {column.name}
          </span>
        )}
        <span className={`text-xs ${tokens.textMuted} flex-shrink-0`}>{count}</span>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1">
          <button onClick={onAddProject} className={`p-1 rounded ${tokens.btnGhost}`} title="Add project">
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
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────── Project card
function ProjectCard({
  project, index, users, onOpen, tokens, theme,
}: {
  project: any; index: number; users: any[];
  onOpen: () => void; tokens: any; theme: string;
}) {
  const typeInfo = getTypeInfo(project.projectType);
  const memberIds: string[] = project.memberIds ?? [];
  const shown = memberIds.slice(0, 3).map(id => users.find((u: any) => u.id === id));

  return (
    <Draggable draggableId={String(project.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onOpen}
          className={`group border rounded-xl p-3.5 mb-2.5 cursor-pointer transition-all select-none ${tokens.card} ${
            snapshot.isDragging
              ? "border-violet-500/60 shadow-lg shadow-violet-500/10 rotate-1"
              : `${tokens.border} hover:border-violet-400/50`
          }`}
        >
          <div className={`flex items-center gap-1.5 mb-2.5 ${typeInfo.color}`}>
            {typeInfo.icon}
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
              {typeInfo.short}
            </span>
          </div>

          <p className={`text-sm font-medium leading-snug mb-2.5 line-clamp-2 ${tokens.textPrimary}`}>
            {project.title}
          </p>

          {project.taskCount > 0 && (
            <div className="mb-2.5">
              <div className={`flex justify-between text-[10px] mb-1 ${tokens.textMuted}`}>
                <span>{project.completedTasks}/{project.taskCount} tasks</span>
                <span>{project.progress}%</span>
              </div>
              <div className={`h-1 rounded-full overflow-hidden ${tokens.tagBg}`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
                PRIORITY_COLORS[project.priority as Priority] ?? PRIORITY_COLORS.medium
              }`}>
                {project.priority}
              </span>
              {project.dueDate && (
                <span className={`flex items-center gap-1 text-[10px] ${tokens.textMuted}`}>
                  <Calendar className="w-2.5 h-2.5" />
                  {formatDate(project.dueDate)}
                </span>
              )}
            </div>

            {shown.length > 0 && (
              <div className="flex -space-x-1.5">
                {shown.map((u: any, i: number) => (
                  <span
                    key={i}
                    title={u?.name}
                    className={`w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[9px] text-white font-bold border ${
                      theme === "dark" ? "border-[#0f0f13]" : "border-white"
                    }`}
                  >
                    {initialOf(u)}
                  </span>
                ))}
                {memberIds.length > 3 && (
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] border ${tokens.tagBg} ${tokens.textMuted} ${
                    theme === "dark" ? "border-[#0f0f13]" : "border-white"
                  }`}>
                    +{memberIds.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ──────────────────────────────────────────────────────────────── The board
export default function FlowProjectBoard() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const utils = trpc.useUtils();
  const { theme, toggle, t } = useFPBTheme();

  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newProjectColumn, setNewProjectColumn] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  // Opening a card is an overlay on the board, the way Jira and Trello do it,
  // so the columns stay visible behind and closing returns you in place.
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const { data: boardData, isLoading: boardLoading } = trpc.fpb.getBoard.useQuery();
  const { data: projects = [], isLoading: projectsLoading } = trpc.fpb.getProjects.useQuery(
    filterType !== "all" ? { projectType: filterType } : undefined
  );
  const { data: users = [] } = trpc.fpb.getUsers.useQuery();

  const onMutationError = (error: any) => toast.error(error?.message || "Something went wrong");

  const updateColumn = trpc.fpb.updateColumn.useMutation({
    onSuccess: () => utils.fpb.getBoard.invalidate(),
    onError: onMutationError,
  });
  const deleteColumn = trpc.fpb.deleteColumn.useMutation({
    onSuccess: (result: any) => {
      utils.fpb.getBoard.invalidate();
      utils.fpb.getProjects.invalidate();
      toast.success(
        result?.moved > 0
          ? `Column deleted. ${result.moved} project${result.moved === 1 ? "" : "s"} moved to the previous column.`
          : "Column deleted"
      );
    },
    onError: onMutationError,
  });
  const moveProject = trpc.fpb.moveProject.useMutation({
    onSuccess: () => utils.fpb.getProjects.invalidate(),
    onError: (error: any) => {
      utils.fpb.getProjects.invalidate(); // undo the optimistic move
      onMutationError(error);
    },
  });

  const columns = boardData?.columns ?? [];

  const byColumn = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of projects as any[]) {
      const list = map.get(p.columnId);
      if (list) list.push(p);
      else map.set(p.columnId, [p]);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [projects]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) {
        return;
      }
      moveProject.mutate({
        id: draggableId,
        columnId: destination.droppableId,
        position: destination.index,
      });
    },
    [moveProject]
  );

  if (boardLoading || projectsLoading) {
    return (
      <div className={`flex items-center justify-center h-screen ${t.bg}`}>
        <div className={`flex items-center gap-2 text-sm ${t.textMuted}`}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading board...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${t.bg} overflow-hidden`}>
      <header className={`flex items-center justify-between px-6 py-4 border-b ${t.border} flex-shrink-0`}>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <button className={`flex items-center gap-1.5 text-xs ${t.textMuted} hover:opacity-80 transition-opacity`}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </Link>
          <span className={`w-px h-4 ${t.divider}`} />
          <div>
            <h1 className={`text-lg font-semibold ${t.textPrimary}`}>Flow Project Board</h1>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>
              {projects.length} project{projects.length === 1 ? "" : "s"} across {columns.length} column
              {columns.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className={`p-1.5 rounded-lg border transition-colors ${t.btnOutline}`}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className={`h-8 text-xs w-44 ${t.select}`}>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className={t.selectContent}>
              <SelectItem value="all">All Types</SelectItem>
              {PROJECT_TYPES.map(pt => (
                <SelectItem key={pt.value} value={pt.value}>
                  <span className={`flex items-center gap-1.5 ${pt.color}`}>{pt.icon} {pt.short}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <>
              <Button
                onClick={() => setAddColumnOpen(true)}
                variant="outline"
                size="sm"
                className={`h-8 text-xs ${t.btnOutline}`}
              >
                <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Add Column
              </Button>
              <Button
                onClick={() => columns.length > 0 && setNewProjectColumn(columns[0].id)}
                size="sm"
                disabled={columns.length === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New Project
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 p-6 h-full min-w-max">
            {columns.map((col: any) => {
              const colProjects = byColumn.get(col.id) ?? [];
              return (
                <div key={col.id} className="flex flex-col w-72 flex-shrink-0">
                  <ColumnHeader
                    column={col}
                    count={colProjects.length}
                    isAdmin={isAdmin}
                    onRename={(id, name) => updateColumn.mutate({ id, name })}
                    onDelete={id => {
                      if (confirm("Delete this column? Its projects move to the previous column.")) {
                        deleteColumn.mutate({ id });
                      }
                    }}
                    onAddProject={() => setNewProjectColumn(col.id)}
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
                        {colProjects.map((project: any, index: number) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            index={index}
                            users={users as any[]}
                            onOpen={() => setOpenProjectId(project.id)}
                            tokens={t}
                            theme={theme}
                          />
                        ))}
                        {provided.placeholder}
                        {colProjects.length === 0 && !snapshot.isDraggingOver && (
                          <div
                            className={`flex flex-col items-center justify-center h-24 text-xs ${t.emptyIcon} ${
                              isAdmin ? "cursor-pointer hover:opacity-80" : ""
                            }`}
                            onClick={() => isAdmin && setNewProjectColumn(col.id)}
                          >
                            <Plus className="w-5 h-5 mb-1 opacity-50" />
                            {isAdmin ? "Add project" : "No projects"}
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}

            {isAdmin && (
              <button
                onClick={() => setAddColumnOpen(true)}
                className={`flex flex-col items-center justify-center w-64 flex-shrink-0 rounded-xl border border-dashed transition-opacity ${t.borderDashed} ${t.emptyIcon} hover:opacity-80`}
              >
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-xs">Add column</span>
              </button>
            )}
          </div>
        </DragDropContext>
      </div>

      <NewProjectModal
        open={newProjectColumn !== null}
        onClose={() => setNewProjectColumn(null)}
        columnId={newProjectColumn}
        users={users as any[]}
        tokens={t}
      />
      <AddColumnModal open={addColumnOpen} onClose={() => setAddColumnOpen(false)} tokens={t} />

      <Dialog open={openProjectId !== null} onOpenChange={o => !o && setOpenProjectId(null)}>
        <DialogContent
          className={`${t.dialog} max-w-4xl w-[92vw] max-h-[88vh] overflow-y-auto p-0 gap-0`}
        >
          {/* Present for screen readers; the project's own heading is visible. */}
          <DialogHeader className="sr-only">
            <DialogTitle>Project details</DialogTitle>
          </DialogHeader>
          {openProjectId && (
            <ProjectDetailBody
              projectId={openProjectId}
              onClose={() => setOpenProjectId(null)}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
