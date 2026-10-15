/**
 * @license
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Trace from './gather/gatherers/trace.js';
import {Runner} from './runner.js';
import {UserFlow, auditGatherSteps} from './user-flow.js';
import {ReportGenerator} from '../report/generator/report-generator.js';
import {startTimespanGather} from './gather/timespan-runner.js';
import {snapshotGather} from './gather/snapshot-runner.js';
import {navigationGather} from './gather/navigation-runner.js';
import * as Engine from '../types/engine.js';

/*
 * The relationship between these root modules:
 *
 *   index.js  - the package entry point
 *
 *   runner.js - marshalls the actions that must be taken (Gather / Audit)
 *               config file is used to determine which of these actions are needed
 *
 *   clients ----> core/index.js ----> runner.js ----> [Gather / Audit]
 */

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
async function engine(url, flags = {}, config, page) {
  return navigation(page, url, {config, flags});
}

/**
 * @param {Engine.Puppeteer.Page} page
 * @param {Engine.UserFlow.Options} [options]
 */
async function startFlow(page, options) {
  return new UserFlow(page, options);
}

/**
 * @param {Engine.Puppeteer.Page|undefined} page
 * @param {Engine.NavigationRequestor|undefined} requestor
 * @param {{config?: Engine.Config, flags?: Engine.Flags}} [options]
 * @return {Promise<Engine.RunnerResult|undefined>}
 */
async function navigation(page, requestor, options) {
  const gatherResult = await navigationGather(page, requestor, options);
  return Runner.audit(gatherResult.artifacts, gatherResult.runnerOptions);
}

/**
 * @param {Engine.Puppeteer.Page} page
 * @param {{config?: Engine.Config, flags?: Engine.Flags}} [options]
 * @return {Promise<Engine.RunnerResult|undefined>}
 */
async function snapshot(page, options) {
  const gatherResult = await snapshotGather(page, options);
  return Runner.audit(gatherResult.artifacts, gatherResult.runnerOptions);
}

/**
 * @param {Engine.Puppeteer.Page} page
 * @param {{config?: Engine.Config, flags?: Engine.Flags}} [options]
 * @return {Promise<{endTimespan: () => Promise<Engine.RunnerResult|undefined>}>}
 */
async function startTimespan(page, options) {
  const {endTimespanGather} = await startTimespanGather(page, options);
  const endTimespan = async () => {
    const gatherResult = await endTimespanGather();
    return Runner.audit(gatherResult.artifacts, gatherResult.runnerOptions);
  };
  return {endTimespan};
}

/**
 * @template {Engine.Result|Engine.FlowResult} R
 * @param {R} result
 * @param {[R] extends [Engine.Result] ? Engine.OutputMode : Exclude<Engine.OutputMode, 'csv'>} [format]
 * @return {string}
 */
function generateReport(result, format = 'html') {
  const reportOutput = ReportGenerator.generateReport(result, format);
  if (Array.isArray(reportOutput)) {
    // In theory the output should never be an array.
    // This is mostly for type checking.
    return reportOutput[0];
  } else {
    return reportOutput;
  }
}

/**
 * @param {Engine.UserFlow.FlowArtifacts} flowArtifacts
 * @param {Engine.Config} [config]
 */
async function auditFlowArtifacts(flowArtifacts, config) {
  const {gatherSteps, name} = flowArtifacts;
  return await auditGatherSteps(gatherSteps, {name, config});
}

function getAuditList() {
  return Runner.getAuditList();
}

const traceCategories = Trace.getDefaultTraceCategories();

export default engine;
export {Audit} from './audits/audit.js';
export {default as Gatherer} from './gather/base-gatherer.js';
export {NetworkRecords} from './computed/network-records.js';
export {default as defaultConfig} from './config/default-config.js';
export {default as desktopConfig} from './config/desktop-config.js';
export * from '../types/engine.js';
export {
  startFlow,
  navigation,
  startTimespan,
  snapshot,
  generateReport,
  auditFlowArtifacts,
  getAuditList,
  traceCategories,
};
