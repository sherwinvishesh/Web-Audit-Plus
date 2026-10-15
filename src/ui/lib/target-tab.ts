import { useEffect, useState } from 'react';

export interface TargetTab {
  id: number;
  url: string | undefined;
  title: string | undefined;
}

/**
 * The tab the side panel is about: the active tab of the panel's own window, followed as the user
 * switches tabs or navigates. `?tab=<id>` pins a specific tab, which the end-to-end tests use.
 */
export function useTargetTab(): TargetTab | undefined {
  const [tab, setTab] = useState<TargetTab | undefined>();

  useEffect(() => {
    const pinned = Number(new URLSearchParams(location.search).get('tab'));
    const pinnedId = Number.isInteger(pinned) && pinned > 0 ? pinned : undefined;
    let windowId: number | undefined;
    let disposed = false;

    const apply = (next: chrome.tabs.Tab | undefined): void => {
      if (disposed || next?.id === undefined) return;
      setTab({ id: next.id, url: next.url, title: next.title });
    };
    const refresh = async (): Promise<void> => {
      if (pinnedId !== undefined) return apply(await chrome.tabs.get(pinnedId).catch(() => undefined));
      windowId ??= (await chrome.windows.getCurrent()).id;
      const [active] = await chrome.tabs.query({ active: true, windowId });
      apply(active);
    };

    const onActivated = (info: chrome.tabs.OnActivatedInfo): void => {
      if (pinnedId === undefined && info.windowId === windowId) void refresh();
    };
    const onUpdated = (tabId: number, change: chrome.tabs.OnUpdatedInfo, updated: chrome.tabs.Tab): void => {
      if (!('url' in change) && !('title' in change)) return;
      if (pinnedId !== undefined ? tabId === pinnedId : updated.active && updated.windowId === windowId) apply(updated);
    };

    void refresh();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      disposed = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return tab;
}
