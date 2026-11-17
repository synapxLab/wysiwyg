// @synapxlab/wysiwyg — src/table.ts
// Composant tableau : rendu, parsing HTML↔état, widget interactif (fusion, scission, ajout/suppression lignes/colonnes).

import { pushModal, popModal, installEscapeHandler } from './modalStack';

// ─── Data types ───────────────────────────────────────────────────────────────

export interface CellData {
  content: string;
  type: 'td' | 'th';
  width: string;
  height: string;
  padding: string | null;
  border: string | null;
  colspan: number;
  rowspan: number;
  textWrap: boolean;
  textAlign: string;
  verticalAlign: string;
  backgroundColor: string;
  borderColor: string;
  _hidden: boolean;
}

export interface TableProps {
  rows: number;
  cols: number;
  width: string;
  height: string;
  headerType: 'none' | 'first-row' | 'first-col' | 'both';
  borderSize: number;
  cellSpacing: number;
  cellPadding: number;
  textAlign: string;
  caption: string;
  ariaDescription: string;
  cells: CellData[][];
}

// ─── Cell factory ─────────────────────────────────────────────────────────────

export function blankCell(type: 'td' | 'th' = 'td'): CellData {
  return {
    content: '', type, width: '', height: '',
    padding: null, border: null,
    colspan: 1, rowspan: 1, textWrap: true,
    textAlign: '', verticalAlign: '',
    backgroundColor: '', borderColor: '', _hidden: false,
  };
}

function getBorderSize(border: string): number {
  const match = String(border || '').match(/^(\d+)px/i);
  return match ? parseInt(match[1], 10) || 0 : 0;
}

export function inferType(r: number, c: number, headerType: string): 'td' | 'th' {
  if (headerType === 'first-row' && r === 0) return 'th';
  if (headerType === 'first-col' && c === 0) return 'th';
  if (headerType === 'both' && (r === 0 || c === 0)) return 'th';
  return 'td';
}

export function ensureCells(src: CellData[][] | undefined, rows: number, cols: number, headerType: string): CellData[][] {
  const existing = src ?? [];
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      existing[r]?.[c] ? { ...existing[r][c] } : blankCell(inferType(r, c, headerType)),
    ),
  );
}

// ─── Table structural operations ──────────────────────────────────────────────

export function insertRow(cells: CellData[][], at: number, cols: number, headerType: string): CellData[][] {
  const result = cells.map(row => row.map(cd => ({ ...cd })));
  const newRow = Array.from({ length: cols }, (_, c) => blankCell(inferType(at, c, headerType)));
  for (let c = 0; c < cols; c++) {
    for (let r = at - 1; r >= 0; r--) {
      if (!result[r]?.[c]) break;
      if (!result[r][c]._hidden) {
        if (r + result[r][c].rowspan > at) { result[r][c].rowspan++; newRow[c]._hidden = true; }
        break;
      }
    }
  }
  result.splice(at, 0, newRow);
  return result;
}

export function deleteRow(cells: CellData[][], r: number): CellData[][] {
  if (cells.length <= 1) return cells;
  return cells
    .filter((_, i) => i !== r)
    .map(row => row.map(cd => ({ ...cd, rowspan: 1, _hidden: false })));
}

export function insertCol(cells: CellData[][], at: number, _rows: number, headerType: string): CellData[][] {
  return cells.map((row, r) => {
    const result = row.map(cd => ({ ...cd }));
    const newCell = blankCell(inferType(r, at, headerType));
    for (let c = at - 1; c >= 0; c--) {
      if (!result[c]) break;
      if (!result[c]._hidden) {
        if (c + result[c].colspan > at) { result[c].colspan++; newCell._hidden = true; }
        break;
      }
    }
    result.splice(at, 0, newCell);
    return result;
  });
}

export function deleteCol(cells: CellData[][], c: number): CellData[][] {
  if (cells[0]?.length <= 1) return cells;
  return cells
    .map(row => row.filter((_, i) => i !== c))
    .map(row => row.map(cd => ({ ...cd, colspan: 1, _hidden: false })));
}

export function mergeRight(cells: CellData[][], r: number, c: number): CellData[][] {
  const result = cells.map(row => row.map(cd => ({ ...cd })));
  const src = result[r][c];
  const nextC = c + src.colspan;
  if (nextC >= result[r].length) return result;
  const tgt = result[r][nextC];
  if (tgt._hidden) return result;
  if (tgt.content.trim()) src.content = src.content ? src.content + ' ' + tgt.content : tgt.content;
  const absorbed = tgt.colspan;
  src.colspan += absorbed;
  for (let i = 0; i < absorbed && nextC + i < result[r].length; i++) { result[r][nextC + i]._hidden = true; }
  return result;
}

