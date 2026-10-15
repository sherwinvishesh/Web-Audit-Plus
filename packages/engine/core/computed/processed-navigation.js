/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {makeComputedArtifact} from './computed-artifact.js';
import {ProcessedTrace} from './processed-trace.js';
import EngineTraceProcessor from '../lib/engine-trace-processor.js';

class ProcessedNavigation {
  /**
   * @param {Engine.Trace | Engine.Artifacts.ProcessedTrace} traceOrProcessedTrace
   * @return {traceOrProcessedTrace is Engine.Artifacts.ProcessedTrace}
   */
  static isProcessedTrace(traceOrProcessedTrace) {
    return 'timeOriginEvt' in traceOrProcessedTrace;
  }

  /**
   * @param {Engine.Trace | Engine.Artifacts.ProcessedTrace} traceOrProcessedTrace
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.ProcessedNavigation>}
   */
  static async compute_(traceOrProcessedTrace, context) {
    // TODO: Remove this backport once pubads passes in a raw trace.
    if (this.isProcessedTrace(traceOrProcessedTrace)) {
      return EngineTraceProcessor.processNavigation(traceOrProcessedTrace);
    }

    const processedTrace = await ProcessedTrace.request(traceOrProcessedTrace, context);
    return EngineTraceProcessor.processNavigation(processedTrace);
  }
}

const ProcessedNavigationComputed = makeComputedArtifact(ProcessedNavigation, null);
export {ProcessedNavigationComputed as ProcessedNavigation};
