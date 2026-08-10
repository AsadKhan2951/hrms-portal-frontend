import { Draggable } from "@hello-pangea/dnd";
import { Calendar, CheckSquare, MessageSquare } from "lucide-react";
import { PRIORITY_COLORS, formatDate, initialOf, type Priority } from "./shared";

/** One task card on a project's board. */
export function TaskCard({
  task, index, users, onOpen, tokens, theme,
}: {
  task: any; index: number; users: any[];
  onOpen: () => void; tokens: any; theme: string;
}) {
  const subtasks: any[] = task.subtasks ?? [];
  const doneSubs = subtasks.filter(s => s.completed).length;
  const assignee = users.find((u: any) => u.id === task.assignedTo);
  const memberIds: string[] = task.memberIds ?? [];
  const extra = memberIds.filter(id => id !== task.assignedTo);
  const overdue =
    task.dueDate && !task.completed && new Date(task.dueDate) < new Date(new Date().toDateString());

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onOpen}
          className={`group border rounded-lg p-3 mb-2 cursor-pointer transition-all select-none ${tokens.card} ${
            snapshot.isDragging
              ? "border-violet-500/60 shadow-lg shadow-violet-500/10 rotate-1"
              : `${tokens.border} hover:border-violet-400/50`
          }`}
        >
          <p className={`text-sm leading-snug mb-2 ${
            task.completed ? `line-through ${tokens.textMuted}` : tokens.textPrimary
          }`}>
            {task.title}
          </p>

          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
              PRIORITY_COLORS[task.priority as Priority] ?? PRIORITY_COLORS.medium
            }`}>
              {task.priority}
            </span>
            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] ${
                overdue ? "text-red-400" : tokens.textMuted
              }`}>
                <Calendar className="w-2.5 h-2.5" /> {formatDate(task.dueDate)}
              </span>
            )}
            {subtasks.length > 0 && (
              <span className={`flex items-center gap-1 text-[10px] ${tokens.textMuted}`}>
                <CheckSquare className="w-2.5 h-2.5" /> {doneSubs}/{subtasks.length}
              </span>
            )}
            {task.commentCount > 0 && (
              <span className={`flex items-center gap-1 text-[10px] ${tokens.textMuted}`}>
                <MessageSquare className="w-2.5 h-2.5" /> {task.commentCount}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase tracking-wide ${tokens.textMuted}`}>
              {String(task.status).replace("_", " ")}
            </span>
            <div className="flex -space-x-1.5">
              {assignee && (
                <span
                  title={assignee.name}
                  className={`w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[9px] text-white font-bold border ${
                    theme === "dark" ? "border-[#0f0f13]" : "border-white"
                  }`}
                >
                  {initialOf(assignee)}
                </span>
              )}
              {extra.slice(0, 2).map(id => {
                const u = users.find((x: any) => x.id === id);
                return (
                  <span
                    key={id}
                    title={u?.name}
                    className={`w-5 h-5 rounded-full bg-slate-500/60 flex items-center justify-center text-[9px] text-white font-bold border ${
                      theme === "dark" ? "border-[#0f0f13]" : "border-white"
                    }`}
                  >
                    {initialOf(u)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
