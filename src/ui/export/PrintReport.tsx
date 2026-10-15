import type { ReactNode } from 'react';
import { CATEGORY_TITLES, type CategoryId } from '../../shared/categories';
import type { Comparison } from '../../shared/compare';
import { allFixesPrompt } from '../../shared/fix-prompt';
import { allFixItems, fixNext, groupByStatus, statusLabel, type AuditItem, type AuditStatus, type CategoryView, type ReportModel } from '../../shared/report-model';
import { AuditBody, PointsLabel } from '../components/AuditBody';
import { ChangeBadge, MetricDelta, ScoreDelta } from '../components/Change';
import { Facts } from '../components/Facts';
import { InlineText } from '../components/InlineText';
import { countParts } from '../report/CategorySection';
import { ScoreRing } from '../components/ScoreRing';
import { StatusIcon, statusColor } from '../components/StatusIcon';
import { DesktopIcon, Logo, MobileIcon } from '../components/icons';
import { band, BAND_COLOR, displayUrl, formatDate, formatDuration, type Band } from '../lib/score';

/**
 * The report as a printed document, for the PDF export and the browser's own Print. It is laid out
 * for paper rather than the screen: a cover with the scores, the ranked fixes, then each category on
 * its own pages with every finding written out, nothing collapsed. Always light, whatever the theme.
 *
 * Headings are real h1–h3, so the PDF gets bookmarks and a tagged structure; titles link to their
 * details, which the PDF keeps as internal links.
 */

const SUMMARY: Readonly<Record<CategoryId, string>> = {
  performance: 'How quickly the page loads, renders and responds to input, measured in a lab run.',
  accessibility: 'Whether people can use the page with a screen reader, a keyboard, zoom or low vision.',
  'best-practices': 'Security, modern browser features and common mistakes that affect the page.',
  seo: 'Whether search engines can crawl, index and understand the page.',
  agentic: 'Whether AI agents and crawlers can fetch, read and cite the page.',
};

const VERDICT: Readonly<Record<Band, string>> = { good: 'Good', warn: 'Needs improvement', bad: 'Poor', none: 'Not measured' };

/** The statuses written out in full; the rest are listed by title. */
const DETAILED: readonly AuditStatus[] = ['fail', 'partial', 'error'];

/** How many fixes the cover lists before pointing to the full table. */
const COVER_FIXES = 5;

export interface PrintReportProps {
  model: ReportModel;
  comparison?: Comparison | undefined;
  /** ISO time the document was produced. */
  generatedAt: string;
}

export function PrintReport({ model, comparison, generatedAt }: PrintReportProps) {
  const next = fixNext(model);
  const items = allFixItems(model);
  return (
    <article className="print-doc text-[12.5px] leading-normal text-text">
      <Cover model={model} comparison={comparison} next={next} />
      {next.length > 0 && <FixTable next={next} comparison={comparison} />}
      {model.categories.map((category) => (
        <CategoryPages key={category.id} model={model} category={category} comparison={comparison} />
      ))}
      {items.length > 0 && (
        <section className="print-break">
          <SectionHeading title="Fix prompt">
            Hand this to an AI coding agent to work through every fix in this report, the biggest gain first. It is the same prompt the extension copies.
          </SectionHeading>
          <pre className="mt-5 rounded-xl border border-border bg-bg p-4 font-mono text-[9.5px] leading-normal box-decoration-clone [overflow-wrap:anywhere] whitespace-pre-wrap">{allFixesPrompt(model.context, items)}</pre>
        </section>
      )}
      <Colophon model={model} comparison={comparison} generatedAt={generatedAt} />
    </article>
  );
}

