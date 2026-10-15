/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Error reporting hooks. Web Audit+ sends no telemetry, so every hook is a no-op.
 * The engine still calls them where an error would be worth reporting.
 */

const noop = () => { };

const sentryDelegate = {
  /** @type {(message: string, level?: string) => void} */
  captureMessage: noop,
  /** @type {(breadcrumb: {message?: string, category?: string, data?: unknown}) => void} */
  captureBreadcrumb: noop,
  /** @type {() => any} */
  getContext: noop,
  /** @type {(error: Error, options: {level?: string, tags?: {[key: string]: any}, extra?: {[key: string]: any}}) => Promise<void>} */
  captureException: async () => { },
};

export const Sentry = sentryDelegate;
