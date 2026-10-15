/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Lantern from '../../lib/lantern/lantern.js';
import {makeComputedArtifact} from '../computed-artifact.js';
import {getComputationDataParams, lanternErrorAdapter} from './lantern-metric.js';
import {LanternFirstContentfulPaint} from './lantern-first-contentful-paint.js';

class LanternMaxPotentialFID extends Lantern.Metrics.MaxPotentialFID {
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
    const fcpResult = await LanternFirstContentfulPaint.request(data, context);
    return this.computeMetricWithGraphs(data, context, {fcpResult});
  }
}

const LanternMaxPotentialFIDComputed = makeComputedArtifact(
  LanternMaxPotentialFID,
  ['devtoolsLog', 'gatherContext', 'settings', 'simulator', 'trace', 'URL', 'SourceMaps', 'HostDPR']
);
export {LanternMaxPotentialFIDComputed as LanternMaxPotentialFID};
