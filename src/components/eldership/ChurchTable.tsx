"use client";

import { useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { ELDER_DATA } from "@/lib/eldershipData";
import type { Church, ChurchStatus } from "@/lib/eldershipTypes";
import eld from "./eld.module.css";
import styles from "./ChurchTable.module.css";

type SortKey = "name" | "sal" | "bap" | "trend" | "report";

const STATUS_TEXT: Record<ChurchStatus, string> = {
  current: "Current",
  due: "Due",
  overdue: "Overdue",
};

const STATUS_CLASS: Record<ChurchStatus, string> = {
  current: "statusCurrent",
  due: "statusDue",
  overdue: "statusOverdue",
};

interface Props {
  limit?: number;
}

export default function ChurchTable({ limit }: Props) {
  const [sort, setSort] = useState<SortKey>("sal");

  const rows: Church[] = [...ELDER_DATA.churches].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : (b[sort] as number) - (a[sort] as number),
  );
  const shown = limit ? rows.slice(0, limit) : rows;

  const th = (key: SortKey, txt: string, align: "left" | "right" = "left") => (
    <th
      onClick={() => setSort(key)}
      className={`${eld.label} ${styles.th} ${sort === key ? styles.thActive : ""}`}
      style={{ textAlign: align }}
    >
      {txt}
    </th>
  );

  return (
    <Card>
      <div className={styles.head}>
        <h2 className={`${eld.num} ${styles.title}`}>Churches at a glance</h2>
        <span className={styles.hint}>Click a column to sort</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            {th("name", "Church")}
            {th("sal", "Salvations", "right")}
            {th("bap", "Baptisms", "right")}
            {th("trend", "Trend", "right")}
            {th("report", "Last report", "right")}
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => (
            <tr key={c.name} className={styles.row}>
              <td className={styles.cell}>
                <div className={styles.churchName}>{c.name}</div>
                <div className={styles.churchMeta}>
                  {c.city} · {c.pastor}
                </div>
              </td>
              <td className={`${styles.cell} ${styles.numCell} ${styles.sal}`}>{c.sal}</td>
              <td className={`${styles.cell} ${styles.numCell} ${styles.bap}`}>{c.bap}</td>
              <td className={`${styles.cell} ${styles.numCell} ${styles.trendCell} ${c.trend < 0 ? styles.trendDown : styles.trendUp}`}>
                {c.trend < 0 ? "▾ " : "▴ "}
                {Math.abs(c.trend)}%
              </td>
              <td className={`${styles.cell} ${styles.reportCell}`}>
                <div className={styles.reportDate}>{c.report}</div>
                <div className={`${eld.label} ${styles[STATUS_CLASS[c.status]]}`}>{STATUS_TEXT[c.status]}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit ? (
        <div className={styles.footer}>
          <Button variant="outline" size="sm">
            See all {rows.length} churches
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
