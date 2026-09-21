import Card from "./ui/Card";
import eld from "./eld.module.css";
import styles from "./BaptismChart.module.css";

const MONTHS: [string, number, number][] = [
  ["Jan", 64, 21],
  ["Feb", 71, 24],
  ["Mar", 96, 33],
  ["Apr", 118, 40],
  ["May", 134, 44],
  ["Jun", 151, 49],
  ["Jul", 127, 41],
  ["Aug", 162, 58],
  ["Sep", 121, 38],
];
const MAX = 170;
const LEGEND: [string, string][] = [
  ["Salvations", "var(--indigo-700)"],
  ["Baptisms", "var(--ember-500)"],
];

export default function BaptismChart() {
  return (
    <Card>
      <div className={styles.head}>
        <h2 className={`${eld.num} ${styles.title}`}>Salvations & baptisms by month</h2>
        <div className={styles.legend}>
          {LEGEND.map(([t, c]) => (
            <span key={t} className={`${eld.label} ${styles.legendItem}`}>
              <i className={styles.swatch} style={{ background: c }} />
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.chart} style={{ gridTemplateColumns: `repeat(${MONTHS.length},1fr)` }}>
        {MONTHS.map(([m, s, b]) => (
          <div key={m} className={styles.col}>
            <div className={styles.bars}>
              <div title={`${s} salvations`} className={styles.barSal} style={{ height: `${(s / MAX) * 100}%` }} />
              <div title={`${b} baptisms`} className={styles.barBap} style={{ height: `${(b / MAX) * 100}%` }} />
            </div>
            <span className={eld.label} style={{ color: "var(--text-muted)" }}>
              {m}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
