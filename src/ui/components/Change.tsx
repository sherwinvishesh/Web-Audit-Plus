import { CHANGE_LABEL, metricDelta, signed, type ChangeKind, type MetricChange } from '../../shared/compare';

const CHANGE_COLOR: Readonly<Record<ChangeKind, string>> = {
  new: 'var(--bad)',
  regressed: 'var(--bad)',
  improved: 'var(--good)',
  fixed: 'var(--good)',
};

const CHANGE_TITLE: Readonly<Record<ChangeKind, string>> = {
  new: 'Passed in the compared run, fails now',
  regressed: 'Worse than in the compared run',
  improved: 'Better than in the compared run, not fixed yet',
  fixed: 'Failed in the compared run, passes now',
};

/** "New", "Fixed", "Better", "Worse": how an audit moved since the compared run. */
export function ChangeBadge({ kind }: { kind: ChangeKind }) {
  const color = CHANGE_COLOR[kind];
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}
      title={CHANGE_TITLE[kind]}
    >
      {CHANGE_LABEL[kind]}
    </span>
  );
}

/** A score change: green up, red down, faint when flat. */
export function ScoreDelta({ delta, className = '' }: { delta: number | undefined; className?: string }) {
  if (delta === undefined) return null;
  const text = signed(delta);
  const color = text === '±0' ? 'var(--faint)' : delta > 0 ? 'var(--good)' : 'var(--bad)';
  return (
    <span className={`num font-mono text-[12px] font-medium ${className}`} style={{ color }} title="Change since the compared run">
      {text}
    </span>
  );
}

/** A lab-metric change. Lower is better, so a negative delta is good news. */
export function MetricDelta({ change }: { change: MetricChange | undefined }) {
  if (!change) return null;
  const color = change.delta < 0 ? 'var(--good)' : 'var(--bad)';
  return (
    <span className="num font-mono text-[11.5px] font-medium" style={{ color }} title={change.before ? `Was ${change.before}` : 'Change since the compared run'}>
      {metricDelta(change)}
    </span>
  );
}
