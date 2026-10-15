import { memo, type ReactNode } from 'react';
import type { Comparison } from '../../shared/compare';
import { groupByStatus, statusLabel, type AuditItem, type AuditStatus, type CategoryView, type ReportModel } from '../../shared/report-model';
import { ScoreDelta } from '../components/Change';
import { InlineText } from '../components/InlineText';
import { Filmstrip, MetricTiles } from '../components/Metrics';
import { ScoreRing } from '../components/ScoreRing';
import { AlertIcon, CheckIcon, ChevronIcon, CopyIcon, LockIcon } from '../components/icons';
import { AuditRow } from './AuditRow';

/** Groups that start closed: nothing to do in them. */
const QUIET: ReadonlySet<AuditStatus> = new Set(['pass', 'na', 'info', 'manual', 'locked']);

export function groupKey(category: string, status: AuditStatus): string {
  return `${category}:${status}`;
}

interface CategorySectionProps {
  model: ReportModel;
  category: CategoryView;
  /** The audits to show: all of them, or those matching the filter. */
  audits: readonly AuditItem[];
  filtering: boolean;
  comparison: Comparison | undefined;
  open: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
  copied: string | undefined;
  onToggle(key: string): void;
  onToggleGroup(key: string): void;
  onCopy(key: string): void;
  onCopyCategory(category: CategoryView): void;
}

export const CategorySection = memo(function CategorySection(props: CategorySectionProps) {
  const { model, category, audits, filtering, comparison, open, expanded, copied, onToggle, onToggleGroup, onCopy, onCopyCategory } = props;
  const groups = groupByStatus(audits);
  const actionable = category.audits.some((audit) => audit.fixItem && audit.status !== 'locked');
  const copyKey = `category:${category.id}`;

  const rows = (list: readonly AuditItem[]): ReactNode => (
    <ul className="overflow-hidden rounded-xl border border-border bg-surface">
      {list.map((audit) => (
        <AuditRow
          key={audit.key}
          audit={audit}
          open={open.has(audit.key)}
          copied={copied === audit.key}
          onToggle={onToggle}
          onCopy={onCopy}
          change={comparison?.audits[audit.key]}
        />
      ))}
    </ul>
  );

  return (
    <section id={`category-${category.id}`} aria-labelledby={`category-title-${category.id}`} className="mt-14 scroll-mt-20">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border pb-4">
        <ScoreRing score={category.score} size={48} animate={false} label={category.title} />
        <div className="min-w-0 flex-1">
          <h2 id={`category-title-${category.id}`} className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            {category.title}
            <ScoreDelta delta={comparison?.scores[category.id]} />
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{countLine(category)}</p>
        </div>
        {actionable && (
          <button
            type="button"
            onClick={() => onCopyCategory(category)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[12.5px] font-medium transition-colors hover:bg-surface-2"
          >
            {copied === copyKey ? <CheckIcon size={14} className="text-good" /> : <CopyIcon size={14} className="text-muted" />}
            {copied === copyKey ? 'Copied' : `Copy ${category.title} fixes`}
          </button>
        )}
      </header>

      {category.error && (
        <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px]">
          <AlertIcon size={15} className="mt-0.5 shrink-0 text-warn" />
          <span className="text-muted">
            <InlineText text={category.error} />
          </span>
        </p>
      )}

      {!filtering && category.metrics && category.metrics.length > 0 && (
        <div className="mt-6 grid gap-3">
          <MetricTiles metrics={category.metrics} comparison={comparison} />
          <Filmstrip meta={model.engine} />
        </div>
      )}

      {groups.map(({ status, audits: list }) => {
        const key = groupKey(category.id, status);
        const quiet = QUIET.has(status);
        const isOpen = filtering || !quiet || expanded.has(key);
        const label = statusLabel(status, category.id);

        if (status === 'locked' && category.locked && !filtering) {
          return (
            <div key={status} className="mt-6">
              <button
                type="button"
                onClick={() => onToggleGroup(key)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-3 text-left text-[13.5px] transition-colors hover:bg-surface"
              >
                <LockIcon size={15} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1 text-muted">
                  {category.locked.count} {category.locked.count === 1 ? 'check is' : 'checks are'} waiting on{' '}
                  <span className="font-mono text-text">{category.locked.unlockedBy.join(', ')}</span>
                  {category.locked.gain > 0 ? (
                    <>
                      . Fixing it unlocks up to <span className="num font-mono text-good">+{category.locked.gain}</span> more.
                    </>
                  ) : (
                    '.'
                  )}
                </span>
                <ChevronIcon size={14} className={`shrink-0 text-faint transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && <div className="mt-2">{rows(list)}</div>}
            </div>
          );
        }

        return (
          <div key={status} className="mt-6">
            {quiet && !filtering ? (
              <button
                type="button"
                onClick={() => onToggleGroup(key)}
                aria-expanded={isOpen}
                className="mb-2 flex items-center gap-2 rounded-md text-[12.5px] font-medium text-muted transition-colors hover:text-text"
              >
                <ChevronIcon size={12} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                {label}
                <span className="num font-mono text-faint">{list.length}</span>
              </button>
            ) : (
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-muted">
                {label}
                <span className="num font-mono text-faint">{list.length}</span>
              </h3>
            )}
            {isOpen && rows(list)}
          </div>
        );
      })}
    </section>
  );
});

function countLine(category: CategoryView): string {
  if (category.audits.length === 0) return category.error ? 'Not measured' : 'No audits';
  const count = (status: AuditStatus): number => category.audits.filter((audit) => audit.status === status).length;
  const parts: string[] = [];
  const failed = count('fail');
  const partial = count('partial');
  const passed = count('pass');
  const locked = count('locked');
  const na = count('na');
  if (failed) parts.push(`${failed} failed`);
  if (partial) parts.push(`${partial} ${category.id === 'agentic' ? 'partial' : partial === 1 ? 'warning' : 'warnings'}`);
  if (locked) parts.push(`${locked} locked`);
  if (passed) parts.push(`${passed} passed`);
  if (na) parts.push(`${na} not applicable`);
  return parts.join(' · ');
}
