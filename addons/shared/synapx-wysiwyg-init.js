/*!
 * @synapxlab/wysiwyg — script d'initialisation commun aux addons CMS.
 * Monte un éditeur sur chaque <textarea class="synapxlab-wysiwyg"> (ou
 * [data-synapx-wysiwyg]) et synchronise sa valeur avec le champ d'origine.
 *
 * Attributs data- supportés sur le textarea :
 *   data-preset="product|mini|small|bill|pdf|entity|full"  (défaut: full)
 *   data-intent="html|pdf"                                  (défaut: celui du preset)
 *   data-height="400"                                       (hauteur px)
 *   data-label="Mon éditeur"                                 (marque statusbar)
 */
(function () {
  'use strict';

  function mount(textarea) {
    if (textarea.dataset.synapxWysiMounted === '1') return;
    var api = window.SynapxWysiwyg;
    if (!api || !api.WysiwygEditor) return;

    var preset = textarea.dataset.preset || 'full';
    var opts = api.resolvePreset ? api.resolvePreset(preset) : {};
    if (textarea.dataset.intent) opts.intent = textarea.dataset.intent;
    if (textarea.dataset.label) opts.statusbarLabel = textarea.dataset.label;

    var editor = new api.WysiwygEditor(opts);
    var host = document.createElement('div');
    host.className = 'synapxlab-wysiwyg-host';
    textarea.insertAdjacentElement('afterend', host);
    host.appendChild(editor.el);

    var height = parseInt(textarea.dataset.height || '', 10);
    if (height > 0) editor.el.style.height = height + 'px';

    textarea.style.display = 'none';
    textarea.dataset.synapxWysiMounted = '1';

    editor.setValue(textarea.value || '');
    var sync = function () { textarea.value = editor.getValue(); };
    editor.onChange = sync;
    if (textarea.form) textarea.form.addEventListener('submit', sync);
  }

  function mountAll(root) {
    var nodes = (root || document).querySelectorAll('textarea.synapxlab-wysiwyg, textarea[data-synapx-wysiwyg]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mountAll(); });
  } else {
    mountAll();
  }

  // API publique pour montages dynamiques (AJAX, onglets…)
  window.SynapxWysiwygInit = { mount: mount, mountAll: mountAll };
})();
