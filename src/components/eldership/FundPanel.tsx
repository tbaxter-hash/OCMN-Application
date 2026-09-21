import Card from "./ui/Card";
import { ELDER_DATA, formatMoney } from "@/lib/eldershipData";
import eld from "./eld.module.css";
import styles from "./FundPanel.module.css";

interface Props {
  full?: boolean;
}

export default function FundPanel({ full = false }: Props) {
  const f = ELDER_DATA.fund;
  const total = f.designations.reduce((a, d) => a + d.amount, 0);
  const net = f.inflow - f.outflow;

  return (
    <Card padding="0" className={styles.card}>
      <div className={styles.header}>
        <div className={`${eld.label} ${styles.headerLabel}`}>Network bank account · balance</div>
        <div className={`${eld.num} ${styles.balance}`}>{formatMoney(f.balance)}</div>
        <div className={styles.headerRow}>
          <div>
            <div className={`${eld.label} ${styles.headerMuted}`}>In · {f.month}</div>
            <div className={`${eld.num} ${styles.headerFigure} ${styles.figureIn}`}>{formatMoney(f.inflow)}</div>
          </div>
          <div>
            <div className={`${eld.label} ${styles.headerMuted}`}>Out · {f.month}</div>
            <div className={`${eld.num} ${styles.headerFigure} ${styles.figureOut}`}>{formatMoney(f.outflow)}</div>
          </div>
          <div>
            <div className={`${eld.label} ${styles.headerMuted}`}>Net</div>
            <div className={`${eld.num} ${styles.headerFigure}`}>+{formatMoney(net)}</div>
          </div>
        </div>
      </div>
      <div className={styles.body}>
        <div className={`${eld.label} ${styles.sectionLabel}`}>How it is designated</div>
        <div className={styles.splitBar}>
          {f.designations.map((d) => (
            <div key={d.label} title={d.label} style={{ width: `${(d.amount / total) * 100}%`, background: d.color }} />
          ))}
        </div>
        <div className={styles.list}>
          {f.designations.map((d) => (
            <div key={d.label} className={styles.row}>
              <i className={styles.dot} style={{ background: d.color }} />
              <span className={styles.rowLabel}>{d.label}</span>
              <span className={styles.rowAmount}>{formatMoney(d.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      {full ? (
        <div className={styles.ledger}>
          <div className={`${eld.label} ${styles.sectionLabel}`}>Recent movement</div>
          <table className={styles.ledgerTable}>
            <tbody>
              {f.ledger.map((l, i) => (
                <tr key={i} className={i ? styles.ledgerRow : undefined}>
                  <td className={styles.ledgerDate}>{l.date}</td>
                  <td className={styles.ledgerMemo}>{l.memo}</td>
                  <td className={`${styles.ledgerAmount} ${l.amount < 0 ? styles.negative : styles.positive}`}>
                    {l.amount < 0 ? formatMoney(l.amount) : `+${formatMoney(l.amount)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
