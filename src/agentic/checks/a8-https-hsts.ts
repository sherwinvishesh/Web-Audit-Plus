import { header, parseUrl } from '../http';
import { defineCheck, fail, na, partial, pass, q } from './helpers';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** A8. HTTPS with `Strict-Transport-Security`, judged where the page lands after redirects. */
export const a8HttpsHsts = defineCheck(
  { id: 'A8', category: 'A', required: true, weight: 9, title: 'Served over HTTPS with HSTS' },
  (e, self) => {
    const target = new URL(e.target);
    const host = target.hostname;
    if (LOCAL_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
      return na(self, `${q(host)} is a local development host, where HTTPS and HSTS are not meaningful.`);
    }
    // An agent that asks for http:// and is redirected to https:// talks to the site over HTTPS, and
    // the HSTS header it reads is the HTTPS response's.
    const landed = (e.html.redirected ? parseUrl(e.html.finalUrl) : undefined) ?? target;
    if (landed.protocol !== 'https:') {
      return fail(self, `The page is served over plain HTTP at ${q(landed.toString())}. Some agents refuse insecure origins outright.`, {
        fix: 'Serve the site over HTTPS, then add `Strict-Transport-Security` (+9).',
      });
    }
    const hsts = header(e.html, 'strict-transport-security');
    if (!hsts) {
      return partial(self, 6, 'Served over HTTPS, but no Strict-Transport-Security header is set, so a first visit can still be downgraded.', {
        fix: 'Add `Strict-Transport-Security: max-age=63072000; includeSubDomains` to the HTML response (+3).',
      });
    }
    return pass(self, `Served over HTTPS with HSTS: ${q(hsts)}.`);
  },
);
