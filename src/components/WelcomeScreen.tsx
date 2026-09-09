"use client";

import Image from "next/image";
import { PATHS } from "@/lib/questions";
import Sparkle from "./Sparkle";
import styles from "./WelcomeScreen.module.css";

const LOOK_FOR = [
  { label: "Affiliation", desc: "Assemblies of God churches, led by Assemblies of God ministers." },
  { label: "Education", desc: "Solid Bible literacy and sound theology." },
  { label: "Experience", desc: "You’ve led ministries and built teams." },
  { label: "Ability", desc: "Assessment shows entrepreneurial and leadership strength." },
];

interface Props {
  firstName?: string;
  savedAt?: string;
  hasSaved: boolean;
  onSelectPath: (pathId: string) => void;
  onResume: () => void;
}

export default function WelcomeScreen({ firstName, savedAt, hasSaved, onSelectPath, onResume }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.columns}>
        <div className={styles.left}>
          <Image
            src="/assets/logo-lockup-black.png"
            alt="Ohio Church Multiplication Network"
            width={1710}
            height={852}
            className={styles.logo}
            priority
          />
          <span className={styles.pill}>
            Planter <span className="ocmn-accent">Application</span>
            <Sparkle className={styles.sparkle} />
          </span>
          <h1 className={styles.h1}>
            <span>You have a dream.</span>
            <span className="ocmn-accent">We can help.</span>
          </h1>
          <p className={styles.body}>
            A guided application for planting a church, starting a dinner church, or sending
            out a plant from your church — built for the people OCMN partners with across Ohio.
          </p>
          <p className={styles.saveNote} id="ocmn-savenote">
            Your answers save as you go, so you can finish this in more than one sitting.
          </p>
          <div className={styles.lookFor} id="ocmn-lookfor">
            <span className={styles.eyebrow}>What we look for</span>
            <div className={styles.lookForGrid}>
              {LOOK_FOR.map((item) => (
                <div key={item.label}>
                  <div className={styles.lookForLabel}>{item.label}</div>
                  <div className={styles.lookForDesc}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <p className={styles.closing}>
            Not credentialed with the Assemblies of God yet? Not a problem — we’ll walk you
            through it right inside this application.
          </p>
        </div>

        <div className={styles.right}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Which best describes you?</h2>
            <p className={styles.cardSub}>We’ll only ask the questions that fit your path.</p>
            <div className={styles.pathList}>
              {PATHS.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  className={styles.pathRow}
                  onClick={() => onSelectPath(path.id)}
                >
                  <div className={styles.pathTitleRow}>
                    <span className={styles.pathTitle}>{path.title}</span>
                    <span className={styles.pathArrow}>→</span>
                  </div>
                  <span className={styles.pathDesc}>{path.desc}</span>
                </button>
              ))}
            </div>
            {hasSaved ? (
              <div className={styles.resumeDivider}>
                <span className={styles.resumeText}>
                  {firstName ? <span className={styles.resumeName}>{firstName}</span> : "Saved progress"}
                  {savedAt ? ` · Saved ${savedAt}` : null}
                </span>
                <button type="button" className={styles.resumeBtn} onClick={onResume}>
                  Resume
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
