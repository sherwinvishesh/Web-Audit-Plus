/**
 * `url` for the bundled Lighthouse. Its modules locate themselves with
 * `fileURLToPath(import.meta.url)`; in a bundle that URL is not a file URL (or not defined), and
 * the directory is only ever used for reads that were inlined at build time.
 */
export function fileURLToPath(value: string | URL | undefined): string {
  if (value === undefined) return '/';
  try {
    return new URL(String(value)).pathname;
  } catch {
    return '/';
  }
}

export function pathToFileURL(path: string): URL {
  return new URL(`file://${path.startsWith('/') ? '' : '/'}${path}`);
}

const NativeURL = globalThis.URL;
export { NativeURL as URL };
export default { fileURLToPath, pathToFileURL, URL: NativeURL };
