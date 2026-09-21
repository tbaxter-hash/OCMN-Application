"use client";

import Logo from "./ui/Logo";
import eld from "./eld.module.css";
import styles from "./ElderSidebar.module.css";

const NAV_ITEMS: [string, string][] = [
  ["overview", "Overview"],
  ["churches", "Churches"],
  ["fund", "Network fund"],
  ["updates", "Updates"],
  ["decisions", "Decisions"],
];

interface Props {
  active: string;
}

export default function ElderSidebar({ active }: Props) {
  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: "smooth" });
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Logo height={30} tone="white" />
      </div>
      <div className={`${eld.label} ${styles.section}`}>Eldership</div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map(([id, txt]) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => jump(id)}
              className={`${styles.navItem} ${on ? styles.navItemActive : ""}`}
            >
              {txt}
            </button>
          );
        })}
      </nav>
      <div className={styles.signedIn}>
        <div className={`${eld.label} ${styles.signedInLabel}`}>Signed in</div>
        <div className={styles.signedInName}>
          Pastor Chris Beard
          <br />
          <span className={styles.signedInRole}>Network elder · Cincinnati</span>
        </div>
      </div>
    </aside>
  );
}
