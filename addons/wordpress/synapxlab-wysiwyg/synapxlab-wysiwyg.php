<?php
/**
 * Plugin Name: SynapxLab WYSIWYG
 * Plugin URI:  https://github.com/synapxLab/wysiwyg
 * Description: Éditeur WYSIWYG et pagebuilder léger, sans dépendance runtime, avec presets, sorties HTML/PDF et lecture audio pour les champs texte WordPress.
 * Version:     1.4.0
 * Author:      SynapxLab
 * Author URI:  https://github.com/synapxLab
 * License:     MIT
 * Text Domain: synapxlab-wysiwyg
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SYNAPXLAB_WYSIWYG_VERSION', '1.4.0');
define('SYNAPXLAB_WYSIWYG_URL', plugin_dir_url(__FILE__));

/**
 * Enregistre les assets (bundle IIFE + CSS + script d'init).
 * Ils ne sont chargés que lorsqu'un textarea cible est présent, ou lorsque
 * le thème/plugin appelle wp_enqueue_script('synapxlab-wysiwyg-init').
 */
function synapxlab_wysiwyg_register_assets(): void
{
    wp_register_style(
        'synapxlab-wysiwyg',
        SYNAPXLAB_WYSIWYG_URL . 'assets/wysiwyg.css',
        [],
        SYNAPXLAB_WYSIWYG_VERSION
    );
    wp_register_script(
        'synapxlab-wysiwyg',
        SYNAPXLAB_WYSIWYG_URL . 'assets/wysiwyg.global.js',
        [],
        SYNAPXLAB_WYSIWYG_VERSION,
        true
    );
    wp_register_script(
        'synapxlab-wysiwyg-init',
        SYNAPXLAB_WYSIWYG_URL . 'assets/synapx-wysiwyg-init.js',
        ['synapxlab-wysiwyg'],
        SYNAPXLAB_WYSIWYG_VERSION,
        true
    );
}
add_action('init', 'synapxlab_wysiwyg_register_assets');

/** Charge l'éditeur dans l'administration. */
function synapxlab_wysiwyg_enqueue_admin(): void
{
    wp_enqueue_style('synapxlab-wysiwyg');
    wp_enqueue_script('synapxlab-wysiwyg-init');
}
add_action('admin_enqueue_scripts', 'synapxlab_wysiwyg_enqueue_admin');

/**
 * Chargement côté front (formulaires publics) — opt-in via le filtre :
 *   add_filter('synapxlab_wysiwyg_enqueue_front', '__return_true');
 */
function synapxlab_wysiwyg_enqueue_front(): void
{
    if (!apply_filters('synapxlab_wysiwyg_enqueue_front', false)) {
        return;
    }
    wp_enqueue_style('synapxlab-wysiwyg');
    wp_enqueue_script('synapxlab-wysiwyg-init');
}
add_action('wp_enqueue_scripts', 'synapxlab_wysiwyg_enqueue_front');
