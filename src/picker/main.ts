import { FORMATS, type Format } from '../shared/formats';
import { slug } from '../shared/text';
import { sharpness } from './sharpness';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

interface Frame {
  file: File;
  name: string;
  url: string;
  t: number | null;
  label: string;
  sharp: number | null;
  card: HTMLElement;
}

interface ManifestFrame {
  file: string;
  t: number;
  label: string;
}

// --- state ---------------------------------------------------------------------

let frames: Frame[] = [];
let source = 'stills';
let sortBy: 'time' | 'sharp' = 'time';
let selected: Frame | null = null;
let img: HTMLImageElement | null = null; // full-size image of `selected`
let format: Format = FORMATS[0];
let zoom = 1; // multiplier over "cover"
let cx = 0; // crop centre, source pixels
let cy = 0;

const drop = $<HTMLElement>('drop');
const work = $<HTMLElement>('work');
const grid = $<HTMLDivElement>('grid');
const cropCanvas = $<HTMLCanvasElement>('crop');
const zoomInput = $<HTMLInputElement>('zoom');
const editBody = $<HTMLElement>('edit-body');
const editEmpty = $<HTMLElement>('edit-empty');

// --- loading ---------------------------------------------------------------------

async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .map((i) => i.webkitGetAsEntry?.() ?? null)
    .filter((e): e is FileSystemEntry => e !== null);
  if (!entries.length) return Array.from(dt.files);
  const out: File[] = [];
  const walk = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile) {
      out.push(await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej)));
    } else if (e.isDirectory) {
      const reader = (e as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        for (const c of batch) await walk(c);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

async function load(files: File[]): Promise<void> {
  clear();
  const manifestFile = files.find((f) => f.name === 'manifest.json');
  let manifest: { source?: string; frames?: ManifestFrame[] } = {};
  if (manifestFile) {
    try {
      manifest = JSON.parse(await manifestFile.text());
    } catch {
      /* ignore a broken manifest; timestamps just won't show */
    }
  }
  const byName = new Map((manifest.frames ?? []).map((f) => [f.file, f]));
  const images = files
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!images.length) {
    flash('No images found in that drop');
    return;
  }
  source = manifest.source?.replace(/\.\w+$/, '') ?? images[0].webkitRelativePath?.split('/')[0] ?? 'stills';

  frames = images.map((file) => {
    const m = byName.get(file.name);
    return {
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      t: m?.t ?? null,
      label: m?.label ?? file.name.replace(/\.\w+$/, ''),
      sharp: null,
      card: document.createElement('div'),
    };
  });
  for (const f of frames) buildCard(f);

  $('source').textContent = source;
  $('count').textContent = `${frames.length} frames`;
  drop.hidden = true;
  work.hidden = false;
  renderGrid();
  void scoreAll();
}

function clear(): void {
  for (const f of frames) URL.revokeObjectURL(f.url);
  frames = [];
  selected = null;
  img = null;
  grid.replaceChildren();
  editBody.hidden = true;
  editEmpty.hidden = false;
  $('progress').textContent = '';
}

// --- contact sheet -------------------------------------------------------------------

function buildCard(f: Frame): void {
  const card = f.card;
  card.className = 'thumb';
  card.tabIndex = 0;
  const im = document.createElement('img');
  im.src = f.url;
  im.loading = 'lazy';
  im.decoding = 'async';
  im.alt = f.label;
  const meta = document.createElement('div');
  meta.className = 'meta';
  const time = document.createElement('span');
  time.textContent = f.label;
  const score = document.createElement('span');
  score.className = 'score';
  score.textContent = '…';
  meta.append(time, score);
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.append(document.createElement('i'));
  card.append(im, meta, bar);
  card.addEventListener('click', () => void select(f));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void select(f);
    }
  });
}

function sorted(): Frame[] {
  const list = [...frames];
  if (sortBy === 'sharp') list.sort((a, b) => (b.sharp ?? -1) - (a.sharp ?? -1));
  return list;
}

function renderGrid(): void {
  grid.replaceChildren(...sorted().map((f) => f.card));
}

async function scoreAll(): Promise<void> {
  const progress = $('progress');
  let done = 0;
  for (const f of frames) {
    if (!frames.includes(f)) return; // cleared mid-way
    try {
      f.sharp = await sharpness(f.file);
    } catch {
      f.sharp = 0;
    }
    done++;
    progress.textContent = `scoring ${done}/${frames.length}`;
    if (done % 8 === 0) paintScores();
  }
  progress.textContent = '';
  paintScores();
  if (sortBy === 'sharp') renderGrid();
}

function paintScores(): void {
  const max = Math.max(1, ...frames.map((f) => f.sharp ?? 0));
  for (const f of frames) {
    if (f.sharp === null) continue;
    const r = f.sharp / max;
    (f.card.querySelector('.bar i') as HTMLElement).style.width = `${Math.round(r * 100)}%`;
    (f.card.querySelector('.score') as HTMLElement).textContent = `${Math.round(r * 100)}`;
  }
}

// --- editor ----------------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

async function select(f: Frame): Promise<void> {
  selected?.card.classList.remove('sel');
  selected = f;
  f.card.classList.add('sel');
  f.card.scrollIntoView({ block: 'nearest' });
  img = await loadImage(f.url);
  if (selected !== f) return;
  cx = img.naturalWidth / 2;
  cy = img.naturalHeight / 2;
  editEmpty.hidden = true;
  editBody.hidden = false;
  $('frame-label').textContent = `${f.label} · ${img.naturalWidth}×${img.naturalHeight}`;
  draw();
}

