/**
 * `puppeteer-core` as the engine sees it in this build. The engine only calls `puppeteer.connect`
 * when it is not handed a page, and Web Audit+ always hands it one (see ../page.ts), so this keeps
 * Puppeteer's Node transport out of the bundle.
 */
export default {
  connect(): never {
    throw new Error('Puppeteer is not bundled: pass the engine a page');
  },
};
