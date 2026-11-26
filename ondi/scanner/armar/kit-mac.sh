#!/bin/sh
# Arma el paquete para firmar Ondi Scanner en una Mac (motor universal + fuente de la app + firmar.command).
# Uso: sh ondi/scanner/armar/kit-mac.sh <carpeta de salida>   → deja OndiScanner-armar-Mac.zip
set -e
cd "$(dirname "$0")/.."
SAL="$(cd "$1" && pwd)"
V=$(grep -o 'VERSION = "[^"]*"' src/main.go | cut -d'"' -f2)
T=$(mktemp -d); K="$T/Ondi Scanner - firmar en la Mac"; mkdir -p "$K/fuente"
node armar/iconos.js ../icono.svg "$T" && python3 armar/iconos.py "$T"
(cd src && GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$T/m-arm64" . && GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$T/m-amd64" .)
python3 armar/lipo.py "$K/fuente/ondi-motor" "$T/m-arm64" "$T/m-amd64"
cp mac/main.swift mac/Info.plist mac/permisos.entitlements "$K/fuente/" && cp "$T/ondi.icns" "$K/fuente/"
cp mac/firmar.command "$K/" && printf '%s\n' "$V" > "$K/version.txt"
(cd "$T" && python3 - "$SAL/OndiScanner-armar-Mac.zip" "Ondi Scanner - firmar en la Mac" <<'PY'
import sys, os, zipfile, time
out, raiz = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9)
for d, _, fs in os.walk(raiz):
    for f in sorted(fs):
        p = os.path.join(d, f); i = zipfile.ZipInfo(p, time.localtime()[:6]); i.create_system = 3
        i.external_attr = (0o100755 if f in ('ondi-motor', 'firmar.command') else 0o100644) << 16; i.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(i, open(p, 'rb').read())
z.close(); print(out)
PY
)
rm -rf "$T"
