import { codeSpan } from "../agentic/quote";
import { CATEGORY_TITLES } from "./categories";
import {
  CHANGE_LABEL,
  signed,
  type ChangeKind,
  type Comparison,
} from "./compare";
import { EVIDENCE_NOTICE, inline } from "./fix-prompt";
import {
  fixNext,
  suggestions,
  type AuditItem,
  type ReportModel,
} from "./report-model";

/**
 * The report as a short markdown summary, for pasting into an issue, a pull request or a chat:
 * the scores, what changed since the compared run, and the biggest wins. The full detail per audit
 * lives in the fix prompts. Site values stay inside code spans, as everywhere else.
 */

/** How many "fix next" items the summary lists. */
export const SUMMARY_TOP = 10;

export function markdownSummary(
  model: ReportModel,
  comparison?: Comparison,
): string {
  const { record } = model;
  const lines: string[] = [];
  lines.push(`# Web Audit+ report for ${codeSpan(hostOf(record.url))}`, "");
  lines.push(`- URL: ${codeSpan(record.url)}`);
  lines.push(
    `- Audited: ${utc(record.startedAt)}, ${record.options.formFactor === "mobile" ? "mobile" : "desktop"}`,
  );
  if (model.engine)
    lines.push(
      `- Audit engine ${inline(model.engine.version)}, ${inline(model.engine.throttling)}`,
    );
  if (model.context.framework)
    lines.push(`- Framework: ${inline(model.context.framework.name)}`);
  if (comparison)
    lines.push(
      `- Compared with the run of ${utc(comparison.previousStartedAt)}`,
    );
  lines.push("");

  const withChange = comparison !== undefined;
  lines.push(
    withChange ? "| Category | Score | Change |" : "| Category | Score |",
  );
  lines.push(withChange ? "| --- | ---: | ---: |" : "| --- | ---: |");
  for (const category of model.categories) {
    const score =
      category.score === null ? "not scored" : String(category.score);
    const delta = comparison?.scores[category.id];
    lines.push(
      withChange
        ? `| ${category.title} | ${score} | ${delta === undefined ? "" : signed(delta)} |`
        : `| ${category.title} | ${score} |`,
    );
  }
  if (typeof record.overall === "number") {
    lines.push(
      withChange
        ? `| Overall | ${record.overall} | ${comparison.overall === undefined ? "" : signed(comparison.overall)} |`
        : `| Overall | ${record.overall} |`,
    );
  }
  lines.push("");

  const audits = model.categories.flatMap((category) => category.audits);
  if (comparison) {
    const byKind = (kind: ChangeKind): AuditItem[] =>
      audits.filter((audit) => comparison.audits[audit.key]?.kind === kind);
    const groups = (["new", "regressed", "improved", "fixed"] as const)
      .map((kind) => ({ kind, items: byKind(kind) }))
      .filter((group) => group.items.length > 0);
    if (groups.length > 0) {
      lines.push("## Changes since the compared run", "");
      for (const { kind, items } of groups) {
        lines.push(
          `- ${CHANGE_LABEL[kind]} (${items.length}): ${items.map((audit) => `${audit.title} (${CATEGORY_TITLES[audit.category]})`).join("; ")}`,
        );
      }
      lines.push("");
    }
  }

  const next = fixNext(model);
  const suggested = suggestions(model);
  if (next.length === 0) {
    lines.push(
      suggested.length > 0
        ? "Nothing to fix: every scored audit passed."
        : "Nothing to fix: every audit that applies to this page passed.",
      "",
    );
  } else {
    lines.push(
      `## Fix next (${Math.min(SUMMARY_TOP, next.length)} of ${next.length})`,
      "",
    );
    next.slice(0, SUMMARY_TOP).forEach((audit, index) => {
      const reason = audit.reason ? `: ${inline(audit.reason)}` : "";
      lines.push(
        `${index + 1}. **${inline(audit.title)}** (${CATEGORY_TITLES[audit.category]}, ${atStake(audit)})${reason}`,
      );
    });
    lines.push("");
  }
  if (suggested.length > 0) {
    const locked = model.categories.find(
      (category) => category.id === "agentic",
    )?.locked;
    lines.push(`## Suggestions (${suggested.length})`, "");
    lines.push(
      "Conventions for AI agents the page has not adopted. They are outside the score; the best-served sites have not adopted them either.",
      "",
    );
    for (const audit of suggested) {
      const reason = audit.reason ? `: ${inline(audit.reason)}` : "";
      lines.push(`- **${inline(audit.title)}**${reason}`);
    }
    if (locked)
      lines.push(
        `- ${locked.count} more apply once a markdown twin is served (${locked.unlockedBy.join(", ")})`,
      );
    lines.push("");
  }
  if (next.length === 0 && suggested.length === 0) return lines.join("\n");
  lines.push(EVIDENCE_NOTICE, "");
  return lines.join("\n");
}

/** "+12 points", or for an unweighted insight "about +3.4 (estimate)". */
export function atStake(audit: Pick<AuditItem, "points" | "impact">): string {
  if (audit.points > 0)
    return `+${audit.points} ${audit.points === 1 ? "point" : "points"}`;
  if (audit.impact) return `about +${audit.impact} (estimate)`;
  return "no score change";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** "2026-10-15 03:58 UTC": the same text wherever the summary is made. */
export function utc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** A file name for an export: "web-audit-plus_example.com_2026-10-15_0358.json". */
export function exportFileName(
  url: string,
  startedAt: string,
  extension: string,
): string {
  const host = hostOf(url)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stamp = utc(startedAt)
    .replace(" UTC", "")
    .replace(" ", "_")
    .replace(":", "");
  return `web-audit-plus_${host || "page"}_${stamp}.${extension}`;
}
