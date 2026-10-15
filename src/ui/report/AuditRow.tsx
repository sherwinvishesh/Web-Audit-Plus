import { memo } from 'react';
import type { AuditChange } from '../../shared/compare';
import { CATEGORY_TITLES } from '../../shared/categories';
import type { AuditItem } from '../../shared/report-model';
import { AuditBody, PointsLabel } from '../components/AuditBody';
import { ChangeBadge } from '../components/Change';
import { StatusIcon } from '../components/StatusIcon';
import { CheckIcon, ChevronIcon, CopyIcon, ExternalIcon } from '../components/icons';

interface AuditRowProps {
  audit: AuditItem;
  open: boolean;
  copied: boolean;
  onToggle(key: string): void;
  onCopy(key: string): void;
  /** Change since the compared run. */
  change?: AuditChange | undefined;
  /** Position in the Fix next list. */
  rank?: number;
  /** Tag the row with its category (in lists that mix them). */
  showCategory?: boolean;
}

/**
 * One audit: a one-line summary that expands into evidence, rationale and the fix. The keyboard
 * shortcuts find rows by `[data-audit] > button`.
 */
export const AuditRow = memo(function AuditRow({ audit, open, copied, onToggle, onCopy, change, rank, showCategory = false }: AuditRowProps) {
  const bodyId = `audit-body-${audit.key}`;
  return (
    <li id={`audit-${audit.key}`} data-audit={audit.key} className="scroll-mt-32 border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(audit.key)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full scroll-mt-32 items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:shadow-[inset_2px_0_0_var(--accent)]"
      >
        {rank !== undefined && <span className="num w-5 shrink-0 text-right text-[12px] text-faint">{rank}</span>}
        <StatusIcon status={audit.status} />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate">{audit.title}</span>
          {showCategory && (
            <span className="hidden shrink-0 rounded-[5px] border border-border px-1.5 py-px text-[11px] text-muted sm:inline">{CATEGORY_TITLES[audit.category]}</span>
          )}
        </span>
        {change && <ChangeBadge kind={change.kind} />}
        {audit.displayValue && <span className="num hidden max-w-56 shrink-0 truncate text-[12px] text-muted md:inline">{audit.displayValue}</span>}
        <span className="w-12 shrink-0 text-right">
          <PointsLabel audit={audit} />
        </span>
        <ChevronIcon size={14} className={`shrink-0 text-faint transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div id={bodyId} className={`px-4 pt-1 pb-5 ${rank !== undefined ? 'pl-[4.25rem]' : 'pl-11'}`}>
          <AuditBody
            audit={audit}
            change={change}
            actions={
              <>
                {audit.fixItem && (
                  <button
                    type="button"
                    onClick={() => onCopy(audit.key)}
                    className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-medium text-accent-ink transition-[filter] hover:brightness-110"
                  >
                    {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    {copied ? 'Copied' : 'Copy fix prompt'}
                  </button>
                )}
                {audit.learnMore && (
                  <a
                    href={audit.learnMore}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    Learn more
                    <ExternalIcon size={13} />
                  </a>
                )}
              </>
            }
          />
        </div>
      )}
    </li>
  );
});
