/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Engine from '../../types/engine.js';
import * as constants from './constants.js';

/** @type {Engine.Config} */
const config = {
  extends: 'engine:default',
  settings: {
    formFactor: 'desktop',
    throttling: constants.throttling.desktopDense4G,
    screenEmulation: constants.screenEmulationMetrics.desktop,
    emulatedUserAgent: constants.userAgents.desktop,
  },
};

export default config;
