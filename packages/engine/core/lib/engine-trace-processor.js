/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {EngineError} from '../lib/engine-error.js';
import {TraceProcessor} from '../lib/tracehouse/trace-processor.js';

// TraceProcessor throws generic errors, but we'd like our special localized and code-specific EngineError
// objects to be thrown instead.
class EngineTraceProcessor extends TraceProcessor {
  /**
   * @return {Error}
   */
  static createNoNavstartError() {
    return new EngineError(EngineError.errors.NO_NAVSTART);
  }

  /**
   * This isn't currently used, but will be when the time origin of trace processing is changed.
   * @see {TraceProcessor.computeTimeOrigin}
   * @return {Error}
   */
  static createNoResourceSendRequestError() {
    return new EngineError(EngineError.errors.NO_RESOURCE_REQUEST);
  }

  /**
   * @return {Error}
   */
  static createNoTracingStartedError() {
    return new EngineError(EngineError.errors.NO_TRACING_STARTED);
  }

  /**
   * @return {Error}
   */
  static createNoFirstContentfulPaintError() {
    return new EngineError(EngineError.errors.NO_FCP);
  }
}

export default EngineTraceProcessor;
