import type { ReactNode } from 'react';
import { HistoryIcon, Logo, MoonIcon, SunIcon } from '../components/icons';
import { useTheme } from '../lib/theme';

/** The report page frame: a slim top bar and a centred column. */
export function Shell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const theme = useTheme();
  return (
    <div className="min-h-screen text-[14px]">
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-4 px-6">
          <a href="report.html" className="flex items-center gap-2 rounded-md" aria-label="Web Audit+ history">
            <Logo size={22} />
            <span className="font-semibold tracking-tight">Web Audit+</span>
          </a>
          <div className="flex items-center gap-1">
            {actions}
            <a
              href="report.html"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <HistoryIcon size={15} />
              History
            </a>
            <button
              type="button"
              onClick={theme.toggle}
              aria-label={theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme.resolved === 'dark' ? 'Light theme' : 'Dark theme'}
              className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              {theme.resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export function Centered({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </main>
  );
}
