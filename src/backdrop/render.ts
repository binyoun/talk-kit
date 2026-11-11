import { theme, font, type Theme } from '../shared/theme';
import { drawIcon } from '../shared/icons';
import { wrap } from '../shared/text';
import type { BackdropState, SafeArea, Speaker } from './state';

export const W = 1920;
export const H = 1080;
const MY = 80; // top / bottom margin

const ASPECT: Record<SafeArea | '1:1', number> = { '16:9': 16 / 9, '3:2': 3 / 2, '4:3': 4 / 3, '1:1': 1 };

/** Horizontal pixels a tile of this aspect cuts off each side of a 16:9 frame. */
export function tileInset(a: SafeArea | '1:1'): number {
  return Math.max(0, (W - H * ASPECT[a]) / 2);
}

export interface RenderExtras {
  /** Draw the centre "you sit here" guide. Preview only. */
  guide?: boolean;
  /** Draw what 3:2, 4:3 and square meeting tiles keep. Preview only. */
  tiles?: boolean;
  /** Flip horizontally, as your own Zoom preview shows it. Preview only. */
  mirror?: boolean;
  /** Pre-rendered QR code for `state.website`. */
  qr?: HTMLCanvasElement | null;
  /** Optional logo. */
  logo?: HTMLImageElement | null;
  /** Background image when `state.bg === 'image'`. */
  image?: HTMLImageElement | null;
  /** Which speaker's name to draw. */
  speaker?: number;
}

export function render(canvas: HTMLCanvasElement, s: BackdropState, x: RenderExtras = {}): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const t = theme(s.mode, s.accent);
  const sx = Math.max(96, tileInset(s.safe) + 64); // side margin that survives the chosen tile
  const sp: Speaker = s.speakers[x.speaker ?? 0] ?? s.speakers[0] ?? { name: '', role: '' };

  ctx.save();
  if (x.mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }

  drawBackground(ctx, s, t, sx, x.image ?? null);

  if (s.layout === 'top') drawTop(ctx, s, t, sx, sp, x);
  else drawCorners(ctx, s, t, sx, sp, x);

  ctx.restore();

  // --- preview-only guides (never mirrored, never exported) ---
  if (x.tiles) drawTileGuides(ctx, s);
  if (x.guide) {
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexA(s.accent, 0.7);
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.6, 330, 430, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = font(500, 26);
    ctx.fillStyle = hexA(s.accent, 0.9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('you sit here', W / 2, H * 0.6);
    ctx.restore();
  }
}

// --- layouts -------------------------------------------------------------------------

/** ISEA-style: title block top-left, speaker top-right, everything above head height. */
function drawTop(ctx: CanvasRenderingContext2D, s: BackdropState, t: Theme, sx: number, sp: Speaker, x: RenderExtras): void {
  // left block may run until the right column (≈ 520 px reserved for name and links)
  const leftW = W - sx * 2 - 560;
  drawTitleBlock(ctx, s, t, sx, MY, leftW);

  // right column, right-aligned
  const rx = W - sx;
  let y = MY;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  if (sp.name.trim()) {
    ctx.font = font(700, 40);
    ctx.fillStyle = t.fg;
    ctx.fillText(sp.name, rx, y);
    y += 52;
  }
  if (sp.role.trim()) {
    ctx.font = font(400, 24);
    ctx.fillStyle = s.accent;
    ctx.fillText(sp.role, rx, y);
    y += 34;
  }
  y = drawLinksDown(ctx, s, t, rx, y + 18, 22, 24, 36);
  if (x.logo) y = drawLogo(ctx, x.logo, rx, y + 20, 240, 90);
  if (s.showQr && x.qr && s.website.trim()) drawQr(ctx, x.qr, rx - 170, y + 24, 170);
}

