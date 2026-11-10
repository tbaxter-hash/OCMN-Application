"use client";

import { useState } from "react";
import VideoModal from "./VideoModal";
import styles from "./VideoButton.module.css";

interface Props {
  label: string;
  videoTitle: string;
  videoId: string;
  variant?: "default" | "inline";
}

export default function VideoButton({ label, videoTitle, videoId, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={variant === "inline" ? styles.inlineBtn : styles.btn}
        onClick={() => setOpen(true)}
      >
        <span className={styles.playIcon}>▶</span>
        {label}
      </button>
      <VideoModal open={open} onClose={() => setOpen(false)} title={videoTitle} videoId={videoId} />
    </>
  );
}
