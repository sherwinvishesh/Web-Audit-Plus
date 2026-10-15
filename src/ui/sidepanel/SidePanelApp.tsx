import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CATEGORY_IDS, CATEGORY_TITLES, type CategoryId } from '../../shared/categories';
import { allFixesPrompt } from '../../shared/fix-prompt';
import { allFixItems, buildReportModel, fixNext } from '../../shared/report-model';
import { runProgress } from '../../shared/progress';
import { isFinished, type FormFactor, type RunOptions, type RunRecord, type RunState, type RunStep, type RunSummary } from '../../shared/run';
import { auditability } from '../../shared/url-policy';
import { PointsLabel } from '../components/AuditBody';
import { ScoreDelta } from '../components/Change';
import { InlineText } from '../components/InlineText';
import { ScoreRing } from '../components/ScoreRing';
import { statusColor } from '../components/StatusIcon';
import {
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  CircleIcon,
  CopyIcon,
  CrossIcon,
  DashIcon,
  DesktopIcon,
  ExternalIcon,
  GlobeIcon,
  HistoryIcon,
  Logo,
  MobileIcon,
  MoonIcon,
  PlayIcon,
  Spinner,
  StopIcon,
  SunIcon,
} from '../components/icons';
import { useCopy } from '../lib/clipboard';
import { overallDelta, useSiteHistory } from '../lib/history';
import { useNow } from '../lib/now';
import { useRun } from '../lib/run-port';
import { useRunOptions } from '../lib/run-options';
import { openHistory, openReport, useSavedRun } from '../lib/saved-run';
import { band, BAND_COLOR, displayUrl, formatDate, formatDuration } from '../lib/score';
import { useTargetTab } from '../lib/target-tab';
import { useTheme } from '../lib/theme';

export function SidePanelApp() {
  const tab = useTargetTab();
  const { state, start, cancel } = useRun(tab?.id);
  const [options, setOptions] = useRunOptions();
  const policy = auditability(tab?.url);
  const active = state !== null && !isFinished(state.phase);

  return (
    <div className="flex min-h-screen flex-col text-[13px]">
      <Header />
      <main className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-6">
        <Target url={tab?.url} title={tab?.title} />
        {!policy.ok ? (
          <Callout tone="neutral" title={policy.title}>
            <InlineText text={policy.message} />
          </Callout>
        ) : (
          <>
            <Controls options={options} onChange={setOptions} disabled={active} />
            {active ? (
              <button
                type="button"
                onClick={cancel}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface font-medium text-text transition-colors hover:bg-surface-2"
              >
                <StopIcon size={14} />
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => start(options)}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent font-medium text-accent-ink transition-[filter] hover:brightness-110 active:brightness-95"
              >
                <PlayIcon size={14} />
                {state ? 'Run again' : 'Run audit'}
              </button>
            )}
          </>
        )}
        {state && <RunView state={state} currentUrl={policy.ok ? policy.url : undefined} />}
        {policy.ok && !active && <PreviousRuns url={policy.url} exclude={state?.saved ? state.runId : undefined} version={state?.saved} />}
      </main>
    </div>
  );
}

