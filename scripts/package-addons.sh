#!/usr/bin/env bash
# Packaging des addons CMS : copie le bundle IIFE + CSS + init dans chaque
# addon, puis produit un zip installable dans build/.
# Prérequis : npm run build:global (le script npm package:addons le fait).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
BUILD="$ROOT/build"
mkdir -p "$BUILD"

command -v zip >/dev/null || { echo "ERREUR : la commande 'zip' est requise." >&2; exit 1; }
[ -f "$ROOT/dist/wysiwyg.global.js" ] || { echo "ERREUR : dist/wysiwyg.global.js manquant — lancez 'npm run build:global'." >&2; exit 1; }

# ── WordPress ─────────────────────────────────────────────────────────────────
WP_DIR="$ROOT/addons/wordpress/synapxlab-wysiwyg"
mkdir -p "$WP_DIR/assets"
cp "$ROOT/dist/wysiwyg.global.js" "$ROOT/dist/wysiwyg.css" "$WP_DIR/assets/"
cp "$ROOT/addons/shared/synapx-wysiwyg-init.js" "$WP_DIR/assets/"
(cd "$ROOT/addons/wordpress" && zip -rq "$BUILD/synapxlab-wysiwyg-wordpress-$VERSION.zip" synapxlab-wysiwyg)
echo "OK  build/synapxlab-wysiwyg-wordpress-$VERSION.zip"

# ── PrestaShop ────────────────────────────────────────────────────────────────
PS_DIR="$ROOT/addons/prestashop/synapxlabwysiwyg"
mkdir -p "$PS_DIR/views/js" "$PS_DIR/views/css"
cp "$ROOT/dist/wysiwyg.global.js" "$PS_DIR/views/js/"
cp "$ROOT/addons/shared/synapx-wysiwyg-init.js" "$PS_DIR/views/js/"
cp "$ROOT/dist/wysiwyg.css" "$PS_DIR/views/css/"
(cd "$ROOT/addons/prestashop" && zip -rq "$BUILD/synapxlab-wysiwyg-prestashop-$VERSION.zip" synapxlabwysiwyg)
echo "OK  build/synapxlab-wysiwyg-prestashop-$VERSION.zip"
