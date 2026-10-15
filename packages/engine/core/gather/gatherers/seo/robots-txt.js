/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import log from '../../../../logger/index.js';

import BaseGatherer from '../../base-gatherer.js';

class RobotsTxt extends BaseGatherer {
  static symbol = Symbol('RobotsTxt');

  /** @type {Engine.Gatherer.GathererMeta} */
  meta = {
    symbol: RobotsTxt.symbol,
    supportedModes: ['snapshot', 'navigation'],
  };

  /**
   * @param {Engine.Gatherer.Context} passContext
   * @return {Promise<Engine.Artifacts['RobotsTxt']>}
   */
  async getArtifact(passContext) {
    const {finalDisplayedUrl} = passContext.baseArtifacts.URL;
    const robotsUrl = new URL('/robots.txt', finalDisplayedUrl).href;
    return passContext.driver.fetcher.fetchResource(robotsUrl)
      .catch(err => {
        log.error('RobotsTxt', err);
        return {status: null, content: null, errorMessage: err.message};
      });
  }
}

export default RobotsTxt;
