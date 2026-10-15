/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {ByteEfficiencyAudit} from './byte-efficiency-audit.js';
import {UnusedCSS} from '../../computed/unused-css.js';
import * as i18n from '../../lib/i18n/i18n.js';

const UIStrings = {
  /** Imperative title of a Web Audit+ audit that tells the user to reduce content from their CSS that isn’t needed immediately and instead load that content at a later time. This is displayed in a list of audit titles that Web Audit+ generates. */
  title: 'Reduce unused CSS',
  /** Description of a Web Audit+ audit that tells the user *why* they should defer loading any content in CSS that isn’t needed at page load. This is displayed after a user expands the section to see more. No word length limits. */
  description: 'Reduce unused rules from stylesheets and defer CSS not used for ' +
    'above-the-fold content to decrease bytes consumed by network activity.',
};

const str_ = i18n.createIcuMessageFn(import.meta.url, UIStrings);

// Allow 10KiB of unused CSS to permit `:hover` and other styles not used on a non-interactive load.
const IGNORE_THRESHOLD_IN_BYTES = 10 * 1024;

class UnusedCSSRules extends ByteEfficiencyAudit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'unused-css-rules',
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      scoreDisplayMode: ByteEfficiencyAudit.SCORING_MODES.METRIC_SAVINGS,
      guidanceLevel: 1,
      // eslint-disable-next-line max-len
      requiredArtifacts: ['Stylesheets', 'CSSUsage', 'URL', 'DevtoolsLog', 'Trace', 'GatherContext', 'SourceMaps', 'HostDPR'],
    };
  }

  /**
   * @param {Engine.Artifacts} artifacts
   * @param {Engine.Artifacts.NetworkRequest[]} _
   * @param {Engine.Audit.Context} context
   * @return {Promise<import('./byte-efficiency-audit.js').ByteEfficiencyProduct>}
   */
  static async audit_(artifacts, _, context) {
    const unusedCssItems = await UnusedCSS.request({
      Stylesheets: artifacts.Stylesheets,
      CSSUsage: artifacts.CSSUsage,
      devtoolsLog: artifacts.DevtoolsLog,
    }, context);
    const items = unusedCssItems
      .filter(sheet => sheet && sheet.wastedBytes > IGNORE_THRESHOLD_IN_BYTES);

    /** @type {Engine.Audit.Details.Opportunity['headings']} */
    const headings = [
      {key: 'url', valueType: 'url', label: str_(i18n.UIStrings.columnURL)},
      {key: 'totalBytes', valueType: 'bytes', label: str_(i18n.UIStrings.columnTransferSize)},
      {key: 'wastedBytes', valueType: 'bytes', label: str_(i18n.UIStrings.columnWastedBytes)},
    ];

    return {
      items,
      headings,
    };
  }
}

export default UnusedCSSRules;
export {UIStrings};
