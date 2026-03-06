# Changelog

All notable changes to this project will be documented in this file.

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
