"use client";

import { useState } from "react";
import Card from "./ui/Card";
import { ELDER_DATA } from "@/lib/eldershipData";
import type { TimelineKind } from "@/lib/eldershipTypes";
import eld from "./eld.module.css";
import styles from "./UpdateFeed.module.css";

type Filter = "all" | TimelineKind;

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["report", "Reports"],
  ["announcement", "Network"],
  ["decision", "Decisions"],
];

const META: Record<TimelineKind, { t: string; color: string }> = {
  announcement: { t: "Announcement", color: "var(--indigo-700)" },
  report: { t: "Church report", color: "var(--gold-600)" },
  decision: { t: "Decision", color: "var(--plum-600)" },
};

interface Props {
  limit?: number;
}

export default function UpdateFeed({ limit }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  let items = ELDER_DATA.timeline.filter((i) => filter === "all" || i.kind === filter);
  if (limit) items = items.slice(0, limit);

  return (
    <Card>
      <div className={styles.head}>
        <h2 className={`${eld.num} ${styles.title}`}>Updates</h2>
        <div className={styles.filters}>
          {FILTERS.map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`${eld.label} ${styles.filterBtn} ${filter === k ? styles.filterBtnActive : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        {items.map((i, n) => (
          <div key={n} className={styles.item}>
            <div className={styles.bar} style={{ background: META[i.kind].color }} />
            <div>
              <div className={styles.itemHead}>
                <span className={eld.label} style={{ color: META[i.kind].color }}>
                  {META[i.kind].t}
                </span>
                <span className={styles.itemMeta}>
                  {i.who} · {i.when}
                </span>
              </div>
              <div className={styles.itemTitle}>{i.title}</div>
              <p className={styles.itemBody}>{i.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
