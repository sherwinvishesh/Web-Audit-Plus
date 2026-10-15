import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { CATEGORY_TITLES, isCategoryId } from '../../shared/categories';
import { CHANGE_LABEL, type ChangeKind, type Comparison } from '../../shared/compare';
import { filterAudits, isFiltering, matchesFilter, NO_FILTER, STATUS_FILTER_LABEL, type AuditFilter, type StatusFilter } from '../../shared/filter';
import { allFixesPrompt, categoryFixPrompt, singleFixPrompt } from '../../shared/fix-prompt';
import { allFixItems, buildReportModel, fixNext, type CategoryView, type ReportModel } from '../../shared/report-model';
import type { RunRecord, RunSummary } from '../../shared/run';
import { exportFileName, markdownSummary } from '../../shared/summary';
import { ScoreDelta } from '../components/Change';
import { Facts } from '../components/Facts';
import { ScoreRing } from '../components/ScoreRing';
import { AlertIcon, CheckIcon, ChevronIcon, CopyIcon, DesktopIcon, DownloadIcon, ExternalIcon, MobileIcon, SearchIcon } from '../components/icons';
import { useCopy } from '../lib/clipboard';
import { downloadText } from '../lib/download';
import { useSavedRun } from '../lib/saved-run';
import { band, BAND_COLOR, displayUrl, formatDate, formatDuration } from '../lib/score';
import { AuditRow } from './AuditRow';
import { CategorySection, groupKey } from './CategorySection';
import { ExportMenu, type MenuAction } from './ExportMenu';
import { defaultComparison, readParam, useComparableRuns, useComparison, useReportKeys, useScrollSpy, writeParam } from './hooks';
import { Centered, Shell } from './Shell';

type View = 'all' | 'fix-next';

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
  return <Report record={loaded.value} />;
}

