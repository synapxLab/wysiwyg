# @synapxlab/wysiwyg

> WYSIWYG rich-text editor — zero runtime dependencies, TypeScript + SCSS.

Built on the native `contenteditable` API. No React, no Vue, no jQuery — just a self-contained ESM/CJS library you drop into any project.

---

## Installation

```bash
npm install @synapxlab/wysiwyg
```

---

## Quick start

```js
import { WysiwygEditor } from '@synapxlab/wysiwyg';
import '@synapxlab/wysiwyg/dist/wysiwyg.css';

const editor = new WysiwygEditor();
document.getElementById('app').appendChild(editor.el);

// Read content
const html = editor.getValue();

// Set content
editor.setValue('<p>Hello <strong>world</strong></p>');

// Listen for changes
editor.onChange = () => {
  console.log(editor.getValue());
};
```

---

## Options

```ts
new WysiwygEditor({
  // Toolbar — disable individual button groups
  toolbar: {
    source:      true,   // Source HTML ↔ WYSIWYG toggle
    history:     true,   // Undo / Redo buttons
    formatHtml:  true,   // HTML pretty-printer (switches to source mode)
    fullscreen:  true,   // Full-screen toggle
    addPara:     true,   // Insert paragraph (escape current block)
    pageBreak:   true,   // Page break for print
    selectAll:   true,
    removeFormat:true,
    pasteClean:  true,   // Deep-clean styles & classes
    lists:       true,   // OL / UL
    align:       true,   // Left / Center / Right / Justify
    bidi:        true,   // LTR / RTL
    div:         true,   // Insert <div>
    grid:        true,   // Multi-column flexbox layout picker
    twig:        false,  // Twig snippets panel (opt-in)
    table:       true,   // Table with merge/split
    hr:          true,
    codeBlock:   true,   // <pre><code> block
    blockquote:  true,
    specialChar: true,
    image:       true,
    link:        true,
    heading:     true,   // Normal / H1–H6 selector
    font:        true,   // Font family + size selectors
    bold:        true,
    italic:      true,
    underline:   true,
    strike:      true,
    script:      true,   // Subscript / Superscript
    textColor:   true,
    bgColor:     true,
  },

  // Word / character counter in status bar (default: true)
  wordCount: true,

  // Upload callback for drag & drop / paste images
  // Must return a Promise<string> with the public URL
  upload: async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/upload', { method: 'POST', body: fd });
    const json = await res.json();
    return json.url;
  },

  // Deprecated — use toolbar: { source: false } instead
  hideSource: false,
})
```

---

## API

```ts
editor.getValue(): string          // Returns current HTML
editor.setValue(html: string): void
editor.focus(): void
editor.onChange?: () => void       // Called on every change
editor.el: HTMLElement             // Root element to mount
```

---

## Images

### From toolbar
Click the image button → enter URL, alt text, width, height.

### Drag & drop / paste from web
- If `upload` option is configured → file is uploaded automatically, image inserted with returned URL
- If not → a modal opens to enter the URL manually
- Pasting an image copied from a web page (with `https://` URL) → inserted directly, no upload needed

### Visual resize
Click any image in the editor to show:
- **8 drag handles** (corners keep aspect ratio, edges are free, Shift = force proportional)
- **Mini toolbar**: float left/center/right, quick sizes 25%/50%/75%/100%/Auto, Properties button
- **Size indicator** (live px dimensions)

---

## Source editor

Click the `</>` button to switch to source mode:
- **Syntax highlighting** — HTML tags, attributes, Twig variables `{{ }}` and blocks `{% %}` (Catppuccin Mocha palette)
- **Format HTML** — click the align-lines button to auto-indent
- Scroll synced between the textarea and the highlight layer

---

## Twig snippets (opt-in)

Enable with `toolbar: { twig: true }`. Opens a panel with 27 ready-made snippets in 6 categories (variables, conditions, loops, filters, functions, i18n). Snippets are inserted as plain text so Twig templating engines can process them.

---

## Grid layout

Click the grid button to open a preset picker:
- 12 presets: 1 col, 2 equal, 3 equal, 4 equal, 1/3+2/3, 2/3+1/3, 1/4+3/4, sidebar-left, sidebar-right, 3-cols mixed, etc.
- Gap selector: 0 / 8 / 16 / 24 / 32 px
- Inserts a `display:flex` row with proportional `flex:N` columns, visible dashed borders in editor only

---

## Table

Insert via toolbar → configure rows/columns/headers. Once in the editor:
- Hover a cell → inline mini toolbar: merge right, merge down, split, add/remove row/column, delete
- Click a cell → edit content directly

---

## Element inspector

Hover any block element in the editor to reveal a floating toolbar:
- **Properties** — opens a modal with tabs Principal / Attributs / Style for `<img>`, `<a>`, `<p>`, `<div>`, `<pre>`, `<table>` and all common elements
- **Move up / down** — reorder blocks
- **Duplicate**
- **Delete**

---

## CSS variables (theming)

All variables are scoped to `.be-wysiwyg`. Override them on the container or globally:

```css
.be-wysiwyg {
  --be-primary:      #4f46e5;
  --be-danger:       #ef4444;
  --be-bg:           #f8f9fa;
  --be-surface:      #ffffff;
  --be-border:       #e5e7eb;
  --be-text:         #111827;
  --be-text-muted:   #6b7280;
  --be-radius:       6px;
  --be-font:         system-ui, -apple-system, sans-serif;
  --be-font-mono:    'Courier New', monospace;
  --be-transition:   150ms ease;
}
```

---

## TypeScript

Full type declarations are included:

```ts
import type { WysiwygOptions, WysiwygToolbarConfig } from '@synapxlab/wysiwyg';
```

---

## Browser support

Modern browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+).
Uses `contenteditable`, `Selection` / `Range` APIs, `CSS color-mix()`.

---

## License

MIT — © SynapxLab
