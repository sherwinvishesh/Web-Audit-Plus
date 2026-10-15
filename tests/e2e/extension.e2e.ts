import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compliantSite, type FixtureSite } from '../fixtures/sites';
import { canRun, launch, type Harness } from './chrome';

const AGENTIC_ONLY = { formFactor: 'desktop', categories: ['agentic'] } as const;

describe.skipIf(!canRun)('the built extension in Chrome', () => {
  let harness: Harness;
  let site: FixtureSite;
  let strict: FixtureSite;

  beforeAll(async () => {
    [site, strict] = await Promise.all([compliantSite(), compliantSite({ csp: "default-src 'none'; connect-src 'none'" })]);
    harness = await launch();
  });
  afterAll(async () => {
    await harness?.close();
    await Promise.all([site?.close(), strict?.close()]);
  });

  it('audits a compliant site to 100 on Agentic, with A8 not applicable on a local host', async () => {
    const { tabId } = await harness.openTab(`${site.origin}/resume`);
    const state = await harness.run(tabId, { ...AGENTIC_ONLY, categories: [...AGENTIC_ONLY.categories] });
    expect(state.error).toBeUndefined();
    expect(state.phase).toBe('done');
    expect(state.scores.agentic).toBe(100);
    expect(state.steps.every((step) => step.status === 'done')).toBe(true);

    const record = await harness.record(state.runId);
    const notPassing = record?.agentic?.checks.filter((check) => check.status !== 'pass').map((check) => `${check.id} ${check.status}`);
    expect(notPassing).toEqual(['A8 na']);
    // The bot probe carried the override, and it was cleared afterwards: the twin came back for GPTBot.
    expect(record?.agentic?.checks.find((check) => check.id === 'B10')?.status).toBe('pass');
  });

  it("is not blocked by the page's Content-Security-Policy", async () => {
    const { tabId } = await harness.openTab(`${strict.origin}/resume`);
    const state = await harness.run(tabId, { ...AGENTIC_ONLY, categories: [...AGENTIC_ONLY.categories] });
    expect(state.error).toBeUndefined();
    expect(state.scores.agentic).toBe(100);
  });

  it('refuses a page Chrome does not let extensions audit', async () => {
    const { tabId } = await harness.openTab('chrome://version/');
    const state = await harness.run(tabId, { ...AGENTIC_ONLY, categories: [...AGENTIC_ONLY.categories] });
    expect(state.phase).toBe('failed');
    expect(state.error).toMatch(/browser page/);
  });

  it('renders the saved run in the report page and lists it in the history', async () => {
    const { tabId } = await harness.openTab(`${site.origin}/resume`);
    const state = await harness.run(tabId, { ...AGENTIC_ONLY, categories: [...AGENTIC_ONLY.categories] });

    const report = await harness.page(`report.html?run=${state.runId}#audit-agentic:A8`);
    await report.waitForSelector('#category-agentic');
    const text = await report.$eval('main', (main) => main.textContent ?? '');
    expect(text).toContain('Agentic');
    expect(text).toContain('127.0.0.1');
    // The deep link opened the A8 row.
    const expanded = await report.$eval('[data-audit="agentic:A8"] button', (button) => button.getAttribute('aria-expanded'));
    expect(expanded).toBe('true');

    const history = await harness.page('report.html');
    await history.waitForSelector(`a[href="report.html?run=${state.runId}"]`);
  });

  it('runs from the side panel UI', async () => {
    const { tabId } = await harness.openTab(`${site.origin}/resume`);
    const panel = await harness.page(`sidepanel.html?tab=${tabId}`);
    await panel.evaluate(() => chrome.storage.local.set({ runOptions: { formFactor: 'desktop', categories: ['agentic'] } }));
    await panel.reload();
    const run = await panel.waitForSelector('::-p-text(Run audit)');
    await run?.click();
    await panel.waitForSelector('::-p-text(Open full report)', { timeout: 120_000 });
    if (process.env.E2E_SCREENSHOTS) {
      await panel.setViewport({ width: 400, height: 900 });
      await panel.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/sidepanel.png`, fullPage: true });
    }
    const rings = await panel.$$eval('[aria-label="Scores"] a, [aria-label="Scores"] button', (nodes) => nodes.length);
    expect(rings).toBeGreaterThan(0);
  });
});
