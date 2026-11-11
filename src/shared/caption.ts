import { theme, font, type Mode } from './theme';
import { wrap } from './text';

export interface Caption {
  on: boolean;
  title: string;
  line: string; // name · event · date
  mode: Mode;
  accent: string;
}

export const DEFAULT_CAPTION: Caption = {
  on: false,
  title: '',
  line: '',
  mode: 'dark',
  accent: '#e4572e',
};

/**
 * Draw a caption band across the bottom of a `w`×`h` canvas.
 * Sizes scale with the shorter side, so a 1080 square and a 1600×900 post
 * get the same visual weight. Tall formats (stories) lift the band clear of
 * the reply bar the platform draws at the bottom.
 */
export function drawCaption(ctx: CanvasRenderingContext2D, w: number, h: number, c: Caption): void {
  if (!c.on || !(c.title.trim() || c.line.trim())) return;
  const t = theme(c.mode, c.accent);
  const u = Math.min(w, h) / 1080; // unit
  const pad = 56 * u;
  const bar = 10 * u;
  const textX = pad + bar + 26 * u;
  const maxW = w - textX - pad;

  const titleSize = 52 * u;
  const lineSize = 30 * u;
  ctx.font = font(700, titleSize);
  const titleLines = c.title.trim() ? wrap(ctx, c.title, maxW).slice(0, 2) : [];
  ctx.font = font(400, lineSize);
  const subLines = c.line.trim() ? wrap(ctx, c.line, maxW).slice(0, 2) : [];

  const titleLH = titleSize * 1.18;
  const lineLH = lineSize * 1.35;
  const gap = titleLines.length && subLines.length ? 14 * u : 0;
  const textH = titleLines.length * titleLH + gap + subLines.length * lineLH;
  const bandH = textH + pad * 1.6;

  const tall = h / w > 1.5;
  const bottom = tall ? h - h * 0.14 : h;
  const top = bottom - bandH;

  ctx.save();
  if (tall) {
    // floating card for stories
    ctx.fillStyle = withAlpha(t.bg, 0.9);
    ctx.beginPath();
    ctx.roundRect(pad * 0.6, top, w - pad * 1.2, bandH, 18 * u);
    ctx.fill();
  } else {
    ctx.fillStyle = withAlpha(t.bg, 0.9);
    ctx.fillRect(0, top, w, bandH);
  }

  let y = top + pad * 0.8;
  const blockTop = y;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = t.fg;
  ctx.font = font(700, titleSize);
  for (const l of titleLines) {
    ctx.fillText(l, textX, y);
    y += titleLH;
  }
  y += gap;
  ctx.fillStyle = t.muted;
  ctx.font = font(400, lineSize);
  for (const l of subLines) {
    ctx.fillText(l, textX, y);
    y += lineLH;
  }
  ctx.fillStyle = c.accent;
  ctx.fillRect(pad, blockTop + 4 * u, bar, y - blockTop - 10 * u);
  ctx.restore();
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
