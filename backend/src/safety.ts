import { BadRequestException } from "@nestjs/common";
import type { QuestPlan, Insight } from "./shared";
// Deliberately conservative: rejected outputs are regenerated, never sent to a user.
const risky =
  /\b(eat|taste|ingest|edible|forag\w*|trespass\w*|off[- ]trail|swim\w*|wade|cliff\w*|climb\w*|chase|feed|touch|pick|pluck)\b/i;
export function assertSafe(plan: QuestPlan) {
  const text = [
    plan.title,
    plan.description,
    ...plan.steps.flatMap((s) => [s.title, s.instruction]),
    ...plan.bingo,
  ].join(" ");
  if (risky.test(text))
    throw new BadRequestException(
      "The suggestion did not pass the outdoor safety check",
    );
}
export function assertSafeInsight(insight: Insight) {
  if (risky.test([insight.label, insight.insight, insight.curiosity].join(" ")))
    throw new BadRequestException(
      "The observation did not pass the safety check",
    );
}
export function assertBudget(plan: QuestPlan, minutes: number) {
  if (plan.steps.reduce((sum, s) => sum + s.minutes, 0) !== minutes)
    throw new BadRequestException(
      "Quest durations do not match the requested time",
    );
}
