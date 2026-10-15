import { normalizeRunOptions, type RunOptions, type RunState } from './run';

/**
 * The port protocol between the UI (side panel, report page) and the background worker. A UI
 * connects one port, says which tab it is watching, and receives that tab's whole run state on
 * every change. Sending the whole state (a few kilobytes) rather than deltas means a panel that
 * reconnects mid-run is immediately correct.
 */

export const PORT_NAME = 'webauditplus';

export type ClientMessage =
  | { type: 'watch'; tabId: number }
  | { type: 'start'; tabId: number; options: RunOptions }
  | { type: 'cancel'; tabId: number };

export type ServerMessage = { type: 'state'; tabId: number; state: RunState | null };

function isTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Parse a message from a UI port. Anything malformed is dropped rather than half-trusted. */
export function parseClientMessage(value: unknown): ClientMessage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const message = value as { type?: unknown; tabId?: unknown; options?: unknown };
  if (!isTabId(message.tabId)) return undefined;
  switch (message.type) {
    case 'watch':
      return { type: 'watch', tabId: message.tabId };
    case 'cancel':
      return { type: 'cancel', tabId: message.tabId };
    case 'start':
      return { type: 'start', tabId: message.tabId, options: normalizeRunOptions(message.options) };
    default:
      return undefined;
  }
}

export function parseServerMessage(value: unknown): ServerMessage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const message = value as { type?: unknown; tabId?: unknown; state?: unknown };
  if (message.type !== 'state' || !isTabId(message.tabId)) return undefined;
  if (message.state !== null && (typeof message.state !== 'object' || message.state === undefined)) return undefined;
  return { type: 'state', tabId: message.tabId, state: message.state as RunState | null };
}
