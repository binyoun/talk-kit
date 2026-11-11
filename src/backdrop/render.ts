import { theme, font } from '../shared/theme';
import { drawIcon } from '../shared/icons';
import { wrap } from '../shared/text';
import type { BackdropState } from './state';

export const W = 1920;
export const H = 1080;
const M = 96; // outer margin
const COL = 760; // text column width on the left

export interface RenderExtras {
  /** Draw the centre "you sit here" guide. Preview only. */
  guide?: boolean;
  /** Flip horizontally, as your own Zoom preview shows it. Preview only. */
  mirror?: boolean;
  /** Pre-rendered QR code for `state.website`. */
  qr?: HTMLCanvasElement | null;
  /** Optional logo, drawn top-right. */
  logo?: HTMLImageElement | null;
}

export function render(canvas: HTMLCanvasElement, s: BackdropState, x: RenderExtras = {}): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const t = theme(s.mode, s.accent);

  ctx.save();
  if (x.mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }

  // background
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  // soft accent wash in the top-left so the title sits on a field, not a void
  const g = ctx.createRadialGradient(M, M, 0, M, M, 1100);
  g.addColorStop(0, hexA(s.accent, s.mode === 'dark' ? 0.16 : 0.12));
  g.addColorStop(1, hexA(s.accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // --- title block (top-left) ---
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let y = M;
  const barX = M;
  const textX = M + 34;

  ctx.font = font(700, 64);
  const titleLines = wrap(ctx, s.title, COL - 34).slice(0, 4);
  const titleTop = y;
  ctx.fillStyle = t.fg;
  for (const line of titleLines) {
    ctx.fillText(line, textX, y);
    y += 76;
  }
  if (s.subtitle.trim()) {
    y += 10;
    ctx.font = font(400, 30);
    ctx.fillStyle = t.muted;
    for (const line of wrap(ctx, s.subtitle, COL - 34).slice(0, 3)) {
      ctx.fillText(line, textX, y);
      y += 40;
    }
  }
  // accent bar beside the whole block
  ctx.fillStyle = s.accent;
  ctx.fillRect(barX, titleTop + 6, 10, y - titleTop - 12);

  // --- logo (top-right) ---
  if (x.logo && x.logo.naturalWidth > 0) {
    const boxW = 260;
    const boxH = 130;
    const k = Math.min(boxW / x.logo.naturalWidth, boxH / x.logo.naturalHeight, 1.5);
    const lw = x.logo.naturalWidth * k;
    const lh = x.logo.naturalHeight * k;
    ctx.drawImage(x.logo, W - M - lw, M, lw, lh);
  }

  // --- name / role (bottom-left) ---
  ctx.textBaseline = 'alphabetic';
  let by = H - M;
  if (s.role.trim()) {
    ctx.font = font(400, 26);
    ctx.fillStyle = t.muted;
    ctx.fillText(s.role, M, by);
    by -= 38;
  }
  if (s.name.trim()) {
    ctx.font = font(600, 38);
    ctx.fillStyle = t.fg;
    ctx.fillText(s.name, M, by);
  }

  // --- links (bottom-right, stacked upward) ---
  const links = s.links.filter((l) => l.handle.trim());
  const rowH = 48;
  const icon = 30;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = font(500, 28);
  let ly = H - M - rowH / 2 + 6;
  for (const l of [...links].reverse()) {
    ctx.fillStyle = t.fg;
    const text = l.handle.trim();
    ctx.fillText(text, W - M, ly);
    const tw = ctx.measureText(text).width;
    drawIcon(ctx, l.platform, W - M - tw - 16 - icon, ly - icon / 2, icon, t.fg, t.bg);
    ly -= rowH;
  }

  // --- QR (above links, right) ---
  if (s.showQr && x.qr && s.website.trim()) {
    const size = 220;
    const pad = 14;
    const qx = W - M - size;
    const linksTop = links.length ? ly + rowH / 2 - 10 : H - M;
    const qy = linksTop - 28 - size;
    ctx.fillStyle = s.mode === 'dark' ? '#ffffff' : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qx - pad, qy - pad, size + pad * 2, size + pad * 2, 14);
    ctx.fill();
    ctx.drawImage(x.qr, qx, qy, size, size);
  }

  ctx.restore();

  // --- guide (never mirrored; preview only) ---
  if (x.guide) {
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexA(s.accent, 0.7);
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.58, 330, 430, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = font(500, 26);
    ctx.fillStyle = hexA(s.accent, 0.9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('you sit here · guide is not exported', W / 2, H * 0.58);
    ctx.restore();
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
