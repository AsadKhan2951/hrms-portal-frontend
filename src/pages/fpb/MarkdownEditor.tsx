import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AtSign, Bold, Code, Heading, Italic, Link2, List, ListChecks, ListOrdered, Strikethrough,
} from "lucide-react";

import { Avatar } from "@/pages/fpb/shared";
import { Markdown } from "./Markdown";
import { displayToMentions, mentionsToDisplay } from "./markdownParser";

export type MentionPerson = { id: string; name?: string | null; employeeId?: string | null; avatar?: string | null };

/**
 * Text editor for board descriptions and comments: a toolbar that writes
 * Markdown, a Preview tab, and an @ list of the project's people.
 *
 * Markdown keeps the stored text plain and readable (it is what Trello and
 * GitHub do too), and Markdown.tsx renders it without ever producing raw HTML.
 */
export function MarkdownEditor({
  value, onChange, people, tokens, placeholder, rows = 5, autoFocus, onSubmit, onCancel,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Who can be @mentioned: the project's people. */
  people: MentionPerson[];
  tokens: any;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  /** Ctrl/Cmd+Enter. */
  onSubmit?: () => void;
  /** Escape (when the @ list is closed). */
  onCancel?: () => void;
  /** Smaller toolbar, for comments. */
  compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  // The textarea shows "@Muhammad Hassan"; the stored text keeps the id as
  // "@[Muhammad Hassan](user:<id>)". Everyone mentioned so far is remembered
  // here so the plain names can be turned back into mentions on every change.
  const known = useRef(new Map<string, string>());
  const { display, people: inText } = mentionsToDisplay(value);
  inText.forEach((id, name) => known.current.set(name, id));
  const emit = (nextDisplay: string) => onChange(displayToMentions(nextDisplay, known.current));
  // The @ being typed: where it starts and what follows it so far.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return people
      .filter(p => {
        const name = (p.name || p.employeeId || "").toLowerCase();
        return !q || name.split(/\s+/).some(part => part.startsWith(q)) || name.includes(q);
      })
      .slice(0, 8);
  }, [mention, people]);

  /** Puts the caret (or a selection) back after React re-renders the text. */
  const restore = (start: number, end = start) => {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  };

  /** Watches for "@name" right before the caret to open the people list. */
  const detectMention = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = /(?:^|\s)@([\p{L}\p{N}._-]{0,30})$/u.exec(before);
    if (m) {
      setMention({ start: caret - m[1].length - 1, query: m[1] });
      setHighlight(0);
    } else {
      setMention(null);
    }
  };

  const pick = (person: MentionPerson) => {
    if (!mention) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? display.length;
    const name = (person.name || person.employeeId || "someone").replace(/[\[\]\n]/g, "").slice(0, 80);
    known.current.set(name, person.id);
    const inserted = `@${name} `;
    const next = display.slice(0, mention.start) + inserted + display.slice(caret);
    emit(next);
    setMention(null);
    restore(mention.start + inserted.length);
  };

  /** Wraps the selection, e.g. **bold**; with nothing selected inserts a placeholder. */
  const wrap = (before: string, after: string, fallback: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = display.slice(s, e) || fallback;
    const next = display.slice(0, s) + before + selected + after + display.slice(e);
    emit(next);
    restore(s + before.length, s + before.length + selected.length);
  };

  /** Starts every selected line with a prefix, e.g. "- " or "- [ ] ". */
  const prefixLines = (prefix: (index: number) => string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = display.lastIndexOf("\n", s - 1) + 1;
    const block = display.slice(lineStart, e);
    const lines = block.split("\n");
    const replaced = lines.map((line, i) => prefix(i) + line).join("\n");
    const next = display.slice(0, lineStart) + replaced + display.slice(e);
    emit(next);
    restore(lineStart, lineStart + replaced.length);
  };

  const insertAt = () => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const needsSpace = caret > 0 && !/\s/.test(display[caret - 1]);
    const ins = `${needsSpace ? " " : ""}@`;
    const next = display.slice(0, caret) + ins + display.slice(el.selectionEnd);
    emit(next);
    setMention({ start: caret + ins.length - 1, query: "" });
    setHighlight(0);
    restore(caret + ins.length);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && matches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => (h + 1) % matches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => (h - 1 + matches.length) % matches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[highlight]); return; }
    }
    if (e.key === "Escape") {
      if (mention) { e.preventDefault(); e.stopPropagation(); setMention(null); return; }
      if (onCancel) { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); wrap("**", "**", "bold"); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") { e.preventDefault(); wrap("*", "*", "italic"); }
  };

  const tools: { icon: any; label: string; run: () => void; full?: boolean }[] = [
    { icon: Bold, label: "Bold (Ctrl+B)", run: () => wrap("**", "**", "bold") },
    { icon: Italic, label: "Italic (Ctrl+I)", run: () => wrap("*", "*", "italic") },
    { icon: Strikethrough, label: "Strikethrough", run: () => wrap("~~", "~~", "text") },
    { icon: Heading, label: "Heading", run: () => prefixLines(() => "## "), full: true },
    { icon: List, label: "Bulleted list", run: () => prefixLines(() => "- ") },
    { icon: ListOrdered, label: "Numbered list", run: () => prefixLines(i => `${i + 1}. `), full: true },
    { icon: ListChecks, label: "Checklist", run: () => prefixLines(() => "- [ ] ") },
    { icon: Link2, label: "Link", run: () => wrap("[", "](https://)", "link text") },
    { icon: Code, label: "Code", run: () => wrap("`", "`", "code"), full: true },
    { icon: AtSign, label: "Mention someone", run: insertAt },
  ];

  return (
    <div className={`fpb-editor rounded-lg border ${tokens.border}`}>
      <div className={`flex items-center gap-0.5 border-b px-1.5 py-1 ${tokens.border}`}>
        {tools
          .filter(t => !compact || !t.full)
          .map(t => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              disabled={tab === "preview"}
              onMouseDown={e => e.preventDefault()}
              onClick={t.run}
              className={`rounded p-1.5 ${tokens.textMuted} hover:bg-background hover:text-[#8f86ff] disabled:opacity-40`}
            >
              <t.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        <span className="ml-auto flex text-[11px]">
          {(["write", "preview"] as const).map(name => (
            <button
              key={name}
              type="button"
              onClick={() => { setTab(name); setMention(null); }}
              className={`rounded px-2 py-1 capitalize ${
                tab === name ? `font-semibold ${tokens.textPrimary}` : tokens.textMuted
              }`}
            >
              {name}
            </button>
          ))}
        </span>
      </div>

      {tab === "write" ? (
        <div className="relative">
          <textarea
            ref={ref}
            value={display}
            rows={rows}
            autoFocus={autoFocus}
            placeholder={placeholder}
            onChange={e => {
              emit(e.target.value);
              detectMention(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={onKeyDown}
            onClick={e => detectMention(display, e.currentTarget.selectionStart)}
            onBlur={() => setTimeout(() => setMention(null), 150)}
            className={`block w-full resize-y bg-transparent px-3 py-2 text-sm outline-none ${tokens.textPrimary}`}
          />
          {mention && (
            <div
              role="listbox"
              aria-label="Mention someone"
              className={`absolute left-2 right-2 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border p-1 shadow-xl ${tokens.selectContent}`}
            >
              {matches.length === 0 ? (
                <p className={`px-2 py-1.5 text-xs ${tokens.textMuted}`}>
                  No one on this project matches "{mention.query}"
                </p>
              ) : (
                matches.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseDown={e => { e.preventDefault(); pick(p); }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                      i === highlight ? "bg-[#4233e0] text-white" : ""
                    }`}
                  >
                    <Avatar user={p} size={18} />
                    <span className="truncate">{p.name || p.employeeId}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-[80px] px-3 py-2 text-sm">
          {value.trim() ? (
            <Markdown source={value} users={people as any} />
          ) : (
            <p className={tokens.textMuted}>Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}