function Report({ record }: { record: RunRecord }) {
  const model = useMemo(() => buildReportModel(record), [record]);
  const audits = useMemo(() => model.categories.flatMap((category) => category.audits), [model]);
  const next = useMemo(() => fixNext(model), [model]);

  // Compare with an earlier run of the same URL: the latest one by default, or the one in `?compare=`.
  const comparable = useComparableRuns(record);
  const [compareChoice, setCompareChoice] = useState<string | null>(() => readParam('compare'));
  const compareId = compareChoice === 'off' ? undefined : (compareChoice ?? (comparable ? defaultComparison(record, comparable) : undefined));
  const comparison = useComparison(model, compareId);
  const chooseComparison = useCallback((id: string) => {
    setCompareChoice(id);
    writeParam('compare', id);
  }, []);

  const [view, setViewState] = useState<View>(() => (readParam('view') === 'fix-next' ? 'fix-next' : 'all'));
  const setView = useCallback((value: View) => {
    setViewState(value);
    writeParam('view', value === 'all' ? undefined : value);
  }, []);

  const [filter, setFilter] = useState<AuditFilter>(NO_FILTER);
  const changed = useMemo(() => new Set(Object.keys(comparison?.audits ?? {})), [comparison]);
  const filtering = isFiltering(filter);
  useEffect(() => {
    if (!comparison && filter.status === 'changed') setFilter((current) => ({ ...current, status: 'all' }));
  }, [comparison, filter.status]);

  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((key: string) => setOpen((current) => flip(current, key)), []);
  const toggleGroup = useCallback((key: string) => setExpanded((current) => flip(current, key)), []);

  const { copied, copy } = useCopy();
  const [toast, showToast] = useToast();
  const copyAudit = useCallback(
    (key: string) => {
      const audit = audits.find((candidate) => candidate.key === key);
      if (!audit?.fixItem) {
        showToast(audit ? 'This audit passed: there is nothing to fix' : 'Nothing to copy');
        return;
      }
      void copy(key, singleFixPrompt(model.context, audit.fixItem)).then((done) => showToast(done ? `Fix prompt copied: ${audit.title}` : 'Could not copy to the clipboard'));
    },
    [audits, copy, model.context, showToast],
  );
  const copyCategory = useCallback(
    (category: CategoryView) => {
      void copy(`category:${category.id}`, categoryFixPrompt(model.context, category.id, allFixItems(model, category.id))).then(
        (done) => done && showToast(`${category.title} fix prompt copied`),
      );
    },
    [copy, model, showToast],
  );
  const copyAll = useCallback(() => {
    void copy('all', allFixesPrompt(model.context, allFixItems(model))).then((done) => done && showToast('Fix prompt for every audit copied'));
  }, [copy, model, showToast]);

  // Deep links from the side panel: #audit-<key> opens and scrolls to a row, #category-<id> to a section.
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    if (hash.startsWith('audit-')) {
      const audit = audits.find((candidate) => candidate.key === hash.slice('audit-'.length));
      if (audit) {
        setView('all');
        setOpen((current) => new Set(current).add(audit.key));
        setExpanded((current) => new Set(current).add(groupKey(audit.category, audit.status)));
      }
    }
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' })));
    return () => cancelAnimationFrame(frame);
  }, [audits, setView]);

  const search = useRef<HTMLInputElement>(null);
  useReportKeys({ search, onClearSearch: () => setFilter((current) => ({ ...current, query: '' })), onCopy: copyAudit });

  const visible = useMemo(
    () => new Map(model.categories.map((category) => [category.id, filtering ? filterAudits(category.audits, filter, changed) : category.audits])),
    [model, filter, filtering, changed],
  );
  const matchCount = filtering ? [...visible.values()].reduce((sum, list) => sum + list.length, 0) : audits.length;
  const nextVisible = useMemo(() => next.filter((audit) => matchesFilter(audit, { ...filter, status: 'all' }, changed)), [next, filter, changed]);

  const exportActions: MenuAction[] = [
    {
      label: 'Download HTML report',
      hint: 'One file that opens in any browser',
      icon: <DownloadIcon size={14} />,
      run: async () => {
        const [{ reportHtml }, { pageCss }] = await Promise.all([import('../export/html'), import('../export/page-css')]);
        const html = reportHtml(model, { css: await pageCss(), comparison, generatedAt: new Date().toISOString() });
        downloadText(exportFileName(record.url, record.startedAt, 'html'), html, 'text/html');
        showToast('HTML report downloaded');
      },
    },
    {
      label: 'Download JSON',
      hint: 'The full run, every audit result included',
      icon: <DownloadIcon size={14} />,
      run: () => {
        downloadText(exportFileName(record.url, record.startedAt, 'json'), `${JSON.stringify(record, null, 2)}\n`, 'application/json');
        showToast('JSON downloaded');
      },
    },
    {
      label: 'Copy markdown summary',
      hint: 'Scores, changes and the top fixes',
      icon: <CopyIcon size={14} />,
      run: async () => {
        const done = await copy('summary', markdownSummary(model, comparison));
        showToast(done ? 'Markdown summary copied' : 'Could not copy to the clipboard');
      },
    },
  ];

  const ids = useMemo(() => model.categories.map((category) => category.id), [model]);
  const active = useScrollSpy(view === 'all' ? ids : [], 140);

  return (
    <Shell sticky={false}>
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <Hero model={model} comparable={comparable} compareId={compareId} onCompare={chooseComparison} actions={<ExportMenu actions={exportActions} />} />
        <ScorePanel model={model} comparison={comparison} />
        <Notices model={model} comparison={comparison} onShowChanges={() => {
          setView('all');
          setFilter({ ...NO_FILTER, status: 'changed' });
        }} />

        <Tabs view={view} onChange={setView} total={audits.length} fixes={next.length} />

        <div className="sticky top-0 z-20 border-b border-border bg-bg py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {view === 'all' ? (
              <nav aria-label="Categories" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
                {model.categories.map((category) => (
                  <a
                    key={category.id}
                    href={`#category-${category.id}`}
                    aria-current={active === category.id ? 'true' : undefined}
                    className={`flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors ${
                      active === category.id ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface hover:text-text'
                    }`}
                  >
                    {category.title}
                    <span className="num text-[12px] font-medium" style={{ color: BAND_COLOR[band(category.score)] }}>
                      {category.score ?? '–'}
                    </span>
                  </a>
                ))}
              </nav>
            ) : (
              <p className="min-w-0 flex-1 text-[13px] text-muted">
                <span className="num font-medium text-text">{nextVisible.length}</span> {nextVisible.length === 1 ? 'fix' : 'fixes'}, biggest score gain first
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox inputRef={search} value={filter.query} onChange={(query) => setFilter((current) => ({ ...current, query }))} />
              {view === 'all' && (
                <Select
                  label="Status"
                  value={filter.status}
                  onChange={(status) => setFilter((current) => ({ ...current, status: status as StatusFilter }))}
                  options={(['all', 'needs-work', 'fail', 'partial', 'pass', 'na', 'other', ...(comparison ? (['changed'] as const) : [])] as const).map((value) => ({
                    value,
                    label: STATUS_FILTER_LABEL[value],
                  }))}
                />
              )}
              <Select
                label="Category"
                value={filter.category}
                onChange={(category) => setFilter((current) => ({ ...current, category: isCategoryId(category) ? category : 'all' }))}
                options={[{ value: 'all', label: 'All categories' }, ...model.categories.map((category) => ({ value: category.id, label: category.title }))]}
              />
              {view === 'fix-next' && nextVisible.length > 0 && (
                <button
                  type="button"
                  onClick={copyAll}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-medium text-accent-ink transition-[filter] hover:brightness-110"
                >
                  {copied === 'all' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                  {copied === 'all' ? 'Copied' : 'Copy all fixes'}
                </button>
              )}
            </div>
          </div>
        </div>

        {filtering && (
          <p className="mt-5 flex items-center gap-3 text-[13px] text-muted" aria-live="polite">
            <span>
              <span className="num font-medium text-text">{view === 'all' ? matchCount : nextVisible.length}</span> {(view === 'all' ? matchCount : nextVisible.length) === 1 ? 'audit matches' : 'audits match'}
            </span>
            <button type="button" onClick={() => setFilter(NO_FILTER)} className="rounded-md px-1.5 py-0.5 text-accent hover:bg-surface">
              Clear filters
            </button>
          </p>
        )}

        {view === 'all' ? (
          <div role="tabpanel" id="panel-all" aria-labelledby="tab-all">
            {model.categories.map((category) => {
              const list = visible.get(category.id) ?? [];
              if (filtering && list.length === 0) return null;
              return (
                <CategorySection
                  key={category.id}
                  model={model}
                  category={category}
                  audits={list}
                  filtering={filtering}
                  comparison={comparison}
                  open={open}
                  expanded={expanded}
                  copied={copied}
                  onToggle={toggle}
                  onToggleGroup={toggleGroup}
                  onCopy={copyAudit}
                  onCopyCategory={copyCategory}
                />
              );
            })}
            {filtering && matchCount === 0 && <EmptyResult onClear={() => setFilter(NO_FILTER)} />}
          </div>
        ) : (
          <div role="tabpanel" id="panel-fix-next" aria-labelledby="tab-fix-next" className="mt-6">
            {next.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
                <CheckIcon size={22} className="mx-auto text-good" />
                <p className="mt-3 font-medium">Nothing to fix</p>
                <p className="mt-1 text-[13px] text-muted">Every audit that applies to this page passed.</p>
              </div>
            ) : nextVisible.length === 0 ? (
              <EmptyResult onClear={() => setFilter(NO_FILTER)} />
            ) : (
              <>
                <ol className="overflow-hidden rounded-xl border border-border bg-surface">
                  {nextVisible.map((audit) => (
                    <AuditRow
                      key={audit.key}
                      audit={audit}
                      rank={next.indexOf(audit) + 1}
                      showCategory
                      open={open.has(audit.key)}
                      copied={copied === audit.key}
                      onToggle={toggle}
                      onCopy={copyAudit}
                      change={comparison?.audits[audit.key]}
                    />
                  ))}
                </ol>
                <p className="mt-3 text-[12.5px] text-faint">
                  Points are what a fix adds to its category score. A ≈ marks an estimate for an insight; estimates overlap with each other and with the metrics, so they rank the work but do not add up.
                </p>
              </>
            )}
          </div>
        )}

        <RunDetails model={model} />
      </main>
      <Toast message={toast} />
    </Shell>
  );
}

