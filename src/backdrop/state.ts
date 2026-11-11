import type { Mode } from '../shared/theme';

export interface Link {
  platform: string;
  handle: string;
}

export interface Speaker {
  name: string;
  role: string;
}

/** Top: everything above head height (survives your shoulders). Corners: name and links at the bottom. */
export type Layout = 'top' | 'corners';
/** Spaced: letter-spaced capitals in the accent colour. Bold: large bold title with an accent bar. */
export type TitleStyle = 'spaced' | 'bold';
export type BgKind = 'solid' | 'sky' | 'image';
/** Narrowest meeting tile the text must survive. Zoom gallery tiles are often 3:2 or 4:3. */
export type SafeArea = '16:9' | '3:2' | '4:3';

export interface BackdropState {
  title: string;
  subtitle: string;
  /** Event · session · date line, e.g. "ISEA2026 | Online Stream 4 | 9 November 2026". */
  meta: string;
  speakers: Speaker[];
  mode: Mode;
  accent: string;
  layout: Layout;
  titleStyle: TitleStyle;
  bg: BgKind;
  /** Seed for the generated night sky. */
  seed: number;
  /** 0..0.9: how much to darken (or lighten) an uploaded image so text stays readable. */
  dim: number;
  safe: SafeArea;
  links: Link[];
  website: string;
  showQr: boolean;
}

export const MAX_SPEAKERS = 6;

export const DEFAULT_STATE: BackdropState = {
  title: 'Title of the talk',
  subtitle: 'A one-line subtitle',
  meta: 'Event | Session | Date',
  speakers: [{ name: 'Your name', role: 'Role · Organisation' }],
  mode: 'dark',
  accent: '#d9b56f',
  layout: 'top',
  titleStyle: 'spaced',
  bg: 'sky',
  seed: 7,
  dim: 0.35,
  safe: '3:2',
  links: [
    { platform: 'instagram', handle: '@handle' },
    { platform: 'website', handle: 'example.com' },
  ],
  website: 'https://example.com',
  showQr: false,
};

const STORAGE_KEY = 'talk-kit.backdrop.state';
const PRESETS_KEY = 'talk-kit.backdrop.presets';

// --- URL hash ----------------------------------------------------------------

function toB64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeHash(state: BackdropState): string {
  return '#s=' + toB64url(JSON.stringify(state));
}

export function decodeHash(hash: string): BackdropState | null {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return null;
  try {
    return sanitize(JSON.parse(fromB64url(m[1])));
  } catch {
    return null;
  }
}

// --- localStorage -------------------------------------------------------------

export function loadLast(): BackdropState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLast(state: BackdropState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: nothing to do */
  }
}

export function loadPresets(): Record<string, BackdropState> {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    const out: Record<string, BackdropState> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitize(v);
    return out;
  } catch {
    return {};
  }
}

export function savePresets(presets: Record<string, BackdropState>): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}

// --- validation ---------------------------------------------------------------

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v.slice(0, 400) : fallback;
}

function pick<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

export function sanitize(v: unknown): BackdropState {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const links: Link[] = Array.isArray(o.links)
    ? o.links.slice(0, 4).map((l) => {
        const r = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
        return { platform: str(r.platform, 'website'), handle: str(r.handle) };
      })
    : [];
  let speakers: Speaker[] = Array.isArray(o.speakers)
    ? o.speakers.slice(0, MAX_SPEAKERS).map((s) => {
        const r = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
        return { name: str(r.name), role: str(r.role) };
      })
    : [];
  // v0.1 stored a single name/role
  if (!speakers.length) speakers = [{ name: str(o.name), role: str(o.role) }];
  const isOld = !('layout' in o);
  return {
    title: str(o.title),
    subtitle: str(o.subtitle),
    meta: str(o.meta),
    speakers,
    mode: o.mode === 'light' ? 'light' : 'dark',
    accent: /^#[0-9a-f]{6}$/i.test(String(o.accent)) ? String(o.accent) : DEFAULT_STATE.accent,
    layout: pick(o.layout, ['top', 'corners'] as const, isOld ? 'corners' : 'top'),
    titleStyle: pick(o.titleStyle, ['spaced', 'bold'] as const, isOld ? 'bold' : 'spaced'),
    bg: pick(o.bg, ['solid', 'sky', 'image'] as const, isOld ? 'solid' : 'sky'),
    seed: Number.isFinite(o.seed) ? Math.floor(Number(o.seed)) : DEFAULT_STATE.seed,
    dim: Number.isFinite(o.dim) ? Math.min(0.9, Math.max(0, Number(o.dim))) : DEFAULT_STATE.dim,
    safe: pick(o.safe, ['16:9', '3:2', '4:3'] as const, '3:2'),
    links,
    website: str(o.website),
    showQr: Boolean(o.showQr),
  };
}
