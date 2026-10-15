import { describe, expect, it } from 'vitest';
import { runProgress } from '../../src/shared/progress';
import type { RunStep, StepStatus } from '../../src/shared/run';

const step = (id: string, status: StepStatus): RunStep => ({ id, group: id.startsWith('lh:') ? 'lighthouse' : 'agentic', label: id, status });

describe('runProgress', () => {
  it('is 0 with nothing started and 1 with everything settled', () => {
    expect(runProgress([])).toBe(0);
    expect(runProgress([step('lh:prepare', 'pending'), step('agentic:html', 'pending')])).toBe(0);
    expect(runProgress([step('lh:prepare', 'done'), step('agentic:html', 'failed'), step('agentic:llms', 'skipped')])).toBe(1);
  });

  it('weights the slow Lighthouse steps above the quick probes', () => {
    const steps = [step('lh:load', 'done'), step('lh:gather', 'pending'), step('agentic:html', 'pending'), step('agentic:robots', 'pending')];
    expect(runProgress(steps)).toBeCloseTo(6 / 15);
  });

  it('counts a running step as half done', () => {
    expect(runProgress([step('lh:gather', 'running'), step('lh:audit', 'pending')])).toBeCloseTo(4 / 12);
  });
});
