#!/bin/bash
# Prepara el servidor para que el repositorio de GitHub pueda pasar a PRIVADO sin que la web deje de actualizarse.
# Se corre UNA vez en el servidor, mientras el repositorio todavía es público:
#   curl -fsSL https://raw.githubusercontent.com/christianbarcossilva-stack/olumi-web/main/servidor/privado.sh | sudo bash
# Pide la llave de solo lectura (se pega en el servidor, nunca en un chat), la prueba, la guarda y deja el actualizador usándola.
set -e
[ "$(id -u)" = 0 ] || { echo "Corré esto con sudo."; exit 1; }
REPO=christianbarcossilva-stack/olumi-web
echo "Pegá la llave de solo lectura de GitHub (no se ve al pegar) y apretá Enter:"
read -rs T < /dev/tty; echo
[ -n "$T" ] || { echo "No se pegó nada. No se cambió nada."; exit 1; }
C=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $T" "https://api.github.com/repos/$REPO")
[ "$C" = 200 ] || { echo "GitHub no aceptó la llave (respuesta $C). No se cambió nada."; exit 1; }
# que sea de solo lectura: si la llave deja escribir, se avisa (no se frena)
P=$(curl -s -H "Authorization: Bearer $T" "https://api.github.com/repos/$REPO" | grep -o '"push": *[a-z]*' | head -1)
case "$P" in *true*) echo "Aviso: esta llave también puede escribir. Conviene una de solo lectura (Contents: Read-only).";; esac
mkdir -p /etc/olumi; chmod 700 /etc/olumi; umask 077
printf '%s' "$T" > /etc/olumi/github.token; chmod 600 /etc/olumi/github.token
# las apps de escritorio hoy se bajan de GitHub: con el repositorio privado esos enlaces dejan de andar, así que se guardan en el servidor
mkdir -p /var/www/descargas
for a in escritorio/Olumi-Mac-Intel.zip escritorio/Olumi-Mac.zip escritorio/Olumi-Windows.zip ondi-escritorio/Ondi-Mac-Intel.zip ondi-escritorio/Ondi-Mac.zip ondi-escritorio/Ondi-Windows.zip; do f="/var/www/descargas/$(basename "$a")"
  if curl -fsSL -o "$f.tmp" "https://github.com/$REPO/releases/download/$a"; then mv "$f.tmp" "$f"; echo "Guardada: $(basename "$a")"; else rm -f "$f.tmp"; echo "No se pudo bajar $a (revisar antes de pasar a privado)"; fi; done
chmod -R a+rX /var/www/descargas
for f in actualizar auto-actualizar; do curl -fsSL -H "Authorization: Bearer $T" -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/$REPO/contents/servidor/$f.sh" -o "/tmp/olumi-$f.sh"; done
install -m 755 /tmp/olumi-actualizar.sh /usr/local/bin/olumi-actualizar
bash /tmp/olumi-auto-actualizar.sh
rm -f /tmp/olumi-actualizar.sh /tmp/olumi-auto-actualizar.sh
/usr/local/bin/olumi-actualizar
echo
echo "Listo: el servidor ya baja la web con la llave y tiene las descargas en https://unitytech.uy/descargas/."
echo "Falta un paso antes de pasar a privado: avisarle a Claude para que las páginas apunten a esas descargas. Después: GitHub → Settings → General → Danger Zone → Change visibility."
