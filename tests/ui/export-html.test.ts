import { describe, expect, it } from 'vitest';
import { compareModels } from '../../src/shared/compare';
import { buildReportModel } from '../../src/shared/report-model';
import { EXPORT_CSP, escapeStyle, reportHtml } from '../../src/ui/export/html';
import { flawedDesktopResult } from '../engine/fixture';
import { flawedRecord, withScores } from '../helpers/records';

const HOSTILE = '"><script>alert(1)</script><img src=x onerror=alert(2)>';

function hostileModel() {
  const record = flawedRecord();
  record.url = `https://example.com/?q=${HOSTILE}`;
  const audit = record.engine?.audits['link-text'];
  if (audit) audit.displayValue = HOSTILE;
  const check = record.agentic?.checks[0];
  if (check) check.reason = `Found \`${HOSTILE}\` in the page ${HOSTILE}`;
  return buildReportModel(record);
}

describe('reportHtml', () => {
  const html = reportHtml(hostileModel(), { css: 'body{color:red}</style><script>alert(3)</script>', generatedAt: '2026-10-15T03:58:00.000Z' });

  it('is one complete document with a locked-down policy', () => {
    expect(html.startsWith('<!doctype html>\n<html lang="en">')).toBe(true);
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${EXPORT_CSP.replace(/'/g, '&#39;')}">`);
    expect(EXPORT_CSP).toMatch(/^default-src 'none'; /);
    expect(EXPORT_CSP).not.toMatch(/script-src/);
    expect(html).toContain('<meta name="color-scheme" content="dark light">');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('never carries a script, whatever the site or the stylesheet contained', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img src=x/i);
    // Every `<` left in the output starts a real tag; none of them has an event handler.
    expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+=/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html.match(/<\/style>/g)).toHaveLength(1);
  });

  it('escapes the page title', () => {
    const title = /<title>(.*)<\/title>/.exec(html)?.[1];
    expect(title).toBe('example.com · Web Audit+ report');
  });

  it('works without JavaScript: rows are details, fix prompts are printed', () => {
    expect(html).toContain('<details');
    expect(html).toContain('<pre');
    expect(html).toContain('Prompt for every fix');
    expect(html).toContain('id="category-agentic"');
    expect(html).toContain('id="audit-seo:link-text"');
  });

  it('shows the comparison when there is one', () => {
    const model = buildReportModel(flawedRecord());
    const before = buildReportModel(flawedRecord({ id: 'run-0', startedAt: '2026-10-01T10:00:00.000Z', engine: withScores(flawedDesktopResult(), { 'image-alt': 1 }) }));
    const compared = reportHtml(model, { css: '', comparison: compareModels(model, before), generatedAt: '2026-10-15T03:58:00.000Z' });
    expect(compared).toContain('Compared with the run of 2026-10-01 10:00 UTC');
    expect(compared).toContain('>New</span>');
  });
});

describe('escapeStyle', () => {
  it('keeps a stylesheet inside its element', () => {
    expect(escapeStyle('a{}</STYLE ><!--')).toBe('a{}\\3c /STYLE >\\3c !--');
    expect(escapeStyle('a::before{content:"<"}')).toBe('a::before{content:"\\3c "}');
  });
});
