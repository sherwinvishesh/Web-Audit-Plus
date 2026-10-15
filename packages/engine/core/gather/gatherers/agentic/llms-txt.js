/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import log from '../../../../logger/index.js';

import BaseGatherer from '../../base-gatherer.js';

class LlmsTxt extends BaseGatherer {
  /** @type {Engine.Gatherer.GathererMeta} */
  meta = {
    supportedModes: ['snapshot', 'navigation'],
  };

  /**
   * @param {Engine.Gatherer.Context} passContext
   * @return {Promise<Engine.Artifacts['LlmsTxt']>}
   */
  async getArtifact(passContext) {
    const {finalDisplayedUrl} = passContext.baseArtifacts.URL;
    const llmUrl = new URL('/llms.txt', finalDisplayedUrl).href;
    return passContext.driver.fetcher.fetchResource(llmUrl)
      .catch(err => {
        log.error('LlmsTxt', err);
        return {status: null, content: null, errorMessage: err.message};
      });
  }
}

export default LlmsTxt;
