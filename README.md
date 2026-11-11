# talk-kit

Support tools for giving talks online. Two jobs:

1. **Backdrop** — a meeting background that carries the title of your talk, your name, your links and a QR code, so the frame itself tells people what they are watching and where to find you afterwards.
2. **Frames + Picker** — turn the recording into stills worth posting: cut frames between a start and end time, rank them, crop for Instagram, LinkedIn, Facebook or X, export.

Everything runs on your own machine. Nothing is uploaded anywhere.

**Status:** Backdrop, Frames CLI and Picker all work. Face-aware scoring and the caption band are next — see [PLAN.md](PLAN.md).

---

## Quick start

```sh
git clone https://github.com/binyoun/talk-kit.git
cd talk-kit
npm install
npm run dev          # opens the Backdrop and Picker pages
```

For the Frames CLI you also need [ffmpeg](https://ffmpeg.org/) on your path (`brew install ffmpeg` on macOS).

---

## Backdrop

Open `backdrop.html` in the dev server (or the built `dist/`). Fill in the title, your name and role, up to four links, and a website for the QR code. Choose light or dark and an accent colour. Export a **1920×1080 PNG** and set it as your virtual background in Zoom, Teams or Meet.

What it gets right that a slide-made background usually doesn't:

- **You sit in the middle.** Text keeps to the edges; a dashed guide in the preview shows the seat, and is never exported.
- **Mirror check.** Zoom shows *you* a mirrored preview but sends everyone else the real thing. A toggle lets you see both.
- **Links as glyphs.** Platform icons come from [Simple Icons](https://simpleicons.org/) and are drawn inline at export, in a single colour, so they survive video compression.
- **The URL is the file.** The whole design is encoded in the page address. Bookmark it, paste it into your notes, reopen it for the next talk. Presets also save in the browser.
- **A "me" preset.** Save your name, role and links once; each new talk only needs a title.

Keep the QR URL short. Video calls compress backgrounds hard, and a dense QR code will not scan.

---

## Frames CLI

Cut stills from a recording (Zoom, Teams, OBS, anything ffmpeg can read).

```sh
# one frame every 15 seconds between 4:30 and 52:00
npm run frames -- recording.mp4 --start 4:30 --end 52:00 --every 15s --out stills

# or cut on scene changes (slide transitions, big gestures)
npm run frames -- recording.mp4 --scenes 0.3 --out stills
```

| Option | Meaning | Default |
|---|---|---|
| `--start <t>` | start time: `4:30`, `00:04:30`, `270`, `270s`, `2m` | `0` |
| `--end <t>` | end time | end of file |
| `--every <t>` | fixed interval | `10s` |
| `--scenes [th]` | scene-change detection, threshold 0–1 | `0.3` when given |
| `--out <dir>` | output folder | `./stills` |
| `--width <px>` | scale frames down | source width |
| `--quality <n>` | JPEG quality, 2 best to 31 worst | `2` |

Output is `frame-0001.jpg …` plus a `manifest.json` with the timestamp of every frame, the source name and the settings used. The Picker reads this manifest.

---

## Picker

Drop the `stills/` folder on the page (or choose it). If the folder has a `manifest.json` from the Frames CLI, each frame shows its timestamp. Every frame is scored for sharpness in the browser (variance of the Laplacian on a small greyscale copy), so blurred and mid-transition frames sink when you sort by **Sharpest first**. Nothing is uploaded.

Pick a frame, choose a format, drag to position the crop, scroll to zoom, export. **Export all formats** writes one JPEG per size in a go. ← → step through frames.

| Platform | Sizes |
|---|---|
| Instagram | 1080×1080 · 1080×1350 · story 1080×1920 |
| LinkedIn | 1200×627 · 1080×1080 |
| Facebook | 1200×630 |
| X / Threads | 1600×900 |

Planned: face detection with MediaPipe Face Landmarker (face present, eyes open, not mid-word) so the ranking knows about people, and face-centred crops by default. An optional caption band will add the title, name and event in the same style as the Backdrop.

---

## Development

```
talk-kit/
  index.html, backdrop.html, picker.html   pages (Vite multi-page)
  src/backdrop/     editor state, canvas renderer
  src/picker/       folder loading, sharpness scoring, crop + export
  src/shared/       theme tokens, platform icons, formats, text helpers
  src/styles.css    UI styles
  cli/frames.ts     ffmpeg wrapper
  PLAN.md           design and milestones
```

```sh
npm run dev         # Vite dev server
npm run build       # static build to dist/
npm run typecheck   # tsc --noEmit
npm run frames      # the CLI
```

No framework. TypeScript, Vite, the Canvas API, [qrcode](https://github.com/soldair/node-qrcode), [simple-icons](https://github.com/simple-icons/simple-icons). The CLI shells out to ffmpeg and ffprobe.

Pull requests and issues are welcome, especially around frame scoring and new platform sizes.

---

## Licence

MIT © Bin Youn. Platform icons are from Simple Icons (CC0); brand names and marks belong to their owners.
