import { rawDocument } from '../extract';
import { defineCheck, fail, partial, pass, q, unique } from './helpers';

const MAX_TYPES_NAMED = 6;

/** A4. A Schema.org JSON-LD block that parses and declares an `@type`. */
export const a4JsonLd = defineCheck(
  { id: 'A4', category: 'A', required: false, weight: 2, title: 'Schema.org JSON-LD is present and parses' },
  (e, self) => {
    if (!e.html.ok || !e.html.body) {
      return fail(self, 'Could not read the HTML response to look for JSON-LD.', {
        fix: 'Get the page returning HTML first; this check reads the markup for a JSON-LD block (+2).',
      });
    }
    const blocks = Array.from(rawDocument(e).querySelectorAll('script[type="application/ld+json"]'));
    if (blocks.length === 0) {
      return fail(self, 'No Schema.org JSON-LD found. Agents have no structured description of what this page is.', {
        fix: 'Add a `<script type="application/ld+json">` block with an `@type` describing the page (+2).',
      });
    }
    const types: string[] = [];
    const broken: string[] = [];
    for (const block of blocks) {
      const raw = block.textContent?.trim() ?? '';
      try {
        collectTypes(JSON.parse(raw) as unknown, types);
      } catch (error) {
        broken.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (broken.length > 0) {
      return partial(self, 1, `A JSON-LD block is present but does not parse: ${q(broken[0], 160)}.`, {
        fix: 'Fix the JSON syntax so the block parses, and give it an `@type` (+1).',
      });
    }
    if (types.length === 0) {
      return partial(self, 1, 'JSON-LD is present and parses, but declares no `@type`, so it describes nothing.', {
        fix: 'Add an `@type` naming what the page is: Person, Article, Product, Organization (+1).',
      });
    }
    const named = unique(types);
    const shown = named.slice(0, MAX_TYPES_NAMED).map((type) => q(type, 80));
    const more = named.length > MAX_TYPES_NAMED ? ` and ${named.length - MAX_TYPES_NAMED} more` : '';
    return pass(self, `JSON-LD is present and valid, declaring ${shown.join(', ')}${more}.`);
  },
);

function collectTypes(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const type = record['@type'];
  if (typeof type === 'string') out.push(type);
  else if (Array.isArray(type)) for (const t of type) if (typeof t === 'string') out.push(t);
  if (Array.isArray(record['@graph'])) collectTypes(record['@graph'], out);
}
