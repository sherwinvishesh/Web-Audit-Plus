/**
 * `Browser.getVersion`, answered from the extension's own context: it runs in the same Chrome as the
 * audited tab, so its user agent is the browser's. Lighthouse reads the milestone from `product` and
 * reports `userAgent` as the host user agent.
 */
export interface BrowserVersion {
  protocolVersion: string;
  product: string;
  revision: string;
  userAgent: string;
  jsVersion: string;
}

interface UserAgentData {
  getHighEntropyValues(hints: string[]): Promise<{ fullVersionList?: Array<{ brand: string; version: string }> }>;
}

export async function browserVersion(nav: Navigator = navigator): Promise<BrowserVersion> {
  const userAgent = nav.userAgent;
  let version = /(?:Chrome|Chromium)\/([\d.]+)/.exec(userAgent)?.[1] ?? '0';
  const data = (nav as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (data) {
    try {
      const { fullVersionList = [] } = await data.getHighEntropyValues(['fullVersionList']);
      const chromium = fullVersionList.find((entry) => entry.brand === 'Chromium') ?? fullVersionList.find((entry) => /Chrome/.test(entry.brand));
      if (chromium) version = chromium.version;
    } catch {
      // The reduced user agent still carries the major version, which is what Lighthouse uses.
    }
  }
  return { protocolVersion: '1.3', product: `Chrome/${version}`, revision: '', userAgent, jsVersion: '' };
}
