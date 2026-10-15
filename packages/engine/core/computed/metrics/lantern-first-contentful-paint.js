/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Lantern from '../../lib/lantern/lantern.js';
import {makeComputedArtifact} from '../computed-artifact.js';
import {getComputationDataParams, lanternErrorAdapter} from './lantern-metric.js';

class LanternFirstContentfulPaint extends Lantern.Metrics.FirstContentfulPaint {
  /**
   * @param {Engine.Artifacts.MetricComputationDataInput} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @param {Omit<Lantern.Metrics.Extras, 'optimistic'>=} extras
   * @return {Promise<Engine.Artifacts.LanternMetric>}
   */
  static async computeMetricWithGraphs(data, context, extras) {
    const params = await getComputationDataParams(data, context);
    return Promise.resolve(this.compute(params, extras)).catch(lanternErrorAdapter);
  }

  /**
   * @param {Engine.Artifacts.MetricComputationDataInput} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.LanternMetric>}
   */
  static async compute_(data, context) {
    return this.computeMetricWithGraphs(data, context);
  }
}

const LanternFirstContentfulPaintComputed = makeComputedArtifact(
  LanternFirstContentfulPaint,
  ['devtoolsLog', 'gatherContext', 'settings', 'simulator', 'trace', 'URL', 'SourceMaps', 'HostDPR']
);
export {LanternFirstContentfulPaintComputed as LanternFirstContentfulPaint};
