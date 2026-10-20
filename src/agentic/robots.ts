/**
 * Reading robots.txt the way a crawler does (RFC 9309), matching OpenGSO's reader: groups keyed by
 * lower-cased User-agent token, consecutive User-agent lines share a group, a bot obeys its own
 * group if present and `*` otherwise, the longest matching rule wins, Allow wins a tie, `*` matches
 * any run and a trailing `$` anchors. An empty Disallow matches nothing.
 */

export interface RobotsRule {
  type: 'allow' | 'disallow';
  path: string;
}

export function parseRobots(contents: string): Map<string, RobotsRule[]> {
  const groups = new Map<string, RobotsRule[]>();
  let currentAgents: string[] = [];
  let expectingAgents = true;
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (!expectingAgents) {
        currentAgents = [];
        expectingAgents = true;
      }
      const agent = value.toLowerCase();
      currentAgents.push(agent);
      if (!groups.has(agent)) groups.set(agent, []);
      continue;
    }
    if (field === 'allow' || field === 'disallow') {
      expectingAgents = false;
      for (const agent of currentAgents) {
        const list = groups.get(agent) ?? [];
        list.push({ type: field, path: value });
        groups.set(agent, list);
      }
    }
  }
  return groups;
}

export interface RulesFor {
  rules: RobotsRule[];
  /** The group the rules came from: the bot's own token, or `*`. */
  group: string;
}

/**
 * The rules a crawler obeys: its own group if there is one (even an empty one), `*` otherwise.
 */
export function robotsRulesFor(groups: Map<string, RobotsRule[]>, token: string): RulesFor | undefined {
  const own = groups.get(token.toLowerCase());
  if (own) return { rules: own, group: token.toLowerCase() };
  const star = groups.get('*');
  return star ? { rules: star, group: '*' } : undefined;
}

/** The rule that decides `path`, or undefined when no rule matches (allowed). */
export function decidingRule(rules: readonly RobotsRule[], path: string): RobotsRule | undefined {
  let best: RobotsRule | undefined;
  for (const rule of rules) {
    if (!rule.path || !matches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.type === 'allow')) best = rule;
  }
  return best;
}

export function robotsAllows(rules: readonly RobotsRule[], path: string): boolean {
  return decidingRule(rules, path)?.type !== 'disallow';
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
}
