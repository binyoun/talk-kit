import QRCode from 'qrcode';
import { PLATFORMS } from '../shared/icons';
import { slug } from '../shared/text';
import { render } from './render';
import {
  DEFAULT_STATE,
  MAX_SPEAKERS,
  decodeHash,
  encodeHash,
  loadLast,
  saveLast,
  loadPresets,
  savePresets,
  type BackdropState,
} from './state';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const SWATCHES = ['#d9b56f', '#e4572e', '#8fd6ff', '#7fd1b9', '#b69cff', '#f2f2ee'];

// --- state --------------------------------------------------------------------

let state: BackdropState = decodeHash(location.hash) ?? loadLast() ?? structuredClone(DEFAULT_STATE);
let qr: HTMLCanvasElement | null = null;
let qrFor = '';
let logo: HTMLImageElement | null = null;
let image: HTMLImageElement | null = null;
let previewSpeaker = 0;

const preview = $<HTMLCanvasElement>('preview');

// --- form -----------------------------------------------------------------------

const fields = {
  title: $<HTMLTextAreaElement>('f-title'),
  subtitle: $<HTMLInputElement>('f-subtitle'),
  meta: $<HTMLInputElement>('f-meta'),
  accent: $<HTMLInputElement>('f-accent'),
  website: $<HTMLInputElement>('f-website'),
  showQr: $<HTMLInputElement>('f-showqr'),
  dim: $<HTMLInputElement>('f-dim'),
};
const toggles = {
  guide: $<HTMLInputElement>('f-guide'),
  tiles: $<HTMLInputElement>('f-tiles'),
  mirror: $<HTMLInputElement>('f-mirror'),
};
const RADIOS = ['mode', 'layout', 'titleStyle', 'bg', 'safe'] as const;
const radios = (name: string) => Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));

const linksEl = $<HTMLDivElement>('links');
const speakersEl = $<HTMLDivElement>('speakers');
const presetSelect = $<HTMLSelectElement>('presets');
const speakerSelect = $<HTMLSelectElement>('preview-speaker');

function fillForm(): void {
  fields.title.value = state.title;
  fields.subtitle.value = state.subtitle;
  fields.meta.value = state.meta;
  fields.accent.value = state.accent;
  fields.website.value = state.website;
  fields.showQr.checked = state.showQr;
  fields.dim.value = String(state.dim);
  for (const name of RADIOS) for (const r of radios(name)) r.checked = r.value === state[name];
  renderSpeakersEditor();
  renderLinksEditor();
  syncVisibility();
}

function readForm(): void {
  const radio = (name: string) => radios(name).find((r) => r.checked)?.value;
  state = {
    ...state,
    title: fields.title.value,
    subtitle: fields.subtitle.value,
    meta: fields.meta.value,
    accent: fields.accent.value,
    website: fields.website.value,
    showQr: fields.showQr.checked,
    dim: +fields.dim.value,
    mode: radio('mode') === 'light' ? 'light' : 'dark',
    layout: radio('layout') === 'corners' ? 'corners' : 'top',
    titleStyle: radio('titleStyle') === 'bold' ? 'bold' : 'spaced',
    bg: (radio('bg') as BackdropState['bg']) ?? 'sky',
    safe: (radio('safe') as BackdropState['safe']) ?? '3:2',
  };
  syncVisibility();
}

function syncVisibility(): void {
  $('bg-sky').hidden = state.bg !== 'sky';
  $('bg-image').hidden = state.bg !== 'image';
  for (const b of Array.from($('swatches').children)) b.classList.toggle('on', (b as HTMLElement).dataset.c === state.accent);
}

