/**
 * `module` for the bundled Lighthouse. A `require` that resolves nothing is how Lighthouse detects
 * that it is running bundled, which makes it load audits from the bundle instead of from disk.
 */
interface BundledRequire {
  (id: string): never;
  resolve(id: string): never;
}

export function createRequire(): BundledRequire {
  const fail = (id: string): never => {
    throw new Error(`Cannot find module '${id}' (bundled build)`);
  };
  return Object.assign(fail, { resolve: fail });
}

export default { createRequire };