export function mergeDown(cells: CellData[][], r: number, c: number): CellData[][] {
  const result = cells.map(row => row.map(cd => ({ ...cd })));
  const src = result[r][c];
  const nextR = r + src.rowspan;
  if (nextR >= result.length) return result;
  const tgt = result[nextR][c];
  if (tgt._hidden) return result;
  if (tgt.content.trim()) src.content = src.content ? src.content + ' ' + tgt.content : tgt.content;
  const absorbed = tgt.rowspan;
  src.rowspan += absorbed;
  for (let i = 0; i < absorbed && nextR + i < result.length; i++) { result[nextR + i][c]._hidden = true; }
  return result;
}

export function splitH(cells: CellData[][], r: number, c: number): CellData[][] {
  const result = cells.map(row => row.map(cd => ({ ...cd })));
  const src = result[r][c];
  if (src.colspan <= 1) return result;
  const freed = c + src.colspan - 1;
  src.colspan--;
  result[r][freed] = blankCell(src.type);
  result[r][freed].rowspan = src.rowspan;
  return result;
}

export function splitV(cells: CellData[][], r: number, c: number): CellData[][] {
  const result = cells.map(row => row.map(cd => ({ ...cd })));
  const src = result[r][c];
  if (src.rowspan <= 1) return result;
  const freed = r + src.rowspan - 1;
  src.rowspan--;
  result[freed][c] = blankCell(src.type);
  result[freed][c].colspan = src.colspan;
  return result;
}

// ─── Small DOM helpers ────────────────────────────────────────────────────────

function mkBtn(svg: string, title: string, fn: () => void, disabled = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'be-table-toolbar__btn';
  b.innerHTML = svg; b.title = title; b.disabled = disabled;
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}

function mkSep(): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'be-table-toolbar__sep';
  return s;
}

function mkSelect(opts: { v: string; l: string }[], value: string, onChange: (v: string) => void): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = 'be-field__select';
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o.v; opt.textContent = o.l;
    if (o.v === value) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function mkInput(type: string, value: string, ph: string, onChange: (v: string) => void): HTMLInputElement {
  const inp = document.createElement('input');
  inp.type = type; inp.className = 'be-field__input';
  inp.value = value; inp.placeholder = ph;
  inp.addEventListener('change', () => onChange(inp.value));
  return inp;
}

function mkColor(value: string, onChange: (v: string) => void): HTMLInputElement {
  const inp = document.createElement('input');
  inp.type = 'color';
  inp.value = /^#[0-9a-f]{3,6}$/i.test(value) ? value : '#d1d5db';
  inp.style.cssText = 'width:100%;height:28px;border:1px solid var(--be-border);border-radius:4px;cursor:pointer;';
  inp.addEventListener('input', () => onChange(inp.value));
  return inp;
}

// ─── Shared props panel builder ───────────────────────────────────────────────

