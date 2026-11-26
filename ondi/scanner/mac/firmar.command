#!/bin/bash
# Ondi Scanner para Mac: arma la app, la firma con la cuenta de desarrollador de Apple de Unity Tech,
# la manda a revisar a Apple (notarización) y deja el zip listo para publicar en «listo».
# Se corre en la Mac, desde la Terminal:  bash "<esta carpeta>/firmar.command"
# Todo lo que pasa queda en firmar.log, al lado de este archivo.

cd "$(dirname "$0")" || exit 1
exec > >(tee firmar.log) 2>&1

EQUIPO="BK488K7F9V"          # equipo de la cuenta de desarrollador (el mismo de Olumi y Kliva)
PERFIL="ondi-notario"         # nombre con el que queda guardada la cuenta para la revisión de Apple
V="$(cat version.txt)"
F="fuente"

paso() { printf '\n\033[1m%s\033[0m\n' "$1"; }
falla() { printf '\n\033[31m%s\033[0m\n' "$1"; echo "Mandale a Claude el archivo firmar.log de esta carpeta."; exit 1; }

paso "Ondi Scanner $V · armar, firmar y certificar con Apple"

command -v swiftc >/dev/null 2>&1 || falla "Falta Xcode. Abrí Xcode una vez (acepta lo que pida) y volvé a correr esto."

# 1) el certificado «Developer ID Application» (es el que usa Apple para programas que se bajan de una página)
ID="$(security find-identity -v -p codesigning | grep "Developer ID Application" | grep "$EQUIPO" | head -1 | sed -E 's/.*"(.*)"$/\1/')"
if [ -z "$ID" ]; then
  cat <<'TXT'

Falta el certificado «Developer ID Application» en esta Mac. Se crea una sola vez:
  1. En Xcode: menú Xcode → Settings… (Configuración) → Accounts (Cuentas).
  2. Elegí tu Apple ID, el equipo de Unity Tech y tocá «Manage Certificates…».
  3. Tocá «+» abajo a la izquierda → «Developer ID Application».
     (Solo lo puede crear el titular de la cuenta de desarrollador.)
  4. Cerrá esa ventana y volvé a correr este archivo.
TXT
  open -a Xcode 2>/dev/null
  exit 1
fi
echo "Certificado: $ID"

# 2) la cuenta para la revisión automática de Apple (se guarda en el llavero, una sola vez)
if ! xcrun notarytool history --keychain-profile "$PERFIL" >/dev/null 2>&1; then
  cat <<'TXT'

Falta guardar la cuenta para la revisión de Apple (una sola vez).
Necesitás una «contraseña para apps»: entrá a account.apple.com → Inicio de sesión y seguridad →
Contraseñas para apps → «+», ponele de nombre «Ondi Scanner» y copiala.
La contraseña la escribís acá en la Terminal: no se muestra mientras la escribís y no sale de esta Mac.
TXT
  read -r -p "Tu Apple ID (el correo de la cuenta de desarrollador): " AID
  xcrun notarytool store-credentials "$PERFIL" --apple-id "$AID" --team-id "$EQUIPO" || falla "No se pudo guardar la cuenta. Revisá el correo y la contraseña para apps."
fi

# 3) armar la app (Apple y también Intel)
paso "Armando la app…"
T="$(mktemp -d)"
A="$T/Ondi Scanner.app"
mkdir -p "$A/Contents/MacOS" "$A/Contents/Resources"
swiftc -O -target arm64-apple-macos11 "$F/main.swift" -o "$T/app-arm64" || falla "No compiló (Apple)."
swiftc -O -target x86_64-apple-macos11 "$F/main.swift" -o "$T/app-x86" || falla "No compiló (Intel)."
lipo -create "$T/app-arm64" "$T/app-x86" -output "$A/Contents/MacOS/Ondi Scanner" || falla "No se pudo juntar Apple e Intel."
cp "$F/ondi-motor" "$A/Contents/MacOS/ondi-motor" && chmod 755 "$A/Contents/MacOS/ondi-motor" "$A/Contents/MacOS/Ondi Scanner"
sed "s/__VERSION__/$V/g" "$F/Info.plist" > "$A/Contents/Info.plist"
cp "$F/ondi.icns" "$A/Contents/Resources/ondi.icns"
printf 'APPL????' > "$A/Contents/PkgInfo"
xattr -cr "$A"

