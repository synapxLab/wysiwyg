// @synapxlab/wysiwyg — src/presets.ts
// Presets d'éditeur prêts à l'emploi : chaque preset décrit une configuration
// complète (toolbar + intention de sortie) sous forme déclarative compacte.
// Historiquement définis côté application (adliss filling.js), ils sont
// désormais fournis — et simplifiés — par le package lui-même.

import type { WysiwygOptions, WysiwygToolbarConfig } from './WysiwygEditor';

/** Toutes les clés de la toolbar — sert à construire les presets « liste blanche ». */
const TOOLBAR_KEYS: (keyof WysiwygToolbarConfig)[] = [
  'documentProps', 'source', 'addPara', 'pageBreak', 'selectAll', 'removeFormat',
  'lists', 'align', 'bidi', 'div', 'twig', 'grid', 'table', 'hr', 'codeBlock',
  'specialChar', 'image', 'link', 'heading', 'font', 'bold', 'italic',
  'underline', 'strike', 'caseSwitch', 'script', 'textColor', 'bgColor',
  'history', 'blockquote', 'pasteClean', 'fullscreen', 'formatHtml',
  'mermaid', 'math', 'excalidraw', 'draw', 'qrcode', 'audio',
  'elementProps', 'elementPropsEnabled',
];

/**
 * Construit une toolbar « liste blanche » : tout est masqué sauf les boutons cités.
 * Bien plus lisible que d'énumérer ~40 booléens par preset.
 */
export function toolbarOnly(...enabled: (keyof WysiwygToolbarConfig)[]): WysiwygToolbarConfig {
  const cfg: WysiwygToolbarConfig = {};
  for (const key of TOOLBAR_KEYS) cfg[key] = false;
  for (const key of enabled) cfg[key] = true;
  return cfg;
}

/** Noms des presets fournis par le package. */
export type WysiwygPresetName = 'product' | 'mini' | 'small' | 'bill' | 'pdf' | 'entity' | 'full';

/**
 * Presets d'éditeur :
 * - `product` — mise en forme minimale (fiches produit, descriptions courtes)
 * - `mini`    — product + blocs simples (hr, code, citation)
 * - `small`   — rédactionnel courant (titres, tableaux, diagrammes)
 * - `bill`    — documents de facturation (tableaux, saut de page, polices)
 * - `pdf`     — édition de documents PDF (propriétés document, grille, images) — sortie `intent: 'pdf'`
 * - `entity`  — templates Twig (panneau Twig actif)
 * - `full`    — tout activé (+ Twig)
 */
export const WYSI_PRESETS: Record<WysiwygPresetName, WysiwygOptions> = {
  product: {
    toolbar: toolbarOnly('removeFormat', 'lists', 'align', 'bold', 'italic', 'textColor', 'bgColor'),
    intent: 'html',
  },
  mini: {
    toolbar: toolbarOnly('removeFormat', 'lists', 'align', 'hr', 'codeBlock', 'blockquote',
      'bold', 'italic', 'textColor', 'bgColor'),
    intent: 'html',
  },
  small: {
    toolbar: toolbarOnly('source', 'selectAll', 'removeFormat', 'lists', 'align', 'mermaid', 'math',
      'table', 'hr', 'codeBlock', 'blockquote', 'heading',
      'bold', 'italic', 'underline', 'strike', 'textColor', 'bgColor'),
    intent: 'html',
  },
  bill: {
    toolbar: toolbarOnly('source', 'addPara', 'pageBreak', 'selectAll', 'removeFormat', 'lists', 'align',
      'table', 'hr', 'font', 'bold', 'italic', 'underline', 'strike', 'script', 'textColor', 'bgColor'),
    intent: 'pdf',
  },
  pdf: {
    documentProfile: 'pdf',
    intent: 'pdf',
    statusbarLabel: 'Document PDF',
    toolbar: toolbarOnly('documentProps', 'source', 'addPara', 'pageBreak', 'selectAll', 'removeFormat',
      'lists', 'align', 'div', 'grid', 'table', 'hr', 'image', 'heading', 'font',
      'bold', 'italic', 'underline', 'strike', 'textColor', 'bgColor', 'elementProps'),
  },
  entity: {
    toolbar: toolbarOnly('source', 'addPara', 'pageBreak', 'selectAll', 'removeFormat', 'lists', 'align',
      'twig', 'table', 'hr', 'font', 'bold', 'italic', 'underline', 'strike', 'script',
      'textColor', 'bgColor'),
  },
  full: {
    toolbar: { twig: true },
  },
};

/**
 * Résout un preset par son nom et applique d'éventuelles surcharges.
 * Les surcharges `toolbar` sont fusionnées clé par clé avec celles du preset.
 *
 * @example
 * const editor = new WysiwygEditor(resolvePreset('pdf', { statusbarLabel: 'Devis' }));
 */
export function resolvePreset(name: WysiwygPresetName | string, overrides: WysiwygOptions = {}): WysiwygOptions {
  const base = WYSI_PRESETS[name as WysiwygPresetName] ?? WYSI_PRESETS.full;
  return {
    ...base,
    ...overrides,
    toolbar: { ...base.toolbar, ...overrides.toolbar },
  };
}
