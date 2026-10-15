/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Engine from '../../types/engine.js';

/* eslint-disable no-unused-vars */

/**
 * Base class for all gatherers.
 *
 * @implements {Engine.Gatherer.GathererInstance}
 */
class BaseGatherer {
  /** @type {Engine.Gatherer.GathererMeta} */
  meta = {supportedModes: []};

  /**
   * Method to start observing a page for an arbitrary period of time.
   * @param {Engine.Gatherer.Context} passContext
   * @return {Promise<void>|void}
   */
  startInstrumentation(passContext) { }

  /**
   * Method to start observing a page when the measurements are very sensitive and
   * should observe as little engine-induced work as possible.
   * @param {Engine.Gatherer.Context} passContext
   * @return {Promise<void>|void}
   */
  startSensitiveInstrumentation(passContext) { }

  /**
   * Method to stop observing a page when the measurements are very sensitive and
   * should observe as little engine-induced work as possible.
   *
   * @param {Engine.Gatherer.Context} passContext
   * @return {Promise<void>|void}
   */
  stopSensitiveInstrumentation(passContext) { }

  /**
   * Method to end observing a page after an arbitrary period of time.
   * @param {Engine.Gatherer.Context} passContext
   * @return {Promise<void>|void}
   */
  stopInstrumentation(passContext) { }

  /**
   * Method to gather results about a page.
   * @param {Engine.Gatherer.Context} passContext
   * @return {Engine.Gatherer.PhaseResult}
   */
  getArtifact(passContext) { }
}

export default BaseGatherer;
