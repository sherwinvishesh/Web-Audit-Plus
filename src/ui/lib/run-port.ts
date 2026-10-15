import { useCallback, useEffect, useRef, useState } from 'react';
import { parseServerMessage, PORT_NAME, type ClientMessage } from '../../shared/messages';
import type { RunOptions, RunState } from '../../shared/run';

/**
 * The live run state of one tab, from the background worker. The port reconnects if the worker
 * restarts; the worker answers every `watch` with the tab's current state, so a reconnected panel
 * is immediately correct.
 */
export function useRun(tabId: number | undefined): {
  state: RunState | null;
  start(options: RunOptions): void;
  cancel(): void;
} {
  const [state, setState] = useState<RunState | null>(null);
  const port = useRef<chrome.runtime.Port | undefined>(undefined);

  useEffect(() => {
    setState(null);
    if (tabId === undefined) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = (): void => {
      const next = chrome.runtime.connect({ name: PORT_NAME });
      port.current = next;
      next.onMessage.addListener((raw: unknown) => {
        const message = parseServerMessage(raw);
        if (message && message.tabId === tabId) setState(message.state);
      });
      next.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        if (port.current === next) port.current = undefined;
        if (!disposed) retry = setTimeout(connect, 250);
      });
      next.postMessage({ type: 'watch', tabId } satisfies ClientMessage);
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      port.current?.disconnect();
      port.current = undefined;
    };
  }, [tabId]);

  const send = useCallback((message: ClientMessage) => {
    try {
      port.current?.postMessage(message);
    } catch {
      // Disconnected; the reconnect will resend `watch`, and the user can press Run again.
    }
  }, []);

  const start = useCallback(
    (options: RunOptions) => {
      if (tabId !== undefined) send({ type: 'start', tabId, options });
    },
    [send, tabId],
  );
  const cancel = useCallback(() => {
    if (tabId !== undefined) send({ type: 'cancel', tabId });
  }, [send, tabId]);

  return { state, start, cancel };
}
