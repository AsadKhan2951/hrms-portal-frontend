import { Fragment, type ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "./markdownParser";

/**
 * Renders board Markdown (descriptions, comments) as React elements.
 * Everything goes through React, so user text is always escaped; see markdownParser.ts.
 */
export function Markdown({
  source, users, onToggleCheck, className,
}: {
  source: string | null | undefined;
  /** For showing a mention with the person's current name. */
  users?: { id: string; name?: string | null }[];
  /** When given, checklist boxes are clickable and report the source line. */
  onToggleCheck?: (line: number) => void;
  className?: string;
}) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) return null;
  return (
    <div className={`fpb-md ${className ?? ""}`}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} users={users} onToggleCheck={onToggleCheck} />
      ))}
    </div>
  );
}

function BlockView({
  block, users, onToggleCheck,
}: {
  block: Block;
  users?: { id: string; name?: string | null }[];
  onToggleCheck?: (line: number) => void;
}) {
  const inl = (nodes: Inline[]) => <InlineView nodes={nodes} users={users} />;
  switch (block.type) {
    case "heading": {
      const Tag = (`h${block.level + 2}` as "h3" | "h4" | "h5");
      return <Tag>{inl(block.children)}</Tag>;
    }
    case "paragraph":
      return <p>{inl(block.children)}</p>;
    case "quote":
      return <blockquote>{inl(block.children)}</blockquote>;
    case "code":
      return <pre><code>{block.text}</code></pre>;
    case "hr":
      return <hr />;
    case "list": {
      const items = block.items.map((item, i) =>
        item.checked === null ? (
          <li key={i}>{inl(item.children)}</li>
        ) : (
          <li key={i} className="fpb-md-check">
            <input
              type="checkbox"
              checked={item.checked}
              disabled={!onToggleCheck}
              onChange={() => onToggleCheck?.(item.line)}
              onClick={e => e.stopPropagation()}
              aria-label="Checklist item"
            />
            <span className={item.checked ? "fpb-md-done" : undefined}>{inl(item.children)}</span>
          </li>
        )
      );
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
  }
}

function InlineView({
  nodes, users,
}: {
  nodes: Inline[];
  users?: { id: string; name?: string | null }[];
}): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{node.text}</Fragment>;
      case "br":
        return <br key={i} />;
      case "code":
        return <code key={i}>{node.text}</code>;
      case "strong":
        return <strong key={i}><InlineView nodes={node.children} users={users} /></strong>;
      case "em":
        return <em key={i}><InlineView nodes={node.children} users={users} /></em>;
      case "del":
        return <del key={i}><InlineView nodes={node.children} users={users} /></del>;
      case "link":
        return (
          <a
            key={i}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={e => e.stopPropagation()}
          >
            <InlineView nodes={node.children} users={users} />
          </a>
        );
      case "mention": {
        const current = users?.find(u => u.id === node.userId)?.name;
        return (
          <span key={i} className="fpb-mention" title={current ?? node.name}>
            @{current ?? node.name}
          </span>
        );
      }
    }
  });
}
