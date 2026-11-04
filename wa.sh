#!/bin/bash
# WhatsApp personal para n8n (Evolution API). Uso: curl -sL unitytech.uy/wa.sh | bash
set -e
rm -rf /tmp/olumi-web-main
curl -fsSL https://github.com/christianbarcossilva-stack/olumi-web/archive/refs/heads/main.tar.gz | tar xz -C /tmp
bash /tmp/olumi-web-main/servidor/whatsapp.sh
