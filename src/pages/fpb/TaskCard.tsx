import { Draggable } from "@hello-pangea/dnd";
import { CheckSquare, MessageSquare } from "lucide-react";
import { initialsOf, isTaskDone, taskTag } from "./shared";

/** One task card on a project's board. */
export function TaskCard({
  task, index, users, onOpen, myId,
}: {
  task: any; index: number; users: any[];
  onOpen: () => void;
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
          className={`now-kcard${snapshot.isDragging ? " dragging" : ""}`}
        >
          <div className={`now-kcard-title${done ? " done" : ""}`}>{task.title}</div>

          {(loud || subtasks.length > 0 || task.commentCount > 0) && (
            <div className="now-kcard-meta">
              {loud && <span className="now-pill risk">{task.priority}</span>}
              {subtasks.length > 0 && (
                <span><CheckSquare className="h-3.5 w-3.5" aria-hidden="true" /> {doneSubs}/{subtasks.length}</span>
              )}
              {task.commentCount > 0 && (
                <span><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {task.commentCount}</span>
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
