/** The score bands: 0–49 poor, 50–89 needs improvement, 90–100 good. */
export type Band = 'good' | 'warn' | 'bad' | 'none';

export function band(score: number | null | undefined): Band {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'none';
  if (score >= 90) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

export const BAND_COLOR: Readonly<Record<Band, string>> = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  none: 'var(--faint)',
};

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Host plus path, without the scheme: how URLs read in the UI. */
export function displayUrl(raw: string): { host: string; path: string } {
  try {
    const url = new URL(raw);
    return { host: url.host, path: `${url.pathname}${url.search}` };
  } catch {
    return { host: raw, path: '' };
  }
}
