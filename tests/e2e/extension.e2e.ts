import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compliantSite, flawedSite, type FixtureSite } from '../fixtures/sites';
import { canRun, launch, type Harness } from './chrome';

const AGENTIC_ONLY = { formFactor: 'desktop', categories: ['agentic'] } as const;

describe.skipIf(!canRun)('the built extension in Chrome', () => {
  let harness: Harness;
  let site: FixtureSite;
  let strict: FixtureSite;
  let flawed: FixtureSite;

  beforeAll(async () => {
    [site, strict, flawed] = await Promise.all([compliantSite(), compliantSite({ csp: "default-src 'none'; connect-src 'none'" }), flawedSite()]);
    harness = await launch();
  });
  afterAll(async () => {
    await harness?.close();
    await Promise.all([site?.close(), strict?.close(), flawed?.close()]);
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

  it('runs the audit engine on the tab and finds the problems the flawed site was built with', async () => {
    const { tabId } = await harness.openTab(`${flawed.origin}/`);
    const state = await harness.run(tabId, { formFactor: 'desktop', categories: ['performance', 'accessibility', 'best-practices', 'seo'] });
    expect(state.error).toBeUndefined();
    expect(state.phase).toBe('done');
    expect(state.steps.filter((step) => step.group === 'engine').map((step) => `${step.id}:${step.status}`)).toEqual([
      'engine:prepare:done',
      'engine:load:done',
      'engine:gather:done',
      'engine:audit:done',
      'engine:score:done',
    ]);
    // The flawed site's known scores: a change here means the engine now scores differently.
    expect(state.scores).toEqual({ performance: 100, accessibility: 55, 'best-practices': 92, seo: 75 });

    const engineResult = (await harness.record(state.runId))?.engine;
    expect(engineResult?.configSettings.formFactor).toBe('desktop');
    const failing = (category: string): string[] =>
      (engineResult?.categories[category]?.auditRefs ?? []).filter((ref) => ref.weight > 0 && engineResult?.audits[ref.id]?.score === 0).map((ref) => ref.id).sort();
    expect(failing('accessibility')).toEqual(['button-name', 'color-contrast', 'html-has-lang', 'image-alt', 'label']);
    expect(failing('seo')).toEqual(['image-alt', 'link-text', 'meta-description']);
    // Only the audits built on JavaScript coverage, which Chrome keeps from extensions, could not run.
    const errored = Object.values(engineResult?.audits ?? {}).filter((audit) => audit.scoreDisplayMode === 'error').map((audit) => audit.id);
    expect(errored.sort()).toEqual(['script-treemap-data', 'unused-javascript']);
    // The back/forward cache check ran on the extension's own page instead of chrome://terms.
    expect(engineResult?.audits['bf-cache']?.scoreDisplayMode).not.toBe('error');
    expect(engineResult?.fullPageScreenshot).toBeUndefined();
    // The tab is back on the page it was audited on.
    expect(await harness.tabUrl(tabId)).toBe(`${flawed.origin}/`);
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

  it('searches, filters and moves through the report from the keyboard', async () => {
    const { tabId } = await harness.openTab(`${flawed.origin}/`);
    const state = await harness.run(tabId, { ...AGENTIC_ONLY, categories: [...AGENTIC_ONLY.categories] });
    const report = await harness.page(`report.html?run=${state.runId}`);
    await report.waitForSelector('#category-agentic');
    const visibleRows = (): Promise<string[]> =>
      report.$$eval('[data-audit] > button', (rows) => rows.filter((row) => row.checkVisibility()).map((row) => row.parentElement?.getAttribute('data-audit') ?? ''));

    // One ring per category, and no Overall cell for a single category.
    expect(await report.$$eval('[aria-label="Scores"] a', (links) => links.map((link) => link.getAttribute('href')))).toEqual(['#category-agentic']);

    const before = await visibleRows();
    await report.keyboard.press('/');
    expect(await report.evaluate(() => document.activeElement?.getAttribute('type'))).toBe('search');
    await report.keyboard.type('llms.txt');
    await report.waitForFunction((count) => document.querySelectorAll('[data-audit]').length < count, {}, before.length);
    const matches = await visibleRows();
    expect(matches.length).toBeGreaterThan(0);
    expect(await report.$eval('main', (main) => main.textContent ?? '')).toMatch(/\d+ audits? match/);

    // Enter goes to the first result, j to the next one.
    await report.keyboard.press('Enter');
    const focused = (): Promise<string | null | undefined> => report.evaluate(() => document.activeElement?.closest('[data-audit]')?.getAttribute('data-audit'));
    expect(await focused()).toBe(matches[0]);
    await report.keyboard.press('j');
    expect(await focused()).toBe(matches[Math.min(1, matches.length - 1)]);

    // The Fix next tab ranks what failed, and keeps its place in the URL.
    await report.click('#tab-fix-next');
    await report.waitForSelector('#panel-fix-next');
    await report.click('::-p-text(Clear filters)');
    const ranked = await report.$$eval('#panel-fix-next [data-audit]', (rows) => rows.length);
    expect(ranked).toBeGreaterThan(0);
    expect(await report.evaluate(() => location.search)).toContain('view=fix-next');
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
