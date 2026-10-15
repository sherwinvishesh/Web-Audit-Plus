export type GatherStepRunnerOptions = WeakMap<Engine.UserFlow.GatherStep, Engine.Gatherer.GatherResult["runnerOptions"]>;
export class UserFlow {
    /**
     * @param {Engine.Puppeteer.Page} page
     * @param {Engine.UserFlow.Options} [options]
     */
    constructor(page: Engine.Puppeteer.Page, options?: Engine.UserFlow.Options);
    /** @type {Engine.Puppeteer.Page} */
    _page: Engine.Puppeteer.Page;
    /** @type {Engine.UserFlow.Options|undefined} */
    _options: Engine.UserFlow.Options | undefined;
    /** @type {Engine.UserFlow.GatherStep[]} */
    _gatherSteps: Engine.UserFlow.GatherStep[];
    /** @type {GatherStepRunnerOptions} */
    _gatherStepRunnerOptions: GatherStepRunnerOptions;
    /** @type {AbortController} */
    _controller: AbortController;
    dispose(): void;
    /**
     * @param {Engine.UserFlow.StepFlags|undefined} flags
     * @return {Engine.UserFlow.StepFlags|undefined}
     */
    _getNextFlags(flags: Engine.UserFlow.StepFlags | undefined): Engine.UserFlow.StepFlags | undefined;
    /**
     * @param {Engine.UserFlow.StepFlags|undefined} flags
     * @return {Engine.UserFlow.StepFlags}
     */
    _getNextNavigationFlags(flags: Engine.UserFlow.StepFlags | undefined): Engine.UserFlow.StepFlags;
    /**
     * @param {Engine.Gatherer.GatherResult} gatherResult
     * @param {Engine.UserFlow.StepFlags} [flags]
     */
    _addGatherStep(gatherResult: Engine.Gatherer.GatherResult, flags?: Engine.UserFlow.StepFlags): void;
    /**
     * @param {Engine.NavigationRequestor} requestor
     * @param {Engine.UserFlow.StepFlags} [flags]
     */
    navigate(requestor: Engine.NavigationRequestor, flags?: Engine.UserFlow.StepFlags): Promise<void>;
    /**
     * This is an alternative to `navigate()` that can be used to analyze a navigation triggered by user interaction.
     *
     * @param {Engine.UserFlow.StepFlags} [stepOptions]
     */
    startNavigation(stepOptions?: Engine.UserFlow.StepFlags): Promise<void>;
    currentNavigation: {
        continueAndAwaitResult: () => Promise<void>;
    } | undefined;
    endNavigation(): Promise<void>;
    /**
     * @param {Engine.UserFlow.StepFlags} [flags]
     */
    startTimespan(flags?: Engine.UserFlow.StepFlags): Promise<void>;
    currentTimespan: {
        timespan: {
            endTimespanGather(): Promise<Engine.Gatherer.GatherResult>;
        };
        flags: Engine.UserFlow.StepFlags | undefined;
    } | undefined;
    endTimespan(): Promise<void>;
    /**
     * @param {Engine.UserFlow.StepFlags} [flags]
     */
    snapshot(flags?: Engine.UserFlow.StepFlags): Promise<void>;
    /**
     * @returns {Promise<Engine.FlowResult>}
     */
    createFlowResult(): Promise<Engine.FlowResult>;
    /**
     * @return {Promise<string>}
     */
    generateReport(): Promise<string>;
    /**
     * @return {Engine.UserFlow.FlowArtifacts}
     */
    createArtifactsJson(): Engine.UserFlow.FlowArtifacts;
}
/**
 * @param {Array<Engine.UserFlow.GatherStep>} gatherSteps
 * @param {{name?: string, config?: Engine.Config, gatherStepRunnerOptions?: GatherStepRunnerOptions}} options
 */
export function auditGatherSteps(gatherSteps: Array<Engine.UserFlow.GatherStep>, options: {
    name?: string;
    config?: Engine.Config;
    gatherStepRunnerOptions?: GatherStepRunnerOptions;
}): Promise<{
    steps: Engine.FlowResult.Step[];
    name: string;
}>;
/**
 * @param {Engine.UserFlow.StepFlags|undefined} flags
 * @param {Engine.Artifacts} artifacts
 * @return {string}
 */
export function getStepName(flags: Engine.UserFlow.StepFlags | undefined, artifacts: Engine.Artifacts): string;
/**
 * @param {string|undefined} name
 * @param {Engine.UserFlow.GatherStep[]} gatherSteps
 * @return {string}
 */
export function getFlowName(name: string | undefined, gatherSteps: Engine.UserFlow.GatherStep[]): string;
export namespace UIStrings {
    let defaultFlowName: string;
    let defaultNavigationName: string;
    let defaultTimespanName: string;
    let defaultSnapshotName: string;
}
import * as Engine from '../types/engine.js';
