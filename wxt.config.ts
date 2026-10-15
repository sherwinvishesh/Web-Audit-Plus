import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See DECISIONS.md for why these choices were made.
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
    // `action` with no popup: the toolbar click opens the side panel (see background.ts).
    action: { default_title: 'Web Audit+' },
    permissions: ['debugger', 'activeTab', 'tabs', 'storage', 'sidePanel', 'scripting'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
