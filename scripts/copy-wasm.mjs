// Copies MediaPipe's wasm runtime into public/ so the Picker can load it
// from the same origin, online or off. Runs before `dev` and `build`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dst = 'public/mediapipe/wasm';

if (!existsSync(src)) {
  console.error('MediaPipe wasm not found; run npm install first.');
  process.exit(1);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
