/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Audit} from '../audit.js';
import * as i18n from '../../lib/i18n/i18n.js';
import {Interactive} from '../../computed/metrics/interactive.js';

const UIStrings = {
  /** Description of the Time to Interactive (TTI) metric, which evaluates when a page has completed its primary network activity and main thread work. This is displayed within a tooltip when the user hovers on the metric name to see more. No character length limits. */
  description: 'Time to Interactive is the amount of time it takes for the page to become fully ' +
    'interactive.',
};

const str_ = i18n.createIcuMessageFn(import.meta.url, UIStrings);

/**
 * @fileoverview This audit identifies the time the page is "consistently interactive".
 * Looks for the first period of at least 5 seconds after FCP where both CPU and network were quiet,
 * and returns the timestamp of the beginning of the CPU quiet period.
 * @see https://docs.google.com/document/d/1GGiI9-7KeY3TPqS3YT271upUVimo-XiL5mwWorDUD4c/edit#
 */
class InteractiveMetric extends Audit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'interactive',
      title: str_(i18n.UIStrings.interactiveMetric),
      description: str_(UIStrings.description),
      scoreDisplayMode: Audit.SCORING_MODES.NUMERIC,
      supportedModes: ['navigation'],
      requiredArtifacts: ['Trace', 'DevtoolsLog', 'GatherContext', 'URL', 'SourceMaps', 'HostDPR'],
    };
  }

  /**
   * @return {{mobile: {scoring: Engine.Audit.ScoreOptions}, desktop: {scoring: Engine.Audit.ScoreOptions}}}
   */
  static get defaultOptions() {
    return {
      mobile: {
        // 25th and 5th percentiles HTTPArchive -> median and PODR, then p10 derived from them.
        // HTTP Archive, 2018-04-01 mobile crawl
        // see https://www.desmos.com/calculator/o98tbeyt1t
        scoring: {
          p10: 3785,
          median: 7300,
        },
      },
      desktop: {
        // SELECT QUANTILES(fullyLoaded, 21) FROM [httparchive:summary_pages.2018_12_15_desktop] LIMIT 1000
        scoring: {
          p10: 2468,
          median: 4500,
        },
      },
    };
  }

  /**
   * @param {Engine.Artifacts} artifacts
   * @param {Engine.Audit.Context} context
   * @return {Promise<Engine.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const trace = artifacts.Trace;
    const devtoolsLog = artifacts.DevtoolsLog;
    const gatherContext = artifacts.GatherContext;
    const metricComputationData = {
      trace, devtoolsLog, gatherContext,
      settings: context.settings, URL: artifacts.URL,
      SourceMaps: artifacts.SourceMaps, simulator: null,
      HostDPR: artifacts.HostDPR,
    };
    const metricResult = await Interactive.request(metricComputationData, context);
    const timeInMs = metricResult.timing;
    const options = context.options[context.settings.formFactor];


    return {
      score: Audit.computeLogNormalScore(
        options.scoring,
        timeInMs
      ),
      numericValue: timeInMs,
      numericUnit: 'millisecond',
      displayValue: str_(i18n.UIStrings.seconds, {timeInMs}),
    };
  }
}

export default InteractiveMetric;
export {UIStrings};
