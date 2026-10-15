/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Result from './engineResult.js';

declare namespace FlowResult {
  interface Step {
    /** Web Audit+ report for this flow step. */
    engineResult: Result;
    /** Display name of this flow step. */
    name: string;
  }
}

/**
 * The full output of a Web Audit+ flow. Includes a series of Web Audit+ runs.
 */
interface FlowResult {
  /** Ordered list of flow steps, each corresponding to a navigation, timespan, or snapshot. */
  steps: FlowResult.Step[];
  /** Display name of this user flow. */
  name: string;
}

export default FlowResult;
