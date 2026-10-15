/**
 * `fs` for the bundled engine. Every file the engine reads at runtime is inlined at build time
 * (see scripts/engine-bundle.ts), so anything that reaches here is a code path a browser run
 * never takes: saving artifacts, reading a trace from disk.
 */
function unavailable(name: string): never {
  throw new Error(`fs.${name} is not available in the browser`);
}

export const readFileSync = (): never => unavailable('readFileSync');
export const readdirSync = (): never => unavailable('readdirSync');
export const writeFileSync = (): never => unavailable('writeFileSync');
export const mkdirSync = (): never => unavailable('mkdirSync');
export const createWriteStream = (): never => unavailable('createWriteStream');
export const existsSync = (): boolean => false;
export const promises = {
  readFile: (): Promise<never> => Promise.reject(new Error('fs.promises.readFile is not available in the browser')),
  writeFile: (): Promise<never> => Promise.reject(new Error('fs.promises.writeFile is not available in the browser')),
};

export default { readFileSync, readdirSync, writeFileSync, mkdirSync, createWriteStream, existsSync, promises };
