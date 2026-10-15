import type { CSSProperties } from 'react';
import { CATEGORY_SHORT_TITLES } from '../../shared/categories';
import type { Comparison } from '../../shared/compare';
import { allFixesPrompt, categoryFixPrompt, singleFixPrompt } from '../../shared/fix-prompt';
import { allFixItems, fixNext, groupByStatus, statusLabel, type AuditItem, type CategoryView, type ReportModel } from '../../shared/report-model';
import { utc } from '../../shared/summary';
import { AuditBody, PointsLabel } from '../components/AuditBody';
import { ChangeBadge, ScoreDelta } from '../components/Change';
import { InlineText } from '../components/InlineText';
import { Filmstrip, MetricTiles } from '../components/Metrics';
import { ScoreRing } from '../components/ScoreRing';
import { StatusIcon } from '../components/StatusIcon';
import { ChevronIcon, Logo } from '../components/icons';
import { band, BAND_COLOR, displayUrl, formatDuration } from '../lib/score';

/**
 * The report as a standalone page that works without JavaScript: every row is a `<details>`, and
 * each fix prompt is printed in full in a `<pre>` to select and copy. It renders through
 * renderToStaticMarkup, so every value from the site is escaped text.
 */
export function StaticReport({ model, comparison, generatedAt }: { model: ReportModel; comparison?: Comparison | undefined; generatedAt: string }) {
  const { record } = model;
  const { host, path } = displayUrl(record.url);
  const next = fixNext(model);
  const scored = model.categories.length > 1;
  return (
    <div className="min-h-screen text-[14px]">
      <header className="border-b border-border">
        <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-4 px-6">
          <span className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-semibold tracking-tight">Web Audit+</span>
          </span>
          <span className="text-[12px] text-muted">Exported {utc(generatedAt)}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-8 pb-6">
          <p className="text-[12px] font-medium text-muted">Audit report</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight break-all">
            {host}
            <span className="text-muted">{path === '/' ? '' : path}</span>
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="num">{utc(record.startedAt)}</span>
            <span>{record.options.formFactor === 'mobile' ? 'Mobile' : 'Desktop'}</span>
            <span className="num">took {formatDuration(record.durationMs)}</span>
            {model.context.framework && <span>Built with {model.context.framework.name}</span>}
            {model.lighthouse && <span>Lighthouse {model.lighthouse.version}</span>}
            {comparison && <span>Compared with the run of {utc(comparison.previousStartedAt)}</span>}
          </p>
        </section>

        <section
          aria-label="Scores"
          className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
          style={{ '--n': model.categories.length, '--cols': model.categories.length + (scored ? 1 : 0) } as CSSProperties}
        >
          {scored && (
            <div className="col-span-2 flex flex-col justify-center bg-surface px-5 py-5 sm:col-span-full lg:col-span-1">
              <p className="text-[12px] font-medium text-muted">Overall</p>
              <p className="mt-1.5 flex items-baseline gap-1">
                <span className="num text-[44px] leading-none font-semibold tracking-tight" style={{ color: BAND_COLOR[band(record.overall)] }}>
                  {record.overall ?? '–'}
                </span>
                <span className="text-faint">/100</span>
              </p>
              <ScoreDelta delta={comparison?.overall} className="mt-2" />
            </div>
          )}
          {model.categories.map((category, index) => (
            <a
              key={category.id}
              href={`#category-${category.id}`}
              className={`flex flex-col items-center gap-2.5 bg-surface px-3 py-5 ${index === model.categories.length - 1 && model.categories.length % 2 === 1 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <ScoreRing score={category.score} size={72} animate={false} label={category.title} />
              <span className="text-[13px] font-medium">{category.title}</span>
              <ScoreDelta delta={comparison?.scores[category.id]} />
            </a>
          ))}
        </section>

        {next.length > 0 && (
          <section className="mt-12" aria-labelledby="fix-next">
            <h2 id="fix-next" className="text-lg font-semibold tracking-tight">
              Fix next <span className="num font-mono text-base text-muted">{next.length}</span>
            </h2>
            <p className="mt-1 text-[13px] text-muted">Everything that needs work, biggest score gain first.</p>
            <ol className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
              {next.map((audit, index) => (
                <StaticRow key={audit.key} model={model} audit={audit} comparison={comparison} rank={index + 1} />
              ))}
            </ol>
            <PromptBlock title="Prompt for every fix" text={allFixesPrompt(model.context, allFixItems(model))} />
          </section>
        )}

        {model.categories.map((category) => (
          <StaticCategory key={category.id} model={model} category={category} comparison={comparison} />
        ))}

        {model.lighthouse && (
          <footer className="mt-16 border-t border-border pt-6 text-[12.5px] text-muted">
            <p>
              Lighthouse {model.lighthouse.version} · {model.lighthouse.throttling} · {model.lighthouse.screen}
            </p>
            <p className="mt-1 break-all text-faint">{model.lighthouse.userAgent}</p>
          </footer>
        )}
      </main>
    </div>
  );
}

function StaticCategory({ model, category, comparison }: { model: ReportModel; category: CategoryView; comparison?: Comparison | undefined }) {
  const groups = groupByStatus(category.audits);
  const items = allFixItems(model, category.id);
  return (
    <section id={`category-${category.id}`} className="mt-14">
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <ScoreRing score={category.score} size={44} animate={false} label={category.title} />
        <h2 className="text-lg font-semibold tracking-tight">{category.title}</h2>
        <ScoreDelta delta={comparison?.scores[category.id]} />
      </div>
      {category.error && (
        <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-muted">
          <InlineText text={category.error} />
        </p>
      )}
      {category.metrics && category.metrics.length > 0 && (
        <div className="mt-6 grid gap-3">
          <MetricTiles metrics={category.metrics} comparison={comparison} />
          {category.id === 'performance' && <Filmstrip meta={model.lighthouse} />}
        </div>
      )}
      {groups.map(({ status, audits }) => (
        <details key={status} className="group/status mt-6" open={status === 'fail' || status === 'partial' || status === 'error'}>
          <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-[12.5px] font-medium text-muted">
            <ChevronIcon size={12} className="transition-transform group-open/status:rotate-90" />
            {statusLabel(status, category.id)}
            <span className="num font-mono text-faint">{audits.length}</span>
          </summary>
          <ul className="overflow-hidden rounded-xl border border-border bg-surface">
            {audits.map((audit) => (
              <StaticRow key={audit.key} model={model} audit={audit} comparison={comparison} />
            ))}
          </ul>
        </details>
      ))}
      {items.length > 0 && <PromptBlock title={`Prompt for every ${category.title} fix`} text={categoryFixPrompt(model.context, category.id, items)} />}
    </section>
  );
}

function StaticRow({ model, audit, comparison, rank }: { model: ReportModel; audit: AuditItem; comparison?: Comparison | undefined; rank?: number }) {
  const change = comparison?.audits[audit.key];
  return (
    <li id={rank === undefined ? `audit-${audit.key}` : undefined} className="border-b border-border last:border-b-0">
      <details className="group/row">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5">
          {rank !== undefined && <span className="num w-5 shrink-0 text-right font-mono text-[12px] text-faint">{rank}</span>}
          <StatusIcon status={audit.status} />
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate">{audit.title}</span>
            {rank !== undefined && (
              <span className="hidden shrink-0 rounded-[5px] border border-border px-1.5 py-px text-[11px] text-muted sm:inline">{CATEGORY_SHORT_TITLES[audit.category]}</span>
            )}
          </span>
          {change && <ChangeBadge kind={change.kind} />}
          {audit.displayValue && <span className="num hidden max-w-56 shrink-0 truncate font-mono text-[12px] text-muted md:inline">{audit.displayValue}</span>}
          <span className="w-12 shrink-0 text-right">
            <PointsLabel audit={audit} />
          </span>
          <ChevronIcon size={14} className="shrink-0 text-faint transition-transform group-open/row:rotate-90" />
        </summary>
        <div className={`px-4 pt-1 pb-5 ${rank !== undefined ? 'pl-[4.25rem]' : 'pl-11'}`}>
          <AuditBody
            audit={audit}
            change={change}
            actions={
              audit.learnMore && (
                <a href={audit.learnMore} target="_blank" rel="noreferrer noopener" className="text-[12.5px] text-accent underline-offset-2 hover:underline">
                  Learn more
                </a>
              )
            }
          />
          {audit.fixItem && <PromptBlock title="Fix prompt" text={singleFixPrompt(model.context, audit.fixItem)} compact />}
        </div>
      </details>
    </li>
  );
}

function PromptBlock({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <details className={`group/prompt ${compact ? 'mt-4' : 'mt-4 rounded-xl border border-border bg-surface px-4 py-3'}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[12.5px] font-medium text-accent">
        <ChevronIcon size={12} className="transition-transform group-open/prompt:rotate-90" />
        {title}
      </summary>
      <pre className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-text">{text}</pre>
    </details>
  );
}
