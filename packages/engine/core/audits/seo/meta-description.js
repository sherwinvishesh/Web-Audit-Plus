/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Audit} from '../audit.js';
import * as i18n from '../../lib/i18n/i18n.js';

const UIStrings = {
  /** Title of a Web Audit+ audit that provides detail on the web page's document meta description. This descriptive title is shown when the document has a meta description. "meta" should be left untranslated because it refers to an HTML element. */
  title: 'Document has a meta description',
  /** Title of a Web Audit+ audit that provides detail on the web page's document meta description. This descriptive title is shown when the document does not have a meta description. "meta" should be left untranslated because it refers to an HTML element. */
  failureTitle: 'Document does not have a meta description',
  /** Description of a Web Audit+ audit that tells the user *why* they need to have meta descriptions on their page. This is displayed after a user expands the section to see more. No character length limits. */
  description: 'Meta descriptions may be included in search results to concisely summarize ' +
      'page content.',
  /** Explanatory message stating that there was a failure in an audit caused by the page's meta description text being empty. */
  explanation: 'Description text is empty.',
};

const str_ = i18n.createIcuMessageFn(import.meta.url, UIStrings);

class Description extends Audit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'meta-description',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['MetaElements'],
    };
  }

  /**
   * @param {Engine.Artifacts} artifacts
   * @return {Engine.Audit.Product}
   */
  static audit(artifacts) {
    const metaDescription = artifacts.MetaElements.find(meta => meta.name === 'description');
    if (!metaDescription) {
      return {
        score: 0,
      };
    }

    const description = metaDescription.content || '';
    if (description.trim().length === 0) {
      return {
        score: 0,
        explanation: str_(UIStrings.explanation),
      };
    }

    return {
      score: 1,
    };
  }
}

export default Description;
export {UIStrings};