function Cover({ model, comparison, next }: { model: ReportModel; comparison: Comparison | undefined; next: readonly AuditItem[] }) {
  const { record, categories } = model;
  const { host, path } = displayUrl(record.url);
  const audits = categories.flatMap((category) => category.audits);
  const count = (status: AuditStatus): number => audits.filter((audit) => audit.status === status).length;
  const single = categories.length === 1 ? categories[0] : undefined;
  const headline = single ? single.score : record.overall;
  const headlineDelta = single ? comparison?.scores[single.id] : comparison?.overall;
  const metrics = categories.find((category) => category.id === 'performance')?.metrics ?? [];
  const screenshot = model.engine?.finalScreenshot;
  const mobile = record.options.formFactor === 'mobile';

  return (
    <section aria-label="Summary">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
          <Logo size={20} />
          Web Audit+
        </span>
        <span className="num text-[11px] text-muted">{longDate(record.startedAt)}</span>
      </div>

      <div className="print-dark mt-5 overflow-hidden rounded-2xl border border-border bg-bg">
        <div className="flex gap-7 p-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold tracking-[0.12em] text-accent uppercase">Website audit</p>
            <h1 className="mt-2 text-[30px] leading-[1.1] font-semibold tracking-tight break-all">{host}</h1>
            {path !== '/' && <p className="mt-1.5 line-clamp-2 text-[14px] break-all text-muted">{path}</p>}
            <Facts className="mt-3">
              <span className="flex items-center gap-1.5">
                {mobile ? <MobileIcon size={13} /> : <DesktopIcon size={13} />}
                {mobile ? 'Mobile' : 'Desktop'}
              </span>
              <span className="num">took {formatDuration(record.durationMs)}</span>
              {model.context.framework && <span>Built with {model.context.framework.name}</span>}
              {comparison && <span className="num">Compared with {formatDate(comparison.previousStartedAt)}</span>}
            </Facts>
            <div className="mt-6 flex items-center gap-5">
              <ScoreRing score={headline} size={104} animate={false} label={single ? single.title : 'Overall'} />
              <div>
                <p className="text-[12px] font-medium text-muted">{single ? single.title : 'Overall score'}</p>
                <p className="mt-0.5 text-[22px] leading-tight font-semibold tracking-tight" style={{ color: BAND_COLOR[band(headline)] }}>
                  {VERDICT[band(headline)]}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {single ? SUMMARY[single.id] : `The mean of ${categories.filter((category) => typeof category.score === 'number').length} category scores`}
                </p>
                {headlineDelta !== undefined && (
                  <p className="mt-1 text-[12px] text-muted">
                    <ScoreDelta delta={headlineDelta} className="text-[12px]" /> since the compared run
                  </p>
                )}
              </div>
            </div>
          </div>
          {screenshot && (
            <figure className={`shrink-0 self-start rounded-[16px] border border-border-strong bg-surface-2 p-1.5 ${mobile ? 'w-[114px]' : 'w-[232px]'}`}>
              <img src={screenshot} alt={`The audited page as it finished loading on ${mobile ? 'mobile' : 'desktop'}`} className={`w-full rounded-[11px] object-cover object-left-top ${mobile ? 'h-[206px]' : 'h-[150px]'}`} />
            </figure>
          )}
        </div>
        {!single && (
          <div className="grid border-t border-border" style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}>
            {categories.map((category) => (
              <a key={category.id} href={`#pdf-category-${category.id}`} className="flex flex-col items-center gap-2 border-r border-border px-2 py-4 last:border-r-0">
                <ScoreRing score={category.score} size={58} animate={false} label={category.title} />
                <span className="text-center text-[12px] leading-tight font-medium">{category.title}</span>
                <ScoreDelta delta={comparison?.scores[category.id]} className="-mt-1 text-[11px]" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat value={count('fail')} label="Failed" color="var(--bad)" />
        <Stat value={count('partial')} label="Warnings" color="var(--warn)" />
        <Stat value={count('pass')} label="Passed" color="var(--good)" />
        <Stat value={audits.length} label="Audits run" color="var(--text)" />
      </div>

      {metrics.length > 0 && (
        <div className="mt-4">
          <Label>Lab metrics</Label>
          <Metrics model={model} comparison={comparison} />
        </div>
      )}

      <div className="mt-4">
        <Label>{next.length > COVER_FIXES ? `Top ${COVER_FIXES} of ${next.length} fixes` : 'Fixes'}</Label>
        {next.length > 0 ? (
          <ol className="overflow-hidden rounded-xl border border-border">
            {next.slice(0, COVER_FIXES).map((audit, index) => (
              <li key={audit.key} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
                <span className="num w-4 shrink-0 text-right text-[11px] text-faint">{index + 1}</span>
                <StatusIcon status={audit.status} size={14} />
                <a href={`#pdf-audit-${audit.key}`} className="min-w-0 flex-1 truncate">
                  {audit.title}
                </a>
                <span className="shrink-0 text-[11px] text-muted">{CATEGORY_TITLES[audit.category]}</span>
                <span className="w-11 shrink-0 text-right">
                  <PointsLabel audit={audit} />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-border px-4 py-3 text-muted">Nothing to fix: every scored audit passed.</p>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-border px-4 py-2.5">
      <p className="num text-[22px] leading-none font-semibold tracking-tight" style={{ color: value === 0 ? 'var(--faint)' : color }}>
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-muted">{label}</p>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">{children}</p>;
}

function SectionHeading({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <header className="border-b border-border pb-4">
      <h2 className="flex items-baseline gap-2 text-[22px] font-semibold tracking-tight">
        {title}
        {count !== undefined && <span className="num text-[15px] font-medium text-faint">{count}</span>}
      </h2>
      {children && <p className="mt-1 text-[12.5px] text-muted">{children}</p>}
    </header>
  );
}

function FixTable({ next, comparison }: { next: readonly AuditItem[]; comparison: Comparison | undefined }) {
  return (
    <section className="print-break">
      <SectionHeading title="Fix next" count={next.length}>
        Everything that needs work, ordered by how much fixing it would raise its score. Each title links to its details.
      </SectionHeading>
      <table className="mt-4 w-full border-collapse text-left">
        <thead className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
          <tr className="border-b border-border">
            <th scope="col" className="w-8 py-2 pr-2 text-right font-semibold">
              #
            </th>
            <th scope="col" className="py-2 pl-2 font-semibold">
              Audit
            </th>
            <th scope="col" className="py-2 pl-3 font-semibold">
              Category
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-semibold">
              Gain
            </th>
          </tr>
        </thead>
        <tbody>
          {next.map((audit, index) => {
            const change = comparison?.audits[audit.key];
            return (
              <tr key={audit.key} className="border-b border-border align-top [break-inside:avoid]">
                <td className="num py-2.5 pr-2 text-right text-[11px] text-faint">{index + 1}</td>
                <td className="py-2.5 pl-2">
                  <span className="flex items-start gap-2">
                    <span className="mt-[2px]">
                      <StatusIcon status={audit.status} size={14} />
                    </span>
                    <span className="min-w-0">
                      <a href={`#pdf-audit-${audit.key}`} className="font-medium">
                        {audit.title}
                      </a>
                      {(audit.displayValue || change) && (
                        <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                          {change && <ChangeBadge kind={change.kind} />}
                          {audit.displayValue && <span className="num">{audit.displayValue}</span>}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="py-2.5 pl-3 text-[11.5px] whitespace-nowrap text-muted">{CATEGORY_TITLES[audit.category]}</td>
                <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                  <PointsLabel audit={audit} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function CategoryPages({ model, category, comparison }: { model: ReportModel; category: CategoryView; comparison: Comparison | undefined }) {
  const groups = groupByStatus(category.audits);
  const detailed = groups.filter((group) => DETAILED.includes(group.status));
  const listed = groups.filter((group) => !DETAILED.includes(group.status));

  return (
    <section id={`pdf-category-${category.id}`} className="print-break">
      <header className="flex items-center gap-5 border-b border-border pb-5">
        <ScoreRing score={category.score} size={72} animate={false} label={category.title} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[24px] leading-tight font-semibold tracking-tight">{category.title}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{SUMMARY[category.id]}</p>
          <Facts className="mt-1.5">
            <span className="font-medium" style={{ color: BAND_COLOR[band(category.score)] }}>
              {VERDICT[band(category.score)]}
            </span>
            {countParts(category).map((part) => (
              <span key={part} className="num">
                {part}
              </span>
            ))}
            {comparison?.scores[category.id] !== undefined && (
              <span className="flex items-center gap-1.5">
                <ScoreDelta delta={comparison.scores[category.id]} /> since the compared run
              </span>
            )}
          </Facts>
        </div>
      </header>

      {category.error && (
        <p className="mt-5 rounded-xl border border-border bg-bg px-4 py-3 text-muted">
          <InlineText text={category.error} />
        </p>
      )}

      {category.metrics && category.metrics.length > 0 && (
        <div className="mt-5 grid gap-3">
          <Metrics model={model} comparison={comparison} />
          <Filmstrip model={model} />
        </div>
      )}

      {category.locked && (
        <p className="mt-5 rounded-xl border border-border bg-bg px-4 py-3 text-muted">
          {category.locked.count} {category.locked.count === 1 ? 'check is' : 'checks are'} waiting on <span className="font-mono text-text">{category.locked.unlockedBy.join(', ')}</span>
          {category.locked.gain > 0 ? (
            <>
              . Fixing it unlocks up to <span className="num font-medium text-good">+{category.locked.gain}</span> more.
            </>
          ) : (
            '.'
          )}
        </p>
      )}

      {detailed.map(({ status, audits }) => (
        <div key={status} className="mt-6">
          <GroupLabel status={status} category={category.id} count={audits.length} />
          <div className="grid gap-3">
            {audits.map((audit) => (
              <AuditCard key={audit.key} audit={audit} comparison={comparison} />
            ))}
          </div>
        </div>
      ))}

      {listed.map(({ status, audits }) => (
        <div key={status} className="mt-6">
          <GroupLabel status={status} category={category.id} count={audits.length} />
          <ul className="columns-2 gap-8">
            {audits.map((audit) => (
              <li key={audit.key} id={`pdf-audit-${audit.key}`} className="flex items-start gap-2 py-1 text-[11.5px] [break-inside:avoid]">
                <span className="mt-[2px]">
                  <StatusIcon status={audit.status} size={12} />
                </span>
                <span className="min-w-0">
                  {audit.title}
                  {audit.displayValue && <span className="num text-muted"> · {audit.displayValue}</span>}
                  {audit.status === 'locked' && audit.lockedBy && (
                    <span className="block text-[10.5px] text-muted">
                      Waiting on <span className="font-mono">{audit.lockedBy}</span>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function GroupLabel({ status, category, count }: { status: AuditStatus; category: CategoryId; count: number }) {
  return (
    <p className="mb-2.5 flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.1em] uppercase [break-after:avoid]" style={{ color: statusColor(status) }}>
      {statusLabel(status, category)}
      <span className="num text-faint">{count}</span>
    </p>
  );
}

function AuditCard({ audit, comparison }: { audit: AuditItem; comparison: Comparison | undefined }) {
  const change = comparison?.audits[audit.key];
  return (
    <div id={`pdf-audit-${audit.key}`} className="rounded-xl border border-border px-4 pt-3.5 pb-4 [break-inside:avoid]">
      <div className="flex items-start gap-2.5">
        <span className="mt-[3px]">
          <StatusIcon status={audit.status} />
        </span>
        <h3 className="min-w-0 flex-1 text-[13.5px] leading-snug font-semibold">{audit.title}</h3>
        {change && <ChangeBadge kind={change.kind} />}
        {audit.displayValue && <span className="num mt-px shrink-0 text-[12px] text-muted">{audit.displayValue}</span>}
        <span className="mt-px shrink-0">
          <PointsLabel audit={audit} />
        </span>
      </div>
      <div className="mt-3 pl-[25px]">
        <AuditBody
          audit={audit}
          change={change}
          actions={
            audit.learnMore && (
              <a href={audit.learnMore} className="text-[12px] text-accent">
                Learn more
              </a>
            )
          }
        />
      </div>
    </div>
  );
}

function Metrics({ model, comparison }: { model: ReportModel; comparison: Comparison | undefined }) {
  const metrics = model.categories.find((category) => category.id === 'performance')?.metrics ?? [];
  return (
    <div className="grid overflow-hidden rounded-xl border border-border" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
      {metrics.map((metric) => (
        <div key={metric.id} className="border-r border-border px-3 py-2.5 last:border-r-0">
          <p className="min-h-[2.5em] text-[10.5px] leading-tight text-muted">{metric.title}</p>
          <p className="num mt-1 text-[18px] leading-tight font-semibold tracking-tight" style={{ color: statusColor(metric.status) }}>
            {metric.displayValue ?? '–'}
          </p>
          <p className="mt-1 flex items-center justify-between gap-1 text-[10.5px] text-faint">
            <span className="num">{metric.weight > 0 ? `${metric.weight}% of score` : 'not scored'}</span>
            <MetricDelta change={comparison?.metrics[metric.id]} />
          </p>
        </div>
      ))}
    </div>
  );
}

function Filmstrip({ model }: { model: ReportModel }) {
  const frames = (model.engine?.filmstrip ?? []).slice(0, 10);
  if (frames.length === 0) return null;
  return (
    <figure className="rounded-xl border border-border p-3 [break-inside:avoid]">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${frames.length}, minmax(0, 1fr))` }}>
        {frames.map((frame) => (
          <div key={frame.timing} className="flex flex-col items-center gap-1">
            <img src={frame.data} alt="" className="w-full rounded-[4px] border border-border" />
            <span className="num text-[9.5px] text-faint">{frame.timing < 1000 ? `${Math.round(frame.timing)} ms` : `${(frame.timing / 1000).toFixed(1)} s`}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-[11px] text-muted">How the page rendered while loading</figcaption>
    </figure>
  );
}

function Colophon({ model, comparison, generatedAt }: { model: ReportModel; comparison: Comparison | undefined; generatedAt: string }) {
  const { record, engine } = model;
  const rows: Array<[string, ReactNode]> = [['Page', <span className="break-all">{record.url}</span>]];
  if (engine?.finalUrl && engine.finalUrl !== record.url) rows.push(['Final URL', <span className="break-all">{engine.finalUrl}</span>]);
  rows.push(['Audited', <span className="num">{longDate(record.startedAt)}</span>]);
  rows.push(['Device', [record.options.formFactor === 'mobile' ? 'Mobile' : 'Desktop', engine?.screen].filter(Boolean).join(', ')]);
  if (engine) {
    rows.push(['Network and CPU', engine.throttling]);
    rows.push(['Audit engine', engine.version]);
  }
  rows.push(['Web Audit+', record.environment.extensionVersion]);
  if (comparison) rows.push(['Compared with', <span className="num">The run of {longDate(comparison.previousStartedAt)}</span>]);
  rows.push(['Generated', <span className="num">{longDate(generatedAt)}</span>]);
  rows.push(['User agent', <span className="font-mono text-[10.5px] break-all text-muted">{engine?.userAgent ?? record.environment.userAgent}</span>]);

  return (
    <section className="mt-14 [break-inside:avoid]">
      <h2 className="border-b border-border pb-3 text-[15px] font-semibold tracking-tight">About this report</h2>
      <dl className="mt-3 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-6 gap-y-2 text-[11.5px]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** "October 15, 2026 at 12:18 AM", in the reader's locale and time zone. */
export function longDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
}
