/** `zlib`, `stream`: used only to save artifacts to disk, which a browser run never does. */
function unavailable(name: string): () => never {
  return () => {
    throw new Error(`${name} is not available in the browser`);
  };
}

export const createGzip = unavailable('zlib.createGzip');
export const gunzipSync = unavailable('zlib.gunzipSync');
export const Readable = { from: unavailable('stream.Readable.from') };
export const pipeline = unavailable('stream.pipeline');
export default { createGzip, gunzipSync, Readable, pipeline, promises: { pipeline } };
