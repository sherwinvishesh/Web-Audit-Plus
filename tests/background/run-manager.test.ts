import { describe, expect, it } from 'vitest';
import { RunManager, type RunJob, type RunManagerDeps, type RunResult } from '../../src/extension/background/run-manager';
import type { RunOptions, RunRecord, RunState, RunStep } from '../../src/shared/run';

const AGENTIC_ONLY: RunOptions = { formFactor: 'desktop', categories: ['agentic'] };

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A manager whose runs are driven by hand: each job waits until the test finishes it. */
function harness(urls: Record<number, string | undefined> = {}) {
  const jobs: Array<{ job: RunJob; done: Deferred<RunResult> }> = [];
  const saved: RunRecord[] = [];
  const events: Array<{ tabId: number; state: RunState | null }> = [];
  let clock = 1_000;
  const deps: RunManagerDeps = {
    tabUrl: async (tabId) => (tabId in urls ? urls[tabId] : `https://site${tabId}.test/page`),
    plan: (options): RunStep[] => options.categories.map((id) => ({ id, group: 'agentic', label: id, status: 'pending' })),
    execute: (job) => {
      const done = deferred<RunResult>();
      jobs.push({ job, done });
      // Like the real executor, a cancelled run rejects promptly.
      job.signal.addEventListener('abort', () => done.reject(job.signal.reason));
      return done.promise;
    },
    save: async (record) => void saved.push(record),
    environment: { extensionVersion: '0.1.0', userAgent: 'test' },
    now: () => (clock += 10),
  };
  const manager = new RunManager(deps);
  manager.subscribe((tabId, state) => events.push({ tabId, state }));
  return { manager, jobs, saved, events };
}