function flip(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function Hero({ model, comparable, compareId, onCompare, actions }: { model: ReportModel; comparable: RunSummary[] | undefined; compareId: string | undefined; onCompare(id: string): void; actions: ReactNode }) {
  const { record } = model;
  const { host, path } = displayUrl(record.url);
  const linkable = /^https?:/i.test(record.url);
  return (
    <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-9 pb-6">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-muted">Audit report</p>
        <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight break-all">
          {host}
          <span className="text-muted">{path === '/' ? '' : path}</span>
          {linkable && (
            <a href={record.url} target="_blank" rel="noreferrer noopener" className="ml-2 inline-grid size-7 translate-y-[-2px] place-items-center rounded-md align-middle text-faint transition-colors hover:bg-surface-2 hover:text-text" aria-label="Open the audited page">
              <ExternalIcon size={15} />
            </a>
          )}
        </h1>
        <Facts className="mt-2">
          <span className="num">{formatDate(record.startedAt)}</span>
          <span className="flex items-center gap-1.5">
            {record.options.formFactor === 'mobile' ? <MobileIcon size={14} /> : <DesktopIcon size={14} />}
            {record.options.formFactor === 'mobile' ? 'Mobile' : 'Desktop'}
          </span>
          <span className="num">took {formatDuration(record.durationMs)}</span>
          {model.context.framework && <span>Built with {model.context.framework.name}</span>}
          {model.engine && <span>Audit engine {model.engine.version}</span>}
        </Facts>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {comparable && comparable.length > 0 && (
          <Select
            label="Compare with"
            showLabel
            value={compareId ?? 'off'}
            onChange={onCompare}
            options={[
              ...comparable.map((run) => ({ value: run.id, label: `${formatDate(run.startedAt)}${typeof run.overall === 'number' ? ` · ${run.overall}` : ''}` })),
              { value: 'off', label: 'No comparison' },
            ]}
          />
        )}
        {actions}
      </div>
    </section>
  );
}

function ScorePanel({ model, comparison }: { model: ReportModel; comparison: Comparison | undefined }) {
  const { categories, record } = model;
  const withOverall = categories.length > 1;
  const style = { '--n': categories.length, '--cols': categories.length + (withOverall ? 1 : 0) } as CSSProperties;
  // Room for a note under each score only when some score has one, so the cards stay balanced.
  const notes = comparison !== undefined || categories.some((category) => category.error);
  return (
    <section
      aria-label="Scores"
      style={style}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
    >
      {withOverall && (
        <div className="col-span-2 flex items-center justify-between gap-4 bg-surface px-5 py-5 sm:col-span-full lg:col-span-1 lg:flex-col lg:items-start lg:justify-center">
          <div>
            <p className="text-[12px] font-medium text-muted">Overall</p>
            <p className="mt-1.5 flex items-baseline gap-1">
              <span className="num text-[44px] leading-none font-semibold tracking-tight" style={{ color: BAND_COLOR[band(record.overall)] }}>
                {record.overall ?? '–'}
              </span>
              <span className="text-[13px] text-faint">/100</span>
            </p>
          </div>
          <p className="flex items-center gap-2 text-[12px] text-faint lg:mt-3">
            <span>Mean of {categories.filter((category) => typeof category.score === 'number').length} scores</span>
            <ScoreDelta delta={comparison?.overall} />
          </p>
        </div>
      )}
      {categories.map((category, index) => (
        <a
          key={category.id}
          href={`#category-${category.id}`}
          className={`group flex flex-col items-center gap-2.5 bg-surface px-3 py-5 transition-colors hover:bg-surface-2 ${
            index === categories.length - 1 && categories.length % 2 === 1 ? 'col-span-2 sm:col-span-1' : ''
          }`}
        >
          <ScoreRing score={category.score} size={76} label={category.title} />
          <span className="text-[13px] font-medium">{category.title}</span>
          {notes && (
            <span className="-mt-1 flex h-4 items-center">
              {comparison?.scores[category.id] !== undefined ? <ScoreDelta delta={comparison.scores[category.id]} /> : category.error ? <span className="text-[11.5px] text-faint">not measured</span> : null}
            </span>
          )}
        </a>
      ))}
    </section>
  );
}

const SUMMARY_ORDER: readonly ChangeKind[] = ['fixed', 'improved', 'regressed', 'new'];

function Notices({ model, comparison, onShowChanges }: { model: ReportModel; comparison: Comparison | undefined; onShowChanges(): void }) {
  const warnings = model.engine?.warnings ?? [];
  const total = comparison ? Object.values(comparison.counts).reduce((sum, count) => sum + count, 0) : 0;
  if (warnings.length === 0 && !comparison) return null;
  return (
    <div className="mt-4 grid gap-2">
      {comparison && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px]">
          <span className="text-muted">
            Since <span className="num text-text">{formatDate(comparison.previousStartedAt)}</span>
          </span>
          {total === 0 ? (
            <span className="text-muted">no audit changed</span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {SUMMARY_ORDER.filter((kind) => comparison.counts[kind] > 0).map((kind) => (
                <span key={kind} className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ background: kind === 'fixed' || kind === 'improved' ? 'var(--good)' : 'var(--bad)' }} />
                  <span className="num font-medium">{comparison.counts[kind]}</span>
                  <span className="text-muted">{CHANGE_LABEL[kind].toLowerCase()}</span>
                </span>
              ))}
            </span>
          )}
          {total > 0 && (
            <button type="button" onClick={onShowChanges} className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-accent hover:bg-surface-2">
              Show changes
              <ChevronIcon size={12} />
            </button>
          )}
        </div>
      )}
      {warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px]">
          <AlertIcon size={15} className="mt-0.5 shrink-0 text-warn" />
          <span className="text-muted">{warning}</span>
        </p>
      ))}
    </div>
  );
}

