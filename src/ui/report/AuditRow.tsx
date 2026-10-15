import type { ReactNode } from 'react';
import type { AuditItem } from '../../shared/report-model';
import { InlineText } from '../components/InlineText';
import { StatusIcon } from '../components/StatusIcon';
import { CheckIcon, ChevronIcon, CopyIcon, ExternalIcon } from '../components/icons';

interface AuditRowProps {
  audit: AuditItem;
  open: boolean;
  focused: boolean;
  copied: boolean;
  onToggle(): void;
  onCopy(): void;
  /** Change since the previous run of this URL, when comparing. */
  change?: string | undefined;
}

/** One audit: a one-line summary that expands into evidence, rationale and the fix. */
export function AuditRow({ audit, open, focused, copied, onToggle, onCopy, change }: AuditRowProps) {
  const bodyId = `audit-body-${audit.key}`;
  return (
    <li
      id={`audit-${audit.key}`}
      data-audit={audit.key}
      className={`scroll-mt-28 border-b border-border last:border-b-0 ${focused ? 'bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
      >
        <StatusIcon status={audit.status} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{audit.title}</span>
        </span>
        {change && <span className="shrink-0 rounded-full border border-border px-2 py-px text-[11px] text-muted">{change}</span>}
        {audit.displayValue && <span className="num hidden shrink-0 font-mono text-[12px] text-muted sm:inline">{audit.displayValue}</span>}
        {audit.points > 0 && (audit.status === 'fail' || audit.status === 'partial') && (
          <span className="num shrink-0 font-mono text-[12px] text-good" title={`Fixing this adds about ${audit.points} points`}>
            +{audit.points}
          </span>
        )}
        <span className="hidden w-14 shrink-0 text-right font-mono text-[11px] text-faint sm:inline">{audit.id.length <= 6 ? audit.id : ''}</span>
        <ChevronIcon size={14} className={`shrink-0 text-faint transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div id={bodyId} className="grid gap-4 px-4 pt-1 pb-5 pl-11 text-[13.5px] leading-relaxed">
          {audit.reason && (
            <Block label="What was found">
              <InlineText text={audit.reason} />
              {audit.detail && (
                <p className="mt-1 text-muted">
                  <InlineText text={audit.detail} />
                </p>
              )}
            </Block>
          )}
          {audit.why && (
            <Block label="Why it matters">
              <InlineText text={audit.why} className="text-muted" />
            </Block>
          )}
          {audit.fix && (
            <Block label="How to fix">
              <InlineText text={audit.fix} />
            </Block>
          )}
          {audit.status === 'locked' && audit.lockedBy && (
            <Block label="Locked">
              <span className="text-muted">
                Nothing could be measured until <span className="font-mono text-text">{audit.lockedBy}</span> passes.
              </span>
            </Block>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {audit.fixItem && (
              <button
                type="button"
                onClick={onCopy}
                className="flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[12.5px] font-medium transition-colors hover:bg-surface-2"
              >
                {copied ? <CheckIcon size={14} className="text-good" /> : <CopyIcon size={14} className="text-muted" />}
                {copied ? 'Copied' : 'Copy fix prompt'}
              </button>
            )}
            {audit.learnMore && (
              <a
                href={audit.learnMore}
                target="_blank"
                rel="noreferrer noopener"
                className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-muted transition-colors hover:text-text"
              >
                Learn more
                <ExternalIcon size={13} />
              </a>
            )}
            {audit.weight !== undefined && audit.earned !== undefined && audit.category === 'agentic' && (
              <span className="num ml-auto font-mono text-[11.5px] text-faint">
                {audit.status === 'locked' || audit.status === 'na' ? `weight ${audit.weight}` : `${audit.earned} of ${audit.weight}`}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-wide text-faint uppercase">{label}</p>
      <div>{children}</div>
    </div>
  );
}