# 4) firmar (primero el motor, después la app)
paso "Firmando…"
codesign --force --options runtime --timestamp --sign "$ID" "$A/Contents/MacOS/ondi-motor" || falla "No se pudo firmar el motor."
codesign --force --options runtime --timestamp --entitlements "$F/permisos.entitlements" --sign "$ID" "$A" || falla "No se pudo firmar la app."
codesign --verify --deep --strict --verbose=2 "$A" || falla "La firma no quedó bien."

# 5) mandarla a Apple y esperar la respuesta (suele tardar entre 1 y 10 minutos)
paso "Mandando a revisar a Apple (puede tardar unos minutos)…"
ditto -c -k --keepParent "$A" "$T/subir.zip"
xcrun notarytool submit "$T/subir.zip" --keychain-profile "$PERFIL" --wait --output-format plist > "$T/nota.plist"
ESTADO="$(/usr/libexec/PlistBuddy -c 'Print :status' "$T/nota.plist" 2>/dev/null)"
SUB="$(/usr/libexec/PlistBuddy -c 'Print :id' "$T/nota.plist" 2>/dev/null)"
echo "Respuesta de Apple: ${ESTADO:-sin respuesta} ${SUB}"
if [ "$ESTADO" != "Accepted" ]; then
  [ -n "$SUB" ] && xcrun notarytool log "$SUB" --keychain-profile "$PERFIL"
  falla "Apple no la aprobó."
fi

# 6) pegarle el sello de Apple, comprobar y dejarla lista
paso "Sellando y comprobando…"
xcrun stapler staple "$A" || falla "No se pudo sellar."
spctl --assess --type execute -vv "$A" || falla "La Mac todavía no la acepta."
mkdir -p listo
rm -rf "listo/Ondi Scanner.app" "listo/OndiScanner-Mac.zip" "listo/OndiScanner.dmg"
ditto -c -k --keepParent "$A" "listo/OndiScanner-Mac.zip"
ditto "$A" "listo/Ondi Scanner.app"

# 7) el instalador para la gente: un .dmg que se abre y se arrastra la app a Aplicaciones
paso "Armando el instalador (.dmg)…"
D="$T/dmg"; mkdir -p "$D"
ditto "$A" "$D/Ondi Scanner.app"
ln -s /Applications "$D/Aplicaciones"
hdiutil create -volname "Ondi Scanner" -srcfolder "$D" -fs HFS+ -format UDZO -imagekey zlib-level=9 -ov "listo/OndiScanner.dmg" || falla "No se pudo armar el .dmg."
codesign --force --timestamp --sign "$ID" "listo/OndiScanner.dmg" || falla "No se pudo firmar el .dmg."
xcrun notarytool submit "listo/OndiScanner.dmg" --keychain-profile "$PERFIL" --wait --output-format plist > "$T/nota2.plist"
ESTADO="$(/usr/libexec/PlistBuddy -c 'Print :status' "$T/nota2.plist" 2>/dev/null)"
[ "$ESTADO" = "Accepted" ] || falla "Apple no aprobó el .dmg."
xcrun stapler staple "listo/OndiScanner.dmg" || falla "No se pudo sellar el .dmg."
rm -rf "$T"

paso "Listo: Ondi Scanner $V firmado y aprobado por Apple."
echo "En la carpeta «listo» está OndiScanner.dmg: mandáselo a Claude para publicarlo."
open listo
