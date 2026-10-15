export default engine;
export { Audit } from "./audits/audit.js";
export { default as Gatherer } from "./gather/base-gatherer.js";
export { NetworkRecords } from "./computed/network-records.js";
export { default as defaultConfig } from "./config/default-config.js";
export { default as desktopConfig } from "./config/desktop-config.js";
export * from "../types/engine.js";
/**
 * Run Web Audit+.
 * @param {string=} url The URL to test. Optional if running in auditMode.
 * @param {Engine.Flags=} flags Optional settings for the Web Audit+ run. If present,
 *   they will override any settings in the config.
 * @param {Engine.Config=} config Configuration for the Web Audit+ run. If
 *   not present, the default config is used.
 * @param {Engine.Puppeteer.Page=} page
 * @return {Promise<Engine.RunnerResult|undefined>}
 */
declare function engine(url?: string | undefined, flags?: Engine.Flags | undefined, config?: Engine.Config | undefined, page?: Engine.Puppeteer.Page | undefined): Promise<Engine.RunnerResult | undefined>;
/**
 * @param {Engine.Puppeteer.Page} page
 * @param {Engine.UserFlow.Options} [options]
 */
export function startFlow(page: Engine.Puppeteer.Page, options?: Engine.UserFlow.Options): Promise<UserFlow>;
/**
 * @param {Engine.Puppeteer.Page|undefined} page
 * @param {Engine.NavigationRequestor|undefined} requestor
 * @param {{config?: Engine.Config, flags?: Engine.Flags}} [options]
 * @return {Promise<Engine.RunnerResult|undefined>}
 */
export function navigation(page: Engine.Puppeteer.Page | undefined, requestor: Engine.NavigationRequestor | undefined, options?: {
    config?: Engine.Config;
    flags?: Engine.Flags;
}): Promise<Engine.RunnerResult | undefined>;
/**
 * @param {Engine.Puppeteer.Page} page
 * @param {{config?: Engine.Config, flags?: Engine.Flags}} [options]
 * @return {Promise<{endTimespan: () => Promise<Engine.RunnerResult|undefined>}>}
 */
export function startTimespan(page: Engine.Puppeteer.Page, options?: {
    config?: Engine.Config;
    flags?: Engine.Flags;
}): Promise<{
    endTimespan: () => Promise<Engine.RunnerResult | undefined>;
}>;
/**
 * @param {Engine.Puppeteer.Page} page
 * @param {{config?: Engine.Config, flags?: Engine.Flags}} [options]
 * @return {Promise<Engine.RunnerResult|undefined>}
 */
export function snapshot(page: Engine.Puppeteer.Page, options?: {
    config?: Engine.Config;
    flags?: Engine.Flags;
}): Promise<Engine.RunnerResult | undefined>;
/**
 * @template {Engine.Result|Engine.FlowResult} R
 * @param {R} result
 * @param {[R] extends [Engine.Result] ? Engine.OutputMode : Exclude<Engine.OutputMode, 'csv'>} [format]
 * @return {string}
 */
export function generateReport<R extends Engine.Result | Engine.FlowResult>(result: R, format?: [R] extends [Engine.Result] ? Engine.OutputMode : Exclude<Engine.OutputMode, "csv">): string;
/**
 * @param {Engine.UserFlow.FlowArtifacts} flowArtifacts
 * @param {Engine.Config} [config]
 */
export function auditFlowArtifacts(flowArtifacts: Engine.UserFlow.FlowArtifacts, config?: Engine.Config): Promise<{
    steps: Engine.FlowResult.Step[];
    name: string;
}>;
export function getAuditList(): string[];
export const traceCategories: string[];
import * as Engine from '../types/engine.js';
import { UserFlow } from './user-flow.js';
