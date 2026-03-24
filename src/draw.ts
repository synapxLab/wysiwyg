// ── WysiwygDraw — éditeur SVG maison, zéro dépendance ───────────────────────

type DrawTool = 'select' | 'pencil' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text';

interface Pt { x: number; y: number; }
interface BBox { x: number; y: number; w: number; h: number; }

function uid(): string {
  return 'bd-' + Math.random().toString(36).slice(2, 9);
}

function svgNS<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElementTagNameMap[K];
}

// ── Classe principale ────────────────────────────────────────────────────────
export class WysiwygDrawEditor {
  private overlay!: HTMLElement;
  private svg!: SVGSVGElement;
  private canvasWrap!: HTMLElement;

  private tool: DrawTool = 'pencil';
  private color  = '#1e293b';
  private fill   = 'none';
  private strokeW = 2;

  private drawing   = false;
  private curEl: SVGElement | null = null;
  private sx = 0; private sy = 0;
  private pencilD = '';

  private selEl: SVGElement | null = null;
  private moveAnchor: Pt | null = null;

  // ── Handles de sélection ──────────────────────────────────────────────────
  private selHandles: SVGGElement | null = null;
  private resizing: {
    pos: string;
    initPt: Pt;
    origBBox: BBox;
    origAttrs: Record<string, string>;
  } | null = null;
  private rotating: {
    cx: number; cy: number;
    initMouseAngle: number;
    origElemAngle: number;
    origTransform: string;
  } | null = null;

  private history: string[] = [];
  private toolBtns = new Map<DrawTool, HTMLButtonElement>();
  private hintEl!: HTMLElement;

  // ── Panneau propriétés ────────────────────────────────────────────────────
  private propsPanel!: HTMLElement;
  private propFillSection!: HTMLElement;
  private propStrokeColorBtns = new Map<string, HTMLElement>();
  private propFillSwatches    = new Map<string, HTMLElement>();
  private propTextSection!: HTMLElement;
  private propTextBoldBtn!: HTMLButtonElement;
  private propTextItalicBtn!: HTMLButtonElement;
  private propTextUnderlineBtn!: HTMLButtonElement;
  private propTextFontSelect!: HTMLSelectElement;
  private propTextSizeInput!: HTMLInputElement;
  private propOpacityInput!: HTMLInputElement;
  private propOpacityVal!: HTMLSpanElement;
  private propCustomStrokeInput!: HTMLInputElement;
  private propCustomFillInput!: HTMLInputElement;

  private textInput?: HTMLTextAreaElement;
  private onInsertCb?: (svgStr: string) => void;
  private _hints: Record<DrawTool, string> = {
    select:  'Cliquez pour sélectionner. Faites glisser pour déplacer. Suppr pour effacer.',
    pencil:  'Dessinez librement en maintenant le bouton de la souris.',
    rect:    'Cliquez et glissez pour dessiner un rectangle.',
    ellipse: 'Cliquez et glissez pour dessiner une ellipse.',
    line:    'Cliquez et glissez pour tracer une ligne.',
    arrow:   'Cliquez et glissez pour tracer une flèche.',
    text:    'Cliquez sur le canvas puis saisissez votre texte. Entrée = saut de ligne, Ctrl+Entrée pour valider.',
  };

  // ── Public API ──────────────────────────────────────────────────────────────
  constructor() {
    this.buildUI();
    this.bindEvents();
  }

