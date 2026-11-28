#!/bin/sh
# Arma Ondi Integrador para Windows (ícono y pedido de administrador) y Linux (amd64 y arm64).
# Uso: sh ondi/integrador/armar.sh   (deja los archivos en ondi/integrador/descargas). Usa las herramientas de ondi/scanner/armar.
set -e
cd "$(dirname "$0")"
V=$(grep -o 'VERSION = "[^"]*"' src/main.go | cut -d'"' -f2)
A=../scanner/armar; T=$(mktemp -d)
node $A/iconos.js ../icono.svg "$T" && python3 $A/iconos.py "$T"
RSRC_NOMBRE="Ondi Integrador" RSRC_DESC="Ondi Integrador: revisa los equipos del cliente y reporta a Ondi" RSRC_ADMIN=1 go run $A/rsrc/main.go "$T/ondi.ico" "$V" src/rsrc_windows_amd64.syso
mkdir -p descargas
(cd src && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o ../descargas/ondi-integrador.exe .)
rm -f src/rsrc_windows_amd64.syso
(cd src && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o ../descargas/ondi-integrador-linux . && GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o ../descargas/ondi-integrador-linux-arm64 .)
printf '{"version":"%s","fecha":"%s"}\n' "$V" "$(date +%Y-%m-%d)" > descargas/version.json
(cd descargas && sha256sum ondi-integrador.exe ondi-integrador-linux ondi-integrador-linux-arm64 > sha256.txt)
ls -la descargas; rm -rf "$T"
