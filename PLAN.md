# Plan

Written 11 Nov 2026. Decisions made at the start of the project; update as it moves.

## Shape

One repo, three parts that share a style system:

```
talk-kit/
  src/backdrop/     1. meeting background maker (browser)
  src/picker/       2b. contact sheet, scoring, crop + export (browser)
  src/shared/       theme tokens, text layout, canvas export, platform sizes
  cli/frames.ts     2a. ffmpeg wrapper: cut stills from a recording
```

Two pages, one CLI. The backdrop page and the picker share the same theme and text block, so a still exported for Instagram can carry the same title band as the background behind the speaker.

## 1. Backdrop maker

**Inputs:** title, subtitle/event, name + role, up to 4 links (platform + handle), light/dark, one accent colour, optional logo.

**Layout rule:** the speaker sits in the middle of a meeting frame, so everything goes to the edges. Title top-left, name bottom-left, links bottom-right, QR above the links. A centre "seat" guide is shown in the editor and never exported. A mirror toggle shows the frame as the speaker's own preview does.

**Output:** 1920×1080 PNG via canvas. Website link can render as a QR code.

**Persistence:** state is encoded in the URL hash; last state and named presets in `localStorage`.

## 2a. Frames CLI

```
npm run frames -- recording.mp4 --start 4:30 --end 52:00 --every 15s --out stills
npm run frames -- recording.mp4 --scenes 0.3
```

Thin wrapper over ffmpeg: one JPEG per interval or per scene change, plus `manifest.json` (source, timestamps, dimensions, settings).

## 2b. Picker

Drop the `stills/` folder on the page. The page:

1. **Scores** each frame locally: sharpness (Laplacian variance), face found, eyes open, mouth not mid-word, face not cut off. MediaPipe Face Landmarker, client-side.
2. **Ranks** and shows a contact sheet, best first, with filters (face only / slides only).
3. **Crops + exports** chosen frames per platform, face-centred by default.

| Platform | Sizes |
|---|---|
| Instagram | 1080×1080, 1080×1350, story 1080×1920 |
| LinkedIn | 1200×627, 1080×1080 |
| Facebook | 1200×630 |
| X / Threads | 1600×900 |

Optional caption band on export: title + name + event in the backdrop style.

## 2c. Live capture (later)

Same picker, different source: `getUserMedia` / `getDisplayMedia` grabs a frame every N seconds into IndexedDB while presenting. Deferred until 2a/2b are solid; it competes with the meeting app for the camera, so it may become "capture from a second device" instead.

## Milestones

- [x] 1. Scaffold + backdrop maker
- [x] 2. Frames CLI (interval + scene modes, manifest)
- [x] 3. Picker: load folder, contact sheet, crop/export per platform
- [x] 4. Scoring: sharpness (Laplacian variance) + face (MediaPipe Face Landmarker: present, eyes open, mouth closed, in frame); face-centred crops
- [ ] 5. Caption band + shared presets across both tools
- [ ] 6. Live capture, if still wanted

## Decisions

- No framework, no backend, no uploads. The only install beyond npm is ffmpeg.
- Brand glyphs from Simple Icons, drawn inline, monochrome. LinkedIn is not in Simple Icons, so it is a text badge.
- Scene-change cutting is in from the start, because fixed-interval sampling tends to land mid-blink.

## Not in scope

Video editing, clip export, slide extraction as text, posting to platforms.
