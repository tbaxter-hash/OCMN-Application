"use client";

import { visibleQuestions } from "@/lib/derived";
import type { AnswerValue, Answers, Step } from "@/lib/types";
import QuestionField from "./QuestionField";
import styles from "./FormScreen.module.css";

interface Props {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  answers: Answers;
  showErr: boolean;
  missing: string[];
  onAnswer: (id: string, value: AnswerValue) => void;
}

export default function FormScreen({ step, stepIndex, totalSteps, answers, showErr, missing, onAnswer }: Props) {
  const questions = visibleQuestions(step, answers);

  return (
    <div className={styles.main}>
      <div className={styles.content}>
        <div className={styles.eyebrowRow}>
          <span className={styles.eyebrowPill}>{step.eyebrow}</span>
          <span className={styles.stepOf}>
            Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.intro}>{step.intro}</p>
        {step.notice ? <p className={styles.notice}>{step.notice}</p> : null}
        <div className={styles.questions}>
          {questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={onAnswer}
              invalid={showErr && missing.includes(q.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
