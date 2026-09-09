"use client";

import type { AnswerValue, Question } from "@/lib/types";
import styles from "./QuestionField.module.css";

interface Props {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (id: string, value: AnswerValue) => void;
  invalid: boolean;
}

export default function QuestionField({ question, value, onChange, invalid }: Props) {
  if (question.t === "note") {
    return (
      <div className={styles.field}>
        <p className={styles.note}>{question.l}</p>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={question.id}>
        {question.l}
        {question.req ? <span className={styles.asterisk}>*</span> : null}
      </label>
      {question.h ? <p className={styles.hint}>{question.h}</p> : null}
      <FieldControl question={question} value={value} onChange={onChange} invalid={invalid} />
      {invalid ? <p className={styles.error}>We need this one before you continue.</p> : null}
    </div>
  );
}

function FieldControl({ question, value, onChange, invalid }: Props) {
  switch (question.t) {
    case "text":
      return (
        <input
          id={question.id}
          className={`${styles.input} ${invalid ? styles.invalid : ""}`}
          type={question.it ?? "text"}
          placeholder={question.ph}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      );
    case "long": {
      const text = typeof value === "string" ? value : "";
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      return (
        <div>
          <textarea
            id={question.id}
            className={`${styles.textarea} ${invalid ? styles.invalid : ""}`}
            rows={4}
            placeholder={question.ph}
            value={text}
            onChange={(e) => onChange(question.id, e.target.value)}
          />
          <p className={styles.wordCount}>
            {words} word{words === 1 ? "" : "s"}
          </p>
        </div>
      );
    }
    case "radio":
      return (
        <div className={styles.optionList} role="radiogroup" aria-labelledby={question.id}>
          {(question.o ?? []).map((opt) => {
            const selected = value === opt;
            return (
              <button
                type="button"
                key={opt}
                className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                onClick={() => onChange(question.id, opt)}
                aria-pressed={selected}
              >
                <span className={styles.mark}>{selected ? "•" : ""}</span>
                <span className={styles.optionLabel}>{opt}</span>
              </button>
            );
          })}
        </div>
      );
    case "multi": {
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className={styles.optionList}>
          {(question.o ?? []).map((opt) => {
            const selected = selectedValues.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                onClick={() => {
                  const next = selected
                    ? selectedValues.filter((v) => v !== opt)
                    : [...selectedValues, opt];
                  onChange(question.id, next);
                }}
                aria-pressed={selected}
              >
                <span className={`${styles.mark} ${styles.markSquare}`}>{selected ? "✓" : ""}</span>
                <span className={styles.optionLabel}>{opt}</span>
              </button>
            );
          })}
        </div>
      );
    }
    case "scale": {
      const current = typeof value === "number" ? value : undefined;
      return (
        <div>
          <div className={styles.scaleRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`${styles.scaleBtn} ${current === n ? styles.scaleBtnSelected : ""}`}
                onClick={() => onChange(question.id, n)}
                aria-pressed={current === n}
              >
                {n}
              </button>
            ))}
          </div>
          <div className={styles.scaleEnds}>
            <span>{question.low}</span>
            <span>{question.high}</span>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
