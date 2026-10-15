/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';

import pkg from '../package.json' with {type: 'json'};
import {getModuleDirectory} from './esm-utils.js';

const ENGINE_ROOT = path.dirname(getModuleDirectory(import.meta));
const engineVersion = pkg.version;

export {
  ENGINE_ROOT,
  engineVersion,
};
