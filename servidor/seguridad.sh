#!/bin/bash
# Seguridad básica del VPS: bloqueo de intentos de entrada, actualizaciones de seguridad automáticas.
set -e
echo "== 1. fail2ban (bloquea por 1 hora a quien falle 5 veces la contraseña de SSH)"
dnf -y -q install epel-release >/dev/null
dnf -y -q install fail2ban-server fail2ban-systemd >/dev/null
cat > /etc/fail2ban/jail.d/olumi.local <<'J'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd
banaction = nftables-multiport
banaction_allports = nftables-allports

[sshd]
enabled = true
port = 22022
J
systemctl enable --now fail2ban >/dev/null 2>&1; systemctl restart fail2ban; sleep 2
fail2ban-client status sshd | sed -n '1,8p'

echo "== 2. Actualizaciones de seguridad automáticas (todos los días)"
dnf -y -q install dnf-automatic >/dev/null
sed -i 's/^upgrade_type *=.*/upgrade_type = security/; s/^apply_updates *=.*/apply_updates = yes/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer >/dev/null 2>&1
systemctl is-active dnf-automatic.timer

echo "== 3. SSH: menos intentos por conexión"
if ! grep -q '^MaxAuthTries' /etc/ssh/sshd_config; then echo 'MaxAuthTries 3' >> /etc/ssh/sshd_config; fi
sshd -t && systemctl reload sshd && echo "sshd ok"

echo "== 4. Puertos abiertos a internet"
ss -ltnp | awk 'NR>1{split($4,a,":");p=a[length(a)];if(!(p in v)){v[p]=1;print "  "p}}' | sort -n | tr '\n' ' '; echo
echo "Listo."
