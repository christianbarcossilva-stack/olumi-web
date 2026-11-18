#!/bin/bash
# Baja la última versión de la web desde GitHub y la publica en /var/www/unitytech.
set -e
DEST=/var/www/unitytech
mkdir -p /var/www
TMP=$(mktemp -d -p /var/www .nuevo-XXXX)
# Con el repositorio privado, la descarga usa la llave de solo lectura guardada en el servidor (la deja servidor/privado.sh). Sin llave, baja como siempre.
LLAVE=/etc/olumi/github.token
if [ -s "$LLAVE" ]; then curl -fsSL -H "Authorization: Bearer $(cat "$LLAVE")" -H "Accept: application/vnd.github+json" https://api.github.com/repos/christianbarcossilva-stack/olumi-web/tarball/main | tar xz -C "$TMP" --strip-components=1
else curl -fsSL https://github.com/christianbarcossilva-stack/olumi-web/archive/refs/heads/main.tar.gz | tar xz -C "$TMP" --strip-components=1; fi
rm -rf "$TMP/servidor" "$TMP/README.md" "$TMP/.github"
# las descargas de las apps de escritorio viven en el servidor (/var/www/descargas) y se enlazan en cada publicación, sin copiar de nuevo
[ -d /var/www/descargas ] && cp -al /var/www/descargas "$TMP/descargas" 2>/dev/null || true
chmod -R a+rX "$TMP"
command -v chcon >/dev/null && chcon -R -t container_file_t "$TMP" 2>/dev/null || true
[ -d "$DEST" ] && mv "$DEST" "$DEST.anterior"
mv "$TMP" "$DEST"
rm -rf "$DEST.anterior"
echo "Web actualizada: $(ls $DEST | tr '\n' ' ')"
