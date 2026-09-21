"use client";

import { useEffect, useState } from "react";
import ElderSidebar from "./ElderSidebar";
import ElderTopBar from "./ElderTopBar";
import SectionHead from "./SectionHead";
import KingdomStats from "./KingdomStats";
import BaptismChart from "./BaptismChart";
import EventsList from "./EventsList";
import ChurchTable from "./ChurchTable";
import FundPanel from "./FundPanel";
import DecisionLog from "./DecisionLog";
import UpdateFeed from "./UpdateFeed";
import styles from "./ElderApp.module.css";

const SECTION_IDS = ["overview", "churches", "fund", "updates", "decisions"];

export default function ElderApp() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      <ElderSidebar active={active} />
      <main className={styles.main}>
        <ElderTopBar />
        <section id="overview" className={`${styles.section} ${styles.sectionFirst}`}>
          <div className={styles.grid}>
            <KingdomStats />
            <div className={styles.overviewRow}>
              <BaptismChart />
              <EventsList />
            </div>
          </div>
        </section>
        <section id="churches" className={styles.section}>
          <SectionHead
            eyebrow="All eleven churches"
            title="Churches at a glance"
            note="Fruit year to date, month-over-month trend, and whether each church's report is in."
          />
          <ChurchTable />
        </section>
        <section id="fund" className={styles.section}>
          <SectionHead
            eyebrow="Network bank account"
            title="The fund"
            note="One account for the whole network — what came in, what went out, and where it is designated."
          />
          <div className={styles.fundRow}>
            <FundPanel full />
            <DecisionLog />
          </div>
        </section>
        <section id="updates" className={styles.section}>
          <SectionHead
            eyebrow="Reports & announcements"
            title="Updates"
            note="Church-submitted reports and word from the network office, in one timeline."
          />
          <UpdateFeed />
        </section>
        <section id="decisions" className={styles.section}>
          <SectionHead eyebrow="The elder table" title="Decisions" />
          <DecisionLog />
        </section>
      </main>
    </div>
  );
}
