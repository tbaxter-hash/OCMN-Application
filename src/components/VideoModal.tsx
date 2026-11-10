"use client";

import { useEffect } from "react";
import { streamEmbedUrl } from "@/lib/videos";
import styles from "./VideoModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  videoId: string;
}

export default function VideoModal({ open, onClose, title, videoId }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const embedUrl = streamEmbedUrl(videoId);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close video">
            ✕
          </button>
        </div>
        <div className={styles.frameWrap}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={title}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon}>▶</span>
              <span className={styles.placeholderText}>
                Video coming soon — this will play once the Cloudflare Stream video is connected.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
