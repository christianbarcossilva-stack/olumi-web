#!/bin/bash
# n8n en https://n8n.unitytech.uy (con certificado) y sin acceso por http sin cifrar.
set -e
D=/opt/n8n-traefik; F=$D/docker-compose.yml
[ -f $F.respaldo ] || cp $F $F.respaldo
sed -i 's/n8n\.vpsuy-2078678\.vpshostgator\.com/n8n.unitytech.uy/g; s/N8N_SECURE_COOKIE=false/N8N_SECURE_COOKIE=true/' $F
if ! grep -q 'n8n-a-https' $F; then
python3 - "$F" <<'PY'
import sys, re
p = sys.argv[1]; lines = open(p).read().split('\n'); out = []
extra = [
  'traefik.http.routers.n8n-ip.middlewares=n8n-a-https',
  'traefik.http.middlewares.n8n-a-https.redirectregex.regex=^http://[^/]+/(.*)',
  'traefik.http.middlewares.n8n-a-https.redirectregex.replacement=https://n8n.unitytech.uy/$${1}',
  'traefik.http.middlewares.n8n-a-https.redirectregex.permanent=true',
  'traefik.http.routers.n8n-http.rule=Host(`n8n.unitytech.uy`)',
  'traefik.http.routers.n8n-http.entrypoints=web',
  'traefik.http.routers.n8n-http.middlewares=n8n-a-https',
]
for l in lines:
    out.append(l)
    if 'n8n-ip.priority=' in l:
        ind = re.match(r'^\s*', l).group(0)
        out += [f'{ind}- "{e}"' for e in extra]
open(p, 'w').write('\n'.join(out))
PY
fi
cd $D && docker compose config -q && docker compose up -d 2>&1 | tail -4
echo "Esperando el certificado..."; sleep 45
echo "== https://n8n.unitytech.uy: $(curl -s -o /dev/null -w '%{http_code}' https://n8n.unitytech.uy/) (200 = bien)"
echo "== http por IP: $(curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' http://129.121.60.208/)"
