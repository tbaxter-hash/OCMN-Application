import type { ReactNode } from "react";
import Eyebrow from "./ui/Eyebrow";
import eld from "./eld.module.css";
import styles from "./SectionHead.module.css";

interface Props {
  eyebrow: ReactNode;
  title: ReactNode;
  note?: ReactNode;
}

export default function SectionHead({ eyebrow, title, note }: Props) {
  return (
    <div className={styles.wrap}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={`${eld.num} ${styles.title}`}>{title}</h2>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}
