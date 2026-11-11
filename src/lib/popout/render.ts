// Draws the "pop-out" composite: a fixed rounded frame showing the photo, with the
// cut-out subject drawn over it so whatever falls outside the frame appears to step
// out of the picture.

export type Sides = { top: boolean; bottom: boolean; left: boolean; right: boolean };

/** The fixed slot every photo is rendered into — shared by all photos. */
export type SlotSettings = {
  frameW: number; // px
  frameH: number; // px
  radius: number; // px
  marginTop: number; // room above the frame for heads etc., % of frame height
  marginBottom: number; // % of frame height
  marginSide: number; // % of frame height, each side
  border: number; // px, white rim around the frame
  frameShadow: number; // 0..100
  subjectShadow: number; // 0..100
  fade: number; // 0..100 — fade out the subject below the frame
  background: string; // "transparent" or a CSS color
};

/** Per-photo placement behind the fixed frame. */
export type PhotoView = {
  scale: number; // output px per image px
  ox: number; // output x of the image's left edge
  oy: number; // output y of the image's top edge
  sides: Sides;
};

export type PhotoAssets = {
  image: HTMLCanvasElement; // working-resolution photo
  cutout: HTMLCanvasElement; // photo with the subject mask as alpha
  subject: { x: number; y: number; w: number; h: number } | null; // image px
};

export type SlotPreset = { id: string; label: string; slot: SlotSettings };

/** Church Hub sidebar card: ~1.7:1, rounded, room above, little room at the sides and below. */
export const DEFAULT_SLOT: SlotSettings = {
  frameW: 1200,
  frameH: 704,
  radius: 72,
  marginTop: 50,
  marginBottom: 8,
  marginSide: 8,
  border: 6,
  frameShadow: 45,
  subjectShadow: 50,
  fade: 0,
  background: "transparent",
};

export const SLOT_PRESETS: SlotPreset[] = [
  { id: "hub-sidebar", label: "Church Hub sidebar card", slot: DEFAULT_SLOT },
  {
    id: "wide-banner",
    label: "Wide banner (2:1)",
    slot: { ...DEFAULT_SLOT, frameW: 1600, frameH: 800, radius: 48, marginTop: 40, marginBottom: 30, marginSide: 16 },
  },
  {
    id: "landscape",
    label: "Landscape card (3:2)",
    slot: { ...DEFAULT_SLOT, frameW: 1200, frameH: 800, radius: 56, marginTop: 40, marginBottom: 25, marginSide: 14 },
  },
];

export function slotGeometry(s: SlotSettings) {
  const mt = Math.round((s.marginTop / 100) * s.frameH);
  const mb = Math.round((s.marginBottom / 100) * s.frameH);
  const ms = Math.round((s.marginSide / 100) * s.frameH);
  return {
    width: s.frameW + 2 * ms,
    height: s.frameH + mt + mb,
    frame: { x: ms, y: mt, w: s.frameW, h: s.frameH },
    mt,
    mb,
    ms,
  };
}

/** Smallest scale at which the photo still covers the whole frame. */
export function coverScale(s: SlotSettings, imgW: number, imgH: number) {
  return Math.max(s.frameW / imgW, s.frameH / imgH);
}

/** Keep the photo covering the frame (no empty corners inside the frame). */
export function clampView(s: SlotSettings, imgW: number, imgH: number, v: PhotoView): PhotoView {
  const { frame } = slotGeometry(s);
  const scale = Math.max(v.scale, coverScale(s, imgW, imgH));
  const w = imgW * scale;
  const h = imgH * scale;
  const ox = Math.min(frame.x, Math.max(frame.x + frame.w - w, v.ox));
  const oy = Math.min(frame.y, Math.max(frame.y + frame.h - h, v.oy));
  return { ...v, scale, ox, oy };
}

/**
 * First guess at a placement: the subject's middle sits inside the frame, the head
 * rises into the top margin and (if the photo shows them) the feet step into the
 * bottom margin.
 */
