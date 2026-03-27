// @synapxlab/wysiwyg — src/index.ts
// Point d'entrée public du package : exports ESM/CJS de WysiwygEditor et des types.
export { WysiwygEditor } from './WysiwygEditor';
export type { WysiwygOptions, WysiwygToolbarConfig, WysiwygTwigSnippet } from './WysiwygEditor';
export type { CellData, TableProps } from './table';
import './styles/main.scss';
