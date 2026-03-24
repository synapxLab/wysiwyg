// ─── WysiwygEditor ────────────────────────────────────────────────────────────
// Éditeur WYSIWYG riche (contenteditable).

import type { TableProps } from './table';
import { WysiwygDrawEditor } from './draw';
import {
  ensureCells,
  insertRow, deleteRow, insertCol, deleteCol,
  mergeRight, mergeDown, splitH, splitV,
  buildTablePropsPanel,
  TablePropsModal,
  parseHtmlTableToState,
  ICONS as TBL,
} from './table';
import { pushModal, popModal, installEscapeHandler } from './modalStack';

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Active ou désactive chaque bouton / groupe de boutons de la toolbar.
 * Tous les groupes sont visibles par défaut sauf `twig` (false par défaut).
 *
 * @example
 * // Éditeur minimal — seulement formatage texte
 * new WysiwygEditor({ toolbar: {
 *   source: false, addPara: false, pageBreak: false, selectAll: false,
 *   removeFormat: false, lists: false, align: false, bidi: false,
 *   div: false, twig: false, table: false, hr: false,
 *   specialChar: false, image: false, link: false,
 *   heading: false, font: false, script: false,
 *   textColor: false, bgColor: false,
 * }})
 *
 * @example
 * // Activer le panneau Twig (contexte adliss.fr)
 * new WysiwygEditor({ toolbar: { twig: true } })
 */
export interface WysiwygToolbarConfig {
  /** Bouton Source HTML ↔ WYSIWYG (défaut: true) */
  source?: boolean;
  /** Bouton Ajouter un paragraphe — échappe le bloc courant (défaut: true) */
  addPara?: boolean;
  /** Bouton Saut de page impression (défaut: true) */
  pageBreak?: boolean;
  /** Bouton Tout sélectionner (défaut: true) */
  selectAll?: boolean;
  /** Bouton Supprimer mise en forme (défaut: true) */
  removeFormat?: boolean;
  /** Boutons listes ol / ul (défaut: true) */
  lists?: boolean;
  /** Boutons alignement gauche / centrer / droite / justifier (défaut: true) */
  align?: boolean;
  /** Boutons direction texte ltr / rtl (défaut: true) */
  bidi?: boolean;
  /** Bouton Insérer un &lt;div&gt; (défaut: true) */
  div?: boolean;
  /** Panneau de snippets Twig — défaut: **false** (opt-in, contexte Twig uniquement) */
  twig?: boolean;
  /** Panneau grille — insère des mises en page multi-colonnes flexbox (défaut: true) */
  grid?: boolean;
  /** Bouton Tableau avec merge/split (défaut: true) */
  table?: boolean;
  /** Bouton Ligne horizontale &lt;hr&gt; (défaut: true) */
  hr?: boolean;
  /** Bouton Bloc de code &lt;pre&gt;&lt;code&gt; (défaut: true) */
  codeBlock?: boolean;
  /** Panneau Caractères spéciaux (défaut: true) */
  specialChar?: boolean;
  /** Bouton Insérer une image (défaut: true) */
  image?: boolean;
  /** Boutons Lien / Supprimer lien / Ancre (défaut: true) */
  link?: boolean;
  /** Sélecteur de titre Normal / H1–H6 / Citation / Préformat. (défaut: true) */
  heading?: boolean;
  /** Sélecteurs Police et Taille de police (défaut: true) */
  font?: boolean;
  /** Bouton Gras (défaut: true) */
  bold?: boolean;
  /** Bouton Italique (défaut: true) */
  italic?: boolean;
  /** Bouton Souligné (défaut: true) */
  underline?: boolean;
  /** Bouton Barré (défaut: true) */
  strike?: boolean;
  /** Boutons Indice / Exposant (défaut: true) */
  script?: boolean;
  /** Sélecteur Couleur du texte (défaut: true) */
  textColor?: boolean;
  /** Sélecteur Couleur de fond (défaut: true) */
  bgColor?: boolean;
  /** Boutons Annuler / Refaire (défaut: true) */
  history?: boolean;
  /** Bouton Citation &lt;blockquote&gt; (défaut: true) */
  blockquote?: boolean;
  /** Bouton Nettoyer le contenu — supprime styles et classes parasites (défaut: true) */
  pasteClean?: boolean;
  /** Bouton Plein écran (défaut: true) */
  fullscreen?: boolean;
  /** Bouton Formater / indenter le HTML en mode source (défaut: true) */
  formatHtml?: boolean;
  /** Bouton diagramme Mermaid (défaut: false — nécessite opts.mermaid) */
  mermaid?: boolean;
  /** Bouton formule mathématique KaTeX (défaut: false — nécessite opts.katex) */
  math?: boolean;
  /** Bouton dessin Excalidraw (défaut: false — nécessite opts.excalidraw) */
  excalidraw?: boolean;
  /** Bouton éditeur SVG maison WysiwygDraw (défaut: false — opt-in) */
  draw?: boolean;
}

export interface WysiwygOptions {
  /**
   * Configuration individuelle des boutons de la toolbar.
   * Chaque clé est un groupe ; sa valeur booléenne l'active ou le masque.
   * Les groupes non mentionnés conservent leur valeur par défaut.
   */
  toolbar?: WysiwygToolbarConfig;
  /**
   * @deprecated Utilisez `toolbar: { source: false }` à la place.
   * Masque le bouton Source HTML (conservé pour compatibilité ascendante).
   */
  hideSource?: boolean;
  /** Afficher le compteur mots / caractères dans la barre de statut (défaut: true) */
  wordCount?: boolean;
  /**
   * Callback d'upload déclenché au drag & drop d'un fichier image.
   * Doit renvoyer une Promise avec l'URL publique du fichier uploadé.
   * Si absent, une modale demande l'URL manuellement.
   *
   * @example
   * new WysiwygEditor({
   *   upload: async (file) => {
   *     const fd = new FormData();
   *     fd.append('file', file);
   *     const res = await fetch('/upload', { method: 'POST', body: fd });
   *     const json = await res.json();
   *     return json.url;
   *   }
   * })
   */
  upload?: (file: File) => Promise<string>;
  /**
   * Instance Mermaid (v10+) pour le rendu de diagrammes.
   * Permet d'injecter mermaid sans l'embarquer dans le bundle.
   *
   * @example
   * import mermaid from 'mermaid';
   * mermaid.initialize({ startOnLoad: false });
   * new WysiwygEditor({ mermaid })
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mermaid?: any;
  /**
   * Instance KaTeX pour le rendu de formules mathématiques LaTeX.
   * Permet d'injecter KaTeX sans l'embarquer dans le bundle.
   * Le CSS KaTeX doit être chargé séparément dans la page.
   *
   * @example
   * import katex from 'katex';
   * import 'katex/dist/katex.min.css';
   * new WysiwygEditor({ katex, toolbar: { math: true } })
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  katex?: any;
  /**
   * Dépendances Excalidraw pour le dessin libre.
   * React et ReactDOM doivent être fournis car Excalidraw est un composant React.
   *
   * @example
   * import { Excalidraw, exportToSvg } from '@excalidraw/excalidraw';
   * import React from 'react';
   * import ReactDOM from 'react-dom/client';
   * new WysiwygEditor({ excalidraw: { Excalidraw, exportToSvg, React, ReactDOM } })
   */
  excalidraw?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Excalidraw: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportToSvg: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReactDOM: any;
  };
  /**
   * Active l'éditeur SVG maison WysiwygDraw (zéro dépendance externe).
   * Afficher le bouton via `toolbar: { draw: true }`.
   *
   * @example
   * new WysiwygEditor({ draw: true, toolbar: { draw: true } })
   */
  draw?: boolean;
  /**
   * Snippets Twig supplémentaires injectés dans le panneau Twig.
   * Chaque entrée doit avoir une catégorie, un libellé et le code à insérer.
   * Ces snippets s'ajoutent aux snippets génériques intégrés.
   *
   * @example
   * new WysiwygEditor({
   *   toolbar: { twig: true },
   *   twigSnippets: [
   *     { cat: 'Mon projet', label: '{{ user.name }}',  code: '{{ user.name }}' },
   *     { cat: 'Mon projet', label: '|asLetters',       code: '{{ val|asLetters }}' },
   *   ]
   * })
   */
  twigSnippets?: WysiwygTwigSnippet[];
}

/** Un snippet Twig injectables dans le panneau Twig. */
export interface WysiwygTwigSnippet {
  /** Catégorie d'affichage (en-tête de section dans le panneau) */
  cat: string;
  /** Libellé affiché sur le bouton */
  label: string;
  /** Code inséré dans l'éditeur au clic */
  code: string;
}

export class WysiwygEditor {
  el: HTMLElement;
  /** Appelé à chaque modification du contenu */
  onChange?: () => void;

  private opts: WysiwygOptions;
  private editorEl!: HTMLDivElement;
  private sourceEl!: HTMLTextAreaElement;
  private sourceWrapEl!: HTMLDivElement;
  private sourceHlEl!: HTMLPreElement;
  private toolbarEl!: HTMLElement;
  private sourceMode = false;
  private savedRange: Range | null = null;
  private activePanel: HTMLElement | null = null;
  private activePanelBtn: HTMLElement | null = null;
  private readonly formModal = new WysiwygFormModal();
  private elemToolbarEl!: HTMLElement;
  private elemTagLabelEl!: HTMLElement;
  private hoveredEl: HTMLElement | null = null;
  private hideToolbarTimer: ReturnType<typeof setTimeout> | null = null;
  private isFullscreen = false;
  private statusBarEl!: HTMLElement;
  private wordCountEl!: HTMLElement;
  private imgResizerEl: HTMLElement | null = null;
  private resizingImg: HTMLImageElement | null = null;
  private drawEditor: WysiwygDrawEditor | null = null;

  constructor(opts: WysiwygOptions = {}) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = opts.hideSource ? 'be-wysiwyg be-wysiwyg--embedded' : 'be-wysiwyg';

    this.toolbarEl = this.buildToolbar();
    this.el.appendChild(this.toolbarEl);

    this.buildBody();
    this.buildStatusBar();
    this.setupPasteHandler();
    this.setupDragDrop();
    this.setupImageResize();
    this.setupClickOutside();
    this.setupMermaidClickHandler();
    this.setupMathClickHandler();
    this.setupExcalidrawClickHandler();
    this.setupDrawClickHandler();
    this.setupElementInspector();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getValue(): string {
    return this.sourceMode ? this.sourceEl.value : this.getHtml();
  }

  setValue(html: string): void {
    const content = html || '<p></p>';
    this.applyHtml(content);
    this.sourceEl.value = content;
    if (this.sourceMode) this.refreshHighlight();
  }

  focus(): void {
    if (this.sourceMode) this.sourceEl.focus();
    else this.editorEl.focus();
  }

  // ── Private — layout ───────────────────────────────────────────────────────

  private buildBody(): void {
    const body = document.createElement('div');
    body.className = 'be-wysiwyg__body';

    const main = document.createElement('div');
    main.className = 'be-wysiwyg__main';

    this.editorEl = document.createElement('div');
    this.editorEl.className = 'be-wysiwyg__editor';
    this.editorEl.contentEditable = 'true';
    this.editorEl.spellcheck = true;
    this.editorEl.innerHTML = '<p></p>';

    this.editorEl.addEventListener('keyup', () => this.syncState());
    this.editorEl.addEventListener('mouseup', () => this.syncState());
    this.editorEl.addEventListener('focus', () => this.syncState());
    this.editorEl.addEventListener('input', () => { this.onChange?.(); this.updateWordCount(); });
    this.editorEl.addEventListener('tableStateChange', () => this.onChange?.());
    this.editorEl.addEventListener('mousedown', () => { /* no-op */ });

    // ── Source view : pre (highlight) + textarea (edition) superposés ──────────
    this.sourceWrapEl = document.createElement('div');
    this.sourceWrapEl.className = 'be-wysiwyg__source-wrap';
    this.sourceWrapEl.style.display = 'none';

    this.sourceHlEl = document.createElement('pre');
    this.sourceHlEl.className = 'be-wysiwyg__source-hl';
    this.sourceHlEl.setAttribute('aria-hidden', 'true');

    this.sourceEl = document.createElement('textarea');
    this.sourceEl.className = 'be-wysiwyg__source';
    this.sourceEl.spellcheck = false;
    (this.sourceEl as HTMLTextAreaElement & { autocomplete: string }).autocomplete = 'off';

    this.sourceEl.addEventListener('input', () => {
      this.refreshHighlight();
      this.onChange?.();
    });
    this.sourceEl.addEventListener('scroll', () => {
      this.sourceHlEl.scrollTop = this.sourceEl.scrollTop;
      this.sourceHlEl.scrollLeft = this.sourceEl.scrollLeft;
    });

    this.sourceWrapEl.appendChild(this.sourceHlEl);
    this.sourceWrapEl.appendChild(this.sourceEl);

    main.appendChild(this.editorEl);
    main.appendChild(this.sourceWrapEl);
    body.appendChild(main);
    this.el.appendChild(body);
  }

  // ── HTML helpers ───────────────────────────────────────────────────────────

  private getHtml(): string {
    const clone = this.editorEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll<HTMLElement>('.be-wysiwyg-table-widget').forEach(widget => {
      const jsonStr = widget.dataset.tableState;
      if (!jsonStr) return;
      const state = JSON.parse(jsonStr) as TableProps;
      const html = renderTableHtml(state);
      widget.replaceWith(html);
    });
    return clone.innerHTML;
  }

  private applyHtml(html: string): void {
    this.editorEl.innerHTML = html;
    // Convertir les <table> bruts (ex: chargés depuis un template) en WysiwygTable
    this.editorEl.querySelectorAll<HTMLTableElement>('table').forEach(table => {
      if (table.closest('.be-wysiwyg-table-widget')) return;
      const state = parseHtmlTableToState(table);
      const widget = new WysiwygTable({ state });
      // Si le <table> est le seul enfant d'un <div> wrapper (sortie de renderTableHtml), remplacer le div
      const parent = table.parentElement;
      if (parent && parent !== this.editorEl && parent.tagName === 'DIV' && parent.children.length === 1) {
        parent.replaceWith(widget.el);
      } else {
        table.replaceWith(widget.el);
      }
    });
    // Re-rendre les formules KaTeX (éléments .be-math vides chargés depuis un template)
    if (this.opts.katex) {
      this.editorEl.querySelectorAll<HTMLElement>('.be-math').forEach(el => {
        const raw = el.getAttribute('data-math-code');
        if (!raw) return;
        const code = this.sanitizeMathCode(raw);
        const display = el.getAttribute('data-math-display') !== '0';
        try {
          el.innerHTML = this.opts.katex.renderToString(code, { displayMode: display, throwOnError: false });
        } catch { /* ignore */ }
      });
    }
  }

  // ── Paste ──────────────────────────────────────────────────────────────────

  private setupPasteHandler(): void {
    this.editorEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const items   = Array.from(e.clipboardData?.items ?? []);
      const rawHtml = e.clipboardData?.getData('text/html') ?? '';
      const text    = e.clipboardData?.getData('text/plain') ?? '';

      // Fichier image dans le clipboard (copie native ou screenshot)
      const imgItem = items.find(i => i.kind === 'file' && i.type.startsWith('image/'));

      if (rawHtml.trim()) {
        // Extraire le vrai fragment (format clipboard Windows : <!--StartFragment-->…<!--EndFragment-->)
        const fragment = this.extractHtmlFragment(rawHtml);

        // Image avec URL réelle (http://, https://, //, /path)
        if (/<img[^>]+src=["'](?:https?:)?\/\//i.test(fragment) ||
            /<img[^>]+src=["']\/[^/"]/i.test(fragment)) {
          this.insertHtmlAtCursor(this.cleanPastedHtml(fragment));
          return;
        }
        // Image data: URI → utiliser le fichier binaire si disponible
        if (imgItem && /<img/i.test(fragment)) {
          const file = imgItem.getAsFile();
          if (file) { this.handleImageFile(file); return; }
        }
        // HTML générique (texte mis en forme, tableaux…)
        const clean = this.cleanPastedHtml(fragment);
        if (clean.trim()) { this.insertHtmlAtCursor(clean); return; }
      }

      // Pas de HTML utile → fichier image binaire seul
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) { this.handleImageFile(file); return; }
      }

