// @synapxlab/wysiwyg — src/intent.ts
// Système d'INTENTION : optimise le HTML produit par l'éditeur selon la cible
// de rendu finale (page web ou moteur PDF type wkhtmltopdf / dompdf / mPDF).

/** Cible de rendu du HTML produit par l'éditeur. */
export type WysiwygIntent = 'html' | 'pdf';

/**
 * Détecte la présence de Twig en position texte (`{% %}` / `{{ }}`).
 * Dans ce cas on ne fait AUCUN round-trip DOM : le parser HTML éjecterait
 * les tags Twig hors des <table> (foster parenting) et casserait le template.
 */
const hasTwig = (html: string): boolean => /\{[{%]/.test(html);

/**
 * Optimise le HTML pour un moteur PDF :
 * - déballe les wrappers `<div style="overflow-x:auto">` autour des tableaux
 *   (artefacts d'édition responsive inutiles — et nuisibles — en PDF) ;
 * - fige la largeur des tableaux dimensionnés en `cm` (`table-layout:fixed`) ;
 * - duplique `vertical-align` des cellules en attribut `valign`
 *   (mieux supporté par les moteurs PDF historiques).
 */
export function normalizeForPdf(html = ''): string {
  if (!html || !/<table[\s>]/i.test(html) || hasTwig(html)) return html || '';
  const wrap = document.createElement('div');
  wrap.innerHTML = html;

  wrap.querySelectorAll('div').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const onlyChild = node.children.length === 1 ? node.firstElementChild : null;
    if (!onlyChild || onlyChild.tagName !== 'TABLE') return;
    const hasOnlyTableContent = node.childNodes.length === 1 || Array.from(node.childNodes).every((child) => {
      if (child === onlyChild) return true;
      return child.nodeType === Node.TEXT_NODE && !String(child.textContent || '').trim();
    });
    if (!hasOnlyTableContent) return;
    const table = onlyChild as HTMLTableElement;
    const overflowX = (node.style.overflowX || '').toLowerCase();
    const width = node.style.width || '';
    if (overflowX === 'auto' || width === '100%') {
      node.style.overflowX = '';
      if (table.style.width && width === '100%') node.style.width = table.style.width;
      if (!node.style.marginLeft && table.style.width && /cm$/i.test(table.style.width)) node.style.marginLeft = '1cm';
      if (!node.getAttribute('style')) node.removeAttribute('style');
    }
  });

  wrap.querySelectorAll('table').forEach((table) => {
    if (!(table instanceof HTMLTableElement)) return;
    if (table.style.width && /cm$/i.test(table.style.width) && !table.style.tableLayout) {
      table.style.tableLayout = 'fixed';
    }
  });

  wrap.querySelectorAll('td,th').forEach((cell) => {
    if (!(cell instanceof HTMLTableCellElement)) return;
    const verticalAlign = (cell.style.verticalAlign || '').toLowerCase();
    if (verticalAlign === 'top' || verticalAlign === 'middle' || verticalAlign === 'bottom') {
      cell.setAttribute('valign', verticalAlign);
    }
  });

  return wrap.innerHTML;
}

/**
 * Optimise le HTML pour un rendu web :
 * - enveloppe les tableaux dimensionnés (largeur fixe) dans un conteneur
 *   `overflow-x:auto` pour éviter le débordement horizontal sur mobile ;
 * - retire les attributs `valign` hérités (le CSS `vertical-align` suffit) ;
 * - supprime les attributs `style`/`class` vides laissés par l'édition.
 */
export function normalizeForHtml(html = ''): string {
  if (!html || hasTwig(html)) return html || '';
  const wrap = document.createElement('div');
  wrap.innerHTML = html;

  wrap.querySelectorAll('table').forEach((table) => {
    if (!(table instanceof HTMLTableElement)) return;
    const w = table.style.width || table.getAttribute('width') || '';
    const isFixedWidth = /(cm|mm|pt|px)$/i.test(w.trim());
    const parent = table.parentElement;
    const alreadyWrapped = parent instanceof HTMLElement
      && parent.children.length === 1
      && (parent.style.overflowX || '').toLowerCase() === 'auto';
    if (isFixedWidth && !alreadyWrapped) {
      const scroller = document.createElement('div');
      scroller.style.overflowX = 'auto';
      table.replaceWith(scroller);
      scroller.appendChild(table);
    }
  });

  wrap.querySelectorAll('td,th').forEach((cell) => cell.removeAttribute('valign'));

  wrap.querySelectorAll<HTMLElement>('[style=""],[class=""]').forEach((el) => {
    if (el.getAttribute('style') === '') el.removeAttribute('style');
    if (el.getAttribute('class') === '') el.removeAttribute('class');
  });

  return wrap.innerHTML;
}

/** Applique la normalisation correspondant à l'intention demandée. */
export function applyIntent(html: string, intent?: WysiwygIntent): string {
  if (intent === 'pdf') return normalizeForPdf(html);
  if (intent === 'html') return normalizeForHtml(html);
  return html;
}
