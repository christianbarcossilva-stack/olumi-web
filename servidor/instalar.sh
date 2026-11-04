#!/bin/bash
# Instala la web de unitytech.uy en el VPS (no toca n8n).
# Uso: curl -fsSL https://github.com/christianbarcossilva-stack/olumi-web/archive/refs/heads/main.tar.gz | tar xz -C /tmp && bash /tmp/olumi-web-main/servidor/instalar.sh
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
DIR=/opt/unitytech-web
mkdir -p $DIR
cp "$AQUI/web/docker-compose.yml" "$AQUI/web/nginx.conf" $DIR/
cp "$AQUI/actualizar.sh" /usr/local/bin/olumi-actualizar && chmod +x /usr/local/bin/olumi-actualizar
/usr/local/bin/olumi-actualizar
cd $DIR && docker compose up -d --force-recreate
sleep 4
echo "== prueba local: $(curl -s -o /dev/null -w '%{http_code}' -H 'Host: 129.121.60.208' http://127.0.0.1/olumi/) (200 = bien)"
docker ps --filter name=unitytech-web --format '{{.Names}}: {{.Status}}'
