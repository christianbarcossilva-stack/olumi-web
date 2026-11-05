#!/bin/bash
# Ondi escritorio · arma Ondi-Windows.zip, Ondi-Mac.zip y Ondi-Mac-Intel.zip a partir de Electron (sin npm).
# Uso: bash escritorio/empaquetar.sh   (deja los zip en escritorio/build/)
set -e
V=v38.3.0; H=$(cd "$(dirname "$0")" && pwd); D=$H/dl; B=$H/build; mkdir -p $D $B
for a in win32-x64 darwin-arm64 darwin-x64; do [ -f $D/electron-$a.zip ] || curl -sSL -o $D/electron-$a.zip https://github.com/electron/electron/releases/download/$V/electron-$V-$a.zip; done
rm -rf $B/Ondi-*; cd $B
unzip -q $D/electron-win32-x64.zip -d Ondi-Windows && mv Ondi-Windows/electron.exe Ondi-Windows/Ondi.exe && rm -f Ondi-Windows/resources/default_app.asar && cp -r $H/app Ondi-Windows/resources/app
(cd Ondi-Windows/locales && ls | grep -v -E '^(es|es-419|en-US|en-GB)\.pak$' | xargs rm -f)
for a in arm64 x64; do n=Ondi-Mac; [ $a = x64 ] && n=Ondi-Mac-Intel; mkdir $n; unzip -q $D/electron-darwin-$a.zip -d $n
  (cd $n && mv Electron.app Ondi.app && rm -f LICENSE LICENSES.chromium.html version && cd Ondi.app/Contents && mv MacOS/Electron MacOS/Ondi && rm -f Resources/default_app.asar Resources/electron.icns && cp -r $H/app Resources/app && cp $H/ondi.icns Resources/ && python3 - <<'PY'
import plistlib;p='Info.plist';d=plistlib.load(open(p,'rb'))
d.update({'CFBundleName':'Ondi','CFBundleDisplayName':'Ondi','CFBundleIdentifier':'uy.unitytech.ondi','CFBundleExecutable':'Ondi','CFBundleIconFile':'ondi.icns','CFBundleShortVersionString':'0.1.0','CFBundleVersion':'0.1.0','NSHumanReadableCopyright':'© 2026 Unity Tech','LSApplicationCategoryType':'public.app-category.business'});d.pop('CFBundleURLTypes',None);plistlib.dump(d,open(p,'wb'))
PY
  ); cp "$H/Instalar Ondi.command" $n/; done
cp $H/LEEME-windows.txt Ondi-Windows/LEEME.txt
zip -qr9 Ondi-Windows.zip Ondi-Windows; zip -qry9 Ondi-Mac.zip Ondi-Mac; zip -qry9 Ondi-Mac-Intel.zip Ondi-Mac-Intel; ls -la *.zip
