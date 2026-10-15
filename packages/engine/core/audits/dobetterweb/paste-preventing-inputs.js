/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Audit} from '../audit.js';
import * as i18n from '../../lib/i18n/i18n.js';

const UIStrings = {
  /** Title of a Web Audit+ audit that provides detail on the ability to paste into input fields. This descriptive title is shown to users when the page allows pasting of content into input fields. */
  title: 'Allows users to paste into input fields',
  /** Title of a Web Audit+ audit that provides detail on the ability to paste into input fields. This descriptive title is shown to users when the page does not allow pasting of content into input fields. */
  failureTitle: 'Prevents users from pasting into input fields',
  /** Description of a Web Audit+ audit that tells the user why they should allow pasting of content into input fields. This is displayed after a user expands the section to see more. No character length limits. */
  description: 'Preventing input pasting is a bad practice for the UX, ' +
      'and weakens security by blocking password managers.',
};

const str_ = i18n.createIcuMessageFn(import.meta.url, UIStrings);

class PastePreventingInputsAudit extends Audit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'paste-preventing-inputs',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['Inputs'],
    };
  }

  /**
   * @param {Engine.Artifacts} artifacts
   * @return {Engine.Audit.Product}
   */
  static audit(artifacts) {
    const inputsWithPreventsPaste = artifacts.Inputs.inputs.filter(input => input.preventsPaste);

    /** @type {Engine.Audit.Details.Table['items']} */
    const items = [];

    inputsWithPreventsPaste.forEach(input => {
      items.push({
        node: Audit.makeNodeItem(input.node),
        type: input.type,
      });
    });

    /** @type {Engine.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'node', valueType: 'node', label: str_(i18n.UIStrings.columnFailingElem)},
    ];

    return {
      score: Number(inputsWithPreventsPaste.length === 0),
      details: Audit.makeTableDetails(headings, items),
    };
  }
}

export default PastePreventingInputsAudit;
export {UIStrings};
