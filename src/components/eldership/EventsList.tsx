import Card from "./ui/Card";
import { ELDER_DATA } from "@/lib/eldershipData";
import eld from "./eld.module.css";
import styles from "./EventsList.module.css";

export default function EventsList() {
  return (
    <Card>
      <h2 className={`${eld.num} ${styles.title}`}>Upcoming</h2>
      <div>
        {ELDER_DATA.events.map((e, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.date}>
              <div className={`${eld.num} ${styles.day}`}>{e.d}</div>
              <div className={`${eld.label} ${styles.month}`}>{e.m}</div>
            </div>
            <div>
              <div className={styles.eventTitle}>{e.title}</div>
              <div className={styles.eventMeta}>{e.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
