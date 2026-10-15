
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import ManualAudit from '../../manual/manual-audit.js';

/**
 * @fileoverview Manual A11y audit for focusable controls.
 */

class FocusableControls extends ManualAudit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return Object.assign({
      id: 'focusable-controls',
      description: 'Custom interactive controls are keyboard focusable and display a focus indicator.',
      title: 'Interactive controls are keyboard focusable',
    }, super.partialMeta);
  }
}

export default FocusableControls;
