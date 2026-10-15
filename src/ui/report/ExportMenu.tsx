import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronIcon, DownloadIcon } from '../components/icons';

export interface MenuAction {
  label: string;
  hint?: string;
  icon: ReactNode;
  run(): void | Promise<void>;
}

/** A small menu button: the actions open on click, arrow keys move, Escape closes. */
export function ExportMenu({ actions }: { actions: readonly MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent): void => {
      const target = event.target instanceof Node ? event.target : null;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (next: number): void => items[(next + items.length) % items.length]?.focus();
    if (event.key === 'ArrowDown') focus(index + 1);
    else if (event.key === 'ArrowUp') focus(index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(items.length - 1);
    else if (event.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'Tab') setOpen(false);
    else return;
    event.preventDefault();
  };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[13px] font-medium transition-colors hover:bg-surface-2"
      >
        <DownloadIcon size={14} className="text-muted" />
        Export
        <ChevronIcon size={12} className={`text-faint transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label="Export"
          onKeyDown={onKeyDown}
          className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-lg border border-border-strong bg-surface p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)]"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                button.current?.focus();
                void action.run();
              }}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left outline-none hover:bg-surface-2 focus:bg-surface-2"
            >
              <span className="mt-0.5 text-muted">{action.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{action.label}</span>
                {action.hint && <span className="block text-[12px] text-muted">{action.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
