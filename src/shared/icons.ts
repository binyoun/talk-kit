import {
  siInstagram,
  siFacebook,
  siX,
  siThreads,
  siYoutube,
  siGithub,
  siMastodon,
  siBluesky,
  siTiktok,
  siVimeo,
  siBehance,
} from 'simple-icons';

export interface Platform {
  id: string;
  label: string;
  placeholder: string;
  /** SVG path on a 24×24 viewBox (Simple Icons). */
  path?: string;
  /** Short text badge for brands Simple Icons does not carry. */
  badge?: string;
}

export const PLATFORMS: Platform[] = [
  { id: 'website', label: 'Website', placeholder: 'example.com' },
  { id: 'instagram', label: 'Instagram', placeholder: '@handle', path: siInstagram.path },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'in/name', badge: 'in' },
  { id: 'facebook', label: 'Facebook', placeholder: 'name', path: siFacebook.path },
  { id: 'x', label: 'X', placeholder: '@handle', path: siX.path },
  { id: 'threads', label: 'Threads', placeholder: '@handle', path: siThreads.path },
  { id: 'bluesky', label: 'Bluesky', placeholder: '@name.bsky.social', path: siBluesky.path },
  { id: 'mastodon', label: 'Mastodon', placeholder: '@name@server', path: siMastodon.path },
  { id: 'youtube', label: 'YouTube', placeholder: '@channel', path: siYoutube.path },
  { id: 'tiktok', label: 'TikTok', placeholder: '@handle', path: siTiktok.path },
  { id: 'github', label: 'GitHub', placeholder: 'username', path: siGithub.path },
  { id: 'vimeo', label: 'Vimeo', placeholder: 'name', path: siVimeo.path },
  { id: 'behance', label: 'Behance', placeholder: 'name', path: siBehance.path },
];

const byId = new Map(PLATFORMS.map((p) => [p.id, p]));
export const platform = (id: string): Platform => byId.get(id) ?? PLATFORMS[0];

/**
 * Draw a platform glyph with its top-left corner at (x, y), `size` px square,
 * in a single colour. `bg` is used for the badge text on text-badge glyphs.
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  size: number,
  color: string,
  bg: string,
): void {
  const p = platform(id);
  ctx.save();
  ctx.translate(x, y);
  if (p.path) {
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(p.path));
  } else if (p.badge) {
    const r = size * 0.18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, r);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.font = `700 ${size * 0.6}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.badge, size / 2, size * 0.54);
  } else {
    // globe
    const c = size / 2;
    const r = size * 0.44;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.075);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.moveTo(c - r, c);
    ctx.lineTo(c + r, c);
    ctx.moveTo(c, c - r);
    ctx.lineTo(c, c + r);
    ctx.ellipse(c, c, r * 0.45, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
