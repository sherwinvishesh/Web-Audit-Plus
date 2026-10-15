import { describe, expect, it } from 'vitest';
import { categoryScore, trimLhr } from '../../src/lighthouse/lhr';
import { flawedDesktopLhr } from './fixture';

describe('trimLhr', () => {
  it('drops the full-page screenshot and the re-translation map, and nothing else', () => {
    const lhr = flawedDesktopLhr();
    lhr.fullPageScreenshot = { screenshot: { data: 'data:image/webp;base64,AAAA', width: 1, height: 1 }, nodes: {} };
    lhr.i18n = { rendererFormattedStrings: lhr.i18n.rendererFormattedStrings, icuMessagePaths: { 'core/audits/x.js | title': ['audits.x.title'] } };
    const trimmed = trimLhr(lhr);
    expect(trimmed.fullPageScreenshot).toBeUndefined();
    expect(trimmed.i18n).toEqual({ rendererFormattedStrings: lhr.i18n.rendererFormattedStrings });
    expect(trimmed.audits).toBe(lhr.audits);
    expect(trimmed.categories).toBe(lhr.categories);
    // The input is left alone.
    expect(lhr.fullPageScreenshot).toBeDefined();
  });
});

describe('categoryScore', () => {
  it('rounds to the integer every Lighthouse UI shows', () => {
    const lhr = flawedDesktopLhr();
    expect(categoryScore(lhr, 'performance')).toBe(100);
    expect(categoryScore(lhr, 'accessibility')).toBe(55);
    expect(categoryScore(lhr, 'best-practices')).toBe(92);
    expect(categoryScore(lhr, 'seo')).toBe(75);
    expect(categoryScore(lhr, 'pwa')).toBeNull();
  });
});
