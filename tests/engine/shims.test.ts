import { Buffer } from 'node:buffer';
import { posix } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BufferShim } from '../../src/engine/shims/buffer';
import { EventEmitter } from '../../src/engine/shims/events';
import * as path from '../../src/engine/shims/path';
import { fileURLToPath, pathToFileURL } from '../../src/engine/shims/url';

// The shims stand in for Node built-ins inside the service worker; Node's own behavior is the spec.

describe('Buffer shim', () => {
  const samples = ['', 'plain ascii', 'ünïcödé ✓ 漢字', '\u0000ÿ binary-ish'];

  it('round-trips base64, hex and UTF-8 like Node', () => {
    for (const text of samples) {
      const base64 = Buffer.from(text, 'utf8').toString('base64');
      expect(BufferShim.from(text).toString('base64')).toBe(base64);
      expect(BufferShim.from(base64, 'base64').toString()).toBe(text);
      expect(BufferShim.from(text).toString('hex')).toBe(Buffer.from(text).toString('hex'));
      expect(BufferShim.byteLength(text)).toBe(Buffer.byteLength(text));
    }
  });

  it('reads latin1 one byte per character', () => {
    const latin = 'éÿA';
    expect([...BufferShim.from(latin, 'latin1')]).toEqual([...Buffer.from(latin, 'latin1')]);
    expect(BufferShim.from(latin, 'latin1').toString('latin1')).toBe(latin);
  });

  it('decodes a large screenshot without overflowing the call stack', () => {
    const bytes = new Uint8Array(1_000_000).map((_, index) => index % 256);
    const base64 = Buffer.from(bytes).toString('base64');
    expect(BufferShim.from(base64, 'base64').length).toBe(bytes.length);
    expect(BufferShim.from(bytes).toString('base64')).toBe(base64);
  });

  it('allocates zeroed bytes and recognizes its own buffers', () => {
    const buffer = BufferShim.alloc(4);
    expect([...buffer]).toEqual([0, 0, 0, 0]);
    expect(BufferShim.isBuffer(buffer)).toBe(true);
    expect(BufferShim.isBuffer(new Uint8Array(4))).toBe(false);
  });
});

describe('path shim', () => {
  const paths = ['/a/b/c.js', '/a/b/', '/a//b/../c/./d', 'a/b', '../a', '/', '', '.', 'a/b.test.ts', '/.hidden'];

  it('agrees with Node’s posix path', () => {
    for (const value of paths) {
      expect(path.normalize(value)).toBe(posix.normalize(value));
      expect(path.dirname(value)).toBe(posix.dirname(value));
      expect(path.basename(value)).toBe(posix.basename(value));
      expect(path.extname(value)).toBe(posix.extname(value));
      expect(path.isAbsolute(value)).toBe(posix.isAbsolute(value));
    }
    expect(path.join('/engine', 'core', '../shared', 'root.js')).toBe(posix.join('/engine', 'core', '../shared', 'root.js'));
    expect(path.resolve('/engine/core', './audits', 'a.js')).toBe(posix.resolve('/engine/core', './audits', 'a.js'));
    expect(path.relative('/engine/core/audits', '/engine/shared/x.js')).toBe(posix.relative('/engine/core/audits', '/engine/shared/x.js'));
    expect(path.basename('/a/b.js', '.js')).toBe('b');
  });
});

describe('url shim', () => {
  it('turns file URLs into paths and back', () => {
    expect(fileURLToPath('file:///engine/core/runner.js')).toBe('/engine/core/runner.js');
    expect(fileURLToPath(undefined)).toBe('/');
    expect(fileURLToPath('not a url')).toBe('/');
    expect(pathToFileURL('/engine/a.js').href).toBe('file:///engine/a.js');
  });
});

describe('EventEmitter shim', () => {
  it('delivers in order, once, and to prepended listeners first', () => {
    const emitter = new EventEmitter();
    const calls: string[] = [];
    emitter.on('status', (value: string) => calls.push(`on:${value}`));
    emitter.once('status', (value: string) => calls.push(`once:${value}`));
    emitter.prependListener('status', (value: string) => calls.push(`first:${value}`));
    expect(emitter.emit('status', 'a')).toBe(true);
    emitter.emit('status', 'b');
    expect(calls).toEqual(['first:a', 'on:a', 'once:a', 'first:b', 'on:b']);
    expect(emitter.listenerCount('status')).toBe(2);
  });

  it('removes a once listener by the function it was given', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.once('x', listener);
    emitter.off('x', listener);
    expect(emitter.emit('x')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('throws an unhandled error event, like Node', () => {
    expect(() => new EventEmitter().emit('error', new Error('boom'))).toThrow('boom');
  });
});
