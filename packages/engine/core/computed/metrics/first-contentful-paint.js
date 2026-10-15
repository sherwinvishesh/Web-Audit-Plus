/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {makeComputedArtifact} from '../computed-artifact.js';
import {NavigationMetric} from './navigation-metric.js';
import {LanternFirstContentfulPaint} from './lantern-first-contentful-paint.js';

class FirstContentfulPaint extends NavigationMetric {
  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.LanternMetric>}
   */
  static computeSimulatedMetric(data, context) {
    const metricData = NavigationMetric.getMetricComputationInput(data);
    return LanternFirstContentfulPaint.request(metricData, context);
  }

  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @return {Promise<Engine.Artifacts.Metric>}
   */
  static async computeObservedMetric(data) {
    const {processedNavigation} = data;

    return {
      timing: processedNavigation.timings.firstContentfulPaint,
      timestamp: processedNavigation.timestamps.firstContentfulPaint,
    };
  }
}

const FirstContentfulPaintComputed = makeComputedArtifact(
  FirstContentfulPaint,
  ['devtoolsLog', 'gatherContext', 'settings', 'simulator', 'trace', 'URL', 'SourceMaps', 'HostDPR']
);
export {FirstContentfulPaintComputed as FirstContentfulPaint};
