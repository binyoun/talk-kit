#!/usr/bin/env tsx
/**
 * talk-kit frames: cut stills from a recording with ffmpeg.
 *
 *   npm run frames -- recording.mp4 --start 4:30 --end 52:00 --every 15s --out stills
 *   npm run frames -- recording.mp4 --scenes 0.3 --out stills
 *
 * Writes JPEGs and a manifest.json (timestamps, dimensions, settings) that the
 * picker page reads.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

interface Args {
  input: string;
  start: number;
  end: number | null;
  every: number | null;
  scenes: number | null;
  out: string;
  width: number | null;
  quality: number;
}

function usage(msg?: string): never {
  if (msg) console.error(`error: ${msg}\n`);
  console.error(`usage: frames <input.mp4> [options]

  --start <t>     start time (default 0)          e.g. 4:30, 00:04:30, 270, 270s
  --end <t>       end time (default: end of file)
  --every <t>     one frame every t (default 10s) e.g. 15s, 0.5s, 2m
  --scenes [th]   cut on scene changes instead (threshold 0..1, default 0.3)
  --out <dir>     output folder (default ./stills)
  --width <px>    scale frames to this width (default: source width)
  --quality <n>   JPEG quality 2 (best) .. 31 (default 2)
`);
  process.exit(msg ? 2 : 0);
}

export function parseTime(s: string): number {
  const t = s.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t))) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  if ((m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(t))) return +m[1] * 60 + +m[2];
  if ((m = /^(\d+(?:\.\d+)?)(s|m|h)?$/.exec(t))) {
    const n = +m[1];
    return m[2] === 'm' ? n * 60 : m[2] === 'h' ? n * 3600 : n;
  }
  usage(`cannot read time "${s}"`);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { input: '', start: 0, end: null, every: null, scenes: null, out: 'stills', width: null, quality: 2 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) usage(`${k} needs a value`);
      return v;
    };
    switch (k) {
      case '-h':
      case '--help':
        usage();
      case '--start':
        a.start = parseTime(next());
        break;
      case '--end':
        a.end = parseTime(next());
        break;
      case '--every':
        a.every = parseTime(next());
        break;
      case '--scenes': {
        const v = argv[i + 1];
        if (v !== undefined && /^0?\.\d+$|^1(\.0+)?$|^0$/.test(v)) {
          a.scenes = +v;
          i++;
        } else a.scenes = 0.3;
        break;
      }
      case '--out':
        a.out = next();
        break;
      case '--width':
        a.width = +next();
        break;
      case '--quality':
        a.quality = +next();
        break;
      default:
        if (k.startsWith('-')) usage(`unknown option ${k}`);
        if (a.input) usage('only one input file');
        a.input = k;
    }
  }
  if (!a.input) usage('input file required');
  if (!existsSync(a.input)) usage(`no such file: ${a.input}`);
  if (a.every === null && a.scenes === null) a.every = 10;
  if (a.every !== null && a.scenes !== null) usage('--every and --scenes are exclusive');
  if (a.end !== null && a.end <= a.start) usage('--end must be after --start');
  return a;
}

function need(bin: string): void {
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.error(`${bin} not found. Install it first (macOS: brew install ffmpeg).`);
    process.exit(1);
  }
}

function probe(input: string): { width: number; height: number; duration: number } {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', input],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    console.error(r.stderr || 'ffprobe failed');
    process.exit(1);
  }
  const j = JSON.parse(r.stdout);
  const s = j.streams?.[0] ?? {};
  return { width: +s.width || 0, height: +s.height || 0, duration: +(j.format?.duration ?? 0) };
}

function main(): void {
  const a = parseArgs(process.argv.slice(2));
  need('ffmpeg');
  need('ffprobe');

  const input = resolve(a.input);
  const out = resolve(a.out);
  mkdirSync(out, { recursive: true });

  const info = probe(input);
  const end = a.end ?? info.duration;
  const span = end - a.start;
  if (span <= 0) usage('start is past the end of the file');

  const vf: string[] = [];
  if (a.scenes !== null) vf.push(`select='gt(scene,${a.scenes})'`, 'showinfo');
  else vf.push(`fps=1/${a.every}`);
  if (a.width) vf.push(`scale=${a.width}:-2`);

  const args = ['-hide_banner', '-loglevel', 'info', '-nostats', '-y'];
  if (a.start > 0) args.push('-ss', String(a.start));
  args.push('-t', String(span), '-i', input, '-vf', vf.join(','));
  if (a.scenes !== null) args.push('-fps_mode', 'vfr');
  args.push('-strict', 'unofficial', '-q:v', String(a.quality), join(out, 'frame-%04d.jpg'));

  console.error(`${basename(input)}  ${fmt(a.start)} → ${fmt(end)}  ${a.scenes !== null ? `scene>${a.scenes}` : `every ${a.every}s`}`);
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    if (a.scenes !== null && /No filtered frames|received no packets/.test(r.stderr)) {
      console.error(`no scene changes above ${a.scenes} in that range. Try a lower threshold, e.g. --scenes 0.1, or --every instead.`);
      process.exit(1);
    }
    console.error(r.stderr);
    process.exit(1);
  }

  const files = readdirSync(out).filter((f) => /^frame-\d{4}\.jpg$/.test(f)).sort();
  if (files.length === 0 && a.scenes !== null) {
    console.error(`no scene changes above ${a.scenes} in that range. Try a lower threshold, e.g. --scenes 0.1, or --every instead.`);
    process.exit(1);
  }
  let times: number[];
  if (a.scenes !== null) {
    // showinfo prints the pts of each selected frame, relative to the seek point
    times = [...r.stderr.matchAll(/pts_time:\s*([\d.]+)/g)].map((m) => a.start + +m[1]);
  } else {
    times = files.map((_, i) => a.start + i * (a.every as number));
  }

  const manifest = {
    tool: 'talk-kit frames',
    source: basename(input),
    width: a.width ?? info.width,
    height: a.width ? Math.round((info.height * a.width) / info.width / 2) * 2 : info.height,
    start: a.start,
    end,
    mode: a.scenes !== null ? 'scenes' : 'interval',
    every: a.every,
    threshold: a.scenes,
    createdAt: new Date().toISOString(),
    frames: files.map((file, i) => ({ file, t: round(times[i] ?? a.start), label: fmt(times[i] ?? a.start) })),
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.error(`${files.length} frames → ${out}/`);
}

const round = (n: number) => Math.round(n * 1000) / 1000;
function fmt(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return (h ? `${h}:` : '') + `${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

main();
