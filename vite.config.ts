import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'httpdocs/dist',
    emptyOutDir: true,
  },
});