export function buildTablePropsPanel(
  body: HTMLElement,
  state: TableProps,
  selR: number,
  selC: number,
  save: () => void,
  mode: 'table' | 'cell' | 'both' = 'both',
): void {
  body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'be-properties';
  body.appendChild(wrap);

  const field = (grid: HTMLElement, label: string, el: HTMLElement): void => {
    const row = document.createElement('div');
    row.className = 'be-field';
    const lbl = document.createElement('label');
    lbl.className = 'be-field__label'; lbl.textContent = label;
    row.appendChild(lbl); row.appendChild(el);
    grid.appendChild(row);
  };

  if (mode === 'table' || mode === 'both') {
    const tableTitle = document.createElement('div');
    tableTitle.className = 'be-properties__title'; tableTitle.textContent = 'Tableau';
    wrap.appendChild(tableTitle);
    const tableGrid = document.createElement('div');
    tableGrid.className = 'be-table-props-grid';
    wrap.appendChild(tableGrid);

    field(tableGrid, 'Largeur', mkInput('text', state.width, '100%', v => { state.width = v; save(); }));
    field(tableGrid, 'En-têtes', mkSelect([
      { v: 'none', l: 'Aucun' }, { v: 'first-row', l: 'Première ligne' },
      { v: 'first-col', l: 'Première colonne' }, { v: 'both', l: 'Les deux' },
    ], state.headerType, v => { state.headerType = v as TableProps['headerType']; state.cells = ensureCells(state.cells, state.rows, state.cols, state.headerType); save(); }));
    field(tableGrid, 'Bordure (px)', mkInput('number', String(state.borderSize), '0', v => {
      state.borderSize = Math.max(0, parseInt(v) || 0);
      state.cells.forEach((row) => row.forEach((cell) => {
        if (cell._hidden) return;
        cell.border = state.borderSize > 0 ? `${state.borderSize}px solid ${cell.borderColor || '#d1d5db'}` : '';
      }));
      save();
    }));
    field(tableGrid, 'Espacement (px)', mkInput('number', String(state.cellSpacing), '0', v => { state.cellSpacing = Math.max(0, parseInt(v) || 0); save(); }));
    field(tableGrid, 'Marge interne (px)', mkInput('number', String(state.cellPadding), '8', v => {
      state.cellPadding = Math.max(0, parseInt(v) || 0);
      state.cells.forEach((row) => row.forEach((cell) => {
        if (cell._hidden) return;
        cell.padding = `${state.cellPadding}px`;
      }));
      save();
    }));
    field(tableGrid, 'Alignement', mkSelect([
      { v: 'left', l: 'Gauche' }, { v: 'center', l: 'Centré' }, { v: 'right', l: 'Droite' },
    ], state.textAlign, v => { state.textAlign = v; save(); }));
    field(tableGrid, 'Titre (caption)', mkInput('text', state.caption, 'Optionnel', v => { state.caption = v; save(); }));
  }

  if ((mode === 'cell' || mode === 'both') && selR >= 0 && selC >= 0 && state.cells[selR]?.[selC] && !state.cells[selR][selC]._hidden) {
    const cd = state.cells[selR][selC];
    const cellTitle = document.createElement('div');
    cellTitle.className = 'be-properties__title';
    if (mode === 'both') cellTitle.style.marginTop = '16px';
    cellTitle.textContent = `Cellule L${selR + 1} · C${selC + 1}`;
    wrap.appendChild(cellTitle);
    const cellGrid = document.createElement('div');
    cellGrid.className = 'be-table-props-grid';
    wrap.appendChild(cellGrid);

    field(cellGrid, 'Type', mkSelect([{ v: 'td', l: 'Donnée (td)' }, { v: 'th', l: 'En-tête (th)' }],
      cd.type, v => { state.cells[selR][selC].type = v as 'td' | 'th'; save(); }));
    field(cellGrid, 'Largeur', mkInput('text', cd.width, 'auto', v => { state.cells[selR][selC].width = v; save(); }));
    field(cellGrid, 'Hauteur', mkInput('text', cd.height, 'auto', v => { state.cells[selR][selC].height = v; save(); }));
    field(cellGrid, 'Colspan', mkInput('number', String(cd.colspan), '1', v => { state.cells[selR][selC].colspan = Math.max(1, parseInt(v) || 1); save(); }));
    field(cellGrid, 'Rowspan', mkInput('number', String(cd.rowspan), '1', v => { state.cells[selR][selC].rowspan = Math.max(1, parseInt(v) || 1); save(); }));
    field(cellGrid, 'Alignement H', mkSelect([
      { v: '', l: 'Hérité' }, { v: 'left', l: 'Gauche' }, { v: 'center', l: 'Centré' }, { v: 'right', l: 'Droite' },
    ], cd.textAlign, v => { state.cells[selR][selC].textAlign = v; save(); }));
    field(cellGrid, 'Alignement V', mkSelect([
      { v: '', l: 'Hérité' }, { v: 'top', l: 'Haut' }, { v: 'middle', l: 'Milieu' }, { v: 'bottom', l: 'Bas' },
    ], cd.verticalAlign, v => { state.cells[selR][selC].verticalAlign = v; save(); }));
    field(cellGrid, 'Fond', mkColor(cd.backgroundColor || '#ffffff', v => { state.cells[selR][selC].backgroundColor = v; save(); }));
    field(cellGrid, 'Bordure', mkColor(cd.borderColor || '#d1d5db', v => {
      state.cells[selR][selC].borderColor = v;
      const borderSize = getBorderSize(state.cells[selR][selC].border || '') || state.borderSize || 1;
      state.cells[selR][selC].border = borderSize > 0 ? `${borderSize}px solid ${v}` : '';
      save();
    }));

    const wrapWrap = document.createElement('label');
    wrapWrap.className = 'be-field__label';
    wrapWrap.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;';
    const wrapChk = document.createElement('input');
    wrapChk.type = 'checkbox'; wrapChk.checked = cd.textWrap;
    wrapChk.addEventListener('change', () => { state.cells[selR][selC].textWrap = wrapChk.checked; save(); });
    wrapWrap.appendChild(wrapChk);
    wrapWrap.append('Retour à la ligne');
    field(cellGrid, 'Texte', wrapWrap as unknown as HTMLElement);
  } else if (mode === 'cell') {
    const msg = document.createElement('p');
    msg.style.cssText = 'padding:12px;color:var(--be-text-muted);font-size:12px;margin:0;';
    msg.textContent = 'Cliquez sur une cellule pour afficher ses propriétés.';
    wrap.appendChild(msg);
  }
}

