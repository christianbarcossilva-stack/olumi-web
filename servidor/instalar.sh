#!/bin/bash
# Instala la web de unitytech.uy en el VPS (no toca n8n).
set -e
DIR=/opt/unitytech-web
REPO=https://raw.githubusercontent.com/christianbarcossilva-stack/olumi-web/main/servidor
mkdir -p $DIR
curl -fsSL $REPO/web/docker-compose.yml -o $DIR/docker-compose.yml
curl -fsSL $REPO/web/nginx.conf -o $DIR/nginx.conf
curl -fsSL $REPO/actualizar.sh -o /usr/local/bin/olumi-actualizar && chmod +x /usr/local/bin/olumi-actualizar
/usr/local/bin/olumi-actualizar
cd $DIR && docker compose up -d
sleep 3
echo "== prueba local: $(curl -s -o /dev/null -w '%{http_code}' -H 'Host: 129.121.60.208' http://127.0.0.1/olumi/) (200 = bien)"
docker ps --filter name=unitytech-web --format '{{.Names}}: {{.Status}}'