      // Fallback texte brut
      if (text) document.execCommand('insertText', false, text);
    });
  }

  /** Extrait le contenu entre <!--StartFragment--> et <!--EndFragment--> si présent */
  private extractHtmlFragment(html: string): string {
    const m = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
    return m ? m[1] : html;
  }

  /** Insère du HTML à la position du curseur via l'API Range (remplace execCommand insertHTML) */
  private insertHtmlAtCursor(html: string): void {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const frag = document.createDocumentFragment();
    let lastNode: Node | null = null;
    while (tmp.firstChild) { lastNode = tmp.firstChild; frag.appendChild(lastNode); }
    range.insertNode(frag);

    // Déplacer le curseur après le contenu inséré
    if (lastNode) {
      const r = document.createRange();
      r.setStartAfter(lastNode);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    this.onChange?.();
  }

  /** Upload ou modale selon la config — partagé entre paste et drag & drop */
  private handleImageFile(file: File): void {
    const alt = file.name.replace(/\.[^.]+$/, '');
    const esc = (s: string) => s.replace(/"/g, '&quot;');
    const insertImg = (src: string) => {
      document.execCommand('insertHTML', false, `<img src="${esc(src)}" alt="${esc(alt)}" style="max-width:100%">`);
      this.onChange?.();
    };
    if (this.opts.upload) {
      this.opts.upload(file).then(insertImg).catch(err => console.error('[wysiwyg] upload error:', err));
    } else {
      this.formModal.show({
        title: 'Insérer une image',
        submitLabel: 'Insérer',
        tabs: [{ label: 'Principal', fields: [
          { key: 'src', label: 'URL source *', type: 'url', required: true, placeholder: 'https://…' },
          { key: 'alt', label: 'Texte alternatif', type: 'text', value: alt },
        ]}],
        onSubmit: (v) => { if (v.src) insertImg(v.src); },
      });
    }
  }

  private setupClickOutside(): void {
    document.addEventListener('mousedown', (e) => {
      if (this.activePanel && !this.activePanel.contains(e.target as Node) &&
          this.activePanelBtn !== e.target &&
          !this.activePanelBtn?.contains(e.target as Node)) {
        this.closePanel();
      }
    });
  }

  private cleanPastedHtml(html: string): string {
    return html
      .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '')
      .replace(/<w:[^>]+>[\s\S]*?<\/w:[^>]+>/gi, '')
      .replace(/<m:[^>]+>[\s\S]*?<\/m:[^>]+>/gi, '')
      .replace(/\s*mso-[^;":]+:[^;";]+/gi, '')
      .replace(/class="[^"]*"/gi, '')
      .replace(/style="[^"]*"/gi, '')
      .replace(/<span\s*>([\s\S]*?)<\/span>/gi, '$1')
      .replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, '$1')
      .replace(/<!--[\s\S]*?-->/g, '');
  }

  // ── Image resize overlay ──────────────────────────────────────────────────

  private setupImageResize(): void {
    this.editorEl.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG') {
        e.preventDefault();
        this.showImgResizer(t as HTMLImageElement);
      } else {
        this.hideImgResizer();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideImgResizer();
    });
    // Reposition on editor scroll
    this.editorEl.addEventListener('scroll', () => {
      if (this.resizingImg) this.positionImgResizer(this.resizingImg);
    });
  }

  private showImgResizer(img: HTMLImageElement): void {
    this.hideImgResizer();
    this.resizingImg = img;

    const wrap = document.createElement('div');
    wrap.className = 'be-img-resizer';
    document.body.appendChild(wrap);
    this.imgResizerEl = wrap;

    // ── 8 handles ──────────────────────────────────────────────────────────
    (['nw','n','ne','e','se','s','sw','w'] as const).forEach(pos => {
      const h = document.createElement('div');
      h.className = `be-img-resizer__handle be-img-resizer__handle--${pos}`;
      h.addEventListener('mousedown', (e) => this.startResize(e, img, pos));
      wrap.appendChild(h);
    });

    // ── Mini toolbar ───────────────────────────────────────────────────────
    const tb = document.createElement('div');
    tb.className = 'be-img-resizer__toolbar';

    const S2 = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">${d}</svg>`;

    // Alignements
    const aligns: { icon: string; title: string; fn: () => void }[] = [
      { icon: S2('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>'),
        title: 'Float gauche', fn: () => { img.style.cssText += ';float:left;display:inline;margin:0 12px 8px 0'; } },
      { icon: S2('<line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>'),
        title: 'Centrer', fn: () => { img.style.float = ''; img.style.display = 'block'; img.style.margin = '0 auto'; } },
      { icon: S2('<line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>'),
        title: 'Float droite', fn: () => { img.style.cssText += ';float:right;display:inline;margin:0 0 8px 12px'; } },
      { icon: S2('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
        title: 'Aucun alignement', fn: () => { img.style.float = ''; img.style.display = ''; img.style.margin = ''; } },
    ];
    aligns.forEach(a => {
      const btn = this.makeImgTbBtn(a.icon, a.title, () => { a.fn(); this.onChange?.(); requestAnimationFrame(() => this.positionImgResizer(img)); });
      tb.appendChild(btn);
    });

    // Séparateur
    const sep = document.createElement('span');
    sep.className = 'be-img-resizer__sep';
    tb.appendChild(sep);

    // Tailles rapides
    ['25%','50%','75%','100%'].forEach(size => {
      const btn = this.makeImgTbBtn(size, `Largeur ${size}`, () => {
        img.style.width = size; img.style.height = 'auto';
        img.removeAttribute('width'); img.removeAttribute('height');
        this.onChange?.();
        requestAnimationFrame(() => this.positionImgResizer(img));
      });
      btn.classList.add('be-img-resizer__tbtn--size');
      tb.appendChild(btn);
    });

    // Taille auto
    const autoBtn = this.makeImgTbBtn('Auto', 'Taille originale', () => {
      img.style.width = ''; img.style.height = '';
      img.removeAttribute('width'); img.removeAttribute('height');
      this.onChange?.();
      requestAnimationFrame(() => this.positionImgResizer(img));
    });
    autoBtn.classList.add('be-img-resizer__tbtn--size');
    tb.appendChild(autoBtn);

    const sep2 = document.createElement('span');
    sep2.className = 'be-img-resizer__sep';
    tb.appendChild(sep2);

    // Propriétés
    const propsBtn = this.makeImgTbBtn(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>`,
      'Propriétés',
      () => { this.hideImgResizer(); this.openElementPropsModal(img); }
    );
    tb.appendChild(propsBtn);

    wrap.appendChild(tb);

    // ── Indicateur de taille ───────────────────────────────────────────────
    const lbl = document.createElement('div');
    lbl.className = 'be-img-resizer__sizelabel';
    wrap.appendChild(lbl);

    // Click outside → fermer
    const onOutside = (e: MouseEvent) => {
      if (!wrap.contains(e.target as Node) && e.target !== img) {
        this.hideImgResizer();
        document.removeEventListener('mousedown', onOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);

    this.positionImgResizer(img);
  }

  private makeImgTbBtn(html: string, title: string, fn: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'be-img-resizer__tbtn';
    btn.title = title;
    btn.innerHTML = html;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
    return btn;
  }

  private positionImgResizer(img: HTMLImageElement): void {
    if (!this.imgResizerEl) return;
    const rect = img.getBoundingClientRect();
    const r = this.imgResizerEl;
    r.style.top    = `${rect.top}px`;
    r.style.left   = `${rect.left}px`;
    r.style.width  = `${rect.width}px`;
    r.style.height = `${rect.height}px`;
    const lbl = r.querySelector<HTMLElement>('.be-img-resizer__sizelabel');
    if (lbl) lbl.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
  }

  private hideImgResizer(): void {
    this.imgResizerEl?.remove();
    this.imgResizerEl = null;
    this.resizingImg = null;
  }

  private startResize(e: MouseEvent, img: HTMLImageElement, pos: string): void {
    e.preventDefault(); e.stopPropagation();
    const startX  = e.clientX;
    const startY  = e.clientY;
    const startW  = img.offsetWidth;
    const startH  = img.offsetHeight;
    const aspect  = startW / startH;
    const isCorner = pos.length === 2; // 'nw','ne','se','sw'

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      let newW = startW;
      let newH = startH;

      if (pos.includes('e')) newW = Math.max(20, startW + dx);
      if (pos.includes('w')) newW = Math.max(20, startW - dx);
      if (pos.includes('s')) newH = Math.max(20, startH + dy);
      if (pos.includes('n')) newH = Math.max(20, startH - dy);

      // Coins → proportionnel; bords → libre; Shift → force proportionnel
      if (isCorner || me.shiftKey) {
        if (pos.includes('e') || pos.includes('w') || me.shiftKey) newH = Math.round(newW / aspect);
        else newW = Math.round(newH * aspect);
      }

      img.style.width  = `${Math.round(newW)}px`;
      img.style.height = `${Math.round(newH)}px`;
      img.removeAttribute('width'); img.removeAttribute('height');
      this.positionImgResizer(img);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.onChange?.();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Deep clean ─────────────────────────────────────────────────────────────

  private deepCleanNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    const ALLOWED = new Set([
      'p','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','del','ins',
      'a','ul','ol','li','blockquote','pre','code','br','img','table','thead','tbody',
      'tfoot','tr','td','th','hr','div','span','sup','sub',
    ]);
    const KEEP_ATTRS: Record<string, string[]> = {
      a: ['href', 'target', 'rel', 'name', 'id'],
      img: ['src', 'alt', 'width', 'height', 'style'],
      td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'],
    };
    if (!ALLOWED.has(tag)) {
      // Unwrap — keep children, remove the element itself
      const frag = document.createDocumentFragment();
      while (el.firstChild) frag.appendChild(el.firstChild);
      el.parentNode?.replaceChild(frag, el);
      return;
    }
    const allowed = KEEP_ATTRS[tag] ?? [];
    Array.from(el.attributes).forEach(attr => {
      if (!allowed.includes(attr.name)) el.removeAttribute(attr.name);
    });
    Array.from(el.childNodes).forEach(c => this.deepCleanNode(c));
  }

  private cleanContent(): void {
    Array.from(this.editorEl.childNodes).forEach(n => this.deepCleanNode(n));
    this.onChange?.();
  }

  // ── Blockquote ─────────────────────────────────────────────────────────────

  private toggleBlockquote(): void {
    const block = this.getCurrentBlock();
    if (block?.tagName.toLowerCase() === 'blockquote') {
      const p = document.createElement('p');
      p.innerHTML = block.innerHTML || '<br>';
      block.replaceWith(p);
      this.moveCursorTo(p);
    } else {
      document.execCommand('formatBlock', false, 'blockquote');
    }
    this.onChange?.();
  }

  // ── Drag & drop images ─────────────────────────────────────────────────────

  private setupDragDrop(): void {
    const isImageDrag = (e: DragEvent): boolean => {
      const items = Array.from(e.dataTransfer?.items ?? []);
      if (items.some(i => i.kind === 'file' && i.type.startsWith('image/'))) return true;
      const types = Array.from(e.dataTransfer?.types ?? []);
      return types.includes('text/uri-list') || types.includes('text/html');
    };

    this.editorEl.addEventListener('dragover', (e) => {
      if (isImageDrag(e)) {
        e.preventDefault();
        this.editorEl.classList.add('be-wysiwyg__editor--dragover');
      }
    });
    this.editorEl.addEventListener('dragleave', (e) => {
      if (!this.editorEl.contains(e.relatedTarget as Node)) {
        this.editorEl.classList.remove('be-wysiwyg__editor--dragover');
      }
    });
    this.editorEl.addEventListener('drop', (e) => {
      this.editorEl.classList.remove('be-wysiwyg__editor--dragover');
      if (!isImageDrag(e)) return;
      e.preventDefault();

      // Position cursor at drop point
      const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }

      // Image depuis le navigateur → URL en priorité
      const uri = e.dataTransfer?.getData('text/uri-list');
      if (uri && uri.trim()) {
        const url = uri.split('\n').map(s => s.trim()).find(s => s && !s.startsWith('#'));
        if (url) { this.insertImageFromUrl(url); return; }
      }

      // Fallback : extraire src depuis le HTML draggé
      const html = e.dataTransfer?.getData('text/html') ?? '';
      const match = html.match(/<img[^>]+src="([^"]+)"/i);
      if (match?.[1]) { this.insertImageFromUrl(match[1]); return; }

      // Fichier local → upload callback ou modale
      const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
      if (files.length) this.handleImageFile(files[0]);
    });
  }

  private insertImageFromUrl(src: string): void {
    const esc = (s: string) => s.replace(/"/g, '&quot;');
    document.execCommand('insertHTML', false, `<img src="${esc(src)}" alt="" style="max-width:100%">`);
    this.onChange?.();
  }

  // ── Mermaid ─────────────────────────────────────────────────────────────────

  private insertMermaid(existingEl?: HTMLElement): void {
    if (!this.opts.mermaid) return;
    const existingCode = existingEl?.getAttribute('data-mermaid-code') ?? '';
    this.saveRange();
    this.formModal.show({
      title: 'Diagramme Mermaid',
      submitLabel: existingEl ? 'Mettre à jour' : 'Insérer',
      fields: [
        {
          key: 'code',
          label: 'Code Mermaid',
          type: 'textarea',
          rows: 10,
          value: existingCode,
          placeholder: 'flowchart LR\n  A[Début] --> B{Condition}\n  B -->|Oui| C[Résultat]\n  B -->|Non| D[Fin]',
        },
      ],
      onSubmit: async (v) => {
        // Supprimer les délimiteurs markdown ```mermaid ... ``` si présents
        const raw = v.code?.trim() ?? '';
        const code = raw.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();
        if (!code) return;
        try {
          const id = `be-mermaid-${Date.now()}`;
          const { svg } = await this.opts.mermaid.render(id, code);
          // Nettoyer les éléments orphelins laissés par mermaid dans le body
          document.getElementById(id)?.remove();
          document.getElementById(`d${id}`)?.remove();
          const esc = (s: string) => s.replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
          const block = `<div class="be-mermaid" data-mermaid-code="${esc(code)}" contenteditable="false">${svg}</div>`;
          if (existingEl) {
            existingEl.outerHTML = block;
          } else {
            this.insertHtmlBlock(block);
          }
          this.onChange?.();
        } catch (err: unknown) {
          // Nettoyer les éléments orphelins en cas d'erreur aussi
          document.querySelectorAll('[id^="be-mermaid-"]').forEach(el => {
            if (!el.closest('.be-wysiwyg')) el.remove();
          });
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[wysiwyg] Mermaid render error:', err);
          this.formModal.showError(`Erreur Mermaid : ${msg}`);
        }
      },
    });
  }

  private setupMermaidClickHandler(): void {
    this.editorEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.be-mermaid') as HTMLElement | null;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        this.insertMermaid(target);
      }
    });
  }

  // ── Math (KaTeX) ─────────────────────────────────────────────────────────────

  // Répare les caractères de contrôle JS (\n, \t, \f, \r, \v, \b) injectés par erreur
  // dans data-math-code lorsqu'un template literal JS n'échappait pas les backslashes.
  private sanitizeMathCode(s: string): string {
    return s
      .replace(/\x08/g, '\\b')  // backspace  ← \beta, \bar, \boldsymbol…
      .replace(/\x09/g, '\\t')  // tab        ← \theta, \times, \tau…
      .replace(/\x0A/g, '\\n')  // newline    ← \nabla, \nu, \neq…
      .replace(/\x0B/g, '\\v')  // vtab       ← \varepsilon, \varphi, \vec…
      .replace(/\x0C/g, '\\f')  // form-feed  ← \frac, \forall…
      .replace(/\x0D/g, '\\r'); // CR         ← \rho, \rm…
  }

  private insertMath(existingEl?: HTMLElement): void {
    if (!this.opts.katex) return;
    const existingCode = this.sanitizeMathCode(existingEl?.getAttribute('data-math-code') ?? '');
    const isDisplay = !existingEl || existingEl.getAttribute('data-math-display') === '1';
    this.saveRange();
    this.formModal.show({
      title: 'Formule mathématique (LaTeX)',
      submitLabel: existingEl ? 'Mettre à jour' : 'Insérer',
      fields: [
        {
          key: 'formula',
          label: 'Formule LaTeX',
          type: 'textarea',
          rows: 6,
          value: existingCode,
          placeholder: '\\frac{a}{b} + \\sqrt{x^2 + y^2}',
        },
        {
          key: 'display',
          label: 'Mode',
          type: 'select',
          value: isDisplay ? '1' : '0',
          options: [
            { value: '1', label: 'Bloc ($$...$$)' },
            { value: '0', label: 'Inline ($...$)' },
          ],
        },
      ],
      onSubmit: (v) => {
        // Retirer les délimiteurs $$ ... $$ ou $ ... $ si l'utilisateur les a inclus
        const raw = v.formula?.trim() ?? '';
        const code = raw.replace(/^\$\$?\s*/, '').replace(/\s*\$\$?$/, '').trim();
        if (!code) return;
        const display = v.display !== '0';
        try {
          const rendered = this.opts.katex.renderToString(code, {
            displayMode: display,
            throwOnError: true,
          });
          const esc = (s: string) => s.replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
          const tag = display ? 'div' : 'span';
          const block = `<${tag} class="be-math" data-math-code="${esc(code)}" data-math-display="${display ? '1' : '0'}" contenteditable="false">${rendered}</${tag}>`;
          if (existingEl) {
            existingEl.outerHTML = block;
          } else {
            this.insertHtmlBlock(block);
          }
          this.onChange?.();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[wysiwyg] KaTeX render error:', err);
          this.formModal.showError(`Erreur KaTeX : ${msg}`);
        }
      },
    });
  }

  // ── Excalidraw ───────────────────────────────────────────────────────────────

  private insertExcalidraw(existingEl?: HTMLElement): void {
    if (!this.opts.excalidraw) return;
    const { Excalidraw, exportToSvg, React, ReactDOM } = this.opts.excalidraw;

    this.saveRange();

    let initialData: Record<string, unknown> | undefined;
    if (existingEl) {
      try {
        const s = existingEl.getAttribute('data-excalidraw-state');
        if (s) initialData = JSON.parse(s);
      } catch { /* état invalide, on repart de zéro */ }
    }

    // Modale Excalidraw
    const overlay = document.createElement('div');
    overlay.className = 'be-excalidraw-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'be-excalidraw-overlay__dialog';

    const header = document.createElement('div');
    header.className = 'be-excalidraw-overlay__header';

    const titleEl = document.createElement('span');
    titleEl.className = 'be-excalidraw-overlay__title';
    titleEl.textContent = 'Dessin — Excalidraw';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'be-form-modal__btn be-form-modal__btn--cancel';
    cancelBtn.textContent = 'Annuler';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'be-form-modal__btn be-form-modal__btn--submit';
    saveBtn.textContent = existingEl ? 'Mettre à jour' : 'Insérer';

    header.appendChild(titleEl);
    header.appendChild(cancelBtn);
    header.appendChild(saveBtn);

    const canvas = document.createElement('div');
    canvas.className = 'be-excalidraw-overlay__canvas';

    dialog.appendChild(header);
    dialog.appendChild(canvas);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Clic sur le backdrop pour fermer
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let excalidrawAPI: any = null;
    const root = ReactDOM.createRoot(canvas);
    root.render(
      React.createElement(Excalidraw, {
        initialData: initialData ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        excalidrawAPI: (api: any) => { excalidrawAPI = api; },
      }),
    );

    const close = (): void => { root.unmount(); overlay.remove(); };

    cancelBtn.addEventListener('click', close);

    saveBtn.addEventListener('click', async () => {
      if (!excalidrawAPI) { close(); return; }
      const elements = excalidrawAPI.getSceneElements();
      if (!elements.length) { close(); return; }
      try {
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();
        const svgEl = await exportToSvg({
          elements,
          appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
          files,
        });
        const svgStr = new XMLSerializer().serializeToString(svgEl);
        const state = JSON.stringify({
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor },
        });
        const escAttr = (s: string) => s.replace(/"/g, '&quot;');
        const block = `<div class="be-excalidraw" data-excalidraw-state="${escAttr(state)}" contenteditable="false">${svgStr}</div>`;
        if (existingEl) {
          existingEl.outerHTML = block;
        } else {
          // Focus obligatoire avant restoreRange pour que execCommand fonctionne
          this.editorEl.focus();
          this.restoreRange();
          const inserted = document.execCommand('insertHTML', false, block);
          // Fallback si execCommand échoue (focus/range perdu) : on insère directement
          if (!inserted) {
            const tmp = document.createElement('div');
            tmp.innerHTML = block;
            const node = tmp.firstElementChild!;
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
              const range = sel.getRangeAt(0);
              range.collapse(false);
              range.insertNode(node);
            } else {
              this.editorEl.appendChild(node);
            }
          }
        }
        this.onChange?.();
        close();
      } catch (err: unknown) {
        console.error('[wysiwyg] Excalidraw export error:', err);
      }
    });
  }

  private setupExcalidrawClickHandler(): void {
    this.editorEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.be-excalidraw') as HTMLElement | null;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        this.insertExcalidraw(target);
      }
    });
  }

  // ── Draw (éditeur SVG maison) ────────────────────────────────────────────────

  private insertDraw(existingEl?: HTMLElement): void {
    this.saveRange();
    if (!this.drawEditor) {
      this.drawEditor = new WysiwygDrawEditor();
    }
    const existingSvg = existingEl ? existingEl.innerHTML : '';
    this.drawEditor.open(existingSvg, (svgStr) => {
      const block = `<div class="be-draw" contenteditable="false">${svgStr}</div>`;
      if (existingEl) {
        existingEl.outerHTML = block;
      } else {
        this.insertHtmlBlock(block);
      }
      this.onChange?.();
    });
  }

  private setupDrawClickHandler(): void {
    this.editorEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.be-draw') as HTMLElement | null;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        this.hideElemToolbar();
        this.openDrawPropsModal(target);
      }
    });
  }

  private openDrawPropsModal(el: HTMLElement): void {
    const svg = el.querySelector('svg');
    const strokeEl = svg?.querySelector('[stroke]:not([stroke="none"])') as Element | null;
    const currentStroke = strokeEl?.getAttribute('stroke') ?? '#1e293b';
    const widthEl = svg?.querySelector('[stroke-width]') as Element | null;
    const currentWidth = String(Math.round(parseFloat(widthEl?.getAttribute('stroke-width') ?? '2')));
    const fillEl = svg?.querySelector('[fill]:not(text):not([fill="none"]):not([fill="context-stroke"])') as Element | null;
    const fillVal = fillEl?.getAttribute('fill') ?? 'none';
    const fillMode = fillVal === '#ffffff' ? 'white' : fillVal === 'none' ? 'none' : 'color';
    const s = (prop: string) => el.style.getPropertyValue(prop);

    this.formModal.show({
      title: 'Dessin SVG',
      submitLabel: 'Appliquer',
      extraActions: [
        { label: 'Modifier le dessin', onClick: () => { this.formModal.close(); this.insertDraw(el); } },
      ],
      tabs: [
        { label: 'Couleurs', fields: [
          { key: 'draw-stroke',       label: 'Couleur des traits',  type: 'color',  value: currentStroke },
          { key: 'draw-stroke-width', label: 'Épaisseur',           type: 'select', value: currentWidth, options: [
            { value: '1', label: '1 px' }, { value: '2', label: '2 px' },
            { value: '3', label: '3 px' }, { value: '5', label: '5 px' },
          ]},
          { key: 'draw-fill', label: 'Remplissage des formes', type: 'select', value: fillMode, options: [
            { value: 'none',  label: 'Transparent' },
            { value: 'color', label: 'Couleur du trait' },
            { value: 'white', label: 'Blanc' },
          ]},
        ]},
        { label: 'Style', fields: [
          { key: 'max-width', label: 'Largeur max', type: 'text', placeholder: '100%',      value: s('max-width') || s('width') },
          { key: 'float',     label: 'float',       type: 'select', value: s('float'),      options: [{ value: '', label: '— aucun —' }, { value: 'left', label: 'left' }, { value: 'right', label: 'right' }] },
          { key: 'margin',    label: 'margin',      type: 'text', placeholder: '0 auto',    value: s('margin') },
          { key: 'opacity',   label: 'opacity',     type: 'text', placeholder: '0.0 – 1.0', value: s('opacity') },
        ]},
      ],
      onSubmit: (v) => this.applyDrawProps(el, v),
    });
  }

  private applyDrawProps(el: HTMLElement, v: Record<string, string>): void {
    const svg = el.querySelector('svg');
    if (svg) {
      const newStroke   = v['draw-stroke'];
      const newWidth    = v['draw-stroke-width'];
      const fillMode    = v['draw-fill'];

      if (newStroke) {
        // Remplace tous les strokes non-"none"
        svg.querySelectorAll('[stroke]').forEach(e => {
          if (e.getAttribute('stroke') !== 'none') e.setAttribute('stroke', newStroke);
        });
        // Texte : toujours fill = couleur du trait
        svg.querySelectorAll('text').forEach(e => e.setAttribute('fill', newStroke));
      }
      if (newWidth) {
        svg.querySelectorAll('[stroke-width]').forEach(e => e.setAttribute('stroke-width', newWidth));
      }
      if (fillMode) {
        // Applique le mode de remplissage uniquement sur les formes qui avaient déjà un fill non-none
        svg.querySelectorAll('[fill]:not(text):not([fill="context-stroke"])').forEach(e => {
          const cur = e.getAttribute('fill');
          if (cur === 'none') return;
          const newF = fillMode === 'none' ? 'none'
                     : fillMode === 'white' ? '#ffffff'
                     : (newStroke ?? cur!);
          e.setAttribute('fill', newF);
        });
      }
    }
    // Propriétés CSS du conteneur
    for (const prop of ['max-width', 'float', 'margin', 'opacity']) {
      if (prop in v) {
        if (v[prop]) el.style.setProperty(prop, v[prop]);
        else el.style.removeProperty(prop);
      }
    }
    this.onChange?.();
  }

  private setupMathClickHandler(): void {
    this.editorEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.be-math') as HTMLElement | null;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        this.insertMath(target);
      }
    });
  }

  // ── Exec helpers ────────────────────────────────────────────────────────────

  private exec(cmd: string, value?: string): void {
    if (this.sourceMode) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || !this.el.contains(active) || !active.isContentEditable) {
      this.editorEl.focus();
    }
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, value);
    this.syncState();
  }

  private saveRange(): void {
    const sel = window.getSelection();
    this.savedRange = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }

  private restoreRange(): void {
    if (!this.savedRange) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(this.savedRange); }
  }

  private insertHtml(html: string): void {
    if (this.sourceMode) return;
    this.restoreRange();
    this.editorEl.focus();
    document.execCommand('insertHTML', false, html);
    this.syncState();
  }

  private syncState(): void {
    this.toolbarEl.querySelectorAll<HTMLElement>('[data-cmd]').forEach(el => {
      const cmd = el.dataset.cmd;
      if (!cmd) return;
      try { el.classList.toggle('be-wysiwyg__btn--active', document.queryCommandState(cmd)); } catch { /* ignore */ }
    });
  }

  // ── Source toggle ──────────────────────────────────────────────────────────

  private toggleSourceMode(): void {
    this.sourceMode = !this.sourceMode;
    const sourceBtn = this.toolbarEl.querySelector<HTMLElement>('[data-id="source"]');
    const fmtBtn = this.toolbarEl.querySelector<HTMLElement>('[data-id="formatHtml"]');
    if (this.sourceMode) {
      this.sourceEl.value = this.getHtml();
      this.refreshHighlight();
      this.editorEl.style.display = 'none';
      this.sourceWrapEl.style.display = '';
      sourceBtn?.classList.add('be-wysiwyg__btn--active');
      if (fmtBtn) fmtBtn.style.display = '';
      setTimeout(() => this.sourceEl.focus(), 0);
    } else {
      this.applyHtml(this.sourceEl.value);
      this.sourceWrapEl.style.display = 'none';
      this.editorEl.style.display = '';
      sourceBtn?.classList.remove('be-wysiwyg__btn--active');
      if (fmtBtn) fmtBtn.style.display = 'none';
      this.editorEl.focus();
    }
  }

  // ── Source highlighting ────────────────────────────────────────────────────

  private refreshHighlight(): void {
    // Trailing \n évite que la dernière ligne soit tronquée dans le <pre>
    this.sourceHlEl.innerHTML = this.highlightHtml(this.sourceEl.value) + '\n';
    // Resync scroll (l'utilisateur peut avoir scrollé pendant l'édition)
    this.sourceHlEl.scrollTop = this.sourceEl.scrollTop;
    this.sourceHlEl.scrollLeft = this.sourceEl.scrollLeft;
  }

  /** Tokenise du HTML+Twig et retourne une chaîne avec des <span> de couleur. */
  private highlightHtml(raw: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Regex principale — chaque groupe capture un type de token
    const TOKEN_RE = new RegExp([
      '(<!--[\\s\\S]*?-->)',                                                                // 1 comment
      '(<!\\w[^>]*>)',                                                                      // 2 doctype
      '(\\{%-?\\s*[\\s\\S]*?-?%\\})',                                                      // 3 twig block
      '(\\{\\{-?\\s*[\\s\\S]*?-?\\}\\})',                                                  // 4 twig var
      '(<\\/[\\w:-]+\\s*>)',                                                                // 5 closing tag
      '(<[\\w:-]+(?:\\s+[\\w:-]+(?:=(?:"[^"]*"|\'[^\']*\'|[^\\s>]*))?)*\\s*\\/?>)',        // 6 opening/self-closing tag
      '(&(?:[\\w]+|#\\d+|#x[\\da-fA-F]+);)',                                               // 7 entity
    ].join('|'), 'g');

    let result = '';
    let lastIdx = 0;
    let m: RegExpExecArray | null;

    while ((m = TOKEN_RE.exec(raw)) !== null) {
      if (m.index > lastIdx) result += esc(raw.slice(lastIdx, m.index));

      if      (m[1] !== undefined) result += `<span class="be-hl-c">${esc(m[1])}</span>`;
      else if (m[2] !== undefined) result += `<span class="be-hl-dt">${esc(m[2])}</span>`;
      else if (m[3] !== undefined) result += `<span class="be-hl-tb">${esc(m[3])}</span>`;
      else if (m[4] !== undefined) result += `<span class="be-hl-tv">${esc(m[4])}</span>`;
      else if (m[5] !== undefined) result += this.hlClosingTag(m[5]);
      else if (m[6] !== undefined) result += this.hlOpeningTag(m[6]);
      else if (m[7] !== undefined) result += `<span class="be-hl-e">${esc(m[7])}</span>`;

      lastIdx = TOKEN_RE.lastIndex;
    }

    if (lastIdx < raw.length) result += esc(raw.slice(lastIdx));
    return result;
  }

  private hlOpeningTag(tag: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const m = tag.match(/^(<)([\w:-]+)([\s\S]*?)(\s*\/?>)$/);
    if (!m) return `<span class="be-hl-tn">${esc(tag)}</span>`;
    return `<span class="be-hl-p">${esc(m[1])}</span>`
         + `<span class="be-hl-tn">${esc(m[2])}</span>`
         + this.hlAttrs(m[3])
         + `<span class="be-hl-p">${esc(m[4])}</span>`;
  }

  private hlClosingTag(tag: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const m = tag.match(/^(<\/)([\w:-]+)(\s*>)$/);
    if (!m) return `<span class="be-hl-tn">${esc(tag)}</span>`;
    return `<span class="be-hl-p">${esc(m[1])}</span>`
         + `<span class="be-hl-tn">${esc(m[2])}</span>`
         + `<span class="be-hl-p">${esc(m[3])}</span>`;
  }

  private hlAttrs(attrs: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ATTR = /(\s+)([\w:-]+)(?:(=)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s>]*))?/g;
    let result = '';
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = ATTR.exec(attrs)) !== null) {
      if (m.index > lastIdx) result += esc(attrs.slice(lastIdx, m.index));
      result += esc(m[1]);
      result += `<span class="be-hl-an">${esc(m[2])}</span>`;
      if (m[3]) result += `<span class="be-hl-p">${esc(m[3])}</span>`;
      if (m[4] !== undefined) result += `<span class="be-hl-av">${esc(m[4])}</span>`;
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < attrs.length) result += esc(attrs.slice(lastIdx));
    return result;
  }

  // ── Panel helpers ───────────────────────────────────────────────────────────

  private openPanel(btn: HTMLElement, content: HTMLElement): void {
    this.closePanel();
    const panel = document.createElement('div');
    panel.className = 'be-wysiwyg__panel';
    const rect = btn.getBoundingClientRect();
    const barRect = this.toolbarEl.getBoundingClientRect();
    panel.style.left = `${rect.left - barRect.left}px`;
    this.toolbarEl.appendChild(panel);
    panel.appendChild(content);
    this.activePanel = panel;
    this.activePanelBtn = btn;
  }

  private closePanel(): void {
    this.activePanel?.remove();
    this.activePanel = null;
    this.activePanelBtn = null;
  }

  // ── Panels ─────────────────────────────────────────────────────────────────

  private openTablePanel(): void {
    this.saveRange();
    const wrap = document.createElement('div');
    wrap.className = 'be-wysiwyg__panel-form';

    const rowsInput = this.makePanelInput('3', 'number');
    rowsInput.min = '1'; rowsInput.max = '20'; rowsInput.style.width = '60px';
    const colsInput = this.makePanelInput('3', 'number');
    colsInput.min = '1'; colsInput.max = '20'; colsInput.style.width = '60px';

    const headerSel = document.createElement('select');
    headerSel.className = 'be-wysiwyg__panel-input';
    [['none', 'Aucun'], ['first-row', 'Première ligne'], ['first-col', 'Première colonne'], ['both', 'Les deux']].forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l; headerSel.appendChild(o);
    });
    headerSel.value = 'first-row';

    wrap.appendChild(this.makePanelRow('Lignes :', rowsInput));
    wrap.appendChild(this.makePanelRow('Colonnes :', colsInput));
    wrap.appendChild(this.makePanelRow('En-têtes :', headerSel));

    const btnRow = document.createElement('div');
    btnRow.className = 'be-wysiwyg__panel-btns';
    btnRow.appendChild(this.makePanelBtn('Insérer', () => {
      const r = Math.max(1, parseInt(rowsInput.value) || 3);
      const c = Math.max(1, parseInt(colsInput.value) || 3);
      this.insertTableWidget(r, c, headerSel.value as TableProps['headerType']);
      this.closePanel();
    }));
    btnRow.appendChild(this.makePanelBtn('✕', () => this.closePanel(), true));
    wrap.appendChild(btnRow);

    this.openPanel(this.toolbarEl.querySelector('[data-id="table"]') as HTMLElement ?? this.toolbarEl, wrap);
    setTimeout(() => rowsInput.focus(), 0);
  }

  private insertTableWidget(rows: number, cols: number, headerType: TableProps['headerType']): void {
    const table = new WysiwygTable({ rows, cols, headerType });
    const p1 = document.createElement('p'); p1.innerHTML = '<br>';
    const p2 = document.createElement('p'); p2.innerHTML = '<br>';
    this.restoreRange();
    this.insertBlocksAtRange(p1, table.el, p2);
  }

  private openSpecialCharPanel(): void {
    const chars = [
      '«', '»', '—', '–', '…', '°', '±', '×', '÷', '≠', '≤', '≥',
      '©', '®', '™', '€', '£', '¥', '¢', '§', '¶', '•', '†', '‡',
      '½', '¼', '¾', 'α', 'β', 'γ', 'δ', 'π', 'Σ', 'Ω', 'µ', '∞',
      '←', '→', '↑', '↓', '↔', '↵', '♠', '♣', '♥', '♦', '✓', '✗',
    ];
    const wrap = document.createElement('div');
    wrap.className = 'be-wysiwyg__char-grid';
    for (const ch of chars) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'be-wysiwyg__char-btn';
      btn.textContent = ch; btn.title = ch;
      btn.addEventListener('click', () => { this.insertHtml(ch); this.closePanel(); });
      wrap.appendChild(btn);
    }
    this.openPanel(this.toolbarEl.querySelector('[data-id="special"]') as HTMLElement ?? this.toolbarEl, wrap);
  }

  // ── Grid ───────────────────────────────────────────────────────────────────

  private openGridPanel(): void {
    type Preset = { fracs: number[]; label: string };
    const presets: Preset[] = [
      { fracs: [1, 1],          label: '½ + ½' },
      { fracs: [1, 1, 1],       label: '⅓ + ⅓ + ⅓' },
      { fracs: [1, 1, 1, 1],    label: '¼ × 4' },
      { fracs: [1, 1, 1, 1, 1, 1], label: '⅙ × 6' },
      { fracs: [2, 1],          label: '⅔ + ⅓' },
      { fracs: [1, 2],          label: '⅓ + ⅔' },
      { fracs: [3, 1],          label: '¾ + ¼' },
      { fracs: [1, 3],          label: '¼ + ¾' },
      { fracs: [2, 1, 1],       label: '½ + ¼ + ¼' },
      { fracs: [1, 2, 1],       label: '¼ + ½ + ¼' },
      { fracs: [1, 1, 2],       label: '¼ + ¼ + ½' },
      { fracs: [1, 2, 1, 2],    label: '1+2+1+2' },
    ];

    const wrap = document.createElement('div');
    wrap.className = 'be-wysiwyg__grid-panel';

    // ── Gap selector ──────────────────────────────────────────────────────────
    const gapRow = document.createElement('div');
    gapRow.className = 'be-wysiwyg__panel-row';
    const gapLbl = document.createElement('label');
    gapLbl.className = 'be-wysiwyg__panel-label';
    gapLbl.textContent = 'Gap :';
    const gapSel = document.createElement('select');
    gapSel.className = 'be-wysiwyg__panel-input';
    [['8px', '8px'], ['16px', '16px'], ['24px', '24px'], ['32px', '32px'], ['0', '0 (aucun)']].forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l as string;
      if (v === '16px') o.selected = true;
      gapSel.appendChild(o);
    });
    gapRow.appendChild(gapLbl);
    gapRow.appendChild(gapSel);
    wrap.appendChild(gapRow);

    // ── Preset buttons ────────────────────────────────────────────────────────
    const grid = document.createElement('div');
    grid.className = 'be-wysiwyg__grid-presets';

    for (const preset of presets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'be-wysiwyg__grid-preset';
      btn.title = preset.label;

      // Représentation visuelle proportionnelle
      const vis = document.createElement('div');
      vis.className = 'be-wysiwyg__grid-vis';
      const total = preset.fracs.reduce((a, b) => a + b, 0);
      preset.fracs.forEach(f => {
        const col = document.createElement('div');
        col.className = 'be-wysiwyg__grid-vis-col';
        col.style.flex = String(f);
        vis.appendChild(col);
      });
      btn.appendChild(vis);

      const lbl = document.createElement('div');
      lbl.className = 'be-wysiwyg__grid-preset-lbl';
      lbl.textContent = preset.label;
      btn.appendChild(lbl);

      btn.addEventListener('click', () => {
        this.closePanel();
        this.insertGrid(preset.fracs, gapSel.value);
      });

      grid.appendChild(btn);
      void total; // suppress unused warning
    }

    wrap.appendChild(grid);

    const gridBtn = this.toolbarEl.querySelector('[data-id="grid"]') as HTMLElement ?? this.toolbarEl;
    this.openPanel(gridBtn, wrap);
  }

  private insertGrid(fracs: number[], gap: string): void {
    const row = document.createElement('div');
    row.className = 'be-grid';
    row.style.cssText = `display:flex;${gap && gap !== '0' ? `gap:${gap};` : ''}width:100%;`;

    fracs.forEach((f, i) => {
      const col = document.createElement('div');
      col.className = 'be-grid__col';
      col.style.cssText = `flex:${f};min-width:0;`;
      const p = document.createElement('p');
      p.textContent = `Colonne ${i + 1}`;
      col.appendChild(p);
      row.appendChild(col);
    });

    const trailing = document.createElement('p');
    trailing.innerHTML = '<br>';
    this.insertBlocksAtRange(row, trailing);
    this.moveCursorTo(row.firstElementChild as HTMLElement);
    this.onChange?.();
  }

  private openTwigPanel(): void {
    type Snip = { label: string; code: string; cat: string };
    const snippets: Snip[] = [
      // ── Variables
      { cat: 'Variable',  label: '{{ variable }}',          code: '{{ variable }}' },
      { cat: 'Variable',  label: '{{ var|filtre }}',         code: '{{ variable|filtre }}' },
      // ── Structures
      { cat: 'Structure', label: '{% if %}…{% endif %}',     code: '{% if condition %}\n\n{% endif %}' },
      { cat: 'Structure', label: '{% if %}…{% else %}',      code: '{% if condition %}\n\n{% else %}\n\n{% endif %}' },
      { cat: 'Structure', label: '{% for %}…{% endfor %}',   code: '{% for item in items %}\n{{ item }}\n{% endfor %}' },
      { cat: 'Structure', label: '{% set variable %}',       code: '{% set variable = valeur %}' },
      { cat: 'Structure', label: '{% raw %}…{% endraw %}',   code: '{% raw %}\n\n{% endraw %}' },
      // ── Filtres
      { cat: 'Filtre',    label: '|date',                    code: "{{ date|date('d/m/Y') }}" },
      { cat: 'Filtre',    label: '|number_format',           code: "{{ nombre|number_format(2, ',', ' ') }}" },
      { cat: 'Filtre',    label: '|upper',                   code: '{{ texte|upper }}' },
      { cat: 'Filtre',    label: '|lower',                   code: '{{ texte|lower }}' },
      { cat: 'Filtre',    label: '|default(…)',              code: "{{ variable|default('valeur par défaut') }}" },
      { cat: 'Filtre',    label: '|length',                  code: '{{ tableau|length }}' },
      { cat: 'Filtre',    label: '|nl2br',                   code: '{{ texte|nl2br }}' },
      // ── Client
      { cat: 'Client',    label: 'Société',                  code: '{{ customer.company }}' },
      { cat: 'Client',    label: 'Nom complet',              code: '{{ customer.fullname }}' },
      { cat: 'Client',    label: 'Email',                    code: '{{ customer.email }}' },
      { cat: 'Client',    label: 'Téléphone',                code: '{{ customer.phone }}' },
      { cat: 'Client',    label: 'Adresse',                  code: '{{ customer.address }}' },
      // ── Facture/Devis
      { cat: 'Facture',   label: 'Numéro',                   code: '{{ invoice.number }}' },
      { cat: 'Facture',   label: 'Date',                     code: "{{ invoice.date|date('d/m/Y') }}" },
      { cat: 'Facture',   label: 'Total HT',                 code: "{{ invoice.total_ht|number_format(2, ',', ' ') }} €" },
      { cat: 'Facture',   label: 'Total TTC',                code: "{{ invoice.total_ttc|number_format(2, ',', ' ') }} €" },
      { cat: 'Facture',   label: 'TVA',                      code: "{{ invoice.total_tva|number_format(2, ',', ' ') }} €" },
      // ── Système
      { cat: 'Système',   label: 'Date du jour',             code: '{{ sys.day }}' },
      { cat: 'Système',   label: 'Paraphe / Signature',      code: '{{ sys.paraf }}' },
      // ── Snippets injectés via opts.twigSnippets
      ...(this.opts.twigSnippets ?? []),
    ];

    const cats = [...new Set(snippets.map(s => s.cat))];
    const wrap = document.createElement('div');
    wrap.className = 'be-wysiwyg__twig-panel';

    for (const cat of cats) {
      const section = document.createElement('div');
      section.className = 'be-wysiwyg__twig-section';

      const header = document.createElement('div');
      header.className = 'be-wysiwyg__twig-cat';
      header.textContent = cat;
      section.appendChild(header);

      for (const s of snippets.filter(x => x.cat === cat)) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'be-wysiwyg__twig-item';
        item.title = s.code;
        item.textContent = s.label;
        item.addEventListener('click', () => {
          this.closePanel();
          this.insertTwig(s.code);
        });
        section.appendChild(item);
      }

      wrap.appendChild(section);
    }

    const btn = this.toolbarEl.querySelector('[data-id="twig"]') as HTMLElement ?? this.toolbarEl;
    this.openPanel(btn, wrap);
  }

  private insertTwig(code: string): void {
    this.restoreRange();
    this.editorEl.focus();
    document.execCommand('insertText', false, code);
    this.onChange?.();
  }

  // ── Insert helpers ─────────────────────────────────────────────────────────

  private insertImage(): void {
    this.saveRange();
    this.formModal.show({
      title: 'Insérer une image',
      tabs: [
        {
          label: 'Principal',
          fields: [
            { key: 'src',    label: 'URL source *',          type: 'url',  placeholder: 'https://…', required: true },
            { key: 'alt',    label: 'Texte alternatif (alt)',type: 'text', placeholder: 'Description de l\'image' },
            { key: 'title',  label: 'Info-bulle (title)',     type: 'text', placeholder: 'Texte au survol' },
            { key: 'width',  label: 'Largeur (width)',        type: 'text', placeholder: '300px ou 100%' },
            { key: 'height', label: 'Hauteur (height)',       type: 'text', placeholder: 'auto ou 200px' },
          ],
        },
        {
          label: 'Attributs',
          fields: [
            { key: 'id',          label: 'id',          type: 'text',   placeholder: 'identifiant-unique' },
            { key: 'class',       label: 'class',       type: 'text',   placeholder: 'classe1 classe2' },
            { key: 'loading',     label: 'loading',     type: 'select', options: [
              { value: '',      label: '— défaut —' },
              { value: 'lazy',  label: 'lazy — différé' },
              { value: 'eager', label: 'eager — immédiat' },
            ]},
            { key: 'decoding',    label: 'decoding',    type: 'select', options: [
              { value: '',      label: '— défaut —' },
              { value: 'async', label: 'async' },
              { value: 'sync',  label: 'sync' },
              { value: 'auto',  label: 'auto' },
            ]},
            { key: 'crossorigin', label: 'crossorigin', type: 'select', options: [
              { value: '',                 label: '— aucun —' },
              { value: 'anonymous',        label: 'anonymous' },
              { value: 'use-credentials', label: 'use-credentials' },
            ]},
            { key: 'referrerpolicy', label: 'referrerpolicy', type: 'select', options: [
              { value: '',                          label: '— défaut —' },
              { value: 'no-referrer',               label: 'no-referrer' },
              { value: 'no-referrer-when-downgrade', label: 'no-referrer-when-downgrade' },
              { value: 'origin',                    label: 'origin' },
              { value: 'strict-origin-when-cross-origin', label: 'strict-origin-when-cross-origin' },
            ]},
            { key: 'usemap',      label: 'usemap',      type: 'text', placeholder: '#nom-carte' },
            { key: 'longdesc',    label: 'longdesc',    type: 'url',  placeholder: 'https://…' },
          ],
        },
        {
          label: 'Style',
          fields: [
            { key: 'float',         label: 'float',         type: 'select', options: [
              { value: '',       label: '— aucun —' },
              { value: 'left',   label: 'left — gauche' },
              { value: 'right',  label: 'right — droite' },
            ]},
            { key: 'display',       label: 'display',       type: 'select', options: [
              { value: '',             label: '— défaut —' },
              { value: 'block',        label: 'block' },
              { value: 'inline-block', label: 'inline-block' },
              { value: 'inline',       label: 'inline' },
            ]},
            { key: 'object-fit',    label: 'object-fit',    type: 'select', options: [
              { value: '',            label: '— défaut —' },
              { value: 'contain',     label: 'contain' },
              { value: 'cover',       label: 'cover' },
              { value: 'fill',        label: 'fill' },
              { value: 'none',        label: 'none' },
              { value: 'scale-down',  label: 'scale-down' },
            ]},
            { key: 'margin',        label: 'margin',        type: 'text', placeholder: '10px ou 8px 16px' },
            { key: 'padding',       label: 'padding',       type: 'text', placeholder: '8px' },
            { key: 'border',        label: 'border',        type: 'text', placeholder: '1px solid #ccc' },
            { key: 'border-radius', label: 'border-radius', type: 'text', placeholder: '4px ou 50%' },
            { key: 'box-shadow',    label: 'box-shadow',    type: 'text', placeholder: '0 2px 8px rgba(0,0,0,.15)' },
            { key: 'opacity',       label: 'opacity',       type: 'text', placeholder: '0.0 – 1.0' },
            { key: 'vertical-align',label: 'vertical-align',type: 'select', options: [
              { value: '',         label: '— défaut —' },
              { value: 'top',      label: 'top' },
              { value: 'middle',   label: 'middle' },
              { value: 'bottom',   label: 'bottom' },
              { value: 'baseline', label: 'baseline' },
            ]},
          ],
        },
      ],
      onSubmit: (v) => {
        if (!v.src) return;
        const styles: string[] = ['max-width:100%'];
        if (v.width)          styles.push(`width:${v.width}`);
        if (v.height)         styles.push(`height:${v.height}`);
        if (v.float)          styles.push(`float:${v.float}`);
        if (v.display)        styles.push(`display:${v.display}`);
        if (v['object-fit'])  styles.push(`object-fit:${v['object-fit']}`);
        if (v.margin)         styles.push(`margin:${v.margin}`);
        if (v.padding)        styles.push(`padding:${v.padding}`);
        if (v.border)         styles.push(`border:${v.border}`);
        if (v['border-radius']) styles.push(`border-radius:${v['border-radius']}`);
        if (v['box-shadow'])  styles.push(`box-shadow:${v['box-shadow']}`);
        if (v.opacity)        styles.push(`opacity:${v.opacity}`);
        if (v['vertical-align']) styles.push(`vertical-align:${v['vertical-align']}`);
        let attrs = `src="${esc(v.src)}" alt="${esc(v.alt ?? '')}" style="${styles.join(';')}"`;
        if (v.title)          attrs += ` title="${esc(v.title)}"`;
        if (v.id)             attrs += ` id="${esc(v.id)}"`;
        if (v.class)          attrs += ` class="${esc(v.class)}"`;
        if (v.loading)        attrs += ` loading="${esc(v.loading)}"`;
        if (v.decoding)       attrs += ` decoding="${esc(v.decoding)}"`;
        if (v.crossorigin)    attrs += ` crossorigin="${esc(v.crossorigin)}"`;
        if (v.referrerpolicy) attrs += ` referrerpolicy="${esc(v.referrerpolicy)}"`;
        if (v.usemap)         attrs += ` usemap="${esc(v.usemap)}"`;
        if (v.longdesc)       attrs += ` longdesc="${esc(v.longdesc)}"`;
        this.insertHtml(`<img ${attrs}>`);
      },
    });
  }

  private insertLink(): void {
    this.saveRange();
    const selectedText = window.getSelection()?.toString() ?? '';
    this.formModal.show({
      title: 'Insérer un lien',
      tabs: [
        {
          label: 'Principal',
          fields: [
            { key: 'href',   label: 'URL (href) *', type: 'url',  placeholder: 'https://…', required: true },
            { key: 'text',   label: 'Texte du lien',type: 'text', placeholder: selectedText || 'Texte affiché', value: selectedText },
            { key: 'target', label: 'Cible (target)',type: 'select', options: [
              { value: '',        label: 'Même onglet (_self)' },
              { value: '_blank',  label: 'Nouvel onglet (_blank)' },
              { value: '_parent', label: '_parent' },
              { value: '_top',    label: '_top' },
            ]},
            { key: 'title',  label: 'Info-bulle (title)', type: 'text', placeholder: 'Texte au survol' },
          ],
        },
        {
          label: 'Attributs',
          fields: [
            { key: 'rel',      label: 'rel',      type: 'text', placeholder: 'noopener noreferrer nofollow' },
            { key: 'download', label: 'download', type: 'text', placeholder: 'fichier.pdf  ou vide (booléen)' },
            { key: 'hreflang', label: 'hreflang', type: 'text', placeholder: 'fr, en, de…' },
            { key: 'type',     label: 'type (MIME)', type: 'text', placeholder: 'application/pdf' },
            { key: 'ping',     label: 'ping',     type: 'text', placeholder: 'https://analytics.example.com' },
            { key: 'id',       label: 'id',       type: 'text', placeholder: 'identifiant-unique' },
            { key: 'class',    label: 'class',    type: 'text', placeholder: 'classe1 classe2' },
          ],
        },
        {
          label: 'Style',
          fields: [
            { key: 'color',           label: 'color',           type: 'color' },
            { key: 'text-decoration', label: 'text-decoration', type: 'select', options: [
              { value: '',             label: '— défaut —' },
              { value: 'none',         label: 'none' },
              { value: 'underline',    label: 'underline' },
              { value: 'overline',     label: 'overline' },
              { value: 'line-through', label: 'line-through' },
            ]},
            { key: 'font-weight',     label: 'font-weight',     type: 'select', options: [
              { value: '',    label: '— défaut —' },
              { value: 'normal', label: 'normal' },
              { value: 'bold',   label: 'bold' },
              { value: '600',    label: '600 (semi-bold)' },
              { value: '300',    label: '300 (light)' },
            ]},
            { key: 'font-size',       label: 'font-size',       type: 'text', placeholder: '14px ou 1em' },
            { key: 'margin',          label: 'margin',          type: 'text', placeholder: '10px ou 8px 16px' },
            { key: 'padding',         label: 'padding',         type: 'text', placeholder: '4px 8px' },
            { key: 'border',          label: 'border',          type: 'text', placeholder: '1px solid #ccc' },
            { key: 'border-radius',   label: 'border-radius',   type: 'text', placeholder: '4px' },
            { key: 'background',      label: 'background',      type: 'color' },
            { key: 'display',         label: 'display',         type: 'select', options: [
              { value: '',             label: '— défaut —' },
              { value: 'inline',       label: 'inline' },
              { value: 'inline-block', label: 'inline-block' },
              { value: 'block',        label: 'block' },
            ]},
          ],
        },
      ],
      onSubmit: (v) => {
        if (!v.href) return;
        const styles: string[] = [];
        if (v.color)              styles.push(`color:${v.color}`);
        if (v['text-decoration']) styles.push(`text-decoration:${v['text-decoration']}`);
        if (v['font-weight'])     styles.push(`font-weight:${v['font-weight']}`);
        if (v['font-size'])       styles.push(`font-size:${v['font-size']}`);
        if (v.margin)             styles.push(`margin:${v.margin}`);
        if (v.padding)            styles.push(`padding:${v.padding}`);
        if (v.border)             styles.push(`border:${v.border}`);
        if (v['border-radius'])   styles.push(`border-radius:${v['border-radius']}`);
        if (v.background)         styles.push(`background:${v.background}`);
        if (v.display)            styles.push(`display:${v.display}`);
        let attrs = `href="${esc(v.href)}"`;
        if (v.target)   attrs += ` target="${esc(v.target)}"`;
        if (v.title)    attrs += ` title="${esc(v.title)}"`;
        if (v.rel)      attrs += ` rel="${esc(v.rel)}"`;
        if (v.download) attrs += ` download="${esc(v.download)}"`;
        if (v.hreflang) attrs += ` hreflang="${esc(v.hreflang)}"`;
        if (v.type)     attrs += ` type="${esc(v.type)}"`;
        if (v.ping)     attrs += ` ping="${esc(v.ping)}"`;
        if (v.id)       attrs += ` id="${esc(v.id)}"`;
        if (v.class)    attrs += ` class="${esc(v.class)}"`;
        if (styles.length) attrs += ` style="${styles.join(';')}"`;
        const label = v.text || v.href;
        this.insertHtml(`<a ${attrs}>${esc(label)}</a>`);
      },
    });
  }

  private insertAnchor(): void {
    this.saveRange();
    this.formModal.show({
      title: 'Insérer une ancre',
      fields: [
        { key: 'id',    label: 'id / name *',       type: 'text', placeholder: 'nom-ancre', required: true },
        { key: 'class', label: 'class',              type: 'text', placeholder: 'nom-de-classe' },
        { key: 'title', label: 'title (info-bulle)', type: 'text', placeholder: 'Description…' },
      ],
      onSubmit: (v) => {
        if (!v.id) return;
        let attrs = `id="${esc(v.id)}" name="${esc(v.id)}"`;
        if (v.class) attrs += ` class="${esc(v.class)}"`;
        if (v.title) attrs += ` title="${esc(v.title)}"`;
        this.insertHtml(`<a ${attrs}></a>`);
      },
    });
  }

  private insertPageBreak(): void {
    this.insertHtml('<div class="be-page-break" style="page-break-after:always;border-top:2px dashed #aaa;margin:12px 0" contenteditable="false">&nbsp;</div><p></p>');
  }

  private insertDiv(): void {
    const div = document.createElement('div');
    div.className = 'be-custom-div';
    div.innerHTML = '<br>';
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    this.insertBlocksAtRange(div, p);
    this.moveCursorTo(div);
    this.onChange?.();
  }

  private insertCodeBlock(): void {
    const sel = window.getSelection();
    const selectedText = sel && sel.rangeCount ? sel.getRangeAt(0).toString() : '';

    const pre = document.createElement('pre');
    pre.className = 'be-code-block';
    const code = document.createElement('code');
    code.textContent = selectedText || '';
    pre.appendChild(code);

    const p = document.createElement('p');
    p.innerHTML = '<br>';

    // Delete selected content first
    if (selectedText && sel && sel.rangeCount) {
      sel.getRangeAt(0).deleteContents();
    }

    this.insertBlocksAtRange(pre, p);

    // Place cursor inside <code>
    const range = document.createRange();
    range.setStart(code, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    this.editorEl.focus();
    this.onChange?.();
  }

  private insertParagraph(): void {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    this.insertBlocksAtRange(p);
    this.moveCursorTo(p);
    this.onChange?.();
  }

  private setDir(dir: 'ltr' | 'rtl'): void {
    const block = this.getCurrentBlock();
    if (block) {
      block.setAttribute('dir', dir);
      this.onChange?.();
    }
  }

  // ── Block helpers ──────────────────────────────────────────────────────────

  /**
   * Retourne le bloc-ancre contenant le curseur.
   * S'arrête au fils direct de editorEl OU au fils direct d'une cellule de grille
   * (.be-grid__col), de façon à ce que les insertions respectent le contexte
   * (racine de l'éditeur ou intérieur d'une cellule).
   */
  private getCurrentBlock(): HTMLElement | null {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== this.editorEl) {
      const parent: HTMLElement | null = (node as HTMLElement).parentElement;
      if (!parent) break;
      if (parent === this.editorEl || parent.classList.contains('be-grid__col')) {
        return node as HTMLElement;
      }
      node = parent;
    }
    return null;
  }

  /**
   * Insère des éléments bloc à la position du curseur courant.
   * Fonctionne que le curseur soit à la racine de l'éditeur ou à l'intérieur
   * d'une cellule de grille (.be-grid__col).
   */
  private insertBlocksAtRange(...elements: HTMLElement[]): void {
    const sel = window.getSelection();
    let anchor: HTMLElement | null = null;
    let container: HTMLElement = this.editorEl;
    if (sel?.rangeCount) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== this.editorEl) {
        const parent: HTMLElement | null = (node as HTMLElement).parentElement;
        if (!parent) break;
        if (parent === this.editorEl || parent.classList.contains('be-grid__col')) {
          anchor = node as HTMLElement;
          container = parent;
          break;
        }
        node = parent;
      }
    }
    if (anchor) {
      anchor.after(...elements);
    } else {
      elements.forEach(el => container.appendChild(el));
    }
  }

  /**
   * Insère un bloc HTML à la position du curseur (avec fallback DOM).
   * Compatible grille : fonctionne aussi à l'intérieur d'une .be-grid__col.
   */
  private insertHtmlBlock(html: string): void {
    this.editorEl.focus();
    this.restoreRange();
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    if (!node) return;
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      this.insertBlocksAtRange(node as HTMLElement);
    }
  }

  /** Place le curseur au début de l'élément donné et focus l'éditeur. */
  private moveCursorTo(el: HTMLElement): void {
    const range = document.createRange();
    range.setStart(el, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    this.editorEl.focus();
  }

  // ── Element Inspector ─────────────────────────────────────────────────────

  private setupElementInspector(): void {
    const S = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">${d}</svg>`;

    this.elemTagLabelEl = document.createElement('span');
    this.elemTagLabelEl.className = 'be-wysiwyg__elem-toolbar__tag';

    this.elemToolbarEl = document.createElement('div');
    this.elemToolbarEl.className = 'be-wysiwyg__elem-toolbar';
    this.elemToolbarEl.style.display = 'none';
    this.elemToolbarEl.appendChild(this.elemTagLabelEl);

    const makeBtn = (icon: string, title: string, fn: (el: HTMLElement) => void, danger = false): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'be-wysiwyg__elem-toolbar__btn' + (danger ? ' be-wysiwyg__elem-toolbar__btn--danger' : '');
      btn.title = title;
      btn.innerHTML = icon;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const el = this.hoveredEl;
        if (el) fn(el);
      });
      return btn;
    };

    this.elemToolbarEl.appendChild(makeBtn(
      S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>'),
      'Propriétés', (el) => { this.hideElemToolbar(); this.openElementPropsModal(el); }
    ));
    this.elemToolbarEl.appendChild(makeBtn(S('<polyline points="18 15 12 9 6 15"/>'), 'Monter', (el) => this.elemMoveUp(el)));
    this.elemToolbarEl.appendChild(makeBtn(S('<polyline points="6 9 12 15 18 9"/>'), 'Descendre', (el) => this.elemMoveDown(el)));
    this.elemToolbarEl.appendChild(makeBtn(S('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'), 'Dupliquer', (el) => this.elemDuplicate(el)));
    this.elemToolbarEl.appendChild(makeBtn(S('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>'), 'Supprimer', (el) => this.elemDelete(el), true));

    document.body.appendChild(this.elemToolbarEl);

    this.editorEl.addEventListener('mouseover', (e) => {
      if (this.sourceMode || this.formModal.isOpen) return;
      const target = this.getTargetEl(e.target as Node);
      if (target !== this.hoveredEl) this.showElemToolbar(target);
    });
    this.editorEl.addEventListener('mousemove', () => {
      if (this.hoveredEl) this.positionElemToolbar(this.hoveredEl);
    });
    this.editorEl.addEventListener('mouseleave', () => this.scheduleHideElemToolbar());
    this.elemToolbarEl.addEventListener('mouseenter', () => this.cancelHideElemToolbar());
    this.elemToolbarEl.addEventListener('mouseleave', () => this.scheduleHideElemToolbar());
  }

  private getTargetEl(node: Node): HTMLElement | null {
    let el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null;
    while (el && el !== this.editorEl) {
      if (el.parentElement === this.editorEl) {
        if (el.classList.contains('be-wysiwyg-table-widget') || el.classList.contains('be-page-break')) return null;
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  private showElemToolbar(el: HTMLElement | null): void {
    this.cancelHideElemToolbar();
    this.hoveredEl?.classList.remove('be-elem-hover');
    this.hoveredEl = el;
    if (!el) { this.elemToolbarEl.style.display = 'none'; return; }
    el.classList.add('be-elem-hover');
    this.elemTagLabelEl.textContent = `<${el.tagName.toLowerCase()}>`;
    this.positionElemToolbar(el);
    this.elemToolbarEl.style.display = 'flex';
  }

  private hideElemToolbar(): void {
    this.cancelHideElemToolbar();
    this.hoveredEl?.classList.remove('be-elem-hover');
    this.hoveredEl = null;
    this.elemToolbarEl.style.display = 'none';
  }

  private positionElemToolbar(el: HTMLElement): void {
    const rect = el.getBoundingClientRect();
    const barW = this.elemToolbarEl.offsetWidth || 190;
    let top = rect.top - 30;
    if (top < 4) top = rect.top + 4;
    let left = rect.right - barW;
    if (left < 4) left = rect.left;
    if (left + barW > window.innerWidth - 4) left = window.innerWidth - barW - 4;
    this.elemToolbarEl.style.top = `${top}px`;
    this.elemToolbarEl.style.left = `${left}px`;
  }

  private scheduleHideElemToolbar(): void {
    this.hideToolbarTimer = setTimeout(() => this.hideElemToolbar(), 250);
  }

  private cancelHideElemToolbar(): void {
    if (this.hideToolbarTimer) { clearTimeout(this.hideToolbarTimer); this.hideToolbarTimer = null; }
  }

  private elemMoveUp(el: HTMLElement): void {
    const prev = el.previousElementSibling;
    if (prev) { el.parentNode!.insertBefore(el, prev); this.onChange?.(); this.showElemToolbar(el); }
  }

  private elemMoveDown(el: HTMLElement): void {
    const next = el.nextElementSibling;
    if (next) { el.parentNode!.insertBefore(next, el); this.onChange?.(); this.showElemToolbar(el); }
  }

  private elemDuplicate(el: HTMLElement): void {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.remove('be-elem-hover');
    el.after(clone);
    this.onChange?.();
    this.showElemToolbar(clone);
  }

  private elemDelete(el: HTMLElement): void {
    this.hideElemToolbar();
    el.remove();
    this.onChange?.();
  }

  private getCleanClass(el: HTMLElement): string {
    return [...el.classList].filter(c => !c.startsWith('be-')).join(' ');
  }

  private openElementPropsModal(el: HTMLElement): void {
    const tag = el.tagName.toLowerCase();
    this.formModal.show({
      title: `Éditer &lt;${tag}&gt;`,
      submitLabel: 'Appliquer',
      tabs: this.buildPropsTabsForEl(el),
      onSubmit: (v) => this.applyPropsToElement(el, v),
    });
  }

  private buildPropsTabsForEl(el: HTMLElement): WysiwygFormTab[] {
    const tag = el.tagName.toLowerCase();
    const s = (prop: string) => el.style.getPropertyValue(prop);
    const a = (attr: string) => el.getAttribute(attr) ?? '';
    const rawCssValue = Array.from(el.style).map(p => `${p}: ${el.style.getPropertyValue(p)};`).join('\n');
    const rawCssField: WysiwygFormField = {
      key: '__rawcss',
      label: 'CSS brut',
      type: 'textarea',
      rows: 7,
      placeholder: 'font-size: 60px;\ncolor: #fff;\ntransform: rotate(-7deg);',
      value: rawCssValue,
    };

    // ── <img> ────────────────────────────────────────────────────────────────
    if (tag === 'img') {
      return [
        { label: 'Principal', fields: [
          { key: 'src',    label: 'URL source *',          type: 'url',  required: true, value: a('src') },
          { key: 'alt',    label: 'Texte alternatif (alt)',type: 'text', value: a('alt') },
          { key: 'title',  label: 'Info-bulle (title)',     type: 'text', value: a('title') },
          { key: 'width',  label: 'Largeur (width)',        type: 'text', placeholder: '300px ou 100%', value: a('width') || s('width') },
          { key: 'height', label: 'Hauteur (height)',       type: 'text', placeholder: 'auto ou 200px', value: a('height') || s('height') },
        ]},
        { label: 'Attributs', fields: [
          { key: 'id',          label: 'id',          type: 'text',   value: el.id },
          { key: 'class',       label: 'class',       type: 'text',   value: this.getCleanClass(el) },
          { key: 'loading',     label: 'loading',     type: 'select', value: a('loading'), options: [
            { value: '', label: '— défaut —' }, { value: 'lazy', label: 'lazy' }, { value: 'eager', label: 'eager' },
          ]},
          { key: 'decoding',    label: 'decoding',    type: 'select', value: a('decoding'), options: [
            { value: '', label: '— défaut —' }, { value: 'async', label: 'async' }, { value: 'sync', label: 'sync' }, { value: 'auto', label: 'auto' },
          ]},
          { key: 'crossorigin', label: 'crossorigin', type: 'select', value: a('crossorigin'), options: [
            { value: '', label: '— aucun —' }, { value: 'anonymous', label: 'anonymous' }, { value: 'use-credentials', label: 'use-credentials' },
          ]},
          { key: 'referrerpolicy', label: 'referrerpolicy', type: 'select', value: a('referrerpolicy'), options: [
            { value: '', label: '— défaut —' }, { value: 'no-referrer', label: 'no-referrer' }, { value: 'no-referrer-when-downgrade', label: 'no-referrer-when-downgrade' }, { value: 'origin', label: 'origin' },
          ]},
        ]},
        { label: 'Style', fields: [
          { key: 'float',         label: 'float',         type: 'select', value: s('float'), options: [
            { value: '', label: '— aucun —' }, { value: 'left', label: 'left' }, { value: 'right', label: 'right' },
          ]},
          { key: 'display',       label: 'display',       type: 'select', value: s('display'), options: [
            { value: '', label: '— défaut —' }, { value: 'block', label: 'block' }, { value: 'inline-block', label: 'inline-block' }, { value: 'inline', label: 'inline' },
          ]},
          { key: 'object-fit',    label: 'object-fit',    type: 'select', value: s('object-fit'), options: [
            { value: '', label: '— défaut —' }, { value: 'contain', label: 'contain' }, { value: 'cover', label: 'cover' }, { value: 'fill', label: 'fill' },
          ]},
          { key: 'margin',        label: 'margin',        type: 'text', placeholder: '10px', value: s('margin') },
          { key: 'padding',       label: 'padding',       type: 'text', placeholder: '8px',  value: s('padding') },
          { key: 'border',        label: 'border',        type: 'text', placeholder: '1px solid #ccc', value: s('border') },
          { key: 'border-radius', label: 'border-radius', type: 'text', placeholder: '4px',  value: s('border-radius') },
          { key: 'box-shadow',    label: 'box-shadow',    type: 'text', placeholder: '0 2px 8px rgba(0,0,0,.15)', value: s('box-shadow') },
          { key: 'opacity',       label: 'opacity',       type: 'text', placeholder: '0.0–1.0', value: s('opacity') },
          { key: 'vertical-align',label: 'vertical-align',type: 'select', value: s('vertical-align'), options: [
            { value: '', label: '— défaut —' }, { value: 'top', label: 'top' }, { value: 'middle', label: 'middle' }, { value: 'bottom', label: 'bottom' }, { value: 'baseline', label: 'baseline' },
          ]},
          rawCssField,
        ]},
      ];
    }

    // ── <a> ──────────────────────────────────────────────────────────────────
    if (tag === 'a') {
      return [
        { label: 'Principal', fields: [
          { key: 'href',   label: 'URL (href) *',       type: 'url',    required: true, value: a('href') },
          { key: 'text',   label: 'Texte du lien',      type: 'text',   value: el.textContent?.trim() ?? '' },
          { key: 'target', label: 'Cible (target)',      type: 'select', value: a('target'), options: [
            { value: '', label: 'Même onglet (_self)' }, { value: '_blank', label: 'Nouvel onglet (_blank)' }, { value: '_parent', label: '_parent' }, { value: '_top', label: '_top' },
          ]},
          { key: 'title',  label: 'Info-bulle (title)', type: 'text', value: a('title') },
        ]},
        { label: 'Attributs', fields: [
          { key: 'rel',      label: 'rel',       type: 'text', value: a('rel'), placeholder: 'noopener noreferrer' },
          { key: 'download', label: 'download',  type: 'text', value: a('download') },
          { key: 'hreflang', label: 'hreflang',  type: 'text', value: a('hreflang'), placeholder: 'fr, en…' },
          { key: 'type',     label: 'type (MIME)',type: 'text', value: a('type') },
          { key: 'id',       label: 'id',        type: 'text', value: el.id },
          { key: 'class',    label: 'class',     type: 'text', value: this.getCleanClass(el) },
        ]},
        { label: 'Style', fields: [
          { key: 'color',           label: 'color',           type: 'color',  value: s('color') },
          { key: 'text-decoration', label: 'text-decoration', type: 'select', value: s('text-decoration'), options: [
            { value: '', label: '— défaut —' }, { value: 'none', label: 'none' }, { value: 'underline', label: 'underline' }, { value: 'overline', label: 'overline' }, { value: 'line-through', label: 'line-through' },
          ]},
          { key: 'font-weight', label: 'font-weight', type: 'select', value: s('font-weight'), options: [
            { value: '', label: '— défaut —' }, { value: 'normal', label: 'normal' }, { value: 'bold', label: 'bold' }, { value: '600', label: '600' },
          ]},
          { key: 'font-size',  label: 'font-size',  type: 'text', placeholder: '14px', value: s('font-size') },
          { key: 'background', label: 'background', type: 'color', value: s('background') || s('background-color') },
          { key: 'margin',     label: 'margin',     type: 'text', value: s('margin') },
          { key: 'padding',    label: 'padding',    type: 'text', value: s('padding') },
          { key: 'border',     label: 'border',     type: 'text', value: s('border') },
          { key: 'border-radius', label: 'border-radius', type: 'text', value: s('border-radius') },
          rawCssField,
        ]},
      ];
    }

    // ── Blocs texte génériques (p, h1-h6, div, blockquote, pre, ul, ol…) ───
    const blockTagOpts = ['p','h1','h2','h3','h4','h5','h6','div','blockquote','pre','ul','ol','li'].map(t => ({ value: t, label: `<${t}>` }));
    return [
      { label: 'Contenu', fields: [
        { key: 'tag',   label: 'Balise HTML', type: 'select', value: tag, options: blockTagOpts },
        { key: 'id',    label: 'id',          type: 'text', value: el.id },
        { key: 'class', label: 'class',       type: 'text', value: this.getCleanClass(el) },
        { key: 'title', label: 'title',       type: 'text', value: a('title') },
        { key: 'dir',   label: 'dir',         type: 'select', value: a('dir'), options: [
          { value: '', label: '— défaut —' }, { value: 'ltr', label: 'ltr' }, { value: 'rtl', label: 'rtl' },
        ]},
      ]},
      { label: 'Style', fields: [
        { key: 'color',          label: 'color',          type: 'color', value: s('color') },
        { key: 'background',     label: 'background',     type: 'color', value: s('background') || s('background-color') },
        { key: 'font-size',      label: 'font-size',      type: 'text', placeholder: '16px',   value: s('font-size') },
        { key: 'font-weight',    label: 'font-weight',    type: 'select', value: s('font-weight'), options: [
          { value: '', label: '— défaut —' }, { value: 'normal', label: 'normal' }, { value: 'bold', label: 'bold' }, { value: '600', label: '600' }, { value: '300', label: '300' },
        ]},
        { key: 'font-style',     label: 'font-style',     type: 'select', value: s('font-style'), options: [
          { value: '', label: '— défaut —' }, { value: 'normal', label: 'normal' }, { value: 'italic', label: 'italic' },
        ]},
        { key: 'text-align',     label: 'text-align',     type: 'select', value: s('text-align'), options: [
          { value: '', label: '— défaut —' }, { value: 'left', label: 'left' }, { value: 'center', label: 'center' }, { value: 'right', label: 'right' }, { value: 'justify', label: 'justify' },
        ]},
        { key: 'line-height',    label: 'line-height',    type: 'text', placeholder: '1.5',    value: s('line-height') },
        { key: 'letter-spacing', label: 'letter-spacing', type: 'text', placeholder: '0.05em', value: s('letter-spacing') },
        { key: 'margin',         label: 'margin',         type: 'text', placeholder: '10px',   value: s('margin') },
        { key: 'padding',        label: 'padding',        type: 'text', placeholder: '8px',    value: s('padding') },
        { key: 'border',         label: 'border',         type: 'text', placeholder: '1px solid #ccc', value: s('border') },
        { key: 'border-radius',  label: 'border-radius',  type: 'text', placeholder: '4px',    value: s('border-radius') },
        rawCssField,
      ]},
    ];
  }

  private applyPropsToElement(el: HTMLElement, v: Record<string, string>): void {
    let target = el;

    // Changement de balise (doit être fait en premier)
    if ('tag' in v && v.tag && v.tag !== target.tagName.toLowerCase()) {
      const newEl = document.createElement(v.tag);
      Array.from(target.attributes).forEach(attr => newEl.setAttribute(attr.name, attr.value));
      newEl.style.cssText = target.style.cssText;
      while (target.firstChild) newEl.appendChild(target.firstChild);
      target.replaceWith(newEl);
      target = newEl;
    }

    // id
    if ('id' in v) target.id = v.id;

    // class (préserve les classes internes be-*)
    if ('class' in v) {
      const beClasses = [...target.classList].filter(c => c.startsWith('be-'));
      const userClasses = v.class.trim().split(/\s+/).filter(Boolean);
      target.className = [...beClasses, ...userClasses].join(' ');
    }

    // Attributs HTML génériques
    for (const attr of ['title', 'dir', 'loading', 'decoding', 'crossorigin', 'referrerpolicy', 'href', 'target', 'rel', 'download', 'hreflang', 'type', 'src', 'alt']) {
      if (attr in v) { v[attr] ? target.setAttribute(attr, v[attr]) : target.removeAttribute(attr); }
    }

    // <img> : width/height en attributs (sans unité px)
    if (target.tagName.toLowerCase() === 'img') {
      for (const dim of ['width', 'height'] as const) {
        if (dim in v) {
          const val = v[dim].replace(/px$/i, '');
          val ? target.setAttribute(dim, val) : target.removeAttribute(dim);
        }
      }
    }

    // <a> : texte du lien
    if (target.tagName.toLowerCase() === 'a' && 'text' in v && v.text) {
      target.textContent = v.text;
    }

    // Propriétés CSS inline (champs individuels)
    for (const prop of ['color', 'background', 'font-size', 'font-weight', 'font-style',
      'text-align', 'line-height', 'letter-spacing', 'text-decoration', 'margin', 'padding',
      'border', 'border-radius', 'box-shadow', 'width', 'height', 'float', 'display',
      'opacity', 'object-fit', 'vertical-align']) {
      if (prop in v) {
        if (v[prop]) target.style.setProperty(prop, v[prop]);
        else target.style.removeProperty(prop);
      }
    }

    // CSS brut — appliqué en dernier (priorité sur les champs individuels)
    if (v['__rawcss'] && v['__rawcss'].trim()) {
      // Supporte le collage avec ou sans sélecteur : .foo { ... } ou directement prop: val;
      const block = v['__rawcss'].replace(/^[^{]*\{([\s\S]*)\}\s*$/, '$1');
      for (const line of block.split(';')) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const prop = line.slice(0, idx).trim();
        const val  = line.slice(idx + 1).trim();
        if (prop && val) target.style.setProperty(prop, val);
      }
    }

    this.onChange?.();
  }

  // ── Toolbar visibility helper ──────────────────────────────────────────────

  /**
   * Retourne true si le groupe de boutons doit être affiché.
   * @param key  Clé dans WysiwygToolbarConfig
   * @param def  Valeur par défaut si la clé n'est pas mentionnée (true pour la plupart)
   */
  private show(key: keyof WysiwygToolbarConfig, def = true): boolean {
    // hideSource (deprecated) → équivalent à toolbar.source = false
    if (key === 'source' && this.opts.hideSource) return false;
    if (this.opts.toolbar === undefined) return def;
    const v = this.opts.toolbar[key];
    return v === undefined ? def : v;
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────

  private buildToolbar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'be-wysiwyg__toolbar';

    // Chaque section est un tableau d'éléments.
    // Les séparateurs sont insérés automatiquement entre les sections non-vides.
    const sections: HTMLElement[][] = [];

    // ── 0 · Source + Historique ───────────────────────────────────────────────
    const s0: HTMLElement[] = [];
    if (this.show('source'))
      s0.push(this.makeBtn(icn.source, 'Source HTML', () => this.toggleSourceMode(), 'source'));
    if (this.show('formatHtml')) {
      const fmtBtn = this.makeBtn(icn.formatHtml, 'Formater / indenter le HTML', () => this.formatHtmlSource(), 'formatHtml');
      fmtBtn.style.display = 'none';
      s0.push(fmtBtn);
    }
    if (this.show('history')) {
      s0.push(this.makeExecBtn('undo', icn.undo, 'Annuler (Ctrl+Z)'));
      s0.push(this.makeExecBtn('redo', icn.redo, 'Refaire (Ctrl+Y)'));
    }
    if (this.show('fullscreen'))
      s0.push(this.makeBtn(icn.fullscreen, 'Plein écran', () => this.toggleFullscreen(), 'fullscreen'));
    if (s0.length) sections.push(s0);

    // ── 1 · Utilitaires ───────────────────────────────────────────────────────
    const s1: HTMLElement[] = [];
    if (this.show('addPara'))
      s1.push(this.makeBtn(icn.addPara, 'Ajouter un paragraphe (échappe le bloc courant)', () => this.insertParagraph()));
    if (this.show('pageBreak'))
      s1.push(this.makeBtn(icn.pageBreak, 'Saut de page (impression)', () => this.insertPageBreak()));
    if (this.show('selectAll'))
      s1.push(this.makeExecBtn('selectAll', icn.selectAll, 'Tout sélectionner'));
    if (this.show('removeFormat'))
      s1.push(this.makeExecBtn('removeFormat', icn.removeFormat, 'Supprimer mise en forme'));
    if (this.show('pasteClean'))
      s1.push(this.makeBtn(icn.pasteClean, 'Nettoyer le contenu (supprime styles et classes)', () => this.cleanContent()));
    if (this.opts.mermaid && this.show('mermaid', false))
      s1.push(this.makeBtn(icn.mermaid, 'Insérer un diagramme Mermaid', () => this.insertMermaid()));
    if (this.opts.katex && this.show('math', false))
      s1.push(this.makeBtn(icn.math, 'Insérer une formule mathématique', () => this.insertMath()));
    if (this.opts.excalidraw && this.show('excalidraw', false))
      s1.push(this.makeBtn(icn.excalidraw, 'Insérer un dessin Excalidraw', () => this.insertExcalidraw()));
    if (this.show('draw', false))
      s1.push(this.makeBtn(icn.draw, 'Insérer un dessin SVG', () => this.insertDraw()));
    if (s1.length) sections.push(s1);

    // ── 2 · Listes ────────────────────────────────────────────────────────────
    const s2: HTMLElement[] = [];
    if (this.show('lists')) {
      s2.push(this.makeExecBtn('insertOrderedList', icn.ol, 'Liste numérotée', 'insertOrderedList'));
      s2.push(this.makeExecBtn('insertUnorderedList', icn.ul, 'Liste à puces', 'insertUnorderedList'));
    }
    if (s2.length) sections.push(s2);

    // ── 3 · Alignement ────────────────────────────────────────────────────────
    const s3: HTMLElement[] = [];
    if (this.show('align')) {
      s3.push(this.makeExecBtn('justifyLeft',   icn.alignLeft,    'Aligner gauche',  'justifyLeft'));
      s3.push(this.makeExecBtn('justifyCenter',  icn.alignCenter,  'Centrer',         'justifyCenter'));
      s3.push(this.makeExecBtn('justifyRight',   icn.alignRight,   'Aligner droite',  'justifyRight'));
      s3.push(this.makeExecBtn('justifyFull',    icn.alignJustify, 'Justifier',       'justifyFull'));
    }
    if (s3.length) sections.push(s3);

    // ── 4 · Direction ─────────────────────────────────────────────────────────
    const s4: HTMLElement[] = [];
    if (this.show('bidi')) {
      s4.push(this.makeBtn(icn.bidiLtr, 'Sens gauche→droite (dir=ltr sur le bloc courant)', () => this.setDir('ltr')));
      s4.push(this.makeBtn(icn.bidiRtl, 'Sens droite→gauche (dir=rtl — arabe, hébreu…)',    () => this.setDir('rtl')));
    }
    if (s4.length) sections.push(s4);

    // ── 5 · Insertion de blocs ────────────────────────────────────────────────
    const s5: HTMLElement[] = [];
    if (this.show('div'))
      s5.push(this.makeBtn(icn.div, 'Insérer un <div>', () => { this.saveRange(); this.insertDiv(); }));
    if (this.show('grid'))
      s5.push(this.makeBtn(icn.grid, 'Grille multi-colonnes', () => { this.saveRange(); this.openGridPanel(); }, 'grid'));
    if (this.show('twig', false))           // défaut false — opt-in
      s5.push(this.makeTwigBtn());
    if (this.show('table'))
      s5.push(this.makeBtn(icn.table, 'Tableau', () => { this.saveRange(); this.openTablePanel(); }, 'table'));
    if (this.show('hr'))
      s5.push(this.makeExecBtn('insertHorizontalRule', icn.hr, 'Ligne horizontale'));
    if (this.show('codeBlock'))
      s5.push(this.makeBtn(icn.codeBlock, 'Bloc de code <pre><code>', () => { this.saveRange(); this.insertCodeBlock(); }));
    if (this.show('blockquote'))
      s5.push(this.makeBtn(icn.blockquote, 'Citation (blockquote)', () => this.toggleBlockquote()));
    if (this.show('specialChar'))
      s5.push(this.makeBtn(icn.specialChar, 'Caractère spécial', () => { this.saveRange(); this.openSpecialCharPanel(); }, 'special'));
    if (this.show('image'))
      s5.push(this.makeBtn(icn.image, 'Image', () => this.insertImage()));
    if (s5.length) sections.push(s5);

    // ── 6 · Liens ─────────────────────────────────────────────────────────────
    const s6: HTMLElement[] = [];
    if (this.show('link')) {
      s6.push(this.makeBtn(icn.link,   'Lien',           () => this.insertLink()));
      s6.push(this.makeExecBtn('unlink', icn.unlink,     'Supprimer lien'));
      s6.push(this.makeBtn(icn.anchor, 'Ancre',          () => this.insertAnchor()));
    }
    if (s6.length) sections.push(s6);

    // ── 7 · Titre ─────────────────────────────────────────────────────────────
    const s7: HTMLElement[] = [];
    if (this.show('heading'))
      s7.push(this.makeHeadingSelect());
    if (s7.length) sections.push(s7);

    // ── 8 · Typographie ───────────────────────────────────────────────────────
    const s8: HTMLElement[] = [];
    if (this.show('font')) {
      s8.push(this.makeFontSelect());
      s8.push(this.makeFontSizeSelect());
    }
    if (this.show('bold'))
      s8.push(this.makeExecBtn('bold',         icn.bold,      'Gras (Ctrl+B)',       'bold'));
    if (this.show('italic'))
      s8.push(this.makeExecBtn('italic',        icn.italic,    'Italique (Ctrl+I)',   'italic'));
    if (this.show('underline'))
      s8.push(this.makeExecBtn('underline',     icn.underline, 'Souligné (Ctrl+U)',   'underline'));
    if (this.show('strike'))
      s8.push(this.makeExecBtn('strikeThrough', icn.strike,    'Barré',               'strikeThrough'));
    if (this.show('script')) {
      s8.push(this.makeExecBtn('subscript',   icn.sub, 'Indice',    'subscript'));
      s8.push(this.makeExecBtn('superscript', icn.sup, 'Exposant',  'superscript'));
    }
    if (this.show('textColor'))
      s8.push(this.makeColorPicker('foreColor', '#000000', 'Couleur du texte', icn.textColor));
    if (this.show('bgColor'))
      s8.push(this.makeColorPicker('backColor', '#ffff00', 'Couleur de fond',  icn.bgColor));
    if (s8.length) sections.push(s8);

    // ── Assemblage avec séparateurs automatiques ───────────────────────────────
    sections.forEach((section, i) => {
      section.forEach(el => bar.appendChild(el));
      if (i < sections.length - 1) bar.appendChild(this.makeSep());
    });

    return bar;
  }


  // ── Fullscreen ─────────────────────────────────────────────────────────────

  private toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.el.classList.toggle('be-wysiwyg--fullscreen', this.isFullscreen);
    const btn = this.toolbarEl.querySelector<HTMLElement>('[data-id="fullscreen"]');
    if (btn) {
      btn.innerHTML = this.isFullscreen ? icn.compress : icn.fullscreen;
      btn.title = this.isFullscreen ? 'Quitter le plein écran (Échap)' : 'Plein écran';
      btn.classList.toggle('be-wysiwyg__btn--active', this.isFullscreen);
    }
    if (this.isFullscreen) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { this.toggleFullscreen(); document.removeEventListener('keydown', onKey); }
      };
      document.addEventListener('keydown', onKey);
    }
  }

  // ── Status bar / word count ────────────────────────────────────────────────

  private buildStatusBar(): void {
    if (this.opts.wordCount === false) return;
    this.statusBarEl = document.createElement('div');
    this.statusBarEl.className = 'be-wysiwyg__statusbar';

    const brand = document.createElement('span');
    brand.className = 'be-wysiwyg__brand';
    brand.textContent = `Adliss.fr v${__PKG_VERSION__}`;
    this.statusBarEl.appendChild(brand);

    this.wordCountEl = document.createElement('span');
    this.wordCountEl.className = 'be-wysiwyg__wordcount';
    this.statusBarEl.appendChild(this.wordCountEl);

    const grip = document.createElement('div');
    grip.className = 'be-wysiwyg__resize-grip';
    grip.innerHTML = `<svg viewBox="0 0 10 6" width="10" height="6" fill="currentColor"><rect y="0" width="10" height="1.5" rx="1"/><rect y="4.5" width="10" height="1.5" rx="1"/></svg>`;
    grip.addEventListener('mousedown', (e) => this.startEditorResize(e));
    this.statusBarEl.appendChild(grip);

    this.el.appendChild(this.statusBarEl);
    this.updateWordCount();
  }

  private startEditorResize(e: MouseEvent): void {
    e.preventDefault();
    const parent = this.el.parentElement ?? this.el;
    const startY = e.clientY;
    const startH = this.el.offsetHeight;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    const onMove = (me: MouseEvent) => {
      const newH = Math.max(100, startH + (me.clientY - startY));
      // Both editor and parent always share the same height — no gap possible
      this.el.style.height = `${newH}px`;
      if (parent !== this.el) parent.style.height = `${newH}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private updateWordCount(): void {
    if (!this.wordCountEl) return;
    const text = this.editorEl.innerText ?? '';
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const chars = text.replace(/\s/g, '').length;
    this.wordCountEl.textContent = `${words} mot${words !== 1 ? 's' : ''} · ${chars} caractère${chars !== 1 ? 's' : ''}`;
  }

  // ── HTML formatter (mode source) ──────────────────────────────────────────

  private formatHtmlSource(): void {
    if (!this.sourceMode) this.toggleSourceMode();

    // Protéger les blocs be-mermaid (SVG complexe) avant le formatage
    const placeholders: string[] = [];
    const protected_html = this.sourceEl.value.replace(
      /<div[^>]*class="[^"]*be-mermaid[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      (match) => { placeholders.push(match); return `<!--MERMAID_PLACEHOLDER_${placeholders.length - 1}-->`; }
    );

    let formatted = this.prettyHtml(protected_html);

    // Restaurer les blocs mermaid
    formatted = formatted.replace(/<!--MERMAID_PLACEHOLDER_(\d+)-->/g, (_, i) => placeholders[+i]);

    this.sourceEl.value = formatted;
    this.refreshHighlight();
    this.onChange?.();
  }

  private prettyHtml(html: string): string {
    const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const INLINE = new Set(['a','abbr','b','bdi','cite','code','em','i','kbd','mark','q','s','samp','small','span','strong','sub','sup','u','var']);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const fmt = (node: Node, depth: number): string => {
      const pad = '  '.repeat(depth);
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent?.trim() ?? '';
        return t ? pad + t + '\n' : '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const attrs = Array.from(el.attributes).map(a => ` ${a.name}="${a.value}"`).join('');
      if (VOID.has(tag)) return `${pad}<${tag}${attrs}>\n`;
      if (INLINE.has(tag)) {
        const inner = el.innerHTML;
        return `${pad}<${tag}${attrs}>${inner}</${tag}>\n`;
      }
      const children = Array.from(el.childNodes).map(c => fmt(c, depth + 1)).filter(Boolean).join('');
      return `${pad}<${tag}${attrs}>\n${children}${pad}</${tag}>\n`;
    };
    return Array.from(tmp.childNodes).map(n => fmt(n, 0)).filter(Boolean).join('').trim();
  }

  // ── Button factories ───────────────────────────────────────────────────────

  private makeExecBtn(cmd: string, icon: string, title: string, stateCmd?: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'be-wysiwyg__btn';
    if (stateCmd) btn.dataset.cmd = stateCmd;
    btn.innerHTML = icon; btn.title = title;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); this.exec(cmd); });
    return btn;
  }

  private makeBtn(icon: string, title: string, fn: () => void, dataId?: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'be-wysiwyg__btn';
    btn.innerHTML = icon; btn.title = title;
    if (dataId) btn.dataset.id = dataId;
    btn.addEventListener('click', fn);
    return btn;
  }

  private makeSep(): HTMLElement {
    const sep = document.createElement('span');
    sep.className = 'be-wysiwyg__sep';
    return sep;
  }

  private makeTwigBtn(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'be-wysiwyg__btn be-wysiwyg__btn--twig';
    btn.title = 'Insérer un snippet Twig';
    btn.dataset.id = 'twig';
    btn.innerHTML = `<span style="font-family:monospace;font-size:10px;font-weight:700;letter-spacing:-.5px;line-height:1">{%}</span>`;
    btn.addEventListener('click', () => { this.saveRange(); this.openTwigPanel(); });
    return btn;
  }

  private makeHeadingSelect(): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'be-wysiwyg__select be-wysiwyg__select--heading';
    sel.title = 'Format de paragraphe';
    [
      ['(Format)', ''],
      ['Normal',   'p'],
      ['H1',       'h1'],
      ['H2',       'h2'],
      ['H3',       'h3'],
      ['H4',       'h4'],
      ['H5',       'h5'],
      ['H6',       'h6'],
      ['Citation', 'blockquote'],
      ['Préformat.','pre'],
    ].forEach(([l, v]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      sel.appendChild(o);
    });
    sel.addEventListener('mousedown', () => this.saveRange());
    sel.addEventListener('change', () => {
      if (sel.value) { this.restoreRange(); this.exec('formatBlock', sel.value); }
      sel.selectedIndex = 0;
    });
    return sel;
  }

  private makeFontSelect(): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'be-wysiwyg__select be-wysiwyg__select--font'; sel.title = 'Police';
    [['(Police)', ''], ['Arial', 'Arial, sans-serif'], ['Georgia', 'Georgia, serif'],
     ["Courier New", "'Courier New', monospace"], ['Verdana', 'Verdana, sans-serif'],
     ["Times New Roman", "'Times New Roman', serif"], ["Trebuchet MS", "'Trebuchet MS', sans-serif"],
     ['Impact', 'Impact, sans-serif']].forEach(([l, v]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l;
      if (v) o.style.fontFamily = v;
      sel.appendChild(o);
    });
    sel.addEventListener('mousedown', () => this.saveRange());
    sel.addEventListener('change', () => { if (sel.value) { this.restoreRange(); this.exec('fontName', sel.value); } sel.selectedIndex = 0; });
    return sel;
  }

  private makeFontSizeSelect(): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'be-wysiwyg__select be-wysiwyg__select--size'; sel.title = 'Taille';
    [['(Taille)', ''], ['8px', '1'], ['10px', '2'], ['12px', '3'], ['14px', '4'],
     ['18px', '5'], ['24px', '6'], ['36px', '7']].forEach(([l, v]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o);
    });
    sel.addEventListener('mousedown', () => this.saveRange());
    sel.addEventListener('change', () => { if (sel.value) { this.restoreRange(); this.exec('fontSize', sel.value); } sel.selectedIndex = 0; });
    return sel;
  }

  private makeColorPicker(cmd: 'foreColor' | 'backColor', defaultColor: string, title: string, icon: string): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'be-wysiwyg__color-wrap';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'be-wysiwyg__btn be-wysiwyg__color-btn'; btn.title = title;
    btn.innerHTML = icon;
    const swatch = document.createElement('span');
    swatch.className = 'be-wysiwyg__color-swatch'; swatch.style.background = defaultColor;
    btn.appendChild(swatch);
    const input = document.createElement('input');
    input.type = 'color'; input.value = defaultColor; input.className = 'be-wysiwyg__color-input';
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); this.saveRange(); input.click(); });
    input.addEventListener('input', () => { swatch.style.background = input.value; });
    input.addEventListener('change', () => { swatch.style.background = input.value; this.restoreRange(); this.exec(cmd, input.value); });
    wrap.appendChild(btn); wrap.appendChild(input);
    return wrap;
  }

  // ── Panel form helpers ─────────────────────────────────────────────────────

  private makePanelInput(placeholder: string, type = 'text'): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type; input.placeholder = placeholder; input.className = 'be-wysiwyg__panel-input';
    return input;
  }

  private makePanelRow(label: string, input: HTMLElement): HTMLElement {
    const row = document.createElement('div');
    row.className = 'be-wysiwyg__panel-row';
    const lbl = document.createElement('label');
    lbl.textContent = label; lbl.className = 'be-wysiwyg__panel-label';
    row.appendChild(lbl); row.appendChild(input);
    return row;
  }

  private makePanelBtn(label: string, fn: () => void, secondary = false): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = secondary ? 'be-wysiwyg__panel-btn be-wysiwyg__panel-btn--secondary' : 'be-wysiwyg__panel-btn';
    btn.textContent = label; btn.addEventListener('click', fn);
    return btn;
  }
}

// ─── WysiwygFormModal ─────────────────────────────────────────────────────────
// Modale générique avec formulaire — remplace les prompt() natifs du browser.

interface WysiwygFormField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'select' | 'color' | 'number' | 'textarea';
  placeholder?: string;
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[];
  /** Titre de section affiché avant ce champ */
  sectionLabel?: string;
  rows?: number;
}

interface WysiwygFormTab {
  label: string;
  fields: WysiwygFormField[];
}

interface WysiwygFormOpts {
  title: string;
  /** Mode onglets */
  tabs?: WysiwygFormTab[];
  /** Mode liste plate */
  fields?: WysiwygFormField[];
  /** Libellé du bouton de validation (défaut : 'Insérer') */
  submitLabel?: string;
  /** Boutons d'action secondaires affichés à gauche du bouton Annuler */
  extraActions?: { label: string; onClick: () => void }[];
  onSubmit: (values: Record<string, string>) => void;
}

class WysiwygFormModal {
  private readonly overlay: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private submitBtnEl!: HTMLButtonElement;
  private footerExtraEl!: HTMLElement;
  private currentOpts: WysiwygFormOpts | null = null;
  private inputs: Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = new Map();
  isOpen = false;

  constructor() {
    installEscapeHandler();

    this.overlay = document.createElement('div');
    this.overlay.className = 'be-props-modal';
    this.overlay.style.cssText = 'position:fixed;inset:0;display:none;z-index:9999;';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'be-props-modal__dialog';

    const header = document.createElement('div');
    header.className = 'be-props-modal__header';

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'be-props-modal__title';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'be-props-modal__close';
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(this.titleEl);
    header.appendChild(closeBtn);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'be-props-modal__body';

    // Footer avec boutons
    const footer = document.createElement('div');
    footer.className = 'be-form-modal__footer';

    this.footerExtraEl = document.createElement('div');
    this.footerExtraEl.className = 'be-form-modal__extra-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'be-form-modal__btn be-form-modal__btn--cancel';
    cancelBtn.textContent = 'Annuler';
    cancelBtn.addEventListener('click', () => this.close());

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'be-form-modal__btn be-form-modal__btn--submit';
    submitBtn.textContent = 'Insérer';
    submitBtn.addEventListener('click', () => this.submit());
    this.submitBtnEl = submitBtn;

    footer.appendChild(this.footerExtraEl);
    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);

    dialog.appendChild(header);
    dialog.appendChild(this.bodyEl);
    dialog.appendChild(footer);
    this.overlay.appendChild(dialog);

    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
  }

  show(opts: WysiwygFormOpts): void {
    this.currentOpts = opts;
    this.inputs.clear();
    this.titleEl.textContent = opts.title;
    this.submitBtnEl.textContent = opts.submitLabel ?? 'Insérer';
    this.bodyEl.innerHTML = '';

    // Extra action buttons (ex. "Modifier le dessin")
    this.footerExtraEl.innerHTML = '';
    if (opts.extraActions) {
      for (const action of opts.extraActions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'be-form-modal__btn be-form-modal__btn--extra';
        btn.textContent = action.label;
        btn.addEventListener('click', () => action.onClick());
        this.footerExtraEl.appendChild(btn);
      }
    }

    const form = document.createElement('div');
    form.className = 'be-form-modal__form';

    if (opts.tabs && opts.tabs.length > 0) {
      const tabBar = document.createElement('div');
      tabBar.className = 'be-form-modal__tabs';
      const paneContainer = document.createElement('div');
      paneContainer.className = 'be-form-modal__panes';

      opts.tabs.forEach((tab, i) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'be-form-modal__tab' + (i === 0 ? ' be-form-modal__tab--active' : '');
        tabBtn.textContent = tab.label;

        const pane = document.createElement('div');
        pane.className = 'be-form-modal__pane' + (i === 0 ? ' be-form-modal__pane--active' : '');
        this.renderFields(pane, tab.fields);

        tabBtn.addEventListener('click', () => {
          tabBar.querySelectorAll('.be-form-modal__tab').forEach(b => b.classList.remove('be-form-modal__tab--active'));
          paneContainer.querySelectorAll('.be-form-modal__pane').forEach(p => p.classList.remove('be-form-modal__pane--active'));
          tabBtn.classList.add('be-form-modal__tab--active');
          pane.classList.add('be-form-modal__pane--active');
        });

        tabBar.appendChild(tabBtn);
        paneContainer.appendChild(pane);
      });

      form.appendChild(tabBar);
      form.appendChild(paneContainer);
    } else if (opts.fields) {
      this.renderFields(form, opts.fields);
    }

    this.bodyEl.appendChild(form);

    if (!this.isOpen) {
      this.isOpen = true;
      document.body.appendChild(this.overlay);
      this.overlay.style.display = 'flex';
      pushModal(() => this.close());
    }

    setTimeout(() => {
      const first = this.inputs.values().next().value as HTMLElement | undefined;
      first?.focus();
    }, 0);
  }

  private renderFields(container: HTMLElement, fields: WysiwygFormField[]): void {
    for (const field of fields) {
      if (field.sectionLabel) {
        const sec = document.createElement('div');
        sec.className = 'be-form-modal__section';
        sec.textContent = field.sectionLabel;
        container.appendChild(sec);
      }

      const row = document.createElement('div');
      row.className = 'be-field';

      const lbl = document.createElement('label');
      lbl.className = 'be-field__label';
      lbl.textContent = field.label;
      row.appendChild(lbl);

      if (field.type === 'color') {
        const wrap = document.createElement('div');
        wrap.className = 'be-form-modal__color-row';
        const colorPick = document.createElement('input');
        colorPick.type = 'color';
        colorPick.className = 'be-form-modal__color-pick';
        colorPick.value = /^#[0-9a-f]{6}$/i.test(field.value ?? '') ? field.value! : '#000000';
        const textInp = document.createElement('input');
        textInp.type = 'text';
        textInp.className = 'be-field__input';
        textInp.placeholder = field.placeholder ?? '#000000 ou red ou rgb(…)';
        textInp.value = field.value ?? '';
        colorPick.addEventListener('input', () => { textInp.value = colorPick.value; });
        textInp.addEventListener('input', () => {
          if (/^#[0-9a-f]{6}$/i.test(textInp.value)) colorPick.value = textInp.value;
        });
        textInp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
          if (e.key === 'Escape') { e.preventDefault(); this.close(); }
        });
        wrap.appendChild(colorPick);
        wrap.appendChild(textInp);
        row.appendChild(wrap);
        this.inputs.set(field.key, textInp);
        container.appendChild(row);
        continue;
      }

      if (field.type === 'textarea') {
        const ta = document.createElement('textarea');
        ta.className = 'be-field__textarea';
        ta.rows = field.rows ?? 6;
        if (field.placeholder) ta.placeholder = field.placeholder;
        if (field.value) ta.value = field.value;
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { e.preventDefault(); this.close(); }
        });
        this.inputs.set(field.key, ta);
        row.appendChild(ta);
        container.appendChild(row);
        continue;
      }

      let input: HTMLInputElement | HTMLSelectElement;

      if (field.type === 'select' && field.options) {
        const sel = document.createElement('select');
        sel.className = 'be-field__select';
        for (const opt of field.options) {
          const o = document.createElement('option');
          o.value = opt.value; o.textContent = opt.label;
          sel.appendChild(o);
        }
        if (field.value) sel.value = field.value;
        input = sel;
      } else {
        const inp = document.createElement('input');
        inp.type = field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : 'text';
        inp.className = 'be-field__input';
        if (field.placeholder) inp.placeholder = field.placeholder;
        if (field.value) inp.value = field.value;
        if (field.required) inp.required = true;
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
          if (e.key === 'Escape') { e.preventDefault(); this.close(); }
        });
        input = inp;
      }

      this.inputs.set(field.key, input);
      row.appendChild(input);
      container.appendChild(row);
    }
  }

  private submit(): void {
    const opts = this.currentOpts;
    if (!opts) return;
    const allFields = opts.tabs ? opts.tabs.flatMap(t => t.fields) : (opts.fields ?? []);

    for (const field of allFields) {
      if (field.required) {
        const val = (this.inputs.get(field.key) as HTMLInputElement)?.value.trim();
        if (!val) {
          // Basculer sur l'onglet contenant le champ invalide
          if (opts.tabs) {
            const tabIdx = opts.tabs.findIndex(t => t.fields.some(f => f.key === field.key));
            if (tabIdx >= 0) {
              const tabs = this.bodyEl.querySelectorAll<HTMLElement>('.be-form-modal__tab');
              const panes = this.bodyEl.querySelectorAll<HTMLElement>('.be-form-modal__pane');
              tabs.forEach(t => t.classList.remove('be-form-modal__tab--active'));
              panes.forEach(p => p.classList.remove('be-form-modal__pane--active'));
              tabs[tabIdx]?.classList.add('be-form-modal__tab--active');
              panes[tabIdx]?.classList.add('be-form-modal__pane--active');
            }
          }
          (this.inputs.get(field.key) as HTMLElement)?.focus();
          return;
        }
      }
    }

    const values: Record<string, string> = {};
    this.inputs.forEach((input, key) => { values[key] = input.value.trim(); });
    this.close();
    opts.onSubmit(values);
  }

  showError(message: string): void {
    // Afficher l'erreur dans la modale si elle est ouverte, sinon en toast
    if (this.isOpen) {
      let errEl = this.bodyEl.querySelector<HTMLElement>('.be-form-modal__error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'be-form-modal__error';
        this.bodyEl.prepend(errEl);
      }
      errEl.textContent = message;
    } else {
      // Toast temporaire
      const toast = document.createElement('div');
      toast.className = 'be-toast be-toast--error';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.overlay.remove();
    popModal();
  }
}

// ─── WysiwygTable ─────────────────────────────────────────────────────────────

interface WysiwygTableOptions {
  rows?: number;
  cols?: number;
  headerType?: TableProps['headerType'];
  state?: TableProps;
}

class WysiwygTable {
  el: HTMLElement;
  selR = -1;
  selC = -1;

  private state: TableProps;
  private toolbarEl: HTMLElement;
  private scrollWrapEl: HTMLElement;
  private modal: TablePropsModal;
  private modalMode: 'table' | 'cell' = 'table';

  constructor(opts: WysiwygTableOptions = {}) {
    const rows = opts.rows ?? 3;
    const cols = opts.cols ?? 3;
    const headerType = opts.headerType ?? 'first-row';

    this.state = opts.state ?? {
      rows, cols, width: '100%', height: '',
      headerType,
      borderSize: 1, cellSpacing: 0, cellPadding: 8,
      textAlign: 'left', caption: '', ariaDescription: '',
      cells: ensureCells(undefined, rows, cols, headerType),
    };

    this.el = document.createElement('div');
    this.el.className = 'be-wysiwyg-table-widget';
    this.el.contentEditable = 'false';

    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'be-table-toolbar';
    this.el.appendChild(this.toolbarEl);

    this.scrollWrapEl = document.createElement('div');
    this.scrollWrapEl.className = 'be-table-scroll';
    this.el.appendChild(this.scrollWrapEl);

    this.modal = new TablePropsModal();
    this.buildTable();
    this.buildToolbar();
    this.persistState();

    this.el.addEventListener('focusout', (e) => {
      const next = (e as FocusEvent).relatedTarget as Node | null;
      if (next && this.el.contains(next)) return;
      if (this.modal.isOpen) return;
      setTimeout(() => {
        if (!this.modal.isOpen && !this.el.contains(document.activeElement)) {
          this.el.classList.remove('be-wysiwyg-table-widget--active');
        }
      }, 150);
    });

    this.modal.onClose = () => {
      if (!this.el.contains(document.activeElement)) {
        this.el.classList.remove('be-wysiwyg-table-widget--active');
      }
    };

    this.toolbarEl.addEventListener('mousedown', (e) => e.preventDefault());
  }

  private persistState(): void {
    this.el.dataset.tableState = JSON.stringify(this.state);
    this.el.dispatchEvent(new CustomEvent('tableStateChange', { bubbles: true }));
  }

  private buildPropsPanel(): void {
    buildTablePropsPanel(this.modal.body, this.state, this.selR, this.selC, () => this.rebuild(), this.modalMode);
  }

  private rebuild(): void {
    this.buildTable(); this.buildToolbar(); this.persistState();
    if (this.modal.isOpen) this.buildPropsPanel();
  }

  private buildTable(): void {
    this.scrollWrapEl.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'be-table';
    if (this.state.width) table.style.width = this.state.width;
    if (this.state.height) table.style.height = this.state.height;
    table.style.borderCollapse = this.state.cellSpacing === 0 ? 'collapse' : 'separate';
    if (this.state.cellSpacing > 0) table.style.borderSpacing = `${this.state.cellSpacing}px`;
    if (this.state.textAlign) table.style.textAlign = this.state.textAlign;

    if (this.state.caption) {
      const cap = document.createElement('caption');
      cap.className = 'be-table__caption'; cap.textContent = this.state.caption;
      table.appendChild(cap);
    }

    for (let r = 0; r < this.state.rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < this.state.cols; c++) {
        const cd = this.state.cells[r]?.[c];
        if (!cd || cd._hidden) continue;

        const cell = document.createElement(cd.type) as HTMLTableCellElement;
        cell.className = 'be-table__cell';
        cell.dataset.r = String(r); cell.dataset.c = String(c);
        if (r === this.selR && c === this.selC) cell.classList.add('be-table__cell--selected');
        if (cd.colspan > 1) cell.colSpan = cd.colspan;
        if (cd.rowspan > 1) cell.rowSpan = cd.rowspan;

        cell.style.padding = `${this.state.cellPadding}px`;
        if (this.state.borderSize > 0) cell.style.border = `${this.state.borderSize}px solid ${cd.borderColor || '#d1d5db'}`;
        if (cd.width) cell.style.width = cd.width;
        if (cd.height) cell.style.height = cd.height;
        if (cd.backgroundColor) cell.style.backgroundColor = cd.backgroundColor;
        if (cd.textAlign) cell.style.textAlign = cd.textAlign;
        if (cd.verticalAlign) cell.style.verticalAlign = cd.verticalAlign;
        if (!cd.textWrap) cell.style.whiteSpace = 'nowrap';

        cell.contentEditable = 'true';
        cell.innerHTML = cd.content;

        const rr = r; const cc = c;
        cell.addEventListener('focus', () => {
          this.selR = rr; this.selC = cc;
          this.el.classList.add('be-wysiwyg-table-widget--active');
          this.scrollWrapEl.querySelectorAll('.be-table__cell--selected').forEach(el => el.classList.remove('be-table__cell--selected'));
          cell.classList.add('be-table__cell--selected');
          this.buildToolbar();
          if (this.modal.isOpen) this.buildPropsPanel();
        });
        cell.addEventListener('blur', () => {
          if (this.state.cells[rr]?.[cc]) { this.state.cells[rr][cc].content = cell.innerHTML; this.persistState(); }
        });
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault(); e.stopPropagation();
            const nextC = cc + cd.colspan;
            const nxt = nextC < this.state.cols
              ? this.scrollWrapEl.querySelector<HTMLElement>(`[data-r="${rr}"][data-c="${nextC}"]`)
              : this.scrollWrapEl.querySelector<HTMLElement>(`[data-r="${rr + 1}"][data-c="0"]`);
            nxt?.focus();
          }
        });

        tr.appendChild(cell);
      }
      table.appendChild(tr);
    }
    this.scrollWrapEl.appendChild(table);
  }

  private buildToolbar(): void {
    this.toolbarEl.innerHTML = '';
    const has = this.selR >= 0 && this.selC >= 0 && !!this.state.cells[this.selR]?.[this.selC];
    const cd = has ? this.state.cells[this.selR][this.selC] : null;

    const canMR = has && cd !== null && this.selC + cd.colspan < this.state.cols && !this.state.cells[this.selR]?.[this.selC + cd.colspan]?._hidden;
    const canMD = has && cd !== null && this.selR + cd.rowspan < this.state.rows && !this.state.cells[this.selR + cd.rowspan]?.[this.selC]?._hidden;

    const btn = (svg: string, title: string, fn: () => void, disabled = false): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'be-table-toolbar__btn';
      b.innerHTML = svg; b.title = title; b.disabled = disabled;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    const sep = (): HTMLElement => { const s = document.createElement('span'); s.className = 'be-table-toolbar__sep'; return s; };

    this.toolbarEl.appendChild(btn(TBL.rowBefore, 'Insérer ligne avant', () => { this.state.cells = insertRow(this.state.cells, this.selR, this.state.cols, this.state.headerType); this.state.rows++; this.selR++; this.rebuild(); }, !has));
    this.toolbarEl.appendChild(btn(TBL.rowAfter,  'Insérer ligne après', () => { this.state.cells = insertRow(this.state.cells, this.selR + 1, this.state.cols, this.state.headerType); this.state.rows++; this.rebuild(); }, !has));
    this.toolbarEl.appendChild(btn(TBL.rowDel,    'Supprimer ligne', () => { this.state.cells = deleteRow(this.state.cells, this.selR); this.state.rows = Math.max(1, this.state.rows - 1); this.selR = Math.min(this.selR, this.state.rows - 1); this.rebuild(); }, !has || this.state.rows <= 1));
    this.toolbarEl.appendChild(sep());
    this.toolbarEl.appendChild(btn(TBL.colBefore, 'Insérer colonne avant', () => { this.state.cells = insertCol(this.state.cells, this.selC, this.state.rows, this.state.headerType); this.state.cols++; this.selC++; this.rebuild(); }, !has));
    this.toolbarEl.appendChild(btn(TBL.colAfter,  'Insérer colonne après', () => { this.state.cells = insertCol(this.state.cells, this.selC + 1, this.state.rows, this.state.headerType); this.state.cols++; this.rebuild(); }, !has));
    this.toolbarEl.appendChild(btn(TBL.colDel,    'Supprimer colonne', () => { this.state.cells = deleteCol(this.state.cells, this.selC); this.state.cols = Math.max(1, this.state.cols - 1); this.selC = Math.min(this.selC, this.state.cols - 1); this.rebuild(); }, !has || this.state.cols <= 1));
    this.toolbarEl.appendChild(sep());
    this.toolbarEl.appendChild(btn(TBL.mergeR, 'Fusionner →', () => { this.state.cells = mergeRight(this.state.cells, this.selR, this.selC); this.rebuild(); }, !canMR));
    this.toolbarEl.appendChild(btn(TBL.mergeD, 'Fusionner ↓', () => { this.state.cells = mergeDown(this.state.cells, this.selR, this.selC); this.rebuild(); }, !canMD));
    this.toolbarEl.appendChild(btn(TBL.splitH, 'Scinder ↔', () => { this.state.cells = splitH(this.state.cells, this.selR, this.selC); this.rebuild(); }, !has || !cd || cd.colspan <= 1));
    this.toolbarEl.appendChild(btn(TBL.splitV, 'Scinder ↕', () => { this.state.cells = splitV(this.state.cells, this.selR, this.selC); this.rebuild(); }, !has || !cd || cd.rowspan <= 1));
    this.toolbarEl.appendChild(sep());
    this.toolbarEl.appendChild(btn(TBL.cellProps, 'Propriétés du tableau', () => {
      if (this.modal.isOpen && this.modalMode === 'table') { this.modal.close(); return; }
      this.modalMode = 'table'; this.modal.setTitle('Propriétés du tableau'); this.buildPropsPanel();
      if (!this.modal.isOpen) this.modal.open();
    }));
    this.toolbarEl.appendChild(btn(TBL.cellEdit, 'Propriétés de la cellule', () => {
      if (this.modal.isOpen && this.modalMode === 'cell') { this.modal.close(); return; }
      this.modalMode = 'cell'; this.modal.setTitle(has ? `Cellule L${this.selR + 1} · C${this.selC + 1} — Propriétés` : 'Propriétés de la cellule'); this.buildPropsPanel();
      if (!this.modal.isOpen) this.modal.open();
    }, !has));
    if (has) {
      const info = document.createElement('span');
      info.className = 'be-table-toolbar__info';
      info.textContent = `L${this.selR + 1} · C${this.selC + 1}`;
      if (cd && (cd.colspan > 1 || cd.rowspan > 1)) info.textContent += ` (${cd.colspan}×${cd.rowspan})`;
      this.toolbarEl.appendChild(info);
    }
  }
}

// ── HTML export helper ────────────────────────────────────────────────────────

function renderTableHtml(props: TableProps): HTMLElement {
  const wrap = document.createElement('div');
  const table = document.createElement('table');
  if (props.width) table.style.width = props.width;
  if (props.height) table.style.height = props.height;
  table.style.borderCollapse = props.cellSpacing === 0 ? 'collapse' : 'separate';
  if (props.cellSpacing > 0) table.style.borderSpacing = `${props.cellSpacing}px`;
  if (props.textAlign) table.style.textAlign = props.textAlign;
  if (props.caption) { const cap = document.createElement('caption'); cap.textContent = props.caption; table.appendChild(cap); }
  const cells = ensureCells(props.cells, props.rows, props.cols, props.headerType);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  for (let r = 0; r < props.rows; r++) {
    const tr = document.createElement('tr'); tbody.appendChild(tr);
    for (let c = 0; c < props.cols; c++) {
      const cd = cells[r]?.[c];
      if (!cd || cd._hidden) continue;
      const cell = document.createElement(cd.type) as HTMLTableCellElement;
      if (cd.colspan > 1) cell.colSpan = cd.colspan;
      if (cd.rowspan > 1) cell.rowSpan = cd.rowspan;
      const st: string[] = [`padding:${props.cellPadding}px`];
      if (props.borderSize > 0) st.push(`border:${props.borderSize}px solid ${cd.borderColor || '#d1d5db'}`);
      if (cd.width) st.push(`width:${cd.width}`);
      if (cd.height) st.push(`height:${cd.height}`);
      if (cd.backgroundColor) st.push(`background:${cd.backgroundColor}`);
      if (cd.textAlign) st.push(`text-align:${cd.textAlign}`);
      if (cd.verticalAlign) st.push(`vertical-align:${cd.verticalAlign}`);
      if (!cd.textWrap) st.push('white-space:nowrap');
      cell.style.cssText = st.join(';');
      cell.innerHTML = cd.content;
      tr.appendChild(cell);
    }
  }
  wrap.appendChild(table);
  return wrap;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Icons SVG 14×14 ───────────────────────────────────────────────────────────

const S = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">${d}</svg>`;
const F = (d: string) => `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">${d}</svg>`;

const icn = {
  source:       S('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  pageBreak:    S('<line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="4 2"/><polyline points="8 8 12 12 16 8"/><polyline points="8 16 12 12 16 16"/>'),
  selectAll:    S('<rect x="2" y="2" width="20" height="20" rx="2" stroke-dasharray="4 2"/><polyline points="7 13 10 16 17 9"/>'),
  removeFormat: S('<line x1="6" y1="18" x2="18" y2="6"/><path d="M6 6h8M10 6v12"/>'),
  ol:           S('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
  ul:           S('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>'),
  alignLeft:    S('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>'),
  alignCenter:  S('<line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>'),
  alignRight:   S('<line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>'),
  alignJustify: S('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
  bidiLtr:      S('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><polyline points="11 8 15 12 11 16"/>'),
  bidiRtl:      S('<line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><polyline points="13 8 9 12 13 16"/>'),
  addPara:      S('<path d="M13 4H9C6.24 4 4 6.24 4 9c0 2.76 2.24 5 5 5h4V4z"/><line x1="11" y1="4" x2="11" y2="20"/><line x1="13" y1="4" x2="13" y2="20"/><line x1="17" y1="17" x2="23" y2="17"/><line x1="20" y1="14" x2="20" y2="20"/>'),
  grid:         S('<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/><rect x="16" y="3" width="5" height="18" rx="1"/>'),
  div:          S('<rect x="3" y="5" width="18" height="14" rx="1" stroke-dasharray="4 2"/><line x1="3" y1="9" x2="21" y2="9"/>'),
  table:        S('<rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'),
  hr:           S('<line x1="2" y1="12" x2="22" y2="12"/>'),
  codeBlock:    S('<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="7 9 11 12 7 15"/><line x1="13" y1="15" x2="17" y2="15"/>'),
  undo:         S('<path d="M3 7v6h6"/><path d="M3 13C5.3 8.1 10.3 5 16 6.4A10 10 0 0121 16"/>'),
  redo:         S('<path d="M21 7v6h-6"/><path d="M21 13C18.7 8.1 13.7 5 8 6.4A10 10 0 003 16"/>'),
  blockquote:   S('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>'),
  pasteClean:   S('<path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M8 12l2 2 4-4" stroke-width="2.2"/>'),
  fullscreen:   S('<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>'),
  compress:     S('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'),
  formatHtml:   S('<line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>'),
  mermaid:      S('<rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="8" y="16" width="8" height="5" rx="1"/><line x1="6.5" y1="8" x2="6.5" y2="12"/><line x1="17.5" y1="8" x2="17.5" y2="12"/><line x1="6.5" y1="12" x2="12" y2="12"/><line x1="17.5" y1="12" x2="12" y2="12"/><line x1="12" y1="12" x2="12" y2="16"/>'),
  math:         S('<path d="M18 4H6l6 8-6 8h12"/>'),
  excalidraw:   S('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
  draw:         S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 15l3-4 2 2 3-5 3 7" stroke-linecap="round" stroke-linejoin="round"/>'),
  specialChar:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 3C8 3 5 7 5 12s3 9 7 9 7-4 7-9"/><path d="M16 8l-2 4h4l-2 4"/></svg>`,
  image:        S('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  link:         S('<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>'),
  unlink:       S('<path d="M18.84 12.25l1.72-1.71a5 5 0 00-7.07-7.07L11.78 5.18M5.16 11.75L3.44 13.46a5 5 0 007.07 7.07l1.71-1.71"/><line x1="1" y1="1" x2="23" y2="23"/>'),
  anchor:       S('<circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M5 12l7 9 7-9"/>'),
  bold:         F('<path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>'),
  italic:       S('<path d="M19 4H10M14 20H5M15 4L9 20"/>'),
  underline:    S('<path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>'),
  strike:       S('<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/>'),
  sub:          `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M4 5l8 8M12 5L4 13"/><path d="M20 21h-4c0-1.5.44-2 1.5-2.5S20 18 20 16.5a1.5 1.5 0 00-3 0"/></svg>`,
  sup:          `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M4 19l8-8M12 19L4 11"/><path d="M20 8h-4c0-1.5.44-2 1.5-2.5S20 5 20 3.5a1.5 1.5 0 00-3 0"/></svg>`,
  textColor:    `<svg viewBox="0 0 24 24" width="14" height="14"><text x="3" y="16" font-size="14" font-weight="bold" font-family="serif" fill="currentColor">A</text><rect x="3" y="18" width="18" height="3" fill="currentColor" rx="1"/></svg>`,
  bgColor:      `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 14.66V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h5.34" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="20" width="20" height="2" fill="currentColor" rx="1"/></svg>`,
};

// Suppress unused warning — F is used by bold/italic icons above
void F;
