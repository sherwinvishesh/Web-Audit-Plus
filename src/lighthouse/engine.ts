// Node globals first: Lighthouse reads them while its modules load.
import './shims/globals';

import { defaultConfig, desktopConfig, navigation, type Puppeteer, type Result } from 'lighthouse';
import log from 'lighthouse-logger';
import type { FormFactor } from '../shared/run';
import type { LighthousePage } from './cdp';

export type LighthouseCategory = 'performance' | 'accessibility' | 'best-practices' | 'seo';

export interface NavigationOptions {
  formFactor: FormFactor;
  categories: readonly LighthouseCategory[];
  signal?: AbortSignal;
  /** Lighthouse's own status lines ("Getting artifact: Accessibility", "Auditing: …"), as they happen. */
  onStatus?: (message: string) => void;
}

/**
 * One Lighthouse navigation run on a page, with Lighthouse's stock configs: `desktopConfig` for
 * desktop and the default (mobile) config for mobile, so the throttling, screen emulation and scoring
 * are exactly what Lighthouse and PageSpeed Insights use.
 */
export async function runNavigation(page: LighthousePage, url: string, options: NavigationOptions): Promise<Result> {
  const onStatus = ([, message]: unknown[]): void => {
    if (typeof message === 'string') options.onStatus?.(message);
  };
  log.events.on('status', onStatus);
  try {
    const result = await navigation(
      // Lighthouse reads two members of the page (see ./cdp.ts); the rest of Puppeteer's Page is unused.
      page as unknown as Puppeteer.Page,
      url,
      {
        config: options.formFactor === 'desktop' ? desktopConfig : defaultConfig,
        flags: { onlyCategories: [...options.categories], locale: 'en-US', output: 'json' },
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (!result) throw new Error('Lighthouse returned no result');
    const { lhr } = result;
    if (lhr.runtimeError) throw new Error(lhr.runtimeError.message);
    return lhr;
  } finally {
    log.events.off('status', onStatus);
  }
}
