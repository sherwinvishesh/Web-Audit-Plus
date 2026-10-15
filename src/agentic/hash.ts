import { sha256Hex } from './sha256';

/**
 * OpenGEO's content hash, which B14 compares with a twin's recorded `source_hash` /
 * `X-Markdown-Source-Hash`. Byte-for-byte the same algorithm: SHA-256 of the whitespace-normalized
 * extracted markdown, hex, first 16 characters.
 */
export function contentHash(input: string): string {
  return sha256Hex(normalizeForHash(input)).slice(0, 16);
}

/** Collapse insignificant whitespace so a cosmetic reflow does not read as a content change. */
export function normalizeForHash(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
