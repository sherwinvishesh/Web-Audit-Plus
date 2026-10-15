/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Computed Largest Contentful Paint (LCP) for all frames.
 */

import {makeComputedArtifact} from '../computed-artifact.js';
import {NavigationMetric} from './navigation-metric.js';
import {EngineError} from '../../lib/engine-error.js';

class LargestContentfulPaintAllFrames extends NavigationMetric {
  /**
   * TODO: Simulate LCP all frames in lantern.
   * @return {Promise<Engine.Artifacts.LanternMetric>}
   */
  static async computeSimulatedMetric() {
    throw new Error('LCP All Frames not implemented in lantern');
  }

  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @return {Promise<Engine.Artifacts.Metric>}
   */
  static async computeObservedMetric(data) {
    const {processedNavigation} = data;
    if (processedNavigation.timings.largestContentfulPaintAllFrames === undefined) {
      throw new EngineError(EngineError.errors.NO_LCP_ALL_FRAMES);
    }

    return {
      timing: processedNavigation.timings.largestContentfulPaintAllFrames,
      timestamp: processedNavigation.timestamps.largestContentfulPaintAllFrames,
    };
  }
}

const LargestContentfulPaintAllFramesComputed = makeComputedArtifact(
  LargestContentfulPaintAllFrames,
  ['devtoolsLog', 'gatherContext', 'settings', 'simulator', 'trace', 'URL', 'SourceMaps', 'HostDPR']
);
export {LargestContentfulPaintAllFramesComputed as LargestContentfulPaintAllFrames};
