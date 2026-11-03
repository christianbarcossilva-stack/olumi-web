#!/bin/bash
# La web se actualiza sola cada 10 minutos desde GitHub (solo si hubo cambios).
set -e
cat > /etc/systemd/system/olumi-actualizar.service <<'U'
[Unit]
Description=Actualiza la web de Olumi desde GitHub
[Service]
Type=oneshot
ExecStart=/bin/bash -c 'N=$(curl -fsSL https://api.github.com/repos/christianbarcossilva-stack/olumi-web/commits/main -H "Accept: application/vnd.github.sha" || true); [ -n "$N" ] && [ "$N" != "$(cat /var/www/.version 2>/dev/null)" ] && /usr/local/bin/olumi-actualizar && echo "$N" > /var/www/.version || true'
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
