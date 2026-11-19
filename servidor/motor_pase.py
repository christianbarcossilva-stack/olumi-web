#!/usr/bin/env python3
"""Pase del motor común: copia /motor/beta/ a /motor/ (la versión oficial) arreglando las rutas.

Uso, desde la raíz del repositorio:  python3 servidor/motor_pase.py
- La beta sigue en /motor/beta/ (lo nuevo se prueba ahí). Los archivos compartidos (texturas.js, plano.js, avatar.js) viven en /motor/.
- La versión oficial anterior queda archivada en /motor/archivo/<fecha>/.
"""
import re, sys, pathlib
R = pathlib.Path(__file__).resolve().parent.parent / 'motor'
B = R / 'beta'
CAMBIOS = [("'../texturas.js", "'./texturas.js"), ("'../plano.js", "'./plano.js"), ("'../avatar.js", "'./avatar.js"),
           ('../../olumi/beta/', '../olumi/beta/'), ("'../escenas/'", "'escenas/'")]
n = 0
for f in sorted(B.iterdir()):
    if f.suffix not in ('.js', '.html', '.css'): continue
    t = f.read_text(encoding='utf8')
    for a, b in CAMBIOS: t = t.replace(a, b)
    if f.name == 'index.html':
        t = t.replace('<title>Maqueta · motor común (beta)</title>', '<title>Maqueta · motor común</title>')
        t = t.replace('// Maqueta con el motor común, versión beta (lo nuevo se prueba acá antes de pasar a /motor/).', '// Maqueta con el motor común, versión oficial (sale de /motor/beta/ con servidor/motor_pase.py; no se edita a mano).')
    if re.search(r"""['"(]\.\./(?!olumi/)""", t): sys.exit('Quedó una ruta hacia arriba sin arreglar en ' + f.name)
    (R / f.name).write_text(t, encoding='utf8'); n += 1
print(n, 'archivos pasados de /motor/beta/ a /motor/')
