// Finds the subject in a photo, entirely in the browser, using Google MediaPipe
// image-segmentation models. Nothing is uploaded: the WebAssembly runtime is served
// from this site (/mediapipe/wasm, copied from node_modules at build time) and the
// models are fetched once from Google's public model bucket.

import type { ImageSegmenter } from "@mediapipe/tasks-vision";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/image_segmenter";
const PEOPLE_MODEL = `${MODEL_BASE}/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`;
const OBJECTS_MODEL = `${MODEL_BASE}/deeplab_v3/float32/latest/deeplab_v3.tflite`;

export type DetectMode = "people" | "people-objects";

const cache = new Map<string, Promise<ImageSegmenter>>();

async function getSegmenter(modelUrl: string): Promise<ImageSegmenter> {
  let p = cache.get(modelUrl);
  if (!p) {
    p = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const make = (delegate: "GPU" | "CPU") =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate },
          runningMode: "IMAGE",
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })();
    p.catch(() => cache.delete(modelUrl));
    cache.set(modelUrl, p);
  }
  return p;
}

/** Foreground probability (0..1) per pixel at the source's size: 1 − background. */
async function foreground(modelUrl: string, source: HTMLCanvasElement): Promise<Float32Array> {
  const seg = await getSegmenter(modelUrl);
  const result = seg.segment(source);
  try {
    const bg = result.confidenceMasks?.[0];
    if (!bg) throw new Error("The model returned no mask.");
    const raw = bg.getAsFloat32Array();
    const fg = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) fg[i] = 1 - raw[i];
    return resample(fg, bg.width, bg.height, source.width, source.height);
  } finally {
    result.close();
  }
}

function resample(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  if (sw === dw && sh === dh) return src;
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / dh - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / dw - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      const a = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx;
      const b = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx;
      out[y * dw + x] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

/** Mean filter with radius r over a w×h field (two separable running-sum passes). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = s / n;
      s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Guided filter (He et al.): snaps the blurry, low-resolution model mask to the real
 * edges in the photo — hair, fingers, clothing outlines.
 */
function guidedFilter(guide: Float32Array, p: Float32Array, w: number, h: number, r: number, eps: number) {
  const n = w * h;
  const Ip = new Float32Array(n);
  const II = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    Ip[i] = guide[i] * p[i];
    II[i] = guide[i] * guide[i];
  }
  const mI = boxBlur(guide, w, h, r);
  const mp = boxBlur(p, w, h, r);
  const mIp = boxBlur(Ip, w, h, r);
  const mII = boxBlur(II, w, h, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const cov = mIp[i] - mI[i] * mp[i];
    const v = mII[i] - mI[i] * mI[i];
    a[i] = cov / (v + eps);
    b[i] = mp[i] - a[i] * mI[i];
  }
  const ma = boxBlur(a, w, h, r);
  const mb = boxBlur(b, w, h, r);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = ma[i] * guide[i] + mb[i];
  return q;
}

/**
 * Returns a canvas the size of `source` whose alpha channel is the subject mask
 * (white where the subject is, transparent elsewhere).
 */
export async function segmentSubject(source: HTMLCanvasElement, mode: DetectMode): Promise<HTMLCanvasElement> {
  const w = source.width;
  const h = source.height;
  let fg = await foreground(PEOPLE_MODEL, source);
  if (mode === "people-objects") {
    const obj = await foreground(OBJECTS_MODEL, source);
    for (let i = 0; i < fg.length; i++) fg[i] = Math.max(fg[i], obj[i]);
  }

  const ctx = source.getContext("2d", { willReadFrequently: true })!;
  const px = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
  }
  const r = Math.max(2, Math.round(Math.min(w, h) / 200));
  fg = guidedFilter(gray, fg, w, h, r, 1e-3);

  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext("2d")!;
  const out = mctx.createImageData(w, h);
  for (let i = 0; i < fg.length; i++) {
    // contrast-stretch so the subject is solid and the background fully clear
    const a = Math.min(1, Math.max(0, (fg[i] - 0.3) / 0.4));
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = 255;
    out.data[i * 4 + 2] = 255;
    out.data[i * 4 + 3] = Math.round(a * 255);
  }
  mctx.putImageData(out, 0, 0);
  return mask;
}

/** Bounding box (image px) of the mask where alpha > 50%, or null if empty. */
export function maskBounds(mask: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const { width: w, height: h } = mask;
  const d = mask.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  // ignore specks: require a meaningful area
  if ((x1 - x0) * (y1 - y0) < w * h * 0.002) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
