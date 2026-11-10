"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { maskBounds, segmentSubject, type DetectMode } from "@/lib/popout/segment";
import {
  DEFAULT_SLOT,
  SLOT_PRESETS,
  autoView,
  clampView,
  coverScale,
  embedSnippet,
  renderComposite,
  slotGeometry,
  type PhotoAssets,
  type PhotoView,
  type Sides,
  type SlotSettings,
} from "@/lib/popout/render";
import styles from "./PopOutStudio.module.css";

const SLOT_KEY = "ocmn-popout-slot-v1";
const MAX_WORK = 2048; // longest side of the working copy of each photo
const MAX_UNDO = 15;

type Tool = "move" | "erase" | "restore";

type Photo = {
  id: string;
  name: string;
  status: "processing" | "ready" | "error";
  error?: string;
  thumb?: string;
  assets?: PhotoAssets;
  mask?: HTMLCanvasElement;
  view?: PhotoView;
  detect: DetectMode;
  undo: ImageData[];
};

const BACKGROUNDS: { value: string; label: string }[] = [
  { value: "transparent", label: "Transparent (for the web page)" },
  { value: "#ffffff", label: "White" },
  { value: "#efe9de", label: "Paper" },
  { value: "#1d1f24", label: "Dark" },
];

function loadSlot(): SlotSettings {
  try {
    const raw = window.localStorage.getItem(SLOT_KEY);
    if (raw) return { ...DEFAULT_SLOT, ...JSON.parse(raw) };
  } catch {
    // storage unavailable
  }
  return DEFAULT_SLOT;
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser can't read that file. Try a JPG or PNG (iPhone HEIC photos may need converting).");
  }
  const k = Math.min(1, MAX_WORK / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

function makeThumb(src: HTMLCanvasElement) {
  const k = 160 / Math.max(src.width, src.height);
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

/** Rebuilds the cut-out (photo × mask) after the mask changes. */
function rebuildCutout(image: HTMLCanvasElement, mask: HTMLCanvasElement, cutout: HTMLCanvasElement) {
  cutout.width = image.width;
  cutout.height = image.height;
  const c = cutout.getContext("2d")!;
  c.clearRect(0, 0, cutout.width, cutout.height);
  c.globalCompositeOperation = "source-over";
  c.drawImage(image, 0, 0);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(mask, 0, 0);
  c.globalCompositeOperation = "source-over";
}

const noopSubscribe = () => () => {};

export default function PopOutStudio() {
  // render only on the client: the studio needs canvas and saved settings
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? <Studio /> : <div className={styles.page} />;
}

function Studio() {
  const [slot, setSlot] = useState<SlotSettings>(loadSlot);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [brush, setBrush] = useState(40);
  const [rev, setRev] = useState(0); // bumps when canvases change in place
  const [dragOver, setDragOver] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mockDark, setMockDark] = useState(false);

  const stageRef = useRef<HTMLCanvasElement>(null);
  const mockRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; view: PhotoView }
    | { kind: "brush"; last: { x: number; y: number } }
    | null
  >(null);
  const photosRef = useRef(photos);
  const slotRef = useRef(slot);
  useLayoutEffect(() => {
    photosRef.current = photos;
    slotRef.current = slot;
  });

  const active = photos.find((p) => p.id === activeId) ?? null;
  const geo = slotGeometry(slot);

  // ---- persistence of the shared slot settings ----
  useEffect(() => {
    try {
      window.localStorage.setItem(SLOT_KEY, JSON.stringify(slot));
    } catch {
      // ignore
    }
  }, [slot]);

  const updatePhoto = useCallback((id: string, patch: Partial<Photo>) => {
    setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  // ---- processing ----
  const detectPhoto = useCallback(
    async (id: string, image: HTMLCanvasElement, detect: DetectMode, keepView: boolean) => {
      const mask = await segmentSubject(image, detect);
      const cutout = document.createElement("canvas");
      rebuildCutout(image, mask, cutout);
      const assets: PhotoAssets = { image, cutout, subject: maskBounds(mask) };
      const prev = photosRef.current.find((p) => p.id === id)?.view;
      const view = keepView && prev ? prev : autoView(slotRef.current, assets);
      updatePhoto(id, { status: "ready", assets, mask, view, detect, undo: [], error: undefined });
    },
    [updatePhoto],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
      if (!list.length) return;
      const items: Photo[] = list.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        status: "processing",
        detect: "people",
        undo: [],
      }));
      setPhotos((ps) => [...ps, ...items]);
      setActiveId((cur) => cur ?? items[0].id);
      items.forEach((item, i) => {
        queue.current = queue.current.then(async () => {
          try {
            const image = await fileToCanvas(list[i]);
            updatePhoto(item.id, { thumb: makeThumb(image) });
            await detectPhoto(item.id, image, "people", false);
          } catch (e) {
            updatePhoto(item.id, {
              status: "error",
              error: e instanceof Error ? e.message : "Something went wrong reading this photo.",
            });
          }
        });
      });
    },
    [detectPhoto, updatePhoto],
  );

  // paste from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // ---- drawing ----
  const draw = useCallback(() => {
    const canvas = stageRef.current;
    const p = photosRef.current.find((x) => x.id === activeId);
    if (!canvas) return;
    const g = slotGeometry(slot);
    if (canvas.width !== g.width) canvas.width = g.width;
    if (canvas.height !== g.height) canvas.height = g.height;
    const ctx = canvas.getContext("2d")!;
    const ghost = tool !== "move";
    if (p?.status === "ready" && p.assets && p.view) {
      renderComposite(ctx, slot, p.assets, p.view, { ghost });
      // brush cursor
      if (ghost && pointer.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pointer.current.x, pointer.current.y, brush, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = tool === "erase" ? "rgba(201,58,58,0.95)" : "rgba(31,138,76,0.95)";
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // empty slot: show where the frame is
      ctx.clearRect(0, 0, g.width, g.height);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(g.frame.x, g.frame.y, g.frame.w, g.frame.h, Math.min(slot.radius, g.frame.h / 2));
      ctx.fillStyle = "rgba(53,99,214,0.06)";
      ctx.fill();
      ctx.setLineDash([18, 14]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(53,99,214,0.55)";
      ctx.stroke();
      ctx.restore();
    }

    // live mock of the page slot
    const mock = mockRef.current;
    if (mock) {
      if (mock.width !== g.width) mock.width = g.width;
      if (mock.height !== g.height) mock.height = g.height;
      const m = mock.getContext("2d")!;
      if (p?.status === "ready" && p.assets && p.view) {
        if (ghost) renderComposite(m, slot, p.assets, p.view);
        else {
          m.clearRect(0, 0, g.width, g.height);
          m.drawImage(canvas, 0, 0);
        }
      } else {
        m.clearRect(0, 0, g.width, g.height);
        m.beginPath();
        m.roundRect(g.frame.x, g.frame.y, g.frame.w, g.frame.h, Math.min(slot.radius, g.frame.h / 2));
        m.fillStyle = "rgba(120,130,150,0.25)";
        m.fill();
      }
    }
  }, [activeId, slot, tool, brush]);

  useEffect(() => {
    draw();
  }, [draw, photos, rev]);

  // re-fit views when the slot shape changes so the photo still covers the frame
  const prevSlot = useRef(slot);
  useEffect(() => {
    const a = prevSlot.current;
    prevSlot.current = slot;
    const shapeChanged =
      a.frameW !== slot.frameW ||
      a.frameH !== slot.frameH ||
      a.marginTop !== slot.marginTop ||
      a.marginBottom !== slot.marginBottom ||
      a.marginSide !== slot.marginSide;
    if (!shapeChanged) return;
    setPhotos((ps) =>
      ps.map((p) => (p.status === "ready" && p.assets ? { ...p, view: autoView(slot, p.assets) } : p)),
    );
  }, [slot]);

  // ---- pointer interaction on the stage ----
  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };

  const paint = (p: Photo, from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!p.mask || !p.assets || !p.view) return;
    const v = p.view;
    const m = p.mask.getContext("2d", { willReadFrequently: true })!;
    const rad = brush / v.scale;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / (brush * 0.25)));
    m.save();
    m.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ix = (from.x + (to.x - from.x) * t - v.ox) / v.scale;
      const iy = (from.y + (to.y - from.y) * t - v.oy) / v.scale;
      const grad = m.createRadialGradient(ix, iy, rad * 0.6, ix, iy, rad);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      m.fillStyle = grad;
      m.beginPath();
      m.arc(ix, iy, rad, 0, Math.PI * 2);
      m.fill();
    }
    m.restore();
    rebuildCutout(p.assets.image, p.mask, p.assets.cutout);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || active.status !== "ready" || !active.view || !active.mask) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toCanvas(e);
    pointer.current = pt;
    if (tool === "move") {
      drag.current = { kind: "pan", startX: pt.x, startY: pt.y, view: active.view };
    } else {
      const m = active.mask.getContext("2d", { willReadFrequently: true })!;
      const snap = m.getImageData(0, 0, active.mask.width, active.mask.height);
      const undo = [...active.undo, snap].slice(-MAX_UNDO);
      updatePhoto(active.id, { undo });
      drag.current = { kind: "brush", last: pt };
      paint(active, pt, pt);
      setRev((r) => r + 1);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toCanvas(e);
    pointer.current = pt;
    const d = drag.current;
    if (d && active?.assets) {
      if (d.kind === "pan") {
        const v = clampView(slot, active.assets.image.width, active.assets.image.height, {
          ...d.view,
          ox: d.view.ox + (pt.x - d.startX),
          oy: d.view.oy + (pt.y - d.startY),
        });
        updatePhoto(active.id, { view: v });
        return;
      }
      paint(active, d.last, pt);
      d.last = pt;
    }
    if (tool !== "move") requestAnimationFrame(() => setRev((r) => r + 1));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "brush" && active?.assets && active.mask) {
      const subject = maskBounds(active.mask);
      updatePhoto(active.id, { assets: { ...active.assets, subject } });
    }
  };

  const onPointerLeave = () => {
    pointer.current = null;
    if (tool !== "move") setRev((r) => r + 1);
  };

  // ---- photo controls ----
  const setView = (patch: Partial<PhotoView>) => {
    if (!active?.assets || !active.view) return;
    updatePhoto(active.id, {
      view: clampView(slot, active.assets.image.width, active.assets.image.height, { ...active.view, ...patch }),
    });
  };

  const zoom = active?.assets && active.view ? active.view.scale / coverScale(slot, active.assets.image.width, active.assets.image.height) : 1;

  const setZoom = (z: number) => {
    if (!active?.assets || !active.view) return;
    const v = active.view;
    const scale = z * coverScale(slot, active.assets.image.width, active.assets.image.height);
    const f = geo.frame;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const ix = (cx - v.ox) / v.scale;
    const iy = (cy - v.oy) / v.scale;
    setView({ scale, ox: cx - ix * scale, oy: cy - iy * scale });
  };

  const toggleSide = (side: keyof Sides) => {
    if (!active?.view) return;
    setView({ sides: { ...active.view.sides, [side]: !active.view.sides[side] } });
  };

  const undo = () => {
    if (!active?.mask || !active.assets || !active.undo.length) return;
    const snap = active.undo[active.undo.length - 1];
    active.mask.getContext("2d", { willReadFrequently: true })!.putImageData(snap, 0, 0);
    rebuildCutout(active.assets.image, active.mask, active.assets.cutout);
    updatePhoto(active.id, {
      undo: active.undo.slice(0, -1),
      assets: { ...active.assets, subject: maskBounds(active.mask) },
    });
  };

  const redetect = (mode: DetectMode) => {
    if (!active?.assets) return;
    const { id } = active;
    const image = active.assets.image;
    updatePhoto(id, { status: "processing", detect: mode });
    queue.current = queue.current.then(() =>
      detectPhoto(id, image, mode, true).catch((e) =>
        updatePhoto(id, { status: "error", error: e instanceof Error ? e.message : String(e) }),
      ),
    );
  };

  const removePhoto = (id: string) => {
    setPhotos((ps) => {
      const next = ps.filter((p) => p.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const exportPng = (p: Photo): Promise<Blob | null> => {
    if (!p.assets || !p.view) return Promise.resolve(null);
    const c = document.createElement("canvas");
    c.width = geo.width;
    c.height = geo.height;
    renderComposite(c.getContext("2d")!, slot, p.assets, p.view);
    return new Promise((res) => c.toBlob(res, "image/png"));
  };

  const download = async (p: Photo) => {
    const blob = await exportPng(p);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(p.name)}-popout.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadAll = async () => {
    for (const p of photos) {
      if (p.status === "ready") {
        await download(p);
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  };

  const snippet = embedSnippet(slot, active ? `${baseName(active.name)}-popout.png` : "your-image.png");
  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked; the text is selectable
    }
  };

  const setSlotField = <K extends keyof SlotSettings>(k: K, v: SlotSettings[K]) => setSlot((s) => ({ ...s, [k]: v }));
  const presetId = SLOT_PRESETS.find((p) =>
    (Object.keys(p.slot) as (keyof SlotSettings)[]).every((k) => p.slot[k] === slot[k]),
  )?.id;
  const readyCount = photos.filter((p) => p.status === "ready").length;

  // mock sizing: the hub's sidebar card is ~296px wide
  const mockCardW = 280;
  const mockScale = mockCardW / slot.frameW;

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.brand}>
          <Image src="/assets/emblem-black-900.png" alt="" width={36} height={36} className={styles.emblem} />
          <span className={styles.brandText}>
            Pop-out Photo Studio
            <span>Turn photos into 3D images that step out of their frame</span>
          </span>
        </Link>
        <div className={styles.actions}>
          <button className={styles.secondaryBtn} onClick={() => fileRef.current?.click()}>
            Add photos
          </button>
          <button
            className={styles.primaryBtn}
            disabled={active?.status !== "ready"}
            onClick={() => active && download(active)}
          >
            Download PNG
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </header>

      <main className={styles.main}>
        <section
          className={`${styles.stageCol} ${dragOver ? styles.dragOver : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <div className={`${styles.stageWrap} ${slot.background === "transparent" ? styles.checker : ""}`}>
            <canvas
              ref={stageRef}
              className={`${styles.stage} ${tool === "move" ? styles.grab : styles.brushCursor}`}
              style={{ aspectRatio: `${geo.width} / ${geo.height}` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerLeave}
            />
            {!active && (
              <button className={styles.dropHint} onClick={() => fileRef.current?.click()}>
                <strong>Drop photos here</strong>
                <span>or click to choose · you can also paste an image</span>
                <small>Photos of people work best — full-body or waist-up, subject not cut off at the top.</small>
              </button>
            )}
            {active?.status === "processing" && (
              <div className={styles.overlay}>
                <div className={styles.spinner} />
                <strong>Finding the person…</strong>
                <span>The first photo also downloads the detection model (~16 MB). Everything stays on this computer.</span>
              </div>
            )}
            {active?.status === "error" && (
              <div className={styles.overlay}>
                <strong>Couldn&rsquo;t process this photo</strong>
                <span>{active.error}</span>
              </div>
            )}
          </div>

          {active?.status === "ready" && !active.assets?.subject && (
            <p className={styles.notice}>
              No person was found in this photo. Choose <b>Restore</b> and paint over what should pop out, or try
              &ldquo;People + objects&rdquo;.
            </p>
          )}
          <p className={styles.hint}>
            {tool === "move"
              ? "Drag the photo to reposition it behind the frame. The frame stays fixed — it's the spot on your page."
              : tool === "erase"
                ? "Paint over anything that shouldn't pop out (a bag strap, a car, background people)."
                : "Paint over anything that should pop out but was missed. The faded photo shows what you can bring back."}
          </p>

          {photos.length > 0 && (
            <div className={styles.strip}>
              {photos.map((p) => (
                <div key={p.id} className={`${styles.thumb} ${p.id === activeId ? styles.thumbActive : ""}`}>
                  <button className={styles.thumbBtn} onClick={() => setActiveId(p.id)} title={p.name}>
                    {p.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb} alt={p.name} />
                    ) : (
                      <span className={styles.thumbEmpty} />
                    )}
                    {p.status === "processing" && <span className={styles.thumbBadge}>…</span>}
                    {p.status === "error" && <span className={`${styles.thumbBadge} ${styles.thumbErr}`}>!</span>}
                  </button>
                  <button className={styles.thumbRemove} onClick={() => removePhoto(p.id)} aria-label={`Remove ${p.name}`}>
                    ×
                  </button>
                </div>
              ))}
              <button className={styles.thumbAdd} onClick={() => fileRef.current?.click()} aria-label="Add photos">
                +
              </button>
              {readyCount > 1 && (
                <button className={styles.linkBtn} onClick={downloadAll}>
                  Download all ({readyCount})
                </button>
              )}
            </div>
          )}

          <div className={styles.mockSection}>
            <div className={styles.mockHead}>
              <h2>On your page</h2>
              <div className={styles.segmented}>
                <button className={!mockDark ? styles.segOn : ""} onClick={() => setMockDark(false)}>
                  Light
                </button>
                <button className={mockDark ? styles.segOn : ""} onClick={() => setMockDark(true)}>
                  Dark
                </button>
              </div>
            </div>
            <div className={`${styles.mockSidebar} ${mockDark ? styles.mockDark : ""}`}>
              <div className={styles.mockNav}>
                <span className={styles.mockNavActive}>Ohio for Jesus</span>
                <span>Events</span>
                <span>Missions</span>
                <span>Resources</span>
              </div>
              <div className={styles.mockRule} />
              <div
                className={styles.mockSlot}
                style={{
                  width: mockCardW,
                  height: slot.frameH * mockScale,
                  marginTop: geo.mt * mockScale,
                  marginBottom: Math.max(10, geo.mb * mockScale),
                }}
              >
                <canvas
                  ref={mockRef}
                  className={styles.mockImg}
                  style={{
                    left: -geo.ms * mockScale,
                    top: -geo.mt * mockScale,
                    width: geo.width * mockScale,
                    height: geo.height * mockScale,
                  }}
                />
              </div>
              <span className={styles.mockLink}>OMN home ›</span>
              <span className={styles.mockTeam}>Team</span>
            </div>
          </div>
        </section>

        <aside className={styles.panel}>
          {active?.status === "ready" && active.view && (
            <div className={styles.group}>
              <h3>This photo</h3>
              <div className={styles.segmented} role="group" aria-label="Tool">
                {(["move", "erase", "restore"] as Tool[]).map((t) => (
                  <button key={t} className={tool === t ? styles.segOn : ""} onClick={() => setTool(t)}>
                    {t === "move" ? "Move" : t === "erase" ? "Erase" : "Restore"}
                  </button>
                ))}
              </div>
              {tool !== "move" && (
                <>
                  <Slider label="Brush size" min={6} max={160} value={brush} onChange={setBrush} />
                  <button className={styles.smallBtn} onClick={undo} disabled={!active.undo.length}>
                    Undo stroke
                  </button>
                </>
              )}
              <Slider
                label="Zoom"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                display={`${zoom.toFixed(2)}×`}
                onChange={setZoom}
              />
              <div className={styles.fieldLabel}>Pop out past the frame</div>
              <div className={styles.sides}>
                {(["top", "left", "right", "bottom"] as (keyof Sides)[]).map((s) => (
                  <label key={s} className={styles.check}>
                    <input type="checkbox" checked={active.view!.sides[s]} onChange={() => toggleSide(s)} />
                    {s[0].toUpperCase() + s.slice(1)}
                  </label>
                ))}
              </div>
              <div className={styles.fieldLabel}>Detect</div>
              <div className={styles.segmented}>
                <button className={active.detect === "people" ? styles.segOn : ""} onClick={() => redetect("people")}>
                  People
                </button>
                <button
                  className={active.detect === "people-objects" ? styles.segOn : ""}
                  onClick={() => redetect("people-objects")}
                >
                  People + objects
                </button>
              </div>
              <button
                className={styles.smallBtn}
                onClick={() => active.assets && updatePhoto(active.id, { view: autoView(slot, active.assets) })}
              >
                Auto-place again
              </button>
            </div>
          )}

          <div className={styles.group}>
            <h3>Image area (same for every photo)</h3>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Preset</span>
              <select
                value={presetId ?? "custom"}
                onChange={(e) => {
                  const p = SLOT_PRESETS.find((x) => x.id === e.target.value);
                  if (p) setSlot({ ...p.slot, background: slot.background });
                }}
              >
                {SLOT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                {!presetId && <option value="custom">Custom</option>}
              </select>
            </label>
            <div className={styles.pair}>
              <NumberField label="Frame width" value={slot.frameW} min={200} max={4000} onChange={(v) => setSlotField("frameW", v)} />
              <NumberField label="Frame height" value={slot.frameH} min={100} max={4000} onChange={(v) => setSlotField("frameH", v)} />
            </div>
            <Slider label="Corner rounding" min={0} max={200} value={slot.radius} onChange={(v) => setSlotField("radius", v)} />
            <Slider label="Room above" min={0} max={100} value={slot.marginTop} display={`${slot.marginTop}%`} onChange={(v) => setSlotField("marginTop", v)} />
            <Slider label="Room below" min={0} max={100} value={slot.marginBottom} display={`${slot.marginBottom}%`} onChange={(v) => setSlotField("marginBottom", v)} />
            <Slider label="Room at the sides" min={0} max={60} value={slot.marginSide} display={`${slot.marginSide}%`} onChange={(v) => setSlotField("marginSide", v)} />
            <p className={styles.small}>
              Output: {geo.width} × {geo.height}px PNG. &ldquo;Room&rdquo; is how far people can step out, as a % of the
              frame height.
            </p>
          </div>

          <div className={styles.group}>
            <h3>Look</h3>
            <Slider label="White rim" min={0} max={30} value={slot.border} display={`${slot.border}px`} onChange={(v) => setSlotField("border", v)} />
            <Slider label="Frame shadow" min={0} max={100} value={slot.frameShadow} onChange={(v) => setSlotField("frameShadow", v)} />
            <Slider label="Person shadow" min={0} max={100} value={slot.subjectShadow} onChange={(v) => setSlotField("subjectShadow", v)} />
            <Slider label="Fade below frame" min={0} max={100} value={slot.fade} onChange={(v) => setSlotField("fade", v)} />
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Background</span>
              <select value={slot.background} onChange={(e) => setSlotField("background", e.target.value)}>
                {BACKGROUNDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.smallBtn} onClick={() => setSlot({ ...DEFAULT_SLOT })}>
              Reset to Church Hub defaults
            </button>
          </div>

          <div className={styles.group}>
            <button className={styles.disclosure} onClick={() => setShowCode((s) => !s)} aria-expanded={showCode}>
              {showCode ? "▾" : "▸"} Code for your web page
            </button>
            {showCode && (
              <>
                <p className={styles.small}>
                  The box is the designated image area; the PNG overhangs it so people can step out. Every image
                  made with these settings fits the same box.
                </p>
                <pre className={styles.code}>{snippet}</pre>
                <button className={styles.smallBtn} onClick={copySnippet}>
                  {copied ? "Copied" : "Copy code"}
                </button>
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{props.label}</span>
        <span className={styles.fieldValue}>{props.display ?? props.value}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(+e.target.value)}
      />
    </label>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null); // text while editing
  const text = draft ?? String(props.value);
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{props.label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Math.round(Number(text));
          if (text.trim() !== "" && Number.isFinite(n)) props.onChange(Math.min(props.max, Math.max(props.min, n)));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}
