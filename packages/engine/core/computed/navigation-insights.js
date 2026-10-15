/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {makeComputedArtifact} from './computed-artifact.js';
import {ProcessedTrace} from './processed-trace.js';
import {TraceEngineResult} from './trace-engine-result.js';

/**
 * @fileoverview Gets insights from the shared trace engine for the navigation audited by Web Audit+.
 * Only usable in navigation mode.
 */
class NavigationInsights {
  /**
    * @param {{trace: Engine.Trace, settings: Engine.Audit.Context['settings'], SourceMaps: Engine.Artifacts['SourceMaps'], HostDPR: Engine.Artifacts['HostDPR']}} data
    * @param {Engine.Artifacts.ComputedContext} context
   */
  static async compute_(data, context) {
    const {trace, settings, SourceMaps, HostDPR} = data;
    const processedTrace = await ProcessedTrace.request(trace, context);
    const traceEngineResult =
      await TraceEngineResult.request({trace, settings, SourceMaps, HostDPR}, context);

    const navigationId = processedTrace.timeOriginEvt.args.data?.navigationId;
    if (!navigationId) throw new Error('No navigationId found');

    const navInsights = [...traceEngineResult.insights.values()]
        .find(insightSet => insightSet.navigation?.args.data?.navigationId === navigationId);
    if (!navInsights) throw new Error('No navigations insights found');

    return navInsights;
  }
}

const NavigationInsightsComputed =
  makeComputedArtifact(NavigationInsights, ['trace', 'settings', 'SourceMaps', 'HostDPR']);
export {NavigationInsightsComputed as NavigationInsights};
