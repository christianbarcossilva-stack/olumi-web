#!/usr/bin/env python3
"""Arma la web de Ondi v7 (el camino de una alerta, como la v7 de Olumi) a partir de la página pública de hoy (ondi/index.html) y de las piezas de esta carpeta.
Christian 26/11 08:12: «hay que actualizar la web como la de olumi».
uso: construir.py SALIDA [previa]   · con «previa» sale sin indexar y con la chapita «Vista previa» (para /nuevo/ondi/)
Piezas: historia.html (la historia sobre el motor), cierre.html, v7.css, v7.js. Lo demás (conexiones, marcas, funciones, planes, descargas, preguntas) sale de la página de hoy."""
import os, re, sys, shutil, subprocess, tempfile
AQUI = os.path.dirname(os.path.abspath(__file__)); rd = lambda n: open(os.path.join(AQUI, n), encoding='utf-8').read()
WEB = os.environ.get('WEB', os.path.abspath(os.path.join(AQUI, '..', '..', '..'))); BASE = os.environ.get('BASE', os.path.join(WEB, 'ondi', 'index.html'))
s = open(BASE, encoding='utf-8').read(); previa = len(sys.argv) > 2 and sys.argv[2] == 'previa'
if 'Ondi web v7' in s and 'BASE' not in os.environ: s = rd('base-v6.html')   # la pública ya es la v7: se parte de la copia de la anterior que quedó acá
assert 'Ondi web v7' not in s, 'la base ya es la v7: usar BASE=<copia de la anterior>'
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:100]); s = s.replace(a, b)
# cabeza: la página sabe que hay guion (lo que aterriza arranca escondido solo si el guion corre; si a los 5 s no corrió, se muestra todo)
rep('<meta name="viewport"', "<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.__ondiOk)document.documentElement.classList.remove('js')},5000)</script>\n<meta name=\"viewport\"")
if previa: rep('<link rel="canonical" href="https://unitytech.uy/ondi/">', '<meta name="robots" content="noindex">\n<link rel="canonical" href="https://unitytech.uy/ondi/">')
rep('/* Ondi · la red como la ve quien la cableó.', '/* Ondi web v7 (26/11): la historia sobre el motor común (ver el bloque v7 al final).\n   Ondi · la red como la ve quien la cableó.')
css = rd('v7.css').strip()
if previa: css += '\n.vprev{position:fixed;left:24px;bottom:calc(26px + env(safe-area-inset-bottom,0px));z-index:30;margin:0;padding:8px 13px;border-radius:4px;font:500 12.5px/1 var(--fm);color:var(--ti2);background:var(--vidrio);box-shadow:0 0 0 1px var(--li);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);pointer-events:none}@media (max-width:900px){.vprev{bottom:calc(10px + env(safe-area-inset-bottom,0px));left:16px;font-size:10.5px;padding:5px 9px}}'
rep('</style>', css + '\n</style>')
# la historia
a = s.index('<section class="cine" id="cine"'); b = s.index('<section class="bloque" id="conexiones">'); s = s[:a] + rd('historia.html').strip() + '\n\n' + s[b:]
# lo que aterriza
s, n = re.subn(r'<div class="cab">', '<div class="cab" data-a>', s); assert n == 6, n
rep('<div class="rackvivo" id="rackvivo"></div>', '<div class="rackvivo" id="rackvivo" data-a="solo"></div>')
rep('<ul class="func">', '<ul class="func" data-a>')
rep('<div class="planes">', '<div class="planes" data-a>')
rep('<div class="tres">', '<div class="tres" data-a>')
rep('<div class="faq">', '<div class="faq" data-a>')
# el cierre
a = s.index('<section class="cierre">'); b = s.index('</section>', a) + 10; s = s[:a] + rd('cierre.html').strip() + s[b:]
if previa: rep('<footer>', '<p class="vprev" aria-hidden="true">Vista previa · todavía no es la página pública</p>\n<footer>')
# el guion de siempre pierde lo de la maqueta vieja (la historia la lleva v7.js)
a = s.index('/* la historia: el scroll mueve la cámara de la maqueta */'); b = s.index('var tabs = ', a); s = s[:a] + s[b:]
rep(" enviar({ tema: temaMaq() }); }", " }")
rep('ajustar(); upd(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar); setTimeout(upd, 1500); pintaTema();', 'pintaTema();')
# el guion nuevo se revisa antes de armar (un «//» en el medio de un renglón ya se comió el resto una vez)
js = rd('v7.js').strip(); assert js.endswith('})();')
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t: t.write(js)
    r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True); os.unlink(t.name)
    assert r.returncode == 0, 'v7.js no pasa la revisión:\n' + r.stderr[:600]
rep("import('./rack3d.js?v=1')", "import('/ondi/rack3d.js?v=1')")   # la vista previa vive en /nuevo/ondi/: el rack 3D de la tapa va con su ruta entera
rep('</body>', '<script>\n' + js[:-5] + '  window.__ondiOk=1;\n})();\n</script>\n</body>')
tmp = sys.argv[1] + '.tmp'; os.makedirs(os.path.dirname(os.path.abspath(sys.argv[1])), exist_ok=True); open(tmp, 'w', encoding='utf-8').write(s); os.replace(tmp, sys.argv[1])
print('v7 armada en', sys.argv[1], len(s), 'bytes', '(vista previa)' if previa else '')
