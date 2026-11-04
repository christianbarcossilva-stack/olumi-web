#!/bin/bash
# Asistente de Christian: instala Evolution API (WhatsApp personal) al lado de n8n y deja listas las credenciales en n8n.
# Uso: curl -sL unitytech.uy/wa.sh | bash
# Queda en https://wa.unitytech.uy (hace falta el registro DNS A wa.unitytech.uy -> 129.121.60.208).
set -e
DOM=${WA_DOM:-wa.unitytech.uy}
N8N=/opt/n8n-traefik/docker-compose.yml
DIR=/opt/evolution
NET=n8n-traefik_app_network
MAIL=${MAIL_USER:-cbarcos@phi.com.uy}
MAILHOST=${MAIL_HOST:-mail.phi.com.uy}
mkdir -p $DIR; touch $DIR/.env; chmod 600 $DIR/.env
rnd(){ tr -dc 'a-z0-9' </dev/urandom | head -c ${1:-20}; }
getv(){ grep -m1 "^$1=" $DIR/.env | sed 's/^[^=]*=//'; }

# 1) Claves: se generan solas una vez y quedan en /opt/evolution/.env (no se muestran, salvo ENTRADA_KEY al final)
[ -n "$(getv AUTHENTICATION_API_KEY)" ] || echo "AUTHENTICATION_API_KEY=$(rnd 24)" >> $DIR/.env
[ -n "$(getv ENTRADA_KEY)" ] || echo "ENTRADA_KEY=$(rnd 16)" >> $DIR/.env
KEY=$(getv AUTHENTICATION_API_KEY); ENTRADA=$(getv ENTRADA_KEY)

# 1b) Contraseña del correo (para que n8n lea y mande mails). Enter para saltearlo.
if [ -z "$(getv MAIL_PASS)" ]; then
  read -r -s -p "Contraseña del correo $MAIL (no se ve mientras escribís; Enter para saltear): " MP </dev/tty; echo
  [ -n "$MP" ] && echo "MAIL_PASS=$MP" >> $DIR/.env
fi
MAILPASS=$(getv MAIL_PASS)

# 1c) Credenciales en n8n (las crea el propio n8n, cifradas con su clave)
python3 - "$KEY" "$ENTRADA" "$MAIL" "$MAILHOST" "$MAILPASS" > $DIR/creds.json <<'PY'
import json,sys
key,entrada,mail,host,mp=sys.argv[1:6]
c=[{"id":"evo","name":"evo","type":"httpHeaderAuth","data":{"name":"apikey","value":key}},
   {"id":"olumi","name":"olumi","type":"httpHeaderAuth","data":{"name":"x-entrada-key","value":entrada}}]
if mp:
  c.append({"id":"imap","name":"imap","type":"imap","data":{"user":mail,"password":mp,"host":host,"port":993,"secure":True,"allowUnauthorizedCerts":True}})
  c.append({"id":"smtp","name":"smtp","type":"smtp","data":{"user":mail,"password":mp,"host":host,"port":465,"secure":True,"disableStartTls":False}})
print(json.dumps(c))
PY
chmod 600 $DIR/creds.json
docker cp $DIR/creds.json n8n-main:/tmp/creds.json
docker exec -u root n8n-main chmod 644 /tmp/creds.json
docker exec n8n-main n8n import:credentials --input=/tmp/creds.json 2>&1 | grep -v "Error tracking\|Postgres 1" | tail -2
docker exec -u root n8n-main rm -f /tmp/creds.json || true; rm -f $DIR/creds.json
echo "== credenciales en n8n: evo, olumi$( [ -n "$MAILPASS" ] && echo ', imap, smtp' )"

# 2) Base de datos propia en el Postgres de n8n (usuario y contraseña se leen del compose de n8n, no se muestran)
DBU=$(grep -m1 DB_POSTGRESDB_USER= $N8N | sed 's/.*=//; s/[" ]//g')
DBP=$(grep -m1 DB_POSTGRESDB_PASSWORD= $N8N | sed 's/.*=//; s/[" ]//g')
DBN=$(grep -m1 DB_POSTGRESDB_DATABASE= $N8N | sed 's/.*=//; s/[" ]//g')
docker exec postgres psql -U "$DBU" -d "$DBN" -tc "select 1 from pg_database where datname='evolution'" | grep -q 1 || docker exec postgres psql -U "$DBU" -d "$DBN" -c "create database evolution"
printf "AUTHENTICATION_API_KEY=%s\nDATABASE_CONNECTION_URI=postgresql://%s:%s@postgres:5432/evolution?schema=public\n" "$KEY" "$DBU" "$DBP" > $DIR/evo.env; chmod 600 $DIR/evo.env

# 3) Compose
cat > $DIR/docker-compose.yml <<EOF
services:
  evolution:
    image: evoapicloud/evolution-api:latest
    container_name: evolution
    restart: always
    env_file: evo.env
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
docker exec evolution wget -qO- --header "apikey: $KEY" http://127.0.0.1:8080/instance/fetchInstances 2>/dev/null | grep -q '"name":"christian"' || \
docker exec evolution wget -qO- --header "apikey: $KEY" --header "Content-Type: application/json" --post-data '{"instanceName":"christian","integration":"WHATSAPP-BAILEYS","qrcode":true,"webhook":{"url":"https://n8n.unitytech.uy/webhook/wa","byEvents":false,"base64":true,"events":["MESSAGES_UPSERT"]}}' http://127.0.0.1:8080/instance/create >/dev/null 2>&1 && echo "Instancia christian creada."
echo
echo "=========================================================="
echo " FALTA UNA SOLA COSA A MANO: en Supabase → Edge Functions → Secrets"
echo "   Name:  ENTRADA_KEY"
echo "   Value: $ENTRADA"
echo "=========================================================="
echo "Clave de la API de WhatsApp (para entrar a https://$DOM/manager): $KEY"
echo "== Para conectar tu WhatsApp: abrí https://$DOM/manager, pegá esa clave, entrá a la instancia 'christian' y escaneá el QR"
echo "   desde WhatsApp → Dispositivos vinculados. Después avisale a Claude."
echo "== Certificado: puede tardar 1-2 min la primera vez. Prueba: $(curl -s -o /dev/null -w '%{http_code}' https://$DOM/ 2>/dev/null) (200 = bien, 404/000 = esperar DNS/certificado)"
