import { AI_BOTS } from '../bots';
import { decidingRule, parseRobots, robotsAllows, robotsRulesFor, type RobotsRule } from '../robots';
import { servesFile } from '../sniff';
import { defineCheck, fail, httpStatus, list, partial, pass, q } from './helpers';

interface Blocked {
  name: string;
  rule: RobotsRule;
  group: string;
}

/**
 * A1. robots.txt read like a crawler: each bot's own group, `*` otherwise, longest match wins,
 * Allow wins a tie. Blocking an assistant or search agent fails; blocking only bulk training
 * crawlers is a deliberate opt-out and earns 6 of 9.
 */
export const a1Robots = defineCheck(
  { id: 'A1', category: 'A', scored: true, required: true, weight: 9, title: 'robots.txt exists and does not disallow known AI bots' },
  (e, self) => {
    if (!e.robots.ok) {
      return fail(self, `No robots.txt at ${q(e.robots.url)} (${httpStatus(e.robots.status)}). AI crawlers get no explicit signal about what they may read.`, {
        fix: 'Serve a robots.txt that allows the AI agents you want reading the site (+9).',
      });
    }
    if (!servesFile(e.robots)) {
      return fail(
        self,
        `${q(e.robots.url)} answered with an HTML page, not a robots.txt. A catch-all route is handling it, so AI crawlers get no robots rules at all.`,
        { fix: 'Serve a real robots.txt ahead of the catch-all route (+9).' },
      );
    }

    const groups = parseRobots(e.robots.body);
    // The page under test, path and query: what a crawler matches the rules against.
    const target = new URL(e.target);
    const path = `${target.pathname}${target.search}`;
    const blockedAssistants: Blocked[] = [];
    const blockedTraining: Blocked[] = [];
    let wholeSite = true;

    for (const bot of AI_BOTS) {
      const found = robotsRulesFor(groups, bot.robotsToken);
      if (!found || robotsAllows(found.rules, path)) continue;
      const rule = decidingRule(found.rules, path);
      if (!rule) continue;
      const entry = { name: bot.name, rule, group: found.group };
      if (bot.kind === 'training') {
        blockedTraining.push(entry);
        continue;
      }
      blockedAssistants.push(entry);
      if (robotsAllows(found.rules, '/')) wholeSite = false;
    }

    if (blockedAssistants.length > 0) {
      const names = list(blockedAssistants.map((bot) => bot.name));
      return fail(
        self,
        `robots.txt disallows ${names} from ${q(path)} ${describeRules(blockedAssistants)}. ${
          wholeSite
            ? 'These are live assistant and search agents: blocking them removes the site from AI answers entirely.'
            : 'These are live assistant and search agents: blocking them keeps this page out of AI answers.'
        }`,
        {
          detail: blockedTraining.length > 0 ? `Also blocking training crawlers: ${list(blockedTraining.map((bot) => bot.name))}.` : undefined,
          fix: `Remove the Disallow rule that covers ${q(path)} for ${names} (+9). These are the agents that answer questions about the site.`,
        },
      );
    }
    if (blockedTraining.length > 0) {
      // Deliberate, and read as deliberate: every agent that answers questions about the site is
      // still allowed. What it costs is the training corpus, so most of the weight stays.
      const names = list(blockedTraining.map((bot) => bot.name));
      return partial(
        self,
        6,
        `robots.txt allows every assistant and search agent. Bulk training crawlers (${names}) are disallowed ${describeRules(blockedTraining)}, which reads as a deliberate opt-out rather than a mistake.`,
        { fix: `Allow ${names} as well if the opt-out was not intended (+3). If it was, this is the right configuration and those points are the price of it.` },
      );
    }
    return pass(self, `robots.txt is present and does not disallow any of the ${AI_BOTS.length} known AI bots from ${q(path)}.`);
  },
);

/** "(rule `Disallow: /` in the `*` group)", or one entry per bot when the deciding rules differ. */
function describeRules(blocked: readonly Blocked[]): string {
  const describe = (entry: Blocked): string => `rule ${q(`${entry.rule.type === 'allow' ? 'Allow' : 'Disallow'}: ${entry.rule.path}`)} in the ${q(entry.group)} group`;
  const distinct = new Set(blocked.map((entry) => `${entry.group}\n${entry.rule.path}`));
  const first = blocked[0];
  if (distinct.size === 1 && first) return `(${describe(first)})`;
  return `(${blocked.map((entry) => `${entry.name} by ${describe(entry)}`).join('; ')})`;
}
