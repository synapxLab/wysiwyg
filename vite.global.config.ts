import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

// Build IIFE autonome pour les addons CMS (WordPress, PrestaShop) :
// expose window.SynapxWysiwyg = { WysiwygEditor, WYSI_PRESETS, resolvePreset, … }
export default defineConfig({
  define: {
    __PKG_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, drop_console: true },
      mangle: true,
    },
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SynapxWysiwyg',
      formats: ['iife'],
      fileName: () => 'wysiwyg.global.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'wysiwyg.[ext]',
      },
    },
  },
});
