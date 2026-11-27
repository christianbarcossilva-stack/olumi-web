#!/bin/bash
# Instala o actualiza el motor de automatización en el VPS, al lado de n8n y Evolution (n8n no se toca).
# Uso (en el servidor, como root): curl -fsSL https://raw.githubusercontent.com/christianbarcossilva-stack/olumi-web/main/servidor/automatizacion/instalar.sh | bash
# La primera vez pide UNA sola cosa: la clave secreta de Supabase (no se ve mientras se pega).
set -e
DIR=/opt/automatizacion; ORG_PHITEL=2c84e6c2-5507-4aa6-9f6d-3b66060739c3
mkdir -p $DIR; cd $DIR; touch .env; chmod 600 .env
getv(){ grep -m1 "^$1=" "$2" 2>/dev/null | sed 's/^[^=]*=//'; }

# 1) Código: la última versión del repositorio público, se reemplaza en cada corrida
NUEVO=$(mktemp -d -p $DIR .codigo-XXXX)
curl -fsSL https://github.com/christianbarcossilva-stack/olumi-web/archive/refs/heads/main.tar.gz | tar xz -C "$NUEVO" --strip-components=1
chmod -R a+rX "$NUEVO"; rm -rf codigo; mv "$NUEVO" codigo
cp codigo/servidor/automatizacion/docker-compose.yml .

# 2) Llaves (se generan o se piden una sola vez)
[ -n "$(getv MOTOR_LLAVE .env)" ] || echo "MOTOR_LLAVE=$(openssl rand -hex 32)" >> .env
[ -n "$(getv SUPABASE_URL .env)" ] || echo "SUPABASE_URL=https://pgriavmcmscchxdnfglv.supabase.co" >> .env
if [ -z "$(getv SUPABASE_SERVICE_KEY .env)" ]; then
  read -r -s -p "Pegá la clave secreta de Supabase (Settings → API Keys → Secret keys) y Enter: " SK </dev/tty; echo
  [ ${#SK} -ge 30 ] || { echo "Esa clave es muy corta. Volvé a correr el instalador."; exit 1; }
  echo "SUPABASE_SERVICE_KEY=$SK" >> .env
fi

# 3) Levantar
docker compose up -d --force-recreate --remove-orphans 2>&1 | tail -2
for i in $(seq 1 20); do sleep 2; docker exec motor wget -qO- http://127.0.0.1:8080/salud >/dev/null 2>&1 && break; done
echo "== motor: $(docker ps --filter name=motor --format '{{.Status}}')"

# 4) Claves de Phitel, sacadas de lo que ya está en el servidor (cifradas al guardarse; no se muestran)
clave(){ if [ -n "$2" ]; then printf '%s' "$2" | docker exec -i motor node motor.mjs clave $ORG_PHITEL "$1" >/dev/null && echo "   clave $1: ok"; else echo "   clave $1: no encontrada, cargarla a mano"; fi; }
clave evolution "$(getv AUTHENTICATION_API_KEY /opt/evolution/.env)"
clave entrada "$(getv ENTRADA_KEY /opt/evolution/.env)"
docker exec n8n-main sh -c 'n8n export:credentials --all --decrypted --output=/tmp/c.json >/dev/null 2>&1'
GROQ=$(docker exec n8n-main sh -c 'cat /tmp/c.json; rm -f /tmp/c.json' | python3 -c "import json,sys; print(next((c['data'].get('apiKey','') for c in json.load(sys.stdin) if c['type']=='groqApi'),''))" 2>/dev/null)
clave groq "$GROQ"; unset GROQ
echo "== Listo. Gemini queda sin cargar hasta tener una clave nueva (la de n8n está rota desde el 6/11): todo va por Groq."
