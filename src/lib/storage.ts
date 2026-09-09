import { STORAGE_KEY } from "./questions";
import type { Answers } from "./types";

export interface SavedState {
  answers: Answers;
  idx: number;
  savedAt: string;
}

let cachedRaw: string | null = null;
let cachedSnapshot: SavedState | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Stable-reference snapshot getter for useSyncExternalStore: only parses and
// allocates a new object when the underlying storage value has changed.
export function getSavedSnapshot(): SavedState | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw();
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    cachedSnapshot = parsed && typeof parsed === "object" && parsed.answers ? (parsed as SavedState) : null;
  } catch {
    cachedSnapshot = null;
  }
  return cachedSnapshot;
}

export function getServerSavedSnapshot(): SavedState | null {
  return null;
}

export function subscribeSaved(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function persist(answers: Answers, idx: number): string {
  const savedAt = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const snapshot: SavedState = { answers, idx, savedAt };
  if (typeof window !== "undefined") {
    try {
      const raw = JSON.stringify(snapshot);
      window.localStorage.setItem(STORAGE_KEY, raw);
      // Set the cache to the known new value directly, rather than merely
      // invalidating it — `null` is a legitimate raw value (empty storage),
      // so nulling cachedRaw here would make a later real `null` read look
      // like a cache hit and return this stale snapshot.
      cachedRaw = raw;
      cachedSnapshot = snapshot;
    } catch {
      // storage unavailable (private browsing, quota) — autosave silently no-ops
    }
  }
  return savedAt;
}

export function clearSaved(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedRaw = null;
  cachedSnapshot = null;
}
