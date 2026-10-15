import { useCallback, useEffect, useRef, useState } from 'react';

/** Copy text, and remember which key was copied for a moment so the button can say so. */
export function useCopy(resetMs = 1600): { copied: string | undefined; copy(key: string, text: string): Promise<boolean> } {
  const [copied, setCopied] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      setCopied(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(undefined), resetMs);
      return true;
    },
    [resetMs],
  );

  return { copied, copy };
}
