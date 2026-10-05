import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AvatarFace from "@/components/now/AvatarFace";
import NowPage from "@/components/now/NowPage";
import { trpc } from "@/lib/trpc";

const stamp = (value: Date | string) => {
  const date = new Date(value);
  return isToday(date) ? format(date, "HH:mm") : format(date, "d MMM, HH:mm");
};

/** Chat: the team channel and direct messages, side by side. */
export default function Chat() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const me = user?.id ? String(user.id) : null;
  // null is the team channel; otherwise the id of the person in a direct message.
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: users = [], isLoading: usersLoading } = trpc.dashboard.getUsers.useQuery();
  const { data: messages = [], isLoading: messagesLoading, isError } = trpc.chat.getMessages.useQuery(
    { limit: 100 },
    { refetchInterval: 3000 }
  );
  const markRead = trpc.chat.markRead.useMutation();
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage("");
      setAttachments([]);
      utils.chat.getMessages.invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Could not send the message"),
  });

  const all = messages as any[];
  const people = (users as any[]).filter(person => String(person.id) !== me);
  const nameOf = (id: unknown) => (users as any[]).find(person => String(person.id) === String(id))?.name ?? "Someone";

  // A message belongs to the team channel when it has no recipient, and to a
  // direct thread when it is between the two people in it.
  const inThread = (msg: any, other: string | null) => {
    const recipient = msg.recipientId ? String(msg.recipientId) : null;
    const sender = String(msg.senderId);
    if (other === null) return recipient === null;
    return (sender === other && recipient === me) || (sender === me && recipient === other);
  };

  const thread = useMemo(
    () => all.filter(msg => inThread(msg, selected)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, selected, me]
  );

  const unread = useMemo(
    () => all.filter(msg => !msg.isRead && String(msg.senderId) !== me && (!msg.recipientId || String(msg.recipientId) === me)),
    [all, me]
  );
  const unreadIn = (other: string | null) => unread.filter(msg => inThread(msg, other)).length;
  const lastIn = (other: string | null) => {
    const list = all.filter(msg => inThread(msg, other));
    if (list.length === 0) return null;
    return list.reduce((latest, msg) => (new Date(msg.createdAt) > new Date(latest.createdAt) ? msg : latest));
  };
  const preview = (other: string | null, fallback: string) => {
    const last = lastIn(other);
    if (!last) return fallback;
    return `${String(last.senderId) === me ? "You" : String(nameOf(last.senderId)).split(" ")[0]}: ${last.message}`;
  };

  // Opening a thread reads it. Each message is marked once.
  const marked = useRef(new Set<string>());
  useEffect(() => {
    for (const msg of unread) {
      const id = String(msg.id);
      if (!inThread(msg, selected) || marked.current.has(id)) continue;
      marked.current.add(id);
      markRead.mutate({ messageId: msg.id }, { onSuccess: () => utils.chat.getMessages.invalidate() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, selected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length, selected]);

  const submit = () => {
    if (send.isPending) return;
    let text = message.trim();
    if (!text && attachments.length === 0) return;
    // Files are not uploaded by chat yet; their names are sent so the other person knows to ask.
    if (attachments.length > 0) text += `${text ? "\n" : ""}Attachments: ${attachments.map(file => file.name).join(", ")}`;
    send.mutate({ message: text, recipientId: selected || undefined });
  };

  const title = selected ? nameOf(selected) : "Team chat";
  const selectedPerson = selected ? (users as any[]).find(person => String(person.id) === selected) : null;

  return (
    <NowPage title="Chat" subtitle="Team and direct messages">
      <div className="now-cols" style={{ alignItems: "stretch" }}>
        <section className="now-card" style={{ flex: "1 1 280px", minWidth: 0, padding: "16px 12px", gap: 4 }}>
          <div className="now-small now-muted" style={{ padding: "8px 12px 4px" }}>
            Channels
          </div>
          <button
            type="button"
            className="now-chat-row"
            aria-current={selected === null ? "true" : undefined}
            onClick={() => setSelected(null)}
          >
            <span className="now-chat-hash" aria-hidden="true">
              #
            </span>
            <span style={{ flex: "1 1 0", minWidth: 0 }}>
              <span className="now-row-title" style={{ display: "block" }}>
                Team chat
              </span>
              <span className="now-row-sub truncate" style={{ display: "block" }}>
                {preview(null, "Everyone in the company")}
              </span>
            </span>
            {unreadIn(null) > 0 && <span className="now-chat-new">{unreadIn(null)} new</span>}
          </button>

          <div className="now-small now-muted" style={{ padding: "16px 12px 4px" }}>
            Direct messages
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 520, overflowY: "auto" }}>
            {usersLoading ? (
              <div className="now-muted" style={{ padding: "8px 12px" }}>
                Loading people...
              </div>
            ) : people.length === 0 ? (
              <div className="now-muted" style={{ padding: "8px 12px" }}>
                Nobody else is on the portal yet.
              </div>
            ) : (
              people.map(person => {
                const id = String(person.id);
                const count = unreadIn(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="now-chat-row"
                    aria-current={selected === id ? "true" : undefined}
                    onClick={() => setSelected(id)}
                  >
                    <AvatarFace avatar={person.avatar} name={person.name} size={36} />
                    <span style={{ flex: "1 1 0", minWidth: 0 }}>
                      <span className="now-row-title" style={{ display: "block" }}>
                        {person.name}
                      </span>
                      <span className="now-row-sub truncate" style={{ display: "block" }}>
                        {preview(id, person.position || person.department || person.email || "")}
                      </span>
                    </span>
                    {count > 0 && <span className="now-chat-new">{count} new</span>}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="now-card" style={{ flex: "3 1 520px", minWidth: 0, gap: 20, minHeight: 640 }}>
          <div style={{ paddingBottom: 16, borderBottom: "1px solid var(--secondary)" }}>
            <h2 className="now-h2">{title}</h2>
            <div className="now-row-sub">
              {selected
                ? [selectedPerson?.position, selectedPerson?.department].filter(Boolean).join(" · ") || "Direct message"
                : `Team channel · ${(users as any[]).length} ${(users as any[]).length === 1 ? "person" : "people"}`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: "1 1 auto", maxHeight: 560, overflowY: "auto" }} aria-live="polite">
            {isError ? (
              <div className="now-warn">Could not load messages. Refresh to try again.</div>
            ) : messagesLoading ? (
              <div className="now-muted">Loading messages...</div>
            ) : thread.length === 0 ? (
              <div className="now-muted">{selected ? `No messages with ${title} yet.` : "No messages in the team channel yet."}</div>
            ) : (
              thread.map(msg => {
                const mine = String(msg.senderId) === me;
                const sender = (users as any[]).find(person => String(person.id) === String(msg.senderId));
                return (
                  <div key={msg.id} style={{ display: "flex", gap: 12 }}>
                    <AvatarFace avatar={mine ? user?.avatar : sender?.avatar} name={mine ? user?.name : sender?.name} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{mine ? "You" : sender?.name ?? "Someone"}</span>{" "}
                        <span className="now-small now-muted">{stamp(msg.createdAt)}</span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{msg.message}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <div>
            {attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {attachments.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="now-pill" style={{ display: "inline-flex", alignItems: "center", gap: 6, textTransform: "none" }}>
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate" style={{ maxWidth: 160 }}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                      style={{ border: 0, background: "transparent", padding: 0, display: "flex" }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form
              className="now-composer soft"
              onSubmit={event => {
                event.preventDefault();
                submit();
              }}
            >
              <label htmlFor="chat-msg" className="sr-only-now">
                Message {title}
              </label>
              <input
                id="chat-msg"
                type="text"
                value={message}
                autoComplete="off"
                onChange={event => setMessage(event.target.value)}
                placeholder={`Message ${title}`}
              />
              <label htmlFor="chat-files" className="now-icon-btn" style={{ background: "transparent", cursor: "pointer" }} title="Add file names to the message">
                <Paperclip className="h-5 w-5" />
                <span className="sr-only-now">Attach files</span>
              </label>
              <input
                id="chat-files"
                type="file"
                multiple
                className="sr-only"
                onChange={event => {
                  if (event.target.files) setAttachments([...attachments, ...Array.from(event.target.files)]);
                  event.target.value = "";
                }}
              />
              <button type="submit" className="now-send" aria-label="Send" disabled={send.isPending || (!message.trim() && attachments.length === 0)}>
                {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.4} />}
              </button>
            </form>
          </div>
        </section>
      </div>
    </NowPage>
  );
}
