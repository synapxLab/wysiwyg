// ─── Modal Stack ──────────────────────────────────────────────────────────────
// Pile LIFO pour la gestion de la touche Escape : ferme uniquement la modale
// la plus haute, empêchant la fermeture en cascade de plusieurs modales.

const stack: Array<() => void> = [];

export function pushModal(onClose: () => void): void {
  stack.push(onClose);
}

export function popModal(): void {
  stack.pop();
}

let installed = false;

/** Installe un handler Escape unique (phase capture) — idempotent. */
export function installEscapeHandler(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      stack[stack.length - 1]!();
    }
  }, { capture: true });
}
