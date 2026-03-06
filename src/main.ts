import { WysiwygEditor } from './index';

const wrap = document.getElementById('editor-wrap')!;
const output = document.getElementById('output')!;

const editor = new WysiwygEditor();
editor.el.style.height = '100%';
wrap.appendChild(editor.el);

editor.onChange = () => {
  // optionnel : preview temps réel
};

editor.setValue('<h2>Bienvenue dans le WYSIWYG</h2><p>Commencez à écrire, insérez un tableau, des liens, des images…</p>');

document.getElementById('btn-get')!.addEventListener('click', () => {
  output.textContent = editor.getValue();
});

document.getElementById('btn-set')!.addEventListener('click', () => {
  editor.setValue(`
    <h1>Titre principal</h1>
    <p>Paragraphe avec du texte en <strong>gras</strong>, <em>italique</em> et <u>souligné</u>.</p>
    <ul>
      <li>Élément 1</li>
      <li>Élément 2</li>
    </ul>
    <p>Lien : <a href="https://synapxlab.com">SynapxLab</a></p>
  `);
});
