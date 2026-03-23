import { WysiwygEditor } from './index';
import mermaid from 'mermaid';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Excalidraw, exportToSvg } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

const wrap = document.getElementById('editor-wrap')!;
const output = document.getElementById('output')!;

const editor = new WysiwygEditor({
  mermaid,
  katex,
  excalidraw: { Excalidraw, exportToSvg, React, ReactDOM },
  toolbar: { mermaid: true, math: true, excalidraw: true },
});
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
