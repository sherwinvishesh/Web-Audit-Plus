import { describe, expect, it } from 'vitest';
import config from '../wxt.config';

// Exactly these permissions, each justified in the README. A new one needs a reason users will accept.
const EXPECTED_PERMISSIONS = ['debugger', 'activeTab', 'tabs', 'storage', 'sidePanel'];

describe('manifest', () => {
  const manifest = config.manifest;
  if (!manifest || typeof manifest === 'function' || manifest instanceof Promise) {
    throw new Error('wxt.config manifest must be a plain object');
  }

  it('requests exactly the permissions the README justifies', () => {
    expect([...(manifest.permissions ?? [])].sort()).toEqual([...EXPECTED_PERMISSIONS].sort());
  });

  it('requests <all_urls> host access only', () => {
    expect(manifest.host_permissions).toEqual(['<all_urls>']);
  });

  it('has a description the Chrome Web Store accepts (132 characters at most)', () => {
    expect(manifest.description?.length).toBeGreaterThan(0);
    expect(manifest.description?.length).toBeLessThanOrEqual(132);
  });

  it('requires a Chrome whose debugger API has child sessions', () => {
    expect(manifest.minimum_chrome_version).toBe('125');
  });

  it('has a toolbar action without a popup (click opens the side panel)', () => {
    expect(manifest.action).toBeDefined();
    expect(manifest.action && 'default_popup' in manifest.action).toBe(false);
  });
});
