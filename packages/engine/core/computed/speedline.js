/**
 * @license
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import speedline from 'speedline-core';

import {makeComputedArtifact} from './computed-artifact.js';
import {EngineError} from '../lib/engine-error.js';
import {ProcessedTrace} from './processed-trace.js';

class Speedline {
  /**
   * @param {Engine.Trace} trace
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.Speedline>}
   */
  static async compute_(trace, context) {
    // speedline() may throw without a promise, so we resolve immediately
    // to get in a promise chain.
    return ProcessedTrace.request(trace, context).then(processedTrace => {
      // Use a shallow copy of traceEvents so speedline can sort as it pleases.
      const traceEvents = trace.traceEvents.slice();
      // Force use of timeOrigin as reference point for speedline
      const timeOrigin = processedTrace.timestamps.timeOrigin;
      return speedline(traceEvents, {
        timeOrigin,
        fastMode: true,
        include: 'speedIndex',
      });
    }).catch(err => {
      if (/No screenshots found in trace/.test(err.message)) {
        throw new EngineError(EngineError.errors.NO_SCREENSHOTS);
      }

      throw err;
    }).then(speedline => {
      if (speedline.frames.length === 0) {
        throw new EngineError(EngineError.errors.NO_SPEEDLINE_FRAMES);
      }

      if (speedline.speedIndex === 0) {
        throw new EngineError(EngineError.errors.SPEEDINDEX_OF_ZERO);
      }

      return speedline;
    });
  }
}

const SpeedlineComputed = makeComputedArtifact(Speedline, null);
export {SpeedlineComputed as Speedline};
