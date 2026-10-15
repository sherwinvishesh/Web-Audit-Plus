
/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import ManualAudit from '../../manual/manual-audit.js';

/**
 * @fileoverview Manual A11y audit for interactive element affordance.
 */

class InteractiveElementAffordance extends ManualAudit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return Object.assign({
      id: 'interactive-element-affordance',
      description: 'Interactive elements, such as links and buttons, should indicate their state and be distinguishable from non-interactive elements.',
      title: 'Interactive elements indicate their purpose and state',
    }, super.partialMeta);
  }
}

export default InteractiveElementAffordance;
