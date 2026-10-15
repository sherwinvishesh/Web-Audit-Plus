import { browserVersion } from './browser-version';
import type { LocalCommands } from './cdp';

export const JS_COVERAGE_UNAVAILABLE = 'Chrome does not let extensions read JavaScript coverage (the Profiler protocol domain)';

/**
 * Protocol commands `chrome.debugger` does not offer extensions, answered here:
 * - `Browser.getVersion`: the browser domain is closed to extensions; the worker knows the version.
 * - `Animation`: closed to extensions. The engine enables it only to learn animation names for the
 *   non-composited animations audit; the animations themselves come from the trace, so a no-op keeps
 *   that audit and every trace insight working, without the names.
 * - `Profiler`: closed to extensions, and JavaScript coverage has no other source, so the audits
 *   built on it (`unused-javascript`) report why they could not run.
 */
export const LOCAL_COMMANDS: LocalCommands = {
  'Browser.getVersion': () => browserVersion(),
  'Animation.enable': async () => ({}),
  'Animation.disable': async () => ({}),
  'Profiler.enable': () => Promise.reject(new Error(JS_COVERAGE_UNAVAILABLE)),
};