export function autoView(s: SlotSettings, a: PhotoAssets): PhotoView {
  const imgW = a.image.width;
  const imgH = a.image.height;
  const g = slotGeometry(s);
  const f = g.frame;
  const cover = coverScale(s, imgW, imgH);
  const sub = a.subject;
  if (!sub) {
    const scale = cover;
    return clampView(s, imgW, imgH, {
      scale,
      ox: f.x + (f.w - imgW * scale) / 2,
      oy: f.y + (f.h - imgH * scale) / 2,
      sides: { top: false, bottom: false, left: false, right: false },
    });
  }
  const touchesBottom = sub.y + sub.h >= imgH - 3;
  const touchesLeft = sub.x <= 3;
  const touchesRight = sub.x + sub.w >= imgW - 3;

  // where the subject's top and bottom should land (output px)
  const topTarget = f.y - g.mt * 0.82;
  const bottomTarget = touchesBottom ? f.y + f.h : f.y + f.h + g.mb * 0.8;
  const desired = (bottomTarget - topTarget) / sub.h;
  let scale = desired;
  // too wide for the canvas? shrink a little so arms etc. stay on the canvas; a very
  // wide subject (a group) keeps its height so it still rises out of the top, and is
  // trimmed at the frame's sides instead
  const maxW = g.width * 0.96;
  let trimSides = false;
  if (sub.w * scale > maxW) {
    scale = Math.max(maxW / sub.w, desired * 0.75);
    trimSides = sub.w * scale > maxW;
  }
  scale = Math.max(scale, cover);

  const cx = sub.x + sub.w / 2;
  const ox = f.x + f.w / 2 - cx * scale;
  // head lands in the room above the frame; a body cut off by the photo's bottom edge
  // simply continues down behind the frame's bottom edge (that side is turned off)
  const oy = topTarget - sub.y * scale;
  return clampView(s, imgW, imgH, {
    scale,
    ox,
    oy,
    sides: {
      top: true,
      bottom: !touchesBottom,
      left: !touchesLeft && !trimSides,
      right: !touchesRight && !trimSides,
    },
  });
}

let grainTile: HTMLCanvasElement | null = null;
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const x = c.getContext("2d")!;
  const d = x.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = n;
    d.data[i + 3] = 14;
  }
  x.putImageData(d, 0, 0);
  grainTile = c;
  return c;
}

