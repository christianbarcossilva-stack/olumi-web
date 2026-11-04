#!/bin/bash
# WhatsApp personal para n8n: instala Evolution API en el VPS, al lado de n8n (misma red, mismo Postgres y Redis).
# Uso: curl -sL unitytech.uy/wa.sh | bash
# Queda en https://wa.unitytech.uy (hace falta el registro DNS A wa.unitytech.uy -> 129.121.60.208).
set -e
DOM=${WA_DOM:-wa.unitytech.uy}
N8N=/opt/n8n-traefik/docker-compose.yml
DIR=/opt/evolution
NET=n8n-traefik_app_network
mkdir -p $DIR

# 1) Clave de la API: la elegís vos (la misma la ponés después en n8n). No se imprime.
if [ -f $DIR/.env ] && grep -q AUTHENTICATION_API_KEY $DIR/.env; then
  echo "Ya hay una clave guardada en $DIR/.env (se mantiene)."
else
  read -r -s -p "Elegí una clave para la API de WhatsApp (mínimo 12 letras/números, sin espacios) y Enter: " KEY </dev/tty; echo
  [ ${#KEY} -ge 12 ] || { echo "Muy corta. Volvé a correr el comando."; exit 1; }
  echo "AUTHENTICATION_API_KEY=$KEY" > $DIR/.env
fi
chmod 600 $DIR/.env

# 2) Base de datos propia en el Postgres de n8n (usuario y contraseña se leen del compose de n8n, no se muestran)
DBU=$(grep -m1 DB_POSTGRESDB_USER= $N8N | sed 's/.*=//; s/[" ]//g')
DBP=$(grep -m1 DB_POSTGRESDB_PASSWORD= $N8N | sed 's/.*=//; s/[" ]//g')
DBN=$(grep -m1 DB_POSTGRESDB_DATABASE= $N8N | sed 's/.*=//; s/[" ]//g')
docker exec postgres psql -U "$DBU" -d "$DBN" -tc "select 1 from pg_database where datname='evolution'" | grep -q 1 || docker exec postgres psql -U "$DBU" -d "$DBN" -c "create database evolution"
grep -q DATABASE_CONNECTION_URI $DIR/.env || echo "DATABASE_CONNECTION_URI=postgresql://$DBU:$DBP@postgres:5432/evolution?schema=public" >> $DIR/.env

# 3) Compose
cat > $DIR/docker-compose.yml <<EOF
services:
  evolution:
    image: evoapicloud/evolution-api:latest
    container_name: evolution
    restart: always
    env_file: .env
    environment:
      - SERVER_URL=https://$DOM
      - LANGUAGE=es
      - DEL_INSTANCE=false
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_CLIENT_NAME=evolution
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=false
      - DATABASE_SAVE_MESSAGE_UPDATE=false
      - DATABASE_SAVE_DATA_CONTACTS=false
      - DATABASE_SAVE_DATA_CHATS=false
      - DATABASE_SAVE_DATA_LABELS=false
      - DATABASE_SAVE_DATA_HISTORIC=false
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379/6
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_REDIS_SAVE_INSTANCES=false
      - CACHE_LOCAL_ENABLED=false
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false
      - QRCODE_LIMIT=30
      - CONFIG_SESSION_PHONE_CLIENT=Olumi
      - CONFIG_SESSION_PHONE_NAME=Chrome
      - WEBHOOK_GLOBAL_ENABLED=false
      - LOG_LEVEL=ERROR,WARN
      - TZ=America/Montevideo
    volumes:
      - evolution_instances:/evolution/instances
    networks:
      - app_network
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=$NET"
      - "traefik.http.routers.wa.rule=Host(\`$DOM\`)"
      - "traefik.http.routers.wa.entrypoints=websecure"
      - "traefik.http.routers.wa.tls.certresolver=le"
      - "traefik.http.services.wa.loadbalancer.server.port=8080"
      - "traefik.http.routers.wa-http.rule=Host(\`$DOM\`)"
      - "traefik.http.routers.wa-http.entrypoints=web"
      - "traefik.http.routers.wa-http.middlewares=wa-a-https"
      - "traefik.http.middlewares.wa-a-https.redirectscheme.scheme=https"
      - "traefik.http.middlewares.wa-a-https.redirectscheme.permanent=true"
volumes:
  evolution_instances:
networks:
  app_network:
    external: true
    name: $NET
EOF

cd $DIR && docker compose up -d --remove-orphans 2>&1 | tail -3
echo "Esperando que arranque..."; for i in $(seq 1 30); do sleep 3; docker exec evolution wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 && break; done
echo "== evolution: $(docker ps --filter name=evolution --format '{{.Status}}')"

# 4) Instancia "christian" con webhook a n8n (crea el ticket en Olumi y maneja los mails por audio)
KEY=$(grep AUTHENTICATION_API_KEY $DIR/.env | sed 's/.*=//')
docker exec evolution wget -qO- --header "apikey: $KEY" http://127.0.0.1:8080/instance/fetchInstances 2>/dev/null | grep -q '"name":"christian"' || \
docker exec evolution wget -qO- --header "apikey: $KEY" --header "Content-Type: application/json" --post-data '{"instanceName":"christian","integration":"WHATSAPP-BAILEYS","qrcode":true,"webhook":{"url":"https://n8n.unitytech.uy/webhook/wa","byEvents":false,"base64":true,"events":["MESSAGES_UPSERT"]}}' http://127.0.0.1:8080/instance/create >/dev/null 2>&1 && echo "Instancia christian creada."
echo
echo "== Listo. Para conectar tu WhatsApp:"
echo "   1) Abrí https://$DOM/manager  (usuario: cualquiera, contraseña: la clave que elegiste)"
echo "   2) Entrá a la instancia 'christian' y escaneá el QR desde WhatsApp → Dispositivos vinculados."
echo "== Certificado: puede tardar 1-2 min la primera vez. Prueba: $(curl -s -o /dev/null -w '%{http_code}' https://$DOM/ 2>/dev/null) (200 = bien, 404/000 = esperar DNS/certificado)"
