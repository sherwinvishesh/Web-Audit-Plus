import { useEffect, useState } from 'react';

/** Phase 0 placeholder: shows the active tab's URL. */
export function SidePanelApp() {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    const refresh = () => {
      void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        setUrl(tab?.url ?? '');
      });
    };
    refresh();
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(refresh);
    return () => {
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(refresh);
    };
  }, []);

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-sm font-semibold tracking-tight">Web Audit+</h1>
      <p className="mt-2 truncate font-mono text-xs text-muted" title={url}>
        {url || 'No active tab'}
      </p>
    </main>
  );
}
