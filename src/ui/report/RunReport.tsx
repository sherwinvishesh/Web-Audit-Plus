import { useCallback, useEffect, useMemo, useState } from 'react';
import { categoryFixPrompt, singleFixPrompt } from '../../shared/fix-prompt';
import { allFixItems, buildReportModel, groupByStatus, STATUS_LABEL, type AuditItem, type CategoryView, type ReportModel } from '../../shared/report-model';
import { InlineText } from '../components/InlineText';
import { ScoreRing } from '../components/ScoreRing';
import { CheckIcon, CopyIcon, DesktopIcon, LockIcon, MobileIcon } from '../components/icons';
import { useCopy } from '../lib/clipboard';
import { useSavedRun } from '../lib/saved-run';
import { band, BAND_COLOR, displayUrl, formatDate, formatDuration } from '../lib/score';
import { AuditRow } from './AuditRow';
import { Centered, Shell } from './Shell';

export function RunReport({ runId }: { runId: string }) {
  const loaded = useSavedRun(runId);
  useEffect(() => {
    if (loaded.status === 'ready') document.title = `${displayUrl(loaded.value.url).host} · Web Audit+`;
  }, [loaded]);

  if (loaded.status === 'loading') return <Shell>{null}</Shell>;
  if (loaded.status === 'error') {
    return (
      <Shell>
        <Centered title="Could not open this run">{loaded.message}</Centered>
      </Shell>
    );
  }
  if (loaded.status === 'missing') {
    return (
      <Shell>
        <Centered title="Run not found">It may have been deleted, or pruned to keep the newest 200 runs.</Centered>
      </Shell>
    );
  }
  return <Report model={buildReportModel(loaded.value)} />;
}

function Report({ model }: { model: ReportModel }) {
  const { record } = model;
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const { copied, copy } = useCopy();
  const toggle = useCallback((key: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Deep links from the side panel: #audit-<key> opens and scrolls to a row, #category-<id> to a section.
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    if (hash.startsWith('audit-')) setOpen((current) => new Set(current).add(hash.slice('audit-'.length)));
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }));
  }, []);

  const { host, path } = displayUrl(record.url);
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-8">
          <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Audit</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight break-all">
            {host}
            <span className="text-muted">{path === '/' ? '' : path}</span>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className="num">{formatDate(record.startedAt)}</span>
            <span className="flex items-center gap-1.5">
              {record.options.formFactor === 'mobile' ? <MobileIcon size={14} /> : <DesktopIcon size={14} />}
              {record.options.formFactor === 'mobile' ? 'Mobile' : 'Desktop'}
            </span>
            <span className="num">took {formatDuration(record.durationMs)}</span>
            {record.agentic?.framework && <span>Built with {record.agentic.framework.name}</span>}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Scores">
          {model.categories.map((category) => (
            <a
              key={category.id}
              href={`#category-${category.id}`}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-4 py-5 transition-colors hover:border-border-strong"
            >
              <ScoreRing score={category.score} size={84} label={category.title} />
              <span className="text-[13px] font-medium">{category.title}</span>
            </a>
          ))}
        </section>

        {model.categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            open={open}
            onToggle={toggle}
            copied={copied}
            onCopyAudit={(audit) => audit.fixItem && void copy(audit.key, singleFixPrompt(model.context, audit.fixItem))}
            onCopyCategory={() => void copy(`category:${category.id}`, categoryFixPrompt(model.context, category.id, allFixItems(model, category.id)))}
          />
        ))}
      </main>
    </Shell>
  );
}

interface CategorySectionProps {
  category: CategoryView;
  open: ReadonlySet<string>;
  copied: string | undefined;
  onToggle(key: string): void;
  onCopyAudit(audit: AuditItem): void;
  onCopyCategory(): void;
}

function CategorySection({ category, open, copied, onToggle, onCopyAudit, onCopyCategory }: CategorySectionProps) {
  const groups = useMemo(() => groupByStatus(category.audits), [category.audits]);
  const needsWork = category.audits.some((audit) => audit.fixItem);
  const color = BAND_COLOR[band(category.score)];

  return (
    <section id={`category-${category.id}`} className="mt-12 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight">
          {category.title}
          <span className="num font-mono text-base" style={{ color }}>
            {category.score ?? '–'}
          </span>
        </h2>
        {needsWork && (
          <button
            type="button"
            onClick={onCopyCategory}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[12.5px] font-medium transition-colors hover:bg-surface-2"
          >
            {copied === `category:${category.id}` ? <CheckIcon size={14} className="text-good" /> : <CopyIcon size={14} className="text-muted" />}
            {copied === `category:${category.id}` ? 'Copied' : `Copy ${category.title} fixes`}
          </button>
        )}
      </div>

      {category.error && (
        <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-muted">
          <InlineText text={category.error} />
        </p>
      )}

      {groups.map(({ status, audits }) => {
        if (status === 'locked' && category.locked) {
          return (
            <div key={status} className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-border-strong px-4 py-3 text-[13.5px]">
              <LockIcon size={15} className="shrink-0 text-faint" />
              <span className="min-w-0 flex-1 text-muted">
                {category.locked.count} checks are waiting on{' '}
                <span className="font-mono text-text">{category.locked.unlockedBy.join(', ')}</span>. Fix it and they become measurable
                {category.locked.gain > 0 && (
                  <>
                    , worth up to <span className="num font-mono text-good">+{category.locked.gain}</span> more
                  </>
                )}
                .
              </span>
              <span className="hidden font-mono text-[11px] text-faint sm:inline">{audits.map((audit) => audit.id).join(' ')}</span>
            </div>
          );
        }
        const collapsed = status === 'pass' || status === 'na' || status === 'info' || status === 'manual';
        const list = (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {audits.map((audit) => (
              <AuditRow
                key={audit.key}
                audit={audit}
                open={open.has(audit.key)}
                focused={false}
                copied={copied === audit.key}
                onToggle={() => onToggle(audit.key)}
                onCopy={() => onCopyAudit(audit)}
              />
            ))}
          </ul>
        );
        if (collapsed) {
          return (
            <details key={status} className="group mt-6">
              <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-[12px] font-medium tracking-wide text-muted uppercase select-none hover:text-text">
                <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
                {STATUS_LABEL[status]}
                <span className="num font-mono">{audits.length}</span>
              </summary>
              {list}
            </details>
          );
        }
        return (
          <div key={status} className="mt-6">
            <p className="mb-2 flex items-center gap-2 text-[12px] font-medium tracking-wide text-muted uppercase">
              {STATUS_LABEL[status]}
              <span className="num font-mono">{audits.length}</span>
            </p>
            {list}
          </div>
        );
      })}
    </section>
  );
}
