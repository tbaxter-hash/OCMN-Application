import type { CSSProperties, ReactNode } from "react";
import styles from "./Card.module.css";

interface Props {
  children: ReactNode;
  padding?: string | number;
  style?: CSSProperties;
  className?: string;
}

export default function Card({ children, padding, style, className }: Props) {
  return (
    <div
      className={[styles.card, className].filter(Boolean).join(" ")}
      style={{ padding: padding ?? undefined, ...style }}
    >
      {children}
    </div>
  );
}
