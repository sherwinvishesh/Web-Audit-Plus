/**
 * The few `Buffer` methods Lighthouse and its JPEG decoder use: base64 in and out of screenshots,
 * UTF-8 for fetched resources, and zeroed allocation for decoded frames.
 */
type Encoding = 'utf8' | 'utf-8' | 'base64' | 'latin1' | 'binary' | 'hex';

function fromBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/[^A-Za-z0-9+/=]/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toBinaryString(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    out += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return out;
}

/** Bytes with Node's `toString(encoding)`. */
class BufferBytes extends Uint8Array {
  override toString(encoding: Encoding = 'utf8'): string {
    if (encoding === 'base64') return btoa(toBinaryString(this));
    if (encoding === 'latin1' || encoding === 'binary') return toBinaryString(this);
    if (encoding === 'hex') return Array.from(this, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return new TextDecoder().decode(this);
  }
}

export const BufferShim = {
  from(value: string | ArrayLike<number> | ArrayBuffer, encoding: Encoding = 'utf8'): BufferBytes {
    if (typeof value === 'string') {
      let bytes: Uint8Array;
      if (encoding === 'base64') bytes = fromBase64(value);
      else if (encoding === 'latin1' || encoding === 'binary') bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
      else if (encoding === 'hex') bytes = Uint8Array.from(value.match(/../g) ?? [], (pair) => parseInt(pair, 16));
      else bytes = new TextEncoder().encode(value);
      return new BufferBytes(bytes);
    }
    if (value instanceof ArrayBuffer) return new BufferBytes(new Uint8Array(value));
    return new BufferBytes(Array.from(value));
  },

  alloc(size: number): BufferBytes {
    return new BufferBytes(size);
  },

  isBuffer(value: unknown): value is BufferBytes {
    return value instanceof BufferBytes;
  },

  byteLength(value: string): number {
    return new TextEncoder().encode(value).length;
  },
};
