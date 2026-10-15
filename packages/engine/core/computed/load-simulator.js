/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {makeComputedArtifact} from './computed-artifact.js';
import * as Lantern from '../lib/lantern/lantern.js';
import {NetworkAnalysis} from './network-analysis.js';

class LoadSimulator {
  /**
   * @param {{devtoolsLog: Engine.DevtoolsLog, settings: Engine.Audit.Context['settings']}} data
   * @param {Engine.Artifacts.ComputedContext} context
   * @return {Promise<Engine.Gatherer.Simulation.Simulator>}
   */
  static async compute_(data, context) {
    const networkAnalysis = await NetworkAnalysis.request(data.devtoolsLog, context);
    return Lantern.Simulation.Simulator.createSimulator({...data.settings, networkAnalysis});
  }

  /**
   * @param {Engine.Artifacts.NetworkAnalysis} networkAnalysis
   * @return {Engine.PrecomputedLanternData}
   */
  static convertAnalysisToSaveableLanternData(networkAnalysis) {
    /** @type {Engine.PrecomputedLanternData} */
    const lanternData = {additionalRttByOrigin: {}, serverResponseTimeByOrigin: {}};
    for (const [origin, value] of networkAnalysis.additionalRttByOrigin.entries()) {
      if (origin.startsWith('http')) lanternData.additionalRttByOrigin[origin] = value;
    }

    for (const [origin, value] of networkAnalysis.serverResponseTimeByOrigin.entries()) {
      if (origin.startsWith('http')) lanternData.serverResponseTimeByOrigin[origin] = value;
    }

    return lanternData;
  }
}

const LoadSimulatorComputed = makeComputedArtifact(LoadSimulator, ['devtoolsLog', 'settings']);
export {LoadSimulatorComputed as LoadSimulator};