// speakers
function renderSpeakersEditor(): void {
  speakersEl.replaceChildren();
  state.speakers.forEach((sp, i) => {
    const row = document.createElement('div');
    row.className = 'speaker-row';
    const name = document.createElement('input');
    name.type = 'text';
    name.placeholder = 'Name';
    name.value = sp.name;
    name.addEventListener('input', () => {
      state.speakers[i].name = name.value;
      refreshSpeakerSelect();
      update();
    });
    const role = document.createElement('input');
    role.type = 'text';
    role.placeholder = 'Role · organisation';
    role.value = sp.role;
    role.addEventListener('input', () => {
      state.speakers[i].role = role.value;
      update();
    });
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'ghost';
    rm.textContent = '×';
    rm.title = 'Remove speaker';
    rm.disabled = state.speakers.length === 1;
    rm.addEventListener('click', () => {
      state.speakers.splice(i, 1);
      previewSpeaker = Math.min(previewSpeaker, state.speakers.length - 1);
      renderSpeakersEditor();
      update();
    });
    row.append(name, role, rm);
    speakersEl.append(row);
  });
  $<HTMLButtonElement>('add-speaker').disabled = state.speakers.length >= MAX_SPEAKERS;
  refreshSpeakerSelect();
}

function refreshSpeakerSelect(): void {
  speakerSelect.replaceChildren(
    ...state.speakers.map((sp, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = sp.name.trim() || `Speaker ${i + 1}`;
      o.selected = i === previewSpeaker;
      return o;
    }),
  );
  const many = state.speakers.length > 1;
  $('preview-speaker-wrap').hidden = !many;
  const all = $<HTMLButtonElement>('export-all');
  all.hidden = !many;
  all.textContent = `Export all ${state.speakers.length} speakers`;
}

$('add-speaker').addEventListener('click', () => {
  state.speakers.push({ name: '', role: state.speakers[0]?.role ?? '' });
  previewSpeaker = state.speakers.length - 1;
  renderSpeakersEditor();
  (speakersEl.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
  update();
});
speakerSelect.addEventListener('change', () => {
  previewSpeaker = +speakerSelect.value;
  update();
});

// links
function renderLinksEditor(): void {
  linksEl.replaceChildren();
  state.links.forEach((link, i) => {
    const row = document.createElement('div');
    row.className = 'link-row';

    const sel = document.createElement('select');
    for (const p of PLATFORMS) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.label;
      o.selected = p.id === link.platform;
      sel.append(o);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.value = link.handle;
    input.placeholder = PLATFORMS.find((p) => p.id === link.platform)?.placeholder ?? '';
    sel.addEventListener('change', () => {
      state.links[i].platform = sel.value;
      input.placeholder = PLATFORMS.find((p) => p.id === sel.value)?.placeholder ?? '';
      update();
    });
    input.addEventListener('input', () => {
      state.links[i].handle = input.value;
      update();
    });

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'ghost';
    rm.textContent = '×';
    rm.title = 'Remove';
    rm.addEventListener('click', () => {
      state.links.splice(i, 1);
      renderLinksEditor();
      update();
    });

    row.append(sel, input, rm);
    linksEl.append(row);
  });
  $<HTMLButtonElement>('add-link').disabled = state.links.length >= 4;
}

$('add-link').addEventListener('click', () => {
  state.links.push({ platform: 'instagram', handle: '' });
  renderLinksEditor();
  (linksEl.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
  update();
});

// swatches
for (const c of SWATCHES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.dataset.c = c;
  b.style.background = c;
  b.title = c;
  b.addEventListener('click', () => {
    fields.accent.value = c;
    update();
  });
  $('swatches').append(b);
}

for (const el of [...Object.values(fields), ...Object.values(toggles)]) {
  el.addEventListener('input', update);
  el.addEventListener('change', update);
}
for (const name of RADIOS) for (const r of radios(name)) r.addEventListener('change', update);

$('shuffle').addEventListener('click', () => {
  state.seed = Math.floor(Math.random() * 1e6);
  update();
});

function pickImage(input: HTMLInputElement, set: (img: HTMLImageElement | null) => void): void {
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      set(img);
      update();
    };
    img.src = URL.createObjectURL(f);
  });
}
pickImage($<HTMLInputElement>('f-logo'), (i) => (logo = i));
pickImage($<HTMLInputElement>('f-image'), (i) => (image = i));
$('clear-logo').addEventListener('click', () => {
  $<HTMLInputElement>('f-logo').value = '';
  logo = null;
  update();
});

