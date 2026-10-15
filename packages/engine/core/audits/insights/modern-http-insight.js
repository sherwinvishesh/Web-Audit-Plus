/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {UIStrings} from '@paulirish/trace_engine/models/trace/insights/ModernHTTP.js';

import {Audit} from '../audit.js';
import * as i18n from '../../lib/i18n/i18n.js';
import {adaptInsightToAuditProduct} from './insight-audit.js';

// eslint-disable-next-line max-len
const str_ = i18n.createIcuMessageFn('node_modules/@paulirish/trace_engine/models/trace/insights/ModernHTTP.js', UIStrings);

class ModernHTTPInsight extends Audit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'modern-http-insight',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.title),
      description: str_(UIStrings.description),
      guidanceLevel: 3,
      requiredArtifacts: ['Trace', 'SourceMaps', 'HostDPR'],
    };
  }

  /**
   * @param {Engine.Artifacts} artifacts
   * @param {Engine.Audit.Context} context
   * @return {Promise<Engine.Audit.Product>}
   */
  static async audit(artifacts, context) {
    return adaptInsightToAuditProduct(artifacts, context, 'ModernHTTP', (insight) => {
      /** @type {Engine.Audit.Details.Table['headings']} */
      const headings = [
        {key: 'url', valueType: 'url', label: str_(i18n.UIStrings.columnURL)},
        {key: 'protocol', valueType: 'text', label: str_(UIStrings.protocol)},
      ];
      /** @type {Engine.Audit.Details.Table['items']} */
      const items =
        insight.http1Requests.map(r => ({url: r.args.data.url, protocol: r.args.data.protocol}));
      return Audit.makeTableDetails(headings, items);
    });
  }
}

export default ModernHTTPInsight;
