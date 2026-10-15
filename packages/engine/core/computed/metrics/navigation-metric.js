/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileOverview Enforces that a metric can only be computed on navigations.
 */

import Metric from './metric.js';

class NavigationMetric extends Metric {
  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.LanternMetric|Engine.Artifacts.Metric>}
   */
  static computeSimulatedMetric(data, context) { // eslint-disable-line no-unused-vars
    throw new Error('Unimplemented');
  }

  /**
   * @param {Engine.Artifacts.NavigationMetricComputationData} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.Metric>}
   */
  static computeObservedMetric(data, context) { // eslint-disable-line no-unused-vars
    throw new Error('Unimplemented');
  }

  /**
   * @param {Engine.Artifacts.MetricComputationDataInput} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Artifacts.LanternMetric|Engine.Artifacts.Metric>}
   */
  static async compute_(data, context) {
    if (data.gatherContext.gatherMode !== 'navigation') {
      throw new Error(`${this.name} can only be computed on navigations`);
    }

    return super.compute_(data, context);
  }
}

export {NavigationMetric};
