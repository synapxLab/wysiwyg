import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SynapxWysiwyg',
      formats: ['es', 'cjs'],
      fileName: (format) => `wysiwyg.${format}.js`,
    },
    rollupOptions: {
      output: {
        assetFileNames: 'wysiwyg.[ext]',
      },
    },
  },
});
