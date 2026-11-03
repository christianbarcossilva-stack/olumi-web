#!/bin/bash
# Baja la última versión de la web desde GitHub y la publica en /var/www/unitytech.
set -e
DEST=/var/www/unitytech
TMP=$(mktemp -d)
curl -fsSL https://github.com/christianbarcossilva-stack/olumi-web/archive/refs/heads/main.tar.gz | tar xz -C "$TMP"
SRC="$TMP/olumi-web-main"
rm -rf "$SRC/servidor" "$SRC/README.md"
mkdir -p "$(dirname $DEST)"
rm -rf "$DEST.nuevo"; mv "$SRC" "$DEST.nuevo"
chmod -R a+rX "$DEST.nuevo"
[ -d "$DEST" ] && mv "$DEST" "$DEST.anterior"
mv "$DEST.nuevo" "$DEST"; rm -rf "$DEST.anterior" "$TMP"
command -v restorecon >/dev/null && restorecon -R "$DEST" 2>/dev/null || true
echo "Web actualizada: $(ls $DEST | tr '\n' ' ')"
