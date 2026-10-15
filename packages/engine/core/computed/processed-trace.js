/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {makeComputedArtifact} from './computed-artifact.js';
import EngineTraceProcessor from '../lib/engine-trace-processor.js';

class ProcessedTrace {
  /**
    * @param {Engine.Trace} trace
    * @return {Promise<Engine.Artifacts.ProcessedTrace>}
   */
  static async compute_(trace) {
    return EngineTraceProcessor.processTrace(trace);
  }
}

const ProcessedTraceComputed = makeComputedArtifact(ProcessedTrace, null);
export {ProcessedTraceComputed as ProcessedTrace};
