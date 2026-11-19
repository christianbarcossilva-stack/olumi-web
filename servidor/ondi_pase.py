#!/usr/bin/env python3
"""Pase de Ondi: arma la app oficial (/ondi/app/) a partir de la beta (/ondi/beta/).

Uso, desde la raíz del repositorio:  python3 servidor/ondi_pase.py N     (N = número nuevo de la caché, por ejemplo 4)
Solo con el «sí, pasalo» de Christian. Cambia lo que distingue a la app de la beta: cabecera de app instalable, sin el cartel de prueba,
el motor oficial (/motor/) en vez del beta y el guardado sin señal (sw.js). No se edita /ondi/app/index.html a mano.
"""
import sys, re, json, datetime, pathlib, shutil
R = pathlib.Path(__file__).resolve().parent.parent / 'ondi'
n = int(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
s = (R / 'beta/index.html').read_text(encoding='utf8')
def rep(a, b):
    global s
    if s.count(a) != 1: sys.exit('No encontré una sola vez: ' + a[:70])
    s = s.replace(a, b)
rep('<meta name="robots" content="noindex">\n', '')
rep('<title>Ondi · versión de prueba</title>', '<meta name="description" content="Ondi by Unity Tech: monitoreo multicliente de redes, cámaras y sensores, con la maqueta 3D de cada predio.">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Ondi">\n<link rel="manifest" href="manifest.webmanifest">\n<title>Ondi</title>')
rep('href="../app/icono-192.png"', 'href="icono-192.png"'); rep('href="../app/icono-180.png"', 'href="icono-180.png"')
s, k = re.subn(r'<div class="beta">.*?</div>\n', '', s, count=1)
if k != 1: sys.exit('No encontré el cartel de prueba')
m = re.search(r"const MOTOR = '\.\./\.\./motor/beta/\?app=ondi&v=(\d+)'", s)
if not m: sys.exit('No encontré la ruta del motor')
s = s.replace(m.group(0), "const MOTOR = '../../motor/?app=ondi&v=" + m.group(1) + "'")
rep('</body>', "<script>if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});</script>\n</body>")
if '/beta/' in s.replace('../../olumi/beta/', ''): sys.exit('Quedó una ruta a una beta')
(R / 'app/index.html').write_text(s, encoding='utf8')
shutil.copyfile(R / 'beta/red.js', R / 'app/red.js')
sw = (R / 'app/sw.js').read_text(encoding='utf8'); sw, k = re.subn(r"const CACHE = 'ondi-app-v\d+'", "const CACHE = 'ondi-app-v%d'" % n, sw)
if k != 1: sys.exit('No encontré la caché en sw.js')
(R / 'app/sw.js').write_text(sw, encoding='utf8')
(R / 'app/version.json').write_text(json.dumps({'fecha': datetime.date.today().isoformat(), 'cache': 'ondi-app-v%d' % n}) + '\n', encoding='utf8')
print('Ondi oficial armada desde la beta · caché ondi-app-v%d · motor v%s' % (n, m.group(1)))
