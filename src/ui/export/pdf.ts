/**
 * Save the report tab as a PDF. The page prints itself through `chrome.debugger` and Chrome's own
 * Page.printToPDF, so the file has real, selectable text, internal links, bookmarks from the headings,
 * a tagged structure for screen readers, and page numbers in the footer. What gets printed is the
 * document in PrintReport, which the print stylesheet swaps in for the screen layout.
 */

export interface Paper {
  name: 'A4' | 'Letter';
  /** Inches. */
  width: number;
  height: number;
}

export const A4: Paper = { name: 'A4', width: 8.27, height: 11.69 };
export const LETTER: Paper = { name: 'Letter', width: 8.5, height: 11 };

/** Where Letter is the everyday paper size; A4 everywhere else. */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'PR', 'GT', 'CR', 'PA', 'DO', 'SV', 'NI']);

/** The paper a reader in `locale` most likely prints on. */
export function paperFor(locale: string): Paper {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    return region && LETTER_REGIONS.has(region) ? LETTER : A4;
  } catch {
    return A4;
  }
}

/** Page margins in inches. The bottom one holds the footer. */
const MARGIN = { top: 0.5, bottom: 0.6, side: 0.55 };

/**
 * The footer on every page: `left` on one side, "Page 3 of 12" on the other. Chrome renders it apart
 * from the page, without its stylesheet or fonts, so it is styled inline.
 */
export function footerTemplate(left: string): string {
  const style = [
    'width:100%',
    `padding:0 ${MARGIN.side}in`,
    'display:flex',
    'justify-content:space-between',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    'font-size:7.5px',
    'color:#8a93a1',
  ].join(';');
  return `<div style="${style}"><span>${escapeHtml(left)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
}

/** Page.printToPDF parameters for `paper`, with `footer` as the footer template. */
export function printParams(paper: Paper, footer: string): Record<string, unknown> {
  return {
    paperWidth: paper.width,
    paperHeight: paper.height,
    marginTop: MARGIN.top,
    marginBottom: MARGIN.bottom,
    marginLeft: MARGIN.side,
    marginRight: MARGIN.side,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
    preferCSSPageSize: false,
    generateTaggedPDF: true,
    generateDocumentOutline: true,
  };
}

/** Printing through the debugger is not possible here; the browser's print dialog still is. */
export class PrintUnavailableError extends Error {
  override readonly name = 'PrintUnavailableError';
}

/** Wait until everything in `root` can be laid out for print: fonts loaded, images decoded. */
export async function printLayoutReady(root: ParentNode): Promise<void> {
  const fonts = ['400 1em "Geist Variable"', '600 1em "Geist Variable"', '400 1em "Geist Mono Variable"'];
  await Promise.all(fonts.map((font) => document.fonts.load(font).catch(() => [])));
  await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img'), (image) => image.decode().catch(() => undefined)));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Print the tab this page is in to a PDF. */
export async function printTabToPdf(params: Record<string, unknown>): Promise<Blob> {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id === undefined) throw new PrintUnavailableError('This page is not open in a tab');
  const target: chrome.debugger.Debuggee = { tabId: tab.id };
  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (error) {
    throw new PrintUnavailableError(error instanceof Error ? error.message : String(error));
  }
  try {
    const { data } = (await chrome.debugger.sendCommand(target, 'Page.printToPDF', params)) as { data: string };
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: 'application/pdf' });
  } finally {
    await chrome.debugger.detach(target).catch(() => undefined);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