describe('RunManager', () => {
  it('runs, streams progress, and saves a record', async () => {
    const { manager, jobs, saved } = harness();
    const queued = await manager.start(1, AGENTIC_ONLY);
    expect(queued.url).toBe('https://site1.test/page');
    expect(queued.steps.map((step) => step.status)).toEqual(['pending']);
    await tick();
    expect(manager.state(1)?.phase).toBe('running');

    const { job, done } = jobs[0]!;
    job.step({ id: 'agentic', group: 'agentic', label: 'agentic', status: 'running' });
    job.step({ id: 'extra', group: 'agentic', label: 'extra', status: 'done', detail: '200' });
    job.score('agentic', 82);
    expect(manager.state(1)?.steps.map((step) => `${step.id}:${step.status}`)).toEqual(['agentic:running', 'extra:done']);
    expect(manager.state(1)?.scores).toEqual({ agentic: 82 });

    done.resolve({ errors: {} });
    await tick();
    const final = manager.state(1)!;
    expect(final).toMatchObject({ phase: 'done', saved: true });
    // A step still running at the end did not finish.
    expect(final.steps[0]?.status).toBe('skipped');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: final.runId, url: 'https://site1.test/page', origin: 'https://site1.test', scores: { agentic: 82 }, overall: 82 });
  });

  it('runs one tab at a time and queues the rest', async () => {
    const { manager, jobs } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await manager.start(2, AGENTIC_ONLY);
    await tick();
    expect(manager.state(1)?.phase).toBe('running');
    expect(manager.state(2)?.phase).toBe('queued');
    expect(jobs).toHaveLength(1);

    jobs[0]!.job.score('agentic', 50);
    jobs[0]!.done.resolve({ errors: {} });
    await tick();
    expect(manager.state(1)?.phase).toBe('done');
    expect(manager.state(2)?.phase).toBe('running');
    expect(jobs[1]?.job.tabId).toBe(2);
  });

  it('does not start a second run on a busy tab', async () => {
    const { manager, jobs } = harness();
    const [first, second] = await Promise.all([manager.start(1, AGENTIC_ONLY), manager.start(1, AGENTIC_ONLY)]);
    await tick();
    expect(second.runId).toBe(first.runId);
    expect(jobs).toHaveLength(1);
  });

  it('refuses a tab that cannot be audited, with the reason', async () => {
    const { manager, jobs } = harness({ 7: 'chrome://settings' });
    const state = await manager.start(7, AGENTIC_ONLY);
    expect(state.phase).toBe('failed');
    expect(state.error).toMatch(/^This is a browser page\. /);
    await tick();
    expect(jobs).toHaveLength(0);
  });

  it('cancels a running run', async () => {
    const { manager, jobs, saved } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await tick();
    expect(jobs[0]?.job.signal.aborted).toBe(false);
    manager.cancel(1);
    expect(jobs[0]?.job.signal.aborted).toBe(true);
    await tick();
    expect(manager.state(1)).toMatchObject({ phase: 'cancelled', error: 'Cancelled' });
    expect(manager.state(1)?.steps.every((step) => step.status === 'skipped')).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('cancels a queued run without disturbing the queue', async () => {
    const { manager, jobs } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await manager.start(2, AGENTIC_ONLY);
    await manager.start(3, AGENTIC_ONLY);
    await tick();
    manager.cancel(2);
    expect(manager.state(2)?.phase).toBe('cancelled');
    jobs[0]!.job.score('agentic', 1);
    jobs[0]!.done.resolve({ errors: {} });
    await tick();
    expect(jobs.map(({ job }) => job.tabId)).toEqual([1, 3]);
  });

  it('ends a run the executor aborts, with its reason', async () => {
    const { manager, jobs } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await tick();
    jobs[0]!.job.abort('Debugging was cancelled');
    await tick();
    expect(manager.state(1)).toMatchObject({ phase: 'cancelled', error: 'Debugging was cancelled' });
  });

  it('fails a run in which no category produced a score', async () => {
    const { manager, jobs, saved } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await tick();
    jobs[0]!.job.score('agentic', null);
    jobs[0]!.done.resolve({ errors: { agentic: 'Could not load the page: DNS' } });
    await tick();
    expect(manager.state(1)).toMatchObject({ phase: 'failed', error: 'Could not load the page: DNS' });
    expect(saved).toHaveLength(0);
  });

  it('fails a run whose executor throws, and moves on', async () => {
    const { manager, jobs } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await manager.start(2, AGENTIC_ONLY);
    await tick();
    jobs[0]!.done.reject(new Error('boom'));
    await tick();
    expect(manager.state(1)).toMatchObject({ phase: 'failed', error: 'boom' });
    expect(manager.state(2)?.phase).toBe('running');
  });

  it('can run again on a tab once its run has finished', async () => {
    const { manager, jobs } = harness();
    const first = await manager.start(1, AGENTIC_ONLY);
    await tick();
    jobs[0]!.done.reject(new Error('boom'));
    await tick();
    const second = await manager.start(1, AGENTIC_ONLY);
    expect(second.runId).not.toBe(first.runId);
    await tick();
    expect(jobs).toHaveLength(2);
  });

  it('forgets a closed tab, after its run unwinds', async () => {
    const { manager, jobs, events } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await manager.start(2, AGENTIC_ONLY);
    await tick();
    manager.forget(2);
    expect(manager.state(2)).toBeNull();
    manager.forget(1);
    expect(jobs[0]?.job.signal.aborted).toBe(true);
    await tick();
    expect(manager.state(1)).toBeNull();
    expect(events.at(-1)).toEqual({ tabId: 1, state: null });
    expect(jobs).toHaveLength(1);
  });

  it('ignores updates from a run that has been replaced', async () => {
    const { manager, jobs } = harness();
    await manager.start(1, AGENTIC_ONLY);
    await tick();
    const stale = jobs[0]!.job;
    manager.cancel(1);
    await tick();
    await manager.start(1, AGENTIC_ONLY);
    stale.score('agentic', 99);
    expect(manager.state(1)?.scores).toEqual({});
  });
});
