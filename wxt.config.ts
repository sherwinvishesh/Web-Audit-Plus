import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { lighthouseBundle } from './scripts/lighthouse-bundle';

// Chrome MV3 extension: React UI under src/ui, entrypoints under src/extension.
export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'extension',
  publicDir: 'public',
  modules: ['@wxt-dev/module-react'],
  // Explicit imports everywhere: easier to audit what touches chrome.*.
  imports: false,
  manifest: {
    name: 'Web Audit+',
    description:
      'Lighthouse-parity audits (Performance, Accessibility, Best Practices, SEO) plus an Agentic readiness score, with copy-paste fix prompts.',
    // `action` with no popup: the toolbar click opens the side panel (see background/index.ts).
    action: { default_title: 'Web Audit+' },
    // chrome.debugger child sessions (`DebuggerSession.sessionId`), which Lighthouse needs for iframes.
    minimum_chrome_version: '125',
    // Each one is justified in the README. No `scripting`: Lighthouse injects its own code through the debugger.
    permissions: ['debugger', 'activeTab', 'tabs', 'storage', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
  vite: () => ({
    plugins: [tailwindcss(), lighthouseBundle()],
    build: {
      rolldownOptions: {
        // Lighthouse identifies its computed artifacts and page functions by `Function.name` (its own
        // bundles are built with esbuild's `keepNames`); the minifier must not rename or inline them.
        output: { keepNames: true },
      },
    },
  }),
});