  open(existingSvg: string, onInsert: (svgStr: string) => void): void {
    this.onInsertCb = onInsert;
    this.svg.removeAttribute('viewBox');
    this.svg.removeAttribute('width');
    this.svg.removeAttribute('height');
    this.svg.style.cursor = this.tool === 'select' ? 'default' : this.tool === 'text' ? 'text' : 'crosshair';
    this.loadSvg(existingSvg);
    this.history = [this.snap()];
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => this.overlay.classList.add('be-draw-visible'));
  }

  destroy(): void { this.overlay.remove(); }

  // ── Build UI ────────────────────────────────────────────────────────────────
  private buildUI(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'be-draw-overlay';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('mousedown', (e) => { if (e.target === this.overlay) this.close(); });

    const dialog = document.createElement('div');
    dialog.className = 'be-draw-dialog';

    dialog.appendChild(this.buildHeader());
    const [toolbar, hintBar] = this.buildToolbar();
    dialog.appendChild(toolbar);
    dialog.appendChild(hintBar);

    const canvasArea = document.createElement('div');
    canvasArea.className = 'be-draw-canvas-area';

    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'be-draw-canvas';
    this.svg = svgNS('svg');
    this.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    this.svg.className.baseVal = 'be-draw-svg';
    this.initDefs();
    this.canvasWrap.appendChild(this.svg);
    canvasArea.appendChild(this.canvasWrap);
    canvasArea.appendChild(this.buildPropsPanel());

    dialog.appendChild(canvasArea);
    dialog.appendChild(this.buildFooter());
    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);
  }

  private buildHeader(): HTMLElement {
    const h = document.createElement('div');
    h.className = 'be-draw-header';
    h.innerHTML = `<span class="be-draw-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Dessin libre</span>`;
    const close = document.createElement('button');
    close.className = 'be-draw-close';
    close.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    close.addEventListener('click', () => this.close());
    h.appendChild(close);
    return h;
  }

  private buildToolbar(): [HTMLElement, HTMLElement] {
    const bar = document.createElement('div');
    bar.className = 'be-draw-bar';

    const toolDefs: [DrawTool, string, string][] = [
      ['select',  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-7 1-4 7z"/></svg>`, 'S'],
      ['pencil',  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`, 'P'],
      ['rect',    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`, 'R'],
      ['ellipse', `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>`, 'E'],
      ['line',    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>`, 'L'],
      ['arrow',   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/><polyline points="14 4 20 4 20 10"/></svg>`, 'A'],
      ['text',    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>`, 'T'],
    ];

    const toolGroup = document.createElement('div');
    toolGroup.className = 'be-draw-group';
    for (const [t, icon, key] of toolDefs) {
      const btn = document.createElement('button');
      btn.className = 'be-draw-btn-tool' + (t === this.tool ? ' active' : '');
      btn.title = this._hints[t];
      btn.innerHTML = icon;
      btn.addEventListener('click', () => this.setTool(t));
      this.toolBtns.set(t, btn);
      toolGroup.appendChild(btn);
    }

    const spacer = document.createElement('div');
    spacer.style.flex = '1';

    const actGroup = document.createElement('div');
    actGroup.className = 'be-draw-group';
    const undoBtn = document.createElement('button');
    undoBtn.className = 'be-draw-btn-tool';
    undoBtn.title = 'Annuler (Ctrl+Z)';
    undoBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10c4 0 7 3 7 7v1"/><polyline points="3 6 3 10 7 10"/></svg>`;
    undoBtn.addEventListener('click', () => this.undo());
    const clearBtn = document.createElement('button');
    clearBtn.className = 'be-draw-btn-tool';
    clearBtn.title = 'Tout effacer';
    clearBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
    clearBtn.addEventListener('click', () => this.clearAll());
    actGroup.append(undoBtn, clearBtn);
    bar.append(toolGroup, spacer, actGroup);

    const hintBar = document.createElement('div');
    hintBar.className = 'be-draw-hint';
    this.hintEl = document.createElement('span');
    this.hintEl.textContent = this._hints[this.tool];
    hintBar.appendChild(this.hintEl);

    return [bar, hintBar];
  }

  // ── Panneau propriétés ──────────────────────────────────────────────────────
  private buildPropsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'be-draw-props-panel';
    this.propsPanel = panel;

    // Trait
    const strokeSection = document.createElement('div');
    strokeSection.className = 'be-draw-props-section';
    strokeSection.innerHTML = '<div class="be-draw-props-title">Trait</div>';
    const strokeSwatches = document.createElement('div');
    strokeSwatches.className = 'be-draw-props-swatches';
    for (const c of ['#1e293b','#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6']) {
      const btn = document.createElement('button');
      btn.className = 'be-draw-props-swatch';
      btn.style.background = c;
      btn.addEventListener('click', () => this.applyPropColor(c));
      this.propStrokeColorBtns.set(c, btn);
      strokeSwatches.appendChild(btn);
    }
    const csLabel = document.createElement('label');
    csLabel.className = 'be-draw-props-swatch be-draw-props-swatch-picker';
    csLabel.title = 'Couleur personnalisée';
    csLabel.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v8M8 12h8"/></svg>`;
    this.propCustomStrokeInput = document.createElement('input');
    this.propCustomStrokeInput.type = 'color';
    this.propCustomStrokeInput.value = '#1e293b';
    this.propCustomStrokeInput.addEventListener('input', () => {
      const c = this.propCustomStrokeInput.value;
      csLabel.style.background = c;
      this.applyPropColor(c);
    });
    csLabel.appendChild(this.propCustomStrokeInput);
    this.propStrokeColorBtns.set('__custom__', csLabel);
    strokeSwatches.appendChild(csLabel);
    strokeSection.appendChild(strokeSwatches);
    panel.appendChild(strokeSection);

    // Arrière-plan
    this.propFillSection = document.createElement('div');
    this.propFillSection.className = 'be-draw-props-section';
    this.propFillSection.innerHTML = '<div class="be-draw-props-title">Arrière-plan</div>';
    const fillSwatches = document.createElement('div');
    fillSwatches.className = 'be-draw-props-swatches';
    const transSwatch = document.createElement('button');
    transSwatch.className = 'be-draw-props-swatch be-draw-props-swatch-transparent';
    transSwatch.title = 'Transparent';
    transSwatch.addEventListener('click', () => this.applyPropFillColor('none'));
    this.propFillSwatches.set('none', transSwatch);
    fillSwatches.appendChild(transSwatch);
    for (const c of ['#ffffff','#fca5a5','#86efac','#93c5fd','#fde68a','#c4b5fd']) {
      const btn = document.createElement('button');
      btn.className = 'be-draw-props-swatch';
      btn.style.cssText = `background:${c};${c === '#ffffff' ? 'box-shadow:inset 0 0 0 1px #e2e8f0;' : ''}`;
      btn.addEventListener('click', () => this.applyPropFillColor(c));
      this.propFillSwatches.set(c, btn);
      fillSwatches.appendChild(btn);
    }
    const cfLabel = document.createElement('label');
    cfLabel.className = 'be-draw-props-swatch be-draw-props-swatch-picker';
    cfLabel.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v8M8 12h8"/></svg>`;
    this.propCustomFillInput = document.createElement('input');
    this.propCustomFillInput.type = 'color';
    this.propCustomFillInput.value = '#ffffff';
    this.propCustomFillInput.addEventListener('input', () => {
      const c = this.propCustomFillInput.value;
      cfLabel.style.background = c;
      this.applyPropFillColor(c);
    });
    cfLabel.appendChild(this.propCustomFillInput);
    fillSwatches.appendChild(cfLabel);
    this.propFillSection.appendChild(fillSwatches);
    panel.appendChild(this.propFillSection);

    // Texte (visible uniquement pour les éléments text)
    this.propTextSection = document.createElement('div');
    this.propTextSection.className = 'be-draw-props-section';
    this.propTextSection.innerHTML = '<div class="be-draw-props-title">Texte</div>';

    // Gras / Italique / Souligné
    const fmtRow = document.createElement('div');
    fmtRow.className = 'be-draw-props-btnrow';
    this.propTextBoldBtn = document.createElement('button');
    this.propTextBoldBtn.className = 'be-draw-props-btn';
    this.propTextBoldBtn.title = 'Gras';
    this.propTextBoldBtn.innerHTML = '<strong style="font-size:13px;font-family:serif">G</strong>';
    this.propTextBoldBtn.addEventListener('click', () => this.applyPropTextBold());
    this.propTextItalicBtn = document.createElement('button');
    this.propTextItalicBtn.className = 'be-draw-props-btn';
    this.propTextItalicBtn.title = 'Italique';
    this.propTextItalicBtn.innerHTML = '<em style="font-size:13px;font-family:serif">I</em>';
    this.propTextItalicBtn.addEventListener('click', () => this.applyPropTextItalic());
    this.propTextUnderlineBtn = document.createElement('button');
    this.propTextUnderlineBtn.className = 'be-draw-props-btn';
    this.propTextUnderlineBtn.title = 'Souligné';
    this.propTextUnderlineBtn.innerHTML = '<span style="font-size:13px;text-decoration:underline">S</span>';
    this.propTextUnderlineBtn.addEventListener('click', () => this.applyPropTextUnderline());
    fmtRow.append(this.propTextBoldBtn, this.propTextItalicBtn, this.propTextUnderlineBtn);
    this.propTextSection.appendChild(fmtRow);

    // Police
    this.propTextFontSelect = document.createElement('select');
    this.propTextFontSelect.className = 'be-draw-props-select';
    for (const [val, label] of [
      ['system-ui, -apple-system, sans-serif', 'Système'],
      ['Arial, sans-serif', 'Arial'],
      ['Georgia, serif', 'Georgia'],
      ['"Courier New", monospace', 'Courier'],
      ['Impact, sans-serif', 'Impact'],
    ]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      this.propTextFontSelect.appendChild(opt);
    }
    this.propTextFontSelect.addEventListener('change', () => this.applyPropTextFont(this.propTextFontSelect.value));
    this.propTextSection.appendChild(this.propTextFontSelect);

    // Taille
    const sizeRow = document.createElement('div');
    sizeRow.className = 'be-draw-props-size-row';
    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = 'Taille';
    sizeLabel.className = 'be-draw-props-size-label';
    this.propTextSizeInput = document.createElement('input');
    this.propTextSizeInput.type = 'number';
    this.propTextSizeInput.min = '8';
    this.propTextSizeInput.max = '128';
    this.propTextSizeInput.value = '16';
    this.propTextSizeInput.className = 'be-draw-props-size-input';
    this.propTextSizeInput.addEventListener('change', () => this.applyPropTextSize(parseInt(this.propTextSizeInput.value)));
    sizeRow.append(sizeLabel, this.propTextSizeInput);
    this.propTextSection.appendChild(sizeRow);

    panel.appendChild(this.propTextSection);

    // Transparence
    const opacSection = document.createElement('div');
    opacSection.className = 'be-draw-props-section';
    opacSection.innerHTML = '<div class="be-draw-props-title">Transparence</div>';
    const sliderRow = document.createElement('div');
    sliderRow.className = 'be-draw-props-slider-row';
    this.propOpacityInput = document.createElement('input');
    this.propOpacityInput.type = 'range';
    this.propOpacityInput.min = '0';
    this.propOpacityInput.max = '100';
    this.propOpacityInput.value = '100';
    this.propOpacityInput.className = 'be-draw-props-slider';
    this.propOpacityVal = document.createElement('span');
    this.propOpacityVal.className = 'be-draw-props-slider-val';
    this.propOpacityVal.textContent = '100';
    this.propOpacityInput.addEventListener('input', () => {
      const v = parseInt(this.propOpacityInput.value);
      this.propOpacityVal.textContent = String(v);
      this.applyPropOpacity(v);
    });
    sliderRow.append(this.propOpacityInput, this.propOpacityVal);
    opacSection.appendChild(sliderRow);
    panel.appendChild(opacSection);

    // Disposition
    const orderSection = document.createElement('div');
    orderSection.className = 'be-draw-props-section';
    orderSection.innerHTML = '<div class="be-draw-props-title">Disposition</div>';
    const orderRow = document.createElement('div');
    orderRow.className = 'be-draw-props-btnrow';
    for (const [action, icon, title] of [
      ['to-back',  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="12" height="12" rx="1"/><rect x="10" y="4" width="12" height="12" rx="1" fill="var(--be-bg,#f8fafc)"/><rect x="10" y="4" width="12" height="12" rx="1"/></svg>`, 'Arrière-plan'],
      ['backward', `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`, "Reculer d'un niveau"],
      ['forward',  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`, "Avancer d'un niveau"],
      ['to-front', `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="10" y="8" width="12" height="12" rx="1"/><rect x="2" y="4" width="12" height="12" rx="1" fill="var(--be-bg,#f8fafc)"/><rect x="2" y="4" width="12" height="12" rx="1"/></svg>`, 'Premier plan'],
    ] as [string, string, string][]) {
      const btn = document.createElement('button');
      btn.className = 'be-draw-props-btn';
      btn.title = title;
      btn.innerHTML = icon;
      btn.addEventListener('click', () => this.applyPropOrder(action));
      orderRow.appendChild(btn);
    }
    orderSection.appendChild(orderRow);
    panel.appendChild(orderSection);

    // Supprimer
    const delSection = document.createElement('div');
    delSection.className = 'be-draw-props-section be-draw-props-section--delete';
    const delBtn = document.createElement('button');
    delBtn.className = 'be-draw-props-delete-btn';
    delBtn.title = "Supprimer l'élément (Suppr)";
    delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Supprimer`;
    delBtn.addEventListener('click', () => {
      if (this.selEl) { this.push(); this.selEl.remove(); this.selEl = null; this.clearSelHandles(); this.hidePropsPanel(); }
    });
    delSection.appendChild(delBtn);
    panel.appendChild(delSection);

    return panel;
  }

  private buildFooter(): HTMLElement {
    const f = document.createElement('div');
    f.className = 'be-draw-footer';
    const cancel = document.createElement('button');
    cancel.className = 'be-draw-action be-draw-action-cancel';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', () => this.close());
    const insert = document.createElement('button');
    insert.className = 'be-draw-action be-draw-action-insert';
    insert.textContent = 'Insérer';
    insert.addEventListener('click', () => this.insert());
    f.append(cancel, insert);
    return f;
  }

  private sep(): HTMLElement {
    const s = document.createElement('div');
    s.className = 'be-draw-sep';
    return s;
  }

  // ── Handles de sélection ────────────────────────────────────────────────────

  /** Convertit les coordonnées BoundingClientRect → espace SVG */
  private getElBBoxSVG(el: SVGGraphicsElement): BBox {
    const r = el.getBoundingClientRect();
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: r.left, y: r.top, w: r.width, h: r.height };
    const inv = ctm.inverse();
    const toSvg = (cx: number, cy: number) => ({
      x: inv.a * cx + inv.c * cy + inv.e,
      y: inv.b * cx + inv.d * cy + inv.f,
    });
    const tl = toSvg(r.left, r.top);
    const br = toSvg(r.right, r.bottom);
    return { x: tl.x, y: tl.y, w: Math.max(1, br.x - tl.x), h: Math.max(1, br.y - tl.y) };
  }

  private drawSelHandles(el: SVGElement): void {
    this.clearSelHandles();
    const b = this.getElBBoxSVG(el as SVGGraphicsElement);
    const g = svgNS('g');
    g.dataset.beHandles = '1';
    const isLine = el.tagName === 'line';
    const PAD = 4;

    // Cadre pointillé
    const outline = svgNS('rect');
    outline.setAttribute('x',      String(b.x - PAD));
    outline.setAttribute('y',      String(b.y - PAD));
    outline.setAttribute('width',  String(b.w + PAD * 2));
    outline.setAttribute('height', String(b.h + PAD * 2));
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#3b82f6');
    outline.setAttribute('stroke-width', '1');
    outline.setAttribute('stroke-dasharray', '5 3');
    outline.setAttribute('pointer-events', 'none');
    outline.setAttribute('rx', '3');
    g.appendChild(outline);

    if (isLine) {
      // Lignes : 2 poignées aux extrémités
      const n = (a: string) => parseFloat(el.getAttribute(a) ?? '0');
      for (const [id, x, y] of [['start', n('x1'), n('y1')], ['end', n('x2'), n('y2')]] as [string, number, number][]) {
        g.appendChild(this.makeHandle(x, y, id, 'crosshair'));
      }
    } else {
      // 8 poignées de redimensionnement
      const bx = b.x, by = b.y, bw = b.w, bh = b.h;
      const handles: [string, number, number, string][] = [
        ['nw', bx,        by,        'nwse-resize'],
        ['n',  bx+bw/2,   by,        'ns-resize'  ],
        ['ne', bx+bw,     by,        'nesw-resize'],
        ['e',  bx+bw,     by+bh/2,   'ew-resize'  ],
        ['se', bx+bw,     by+bh,     'nwse-resize'],
        ['s',  bx+bw/2,   by+bh,     'ns-resize'  ],
        ['sw', bx,        by+bh,     'nesw-resize'],
        ['w',  bx,        by+bh/2,   'ew-resize'  ],
      ];
      for (const [id, x, y, cursor] of handles) {
        g.appendChild(this.makeHandle(x, y, id, cursor));
      }

      // Poignée de rotation
      const rcx = bx + bw / 2;
      const rcy = by - PAD - 22;
      const rotLine = svgNS('line');
      rotLine.setAttribute('x1', String(rcx));
      rotLine.setAttribute('y1', String(by - PAD));
      rotLine.setAttribute('x2', String(rcx));
      rotLine.setAttribute('y2', String(rcy + 7));
      rotLine.setAttribute('stroke', '#3b82f6');
      rotLine.setAttribute('stroke-width', '1');
      rotLine.setAttribute('pointer-events', 'none');
      g.appendChild(rotLine);

      const rotCircle = svgNS('circle');
      rotCircle.setAttribute('cx', String(rcx));
      rotCircle.setAttribute('cy', String(rcy));
      rotCircle.setAttribute('r', '6');
      rotCircle.setAttribute('fill', '#fff');
      rotCircle.setAttribute('stroke', '#3b82f6');
      rotCircle.setAttribute('stroke-width', '1.5');
      rotCircle.style.cursor = 'grab';
      rotCircle.dataset.handlePos = 'rot';
      rotCircle.addEventListener('mousedown', (e) => { e.stopPropagation(); this.startRotate(e, b); });
      g.appendChild(rotCircle);
    }

    this.svg.appendChild(g);
    this.selHandles = g;
  }

  private makeHandle(x: number, y: number, id: string, cursor: string): SVGRectElement {
    const S = 8;
    const h = svgNS('rect');
    h.setAttribute('x', String(x - S / 2)); h.setAttribute('y', String(y - S / 2));
    h.setAttribute('width', String(S));      h.setAttribute('height', String(S));
    h.setAttribute('rx', '2');
    h.setAttribute('fill', '#fff');
    h.setAttribute('stroke', '#3b82f6');
    h.setAttribute('stroke-width', '1.5');
    h.style.cursor = cursor;
    h.dataset.handlePos = id;
    h.addEventListener('mousedown', (e) => { e.stopPropagation(); this.startResize(e, id); });
    return h;
  }

  private clearSelHandles(): void {
    if (this.selHandles) { this.selHandles.remove(); this.selHandles = null; }
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  private startResize(e: MouseEvent, pos: string): void {
    if (!this.selEl) return;
    e.preventDefault();
    this.push();
    const el = this.selEl;
    const attrs: Record<string, string> = {};
    for (const a of ['x','y','width','height','cx','cy','rx','ry','x1','y1','x2','y2']) {
      const v = el.getAttribute(a);
      if (v !== null) attrs[a] = v;
    }
    attrs['_tr'] = el.getAttribute('transform') ?? '';
    this.resizing = {
      pos,
      initPt: this.pt(e),
      origBBox: this.getElBBoxSVG(el as SVGGraphicsElement),
      origAttrs: attrs,
    };
  }

  private onMoveResize(p: Pt): void {
    if (!this.resizing || !this.selEl) return;
    const { pos, initPt, origBBox: ob, origAttrs: oa } = this.resizing;
    const dx = p.x - initPt.x;
    const dy = p.y - initPt.y;
    const el = this.selEl;
    const tag = el.tagName;
    const f = (k: string) => parseFloat(oa[k] ?? '0');
    const MIN = 4;

    if (tag === 'line') {
      if (pos === 'start') { el.setAttribute('x1', String(f('x1') + dx)); el.setAttribute('y1', String(f('y1') + dy)); }
      else                 { el.setAttribute('x2', String(f('x2') + dx)); el.setAttribute('y2', String(f('y2') + dy)); }
    } else if (tag === 'rect') {
      let nx = ob.x, ny = ob.y, nw = ob.w, nh = ob.h;
      if (pos.includes('w')) { nx = ob.x + dx; nw = Math.max(MIN, ob.w - dx); }
      if (pos.includes('e')) { nw = Math.max(MIN, ob.w + dx); }
      if (pos.includes('n')) { ny = ob.y + dy; nh = Math.max(MIN, ob.h - dy); }
      if (pos.includes('s')) { nh = Math.max(MIN, ob.h + dy); }
      // Convertir bbox screen→SVG en offset depuis les attrs d'origine
      const origSvgX = f('x') + parseFloat(oa['_tr'].match(/translate\s*\(\s*([^,)]+)/)?.[1] ?? '0');
      const origSvgY = f('y') + parseFloat(oa['_tr'].match(/translate\s*\([^,]+,\s*([^)]+)/)?.[1] ?? '0');
      const scaleX = ob.w > 0 ? (f('width')  / ob.w) : 1;
      const scaleY = ob.h > 0 ? (f('height') / ob.h) : 1;
      const newW = nw * scaleX; const newH = nh * scaleY;
      const offX = (nx - ob.x) * scaleX;   const offY = (ny - ob.y) * scaleY;
      el.setAttribute('x',      String(f('x') + offX));
      el.setAttribute('y',      String(f('y') + offY));
      el.setAttribute('width',  String(Math.max(MIN, newW)));
      el.setAttribute('height', String(Math.max(MIN, newH)));
    } else if (tag === 'ellipse') {
      let nw = ob.w, nh = ob.h, shiftX = 0, shiftY = 0;
      if (pos.includes('w')) { nw = Math.max(MIN, ob.w - dx); shiftX = dx / 2; }
      if (pos.includes('e')) { nw = Math.max(MIN, ob.w + dx); shiftX = dx / 2; }
      if (pos.includes('n')) { nh = Math.max(MIN, ob.h - dy); shiftY = dy / 2; }
      if (pos.includes('s')) { nh = Math.max(MIN, ob.h + dy); shiftY = dy / 2; }
      const scaleX = ob.w > 0 ? f('rx') / (ob.w / 2) : 1;
      const scaleY = ob.h > 0 ? f('ry') / (ob.h / 2) : 1;
      el.setAttribute('rx', String(Math.max(MIN / 2, (nw / 2) * scaleX)));
      el.setAttribute('ry', String(Math.max(MIN / 2, (nh / 2) * scaleY)));
      el.setAttribute('cx', String(f('cx') + shiftX));
      el.setAttribute('cy', String(f('cy') + shiftY));
    } else {
      // path, text, g → scale transform autour de l'ancre
      if (ob.w < 1 || ob.h < 1) return;
      let sx = 1, sy = 1, ax = ob.x, ay = ob.y;
      if (pos === 'se') { sx = Math.max(.05, (ob.w + dx) / ob.w); sy = Math.max(.05, (ob.h + dy) / ob.h); ax = ob.x;        ay = ob.y;        }
      if (pos === 'sw') { sx = Math.max(.05, (ob.w - dx) / ob.w); sy = Math.max(.05, (ob.h + dy) / ob.h); ax = ob.x + ob.w; ay = ob.y;        }
      if (pos === 'ne') { sx = Math.max(.05, (ob.w + dx) / ob.w); sy = Math.max(.05, (ob.h - dy) / ob.h); ax = ob.x;        ay = ob.y + ob.h; }
      if (pos === 'nw') { sx = Math.max(.05, (ob.w - dx) / ob.w); sy = Math.max(.05, (ob.h - dy) / ob.h); ax = ob.x + ob.w; ay = ob.y + ob.h; }
      if (pos === 'e' ) { sx = Math.max(.05, (ob.w + dx) / ob.w); ax = ob.x;        ay = ob.y + ob.h/2;  }
      if (pos === 'w' ) { sx = Math.max(.05, (ob.w - dx) / ob.w); ax = ob.x + ob.w; ay = ob.y + ob.h/2;  }
      if (pos === 's' ) { sy = Math.max(.05, (ob.h + dy) / ob.h); ax = ob.x + ob.w/2; ay = ob.y;         }
      if (pos === 'n' ) { sy = Math.max(.05, (ob.h - dy) / ob.h); ax = ob.x + ob.w/2; ay = ob.y + ob.h;  }
      const prev = oa['_tr'] ? ` ${oa['_tr']}` : '';
      el.setAttribute('transform', `translate(${ax},${ay}) scale(${sx},${sy}) translate(${-ax},${-ay})${prev}`);
    }
    this.drawSelHandles(el);
  }

  // ── Rotation ───────────────────────────────────────────────────────────────
  private startRotate(e: MouseEvent, b: BBox): void {
    if (!this.selEl) return;
    e.preventDefault();
    this.push();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const p = this.pt(e);
    const tr = this.selEl.getAttribute('transform') ?? '';
    const m = tr.match(/rotate\s*\(\s*([^,)]+)/);
    this.rotating = {
      cx, cy,
      initMouseAngle: Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI,
      origElemAngle: m ? parseFloat(m[1]) : 0,
      origTransform: tr,
    };
  }

  private onMoveRotate(p: Pt): void {
    if (!this.rotating || !this.selEl) return;
    const { cx, cy, initMouseAngle, origElemAngle, origTransform } = this.rotating;
    const mouseAngle = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
    const newAngle = origElemAngle + (mouseAngle - initMouseAngle);
    const noRot = origTransform.replace(/rotate\s*\([^)]*\)\s*/g, '').trim();
    const rotPart = `rotate(${newAngle.toFixed(2)}, ${cx.toFixed(2)}, ${cy.toFixed(2)})`;
    this.selEl.setAttribute('transform', noRot ? `${noRot} ${rotPart}` : rotPart);
    this.drawSelHandles(this.selEl);
  }

  // ── Propriétés de l'élément ─────────────────────────────────────────────────
  private showPropsPanel(el: SVGElement): void {
    const tag = el.tagName;
    const isText = tag === 'text';
    const hasFill = tag === 'rect' || tag === 'ellipse';
    this.propFillSection.style.display = hasFill ? '' : 'none';
    this.propTextSection.style.display = isText ? '' : 'none';

    const strokeColor = isText ? (el.getAttribute('fill') ?? '#1e293b') : (el.getAttribute('stroke') ?? '#1e293b');
    this.propStrokeColorBtns.forEach((b, k) => { if (k !== '__custom__') b.classList.toggle('active', k === strokeColor); });
    if (/^#[0-9a-fA-F]{3,8}$/.test(strokeColor)) {
      const h6 = strokeColor.length === 4 ? '#'+strokeColor[1]+strokeColor[1]+strokeColor[2]+strokeColor[2]+strokeColor[3]+strokeColor[3] : strokeColor.substring(0, 7);
      this.propCustomStrokeInput.value = h6;
      (this.propStrokeColorBtns.get('__custom__') as HTMLElement | undefined)?.style.setProperty('background', h6);
    }

    if (hasFill) {
      const fill = el.getAttribute('fill') ?? 'none';
      this.propFillSwatches.forEach((b, k) => b.classList.toggle('active', k === fill));
      if (fill !== 'none' && /^#[0-9a-fA-F]{6}$/.test(fill)) this.propCustomFillInput.value = fill;
    }

    if (isText) {
      const fw = el.getAttribute('font-weight') ?? '';
      const fi = el.getAttribute('font-style') ?? '';
      const fd = el.getAttribute('text-decoration') ?? '';
      this.propTextBoldBtn.classList.toggle('active', fw === 'bold');
      this.propTextItalicBtn.classList.toggle('active', fi === 'italic');
      this.propTextUnderlineBtn.classList.toggle('active', fd === 'underline');
      const ff = el.getAttribute('font-family') ?? 'system-ui, -apple-system, sans-serif';
      // Trouver l'option la plus proche
      const opts = Array.from(this.propTextFontSelect.options);
      const match = opts.find(o => o.value === ff) ?? opts[0];
      this.propTextFontSelect.value = match.value;
      this.propTextSizeInput.value = String(Math.round(parseFloat(el.getAttribute('font-size') ?? '16')));
    }

    const opacVal = Math.round(parseFloat(el.getAttribute('opacity') ?? '1') * 100);
    this.propOpacityInput.value = String(opacVal);
    this.propOpacityVal.textContent = String(opacVal);

    this.propsPanel.style.display = 'flex';
  }

  private hidePropsPanel(): void { this.propsPanel.style.display = 'none'; }

  private applyPropColor(c: string): void {
    if (!this.selEl) return;
    if (this.selEl.tagName === 'text') {
      this.selEl.setAttribute('fill', c);
    } else {
      this.selEl.setAttribute('stroke', c);
      const fill = this.selEl.getAttribute('fill') ?? 'none';
      if (fill !== 'none' && fill !== '#ffffff' && fill !== '' && fill !== 'transparent') {
        this.selEl.setAttribute('fill', c);
        this.propFillSwatches.forEach((b, k) => b.classList.toggle('active', k === c));
      }
    }
    this.propStrokeColorBtns.forEach((b, k) => { if (k !== '__custom__') b.classList.toggle('active', k === c); });
    if (/^#[0-9a-fA-F]{6}$/.test(c)) {
      this.propCustomStrokeInput.value = c;
      (this.propStrokeColorBtns.get('__custom__') as HTMLElement | undefined)?.style.setProperty('background', c);
    }
  }

  private applyPropFillColor(c: string): void {
    if (!this.selEl) return;
    if (this.selEl.tagName !== 'rect' && this.selEl.tagName !== 'ellipse') return;
    this.selEl.setAttribute('fill', c);
    this.propFillSwatches.forEach((b, k) => b.classList.toggle('active', k === c));
    if (c !== 'none' && /^#[0-9a-fA-F]{6}$/.test(c)) this.propCustomFillInput.value = c;
  }

  private applyPropTextBold(): void {
    if (!this.selEl || this.selEl.tagName !== 'text') return;
    const isBold = this.selEl.getAttribute('font-weight') === 'bold';
    isBold ? this.selEl.removeAttribute('font-weight') : this.selEl.setAttribute('font-weight', 'bold');
    this.propTextBoldBtn.classList.toggle('active', !isBold);
    this.drawSelHandles(this.selEl);
  }

  private applyPropTextItalic(): void {
    if (!this.selEl || this.selEl.tagName !== 'text') return;
    const isItalic = this.selEl.getAttribute('font-style') === 'italic';
    isItalic ? this.selEl.removeAttribute('font-style') : this.selEl.setAttribute('font-style', 'italic');
    this.propTextItalicBtn.classList.toggle('active', !isItalic);
    this.drawSelHandles(this.selEl);
  }

  private applyPropTextUnderline(): void {
    if (!this.selEl || this.selEl.tagName !== 'text') return;
    const isUnder = this.selEl.getAttribute('text-decoration') === 'underline';
    isUnder ? this.selEl.removeAttribute('text-decoration') : this.selEl.setAttribute('text-decoration', 'underline');
    this.propTextUnderlineBtn.classList.toggle('active', !isUnder);
  }

  private applyPropTextFont(font: string): void {
    if (!this.selEl || this.selEl.tagName !== 'text') return;
    this.selEl.setAttribute('font-family', font);
    this.drawSelHandles(this.selEl);
  }

  private applyPropTextSize(size: number): void {
    if (!this.selEl || this.selEl.tagName !== 'text' || isNaN(size) || size < 8) return;
    this.selEl.setAttribute('font-size', String(size));
    this.drawSelHandles(this.selEl);
  }

  private applyPropOpacity(val: number): void {
    if (!this.selEl) return;
    val >= 100 ? this.selEl.removeAttribute('opacity') : this.selEl.setAttribute('opacity', String(val / 100));
  }

  private applyPropOrder(action: string): void {
    const el = this.selEl;
    if (!el) return;
    this.push();
    const parent = el.parentElement!;
    if (action === 'to-front') { parent.appendChild(el); }
    else if (action === 'to-back') { const first = Array.from(parent.children).find(c => c.tagName !== 'defs'); if (first && first !== el) parent.insertBefore(el, first); }
    else if (action === 'forward')  { const next = el.nextElementSibling; if (next && next !== this.selHandles) next.insertAdjacentElement('afterend', el); }
    else if (action === 'backward') { const prev = el.previousElementSibling; if (prev && prev.tagName !== 'defs') parent.insertBefore(el, prev); }
    this.drawSelHandles(el);
  }

  // ── SVG helpers ─────────────────────────────────────────────────────────────
  private initDefs(): void {
    const defs = svgNS('defs');
    defs.innerHTML = `<marker id="be-draw-arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="0 0,10 3.5,0 7" fill="context-stroke"/></marker>`;
    this.svg.prepend(defs);
  }

  private getFill(): string {
    if (this.fill === 'none')  return 'none';
    if (this.fill === 'color') return this.color;
    return this.fill;
  }

  private pt(e: MouseEvent): Pt {
    const ctm = this.svg.getScreenCTM();
    if (ctm) {
      const inv = ctm.inverse();
      return { x: inv.a * e.clientX + inv.c * e.clientY + inv.e, y: inv.b * e.clientX + inv.d * e.clientY + inv.f };
    }
    const r = this.svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── History ─────────────────────────────────────────────────────────────────
  private snap(): string { return this.svg.innerHTML; }
  private push(): void   { this.history.push(this.snap()); }

  private undo(): void {
    if (this.history.length <= 1) return;
    this.history.pop();
    this.svg.innerHTML = this.history[this.history.length - 1];
    this.initDefs();
    this.curEl = null; this.selEl = null; this.selHandles = null;
    this.hidePropsPanel();
  }

  private clearAll(): void {
    this.push();
    this.svg.innerHTML = '';
    this.initDefs();
    this.curEl = null; this.selEl = null; this.selHandles = null;
    this.hidePropsPanel();
  }

  // ── Load existing SVG ───────────────────────────────────────────────────────
  private loadSvg(svgStr: string): void {
    this.svg.innerHTML = '';
    this.initDefs();
    if (!svgStr) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = svgStr;
    const src = tmp.querySelector('svg');
    if (!src) return;
    for (const child of Array.from(src.childNodes)) {
      if ((child as Element).tagName === 'defs') continue;
      this.svg.appendChild(child.cloneNode(true));
    }
  }

  // ── Édition texte en place ───────────────────────────────────────────────────
  private onDblClick(e: MouseEvent): void {
    const target = e.target as SVGElement;
    let el = target;
    while (el.parentElement && el.parentElement !== (this.svg as unknown as HTMLElement)) {
      el = el.parentElement as unknown as SVGElement;
    }
    if (el.tagName !== 'text') return;
    e.preventDefault();
    this.push();

    const currentText = this.getTextLines(el);
    const color = el.getAttribute('fill') ?? this.color;

    this.openTextArea(
      e.clientX, e.clientY - 14, currentText, color,
      (lines) => {
        this.setTextLines(el, lines);
        this.drawSelHandles(el);
      },
      () => {
        el.remove();
        this.selEl = null;
        this.clearSelHandles();
        this.hidePropsPanel();
      },
    );
  }

  // ── Mouse events ─────────────────────────────────────────────────────────────
  private bindEvents(): void {
    this.svg.addEventListener('mousedown', (e) => this.onDown(e));
    this.svg.addEventListener('mousemove', (e) => this.onMove(e));
    this.svg.addEventListener('mouseup',   (e) => this.onUp(e));
    this.svg.addEventListener('mouseleave',(e) => this.onUp(e));
    this.svg.addEventListener('dblclick',  (e) => this.onDblClick(e));

    document.addEventListener('keydown', (e) => {
      if (this.overlay.style.display === 'none') return;
      if (e.key === 'Escape') this.close();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selEl && !this.textInput) {
        this.push(); this.selEl.remove(); this.selEl = null;
        this.clearSelHandles(); this.hidePropsPanel();
      }
    });
  }

  private onDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    const p = this.pt(e);
    this.sx = p.x; this.sy = p.y;

    if (this.tool === 'select') { this.startSelect(e); return; }
    if (this.tool === 'text')   { this.startText(p, e); return; }

    this.push();
    this.drawing = true;
    const s = String(this.strokeW);
    const fc = this.getFill();
    const c  = this.color;

    switch (this.tool) {
      case 'pencil': {
        this.pencilD = `M${p.x} ${p.y}`;
        const el = svgNS('path');
        el.setAttribute('d', this.pencilD);
        el.setAttribute('stroke', c); el.setAttribute('stroke-width', s);
        el.setAttribute('fill', 'none'); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
        el.dataset.id = uid(); this.svg.appendChild(el); this.curEl = el;
        break;
      }
      case 'rect': {
        const el = svgNS('rect');
        el.setAttribute('x', String(p.x)); el.setAttribute('y', String(p.y));
        el.setAttribute('width', '0'); el.setAttribute('height', '0');
        el.setAttribute('stroke', c); el.setAttribute('stroke-width', s); el.setAttribute('fill', fc);
        el.dataset.id = uid(); this.svg.appendChild(el); this.curEl = el;
        break;
      }
      case 'ellipse': {
        const el = svgNS('ellipse');
        el.setAttribute('cx', String(p.x)); el.setAttribute('cy', String(p.y));
        el.setAttribute('rx', '0'); el.setAttribute('ry', '0');
        el.setAttribute('stroke', c); el.setAttribute('stroke-width', s); el.setAttribute('fill', fc);
        el.dataset.id = uid(); this.svg.appendChild(el); this.curEl = el;
        break;
      }
      case 'line': {
        const el = svgNS('line');
        el.setAttribute('x1', String(p.x)); el.setAttribute('y1', String(p.y));
        el.setAttribute('x2', String(p.x)); el.setAttribute('y2', String(p.y));
        el.setAttribute('stroke', c); el.setAttribute('stroke-width', s); el.setAttribute('stroke-linecap', 'round');
        el.dataset.id = uid(); this.svg.appendChild(el); this.curEl = el;
        break;
      }
      case 'arrow': {
        const el = svgNS('line');
        el.setAttribute('x1', String(p.x)); el.setAttribute('y1', String(p.y));
        el.setAttribute('x2', String(p.x)); el.setAttribute('y2', String(p.y));
        el.setAttribute('stroke', c); el.setAttribute('stroke-width', s); el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('marker-end', 'url(#be-draw-arrow-end)');
        el.dataset.id = uid(); this.svg.appendChild(el); this.curEl = el;
        break;
      }
    }
  }

  private onMove(e: MouseEvent): void {
    const p = this.pt(e);

    if (this.resizing) { this.onMoveResize(p); return; }
    if (this.rotating) { this.onMoveRotate(p); return; }

    if (this.tool === 'select' && this.selEl && this.moveAnchor) {
      const dx = p.x - this.moveAnchor.x;
      const dy = p.y - this.moveAnchor.y;
      this.moveAnchor = p;
      this.moveEl(this.selEl, dx, dy);
      this.drawSelHandles(this.selEl);
      return;
    }

    if (!this.drawing || !this.curEl) return;
    const dx = p.x - this.sx;
    const dy = p.y - this.sy;

    switch (this.tool) {
      case 'pencil':
        this.pencilD += ` L${p.x} ${p.y}`;
        this.curEl.setAttribute('d', this.pencilD);
        break;
      case 'rect': {
        const x = dx >= 0 ? this.sx : p.x; const y = dy >= 0 ? this.sy : p.y;
        this.curEl.setAttribute('x', String(x)); this.curEl.setAttribute('y', String(y));
        this.curEl.setAttribute('width', String(Math.abs(dx))); this.curEl.setAttribute('height', String(Math.abs(dy)));
        break;
      }
      case 'ellipse':
        this.curEl.setAttribute('cx', String(this.sx + dx / 2)); this.curEl.setAttribute('cy', String(this.sy + dy / 2));
        this.curEl.setAttribute('rx', String(Math.abs(dx) / 2)); this.curEl.setAttribute('ry', String(Math.abs(dy) / 2));
        break;
      case 'line':
      case 'arrow':
        this.curEl.setAttribute('x2', String(p.x)); this.curEl.setAttribute('y2', String(p.y));
        break;
    }
  }

  private onUp(e: MouseEvent): void {
    if (this.resizing) { this.resizing = null; return; }
    if (this.rotating) { this.rotating = null; return; }
    this.moveAnchor = null;
    if (!this.drawing) return;
    this.drawing = false;

    let justDrawn: SVGElement | null = this.curEl;

    // Supprimer les formes trop petites (clic sans mouvement)
    if (this.curEl && this.tool !== 'pencil') {
      const p = this.pt(e);
      if (Math.abs(p.x - this.sx) < 4 && Math.abs(p.y - this.sy) < 4) {
        this.curEl.remove(); this.history.pop();
        justDrawn = null;
      }
    }
    this.curEl = null;

    // Auto-sélectionner la forme dessinée et passer en mode sélection
    if (justDrawn) {
      // Mettre à jour les boutons toolbar sans appeler deselect()
      this.tool = 'select';
      this.toolBtns.forEach((btn, key) => btn.classList.toggle('active', key === 'select'));
      this.svg.style.cursor = 'default';
      if (this.hintEl) this.hintEl.textContent = this._hints['select'];
      // Sélectionner la forme (handles + panneau propriétés)
      this.select(justDrawn);
    }
  }

  // ── Select / Move ────────────────────────────────────────────────────────────
  private startSelect(e: MouseEvent): void {
    const target = e.target as SVGElement;
    if ((target as SVGElement).dataset?.handlePos) return; // handle → géré séparément
    if (target === this.svg) { this.deselect(); return; }
    let el = target;
    while (el.parentElement && el.parentElement !== (this.svg as unknown as HTMLElement)) {
      el = el.parentElement as SVGElement;
    }
    if (!el || el === (this.svg as unknown as SVGElement)) { this.deselect(); return; }
    if ((el as Element).tagName === 'defs') { this.deselect(); return; }
    if ((el as SVGElement).dataset?.beHandles) return;

    // Si c'est une nouvelle sélection → push historique
    if (this.selEl !== el) {
      this.select(el);
      this.push();
    }
    // Toujours prêt à déplacer
    this.moveAnchor = this.pt(e);
  }

  private select(el: SVGElement): void {
    this.deselect();
    this.selEl = el;
    this.drawSelHandles(el);
    this.showPropsPanel(el);
  }

  private deselect(): void {
    if (this.selEl) { this.selEl = null; }
    this.moveAnchor = null;
    this.clearSelHandles();
    this.hidePropsPanel();
  }

  private moveEl(el: SVGElement, dx: number, dy: number): void {
    const tag = el.tagName;
    const n = (a: string) => parseFloat(el.getAttribute(a) ?? '0');
    const existingTr = el.getAttribute('transform') ?? '';

    // Si l'élément a une rotation, on déplace via translate en ESPACE ÉCRAN
    // (préfixé avant le rotate) — sinon le déplacement suivrait l'axe rotaté
    if (existingTr.includes('rotate')) {
      const m = existingTr.match(/^translate\(\s*(-?[\d.e+-]+)[,\s]+(-?[\d.e+-]+)\s*\)/);
      const tx = (m ? parseFloat(m[1]) : 0) + dx;
      const ty = (m ? parseFloat(m[2]) : 0) + dy;
      const rest = m ? existingTr.slice(m[0].length).trimStart() : existingTr;
      el.setAttribute('transform', `translate(${tx},${ty})${rest ? ' ' + rest : ''}`);
      return;
    }

    // Pas de rotation → déplacement par attributs (coordonnées SVG directes)
    if (tag === 'rect') {
      el.setAttribute('x', String(n('x') + dx));
      el.setAttribute('y', String(n('y') + dy));
    } else if (tag === 'ellipse') {
      el.setAttribute('cx', String(n('cx') + dx));
      el.setAttribute('cy', String(n('cy') + dy));
    } else if (tag === 'line') {
      el.setAttribute('x1', String(n('x1') + dx)); el.setAttribute('y1', String(n('y1') + dy));
      el.setAttribute('x2', String(n('x2') + dx)); el.setAttribute('y2', String(n('y2') + dy));
    } else {
      // path, text, g → translate accumulé
      const m = existingTr.match(/translate\(\s*(-?[\d.e+-]+)[,\s]+(-?[\d.e+-]+)\s*\)/);
      const tx = (m ? parseFloat(m[1]) : 0) + dx;
      const ty = (m ? parseFloat(m[2]) : 0) + dy;
      const rest = existingTr.replace(/translate\([^)]+\)/, '').trim();
      el.setAttribute('transform', `translate(${tx},${ty})${rest ? ' ' + rest : ''}`);
    }
  }

  // ── Helpers texte multilignes ─────────────────────────────────────────────
  private setTextLines(el: SVGElement, lines: string[]): void {
    const x = el.getAttribute('x') ?? '0';
    el.innerHTML = '';
    lines.forEach((line, i) => {
      const ts = svgNS('tspan') as SVGTSpanElement;
      ts.setAttribute('x', x);
      ts.setAttribute('dy', i === 0 ? '0' : '1.3em');
      ts.textContent = line;
      el.appendChild(ts);
    });
  }

  private getTextLines(el: SVGElement): string {
    const tspans = Array.from(el.querySelectorAll('tspan'));
    if (tspans.length > 0) return tspans.map(t => t.textContent ?? '').join('\n');
    return el.textContent ?? '';
  }

  private openTextArea(
    clientX: number, clientY: number,
    initialValue: string, color: string,
    onCommit: (lines: string[]) => void,
    onCancel: () => void,
  ): void {
    const ta = document.createElement('textarea');
    ta.value = initialValue;
    ta.className = 'be-draw-text-input';
    ta.style.cssText = `position:fixed;left:${clientX}px;top:${clientY}px;color:${color};`;
    ta.rows = Math.max(2, initialValue.split('\n').length);
    document.body.appendChild(ta);
    this.textInput = ta;

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const lines = ta.value.split('\n').map(l => l.trimEnd()).filter((_, i, a) => {
        // Supprimer uniquement les lignes vides de fin
        if (i < a.length - 1) return true;
        return l => (l as unknown as string).trim() !== '';
      });
      ta.remove(); this.textInput = undefined;
      if (lines.some(l => l.trim())) {
        onCommit(lines.filter((l, i, a) => !(i === a.length - 1 && l.trim() === '')));
      } else {
        onCancel();
      }
    };

    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.addEventListener('blur', commit);
    }, 50);

    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); commit(); }
      if (ev.key === 'Escape') { ta.value = initialValue; ta.blur(); }
      // Ajuster la hauteur automatiquement
      requestAnimationFrame(() => { ta.rows = Math.max(2, ta.value.split('\n').length); });
    });
    ta.addEventListener('input', () => {
      ta.rows = Math.max(2, ta.value.split('\n').length);
    });
  }

  // ── Outil Texte ──────────────────────────────────────────────────────────────
  private startText(p: Pt, e: MouseEvent): void {
    this.push();
    this.openTextArea(
      e.clientX, e.clientY - 14, '', this.color,
      (lines) => {
        const el = svgNS('text');
        el.setAttribute('x', String(p.x)); el.setAttribute('y', String(p.y));
        el.setAttribute('fill', this.color); el.setAttribute('font-size', '16');
        el.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
        el.dataset.id = uid();
        this.setTextLines(el, lines);
        this.svg.appendChild(el);
        this.tool = 'select';
        this.toolBtns.forEach((btn, key) => btn.classList.toggle('active', key === 'select'));
        this.svg.style.cursor = 'default';
        if (this.hintEl) this.hintEl.textContent = this._hints['select'];
        this.select(el as SVGElement);
      },
      () => { this.history.pop(); },
    );
  }

  // ── Changer d'outil ─────────────────────────────────────────────────────────
  private setTool(t: DrawTool): void {
    this.tool = t;
    this.toolBtns.forEach((btn, key) => btn.classList.toggle('active', key === t));
    this.deselect();
    this.svg.style.cursor = t === 'select' ? 'default' : t === 'text' ? 'text' : 'crosshair';
    if (this.hintEl) this.hintEl.textContent = this._hints[t] ?? '';
  }

  // ── Insérer / Fermer ─────────────────────────────────────────────────────────
  private insert(): void {
    this.deselect();
    const shapes = Array.from(this.svg.children).filter(c => c.tagName !== 'defs' && !(c as HTMLElement).dataset?.beHandles) as SVGGraphicsElement[];
    if (!shapes.length) { this.close(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    try {
      for (const s of shapes) {
        const b = s.getBBox();
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
      }
    } catch { /* getBBox peut échouer sur texte vide */ }
    const pad = 8;
    if (isFinite(minX)) {
      this.svg.setAttribute('viewBox', `${minX-pad} ${minY-pad} ${maxX-minX+pad*2} ${maxY-minY+pad*2}`);
      this.svg.setAttribute('width',  String(maxX-minX+pad*2));
      this.svg.setAttribute('height', String(maxY-minY+pad*2));
    } else {
      const r = this.svg.getBoundingClientRect();
      this.svg.setAttribute('width', String(r.width));
      this.svg.setAttribute('height', String(r.height));
    }
    this.svg.style.cursor = '';
    const svgStr = this.svg.outerHTML;
    this.onInsertCb?.(svgStr);
    this.close();
  }

  private close(): void {
    this.overlay.classList.remove('be-draw-visible');
    setTimeout(() => { this.overlay.style.display = 'none'; }, 180);
    this.textInput?.remove();
    this.textInput = undefined;
    this.curEl = null; this.selEl = null;
    this.clearSelHandles();
    this.hidePropsPanel();
  }
}
