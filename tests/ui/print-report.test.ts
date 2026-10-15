import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { compareModels } from '../../src/shared/compare';
import { buildReportModel, fixNext } from '../../src/shared/report-model';
import { PrintReport } from '../../src/ui/export/PrintReport';
import { A4, footerTemplate, LETTER, paperFor, printParams } from '../../src/ui/export/pdf';
import { flawedDesktopResult } from '../engine/fixture';
import { flawedRecord, withScores } from '../helpers/records';

const HOSTILE = '"><script>alert(1)</script><img src=x onerror=alert(2)>';
const GENERATED = '2026-10-15T03:58:00.000Z';

function hostileModel() {
  const record = flawedRecord();
  record.url = `https://example.com/?q=${HOSTILE}`;
  const audit = record.engine?.audits['link-text'];
  if (audit) audit.displayValue = HOSTILE;
  const check = record.agentic?.checks[0];
  if (check) check.reason = `Found \`${HOSTILE}\` in the page ${HOSTILE}`;
  return buildReportModel(record);
}

describe('PrintReport', () => {
  const model = hostileModel();
  const html = renderToStaticMarkup(createElement(PrintReport, { model, generatedAt: GENERATED }));

  it('lays the run out as a document: a cover, the ranked fixes, each category, the prompt, the details', () => {
    expect(html.startsWith('<article class="print-doc')).toBe(true);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('>Fix next');
    for (const category of model.categories) expect(html).toContain(`id="pdf-category-${category.id}"`);
    expect(html).toContain('>Fix prompt</h2>');
    expect(html).toContain('>About this report</h2>');
    // Every section after the cover starts on a new page.
    expect(html.match(/class="print-break/g)).toHaveLength(model.categories.length + 2);
  });

  it('links every ranked fix to its details, written out under its own heading', () => {
    const next = fixNext(model);
    expect(next.length).toBeGreaterThan(0);
    for (const audit of next) {
      expect(html).toContain(`href="#pdf-audit-${audit.key}"`);
      expect(html).toContain(`id="pdf-audit-${audit.key}"`);
    }
    // Suggestions are written out too, under their own heading, and the Fix next page lists them after the ranked fixes.
    const detailed = model.categories.flatMap((category) => category.audits).filter((audit) => ['fail', 'partial', 'error', 'suggestion'].includes(audit.status));
    expect(html.match(/<h3[ >]/g)).toHaveLength(detailed.length + 1);
    expect(html).toContain('>Suggestions<');
    expect(html).toContain('href="#pdf-audit-agentic:B1"');
    expect(html).toContain('12 more suggestions apply once a markdown twin is served');
  });

  it('escapes everything that came from the site', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img src=x/i);
    expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+=/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('shows the comparison when there is one', () => {
    const current = buildReportModel(flawedRecord());
    const before = buildReportModel(flawedRecord({ id: 'run-0', startedAt: '2026-10-01T10:00:00.000Z', engine: withScores(flawedDesktopResult(), { 'image-alt': 1 }) }));
    const compared = renderToStaticMarkup(createElement(PrintReport, { model: current, comparison: compareModels(current, before), generatedAt: GENERATED }));
    expect(compared).toContain('Compared with');
    expect(compared).toContain('>New</span>');
    expect(compared).toContain('In the compared run');
  });
});

describe('footerTemplate', () => {
  const footer = footerTemplate(`example.com${HOSTILE}`);

  it('numbers the pages', () => {
    expect(footer).toContain('Page <span class="pageNumber"></span> of <span class="totalPages"></span>');
  });

  it('escapes its text', () => {
    expect(footer).not.toMatch(/<script/i);
    expect(footer).toContain('example.com&quot;&gt;&lt;script&gt;');
  });

  it('keeps its whole style inside the attribute, so Chrome applies the font size', () => {
    const style = /^<div style="([^"]*)">/.exec(footer)?.[1];
    expect(style).toContain('font-size:7.5px');
    expect(style).toContain('color:#8a93a1');
  });
});

describe('paperFor', () => {
  it('picks Letter where it is the everyday size and A4 everywhere else', () => {
    expect(paperFor('en-US')).toBe(LETTER);
    expect(paperFor('en-CA')).toBe(LETTER);
    expect(paperFor('es-MX')).toBe(LETTER);
    expect(paperFor('en')).toBe(LETTER);
    expect(paperFor('en-GB')).toBe(A4);
    expect(paperFor('de-DE')).toBe(A4);
    expect(paperFor('fr')).toBe(A4);
    expect(paperFor('ja')).toBe(A4);
    expect(paperFor('not a locale')).toBe(A4);
  });
});

describe('printParams', () => {
  it('asks Chrome for a tagged PDF with bookmarks, backgrounds and a footer', () => {
    const params = printParams(A4, '<div></div>');
    expect(params).toMatchObject({ paperWidth: 8.27, paperHeight: 11.69, printBackground: true, displayHeaderFooter: true, footerTemplate: '<div></div>', generateTaggedPDF: true, generateDocumentOutline: true });
  });
});