// --- QR ---------------------------------------------------------------------------

async function ensureQr(): Promise<void> {
  const url = state.website.trim();
  if (!url || !state.showQr) {
    qr = null;
    qrFor = '';
    return;
  }
  if (url === qrFor && qr) return;
  const c = document.createElement('canvas');
  try {
    await QRCode.toCanvas(c, url, { margin: 0, width: 440, errorCorrectionLevel: 'M' });
    qr = c;
    qrFor = url;
  } catch {
    qr = null;
  }
}

// --- render -------------------------------------------------------------------------

let pending = false;
function update(): void {
  readForm();
  if (pending) return;
  pending = true;
  queueMicrotask(async () => {
    pending = false;
    await ensureQr();
    render(preview, state, {
      guide: toggles.guide.checked,
      tiles: toggles.tiles.checked,
      mirror: toggles.mirror.checked,
      qr,
      logo,
      image,
      speaker: previewSpeaker,
    });
    saveLast(state);
    history.replaceState(null, '', encodeHash(state));
    document.documentElement.style.setProperty('--accent', state.accent);
  });
}

// --- export / share -------------------------------------------------------------------

async function exportSpeaker(i: number): Promise<void> {
  await ensureQr();
  const c = document.createElement('canvas');
  render(c, state, { qr, logo, image, speaker: i });
  const name = state.speakers[i]?.name.trim();
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(state.title)}${name ? '-' + slug(name) : ''}-backdrop-1920x1080.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

$('export').addEventListener('click', () => void exportSpeaker(previewSpeaker));
$('export-all').addEventListener('click', async () => {
  for (let i = 0; i < state.speakers.length; i++) {
    await exportSpeaker(i);
    await new Promise((r) => setTimeout(r, 350));
  }
  flash(`Exported ${state.speakers.length} backgrounds`);
});

$('copy-link').addEventListener('click', async () => {
  const url = location.origin + location.pathname + encodeHash(state);
  try {
    await navigator.clipboard.writeText(url);
    flash('Link copied');
  } catch {
    prompt('Copy this link', url);
  }
});

// --- presets ------------------------------------------------------------------------

function refreshPresets(): void {
  const presets = loadPresets();
  presetSelect.replaceChildren();
  const o = document.createElement('option');
  o.value = '';
  o.textContent = Object.keys(presets).length ? 'Load preset…' : 'No presets yet';
  presetSelect.append(o);
  for (const name of Object.keys(presets).sort()) {
    const op = document.createElement('option');
    op.value = name;
    op.textContent = name;
    presetSelect.append(op);
  }
}

presetSelect.addEventListener('change', () => {
  const p = loadPresets()[presetSelect.value];
  if (!p) return;
  state = structuredClone(p);
  previewSpeaker = 0;
  fillForm();
  update();
  presetSelect.value = '';
});

$('save-preset').addEventListener('click', () => {
  const name = window.prompt('Preset name', state.title || 'My talk')?.trim();
  if (!name) return;
  const presets = loadPresets();
  presets[name] = structuredClone(state);
  savePresets(presets);
  refreshPresets();
  flash(`Saved "${name}"`);
});

$('delete-preset').addEventListener('click', () => {
  const presets = loadPresets();
  const names = Object.keys(presets);
  if (!names.length) return;
  const name = window.prompt(`Delete which preset?\n${names.join('\n')}`)?.trim();
  if (!name || !presets[name]) return;
  delete presets[name];
  savePresets(presets);
  refreshPresets();
  flash(`Deleted "${name}"`);
});

$('reset').addEventListener('click', () => {
  state = structuredClone(DEFAULT_STATE);
  previewSpeaker = 0;
  fillForm();
  update();
});

function flash(msg: string): void {
  const el = $('flash');
  el.textContent = msg;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 1600);
}

// --- boot ------------------------------------------------------------------------------

fillForm();
refreshPresets();
update();
window.addEventListener('hashchange', () => {
  const s = decodeHash(location.hash);
  if (s) {
    state = s;
    fillForm();
    update();
  }
});
