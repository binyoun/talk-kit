import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/** What we keep per frame once a face has been looked for. */
export interface FaceInfo {
  /** 0..1, combined: eyes open, mouth closed, face inside the frame. */
  score: number;
  eyesOpen: number;
  mouthClosed: number;
  inFrame: number;
  /** Face centre, as a fraction of image width / height. */
  cx: number;
  cy: number;
  /** Face box height as a fraction of image height. */
  size: number;
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// Copied from node_modules by scripts/copy-wasm.mjs on dev/build; relative to the page.
const WASM_DIR = 'mediapipe/wasm';

let landmarker: FaceLandmarker | null = null;
let loading: Promise<boolean> | null = null;

/** Resolve true when the model is ready, false if it could not be loaded (offline, old GPU…). */
export function loadFaceModel(): Promise<boolean> {
  if (landmarker) return Promise.resolve(true);
  if (loading) return loading;
  loading = (async () => {
    try {
      const files = await FilesetResolver.forVisionTasks(WASM_DIR);
      // CPU on purpose: the GPU delegate can come up fine and then return zero
      // faces on some machines (seen on an Apple Silicon Mac in Chrome). CPU is
      // ~100 ms a frame at 1024 px, which is fine for a contact sheet.
      landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
        minFaceDetectionConfidence: 0.3,
        outputFaceBlendshapes: true,
      });
      return true;
    } catch (e) {
      console.warn('face model unavailable', e);
      return false;
    }
  })();
  return loading;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export async function analyseFace(file: File): Promise<FaceInfo | null> {
  if (!landmarker) return null;
  // 1024 wide: a speaker in a meeting recording is often a small face in a wide frame
  const bmp = await createImageBitmap(file, { resizeWidth: 1024, resizeQuality: 'medium' });
  try {
    const res = landmarker.detect(bmp);
    const pts = res.faceLandmarks[0];
    if (!pts || !pts.length) return null;

    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const edge = 0.02;
    const overflow = Math.max(0, edge - minX, maxX - (1 - edge), edge - minY, maxY - (1 - edge));
    const inFrame = clamp01(1 - overflow / 0.1);

    const shapes = new Map<string, number>();
    for (const c of res.faceBlendshapes[0]?.categories ?? []) shapes.set(c.categoryName, c.score);
    const blink = Math.max(shapes.get('eyeBlinkLeft') ?? 0, shapes.get('eyeBlinkRight') ?? 0);
    const eyesOpen = clamp01(1 - blink);
    const jaw = shapes.get('jawOpen') ?? 0;
    const mouthClosed = clamp01(1 - jaw * 1.6);

    return {
      score: 0.5 * eyesOpen + 0.3 * mouthClosed + 0.2 * inFrame,
      eyesOpen,
      mouthClosed,
      inFrame,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      size: maxY - minY,
    };
  } finally {
    bmp.close();
  }
}
