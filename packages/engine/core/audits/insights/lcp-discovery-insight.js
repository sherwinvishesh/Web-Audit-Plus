/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {UIStrings} from '@paulirish/trace_engine/models/trace/insights/LCPDiscovery.js';

import {Audit} from '../audit.js';
import * as i18n from '../../lib/i18n/i18n.js';
import {adaptInsightToAuditProduct, makeNodeItemForNodeId} from './insight-audit.js';

// eslint-disable-next-line max-len
const str_ = i18n.createIcuMessageFn('node_modules/@paulirish/trace_engine/models/trace/insights/LCPDiscovery.js', UIStrings);

class LCPDiscoveryInsight extends Audit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'lcp-discovery-insight',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.title),
      description: str_(UIStrings.description),
      guidanceLevel: 3,
      requiredArtifacts: ['Trace', 'TraceElements', 'SourceMaps', 'HostDPR'],
      replacesAudits: ['prioritize-lcp-image', 'lcp-lazy-loaded'],
    };
  }

  /**
   * @param {Engine.Artifacts} artifacts
   * @param {Engine.Audit.Context} context
   * @return {Promise<Engine.Audit.Product>}
   */
  static async audit(artifacts, context) {
    return adaptInsightToAuditProduct(artifacts, context, 'LCPDiscovery', (insight) => {
      if (!insight.checklist) {
        return;
      }

      return Audit.makeListDetails([
        Audit.makeChecklistDetails(insight.checklist),
        makeNodeItemForNodeId(artifacts.TraceElements, insight.lcpEvent?.args.data?.nodeId),
      ].filter(d => !!d));
    });
  }
}

export default LCPDiscoveryInsight;
