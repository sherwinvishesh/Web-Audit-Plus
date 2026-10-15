import { defineBackground } from 'wxt/utils/define-background';
import { parseClientMessage, PORT_NAME, type ServerMessage } from '../../shared/messages';
import { createRunStore } from '../../shared/storage';
import { executeRun, planRun } from './execute';
import { RunManager } from './run-manager';

export default defineBackground(() => {
  // Toolbar click opens the side panel (no popup).
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  const store = createRunStore();
  const manager = new RunManager({
    tabUrl: async (tabId) => (await chrome.tabs.get(tabId).catch(() => undefined))?.url,
    plan: planRun,
    execute: executeRun,
    save: (record) => store.put(record),
    environment: { extensionVersion: chrome.runtime.getManifest().version, userAgent: navigator.userAgent },
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME) return;
    const watched = new Set<number>();
    const send = (message: ServerMessage): void => {
      try {
        port.postMessage(message);
      } catch {
        // The UI went away between the event and the post.
      }
    };
    const unsubscribe = manager.subscribe((tabId, state) => {
      if (watched.has(tabId)) send({ type: 'state', tabId, state });
    });
    port.onMessage.addListener((raw: unknown) => {
      const message = parseClientMessage(raw);
      if (!message) return;
      switch (message.type) {
        case 'watch':
          watched.add(message.tabId);
          send({ type: 'state', tabId: message.tabId, state: manager.state(message.tabId) });
          return;
        case 'start':
          watched.add(message.tabId);
          void manager.start(message.tabId, message.options);
          return;
        case 'cancel':
          manager.cancel(message.tabId);
          return;
      }
    });
    port.onDisconnect.addListener(unsubscribe);
  });

  chrome.tabs.onRemoved.addListener((tabId) => manager.forget(tabId));
});
