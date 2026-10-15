import type { AuditStatus } from '../../shared/report-model';
import { AlertIcon, CheckIcon, CircleIcon, CrossIcon, DashIcon, HalfIcon, LockIcon } from './icons';

const TONE: Readonly<Record<AuditStatus, string>> = {
  fail: 'var(--bad)',
  partial: 'var(--warn)',
  error: 'var(--muted)',
  locked: 'var(--faint)',
  pass: 'var(--good)',
  info: 'var(--muted)',
  manual: 'var(--muted)',
  na: 'var(--faint)',
};

export function statusColor(status: AuditStatus): string {
  return TONE[status];
}

export function StatusIcon({ status, size = 15 }: { status: AuditStatus; size?: number }) {
  const style = { color: TONE[status] };
  switch (status) {
    case 'fail':
      return <CrossIcon size={size} style={style} className="shrink-0" />;
    case 'partial':
      return <HalfIcon size={size} style={style} className="shrink-0" />;
    case 'pass':
      return <CheckIcon size={size} style={style} className="shrink-0" />;
    case 'error':
      return <AlertIcon size={size} style={style} className="shrink-0" />;
    case 'locked':
      return <LockIcon size={size} style={style} className="shrink-0" />;
    case 'na':
      return <DashIcon size={size} style={style} className="shrink-0" />;
    case 'info':
    case 'manual':
      return <CircleIcon size={size} style={style} className="shrink-0" />;
  }
}
