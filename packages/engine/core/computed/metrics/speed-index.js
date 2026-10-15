/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {makeComputedArtifact} from '../computed-artifact.js';
import {NavigationMetric} from './navigation-metric.js';
import {LanternSpeedIndex} from './lantern-speed-index.js';
import {Speedline} from '../speedline.js';

class SpeedIndex extends NavigationMetric {
  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.LanternMetric>}
   */
  static computeSimulatedMetric(data, context) {
    const metricData = NavigationMetric.getMetricComputationInput(data);
    return LanternSpeedIndex.request(metricData, context);
  }

  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.Metric>}
   */
  static async computeObservedMetric(data, context) {
    const speedline = await Speedline.request(data.trace, context);
    const timing = Math.round(speedline.speedIndex);
    const timestamp = (timing + speedline.beginning) * 1000;
    return Promise.resolve({timing, timestamp});
  }
}

const SpeedIndexComputed = makeComputedArtifact(
  SpeedIndex,
  ['devtoolsLog', 'gatherContext', 'settings', 'simulator', 'trace', 'URL', 'SourceMaps', 'HostDPR']
);
export {SpeedIndexComputed as SpeedIndex};