function Tabs({ view, onChange, total, fixes }: { view: View; onChange(view: View): void; total: number; fixes: number }) {
  const tabs: Array<{ id: View; label: string; count: number }> = [
    { id: 'all', label: 'All audits', count: total },
    { id: 'fix-next', label: 'Fix next', count: fixes },
  ];
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextView: View = view === 'all' ? 'fix-next' : 'all';
    onChange(nextView);
    document.getElementById(`tab-${nextView}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Report views" onKeyDown={onKeyDown} className="mt-10 flex gap-6 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={view === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={view === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 text-[14px] font-medium transition-colors ${
            view === tab.id ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          {tab.label}
          <span className={`num rounded-full px-1.5 py-px text-[11px] ${view === tab.id ? 'bg-surface-2 text-text' : 'bg-surface text-faint'}`}>{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

function SearchBox({ inputRef, value, onChange }: { inputRef: RefObject<HTMLInputElement>; value: string; onChange(value: string): void }) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Search audits</span>
      <SearchIcon size={14} className="pointer-events-none absolute left-2.5 text-faint" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search audits"
        spellCheck={false}
        autoComplete="off"
        className="h-8 w-44 rounded-md border border-border bg-surface pr-8 pl-8 text-[13px] placeholder:text-faint focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value === '' && (
        <kbd className="pointer-events-none absolute right-2 rounded border border-border px-1.5 font-mono text-[11px] leading-4 text-faint" aria-hidden="true">
          /
        </kbd>
      )}
    </label>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  showLabel = false,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange(value: T): void;
  showLabel?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <span className={showLabel ? 'text-muted max-sm:sr-only' : 'sr-only'}>{label}</span>
      <span className="relative flex items-center">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="h-8 appearance-none rounded-md border border-border bg-surface pr-8 pl-3 text-[13px] transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronIcon size={12} className="pointer-events-none absolute right-2.5 rotate-90 text-faint" />
      </span>
    </label>
  );
}

function EmptyResult({ onClear }: { onClear(): void }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center">
      <p className="font-medium">No audit matches</p>
      <p className="mt-1 text-[13px] text-muted">Try fewer words, or another status.</p>
      <button type="button" onClick={onClear} className="mt-4 rounded-md border border-border-strong px-3 py-1.5 text-[13px] hover:bg-surface-2">
        Clear filters
      </button>
    </div>
  );
}

function RunDetails({ model }: { model: ReportModel }) {
  const { record, engine } = model;
  const rows: Array<[string, string]> = [];
  if (engine) {
    rows.push(['Audit engine', engine.version]);
    rows.push(['Device', `${engine.formFactor === 'mobile' ? 'Mobile' : 'Desktop'}, ${engine.screen}`]);
    rows.push(['Throttling', engine.throttling]);
    if (engine.benchmarkIndex !== undefined) rows.push(['CPU benchmark', String(Math.round(engine.benchmarkIndex))]);
    rows.push(['User agent', engine.userAgent]);
  }
  rows.push(['Categories', record.options.categories.map((id) => CATEGORY_TITLES[id]).join(', ')]);
  rows.push(['Duration', formatDuration(record.durationMs)]);
  rows.push(['Extension', `Web Audit+ ${record.environment.extensionVersion}`]);
  rows.push(['Run id', record.id]);
  const keys: Array<[string[], string]> = [
    [['/'], 'Search'],
    [['j', 'k'], 'Next and previous audit'],
    [['Enter'], 'Open or close an audit'],
    [['c'], 'Copy the focused fix prompt'],
    [['Esc'], 'Leave the search'],
  ];
  return (
    <footer className="mt-20 grid gap-10 border-t border-border pt-8 text-[12.5px] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section>
        <h2 className="mb-3 text-[12.5px] font-medium text-text">Run details</h2>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5">
          {rows.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-faint">{term}</dt>
              <dd className="num break-words text-muted">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2 className="mb-3 text-[12.5px] font-medium text-text">Keyboard</h2>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
          {keys.map(([combo, action]) => (
            <div key={action} className="contents">
              <dt className="flex gap-1">
                {combo.map((key) => (
                  <kbd key={key} className="min-w-6 rounded border border-border-strong bg-surface px-1.5 text-center font-mono text-[11px] leading-5 text-muted">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted">{action}</dd>
            </div>
          ))}
        </dl>
      </section>
    </footer>
  );
}

function useToast(): [string | undefined, (message: string) => void] {
  const [message, setMessage] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(undefined), 2400);
  }, []);
  return [message, show];
}

function Toast({ message }: { message: string | undefined }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {message && (
        <p className="flex max-w-lg items-center gap-2 truncate rounded-lg border border-border-strong bg-surface-2 px-4 py-2.5 text-[13px] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)]">
          <CheckIcon size={14} className="shrink-0 text-good" />
          <span className="truncate">{message}</span>
        </p>
      )}
    </div>
  );
}
