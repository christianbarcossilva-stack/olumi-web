#!/bin/bash
# Baja la última versión de la web desde GitHub y la publica en /var/www/unitytech.
set -e
DEST=/var/www/unitytech
mkdir -p /var/www
TMP=$(mktemp -d -p /var/www .nuevo-XXXX)
curl -fsSL https://github.com/christianbarcossilva-stack/olumi-web/archive/refs/heads/main.tar.gz | tar xz -C "$TMP" --strip-components=1
rm -rf "$TMP/servidor" "$TMP/README.md"
chmod -R a+rX "$TMP"
command -v chcon >/dev/null && chcon -R -t container_file_t "$TMP" 2>/dev/null || true
[ -d "$DEST" ] && mv "$DEST" "$DEST.anterior"
mv "$TMP" "$DEST"
rm -rf "$DEST.anterior"
echo "Web actualizada: $(ls $DEST | tr '\n' ' ')"
