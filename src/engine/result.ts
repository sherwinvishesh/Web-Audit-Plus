import type { Result } from '@webauditplus/engine';

/**
 * An engine result, exactly as the engine produces it. Runs save it whole, apart from the pieces
 * `trimResult` drops.
 */
export type EngineResult = Result;
export type ResultAudit = EngineResult['audits'][string];
export type ResultCategory = EngineResult['categories'][string];
export type ResultDetails = NonNullable<ResultAudit['details']>;

/**
 * What a saved run keeps of an engine result. Two things go:
 * - `fullPageScreenshot`: an image of the whole page, often several MB, that only feeds the element
 *   thumbnails in a full-page report, which this extension does not draw;
 * - `i18n.icuMessagePaths`: the map the engine uses to re-translate a report. Runs are en-US.
 * The filmstrip (`screenshot-thumbnails`) and `final-screenshot` stay; they are small and the report
 * shows them.
 */
export function trimResult(engineResult: EngineResult): EngineResult {
  const trimmed: EngineResult = { ...engineResult, i18n: { rendererFormattedStrings: engineResult.i18n.rendererFormattedStrings } };
  delete trimmed.fullPageScreenshot;
  return trimmed;
}

/** A category score as a 0–100 integer, the way every score in the report shows it. */
export function categoryScore(engineResult: EngineResult, id: string): number | null {
  const score = engineResult.categories[id]?.score;
  return typeof score === 'number' ? Math.round(score * 100) : null;
}
