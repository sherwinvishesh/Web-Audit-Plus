import type { ReactNode } from 'react';
import type { AuditChange } from '../../shared/compare';
import { STATUS_LABEL, type AuditItem } from '../../shared/report-model';
import { InlineText } from './InlineText';

/**
 * An audit's expanded content: what was found, why it matters, how to fix it. Presentational only,
 * so the live report and the exported HTML render exactly the same thing.
 */
export function AuditBody({ audit, change, actions }: { audit: AuditItem; change?: AuditChange | undefined; actions?: ReactNode }) {
  const evidence = audit.evidence ?? [];
  const more = Math.max(0, (audit.evidenceTotal ?? evidence.length) - evidence.length);
  const found = audit.reason || audit.detail || evidence.length > 0;
  return (
    <div className="grid gap-4 text-[13.5px] leading-relaxed">
      {found && (
        <Block label="What was found">
          {audit.reason && (
            <p>
              <InlineText text={audit.reason} />
            </p>
          )}
          {audit.detail && (
            <p className="mt-1 text-muted">
              <InlineText text={audit.detail} />
            </p>
          )}
          {evidence.length > 0 && (
            <ul className="mt-2 grid gap-1.5 rounded-lg border border-border bg-bg px-3 py-2.5 text-[12.5px]">
              {evidence.map((line, index) => (
                <li key={index} className="min-w-0 break-words">
                  <InlineText text={line} />
                </li>
              ))}
              {more > 0 && <li className="text-faint">and {more} more</li>}
            </ul>
          )}
        </Block>
      )}
      {audit.why && (
        <Block label="Why it matters">
          <InlineText text={audit.why} className="text-muted" />
        </Block>
      )}
      {audit.fix && (
        <Block label="How to fix">
          <InlineText text={audit.fix} />
        </Block>
      )}
      {audit.stackNotes && audit.stackNotes.length > 0 && (
        <Block label="For this stack">
          <div className="grid gap-1.5">
            {audit.stackNotes.map((note) => (
              <p key={note.title}>
                <span className="font-medium">{note.title}:</span> <InlineText text={note.text} className="text-muted" />
              </p>
            ))}
          </div>
        </Block>
      )}
      {audit.status === 'locked' && audit.lockedBy && (
        <Block label="Locked">
          <span className="text-muted">
            Nothing could be measured until <span className="font-mono text-text">{audit.lockedBy}</span> passes.
          </span>
        </Block>
      )}
      {change && (
        <p className="text-[12.5px] text-muted">
          In the compared run: <span className="text-text">{STATUS_LABEL[change.before]}</span>
          {change.beforeValue && <span className="num">, {change.beforeValue}</span>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <span className="ml-auto flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-faint">
          {audit.group && <span className="font-sans">{audit.group}</span>}
          {audit.category === 'agentic' && audit.weight !== undefined && audit.earned !== undefined && (
            <span className="num">{audit.status === 'locked' || audit.status === 'na' ? `weight ${audit.weight}` : `${audit.earned} of ${audit.weight}`}</span>
          )}
          <span>{audit.id}</span>
        </span>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11.5px] font-medium text-faint">{label}</p>
      <div>{children}</div>
    </div>
  );
}

/** What fixing an audit is worth, as the row shows it: "+30", or "≈+7.5" for a Lighthouse estimate. */
export function PointsLabel({ audit }: { audit: AuditItem }) {
  if (audit.status !== 'fail' && audit.status !== 'partial') return null;
  if (audit.points > 0) {
    return (
      <span className="num font-mono text-[12px] font-medium text-good" title={`Fixing this adds up to ${audit.points} points to the score`}>
        +{audit.points}
      </span>
    );
  }
  if (audit.impact) {
    return (
      <span
        className="num font-mono text-[12px] text-muted"
        title={`Lighthouse estimates up to ${audit.impact} Performance points, through the metrics this improves. Estimates overlap, so they are not added up.`}
      >
        ≈+{audit.impact}
      </span>
    );
  }
  return null;
}
