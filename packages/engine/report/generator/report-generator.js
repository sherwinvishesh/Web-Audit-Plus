/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */


import {reportAssets} from './report-assets.js';

/** @typedef {import('../../types/result/result').default} EngineResult */
/** @typedef {import('../../types/result/flow-result').default} FlowResult */

class ReportGenerator {
  /**
   * Replaces all the specified strings in source without serial replacements.
   * @param {string} source
   * @param {!Array<{search: string, replacement: string}>} replacements
   * @return {string}
   */
  static replaceStrings(source, replacements) {
    if (replacements.length === 0) {
      return source;
    }

    const firstReplacement = replacements[0];
    const nextReplacements = replacements.slice(1);
    return source
        .split(firstReplacement.search)
        .map(part => ReportGenerator.replaceStrings(part, nextReplacements))
        .join(firstReplacement.replacement);
  }

  /**
   * @param {unknown} object
   * @return {string}
   */
  static sanitizeJson(object) {
    return JSON.stringify(object)
    .replace(/</g, '\\u003c') // replaces opening script tags
    .replace(/\u2028/g, '\\u2028') // replaces line separators ()
    .replace(/\u2029/g, '\\u2029'); // replaces paragraph separators
  }

  /**
   * Returns the standalone report HTML as a string with the report JSON and renderer JS inlined.
   * @param {EngineResult} engineResult
   * @return {string}
   */
  static generateReportHtml(engineResult) {
    const sanitizedJson = ReportGenerator.sanitizeJson(engineResult);
    // terser does its own sanitization, but keep this basic replace for when
    // we want to generate a report without minification.
    const sanitizedJavascript = reportAssets.REPORT_JAVASCRIPT.replace(/<\//g, '\\u003c/');

    return ReportGenerator.replaceStrings(reportAssets.REPORT_TEMPLATE, [
      {search: '%%REPORT_JSON%%', replacement: sanitizedJson},
      {search: '%%REPORT_JAVASCRIPT%%', replacement: sanitizedJavascript},
    ]);
  }

  /**
   * Returns the standalone flow report HTML as a string with the report JSON and renderer JS inlined.
   * @param {FlowResult} flow
   * @return {string}
   */
  static generateFlowReportHtml(flow) {
    const sanitizedJson = ReportGenerator.sanitizeJson(flow);
    // terser does its own sanitization, but keep this basic replace for when
    // we want to generate a report without minification.
    const sanitizedJavascript = reportAssets.FLOW_REPORT_JAVASCRIPT.replace(/<\//g, '\\u003c/');
    return ReportGenerator.replaceStrings(reportAssets.FLOW_REPORT_TEMPLATE, [

      {search: '%%REPORT_FLOW_JSON%%', replacement: sanitizedJson},
      {search: '%%REPORT_FLOW_JAVASCRIPT%%', replacement: sanitizedJavascript},
      {search: '/*%%REPORT_FLOW_CSS%%*/', replacement: reportAssets.FLOW_REPORT_CSS},

    ]);
  }

  /**
   * Converts the results to a CSV formatted string
   * Each row describes the result of 1 audit with
   *  - the name of the category the audit belongs to
   *  - the name of the audit
   *  - a description of the audit
   *  - the score type that is used for the audit
   *  - the score value of the audit
   *
   * @param {EngineResult} engineResult
   * @return {string}
   */
  static generateReportCSV(engineResult) {
    // To keep things "official" we follow the CSV specification (RFC4180)
    // The document describes how to deal with escaping commas and quotes etc.
    const CRLF = '\r\n';
    const separator = ',';
    /** @param {string} value @return {string} */
    const escape = value => `"${value.replace(/"/g, '""')}"`;
    /** @param {ReadonlyArray<string | number | null>} row @return {string[]} */
    const rowFormatter = row => row.map(value => {
      if (value === null) return 'null';
      return value.toString();
    }).map(escape);

    const rows = [];
    const topLevelKeys = /** @type {const} */(
      ['requestedUrl', 'finalDisplayedUrl', 'fetchTime', 'gatherMode']);

    // First we have metadata about the result.
    rows.push(rowFormatter(topLevelKeys));
    rows.push(rowFormatter(topLevelKeys.map(key => engineResult[key] ?? null)));

    // Some spacing.
    rows.push([]);

    // Categories.
    rows.push(['category', 'score']);
    for (const category of Object.values(engineResult.categories)) {
      rows.push(rowFormatter([
        category.id,
        category.score,
      ]));
    }

    rows.push([]);

    // Audits.
    rows.push(['category', 'audit', 'score', 'displayValue', 'description']);
    for (const category of Object.values(engineResult.categories)) {
      for (const auditRef of category.auditRefs) {
        const audit = engineResult.audits[auditRef.id];
        if (!audit) continue;

        rows.push(rowFormatter([
          category.id,
          auditRef.id,
          audit.score,
          audit.displayValue || '',
          audit.description,
        ]));
      }
    }

    return rows
      .map(row => row.join(separator))
      .join(CRLF);
  }

  /**
   * @param {EngineResult|FlowResult} result
   * @return {result is FlowResult}
   */
  static isFlowResult(result) {
    return 'steps' in result;
  }

  /**
   * Creates the results output in a format based on the `mode`.
   * @param {EngineResult|FlowResult} result
   * @param {EngineResult['configSettings']['output']} outputModes
   * @return {string|string[]}
   */
  static generateReport(result, outputModes) {
    const outputAsArray = Array.isArray(outputModes);
    if (typeof outputModes === 'string') outputModes = [outputModes];

    const output = outputModes.map(outputMode => {
      // HTML report.
      if (outputMode === 'html') {
        if (ReportGenerator.isFlowResult(result)) {
          return ReportGenerator.generateFlowReportHtml(result);
        }
        return ReportGenerator.generateReportHtml(result);
      }
      // CSV report.
      if (outputMode === 'csv') {
        if (ReportGenerator.isFlowResult(result)) {
          throw new Error('CSV output is not support for user flows');
        }
        return ReportGenerator.generateReportCSV(result);
      }
      // JSON report.
      if (outputMode === 'json') {
        return JSON.stringify(result, null, 2);
      }

      throw new Error('Invalid output mode: ' + outputMode);
    });

    return outputAsArray ? output : output[0];
  }
}

export {ReportGenerator};
