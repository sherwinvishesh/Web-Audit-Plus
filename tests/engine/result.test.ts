import { describe, expect, it } from 'vitest';
import { categoryScore, trimResult } from '../../src/engine/result';
import { flawedDesktopResult } from './fixture';

describe('trimResult', () => {
  it('drops the full-page screenshot and the re-translation map, and nothing else', () => {
    const engineResult = flawedDesktopResult();
    engineResult.fullPageScreenshot = { screenshot: { data: 'data:image/webp;base64,AAAA', width: 1, height: 1 }, nodes: {} };
    engineResult.i18n = { rendererFormattedStrings: engineResult.i18n.rendererFormattedStrings, icuMessagePaths: { 'core/audits/x.js | title': ['audits.x.title'] } };
    const trimmed = trimResult(engineResult);
    expect(trimmed.fullPageScreenshot).toBeUndefined();
    expect(trimmed.i18n).toEqual({ rendererFormattedStrings: engineResult.i18n.rendererFormattedStrings });
    expect(trimmed.audits).toBe(engineResult.audits);
    expect(trimmed.categories).toBe(engineResult.categories);
    // The input is left alone.
    expect(engineResult.fullPageScreenshot).toBeDefined();
  });
});

describe('categoryScore', () => {
  it('rounds to the integer the report shows', () => {
    const engineResult = flawedDesktopResult();
    expect(categoryScore(engineResult, 'performance')).toBe(100);
    expect(categoryScore(engineResult, 'accessibility')).toBe(55);
    expect(categoryScore(engineResult, 'best-practices')).toBe(92);
    expect(categoryScore(engineResult, 'seo')).toBe(75);
    expect(categoryScore(engineResult, 'pwa')).toBeNull();
  });
});
