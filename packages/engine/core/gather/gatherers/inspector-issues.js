/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Capture IssueAdded events
 */


import BaseGatherer from '../base-gatherer.js';
import {NetworkRecords} from '../../computed/network-records.js';
import DevtoolsLog from './devtools-log.js';

class InspectorIssues extends BaseGatherer {
  /** @type {Engine.Gatherer.GathererMeta<'DevtoolsLog'>} */
  meta = {
    supportedModes: ['timespan', 'navigation'],
    dependencies: {DevtoolsLog: DevtoolsLog.symbol},
  };

  constructor() {
    super();
    /** @type {Array<Engine.Crdp.Audits.InspectorIssue>} */
    this._issues = [];
    this._onIssueAdded = this.onIssueAdded.bind(this);
  }

  /**
   * @param {Engine.Crdp.Audits.IssueAddedEvent} entry
   */
  onIssueAdded(entry) {
    this._issues.push(entry.issue);
  }

  /**
   * @param {Engine.Gatherer.Context} context
   */
  async startInstrumentation(context) {
    const session = context.driver.defaultSession;
    session.on('Audits.issueAdded', this._onIssueAdded);
    await session.sendCommand('Audits.enable');
  }

  /**
   * @param {Engine.Gatherer.Context} context
   */
  async stopInstrumentation(context) {
    const session = context.driver.defaultSession;
    session.off('Audits.issueAdded', this._onIssueAdded);
    await session.sendCommand('Audits.disable');
  }

  /**
   * @param {Engine.Gatherer.Context<'DevtoolsLog'>} context
   * @return {Promise<Engine.Artifacts.InspectorIssues>}
   */
  async getArtifact(context) {
    const devtoolsLog = context.dependencies.DevtoolsLog;
    const networkRecords = await NetworkRecords.request(devtoolsLog, context);

    /** @type {Engine.Artifacts.InspectorIssues} */
    const artifact = {};

    for (const issue of this._issues) {
      const detailsKey = /** @type {keyof Engine.Crdp.Audits.InspectorIssueDetails} */(
        Object.keys(issue.details)[0]);
      const details = issue.details[detailsKey];
      if (!details) {
        continue;
      }

      const artifactKey =
        /** @type {Engine.Artifacts.InspectorIssuesKeyToArtifactKey<typeof detailsKey>} */(
          detailsKey.replace('Details', ''));

      // Duplicate issues can occur for the same request; only use the one with a matching networkRequest.
      const requestId = 'request' in details && details.request && details.request.requestId;
      if (requestId) {
        if (networkRecords.find(req => req.requestId === requestId)) {
          if (!artifact[artifactKey]) {
            artifact[artifactKey] = [];
          }

          // @ts-expect-error - detail types are not all compatible
          artifact[artifactKey].push(details);
        }
      } else {
        if (!artifact[artifactKey]) {
          artifact[artifactKey] = [];
        }

        // @ts-expect-error - detail types are not all compatible
        artifact[artifactKey].push(details);
      }
    }

    return artifact;
  }
}

export default InspectorIssues;
