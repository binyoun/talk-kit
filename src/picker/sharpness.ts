/**
 * Variance of the Laplacian on a small greyscale copy of the frame.
 * Higher means more edge energy: sharper, or busier. Good enough to push
 * motion-blurred and mid-transition frames to the bottom of a contact sheet.
 */
export async function sharpness(file: File): Promise<number> {
  const w = 320;
  const bmp = await createImageBitmap(file, { resizeWidth: w, resizeQuality: 'low' });
  const h = bmp.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sum2 / n - mean * mean;
}
