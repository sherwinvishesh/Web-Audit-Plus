/**
 * The report page's own stylesheet, for the HTML export: every rule the page loaded, with the two
 * Geist faces it needs (latin, variable weight) inlined as `data:` URLs and the other subsets left
 * out to keep the file small. Characters outside latin fall back to the system font.
 */
export async function pageCss(): Promise<string> {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        const face = await inlineFace(rule, sheet.href ?? location.href);
        if (face) parts.push(face);
      } else {
        parts.push(rule.cssText);
      }
    }
  }
  return parts.join('\n');
}

async function inlineFace(rule: CSSFontFaceRule, base: string): Promise<string | undefined> {
  const source = rule.style.getPropertyValue('src');
  if (!source.includes('latin-wght-normal')) return undefined;
  const url = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(source)?.[1];
  if (!url) return undefined;
  const response = await fetch(new URL(url, base));
  if (!response.ok) return undefined;
  const data = await toDataUrl(await response.blob(), 'font/woff2');
  const family = rule.style.getPropertyValue('font-family').trim();
  const weight = rule.style.getPropertyValue('font-weight').trim() || '100 900';
  return `@font-face{font-family:${family};font-style:normal;font-display:swap;font-weight:${weight};src:url(${data}) format('woff2');}`;
}

function toDataUrl(blob: Blob, type: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;,]*/, `data:${type}`));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the font'));
    reader.readAsDataURL(blob);
  });
}
