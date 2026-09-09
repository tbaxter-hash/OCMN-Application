"use client";

import Image from "next/image";
import Sparkle from "./Sparkle";
import styles from "./ConfirmationScreen.module.css";

interface Props {
  firstName?: string;
  email?: string;
  onBackToStart: () => void;
}

export default function ConfirmationScreen({ firstName, email, onBackToStart }: Props) {
  const name = firstName || "there";
  return (
    <div className={styles.screen}>
      <Image src="/assets/emblem-black-900.png" alt="" width={96} height={96} className={styles.emblem} />
      <span className={styles.pill}>
        Application <span className="ocmn-accent">received</span>
        <Sparkle className={styles.sparkle} />
      </span>
      <h2 className={styles.h2}>No one goes it alone.</h2>
      <p className={styles.body}>
        Thank you, {name} — we received your application and are grateful you trusted us with
        it. Your three references will hear from us directly, and someone from our team will be
        in touch within five business days.
      </p>
      <p className={styles.body}>
        {email ? `A confirmation has been noted for ${email}. ` : ""}
        If anything changes in the meantime, reach us anytime at{" "}
        <a href="mailto:ocmn@ohioministry.net">ocmn@ohioministry.net</a>.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} onClick={onBackToStart}>
          Back to start
        </button>
        <a
          className={styles.secondaryBtn}
          href="https://www.ohiocmn.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore OCMN
        </a>
      </div>
    </div>
  );
}
