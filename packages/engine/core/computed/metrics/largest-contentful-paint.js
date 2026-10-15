/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Computed Largest Contentful Paint (LCP), the paint time of the largest in-viewport contentful element
 * COMPAT: LCP's trace event was first introduced in m78. We can't surface an LCP for older Chrome versions
 * @see https://github.com/WICG/largest-contentful-paint
 * @see https://wicg.github.io/largest-contentful-paint/
 * @see https://web.dev/lcp
 */

import {makeComputedArtifact} from '../computed-artifact.js';
import {NavigationMetric} from './navigation-metric.js';
import {EngineError} from '../../lib/engine-error.js';
import {LanternLargestContentfulPaint} from './lantern-largest-contentful-paint.js';

class LargestContentfulPaint extends NavigationMetric {
  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.LanternMetric>}
   */
  static computeSimulatedMetric(data, context) {
    const metricData = NavigationMetric.getMetricComputationInput(data);
    return LanternLargestContentfulPaint.request(metricData, context);
  }

  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @return {Promise<Engine.Artifacts.Metric>}
   */
  static async computeObservedMetric(data) {
    const {processedNavigation} = data;
    if (processedNavigation.timings.largestContentfulPaint === undefined) {
      throw new EngineError(EngineError.errors.NO_LCP);
    }

    return {
      timing: processedNavigation.timings.largestContentfulPaint,
      timestamp: processedNavigation.timestamps.largestContentfulPaint,
    };
  }
}

const LargestContentfulPaintComputed = makeComputedArtifact(
  LargestContentfulPaint,
  ['devtoolsLog', 'gatherContext', 'settings', 'simulator', 'trace', 'URL', 'SourceMaps', 'HostDPR']
);
export {LargestContentfulPaintComputed as LargestContentfulPaint};
