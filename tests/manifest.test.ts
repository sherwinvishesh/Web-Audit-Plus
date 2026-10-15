import { describe, expect, it } from 'vitest';
import config from '../wxt.config';

// §2 of the spec: exactly these permissions. Adding one requires asking the user.
const EXPECTED_PERMISSIONS = ['debugger', 'activeTab', 'tabs', 'storage', 'sidePanel', 'scripting'];

describe('manifest', () => {
  const manifest = config.manifest;
  if (!manifest || typeof manifest === 'function' || manifest instanceof Promise) {
    throw new Error('wxt.config manifest must be a plain object');
  }

  it('requests exactly the spec permissions', () => {
    expect([...(manifest.permissions ?? [])].sort()).toEqual([...EXPECTED_PERMISSIONS].sort());
  });

  it('requests <all_urls> host access only', () => {
    expect(manifest.host_permissions).toEqual(['<all_urls>']);
  });

  it('has a toolbar action without a popup (click opens the side panel)', () => {
    expect(manifest.action).toBeDefined();
    expect(manifest.action && 'default_popup' in manifest.action).toBe(false);
  });
});
