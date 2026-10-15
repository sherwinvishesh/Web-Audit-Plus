/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 * Message files by locale. The engine ships no translations: every message carries its English
 * default (`IcuMessage.formattedDefault`), so this is empty. Locale messages can still be added
 * at run time through `format.registerLocaleData()`.
 */

/** @typedef {import('../../types/result/settings').Locale} Locale */
/** @typedef {Record<string, {message: string}>} LocaleMessages */

/** @type {Partial<Record<Locale, LocaleMessages>>} */
const locales = {};

export {locales};
