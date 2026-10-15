import type { FixPromptItem } from '../shared/fix-prompt';
import { remedyFor } from './remedies';
import type { AgenticReport, CheckResult } from './types';

/** Agentic checks that need work, as fix-prompt items. Points are score points from `priceFixes`. */
export function agenticFixItems(report: AgenticReport): FixPromptItem[] {
  return report.checks.filter(needsWork).map((check) => agenticFixItem(check, report.twinUrl));
}

export function needsWork(check: CheckResult): check is CheckResult & { status: 'fail' | 'partial' | 'locked' } {
  return check.status === 'fail' || check.status === 'partial' || check.status === 'locked';
}

export function agenticFixItem(check: CheckResult & { status: 'fail' | 'partial' | 'locked' }, twinUrl: string): FixPromptItem {
  const item: FixPromptItem = {
    category: 'agentic',
    id: check.id,
    title: check.title,
    status: check.status,
    points: check.status === 'locked' ? 0 : (check.price ?? 0),
    evidence: check.reason,
    earned: check.earned,
    weight: check.weight,
  };
  if (check.detail) item.detail = check.detail;
  if (check.fix) item.fix = check.fix;
  const remedy = remedyFor(check.id, twinUrl);
  if (remedy) item.remedy = remedy;
  if (check.lockedBy) item.lockedBy = check.lockedBy;
  return item;
}