/** v0.1 layout: title top-left, speaker bottom-left, links bottom-right. */
function drawCorners(ctx: CanvasRenderingContext2D, s: BackdropState, t: Theme, sx: number, sp: Speaker, x: RenderExtras): void {
  drawTitleBlock(ctx, s, t, sx, MY + 16, 760);
  if (x.logo) drawLogo(ctx, x.logo, W - sx, MY + 16, 260, 130);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let by = H - MY;
  if (sp.role.trim()) {
    ctx.font = font(400, 26);
    ctx.fillStyle = t.muted;
    ctx.fillText(sp.role, sx, by);
    by -= 38;
  }
  if (sp.name.trim()) {
    ctx.font = font(600, 38);
    ctx.fillStyle = t.fg;
    ctx.fillText(sp.name, sx, by);
  }

  // links bottom-right, stacked upward
  const links = s.links.filter((l) => l.handle.trim());
  const rowH = 48;
  const icon = 30;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = font(500, 28);
  let ly = H - MY - rowH / 2 + 6;
  for (const l of [...links].reverse()) {
    ctx.fillStyle = t.fg;
    const text = l.handle.trim();
    ctx.fillText(text, W - sx, ly);
    const tw = ctx.measureText(text).width;
    drawIcon(ctx, l.platform, W - sx - tw - 16 - icon, ly - icon / 2, icon, t.fg, t.bg);
    ly -= rowH;
  }
  if (s.showQr && x.qr && s.website.trim()) {
    const size = 200;
    const top = (links.length ? ly + rowH / 2 - 10 : H - MY) - 28 - size;
    drawQr(ctx, x.qr, W - sx - size, top, size);
  }
}

// --- pieces ----------------------------------------------------------------------------

function drawTitleBlock(ctx: CanvasRenderingContext2D, s: BackdropState, t: Theme, x0: number, y0: number, maxW: number): number {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = y0;
  const spaced = s.titleStyle === 'spaced';
  const tx = spaced ? x0 : x0 + 30;
  const top = y;

  if (s.title.trim()) {
    if (spaced) {
      ctx.font = font(600, 38);
      const track = 38 * 0.18;
      const lines = wrap(ctx, s.title.toUpperCase(), maxW, (str) => spacedWidth(ctx, str, track)).slice(0, 2);
      ctx.fillStyle = s.accent;
      for (const l of lines) {
        drawSpaced(ctx, l, tx, y, track);
        y += 54;
      }
    } else {
      ctx.font = font(700, 60);
      ctx.fillStyle = t.fg;
      for (const l of wrap(ctx, s.title, maxW - 30).slice(0, 3)) {
        ctx.fillText(l, tx, y);
        y += 70;
      }
    }
  }
  if (s.subtitle.trim()) {
    y += spaced ? 6 : 10;
    ctx.font = font(400, spaced ? 26 : 30);
    ctx.fillStyle = t.fg;
    ctx.globalAlpha = 0.88;
    for (const l of wrap(ctx, s.subtitle, maxW - (tx - x0)).slice(0, 2)) {
      ctx.fillText(l, tx, y);
      y += spaced ? 36 : 40;
    }
    ctx.globalAlpha = 1;
  }
  if (s.meta.trim()) {
    y += 8;
    ctx.font = font(400, 20);
    ctx.fillStyle = t.muted;
    for (const l of wrap(ctx, s.meta, maxW - (tx - x0)).slice(0, 2)) {
      ctx.fillText(l, tx, y);
      y += 28;
    }
  }
  if (!spaced && y > top) {
    ctx.fillStyle = s.accent;
    ctx.fillRect(x0, top + 6, 10, y - top - 12);
  }
  return y;
}

/** Links stacked downward, right-aligned at `rx`. Returns the y below the last row. */
function drawLinksDown(
  ctx: CanvasRenderingContext2D,
  s: BackdropState,
  t: Theme,
  rx: number,
  y: number,
  size: number,
  icon: number,
  rowH: number,
): number {
  const links = s.links.filter((l) => l.handle.trim());
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = font(500, size);
  for (const l of links) {
    const cy = y + rowH / 2;
    const text = l.handle.trim();
    ctx.fillStyle = t.fg;
    ctx.fillText(text, rx, cy);
    const tw = ctx.measureText(text).width;
    drawIcon(ctx, l.platform, rx - tw - 12 - icon, cy - icon / 2, icon, t.fg, t.bg);
    y += rowH;
  }
  return y;
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, rx: number, y: number, boxW: number, boxH: number): number {
  if (!logo.naturalWidth) return y;
  const k = Math.min(boxW / logo.naturalWidth, boxH / logo.naturalHeight, 1.5);
  const lw = logo.naturalWidth * k;
  const lh = logo.naturalHeight * k;
  ctx.drawImage(logo, rx - lw, y, lw, lh);
  return y + lh;
}

