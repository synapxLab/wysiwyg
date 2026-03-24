import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
  },
  build: {
    outDir: 'dist-excalidraw',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/excalidraw-vendor.ts'),
      output: {
        format: 'es',
        entryFileNames: 'excalidraw-vendor.js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash].[ext]',
      },
    },
  },
});
