"use client";

import { missingRequired, outstandingCount, visibleQuestions } from "@/lib/derived";
import type { AnswerValue, Answers, Step } from "@/lib/types";
import styles from "./ReviewScreen.module.css";

interface Props {
  steps: Step[];
  stepIndex: number;
  totalSteps: number;
  answers: Answers;
  onEdit: (idx: number) => void;
  onGoFirstIncomplete: () => void;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatValue(value: AnswerValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return `${value} / 5`;
  return String(value);
}

export default function ReviewScreen({ steps, stepIndex, totalSteps, answers, onEdit, onGoFirstIncomplete }: Props) {
  const reviewable = steps.filter((s) => s.id !== "review");
  const total = outstandingCount(answers);

  return (
    <div className={styles.main}>
      <div className={styles.content}>
        <div className={styles.eyebrowRow}>
          <span className={styles.eyebrowPill}>Finish</span>
          <span>
            Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>
        <h2 className={styles.title}>One last look</h2>
        <p className={styles.intro}>Check anything you want to change, then send it our way.</p>

        {total > 0 ? (
          <div className={styles.banner}>
            <span className={styles.bannerText}>
              A few answers are still needed — {total} in all.
            </span>
            <button type="button" className={styles.bannerBtn} onClick={onGoFirstIncomplete}>
              Take me there
            </button>
          </div>
        ) : null}

        <div className={styles.cards}>
          {reviewable.map((step) => {
            const idx = steps.indexOf(step);
            const missing = missingRequired(step, answers);
            const questions = visibleQuestions(step, answers).filter((q) => q.t !== "note");
            return (
              <div className={styles.card} key={step.id}>
                <div className={styles.cardHead}>
                  <div className={styles.cardHeadLeft}>
                    <span className={styles.cardName}>{step.label}</span>
                    <span className={`${styles.badge} ${missing.length === 0 ? styles.badgeComplete : styles.badgeIncomplete}`}>
                      {missing.length === 0 ? "Complete" : `${missing.length} left`}
                    </span>
                  </div>
                  <button type="button" className={styles.editLink} onClick={() => onEdit(idx)}>
                    Edit
                  </button>
                </div>
                {questions.map((q) => {
                  const raw = formatValue(answers[q.id]);
                  const hasValue = raw.trim().length > 0;
                  return (
                    <div className={styles.row} key={q.id}>
                      <span className={styles.rowLabel}>{truncate(q.l, 58)}</span>
                      <span className={`${styles.rowValue} ${hasValue ? "" : styles.rowValueEmpty}`}>
                        {hasValue ? truncate(raw, 120) : "Not answered yet"}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
