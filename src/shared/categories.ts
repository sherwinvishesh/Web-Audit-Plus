/** The five report categories, in display order. */
export type CategoryId = 'performance' | 'accessibility' | 'best-practices' | 'seo' | 'agentic';

export const CATEGORY_IDS: readonly CategoryId[] = ['performance', 'accessibility', 'best-practices', 'seo', 'agentic'];

export const ENGINE_CATEGORY_IDS: readonly CategoryId[] = ['performance', 'accessibility', 'best-practices', 'seo'];

export const CATEGORY_TITLES: Readonly<Record<CategoryId, string>> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
  agentic: 'Agentic',
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

/** The overall score: the mean of the categories that produced a score, rounded once. */
export function overallScore(scores: ReadonlyArray<number | null | undefined>): number | null {
  const present = scores.filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, score) => sum + score, 0) / present.length);
}
