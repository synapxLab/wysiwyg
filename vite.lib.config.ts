import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  define: {
    __PKG_VERSION__: JSON.stringify(version),
  },
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
