import QRCode from 'qrcode';
import { PLATFORMS } from '../shared/icons';
import { theme } from '../shared/theme';
import { slug } from '../shared/text';
import { render } from './render';
import {
  DEFAULT_STATE,
  decodeHash,
  encodeHash,
  loadLast,
  saveLast,
  loadPresets,
  savePresets,
  type BackdropState,
  type Link,
} from './state';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

// --- state --------------------------------------------------------------------

let state: BackdropState = decodeHash(location.hash) ?? loadLast() ?? structuredClone(DEFAULT_STATE);
let qr: HTMLCanvasElement | null = null;
let qrFor = '';
let logo: HTMLImageElement | null = null;

const preview = $<HTMLCanvasElement>('preview');
const exportCanvas = document.createElement('canvas');

// --- form -----------------------------------------------------------------------

const fields = {
  title: $<HTMLTextAreaElement>('f-title'),
  subtitle: $<HTMLInputElement>('f-subtitle'),
  name: $<HTMLInputElement>('f-name'),
  role: $<HTMLInputElement>('f-role'),
  accent: $<HTMLInputElement>('f-accent'),
  website: $<HTMLInputElement>('f-website'),
  showQr: $<HTMLInputElement>('f-showqr'),
  guide: $<HTMLInputElement>('f-guide'),
  mirror: $<HTMLInputElement>('f-mirror'),
  logo: $<HTMLInputElement>('f-logo'),
};
const modeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="mode"]'));
const linksEl = $<HTMLDivElement>('links');
const presetSelect = $<HTMLSelectElement>('presets');

function fillForm(): void {
  fields.title.value = state.title;
  fields.subtitle.value = state.subtitle;
  fields.name.value = state.name;
  fields.role.value = state.role;
  fields.accent.value = state.accent;
  fields.website.value = state.website;
  fields.showQr.checked = state.showQr;
  for (const r of modeInputs) r.checked = r.value === state.mode;
  renderLinksEditor();
}

function readForm(): void {
  state = {
    ...state,
    title: fields.title.value,
    subtitle: fields.subtitle.value,
    name: fields.name.value,
    role: fields.role.value,
    accent: fields.accent.value,
    website: fields.website.value,
    showQr: fields.showQr.checked,
    mode: modeInputs.find((r) => r.checked)?.value === 'light' ? 'light' : 'dark',
  };
}

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
    sel.addEventListener('change', () => {
      state.links[i].platform = sel.value;
      input.placeholder = PLATFORMS.find((p) => p.id === sel.value)?.placeholder ?? '';
      update();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.value = link.handle;
    input.placeholder = PLATFORMS.find((p) => p.id === link.platform)?.placeholder ?? '';
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
  const l: Link = { platform: 'instagram', handle: '' };
  state.links.push(l);
  renderLinksEditor();
  (linksEl.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
  update();
});

for (const el of Object.values(fields)) {
  if (el === fields.logo) continue;
  el.addEventListener('input', update);
  el.addEventListener('change', update);
}
for (const r of modeInputs) r.addEventListener('change', update);

fields.logo.addEventListener('change', () => {
  const f = fields.logo.files?.[0];
  if (!f) {
    logo = null;
    update();
    return;
  }
  const img = new Image();
  img.onload = () => {
    logo = img;
    update();
  };
  img.src = URL.createObjectURL(f);
});
$('clear-logo').addEventListener('click', () => {
  fields.logo.value = '';
  logo = null;
  update();
});

// --- QR ---------------------------------------------------------------------------

async function ensureQr(): Promise<void> {
  const url = state.website.trim();
  const key = `${url}|${state.mode}`;
  if (!url || !state.showQr) {
    qr = null;
    qrFor = '';
    return;
  }
  if (key === qrFor && qr) return;
  const c = document.createElement('canvas');
  try {
    await QRCode.toCanvas(c, url, {
      margin: 0,
      width: 440,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    });
    qr = c;
    qrFor = key;
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
    render(preview, state, { guide: fields.guide.checked, mirror: fields.mirror.checked, qr, logo });
    saveLast(state);
    history.replaceState(null, '', encodeHash(state));
    document.documentElement.style.setProperty('--accent', state.accent);
  });
}

// --- export / share -------------------------------------------------------------------

$('export').addEventListener('click', async () => {
  await ensureQr();
  render(exportCanvas, state, { qr, logo });
  exportCanvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(state.title)}-backdrop-1920x1080.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
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
  const presets = loadPresets();
  const p = presets[presetSelect.value];
  if (!p) return;
  state = structuredClone(p);
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

// expose for quick console checks
Object.assign(window, { talkKit: { get state() { return state; }, theme } });
