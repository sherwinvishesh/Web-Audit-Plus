export type TableOptions = {
    wastedMs?: number | undefined;
    wastedBytes?: number | undefined;
    sortedBy?: Engine.Audit.Details.Table["sortedBy"] | undefined;
    skipSumming?: Engine.Audit.Details.Table["skipSumming"] | undefined;
    isEntityGrouped?: Engine.Audit.Details.Table["isEntityGrouped"] | undefined;
};
export type OpportunityOptions = {
    overallSavingsMs: number;
    overallSavingsBytes?: number | undefined;
    sortedBy?: Engine.Audit.Details.Opportunity["sortedBy"] | undefined;
    skipSumming?: Engine.Audit.Details.Opportunity["skipSumming"] | undefined;
    isEntityGrouped?: Engine.Audit.Details.Opportunity["isEntityGrouped"] | undefined;
};
export class Audit {
    /**
     * @return {Engine.Audit.ScoreDisplayModes}
     */
    static get SCORING_MODES(): Engine.Audit.ScoreDisplayModes;
    /**
     * @return {Engine.Audit.Meta}
     */
    static get meta(): Engine.Audit.Meta;
    /**
     * @return {Object}
     */
    static get defaultOptions(): Object;
    /**
     *
     * @param {Engine.Artifacts} artifacts
     * @param {Engine.Audit.Context} context
     * @return {Engine.Audit.Product|Promise<Engine.Audit.Product>}
     */
    static audit(artifacts: Engine.Artifacts, context: Engine.Audit.Context): Engine.Audit.Product | Promise<Engine.Audit.Product>;
    /**
     * Computes a score between 0 and 1 based on the measured `value`. Score is determined by
     * considering a log-normal distribution governed by two control points (the 10th
     * percentile value and the median value) and represents the percentage of sites that are
     * greater than `value`.
     *
     * Score characteristics:
     * - within [0, 1]
     * - rounded to two digits
     * - value must meet or beat a controlPoint value to meet or exceed its percentile score:
     *   - value > median will give a score < 0.5; value ≤ median will give a score ≥ 0.5.
     *   - value > p10 will give a score < 0.9; value ≤ p10 will give a score ≥ 0.9.
     * - values < p10 will get a slight boost so a score of 1 is achievable by a
     *   `value` other than those close to 0. Scores of > ~0.99524 end up rounded to 1.
     * @param {{median: number, p10: number}} controlPoints
     * @param {number} value
     * @return {number}
     */
    static computeLogNormalScore(controlPoints: {
        median: number;
        p10: number;
    }, value: number): number;
    /**
     * This catches typos in the `key` property of a heading definition of table/opportunity details.
     * Throws an error if any of keys referenced by headings don't exist in at least one of the items.
     *
     * @param {Engine.Audit.Details.Table['headings']|Engine.Audit.Details.Opportunity['headings']} headings
     * @param {Engine.Audit.Details.Opportunity['items']|Engine.Audit.Details.Table['items']} items
     */
    static assertHeadingKeysExist(headings: Engine.Audit.Details.Table["headings"] | Engine.Audit.Details.Opportunity["headings"], items: Engine.Audit.Details.Opportunity["items"] | Engine.Audit.Details.Table["items"]): void;
    /**
     * @param {Engine.Audit.Details.Checklist['items']} items
     * @return {Engine.Audit.Details.Checklist}
     */
    static makeChecklistDetails(items: Engine.Audit.Details.Checklist["items"]): Engine.Audit.Details.Checklist;
    /**
     * @param {Engine.Audit.Details.Table['headings']} headings
     * @param {Engine.Audit.Details.Table['items']} results
     * @param {TableOptions=} options
     * @return {Engine.Audit.Details.Table}
     */
    static makeTableDetails(headings: Engine.Audit.Details.Table["headings"], results: Engine.Audit.Details.Table["items"], options?: TableOptions | undefined): Engine.Audit.Details.Table;
    /**
     * @param {Engine.Audit.Details.List['items']} items
     * @return {Engine.Audit.Details.List}
     */
    static makeListDetails(items: Engine.Audit.Details.List["items"]): Engine.Audit.Details.List;
    /**
     * @param {Engine.IcuMessage | string=} title
     * @param {Engine.IcuMessage | string=} description
     * @param {Engine.Audit.Details.ListableDetail} value
     * @return {Engine.Audit.Details.ListSectionItem}
     */
    static makeListDetailSectionItem(value: Engine.Audit.Details.ListableDetail, title?: (Engine.IcuMessage | string) | undefined, description?: (Engine.IcuMessage | string) | undefined): Engine.Audit.Details.ListSectionItem;
    /** @typedef {{
     * content: string;
     * title: string;
     * lineMessages: Engine.Audit.Details.SnippetValue['lineMessages'];
     * generalMessages: Engine.Audit.Details.SnippetValue['generalMessages'];
     * node?: Engine.Audit.Details.NodeValue;
     * maxLineLength?: number;
     * maxLinesAroundMessage?: number;
     * }} SnippetInfo */
    /**
     * @param {SnippetInfo} snippetInfo
     * @return {Engine.Audit.Details.SnippetValue}
     */
    static makeSnippetDetails({ content, title, lineMessages, generalMessages, node, maxLineLength, maxLinesAroundMessage, }: {
        content: string;
        title: string;
        lineMessages: Engine.Audit.Details.SnippetValue["lineMessages"];
        generalMessages: Engine.Audit.Details.SnippetValue["generalMessages"];
        node?: Engine.Audit.Details.NodeValue;
        maxLineLength?: number;
        maxLinesAroundMessage?: number;
    }): Engine.Audit.Details.SnippetValue;
    /**
     * @param {string} content
     * @param {number} maxLineLength
     * @return {Engine.Audit.Details.SnippetValue['lines']}
     */
    static _makeSnippetLinesArray(content: string, maxLineLength: number): Engine.Audit.Details.SnippetValue["lines"];
    /**
     * @param {Engine.Audit.Details.Opportunity['headings']} headings
     * @param {Engine.Audit.Details.Opportunity['items']} items
     * @param {OpportunityOptions} options
     * @return {Engine.Audit.Details.Opportunity}
     */
    static makeOpportunityDetails(headings: Engine.Audit.Details.Opportunity["headings"], items: Engine.Audit.Details.Opportunity["items"], options: OpportunityOptions): Engine.Audit.Details.Opportunity;
    /**
     * @param {Engine.Artifacts.NodeDetails} node
     * @return {Engine.Audit.Details.NodeValue}
     */
    static makeNodeItem(node: Engine.Artifacts.NodeDetails): Engine.Audit.Details.NodeValue;
    /**
     * @param {Engine.Artifacts.Bundle} bundle
     * @param {number} generatedLine
     * @param {number} generatedColumn
     * @return {Engine.Audit.Details.SourceLocationValue['original']}
     */
    static _findOriginalLocation(bundle: Engine.Artifacts.Bundle, generatedLine: number, generatedColumn: number): Engine.Audit.Details.SourceLocationValue["original"];
    /**
     * @param {string} url
     * @param {number} line 0-indexed
     * @param {number} column 0-indexed
     * @param {Engine.Artifacts.Bundle=} bundle
     * @return {Engine.Audit.Details.SourceLocationValue}
     */
    static makeSourceLocation(url: string, line: number, column: number, bundle?: Engine.Artifacts.Bundle | undefined): Engine.Audit.Details.SourceLocationValue;
    /**
     * @param {Engine.Artifacts.ConsoleMessage} entry
     * @param {Engine.Artifacts.Bundle=} bundle
     * @return {Engine.Audit.Details.SourceLocationValue | undefined}
     */
    static makeSourceLocationFromConsoleMessage(entry: Engine.Artifacts.ConsoleMessage, bundle?: Engine.Artifacts.Bundle | undefined): Engine.Audit.Details.SourceLocationValue | undefined;
    /**
     * @param {number|null} score
     * @param {Engine.Audit.ScoreDisplayMode} scoreDisplayMode
     * @param {string} auditId
     * @return {number|null}
     */
    static _normalizeAuditScore(score: number | null, scoreDisplayMode: Engine.Audit.ScoreDisplayMode, auditId: string): number | null;
    /**
     * @param {Engine.Audit.ProductMetricSavings|undefined} metricSavings
     * @return {Engine.Audit.ProductMetricSavings|undefined}
     */
    static _quantizeMetricSavings(metricSavings: Engine.Audit.ProductMetricSavings | undefined): Engine.Audit.ProductMetricSavings | undefined;
    /**
     * @param {typeof Audit} audit
     * @param {string | Engine.IcuMessage} errorMessage
     * @param {string=} errorStack
     * @return {Engine.RawIcu<Engine.Audit.Result>}
     */
    static generateErrorAuditResult(audit: typeof Audit, errorMessage: string | Engine.IcuMessage, errorStack?: string | undefined): Engine.RawIcu<Engine.Audit.Result>;
    /**
     * @param {typeof Audit} audit
     * @param {Engine.Audit.Product} product
     * @return {Engine.RawIcu<Engine.Audit.Result>}
     */
    static generateAuditResult(audit: typeof Audit, product: Engine.Audit.Product): Engine.RawIcu<Engine.Audit.Result>;
    /**
     * @param {Engine.Artifacts} artifacts
     * @param {Engine.Audit.Context} context
     * @returns {Engine.Artifacts.MetricComputationDataInput}
     */
    static makeMetricComputationDataInput(artifacts: Engine.Artifacts, context: Engine.Audit.Context): Engine.Artifacts.MetricComputationDataInput;
}
import * as Engine from '../../types/engine.js';
