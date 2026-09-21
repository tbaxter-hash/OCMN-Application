import styles from "./StatBlock.module.css";

interface Props {
  value: string | number;
  label: string;
  color: string;
}

export default function StatBlock({ value, label, color }: Props) {
  return (
    <div>
      <div className={styles.value} style={{ color }}>
        {value}
      </div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
