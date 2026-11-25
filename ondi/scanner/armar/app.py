# arma «Ondi Scanner.app» y lo comprime en un zip que conserva el permiso de ejecutar
import sys, zipfile, time
bin_, icns, version, salida = sys.argv[1:5]
plist = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Ondi Scanner</string><key>CFBundleDisplayName</key><string>Ondi Scanner</string>
<key>CFBundleIdentifier</key><string>uy.unitytech.ondiscanner</string><key>CFBundleVersion</key><string>{version}</string><key>CFBundleShortVersionString</key><string>{version}</string>
<key>CFBundleExecutable</key><string>ondi-scanner</string><key>CFBundleIconFile</key><string>ondi</string><key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>11.0</string><key>LSUIElement</key><true/><key>NSHumanReadableCopyright</key><string>© Unity Tech</string>
</dict></plist>'''
z = zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED, compresslevel=9)
def pon(nombre, datos, modo):
    i = zipfile.ZipInfo(nombre, time.localtime()[:6]); i.external_attr = (modo << 16); i.create_system = 3; i.compress_type = zipfile.ZIP_DEFLATED; z.writestr(i, datos)
for d in ('Ondi Scanner.app/', 'Ondi Scanner.app/Contents/', 'Ondi Scanner.app/Contents/MacOS/', 'Ondi Scanner.app/Contents/Resources/'):
    i = zipfile.ZipInfo(d, time.localtime()[:6]); i.external_attr = (0o40755 << 16) | 0x10; i.create_system = 3; z.writestr(i, b'')
pon('Ondi Scanner.app/Contents/Info.plist', plist.encode(), 0o100644)
pon('Ondi Scanner.app/Contents/PkgInfo', b'APPL????', 0o100644)
pon('Ondi Scanner.app/Contents/MacOS/ondi-scanner', open(bin_, 'rb').read(), 0o100755)
pon('Ondi Scanner.app/Contents/Resources/ondi.icns', open(icns, 'rb').read(), 0o100644)
z.close(); print(salida)
