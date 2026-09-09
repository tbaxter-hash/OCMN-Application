import { STEPS } from "./questions";
import type { Answers, Question, Step } from "./types";

export function visibleSteps(answers: Answers): Step[] {
  return STEPS.filter((step) => !step.w || step.w(answers));
}

export function visibleQuestions(step: Step, answers: Answers): Question[] {
  return step.qs.filter((q) => !q.w || q.w(answers));
}

function isAnswered(value: Answers[string] | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}

export function missingRequired(step: Step, answers: Answers): string[] {
  return visibleQuestions(step, answers)
    .filter((q) => q.req && q.t !== "note" && !isAnswered(answers[q.id]))
    .map((q) => q.id);
}

export interface ProgressCounts {
  answered: number;
  total: number;
}

export function progressCounts(answers: Answers): ProgressCounts {
  let answered = 0;
  let total = 0;
  for (const step of visibleSteps(answers)) {
    for (const q of visibleQuestions(step, answers)) {
      if (q.t === "note") continue;
      total += 1;
      if (isAnswered(answers[q.id])) answered += 1;
    }
  }
  return { answered, total };
}

export interface OutstandingItem {
  stepIndex: number;
  step: Step;
  missing: string[];
}

export function outstanding(answers: Answers): OutstandingItem[] {
  const steps = visibleSteps(answers);
  const items: OutstandingItem[] = [];
  steps.forEach((step, stepIndex) => {
    if (step.id === "review") return;
    const missing = missingRequired(step, answers);
    if (missing.length) items.push({ stepIndex, step, missing });
  });
  return items;
}

export function outstandingCount(answers: Answers): number {
  return outstanding(answers).reduce((sum, item) => sum + item.missing.length, 0);
}
