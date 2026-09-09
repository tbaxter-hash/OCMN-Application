"use client";

import styles from "./FooterBar.module.css";

type Props =
  | {
      variant: "form";
      statusText: string;
      showSkip: boolean;
      onBack: () => void;
      onContinue: () => void;
      onSkip: () => void;
    }
  | {
      variant: "review";
      outstandingCount: number;
      onSubmit: () => void;
    };

export default function FooterBar(props: Props) {
  if (props.variant === "review") {
    const { outstandingCount, onSubmit } = props;
    return (
      <div className={`${styles.footerBar} ${styles.reviewBar}`}>
        <button type="button" className={styles.submitBtn} disabled={outstandingCount > 0} onClick={onSubmit}>
          {outstandingCount > 0 ? `Finish the last ${outstandingCount}` : "Submit application"}
        </button>
      </div>
    );
  }

  const { statusText, showSkip, onBack, onContinue, onSkip } = props;
  return (
    <div className={styles.footerBar}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        ← Back
      </button>
      <span className={styles.status}>{statusText}</span>
      {showSkip ? (
        <button type="button" className={styles.skipBtn} onClick={onSkip}>
          Skip for now
        </button>
      ) : null}
      <button type="button" className={styles.continueBtn} onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
