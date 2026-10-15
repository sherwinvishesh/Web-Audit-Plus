// Node globals first: the engine reads them while its modules load.
import './shims/globals';

import { defaultConfig, desktopConfig, navigation, type Puppeteer, type Result } from '@webauditplus/engine';
import log from '@webauditplus/engine/logger';
import type { FormFactor } from '../shared/run';
import type { EnginePage } from './cdp';

export type EngineCategory = 'performance' | 'accessibility' | 'best-practices' | 'seo';

export interface NavigationOptions {
  formFactor: FormFactor;
  categories: readonly EngineCategory[];
  signal?: AbortSignal;
  /** The engine's own status lines ("Getting artifact: Accessibility", "Auditing: …"), as they happen. */
  onStatus?: (message: string) => void;
}

/**
 * One engine navigation run on a page, with the engine's stock configs: `desktopConfig` for desktop
 * and the default (mobile) config for mobile, so the throttling, screen emulation and scoring are
 * the standard lab settings.
 */
export async function runNavigation(page: EnginePage, url: string, options: NavigationOptions): Promise<Result> {
  const onStatus = ([, message]: unknown[]): void => {
    if (typeof message === 'string') options.onStatus?.(message);
  };
  log.events.on('status', onStatus);
  try {
    const result = await navigation(
      // The engine reads two members of the page (see ./cdp.ts); the rest of Puppeteer's Page is unused.
      page as unknown as Puppeteer.Page,
      url,
      {
        config: options.formFactor === 'desktop' ? desktopConfig : defaultConfig,
        flags: { onlyCategories: [...options.categories], locale: 'en-US', output: 'json' },
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (!result) throw new Error('The audit engine returned no result');
    const { engineResult } = result;
    if (engineResult.runtimeError) throw new Error(engineResult.runtimeError.message);
    return engineResult;
  } finally {
    log.events.off('status', onStatus);
  }
}
