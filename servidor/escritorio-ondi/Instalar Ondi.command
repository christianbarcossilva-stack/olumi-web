#!/bin/bash
# Ondi · instala la app en Aplicaciones y la deja lista para abrir (firma local, sin avisos de "dañada").
cd "$(dirname "$0")"
if [ ! -d Ondi.app ]; then echo "No encuentro Ondi.app al lado de este archivo."; read -p "Enter para cerrar"; exit 1; fi
echo "Preparando Ondi…"
xattr -cr Ondi.app 2>/dev/null
codesign --force --deep --sign - Ondi.app 2>/dev/null
rm -rf /Applications/Ondi.app 2>/dev/null
if cp -R Ondi.app /Applications/ 2>/dev/null; then DEST=/Applications/Ondi.app; else mkdir -p "$HOME/Applications"; rm -rf "$HOME/Applications/Ondi.app"; cp -R Ondi.app "$HOME/Applications/"; DEST="$HOME/Applications/Ondi.app"; fi
echo "Listo: $DEST"
open "$DEST"
echo "Ya podés cerrar esta ventana. La próxima vez abrí Ondi desde Aplicaciones o Launchpad."
