import type { Mode } from '../shared/theme';

export interface Link {
  platform: string;
  handle: string;
}

export interface BackdropState {
  title: string;
  subtitle: string;
  name: string;
  role: string;
  mode: Mode;
  accent: string;
  links: Link[];
  website: string;
  showQr: boolean;
}

export const DEFAULT_STATE: BackdropState = {
  title: 'Title of the talk',
  subtitle: 'Event name · Date',
  name: 'Your name',
  role: 'Role · Organisation',
  mode: 'dark',
  accent: '#e4572e',
  links: [
    { platform: 'instagram', handle: '@handle' },
    { platform: 'website', handle: 'example.com' },
  ],
  website: 'https://example.com',
  showQr: true,
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

export function sanitize(v: unknown): BackdropState {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const links: Link[] = Array.isArray(o.links)
    ? o.links
        .slice(0, 4)
        .map((l) => {
          const r = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
          return { platform: str(r.platform, 'website'), handle: str(r.handle) };
        })
    : [];
  return {
    title: str(o.title),
    subtitle: str(o.subtitle),
    name: str(o.name),
    role: str(o.role),
    mode: o.mode === 'light' ? 'light' : 'dark',
    accent: /^#[0-9a-f]{6}$/i.test(String(o.accent)) ? String(o.accent) : DEFAULT_STATE.accent,
    links,
    website: str(o.website),
    showQr: Boolean(o.showQr),
  };
}
