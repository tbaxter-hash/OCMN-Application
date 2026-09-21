import type { ReactNode } from "react";
import styles from "./Badge.module.css";

interface Props {
  children: ReactNode;
  live?: boolean;
}

export default function Badge({ children, live }: Props) {
  return (
    <span className={`${styles.badge} ${live ? styles.live : ""}`}>
      {live && <i className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
