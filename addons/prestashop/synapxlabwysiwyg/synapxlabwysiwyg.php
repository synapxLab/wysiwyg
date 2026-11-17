<?php
/**
 * SynapxLab WYSIWYG — module PrestaShop.
 * Éditeur WYSIWYG léger, presets configurables et sortie optimisée HTML/PDF.
 * Ajoutez la classe « synapxlab-wysiwyg » à un textarea du back-office pour l'activer.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class Synapxlabwysiwyg extends Module
{
    public function __construct()
    {
        $this->name = 'synapxlabwysiwyg';
        $this->tab = 'administration';
        $this->version = '1.4.0';
        $this->author = 'SynapxLab';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = ['min' => '1.7', 'max' => _PS_VERSION_];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('SynapxLab WYSIWYG');
        $this->description = $this->l('Éditeur WYSIWYG et pagebuilder léger, sans dépendance runtime, avec presets, sorties HTML/PDF et lecture audio.');
    }

    public function install(): bool
    {
        return parent::install()
            && $this->registerHook('actionAdminControllerSetMedia')
            && $this->registerHook('displayHeader');
    }

    /** Charge l'éditeur dans tout le back-office. */
    public function hookActionAdminControllerSetMedia(array $params): void
    {
        $this->context->controller->addCSS($this->_path . 'views/css/wysiwyg.css');
        $this->context->controller->addJS($this->_path . 'views/js/wysiwyg.global.js');
        $this->context->controller->addJS($this->_path . 'views/js/synapx-wysiwyg-init.js');
    }

    /**
     * Chargement côté front (désactivé par défaut) — activez la constante
     * SYNAPXLAB_WYSIWYG_FRONT dans votre thème pour l'utiliser sur des
     * formulaires publics.
     */
    public function hookDisplayHeader(array $params): void
    {
        if (!defined('SYNAPXLAB_WYSIWYG_FRONT') || !SYNAPXLAB_WYSIWYG_FRONT) {
            return;
        }
        $this->context->controller->registerStylesheet(
            'synapxlab-wysiwyg',
            'modules/' . $this->name . '/views/css/wysiwyg.css'
        );
        $this->context->controller->registerJavascript(
            'synapxlab-wysiwyg',
            'modules/' . $this->name . '/views/js/wysiwyg.global.js'
        );
        $this->context->controller->registerJavascript(
            'synapxlab-wysiwyg-init',
            'modules/' . $this->name . '/views/js/synapx-wysiwyg-init.js'
        );
    }
}