// ─── Modale propriétés tableau ────────────────────────────────────────────────

export class TablePropsModal {
  isOpen = false;
  readonly body: HTMLElement;
  onClose?: () => void;
  private readonly overlay: HTMLElement;
  private readonly titleEl: HTMLElement;

  constructor() {
    installEscapeHandler();
    this.overlay = document.createElement('div');
    this.overlay.className = 'be-props-modal be-table-props-modal';
    this.overlay.style.cssText = 'position:fixed;inset:0;display:none;z-index:9999;';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'be-props-modal__dialog';
    const header = document.createElement('div');
    header.className = 'be-props-modal__header';
    this.titleEl = document.createElement('span');
    this.titleEl.className = 'be-props-modal__title';
    this.titleEl.textContent = 'Propriétés du tableau';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button'; closeBtn.className = 'be-props-modal__close';
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.title = 'Fermer';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(this.titleEl); header.appendChild(closeBtn);
    this.body = document.createElement('div');
    this.body.className = 'be-props-modal__body';
    dialog.appendChild(header); dialog.appendChild(this.body);
    this.overlay.appendChild(dialog);
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    document.body.appendChild(this.overlay);
    this.overlay.style.display = 'flex';
    pushModal(() => this.close());
  }

  setTitle(text: string): void { this.titleEl.textContent = text; }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.overlay.remove();
    popModal();
    this.onClose?.();
  }
}

// ─── Icons SVG 14×14 ─────────────────────────────────────────────────────────

export const ICONS = {
  rowBefore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="14" width="18" height="7" rx="1"/><line x1="12" y1="3" x2="12" y2="11"/><line x1="8" y1="7" x2="16" y2="7"/></svg>`,
  rowAfter:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="7" rx="1"/><line x1="12" y1="13" x2="12" y2="21"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  rowDel:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`,
  colBefore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="14" y="3" width="7" height="18" rx="1"/><line x1="3" y1="12" x2="11" y2="12"/><line x1="7" y1="8" x2="7" y2="16"/></svg>`,
  colAfter:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="7" height="18" rx="1"/><line x1="13" y1="12" x2="21" y2="12"/><line x1="17" y1="8" x2="17" y2="16"/></svg>`,
  colDel:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="8" y="3" width="8" height="18" rx="1"/><line x1="12" y1="8" x2="12" y2="16"/></svg>`,
  mergeR:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="5" width="8" height="14" rx="1"/><rect x="14" y="5" width="8" height="14" rx="1"/><polyline points="10 9 14 12 10 15"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  mergeD:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="5" y="2" width="14" height="8" rx="1"/><rect x="5" y="14" width="14" height="8" rx="1"/><polyline points="9 10 12 14 15 10"/><line x1="12" y1="10" x2="12" y2="14"/></svg>`,
  splitH:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="5" width="20" height="14" rx="1"/><line x1="12" y1="5" x2="12" y2="19"/><polyline points="9 8 6 12 9 16"/><polyline points="15 8 18 12 15 16"/></svg>`,
  splitV:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="5" width="20" height="14" rx="1"/><line x1="2" y1="12" x2="22" y2="12"/><polyline points="6 9 12 6 18 9"/><polyline points="6 15 12 18 18 15"/></svg>`,
  cellProps: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>`,
  cellEdit:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>`,
  bold:      `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>`,
  italic:    `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 4H10M14 20H5M15 4L9 20"/></svg>`,
  underline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>`,
  strike:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17.3 12H6.7C5.2 12 4 10.9 4 9.5S5.2 7 6.7 7h1.6"/><path d="M6.7 12h10.6c1.5 0 2.7 1.1 2.7 2.5S18.8 17 17.3 17h-1.6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>`,
};