function Header() {
  const theme = useTheme();
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-bg px-4">
      <div className="flex items-center gap-2">
        <Logo />
        <h1 className="font-semibold tracking-tight">Web Audit+</h1>
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="Run history" onClick={() => void openReport()}>
          <HistoryIcon />
        </IconButton>
        <IconButton label={theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={theme.toggle}>
          {theme.resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      {children}
    </button>
  );
}

function Target({ url, title }: { url: string | undefined; title: string | undefined }) {
  const { host, path } = displayUrl(url ?? '');
  // A site's first letter; an IP address or an unusual host gets a globe instead of a digit.
  const initial = /^[a-z]/i.exec(host.replace(/^www\./, ''))?.[0].toUpperCase();
  const fullPath = path === '/' ? '' : path;
  // The page title, with its address beneath; a page without a title shows its host, then its path.
  const heading = title?.trim() || host || url || '';
  const address = heading === host ? fullPath : `${host}${fullPath}`;
  return (
    <section className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3" aria-label="Page to audit">
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-[14px] font-semibold text-muted" aria-hidden="true">
        {initial ?? <GlobeIcon size={16} />}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium" title={heading}>
          {url ? heading : 'No page'}
        </p>
        {url ? (
          address && (
            <p className="truncate font-mono text-[11px] text-muted" title={url}>
              {address}
            </p>
          )
        ) : (
          <p className="truncate text-[12px] text-muted">Open a website in this window</p>
        )}
      </div>
    </section>
  );
}

function Controls({ options, onChange, disabled }: { options: RunOptions; onChange(next: RunOptions): void; disabled: boolean }) {
  const setFormFactor = (formFactor: FormFactor): void => onChange({ ...options, formFactor });
  const toggle = (id: CategoryId): void => {
    const on = options.categories.includes(id);
    if (on && options.categories.length === 1) return;
    const categories = CATEGORY_IDS.filter((candidate) => (candidate === id ? !on : options.categories.includes(candidate)));
    onChange({ ...options, categories });
  };

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-3 disabled:opacity-60">
      <legend className="sr-only">Audit options</legend>
      <div role="radiogroup" aria-label="Form factor" className="grid grid-cols-2 gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5">
        {(
          [
            ['desktop', 'Desktop', DesktopIcon],
            ['mobile', 'Mobile', MobileIcon],
          ] as const
        ).map(([value, label, Icon]) => {
          const checked = options.formFactor === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setFormFactor(value)}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium transition-colors ${
                checked ? 'bg-surface text-text shadow-[0_1px_0_var(--border-strong)]' : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categories">
        {CATEGORY_IDS.map((id) => {
          const on = options.categories.includes(id);
          return (
            <button
              key={id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(id)}
              className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors ${
                on
                  ? 'border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-text'
                  : 'border-border text-muted hover:border-border-strong hover:text-text'
              }`}
            >
              <span className={`size-1.5 rounded-full ${on ? 'bg-accent' : 'bg-faint'}`} aria-hidden="true" />
              {CATEGORY_TITLES[id]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RunView({ state, currentUrl }: { state: RunState; currentUrl: string | undefined }) {
  const active = !isFinished(state.phase);
  const now = useNow(active);
  const elapsed = (state.finishedAt ?? now) - state.startedAt;
  const saved = useSavedRun(state.saved ? state.runId : undefined);
  const record = saved.status === 'ready' ? saved.value : undefined;
  const otherPage = state.url && currentUrl && state.url !== currentUrl;

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2 border-t border-border pt-4">
        <StatusLine state={state} />
        <span className="num shrink-0 text-[12px] text-muted">{state.phase === 'queued' ? '' : formatDuration(elapsed)}</span>
      </div>
      {state.phase === 'running' && <ProgressBar value={runProgress(state.steps)} />}
      {otherPage && (
        <p className="-mt-2 truncate text-[12px] text-muted">
          Results for <span className="font-mono">{displayUrl(state.url).path}</span>
        </p>
      )}

      <Scores state={state} canOpen={record !== undefined} />

      {state.error && (
        <Callout tone={state.phase === 'cancelled' ? 'neutral' : 'bad'} title={state.phase === 'cancelled' ? 'Cancelled' : 'The audit did not finish'}>
          <InlineText text={state.error} />
        </Callout>
      )}
      {state.warnings.map((warning) => (
        <Callout key={warning} tone="warn">
          <InlineText text={warning} />
        </Callout>
      ))}

      {record && <Summary runId={state.runId} record={record} />}

      <ProgressLog steps={state.steps} open={active} />
    </section>
  );
}

/**
 * One ring per category, labeled with its full name. Columns take their content's width and spread
 * across the row, so "Performance" and "Accessibility" fit beside three rings even in Chrome's
 * narrowest side panel, where the rings and labels also step down a size.
 */
function Scores({ state, canOpen }: { state: RunState; canOpen: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const compact = width !== undefined && width < 330;
  const ids = state.options.categories;
  return (
    <div
      ref={ref}
      className={`grid items-start ${ids.length === CATEGORY_IDS.length ? 'justify-between' : 'justify-around'}`}
      style={{ gridTemplateColumns: `repeat(${ids.length}, auto)` }}
      role="group"
      aria-label="Scores"
    >
      {ids.map((id) => {
        const score = state.scores[id];
        const pending = state.phase === 'running' && score === undefined;
        return (
          <button
            key={id}
            type="button"
            disabled={!canOpen}
            onClick={() => void openReport(state.runId, `category-${id}`)}
            title={canOpen ? `Open ${CATEGORY_TITLES[id]} in the report` : undefined}
            className="flex flex-col items-center gap-1.5 rounded-lg py-1.5 transition-colors enabled:hover:bg-surface-2"
          >
            <ScoreRing score={score} pending={pending} size={compact ? 44 : 50} label={CATEGORY_TITLES[id]} />
            {/* w-min breaks "Best Practices" over two lines; single words keep their width. */}
            <span className={`w-min text-center leading-tight text-muted ${compact ? 'text-[10.5px]' : 'text-[11px]'}`}>{CATEGORY_TITLES[id]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** An element's width, kept current as the side panel is resized. */
function useWidth<T extends HTMLElement>(): [RefObject<T>, number | undefined] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function StatusLine({ state }: { state: RunState }) {
  switch (state.phase) {
    case 'queued':
      return (
        <p className="flex items-center gap-2 text-muted">
          <Spinner size={14} />
          Waiting for the audit in another tab
        </p>
      );
    case 'running': {
      const current = state.steps.find((step) => step.status === 'running');
      return (
        <p className="flex min-w-0 items-center gap-2">
          <Spinner size={14} className="shrink-0 text-accent" />
          <span className="truncate">{current ? current.label : 'Starting'}</span>
        </p>
      );
    }
    case 'done':
      return <p className="font-medium">Audit complete</p>;
    case 'cancelled':
      return <p className="text-muted">Cancelled</p>;
    case 'failed':
      return <p className="text-bad">Failed</p>;
  }
}

function Summary({ runId, record }: { runId: string; record: RunRecord }) {
  const model = useMemo(() => buildReportModel(record), [record]);
  const next = fixNext(model).slice(0, 3);
  const items = allFixItems(model);
  const { copied, copy } = useCopy();

  return (
    <div className="flex flex-col gap-3">
      {next.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <p className="border-b border-border px-3 py-2 text-[11px] font-medium tracking-wide text-muted uppercase">Fix next</p>
          <ul>
            {next.map((audit) => (
              <li key={audit.key}>
                <button
                  type="button"
                  onClick={() => void openReport(runId, `audit-${audit.key}`)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: statusColor(audit.status) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{audit.title}</span>
                  <span className="shrink-0 [&>span]:text-[11.5px]">
                    <PointsLabel audit={audit} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void openReport(runId)}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface font-medium transition-colors hover:bg-surface-2"
        >
          Open full report
          <ExternalIcon size={14} className="text-muted" />
        </button>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => void copy('all', allFixesPrompt(model.context, items))}
            title="Copy a fix prompt for every failing audit"
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 font-medium transition-colors hover:bg-surface-2"
          >
            {copied === 'all' ? <CheckIcon size={14} className="text-good" /> : <CopyIcon size={14} className="text-muted" />}
            {copied === 'all' ? 'Copied' : 'Copy fixes'}
          </button>
        )}
      </div>
    </div>
  );
}

const SHOWN_RUNS = 5;

/** Short category names for the run rows, where five full names would not fit beside a ring. */
const CATEGORY_SHORT: Readonly<Record<CategoryId, string>> = {
  performance: 'Perf',
  accessibility: 'A11y',
  'best-practices': 'Practices',
  seo: 'SEO',
  agentic: 'Agentic',
};

/**
 * The saved runs of the page in the tab, newest first, each with its scores and the change since
 * the run before it, so a page's history is one glance away without leaving the panel. The rest
 * of the site's runs are a link to the history page, filtered to the site.
 */
function PreviousRuns({ url, exclude, version }: { url: string; exclude: string | undefined; version: unknown }) {
  const history = useSiteHistory(url, exclude, version);
  const [expanded, setExpanded] = useState(false);
  if (!history) return null;
  const { host } = displayUrl(url);
  const total = history.page.length;
  const elsewhere = history.elsewhere.length;

  if (total === 0 && elsewhere === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[12px] leading-relaxed text-muted">
        Runs are saved in this browser. Earlier audits of the page you are on will be listed here.
      </p>
    );
  }

  const shown = expanded ? history.page : history.page.slice(0, SHOWN_RUNS);
  const hidden = total - shown.length;
  return (
    <section className="rounded-lg border border-border bg-surface" aria-label="Previous runs of this page">
      <h2 className="flex items-baseline gap-1.5 border-b border-border px-3 py-2 text-[11px] font-medium tracking-wide text-muted uppercase">
        Previous runs of this page
        <span className="num text-faint">{total}</span>
      </h2>
      {total === 0 ? (
        <p className="px-3 py-2.5 text-[12.5px] text-muted">No runs of this page yet.</p>
      ) : (
        <ul>
          {shown.map((run) => (
            <PreviousRun key={run.id} run={run} before={history.previous.get(run.id)} />
          ))}
        </ul>
      )}
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2 text-left text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <ChevronIcon size={13} className={expanded ? '-rotate-90' : 'rotate-90'} />
          {expanded ? 'Show fewer' : `Show all ${total}`}
        </button>
      )}
      {elsewhere > 0 && (
        <button
          type="button"
          onClick={() => void openHistory(host)}
          title="Open the history, filtered to this site"
          className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2 text-left text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <HistoryIcon size={13} />
          <span className="min-w-0 flex-1 truncate">
            <span className="num">{elsewhere}</span> {elsewhere === 1 ? 'run' : 'runs'} on other pages of {host}
          </span>
          <ExternalIcon size={12} className="shrink-0 text-faint" />
        </button>
      )}
    </section>
  );
}

function PreviousRun({ run, before }: { run: RunSummary; before: RunSummary | undefined }) {
  const ids = CATEGORY_IDS.filter((id) => id in run.scores);
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => void openReport(run.id)}
        title="Open this run's report"
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2"
      >
        <ScoreRing score={run.overall} size={36} animate={false} label="Overall" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12px]">
            <span className="num font-medium">{formatDate(run.startedAt)}</span>
            <span className="flex items-center gap-1 text-muted">
              {run.formFactor === 'mobile' ? <MobileIcon size={12} /> : <DesktopIcon size={12} />}
              {run.formFactor === 'mobile' ? 'Mobile' : 'Desktop'}
            </span>
            <ScoreDelta delta={overallDelta(run, before)} className="text-[11.5px]" />
          </span>
          <span className="mt-1 flex gap-3">
            {ids.map((id) => {
              const score = run.scores[id];
              return (
                <span key={id} className="flex flex-col items-center" title={CATEGORY_TITLES[id]}>
                  <span className="num text-[12px] leading-none font-medium" style={{ color: BAND_COLOR[band(score)] }}>
                    {typeof score === 'number' ? score : '–'}
                  </span>
                  <span className="sr-only">{CATEGORY_TITLES[id]}</span>
                  <span className="mt-0.5 text-[9.5px] leading-none text-faint" aria-hidden="true">
                    {CATEGORY_SHORT[id]}
                  </span>
                </span>
              );
            })}
          </span>
        </span>
      </button>
    </li>
  );
}

function ProgressBar({ value }: { value: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="-mt-2 h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Audit progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${Math.max(percent, 3)}%` }} />
    </div>
  );
}

function ProgressLog({ steps, open }: { steps: RunStep[]; open: boolean }) {
  if (steps.length === 0) return null;
  const list = (
    <ol className="flex flex-col">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-2.5 py-1">
          <StepIcon status={step.status} />
          <span className={`min-w-0 flex-1 truncate text-[12.5px] ${step.status === 'pending' || step.status === 'skipped' ? 'text-muted' : ''}`}>{step.label}</span>
          {step.detail && (
            <span className={`max-w-[45%] shrink-0 truncate text-[11px] ${step.status === 'failed' ? 'text-bad' : 'text-muted'}`} title={step.detail}>
              {step.detail}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
  if (open) {
    return (
      <div>
        <p className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">Progress</p>
        {list}
      </div>
    );
  }
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted uppercase select-none hover:text-text">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        Run log
      </summary>
      <div className="mt-1">{list}</div>
    </details>
  );
}

function StepIcon({ status }: { status: RunStep['status'] }) {
  switch (status) {
    case 'running':
      return <Spinner size={14} className="shrink-0 text-accent" />;
    case 'done':
      return <CheckIcon size={14} className="shrink-0 text-good" />;
    case 'failed':
      return <CrossIcon size={14} className="shrink-0 text-bad" />;
    case 'skipped':
      return <DashIcon size={14} className="shrink-0 text-faint" />;
    case 'pending':
      return <CircleIcon size={14} className="shrink-0 text-faint" />;
  }
}

function Callout({ tone, title, children }: { tone: 'neutral' | 'warn' | 'bad'; title?: string; children: ReactNode }) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--border-strong)';
  return (
    <div className="flex gap-2.5 rounded-lg border border-border bg-surface p-3" style={{ borderLeftColor: color, borderLeftWidth: 2 }} role={tone === 'bad' ? 'alert' : undefined}>
      {tone !== 'neutral' && <AlertIcon size={15} className="mt-px shrink-0" style={{ color }} />}
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        {title && <p className="mb-0.5 font-medium">{title}</p>}
        <div className="text-muted">{children}</div>
      </div>
    </div>
  );
}
