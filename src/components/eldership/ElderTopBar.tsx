import Eyebrow from "./ui/Eyebrow";
import Badge from "./ui/Badge";
import eld from "./eld.module.css";
import styles from "./ElderTopBar.module.css";

export default function ElderTopBar() {
  return (
    <div className={styles.bar}>
      <div>
        <Eyebrow>Peoples Church Network · September 2026</Eyebrow>
        <h1 className={`${eld.num} ${styles.title}`}>Network overview</h1>
      </div>
      <div className={styles.badges}>
        <Badge>11 churches</Badge>
        <Badge live>2 reports due</Badge>
      </div>
    </div>
  );
}
