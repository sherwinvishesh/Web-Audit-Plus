import { BufferShim } from './buffer';
import { processShim } from './process';

/**
 * Node globals the engine reads at module load. Imported before the engine itself, so these exist
 * by the time its modules evaluate.
 */
const scope = globalThis as unknown as Record<string, unknown>;
scope.global ??= globalThis;
scope.process ??= processShim;
scope.Buffer ??= BufferShim;
