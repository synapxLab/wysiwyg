# Addons CMS pour `@synapxlab/wysiwyg`

Les addons officiels intègrent l'éditeur `@synapxlab/wysiwyg` aux champs `<textarea>` de WordPress et PrestaShop. Ils utilisent le bundle global du package et ne nécessitent aucun bundler côté CMS.

## Addons disponibles

| CMS | Emplacement |
|---|---|
| WordPress | `addons/wordpress/synapxlab-wysiwyg/` |
| PrestaShop | `addons/prestashop/synapxlabwysiwyg/` |

## Installation

### WordPress

1. Copiez le dossier `addons/wordpress/synapxlab-wysiwyg/` dans `wp-content/plugins/`.
2. Activez **SynapxLab WYSIWYG** depuis la page **Extensions** de l'administration WordPress.

L'archive ZIP produite par la commande de packaging peut également être installée depuis **Extensions > Ajouter une extension > Téléverser une extension**.

### PrestaShop

1. Utilisez le dossier `addons/prestashop/synapxlabwysiwyg/` comme dossier du module.
2. Installez le module **SynapxLab WYSIWYG** depuis le gestionnaire de modules du back-office PrestaShop.

L'archive ZIP produite par la commande de packaging est directement installable depuis ce gestionnaire.

## Activer l'éditeur sur un champ

Ajoutez la classe CSS `synapxlab-wysiwyg` à un élément `<textarea>` :

```html
<textarea class="synapxlab-wysiwyg"></textarea>
```

Vous pouvez aussi utiliser l'attribut `data-synapx-wysiwyg` :

```html
<textarea data-synapx-wysiwyg></textarea>
```

Le script d'initialisation monte automatiquement l'éditeur et synchronise sa valeur avec le champ d'origine.

### Attributs de configuration

| Attribut | Valeurs | Valeur par défaut |
|---|---|---|
| `data-preset` | `product`, `mini`, `small`, `bill`, `pdf`, `entity`, `full` | `full` |
| `data-intent` | `html`, `pdf` | Intention définie par le preset |
| `data-height` | Hauteur en pixels, par exemple `400` | Hauteur de l'éditeur |
| `data-label` | Texte libre, par exemple `Mon éditeur` | Libellé de statut du preset ou de l'éditeur |

Exemple complet :

```html
<textarea
  class="synapxlab-wysiwyg"
  data-preset="pdf"
  data-intent="pdf"
  data-height="400"
  data-label="Mon éditeur"
></textarea>
```

## Back-office et front-end

Les ressources de l'éditeur sont chargées par défaut dans les espaces d'administration WordPress et PrestaShop. Leur chargement sur le front-end, notamment pour les formulaires publics, doit être activé explicitement.

### WordPress

Ajoutez ce filtre dans le thème ou dans un plugin :

```php
add_filter('synapxlab_wysiwyg_enqueue_front', '__return_true');
```

### PrestaShop

Définissez cette constante dans le thème :

```php
define('SYNAPXLAB_WYSIWYG_FRONT', true);
```

## Générer les archives installables

Depuis la racine du dépôt, exécutez :

```bash
npm run package:addons
```

Les archives sont générées dans `build/` :

- `build/synapxlab-wysiwyg-wordpress-<version>.zip`
- `build/synapxlab-wysiwyg-prestashop-<version>.zip`
