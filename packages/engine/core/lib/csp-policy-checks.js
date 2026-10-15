/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The CSP checks the `csp-xss` audit runs: a stricter subset of the checks in the
 * csp_evaluator package (1.1.8), ported to an ES module from that package's compiled output.
 */

/** @typedef {import('csp_evaluator/dist/csp.js').Csp} Csp */
/** @typedef {import('csp_evaluator/dist/finding.js').Finding} Finding */

import {checkInvalidKeyword, checkMissingSemicolon, checkUnknownDirective} from 'csp_evaluator/dist/checks/parser_checks.js';
import {
  checkDeprecatedDirective, checkMissingObjectSrcDirective, checkMissingScriptSrcDirective,
  checkMultipleMissingBaseUriDirective, checkNonceLength, checkPlainUrlSchemes,
  checkScriptUnsafeInline, checkWildcards,
} from 'csp_evaluator/dist/checks/security_checks.js';
import {checkAllowlistFallback, checkStrictDynamic, checkUnsafeInlineFallback} from 'csp_evaluator/dist/checks/strictcsp_checks.js';
import {Directive, Version} from 'csp_evaluator/dist/csp.js';

/**
 * @param {Finding[]} arr
 * @param {Finding} elem
 */
function arrayContains(arr, elem) {
  return arr.some(e => e.equals(elem));
}

/**
 * The findings present in every set, compared with `equals()`.
 * @param {Finding[][]} sets
 * @return {Finding[]}
 */
function setIntersection(sets) {
  /** @type {Finding[]} */
  const intersection = [];
  if (sets.length === 0) {
    return intersection;
  }
  const firstSet = sets[0];
  for (const elem of firstSet) {
    if (sets.every(set => arrayContains(set, elem))) {
      intersection.push(elem);
    }
  }
  return intersection;
}

/**
 * The findings present in any set, compared with `equals()`.
 * @param {Finding[][]} sets
 * @return {Finding[]}
 */
function setUnion(sets) {
  /** @type {Finding[]} */
  const union = [];
  for (const set of sets) {
    for (const elem of set) {
      if (!arrayContains(union, elem)) {
        union.push(elem);
      }
    }
  }
  return union;
}

/**
 * A finding only counts if every policy has it: one policy passing is enough.
 * @param {Csp[]} parsedCsps
 * @param {(csp: Csp) => Finding[]} checker
 */
function atLeastOnePasses(parsedCsps, checker) {
  return setIntersection(parsedCsps.map(parsedCsp => checker(parsedCsp)));
}

/**
 * A finding counts if any policy has it.
 * @param {Csp[]} parsedCsps
 * @param {(csp: Csp) => Finding[]} checker
 */
function atLeastOneFails(parsedCsps, checker) {
  return setUnion(parsedCsps.map(parsedCsp => checker(parsedCsp)));
}

/**
 * Findings that make the policies fail to protect against XSS.
 * @param {Csp[]} parsedCsps
 * @return {Finding[]}
 */
function evaluateForFailure(parsedCsps) {
  const targetsXssFindings = [
    ...atLeastOnePasses(parsedCsps, checkMissingScriptSrcDirective),
    ...atLeastOnePasses(parsedCsps, checkMissingObjectSrcDirective),
    ...checkMultipleMissingBaseUriDirective(parsedCsps),
  ];

  const effectiveCsps = parsedCsps.map(csp => csp.getEffectiveCsp(Version.CSP3));
  const effectiveCspsWithScript = effectiveCsps.filter(csp => {
    const directiveName = csp.getEffectiveDirective(Directive.SCRIPT_SRC);
    return csp.directives[directiveName];
  });

  const robust = [
    ...atLeastOnePasses(effectiveCspsWithScript, checkStrictDynamic),
    ...atLeastOnePasses(effectiveCspsWithScript, checkScriptUnsafeInline),
    ...atLeastOnePasses(effectiveCsps, checkWildcards),
    ...atLeastOnePasses(effectiveCsps, checkPlainUrlSchemes),
  ];

  return [...targetsXssFindings, ...robust];
}

/**
 * Findings that weaken the policies in some browsers.
 * @param {Csp[]} parsedCsps
 * @return {Finding[]}
 */
function evaluateForWarnings(parsedCsps) {
  return [
    ...atLeastOneFails(parsedCsps, checkUnsafeInlineFallback),
    ...atLeastOneFails(parsedCsps, checkAllowlistFallback),
  ];
}

/**
 * Syntax errors in each policy, one array per policy.
 * @param {Csp[]} parsedCsps
 * @return {Finding[][]}
 */
function evaluateForSyntaxErrors(parsedCsps) {
  return parsedCsps.map(csp => [
    ...checkNonceLength(csp),
    ...checkUnknownDirective(csp),
    ...checkDeprecatedDirective(csp),
    ...checkMissingSemicolon(csp),
    ...checkInvalidKeyword(csp),
  ]);
}

export {evaluateForFailure, evaluateForWarnings, evaluateForSyntaxErrors};
