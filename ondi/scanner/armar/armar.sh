#!/bin/sh
# Arma Ondi Scanner para Windows y Mac desde cualquier compu con Go, Node (Playwright) y Python (Pillow).
# Uso: sh ondi/scanner/armar/armar.sh   (deja los archivos en ondi/scanner/descargas)
set -e
cd "$(dirname "$0")/.."
V=$(grep -o 'VERSION = "[^"]*"' src/main.go | cut -d'"' -f2)
T=$(mktemp -d)
node armar/iconos.js ../icono.svg "$T" && python3 armar/iconos.py "$T"
mkdir -p descargas
go run armar/rsrc/main.go "$T/ondi.ico" "$V" src/rsrc_windows_amd64.syso
(cd src && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o ../descargas/OndiScanner.exe .)
rm -f src/rsrc_windows_amd64.syso
(cd src && GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$T/os-arm64" . && GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$T/os-amd64" .)
python3 armar/lipo.py "$T/ondi-scanner" "$T/os-arm64" "$T/os-amd64"
python3 armar/app.py "$T/ondi-scanner" "$T/ondi.icns" "$V" descargas/OndiScanner-Mac.zip
printf '{"version":"%s","fecha":"%s"}\n' "$V" "$(date +%Y-%m-%d)" > descargas/version.json
ls -la descargas
rm -rf "$T"
