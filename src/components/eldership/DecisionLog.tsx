import Card from "./ui/Card";
import { ELDER_DATA } from "@/lib/eldershipData";
import type { DecisionOutcome } from "@/lib/eldershipTypes";
import eld from "./eld.module.css";
import styles from "./DecisionLog.module.css";

const TONE: Record<DecisionOutcome, string> = {
  Approved: "var(--success-600)",
  Held: "var(--warning-600)",
  Declined: "var(--danger-600)",
};

export default function DecisionLog() {
  return (
    <Card>
      <h2 className={`${eld.num} ${styles.title}`}>Decisions</h2>
      <p className={styles.subtitle}>A record of what the table has already settled.</p>
      <div>
        {ELDER_DATA.decisions.map((d, i) => (
          <div key={i} className={styles.item}>
            <div>
              <div className={styles.decisionTitle}>{d.title}</div>
              <div className={styles.decisionMeta}>
                {d.date} · {d.note}
              </div>
            </div>
            <span className={`${eld.label} ${styles.outcome}`} style={{ color: TONE[d.outcome] }}>
              {d.outcome}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
