/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import ManualAudit from '../../manual/manual-audit.js';
import * as i18n from '../../../lib/i18n/i18n.js';

const UIStrings = {
  /** Description of a Web Audit+ audit that provides detail on the structured data in a page. "Structured data" is a standardized data format on a page that helps a search engine categorize and understand its contents. This description is displayed after a user expands the section to see more. No character length limits. */
  description: 'Run the [Structured Data Testing Tool](https://developers.google.com/search/docs/appearance/structured-data/) to validate structured data.',
  /** Title of a Web Audit+ audit that prompts users to manually check their page for valid structured data. "Structured data" is a standardized data format on a page that helps a search engine categorize and understand its contents. */
  title: 'Structured data is valid',
};

const str_ = i18n.createIcuMessageFn(import.meta.url, UIStrings);

/**
 * @fileoverview Manual SEO audit to check if structured data on page is valid.
 */

class StructuredData extends ManualAudit {
  /**
   * @return {Engine.Audit.Meta}
   */
  static get meta() {
    return Object.assign({
      id: 'structured-data',
      description: str_(UIStrings.description),
      title: str_(UIStrings.title),
    }, super.partialMeta);
  }
}

export default StructuredData;
export {UIStrings};
