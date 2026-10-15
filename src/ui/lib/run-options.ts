import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RUN_OPTIONS, normalizeRunOptions, type RunOptions } from '../../shared/run';

const KEY = 'runOptions';

/** The side panel's form factor and category choices, remembered across sessions. */
export function useRunOptions(): [RunOptions, (next: RunOptions) => void] {
  const [options, setOptions] = useState<RunOptions>(DEFAULT_RUN_OPTIONS);

  useEffect(() => {
    let disposed = false;
    void chrome.storage.local.get(KEY).then((stored) => {
      if (!disposed && stored[KEY]) setOptions(normalizeRunOptions(stored[KEY]));
    });
    return () => {
      disposed = true;
    };
  }, []);

  const update = useCallback((next: RunOptions) => {
    setOptions(next);
    void chrome.storage.local.set({ [KEY]: next });
  }, []);

  return [options, update];
}
