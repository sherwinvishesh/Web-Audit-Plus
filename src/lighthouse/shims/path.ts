/** POSIX `path` for the bundled Lighthouse, which only joins and splits module-relative paths. */

export const sep = '/';
export const delimiter = ':';

function normalizeSegments(path: string, absolute: boolean): string {
  const out: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..');
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

export function normalize(path: string): string {
  if (path === '') return '.';
  const absolute = isAbsolute(path);
  const trailing = path.endsWith('/');
  let result = normalizeSegments(path, absolute);
  if (result === '' && !absolute) result = '.';
  if (result !== '' && trailing) result += '/';
  return absolute ? `/${result}` : result;
}

export function join(...paths: string[]): string {
  const joined = paths.filter((path) => path !== '').join('/');
  return joined === '' ? '.' : normalize(joined);
}

export function resolve(...paths: string[]): string {
  let resolved = '';
  for (let index = paths.length - 1; index >= 0 && !isAbsolute(resolved); index--) {
    const path = paths[index];
    if (path) resolved = resolved ? `${path}/${resolved}` : path;
  }
  if (!isAbsolute(resolved)) resolved = `/${resolved}`;
  return `/${normalizeSegments(resolved, true)}`;
}

export function dirname(path: string): string {
  if (path === '') return '.';
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const index = trimmed.lastIndexOf('/');
  if (index === -1) return '.';
  if (index === 0) return '/';
  return trimmed.slice(0, index);
}

export function basename(path: string, extension?: string): string {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const base = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return extension && base.endsWith(extension) && base !== extension ? base.slice(0, -extension.length) : base;
}

export function extname(path: string): string {
  const base = basename(path);
  const index = base.lastIndexOf('.');
  return index <= 0 ? '' : base.slice(index);
}

export function relative(from: string, to: string): string {
  const fromParts = resolve(from).split('/').filter(Boolean);
  const toParts = resolve(to).split('/').filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common++;
  return [...fromParts.slice(common).map(() => '..'), ...toParts.slice(common)].join('/');
}

const path = { sep, delimiter, isAbsolute, normalize, join, resolve, dirname, basename, extname, relative };
export const posix = path;
export default { ...path, posix };
