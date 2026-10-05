import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUp, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import NowPage from "@/components/now/NowPage";
import { trpc } from "@/lib/trpc";

type Message = {
  id: string;
  role: "user" | "wingman";
  text: string;
  items: { label: string; meta?: string; tone?: string }[];
  link: { label: string; href: string } | null;
  action: { kind: string; title: string; detail: string; status: "ready" | "sent" | "cancelled" } | null;
};

const SUGGESTIONS = [
  "What is on my plate today?",
  "Start my break",
  "How much leave do I have left?",
  "Write my standup",
  "How are my hours this month?",
];

const toneColor = (tone?: string) =>
  tone === "warn" ? "var(--now-warn)" : tone === "muted" ? "var(--muted-foreground)" : "var(--foreground)";

/**
 * Wingman inside the portal. It reads simple requests and carries them out
 * against the same records the rest of the portal uses; anything that goes to
 * HR is shown first and sent only when the person says so.
 */
export default function Wingman() {
  const utils = trpc.useUtils();
  const history = trpc.wingman.getHistory.useQuery();
  const overview = trpc.wingman.getOverview.useQuery();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const messages = (history.data ?? []) as Message[];

  // Anything Wingman does may change the clock, leave or requests shown elsewhere.
  const refreshEverything = () => {
    utils.wingman.getHistory.invalidate();
    utils.wingman.getOverview.invalidate();
    utils.timeTracking.getActive.invalidate();
    utils.timeTracking.getBreakLogs.invalidate();
    utils.time.getFourWeeks.invalidate();
    utils.time.getLeaveBalance.invalidate();
    utils.leaves.getMyLeaves.invalidate();
    utils.requests.getMine.invalidate();
  };

  const ask = trpc.wingman.ask.useMutation({
    onSuccess: () => {
      setText("");
      refreshEverything();
    },
    onError: (error: any) => toast.error(error.message || "Wingman could not answer. Try again."),
  });
  const confirm = trpc.wingman.confirmAction.useMutation({
    onSuccess: () => {
      toast.success("Sent");
      refreshEverything();
    },
    onError: (error: any) => toast.error(error.message || "Could not send it"),
  });
  const cancel = trpc.wingman.cancelAction.useMutation({
    onSuccess: refreshEverything,
    onError: (error: any) => toast.error(error.message || "Could not cancel it"),
  });
  const clear = trpc.wingman.clearHistory.useMutation({ onSuccess: refreshEverything });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, ask.isPending]);

  const send = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || ask.isPending) return;
    ask.mutate({ text: trimmed });
  };

  const data = overview.data;
  const settings = data?.settings;

  return (
    <NowPage title="Wingman" subtitle="Your own chief of staff at work. Ask, and it handles the portal part." hideAsk>
      <div className="now-cols" style={{ alignItems: "stretch" }}>
        <section className="now-card roomy now-col-main" style={{ gap: 24 }}>
          <div className="now-chat" aria-live="polite">
            {history.isLoading ? (
              <div className="now-muted">Loading your conversation...</div>
            ) : messages.length === 0 && !ask.isPending ? (
              <div className="now-bubble-wm">
                <div className="now-lede">Tell me what you need.</div>
                <div className="now-body-2">
                  I can clock you in and out, start a break, draft leave, raise a ticket, and tell you what is due. I work
                  from the portal's own records, and I never send a request to HR without your OK.
                </div>
              </div>
            ) : (
              messages.map(message =>
                message.role === "user" ? (
                  <div key={message.id} className="now-bubble-me">
                    {message.text}
                  </div>
                ) : (
                  <div key={message.id} className="now-bubble-wm">
                    <div>{message.text}</div>
                    {message.items.length > 0 && (
                      <div className="now-wm-list">
                        {message.items.map((item, index) => (
                          <div key={index}>
                            <span style={{ fontWeight: 600 }}>{item.label}</span>
                            {item.meta ? (
                              <span style={{ fontSize: 13, textAlign: "right", fontWeight: item.tone === "warn" ? 700 : 400, color: toneColor(item.tone) }}>
                                {item.meta}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    {message.action && (
                      <div className="now-wm-action">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{message.action.title}</div>
                          <div className="now-body-2" style={{ fontSize: 13 }}>
                            {message.action.detail}
                          </div>
                        </div>
                        {message.action.status === "ready" ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="now-btn indigo sm"
                              disabled={confirm.isPending || cancel.isPending}
                              onClick={() => confirm.mutate({ messageId: message.id })}
                            >
                              {message.action.kind === "leave" ? "Send to HR" : "Send"}
                            </button>
                            <button
                              type="button"
                              className="now-btn white sm"
                              disabled={confirm.isPending || cancel.isPending}
                              onClick={() => cancel.mutate({ messageId: message.id })}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }} className={message.action.status === "sent" ? "" : "now-muted"}>
                            {message.action.status === "sent" && <Check className="h-4 w-4" />}
                            {message.action.status === "sent" ? "Sent" : "Cancelled"}
                          </span>
                        )}
                      </div>
                    )}
                    {message.link && (
                      <Link href={message.link.href} className="now-link" style={{ alignSelf: "flex-start" }}>
                        {message.link.label}
                      </Link>
                    )}
                  </div>
                )
              )
            )}
            {ask.isPending && (
              <>
                <div className="now-bubble-me">{ask.variables?.text}</div>
                <div className="now-bubble-wm now-muted" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Working on it...
                </div>
              </>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="now-chip-row">
              {SUGGESTIONS.map(suggestion => (
                <button key={suggestion} type="button" className="now-chip" disabled={ask.isPending} onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
            <form
              className="now-composer"
              onSubmit={event => {
                event.preventDefault();
                send(text);
              }}
            >
              <label htmlFor="wm-ask" className="sr-only-now">
                Message Wingman
              </label>
              <input
                id="wm-ask"
                type="text"
                value={text}
                maxLength={500}
                autoComplete="off"
                onChange={event => setText(event.target.value)}
                placeholder="Ask Wingman to do something"
              />
              <button type="submit" className="now-send" aria-label="Send" disabled={!text.trim() || ask.isPending}>
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </form>
            {messages.length > 0 && (
              <button type="button" className="now-link now-small" style={{ alignSelf: "flex-start" }} disabled={clear.isPending} onClick={() => clear.mutate()}>
                Clear this conversation
              </button>
            )}
          </div>
        </section>

        <aside className="now-col-side">
          <div className="now-card">
            <h2 className="now-h2">Watching for you</h2>
            {overview.isError ? (
              <div className="now-warn">Could not load this. Refresh to try again.</div>
            ) : !data ? (
              <div className="now-muted">Loading...</div>
            ) : data.watching.length === 0 ? (
              <div className="now-muted">Nothing needs fixing. No overdue tasks, no open attendance records.</div>
            ) : (
              data.watching.map((item: any, index: number) => (
                <Link key={index} href={item.href} style={{ display: "block" }}>
                  <div className="now-row-title">{item.title}</div>
                  <div className="now-row-sub">{item.detail}</div>
                </Link>
              ))
            )}
          </div>

          <div className="now-card">
            <h2 className="now-h2">Follow-ups</h2>
            <div className="now-small now-muted">Waiting on you</div>
            {data && data.waitingOnYou.length === 0 && <div className="now-muted">Nothing.</div>}
            {(data?.waitingOnYou ?? []).map((item: any, index: number) => (
              <Link key={index} href={item.href} style={{ display: "block" }}>
                <div className="now-row-title">{item.title}</div>
                <div className="now-row-sub">{item.detail}</div>
              </Link>
            ))}
            <div className="now-small now-muted">You are waiting on</div>
            {data && data.waitingOn.length === 0 && <div className="now-muted">Nothing.</div>}
            {(data?.waitingOn ?? []).map((item: any, index: number) => (
              <Link key={index} href={item.href} style={{ display: "block" }}>
                <div className="now-row-title">{item.title}</div>
                <div className="now-row-sub">{item.detail}</div>
              </Link>
            ))}
          </div>

          <div className="now-card" style={{ gap: 12 }}>
            <div className="now-card-head">
              <h2 className="now-h2">Settings</h2>
              <Link href="/account" className="now-link">
                Change
              </Link>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Ask before sending</span>
              <span className="tabular-nums now-small">{settings ? (settings.askBeforeSending ? "on" : "off") : "--"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Morning brief on Home</span>
              <span className="tabular-nums now-small">{settings ? (settings.morningBrief ? "on" : "off") : "--"}</span>
            </div>
            <div className="now-small now-muted" style={{ paddingTop: 8, borderTop: "1px solid var(--secondary)" }}>
              Wingman on WhatsApp is a separate assistant with its own memory. It clocks you in and out and sends your task alerts.
            </div>
          </div>
        </aside>
      </div>
    </NowPage>
  );
}
