#!/bin/bash
# La web se actualiza sola cada 10 minutos desde GitHub (solo si hubo cambios).
set -e
# el que mira si hubo cambios (con la llave de solo lectura si el repositorio es privado)
cat > /usr/local/bin/olumi-revisar <<'R'
#!/bin/bash
LLAVE=/etc/olumi/github.token; A=()
[ -s "$LLAVE" ] && A=(-H "Authorization: Bearer $(cat "$LLAVE")")
N=$(curl -fsSL https://api.github.com/repos/christianbarcossilva-stack/olumi-web/commits/main -H "Accept: application/vnd.github.sha" "${A[@]}" || true)
[ -n "$N" ] && [ "$N" != "$(cat /var/www/.version 2>/dev/null)" ] && /usr/local/bin/olumi-actualizar && echo "$N" > /var/www/.version
exit 0
R
chmod 755 /usr/local/bin/olumi-revisar
cat > /etc/systemd/system/olumi-actualizar.service <<'U'
[Unit]
Description=Actualiza la web de Olumi desde GitHub
[Service]
Type=oneshot
ExecStart=/usr/local/bin/olumi-revisar
U
cat > /etc/systemd/system/olumi-actualizar.timer <<'U'
[Unit]
Description=Actualiza la web de Olumi cada 10 minutos
[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
[Install]
WantedBy=timers.target
U
systemctl daemon-reload && systemctl enable --now olumi-actualizar.timer >/dev/null 2>&1 && systemctl start olumi-actualizar.service
echo "Auto-actualización: $(systemctl is-active olumi-actualizar.timer) · versión $(cut -c1-7 /var/www/.version 2>/dev/null)"