function cropRect(): { sx: number; sy: number; sw: number; sh: number } {
  if (!img) return { sx: 0, sy: 0, sw: 1, sh: 1 };
  const cover = Math.max(format.w / img.naturalWidth, format.h / img.naturalHeight);
  const scale = cover * zoom;
  const sw = format.w / scale;
  const sh = format.h / scale;
  cx = Math.min(Math.max(cx, sw / 2), img.naturalWidth - sw / 2);
  cy = Math.min(Math.max(cy, sh / 2), img.naturalHeight - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}

function fitCanvas(): void {
  const box = cropCanvas.parentElement as HTMLElement;
  const maxW = box.clientWidth;
  const maxH = Math.max(240, window.innerHeight * 0.56);
  const k = Math.min(maxW / format.w, maxH / format.h);
  cropCanvas.style.width = `${Math.round(format.w * k)}px`;
  cropCanvas.style.height = `${Math.round(format.h * k)}px`;
}

function draw(): void {
  if (!img) return;
  cropCanvas.width = format.w;
  cropCanvas.height = format.h;
  fitCanvas();
  const ctx = cropCanvas.getContext('2d');
  if (!ctx) return;
  const r = cropRect();
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, format.w, format.h);
}

function setFormat(f: Format): void {
  format = f;
  for (const b of Array.from($('formats').children)) b.classList.toggle('on', (b as HTMLElement).dataset.id === f.id);
  $('fmt-name').textContent = `${f.platform} ${f.label} ${f.w}×${f.h}`;
  draw();
}

// pan
let dragging = false;
let lastX = 0;
let lastY = 0;
cropCanvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  cropCanvas.setPointerCapture(e.pointerId);
});
cropCanvas.addEventListener('pointermove', (e) => {
  if (!dragging || !img) return;
  const r = cropRect();
  const k = r.sw / cropCanvas.clientWidth; // source px per CSS px
  cx -= (e.clientX - lastX) * k;
  cy -= (e.clientY - lastY) * k;
  lastX = e.clientX;
  lastY = e.clientY;
  draw();
});
const endDrag = () => {
  dragging = false;
};
cropCanvas.addEventListener('pointerup', endDrag);
cropCanvas.addEventListener('pointercancel', endDrag);
cropCanvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoom = Math.min(3, Math.max(1, zoom * Math.pow(1.0015, -e.deltaY)));
    zoomInput.value = String(zoom);
    draw();
  },
  { passive: false },
);
zoomInput.addEventListener('input', () => {
  zoom = +zoomInput.value;
  draw();
});
$('reset-crop').addEventListener('click', () => {
  zoom = 1;
  zoomInput.value = '1';
  if (img) {
    cx = img.naturalWidth / 2;
    cy = img.naturalHeight / 2;
  }
  draw();
});
window.addEventListener('resize', fitCanvas);

// --- export ------------------------------------------------------------------------------

function exportOne(f: Format): Promise<void> {
  return new Promise((res) => {
    if (!img || !selected) return res();
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const ctx = c.getContext('2d');
    if (!ctx) return res();
    const saved = format;
    format = f;
    const r = cropRect();
    format = saved;
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, f.w, f.h);
    c.toBlob(
      (blob) => {
        if (blob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${slug(source)}-${slug(selected!.label)}-${f.id}-${f.w}x${f.h}.jpg`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }
        res();
      },
      'image/jpeg',
      0.92,
    );
  });
}

$('export-one').addEventListener('click', () => void exportOne(format));
$('export-all').addEventListener('click', async () => {
  for (const f of FORMATS) {
    await exportOne(f);
    await new Promise((r) => setTimeout(r, 350)); // let the browser queue each download
  }
  flash(`Exported ${FORMATS.length} files`);
});

// --- keyboard -----------------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (!selected || (e.target as HTMLElement).matches('input, select, textarea')) return;
  const list = sorted();
  const i = list.indexOf(selected);
  if (e.key === 'ArrowRight' && i < list.length - 1) void select(list[i + 1]);
  else if (e.key === 'ArrowLeft' && i > 0) void select(list[i - 1]);
  else if (e.key === 'Escape') {
    selected.card.classList.remove('sel');
    selected = null;
    editBody.hidden = true;
    editEmpty.hidden = false;
  }
});

// --- wiring ---------------------------------------------------------------------------------

for (const f of FORMATS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.id = f.id;
  b.innerHTML = `${f.platform} <small>${f.label} ${f.w}×${f.h}</small>`;
  b.addEventListener('click', () => setFormat(f));
  $('formats').append(b);
}
setFormat(FORMATS[0]);

$<HTMLSelectElement>('sort').addEventListener('change', (e) => {
  sortBy = (e.target as HTMLSelectElement).value === 'sharp' ? 'sharp' : 'time';
  renderGrid();
});
$('clear').addEventListener('click', () => {
  clear();
  work.hidden = true;
  drop.hidden = false;
});

for (const id of ['f-folder', 'f-files']) {
  $<HTMLInputElement>(id).addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) void load(Array.from(input.files));
    input.value = '';
  });
}

for (const target of [drop, document.body]) {
  target.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  target.addEventListener('dragleave', () => drop.classList.remove('over'));
  target.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer) void load(await filesFromDataTransfer(e.dataTransfer));
  });
}

function flash(msg: string): void {
  const el = $('flash');
  el.textContent = msg;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 1800);
}
