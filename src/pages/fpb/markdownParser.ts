/**
 * A small, safe Markdown reader for task descriptions and comments.
 *
 * It turns text into a plain tree that Markdown.tsx renders as React elements,
 * so nothing the user typed is ever handed to the browser as HTML: there is no
 * dangerouslySetInnerHTML anywhere, and links are limited to http(s) and mailto.
 * That is why the board can offer formatting without a sanitiser or a heavy
 * editor dependency.
 *
 * Supported: # headings, **bold**, *italic* / _italic_, ~~strike~~, `code`,
 * ``` code blocks ```, > quotes, - / 1. lists, - [ ] checklists, [links](https://..),
 * bare URLs, --- rules, and @[Name](user:<id>) mentions.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "del"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "mention"; userId: string; name: string }
  | { type: "br" };

export type ListItem = {
  /** null for a plain bullet, true/false for a checklist item. */
  checked: boolean | null;
  /** Line number in the source, so a checkbox click can toggle that line. */
  line: number;
  children: Inline[];
};

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "quote"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "code"; text: string }
  | { type: "hr" };

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/** Only web and mail links survive; anything else (javascript:, data:) is dropped. */
export function safeHref(href: string): string | null {
  const trimmed = href.trim();
  return SAFE_HREF.test(trimmed) ? trimmed : null;
}

// ------------------------------------------------------------------ inline

type Rule = {
  re: RegExp;
  build: (m: RegExpExecArray) => Inline | null;
};

// Order matters: code first (its contents are literal), mentions before links.
const RULES: Rule[] = [
  { re: /`([^`\n]+)`/y, build: m => ({ type: "code", text: m[1] }) },
  {
    re: /@\[([^\]\n]{1,80})\]\(user:([0-9a-fA-F]{24})\)/y,
    build: m => ({ type: "mention", name: m[1], userId: m[2].toLowerCase() }),
  },
  {
    re: /\[([^\]\n]+)\]\(([^)\s]+)\)/y,
    build: m => {
      const href = safeHref(m[2]);
      return href
        ? { type: "link", href, children: parseInline(m[1]) }
        : { type: "text", text: m[1] };
    },
  },
  { re: /\*\*([^*\n](?:[^\n]*?[^*\n])?)\*\*/y, build: m => ({ type: "strong", children: parseInline(m[1]) }) },
  { re: /~~([^~\n]+)~~/y, build: m => ({ type: "del", children: parseInline(m[1]) }) },
  { re: /\*([^*\s](?:[^*\n]*?[^*\s])?)\*/y, build: m => ({ type: "em", children: parseInline(m[1]) }) },
  // snake_case stays text: an underscore only opens italics after a non-word
  // character (checked in parseInline, since older Safari has no lookbehind).
  { re: /_([^_\s](?:[^_\n]*?[^_\s])?)_(?![A-Za-z0-9])/y, build: m => ({ type: "em", children: parseInline(m[1]) }) },
  {
    re: /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/y,
    build: m => ({ type: "link", href: m[1], children: [{ type: "text", text: m[1] }] }),
  },
];

/** Characters at which an inline rule might start; everything else is plain text. */
const TRIGGERS = new Set(["`", "@", "[", "*", "~", "_", "h"]);

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      flush();
      out.push({ type: "br" });
      i += 1;
      continue;
    }
    let matched = false;
    const midWord = ch === "_" && i > 0 && /[A-Za-z0-9]/.test(text[i - 1]);
    if (TRIGGERS.has(ch) && !midWord) {
      for (const rule of RULES) {
        rule.re.lastIndex = i;
        const m = rule.re.exec(text);
        if (m) {
          const node = rule.build(m);
          if (node) {
            flush();
            out.push(node);
            i += m[0].length;
            matched = true;
            break;
          }
        }
      }
    }
    if (!matched) {
      buffer += ch;
      i += 1;
    }
  }
  flush();
  return out;
}

// ------------------------------------------------------------------ blocks

const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const CHECK = /^\[( |x|X)\]\s+(.*)$/;

export function parseMarkdown(source: string | null | undefined): Block[] {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
      paragraph = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: everything until the closing fence is literal.
    if (/^\s*```/.test(line)) {
      flushParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: "code", text: body.join("\n") });
      i += 1; // closing fence (or end of text)
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2]),
      });
      i += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushParagraph();
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", children: parseInline(body.join("\n")) });
      continue;
    }

    const ordered = ORDERED.test(line);
    if (ordered || BULLET.test(line)) {
      flushParagraph();
      const pattern = ordered ? ORDERED : BULLET;
      const items: ListItem[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        const content = pattern.exec(lines[i])![1];
        const check = ordered ? null : CHECK.exec(content);
        items.push({
          checked: check ? check[1].toLowerCase() === "x" : null,
          line: i,
          children: parseInline(check ? check[2] : content),
        });
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    paragraph.push(line);
    i += 1;
  }
  flushParagraph();
  return blocks;
}

/** Flips the checklist box on one source line: "- [ ] x" <-> "- [x] x". */
export function toggleChecklistLine(source: string, line: number): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const current = lines[line];
  if (current === undefined) return source;
  lines[line] = current.replace(/^(\s*[-*+]\s+)\[( |x|X)\]/, (_m, lead: string, mark: string) =>
    `${lead}[${mark === " " ? "x" : " "}]`
  );
  return lines.join("\n");
}

/** How many checklist items a text has, and how many are ticked. */
export function checklistProgress(source: string | null | undefined): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const block of parseMarkdown(source)) {
    if (block.type !== "list") continue;
    for (const item of block.items) {
      if (item.checked === null) continue;
      total += 1;
      if (item.checked) done += 1;
    }
  }
  return { done, total };
}

/** The mention token the editor inserts for a picked person. */
export function mentionToken(user: { id: string; name?: string | null; employeeId?: string | null }): string {
  const name = (user.name || user.employeeId || "someone").replace(/[\[\]\n]/g, "").slice(0, 80);
  return `@[${name}](user:${user.id})`;
}
