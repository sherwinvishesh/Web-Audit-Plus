import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Comparison } from '../../shared/compare';
import type { ReportModel } from '../../shared/report-model';
import { displayUrl } from '../lib/score';
import { StaticReport } from './StaticReport';

/**
 * A self-contained HTML report: one file, styles and fonts inlined, no script. Its Content Security
 * Policy allows nothing but the inline styles and `data:` images and fonts, so even a value from the
 * site that slipped past escaping could not run or load anything.
 */

export const EXPORT_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";

export interface HtmlExportOptions {
  /** The page's CSS, fonts already inlined as `data:` URLs. */
  css: string;
  comparison?: Comparison | undefined;
  /** ISO time of the export. */
  generatedAt: string;
}

export function reportHtml(model: ReportModel, options: HtmlExportOptions): string {
  const body = renderToStaticMarkup(createElement(StaticReport, { model, comparison: options.comparison, generatedAt: options.generatedAt }));
  const { host } = displayUrl(model.record.url);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(EXPORT_CSP)}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark light">',
    '<meta name="generator" content="Web Audit+">',
    `<title>${escapeHtml(`${host} · Web Audit+ report`)}</title>`,
    `<style>${escapeStyle(options.css)}</style>`,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
    '',
  ].join('\n');
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Keep a stylesheet from closing its own `<style>` element: every `<` becomes the CSS escape `\3c `.
 * Valid CSS has no `<` outside strings, where the escape means the same character.
 */
export function escapeStyle(css: string): string {
  return css.replace(/</g, '\\3c ');
}
