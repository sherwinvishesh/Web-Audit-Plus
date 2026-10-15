import type { Result } from 'lighthouse';

/**
 * A Lighthouse result (LHR), exactly as Lighthouse produces it. Runs save it whole, apart from the
 * pieces `trimLhr` drops, so an exported run opens in the Lighthouse Viewer like any other LHR.
 */
export type Lhr = Result;
export type LhrAudit = Lhr['audits'][string];
export type LhrCategory = Lhr['categories'][string];
export type LhrDetails = NonNullable<LhrAudit['details']>;

/**
 * What a saved run keeps of an LHR. Two things go:
 * - `fullPageScreenshot`: an image of the whole page, often several MB, that only feeds the element
 *   thumbnails in Lighthouse's own report;
 * - `i18n.icuMessagePaths`: the map Lighthouse uses to re-translate a report. Runs are en-US.
 * The filmstrip (`screenshot-thumbnails`) and `final-screenshot` stay; they are small and the report
 * shows them.
 */
export function trimLhr(lhr: Lhr): Lhr {
  const trimmed: Lhr = { ...lhr, i18n: { rendererFormattedStrings: lhr.i18n.rendererFormattedStrings } };
  delete trimmed.fullPageScreenshot;
  return trimmed;
}

/** A category score as a 0–100 integer, the way every Lighthouse UI shows it. */
export function categoryScore(lhr: Lhr, id: string): number | null {
  const score = lhr.categories[id]?.score;
  return typeof score === 'number' ? Math.round(score * 100) : null;
}
