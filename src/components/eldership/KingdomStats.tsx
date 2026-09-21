import Card from "./ui/Card";
import StatBlock from "./ui/StatBlock";
import { ELDER_DATA } from "@/lib/eldershipData";
import styles from "./KingdomStats.module.css";

export default function KingdomStats() {
  const y = ELDER_DATA.ytd;
  const cells = [
    { v: y.salvations.toLocaleString(), l: "Salvations year to date", c: "var(--indigo-700)" },
    { v: y.baptisms.toLocaleString(), l: "Baptisms year to date", c: "var(--ember-500)" },
    { v: y.churches, l: "Churches in the network", c: "var(--plum-600)" },
    { v: y.nations, l: "Nations represented", c: "var(--indigo-400)" },
  ];
  return (
    <Card padding="0" className={styles.card}>
      <div className={styles.grid}>
        {cells.map((c) => (
          <div key={c.l} className={styles.cell}>
            <StatBlock value={c.v} label={c.l} color={c.c} />
          </div>
        ))}
      </div>
    </Card>
  );
}
