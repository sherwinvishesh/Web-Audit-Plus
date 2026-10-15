/** The Agentic engine: evidence → checks → score. No browser APIs; runs in Node and in the extension. */
export * from './types';
export { CHECKS, checkDefinition, collapseTwinCascade, runChecks, TWIN_LOCKED_IDS } from './checks';
export { gatherEvidence, PROBE_HEADERS, PROBE_ORDER, resolveAdvertised, type GatherOptions } from './evidence';
export { buildAgenticReport, summarizeProbe } from './report';
export { fixSteps, priceFixes, scoreChecks, scoreGain, stripPrice } from './score';
export { detectFramework } from './framework';
export { codeSpan, parseInline, stripCodeSpans, type InlinePart } from './quote';
export { placementFor, REMEDIES, remedyFor } from './remedies';
export { agenticFixItem, agenticFixItems, needsWork } from './fix-items';