function drawQr(ctx: CanvasRenderingContext2D, qr: HTMLCanvasElement, x: number, y: number, size: number): void {
  const pad = 12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad, size + pad * 2, size + pad * 2, 12);
  ctx.fill();
  ctx.drawImage(qr, x, y, size, size);
}

// --- backgrounds ------------------------------------------------------------------------

function drawBackground(ctx: CanvasRenderingContext2D, s: BackdropState, t: Theme, sx: number, image: HTMLImageElement | null): void {
  if (s.bg === 'image' && image && image.naturalWidth) {
    const k = Math.max(W / image.naturalWidth, H / image.naturalHeight);
    const iw = image.naturalWidth * k;
    const ih = image.naturalHeight * k;
    ctx.drawImage(image, (W - iw) / 2, (H - ih) / 2, iw, ih);
    ctx.fillStyle = hexA(t.bg, s.dim);
    ctx.fillRect(0, 0, W, H);
    // a little extra behind the top band so text reads on busy images
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.42);
    g.addColorStop(0, hexA(t.bg, 0.55));
    g.addColorStop(1, hexA(t.bg, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.42);
    return;
  }
  if (s.bg === 'sky') {
    drawSky(ctx, s, t);
    return;
  }
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(sx, MY, 0, sx, MY, 1100);
  g.addColorStop(0, hexA(s.accent, s.mode === 'dark' ? 0.16 : 0.12));
  g.addColorStop(1, hexA(s.accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawSky(ctx: CanvasRenderingContext2D, s: BackdropState, t: Theme): void {
  const rnd = mulberry32(s.seed);
  const dark = s.mode === 'dark';

  const base = ctx.createLinearGradient(0, 0, W * 0.3, H);
  if (dark) {
    base.addColorStop(0, '#050d16');
    base.addColorStop(0.55, '#0a2531');
    base.addColorStop(1, '#0f3a44');
  } else {
    base.addColorStop(0, '#f6f7fa');
    base.addColorStop(1, '#e2eaef');
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // nebulae
  const tints = dark
    ? [hexA(s.accent, 0.07), 'rgba(70,110,170,0.16)', 'rgba(40,140,140,0.12)', 'rgba(90,80,150,0.12)']
    : [hexA(s.accent, 0.1), 'rgba(110,150,200,0.12)', 'rgba(120,180,180,0.1)'];
  for (let i = 0; i < 6; i++) {
    const cx = rnd() * W;
    const cy = rnd() * H;
    const r = 300 + rnd() * 500;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, tints[i % tints.length]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // stars
  const n = dark ? 1100 : 450;
  const star = dark ? '255,255,255' : '70,85,105';
  for (let i = 0; i < n; i++) {
    const r = 0.4 + Math.pow(rnd(), 3) * 1.5;
    ctx.fillStyle = `rgba(${star},${(dark ? 0.25 : 0.1) + rnd() * (dark ? 0.7 : 0.3)})`;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (dark) {
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * W;
      const cy = rnd() * H;
      const r = 5 + rnd() * 7;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.25, 'rgba(220,235,255,0.35)');
      g.addColorStop(1, 'rgba(220,235,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  // vignette keeps edges calm behind the text
  const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  void t;
}

// --- guides -------------------------------------------------------------------------------

function drawTileGuides(ctx: CanvasRenderingContext2D, s: BackdropState): void {
  ctx.save();
  ctx.font = font(600, 22);
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  for (const a of ['3:2', '4:3', '1:1'] as const) {
    const inset = tileInset(a);
    const chosen = a === s.safe;
    ctx.strokeStyle = chosen ? hexA(s.accent, 0.95) : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = chosen ? 4 : 2;
    ctx.setLineDash(chosen ? [] : [10, 10]);
    ctx.strokeRect(inset + 2, 2, W - inset * 2 - 4, H - 4);
    ctx.fillStyle = chosen ? s.accent : 'rgba(255,255,255,0.7)';
    ctx.fillText(`${a} tile`, inset + 12, H - 12);
  }
  ctx.restore();
}

// --- helpers --------------------------------------------------------------------------------

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, track: number): number {
  const chars = Array.from(text);
  return ctx.measureText(text).width + track * Math.max(0, chars.length - 1);
}

/** Letter-spaced text, drawn glyph by glyph (ctx.letterSpacing is not in every browser yet). */
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, track: number): void {
  let cx = x;
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
