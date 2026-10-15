/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import log from '../../logger/index.js';
import {isEqual} from 'lodash-es';

import {
  getBrowserVersion, getBenchmarkIndex, getEnvironmentWarnings,
  getDevicePixelRatio,
} from './driver/environment.js';

/**
 * @param {Engine.Config.ResolvedConfig} resolvedConfig
 * @param {Engine.Gatherer.Driver} driver
 * @param {{gatherMode: Engine.Gatherer.GatherMode}} context
 * @return {Promise<Engine.BaseArtifacts>}
 */
async function getBaseArtifacts(resolvedConfig, driver, context) {
  const BenchmarkIndex = await getBenchmarkIndex(driver.executionContext);
  const {userAgent, product} = await getBrowserVersion(driver.defaultSession);
  const HostDPR = await getDevicePixelRatio(driver.executionContext);

  return {
    // Meta artifacts.
    fetchTime: new Date().toJSON(),
    Timing: [],
    EngineRunWarnings: [],
    settings: resolvedConfig.settings,
    // Environment artifacts that can always be computed.
    BenchmarkIndex,
    HostDPR,
    HostUserAgent: userAgent,
    HostFormFactor: userAgent.includes('Android') || userAgent.includes('Mobile') ?
      'mobile' : 'desktop',
    HostProduct: product,
    // Contextual artifacts whose collection changes based on gather mode.
    URL: {
      finalDisplayedUrl: '',
    },
    PageLoadError: null,
    GatherContext: context,
  };
}

/**
 * Deduplicates identical warnings.
 * @param {Array<string | Engine.IcuMessage>} warnings
 * @return {Array<string | Engine.IcuMessage>}
 */
function deduplicateWarnings(warnings) {
  /** @type {Array<string | Engine.IcuMessage>} */
  const unique = [];

  for (const warning of warnings) {
    if (unique.some(existing => isEqual(warning, existing))) continue;
    unique.push(warning);
  }

  return unique;
}

/**
 * @param {Engine.BaseArtifacts} baseArtifacts
 * @param {Partial<Engine.GathererArtifacts>} gathererArtifacts
 * @return {Engine.Artifacts}
 */
function finalizeArtifacts(baseArtifacts, gathererArtifacts) {
  baseArtifacts.EngineRunWarnings.push(
    ...getEnvironmentWarnings({settings: baseArtifacts.settings, baseArtifacts})
  );

  // Cast to remove the partial from gathererArtifacts.
  const artifacts = /** @type {Engine.Artifacts} */ ({...baseArtifacts, ...gathererArtifacts});

  // Set the post-run meta artifacts.
  artifacts.Timing = log.getTimeEntries();
  artifacts.EngineRunWarnings = deduplicateWarnings(baseArtifacts.EngineRunWarnings);

  if (artifacts.PageLoadError && !artifacts.URL.finalDisplayedUrl) {
    artifacts.URL.finalDisplayedUrl = artifacts.URL.requestedUrl || '';
  }

  // Check that the runner remembered to mutate the special-case URL artifact.
  if (!artifacts.URL.finalDisplayedUrl) throw new Error('Runner did not set finalDisplayedUrl');

  return artifacts;
}

export {
  getBaseArtifacts,
  finalizeArtifacts,
};
