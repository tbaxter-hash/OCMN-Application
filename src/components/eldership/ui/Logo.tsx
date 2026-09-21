import styles from "./Logo.module.css";

interface Props {
  height?: number;
  tone?: "white" | "dark";
}

// Text wordmark — swap for an <Image> once a Peoples Church Network mark is available.
export default function Logo({ height = 30, tone = "dark" }: Props) {
  return (
    <div className={`${styles.logo} ${tone === "white" ? styles.white : styles.dark}`} style={{ fontSize: height * 0.42 }}>
      <span className={styles.mark}>Peoples Church</span>
      <span className={styles.sub}>Network</span>
    </div>
  );
}