// ─── HTML table → TableProps parser (used by applyHtml on load) ───────────────

export function parseHtmlTableToState(table: HTMLTableElement): TableProps {
  const st = table.style;
  const width = st.width || '100%';
  const height = st.height || '';
  const textAlign = st.textAlign || 'left';
  const cellSpacing = st.borderSpacing ? parseInt(st.borderSpacing) || 0 : 0;

  const captionEl = table.querySelector('caption');
  const caption = captionEl ? captionEl.textContent || '' : '';

  const numRows = table.rows.length;
  if (numRows === 0) {
    return {
      rows: 0, cols: 0, width, height, headerType: 'none',
      borderSize: 1, cellSpacing, cellPadding: 8,
      textAlign, caption, ariaDescription: '',
      cells: [],
    };
  }

  // Nombre de colonnes réel (en tenant compte des colspans)
  let numCols = 0;
  for (let r = 0; r < numRows; r++) {
    let rowCols = 0;
    for (let ci = 0; ci < table.rows[r].cells.length; ci++) {
      rowCols += table.rows[r].cells[ci].colSpan || 1;
    }
    numCols = Math.max(numCols, rowCols);
  }

  let borderSize = 1;
  let cellPadding = 8;

  // Grille pour gérer rowspan/colspan
  const grid: (CellData | null)[][] = Array.from({ length: numRows }, () => Array(numCols).fill(null));

  for (let r = 0; r < numRows; r++) {
    const row = table.rows[r];
    let gridC = 0;
    for (let ci = 0; ci < row.cells.length; ci++) {
      while (gridC < numCols && grid[r][gridC] !== null) gridC++;
      if (gridC >= numCols) break;

      const cell = row.cells[ci];
      const colspan = cell.colSpan || 1;
      const rowspan = cell.rowSpan || 1;
      const cst = cell.style;

      const padMatch = cst.padding?.match(/(\d+)/);
      if (padMatch) cellPadding = parseInt(padMatch[1]);

      const borderMatch = cst.border?.match(/^(\d+)px/);
      if (borderMatch) borderSize = parseInt(borderMatch[1]);

      const borderColorMatch = cst.border?.match(/#[0-9a-fA-F]{3,6}/);

      const cd: CellData = {
        content: cell.innerHTML,
        type: cell.tagName.toLowerCase() as 'td' | 'th',
        width: cst.width || '',
        height: cst.height || '',
        padding: cst.padding || '',
        border: cst.border || '',
        colspan,
        rowspan,
        textWrap: cst.whiteSpace !== 'nowrap',
        textAlign: cst.textAlign || '',
        verticalAlign: cst.verticalAlign || '',
        backgroundColor: cst.background || cst.backgroundColor || '',
        borderColor: borderColorMatch ? borderColorMatch[0] : '',
        _hidden: false,
      };

      grid[r][gridC] = cd;

      // Marquer les cellules couvertes par colspan/rowspan
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr; const cc = gridC + dc;
          if (rr < numRows && cc < numCols) {
            grid[rr][cc] = { ...blankCell('td'), _hidden: true };
          }
        }
      }
      gridC += colspan;
    }
  }

  // Remplir les cellules restantes vides
  const cells: CellData[][] = grid.map((row, r) =>
    row.map((cd, c) => cd ?? blankCell(inferType(r, c, 'none'))),
  );

  // Détecter le type d'en-têtes
  const allFirstRowTh = numCols > 0 && cells[0].every(cd => cd.type === 'th' && !cd._hidden);
  const allFirstColTh = numRows > 0 && cells.every(row => row[0]?.type === 'th');
  let headerType: TableProps['headerType'] = 'none';
  if (allFirstRowTh && allFirstColTh) headerType = 'both';
  else if (allFirstRowTh) headerType = 'first-row';
  else if (allFirstColTh) headerType = 'first-col';

  return {
    rows: numRows, cols: numCols, width, height,
    headerType, borderSize, cellSpacing, cellPadding,
    textAlign, caption,
    ariaDescription: table.getAttribute('aria-describedby') || '',
    cells,
  };
}

// ─── mkBtn/mkSep re-exports for WysiwygTable inline use ──────────────────────
export { mkBtn as _mkBtn, mkSep as _mkSep };
