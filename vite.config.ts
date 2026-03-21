import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  root: '.',
  define: {
    __PKG_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: 'httpdocs/dist',
    emptyOutDir: true,
  },
});
