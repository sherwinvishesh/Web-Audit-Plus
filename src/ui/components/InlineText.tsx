import { parseInline } from '../../agentic/quote';

/**
 * Markdown-lite text: prose with inline code spans. Code spans carry values quoted from the audited
 * site and render as inert chips. Everything is a React text node; nothing is parsed as HTML.
 */
export function InlineText({ text, className }: { text: string | undefined; className?: string }) {
  if (!text) return null;
  return (
    <span className={className}>
      {parseInline(text).map((part, index) =>
        part.kind === 'code' ? (
          <code
            key={index}
            className="mx-px rounded-[5px] border border-border bg-surface-2 px-1 py-px font-mono text-[0.86em] [overflow-wrap:anywhere] text-text [box-decoration-break:clone]"
          >
            {part.value}
          </code>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </span>
  );
}
