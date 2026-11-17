=== SynapxLab WYSIWYG ===
Contributors: synapxlab
Tags: editor, wysiwyg, rich text, pagebuilder, pdf
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.4.0
License: MIT
License URI: https://opensource.org/licenses/MIT

Zero-dependency WYSIWYG editor with presets, HTML/PDF output and text-to-speech for WordPress textareas.

== Description ==

SynapxLab WYSIWYG adds a TypeScript rich-text editor and pagebuilder to selected WordPress textareas. Add one CSS class to mount the editor automatically while keeping the original textarea synchronized with the generated HTML.

The plugin includes focused presets for product pages, everyday editorial content, billing, complete PDF documents and Twig templates. Its HTML/PDF output intent prepares content for either web rendering or PDF engines such as wkhtmltopdf, dompdf and mPDF.

The audio toolbar button reads the selected text, or the full editor content, through the browser's Web SpeechSynthesis API. The editor has zero runtime dependencies and is loaded by default only in the WordPress administration area.

== Installation ==

1. Upload the `synapxlab-wysiwyg` directory to `/wp-content/plugins/`, or install the packaged ZIP from the WordPress Plugins screen.
2. Activate "SynapxLab WYSIWYG" from the Plugins screen.
3. Add the `synapxlab-wysiwyg` CSS class to the textarea that should use the editor.

Example:

`<textarea class="synapxlab-wysiwyg" data-preset="full"></textarea>`

You may also use the `data-synapx-wysiwyg` attribute instead of the CSS class.

== Frequently Asked Questions ==

= How do I change the preset? =

Set `data-preset` on the textarea to `product`, `mini`, `small`, `bill`, `pdf`, `entity` or `full`. The default is `full`. You can also set `data-intent="html|pdf"`, `data-height="400"` and `data-label="My editor"`.

= How do I enable the editor on front-end forms? =

Front-end assets are disabled by default. Enable them with this WordPress filter:

`add_filter('synapxlab_wysiwyg_enqueue_front', '__return_true');`

= Does rendered content require JavaScript? =

No. The editor requires JavaScript while editing, but the saved result is HTML and can be rendered without running the editor on the public page.

== Changelog ==

= 1.4.0 =

* Added HTML/PDF output intent and raw HTML access.
* Added seven built-in presets and allow-list toolbar configuration.
* Added text-to-speech with automatic browser capability detection.
* Added automatic textarea mounting for WordPress administration and opt-in front-end forms.
* Added the zero-dependency global browser bundle used by the plugin.
