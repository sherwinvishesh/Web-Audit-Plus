import { describe, expect, it } from 'vitest';
import { classifyStatus, LighthouseProgress } from '../../src/lighthouse/progress';
import type { RunStep } from '../../src/shared/run';

describe('classifyStatus', () => {
  it('maps Lighthouse’s status lines onto the five steps', () => {
    expect(classifyStatus('Connecting to browser')).toEqual({ step: 'lh:prepare' });
    expect(classifyStatus('Navigating to about:blank')).toEqual({ step: 'lh:prepare' });
    expect(classifyStatus('Navigating to https://site.test/')?.step).toBe('lh:load');
    expect(classifyStatus('Getting artifact: Accessibility')).toEqual({ step: 'lh:gather', detail: 'Accessibility' });
    expect(classifyStatus('Auditing: Uses HTTPS')).toEqual({ step: 'lh:audit', detail: 'Uses HTTPS' });
    expect(classifyStatus('Generating results...')).toEqual({ step: 'lh:score' });
    expect(classifyStatus('Computing artifact: NetworkRecords')).toBeUndefined();
  });
});

function track(): { progress: LighthouseProgress; steps: Map<string, RunStep> } {
  const steps = new Map<string, RunStep>(LighthouseProgress.plan().map((step) => [step.id, step]));
  const progress = new LighthouseProgress((step) => steps.set(step.id, step));
  return { progress, steps };
}

const statuses = (steps: Map<string, RunStep>): string[] => [...steps.values()].map((step) => step.status);

describe('LighthouseProgress', () => {
  it('plans five pending steps', () => {
    expect(LighthouseProgress.plan().map((step) => [step.id, step.status])).toEqual([
      ['lh:prepare', 'pending'],
      ['lh:load', 'pending'],
      ['lh:gather', 'pending'],
      ['lh:audit', 'pending'],
      ['lh:score', 'pending'],
    ]);
  });

  it('moves forward, finishing the steps it passes, and shows what is running', () => {
    const { progress, steps } = track();
    progress.start();
    progress.status('Navigating to https://site.test/');
    progress.status('Getting artifact: Trace');
    expect(statuses(steps)).toEqual(['done', 'done', 'running', 'pending', 'pending']);
    expect(steps.get('lh:gather')?.detail).toBe('Trace');
  });

  it('never moves back', () => {
    const { progress, steps } = track();
    progress.status('Auditing: Uses HTTPS');
    progress.status('Getting artifact: Late');
    expect(statuses(steps)).toEqual(['done', 'done', 'done', 'running', 'pending']);
    expect(steps.get('lh:audit')?.detail).toBe('Uses HTTPS');
  });

  it('finishes every step', () => {
    const { progress, steps } = track();
    progress.start();
    progress.finish();
    expect(statuses(steps)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('fails the running step and skips the rest', () => {
    const { progress, steps } = track();
    progress.status('Getting artifact: Trace');
    progress.fail('The page did not paint');
    expect(statuses(steps)).toEqual(['done', 'done', 'failed', 'skipped', 'skipped']);
    expect(steps.get('lh:gather')?.detail).toBe('The page did not paint');
  });
});
