#!/bin/bash
# Olumi · instala o actualiza la web en el servidor. Uso: curl -sL unitytech.uy/i.sh | bash
set -e
rm -rf /tmp/olumi-web-main
curl -fsSL https://github.com/christianbarcossilva-stack/olumi-web/archive/refs/heads/main.tar.gz | tar xz -C /tmp
bash /tmp/olumi-web-main/servidor/instalar.sh
