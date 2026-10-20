/**
 * Whitespace-delimited words: the one definition every count uses (A5's threshold, B3's
 * twin-versus-page ratio, B14's fidelity ratio), so two counts that are compared were made the same
 * way. Matches OpenGSO exactly; the scores depend on it.
 */
export function countWords(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}
