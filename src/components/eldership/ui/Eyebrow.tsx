import type { ReactNode } from "react";
import styles from "./Eyebrow.module.css";

export default function Eyebrow({ children }: { children: ReactNode }) {
  return <span className={styles.eyebrow}>{children}</span>;
}
