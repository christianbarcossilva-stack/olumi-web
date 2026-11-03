#!/bin/bash
# Muestra cómo está armado el servidor (no cambia nada).
echo "== sistema: $(. /etc/os-release; echo $PRETTY_NAME) $(uname -m)"
echo "== puertos abiertos:"
ss -ltnp 2>/dev/null | awk 'NR>1{split($4,a,":");p=a[length(a)];if(!(p in v)){v[p]=1;match($0,/users:\(\("[^"]+"/);u=substr($0,RSTART+9,RLENGTH-9);printf "  %s %s\n",p,u}}' | sort -n | head -20
echo "== servicios web:"
for s in nginx httpd caddy traefik docker; do systemctl is-active --quiet $s 2>/dev/null && echo "  $s: activo"; done
command -v docker >/dev/null && { echo "== contenedores:"; docker ps --format '  {{.Names}} | {{.Image}} | {{.Ports}}' 2>/dev/null | cut -c1-110; }
echo "== firewall: $(firewall-cmd --list-services 2>/dev/null || echo 'sin firewalld')"
echo "== n8n: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5678/ 2>/dev/null)"
