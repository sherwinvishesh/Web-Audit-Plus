import type { Comparison } from '../../shared/compare';
import type { EngineMeta, MetricView } from '../../engine/normalize';
import { MetricDelta } from './Change';
import { statusColor } from './StatusIcon';

/** The Performance lab metrics as a row of tiles: value colored by its rating, its weight, and the change. */
export function MetricTiles({ metrics, comparison }: { metrics: readonly MetricView[]; comparison?: Comparison | undefined }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5" aria-label="Lab metrics">
      {metrics.map((metric, index) => (
        <div
          key={metric.id}
          className={`flex flex-col gap-1 bg-surface px-4 py-3.5 ${index === metrics.length - 1 && metrics.length % 2 === 1 ? 'col-span-2 sm:col-span-1' : ''}`}
        >
          <p className="flex items-center justify-between gap-2 text-[12px] text-muted">
            <span className="truncate" title={metric.title}>
              {metric.title}
            </span>
            <span className="font-mono text-[11px] text-faint">{metric.acronym}</span>
          </p>
          <p className="num text-[22px] leading-tight font-semibold tracking-tight" style={{ color: statusColor(metric.status) }}>
            {metric.displayValue ?? '–'}
          </p>
          <p className="flex items-center justify-between gap-2 text-[11.5px] text-faint">
            <span className="num">{metric.weight > 0 ? `${metric.weight}% of score` : 'not scored'}</span>
            <MetricDelta change={comparison?.metrics[metric.id]} />
          </p>
        </div>
      ))}
    </div>
  );
}

/** How the page painted over time, from the engine's screenshots. */
export function Filmstrip({ meta }: { meta: EngineMeta | undefined }) {
  const frames = meta?.filmstrip ?? [];
  if (frames.length === 0) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex gap-2 overflow-x-auto p-3" tabIndex={0} role="region" aria-label="Filmstrip of the page loading, scrolls sideways">
        {frames.map((frame) => (
          <div key={frame.timing} className="flex shrink-0 flex-col items-center gap-1.5">
            <img src={frame.data} alt="" className="h-28 w-auto rounded-md border border-border bg-bg object-contain" loading="lazy" decoding="async" />
            <span className="num text-[11px] text-faint">{frame.timing < 1000 ? `${Math.round(frame.timing)} ms` : `${(frame.timing / 1000).toFixed(1)} s`}</span>
          </div>
        ))}
      </div>
      <figcaption className="border-t border-border px-3 py-2 text-[12px] text-muted">How the page rendered while loading</figcaption>
    </figure>
  );
}
