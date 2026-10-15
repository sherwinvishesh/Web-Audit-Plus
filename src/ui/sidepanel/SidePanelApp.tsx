import { useMemo, type ReactNode } from 'react';
import { CATEGORY_IDS, CATEGORY_SHORT_TITLES, CATEGORY_TITLES, type CategoryId } from '../../shared/categories';
import { allFixesPrompt } from '../../shared/fix-prompt';
import { allFixItems, buildReportModel, fixNext } from '../../shared/report-model';
import { runProgress } from '../../shared/progress';
import { isFinished, type FormFactor, type RunOptions, type RunRecord, type RunState, type RunStep } from '../../shared/run';
import { auditability } from '../../shared/url-policy';
import { PointsLabel } from '../components/AuditBody';
import { InlineText } from '../components/InlineText';
import { ScoreRing } from '../components/ScoreRing';
import { statusColor } from '../components/StatusIcon';
import {
  AlertIcon,
  CheckIcon,
  CircleIcon,
  CopyIcon,
  CrossIcon,
  DashIcon,
  DesktopIcon,
  ExternalIcon,
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
import { useNow } from '../lib/now';
import { useRun } from '../lib/run-port';
import { useRunOptions } from '../lib/run-options';
import { openReport, useSavedRun } from '../lib/saved-run';
import { displayUrl, formatDuration } from '../lib/score';
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
        <span className="font-semibold tracking-tight">Web Audit+</span>
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
  const initial = (host.replace(/^www\./, '')[0] ?? '?').toUpperCase();
  return (
    <section className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3" aria-label="Page to audit">
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface-2 font-mono text-[13px] font-medium text-muted" aria-hidden="true">
        {initial}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium" title={title ?? host}>
          {url ? host || url : 'No page'}
        </p>
        <p className="truncate font-mono text-[11px] text-muted" title={url}>
          {url ? path || '/' : 'Open a website in this window'}
        </p>
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

      <div className="grid grid-cols-5 gap-1" role="group" aria-label="Scores">
        {state.options.categories.map((id) => {
          const score = state.scores[id];
          const pending = state.phase === 'running' && score === undefined;
          return (
            <button
              key={id}
              type="button"
              disabled={!record}
              onClick={() => void openReport(state.runId, `category-${id}`)}
              title={CATEGORY_TITLES[id]}
              className="flex flex-col items-center gap-1.5 rounded-lg py-1.5 transition-colors enabled:hover:bg-surface-2"
            >
              <ScoreRing score={score} pending={pending} size={50} label={CATEGORY_TITLES[id]} />
              <span className="text-[11px] text-muted">{CATEGORY_SHORT_TITLES[id]}</span>
            </button>
          );
        })}
      </div>

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
            <span className={`num max-w-[45%] shrink-0 truncate font-mono text-[11px] ${step.status === 'failed' ? 'text-bad' : 'text-muted'}`} title={step.detail}>
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
