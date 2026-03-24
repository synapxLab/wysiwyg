# Changelog

All notable changes to this project will be documented in this file.

## [1.3.1] — 2026-03-24

### Fixed
- **KaTeX formulas — double insertion** — `insertHtmlBlock()` used `execCommand('insertHTML')` with a DOM fallback; Firefox always returns `false` from `execCommand`, causing both paths to run. Replaced with DOM-only `Range.insertNode()` (reliable on all modern browsers, preserves undo history).
- **KaTeX formulas — corrupted backslashes** — JS template literals interpret `\f`, `\n`, `\t`, `\r`, `\v`, `\b` as control characters, silently stripping the `\` from LaTeX commands (`\frac` → form-feed + `rac`). Added `sanitizeMathCode()` which reconstructs the original backslash sequences before passing the code to KaTeX. Applied at `applyHtml()` re-render and when reopening an existing formula.
- **KaTeX formulas — empty elements after `setValue()`** — `applyHtml()` now re-renders all `.be-math` elements that have a `data-math-code` attribute but no rendered content (e.g. templates loaded via `setValue()`).

---

## [1.3.0] — 2026-03-23

### Added
- **KaTeX math formulas (opt-in)** — inject a KaTeX instance via `opts.katex`, enable button with `toolbar: { math: true }`. Supports display mode (`$$...$$`) and inline mode (`$...$`). Delimiter stripping is automatic. Click formula to re-edit. Rendered as `<div|span class="be-math" data-math-code="...">`.
- **Excalidraw drawings (opt-in)** — inject `{ Excalidraw, exportToSvg, React, ReactDOM }` via `opts.excalidraw`, enable button with `toolbar: { excalidraw: true }`. Opens a centered modal (1100 × 80 vh) with the Excalidraw canvas. Drawing saved as embedded SVG + JSON state in `data-excalidraw-state`. Click drawing to re-edit. Hamburger menu and Library sidebar hidden inside the modal.

### Fixed
- **Table properties on template load** — `setValue()` / `applyHtml()` now converts plain `<table>` elements into full `WysiwygTable` widgets (with toolbar and property modal) via new `parseHtmlTableToState()` parser. Previously, table properties were only accessible after manual insertion, not after loading a template.
- **Table toolbar duplicate buttons** — Bold, Italic, Underline, Strikethrough buttons removed from the per-table toolbar (already present in the main toolbar).
- **Excalidraw insertion reliability** — `editorEl.focus()` forced before `restoreRange()` + fallback `Range.insertNode()` when `execCommand('insertHTML')` returns false (React steals focus during drawing session).

### Changed
- **Icons corrected** — Strikethrough (was ambiguous S-curves, now standard text-with-line icon), Select All (was X-in-dashed-box, now checkmark-in-dashed-box), Math (was EKG wave, now Σ sigma symbol).

---

## [1.2.1] — 2026-03-21

### Added
- **Brand label in status bar** — displays `@synapxlab/wysiwyg vX.X.X` on the left, version injected from `package.json` at build time via `define: { __PKG_VERSION__ }`

### Fixed
- **Resize grip** — editor root (`be-wysiwyg`) and parent wrapper both resize together; fixes grip not following the cursor when the editor is mounted inside a fixed-height container (e.g. `#editor-wrap { height: 560px }` in production)

---

## [1.2.0] — 2026-03-21

### Added
- **Mermaid diagrams** — inject any Mermaid v10+ instance via `opts.mermaid`, enable button with `toolbar: { mermaid: true }`. Zero bundle impact. Fenced code blocks (` ```mermaid ``` `) stripped automatically. Click diagram to re-edit.
- **Raw CSS textarea** in element properties Style tab — paste multi-line CSS with or without selector wrapper (`.foo { ... }`)
- **Height resize grip** — drag icon in status bar bottom-right resizes the parent container
- **Image drop from browser** — dragging an image from another tab extracts the URL and inserts the image directly (no upload needed)

### Changed
- **Format HTML button** moved to position 2 in toolbar, now hidden when not in source mode
- Editor and source view padding reduced to `10px`
- Element hover outline reduced from `2px` to `1px`
- Word count shifted left to reveal resize grip

### Fixed
- Italic icon was invisible (stroke path rendered with fill)
- `text-shadow` / `filter` inherited from host page no longer bleeds into source editor
- Mermaid blocks are protected during HTML formatting (SVG no longer broken by pretty-printer)
- Mermaid render errors displayed inline in modal with actual error message; orphaned DOM elements cleaned up

---

## [1.1.0] — 2026-03-06

### Added
- CSS import path `@synapxlab/wysiwyg/style.css`
- Node.js engine requirement bumped to `>=18.0.0`
- All previously indirect dependencies moved to `devDependencies`

---

## [1.0.0] — 2026-03-06

### Added
- Rich-text WYSIWYG editor built on `contenteditable` — zero runtime dependencies
- Full toolbar with configurable groups (`WysiwygToolbarConfig`)
- **Text** — bold, italic, underline, strike, subscript, superscript
- **Headings** — Normal / H1–H6 / blockquote / preformat selector
- **Lists** — ordered and unordered
- **Alignment** — left, center, right, justify
- **Direction** — LTR / RTL per block
- **Links** — insert / remove / anchor
- **Images** — insert by URL, drag & drop (with optional `upload` callback), paste from web, visual resize handles + mini toolbar (align, quick sizes, properties)
- **Table** — full merge/split cell support, per-cell inline props
- **Grid** — flexbox multi-column layout picker (12 presets, gap selector)
- **Code block** — `<pre><code>` with dark theme
- **Blockquote** — toggle button
- **Dividers** — `<hr>`, `<div>`, page break
- **Special characters** panel
- **Twig snippets** panel (opt-in via `toolbar: { twig: true }`)
- **Source editor** — HTML/CSS/Twig with syntax highlighting (Catppuccin Mocha palette)
- **HTML formatter** — auto-indent via DOM pretty-printer
- **Undo / Redo** toolbar buttons
- **Paste handler** — extracts clipboard fragment, strips Word/Google Docs artifacts, handles pasted images from web via Range API
- **Drag & drop images** — file drop triggers `upload` callback or URL modal
- **Clean content** button — deep DOM-based style/class stripper
- **Full-screen** mode with Escape key support
- **Word / character counter** status bar (optional via `wordCount: false`)
- **Element inspector** — hover toolbar with Properties / Move up / Move down / Duplicate / Delete
- **Properties modals** for `<img>`, `<a>`, `<p>`, `<div>`, `<pre>`, `<table>` (tabs: Principal / Attributs / Style)
- TypeScript declarations (`.d.ts`) published with the package
- Vite library build (ESM + CJS) + GitHub Actions CI/CD
