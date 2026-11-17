// @synapxlab/wysiwyg — src/index.ts
// Point d'entrée public du package : exports ESM/CJS de WysiwygEditor et des types.
export { WysiwygEditor } from './WysiwygEditor';
export type { WysiwygOptions, WysiwygToolbarConfig, WysiwygTwigSnippet, WysiwygCustomButton } from './WysiwygEditor';
export type { CellData, TableProps } from './table';
export { WYSI_PRESETS, resolvePreset, toolbarOnly } from './presets';
export type { WysiwygPresetName } from './presets';
export { applyIntent, normalizeForPdf, normalizeForHtml } from './intent';
export type { WysiwygIntent } from './intent';
export { SpeechReader } from './speech';
import './styles/main.scss';
