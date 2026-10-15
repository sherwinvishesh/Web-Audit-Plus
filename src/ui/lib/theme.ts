import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'dark' | 'light';

const KEY = 'webauditplus:theme';

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : 'system';
  } catch {
    return 'system';
  }
}

function apply(preference: ThemePreference): void {
  if (preference === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', preference);
}

/** Apply the saved theme before the first paint. Call once from each page's entry. */
export function initTheme(): void {
  apply(read());
}

function systemPrefersLight(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches;
}

/** The effective theme and a toggle between dark and light. Pages share the preference. */
export function useTheme(): { resolved: 'dark' | 'light'; toggle(): void } {
  const [preference, setPreference] = useState<ThemePreference>(read);
  const [prefersLight, setPrefersLight] = useState(systemPrefersLight);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (): void => setPrefersLight(media.matches);
    const onStorage = (event: StorageEvent): void => {
      if (event.key === KEY) {
        const next = read();
        apply(next);
        setPreference(next);
      }
    };
    media.addEventListener('change', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const resolved = preference === 'system' ? (prefersLight ? 'light' : 'dark') : preference;
  const toggle = useCallback(() => {
    const next: ThemePreference = resolved === 'dark' ? 'light' : 'dark';
    // Back to following the system once the choice matches it.
    const stored: ThemePreference = (next === 'light') === systemPrefersLight() ? 'system' : next;
    try {
      if (stored === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, stored);
    } catch {
      // Storage unavailable: the toggle still works for this page.
    }
    apply(stored === 'system' ? 'system' : next);
    setPreference(stored);
  }, [resolved]);

  return { resolved, toggle };
}
