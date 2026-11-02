import { Draggable } from "@hello-pangea/dnd";
import { CheckSquare, MessageSquare, MoreHorizontal, Paperclip, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf, isTaskDone, taskTag } from "./shared";
import { attachmentUrl } from "./TaskAttachments";
import { checklistProgress } from "./markdownParser";

/** One task card on a project's board. */
export function TaskCard({
  task, index, users, onOpen, myId, labels = [], onDelete,
}: {
  task: any; index: number; users: any[];
  /** The project's labels; the card shows the ones it carries. */
  labels?: any[];
  onOpen: () => void;
  /** Shown in the card's quick menu when given. */
  onDelete?: () => void;
  myId?: string | null;
  /** Kept so older callers still compile; the card reads the portal theme itself. */
  tokens?: any; theme?: string;
}) {
  const subtasks: any[] = task.subtasks ?? [];
  const doneSubs = subtasks.filter(s => s.completed).length;
  const assignee = users.find((u: any) => u.id === task.assignedTo);
  const memberIds: string[] = task.memberIds ?? [];
  const extra = memberIds.filter(id => id !== task.assignedTo);
  const tag = taskTag(task);
  const done = isTaskDone(task);
  const loud = !done && (task.priority === "urgent" || task.priority === "high");
  const labelIds: string[] = (task.labelIds ?? []).map(String);
  const cardLabels = labels.filter((l: any) => labelIds.includes(String(l.id)));
  // Checklist items written in the description count too, like Trello's checklists.
  const descChecks = checklistProgress(task.description);
  const checkDone = doneSubs + descChecks.done;
  const checkTotal = subtasks.length + descChecks.total;

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onOpen}
          onKeyDown={event => {
            if (event.key === "Enter") onOpen();
          }}
          aria-label={`${task.title}. ${tag.label}`}
          className={`now-kcard group${snapshot.isDragging ? " dragging" : ""}`}
        >
          {/* Quick actions, like Trello's pencil on hover. */}
          <div className="now-kcard-menu" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`Actions for ${task.title}`} className="now-kcard-menu-btn">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                <DropdownMenuItem onClick={onOpen} className="cursor-pointer">
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Open / edit card
                </DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-red-500 focus:text-red-500">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete card
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {task.coverAttachmentId && (
            <img
              src={attachmentUrl(task.coverAttachmentId)}
              alt=""
              loading="lazy"
              draggable={false}
              className="now-kcard-cover"
            />
          )}
          {cardLabels.length > 0 && (
            <div className="now-kcard-labels">
              {cardLabels.map((l: any) => (
                <span
                  key={l.id}
                  className="fpb-label sm"
                  style={{ backgroundColor: l.color }}
                  title={l.name || undefined}
                >
                  {l.name || "\u00a0"}
                </span>
              ))}
            </div>
          )}
          <div className={`now-kcard-title${done ? " done" : ""}`}>{task.title}</div>

          {(loud || checkTotal > 0 || task.commentCount > 0 || task.attachmentCount > 0) && (
            <div className="now-kcard-meta">
              {loud && <span className="now-pill risk">{task.priority}</span>}
              {checkTotal > 0 && (
                <span><CheckSquare className="h-3.5 w-3.5" aria-hidden="true" /> {checkDone}/{checkTotal}</span>
              )}
              {task.commentCount > 0 && (
                <span><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {task.commentCount}</span>
              )}
              {task.attachmentCount > 0 && (
                <span><Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> {task.attachmentCount}</span>
              )}
            </div>
          )}

          <div className="now-kcard-foot">
            <span className={`now-kcard-tag ${tag.tone}`}>{tag.label}</span>
            <span className="now-kavatars">
              {extra.slice(0, 2).map(id => {
                const member = users.find((x: any) => x.id === id);
                return (
                  <span key={id} title={member?.name} className="now-kavatar">
                    {initialsOf(member)}
                  </span>
                );
              })}
              {assignee && (
                <span
                  title={assignee.name}
                  className={`now-kavatar${myId && assignee.id === myId ? " me" : ""}`}
                >
                  {initialsOf(assignee)}
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}