const layers = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>();
function layerFor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let c = layers.get(ctx);
  if (!c) {
    c = document.createElement("canvas");
    layers.set(ctx, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

export type RenderOptions = {
  ghost?: boolean; // show the whole photo faintly (for brush cleanup)
};

export function renderComposite(
  ctx: CanvasRenderingContext2D,
  s: SlotSettings,
  a: PhotoAssets,
  v: PhotoView,
  opts: RenderOptions = {},
) {
  const g = slotGeometry(s);
  const W = g.width;
  const H = g.height;
  const f = g.frame;
  const r = Math.min(s.radius, f.w / 2, f.h / 2);
  const iw = a.image.width * v.scale;
  const ih = a.image.height * v.scale;
  const unit = f.h / 600; // keep shadows proportional to the slot size

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (s.background !== "transparent") {
    ctx.fillStyle = s.background;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
    ctx.fillRect(0, 0, W, H);
  }

  if (opts.ghost) {
    ctx.globalAlpha = 0.28;
    ctx.drawImage(a.image, v.ox, v.oy, iw, ih);
    ctx.globalAlpha = 1;
  }

  // frame shadow
  if (s.frameShadow > 0) {
    ctx.save();
    const k = s.frameShadow / 100;
    ctx.shadowColor = `rgba(30, 22, 10, ${0.45 * k})`;
    ctx.shadowBlur = 60 * unit * k;
    ctx.shadowOffsetY = 26 * unit * k;
    ctx.beginPath();
    ctx.roundRect(f.x, f.y, f.w, f.h, r);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }

  // photo inside the frame, with a touch of inner depth
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(f.x, f.y, f.w, f.h, r);
  ctx.clip();
  ctx.drawImage(a.image, v.ox, v.oy, iw, ih);
  const depth = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
  depth.addColorStop(0, "rgba(0,0,0,0.10)");
  depth.addColorStop(0.14, "rgba(0,0,0,0)");
  depth.addColorStop(0.86, "rgba(0,0,0,0)");
  depth.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = depth;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.restore();

  if (s.border > 0) {
    ctx.save();
    const b = s.border;
    ctx.beginPath();
    ctx.roundRect(f.x + b / 2, f.y + b / 2, f.w - b, f.h - b, Math.max(0, r - b / 2));
    ctx.lineWidth = b;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.restore();
  }

  // subject layer: cut-out, limited to the sides it may break through, faded at the bottom
  const layer = layerFor(ctx, W, H);
  const l = layer.getContext("2d")!;
  l.clearRect(0, 0, W, H);
  l.save();
  const BIG = 1e5;
  l.beginPath();
  l.roundRect(f.x, f.y, f.w, f.h, r);
  const L = v.sides.left ? -BIG : f.x;
  const R = v.sides.right ? BIG : f.x + f.w;
  const T = v.sides.top ? -BIG : f.y;
  const B = v.sides.bottom ? BIG : f.y + f.h;
  if (v.sides.top) l.rect(L, -BIG, R - L, BIG + f.y + f.h / 2);
  if (v.sides.bottom) l.rect(L, f.y + f.h / 2, R - L, BIG);
  if (v.sides.left) l.rect(-BIG, T, BIG + f.x + f.w / 2, B - T);
  if (v.sides.right) l.rect(f.x + f.w / 2, T, BIG, B - T);
  l.clip();
  l.drawImage(a.cutout, v.ox, v.oy, iw, ih);
  l.restore();

  if (s.fade > 0 && v.sides.bottom && a.subject) {
    const subBottom = v.oy + (a.subject.y + a.subject.h) * v.scale;
    const fb = f.y + f.h;
    if (subBottom > fb) {
      const start = fb + (subBottom - fb) * (1 - s.fade / 100);
      const grad = l.createLinearGradient(0, start, 0, subBottom);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,1)");
      l.save();
      l.globalCompositeOperation = "destination-out";
      l.fillStyle = grad;
      l.fillRect(0, start, W, H - start);
      l.restore();
    }
  }

  // cast shadow only where the subject is outside the frame (inside it, the subject
  // is part of the photo and already has its own lighting)
  if (s.subjectShadow > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.roundRect(f.x, f.y, f.w, f.h, r);
    ctx.clip("evenodd");
    const k = s.subjectShadow / 100;
    ctx.shadowColor = `rgba(25, 18, 8, ${0.5 * k})`;
    ctx.shadowBlur = 30 * unit * k;
    ctx.shadowOffsetX = 10 * unit * k;
    ctx.shadowOffsetY = 18 * unit * k;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/** HTML for placing an exported image so its frame fills a slot on a web page. */
export function embedSnippet(s: SlotSettings, src = "your-image.png") {
  const g = slotGeometry(s);
  const pct = (n: number) => `${+n.toFixed(4)}%`;
  return `<!-- The div is the designated image area. The picture overhangs it on purpose:
     leave about ${Math.round((g.mt / s.frameW) * 100)}% of its width free above it for heads. -->
<div style="position:relative; width:100%; aspect-ratio:${s.frameW} / ${s.frameH};">
  <img src="${src}" alt=""
       style="position:absolute; left:${pct((-g.ms / s.frameW) * 100)}; top:${pct((-g.mt / s.frameH) * 100)}; width:${pct((g.width / s.frameW) * 100)}; height:auto; max-width:none;">
</div>`;
}
