/** The slice of Node's `process` Lighthouse touches when it runs in a browser. */
export const processShim = {
  browser: true,
  env: {} as Record<string, string | undefined>,
  argv: [] as string[],
  platform: 'browser',
  version: '',
  versions: {} as Record<string, string>,
  cwd: (): string => '/',
  exit: (): void => undefined,
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]): void => queueMicrotask(() => callback(...args)),
  stdout: { isTTY: false, write: (): boolean => true },
  stderr: { isTTY: false, write: (): boolean => true },
};

export default processShim;
