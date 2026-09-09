"use client";

import Image from "next/image";
import { missingRequired, outstandingCount, progressCounts } from "@/lib/derived";
import type { Answers, Step } from "@/lib/types";
import styles from "./Sidebar.module.css";

interface Props {
  steps: Step[];
  currentIdx: number;
  answers: Answers;
  onJump: (idx: number) => void;
  onGoWelcome: () => void;
}

export default function Sidebar({ steps, currentIdx, answers, onJump, onGoWelcome }: Props) {
  const { answered, total } = progressCounts(answers);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const groups: { name: string; items: { step: Step; idx: number }[] }[] = [];
  steps.forEach((step, idx) => {
    let group = groups.find((g) => g.name === step.group);
    if (!group) {
      group = { name: step.group, items: [] };
      groups.push(group);
    }
    group.items.push({ step, idx });
  });

  return (
    <aside className={styles.sidebar}>
      <button type="button" className={styles.brand} onClick={onGoWelcome}>
        <Image src="/assets/emblem-black-900.png" alt="" width={48} height={48} className={styles.emblem} />
        <span className={styles.brandText}>
          OCMN
          <span>Planter Application</span>
        </span>
      </button>

      <div className={styles.progress}>
        <div className={styles.progressTop}>
          <span className={styles.eyebrow}>Progress</span>
          <span className={styles.percent}>{pct}%</span>
        </div>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.count}>
          {answered} of {total} answered
        </span>
      </div>

      <nav className={styles.nav}>
        {groups.map((group) => (
          <div className={styles.group} key={group.name}>
            <div className={styles.groupHeader}>
              <span className={styles.groupDot} />
              <span className={styles.groupLabel}>{group.name}</span>
            </div>
            {group.items.map(({ step, idx }) => {
              const isCurrent = idx === currentIdx;
              const isComplete =
                step.id === "review" ? outstandingCount(answers) === 0 : missingRequired(step, answers).length === 0;
              return (
                <button
                  type="button"
                  key={step.id}
                  className={`${styles.item} ${isCurrent ? styles.itemCurrent : ""}`}
                  onClick={() => onJump(idx)}
                >
                  <span
                    className={`${styles.dot} ${isCurrent ? styles.dotCurrent : isComplete ? styles.dotComplete : ""}`}
                  >
                    {!isCurrent && isComplete ? "✓" : ""}
                  </span>
                  <span className={`${styles.label} ${isCurrent ? styles.labelCurrent : ""}`}>{step.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        Questions? Email <a href="mailto:ocmn@ohioministry.net">ocmn@ohioministry.net</a> or call
        (614) 396-0700.
      </div>
    </aside>
  );
}
