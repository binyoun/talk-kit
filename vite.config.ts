import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        backdrop: resolve(__dirname, 'backdrop.html'),
        picker: resolve(__dirname, 'picker.html'),
      },
    },
  },
});
