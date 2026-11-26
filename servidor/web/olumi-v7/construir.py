#!/usr/bin/env python3
"""Arma la web de Olumi v7 (el camino del pedido y las animaciones nuevas) a partir de la página pública de hoy (olumi/index.html, v6) y de las piezas de esta carpeta.
Christian 26/11 00:19: «hay que mejorar la web, que el camino sea mejor y nuevas animaciones para que impacte más».
uso: construir.py SALIDA [previa]   · con «previa» sale sin indexar y con la chapita «Vista previa» (para /nuevo/olumi/)
Piezas: historia.html (la historia con la maqueta), cierre.html (el cierre), v7.css, v7.js. Todo lo demás sale de la v6 tal cual (textos, planes, preguntas)."""
import os, re, sys
AQUI = os.path.dirname(os.path.abspath(__file__)); rd = lambda n: open(os.path.join(AQUI, n), encoding='utf-8').read()
WEB = os.environ.get('WEB', os.path.abspath(os.path.join(AQUI, '..', '..', '..'))); BASE = os.environ.get('BASE', os.path.join(WEB, 'olumi', 'index.html'))   # la web es este mismo repositorio
s = open(BASE, encoding='utf-8').read(); previa = len(sys.argv) > 2 and sys.argv[2] == 'previa'
if 'Olumi web v7' in s and 'BASE' not in os.environ: s = rd('base-v6.html')   # la pública ya es la v7: se parte de la copia de la v6 que quedó guardada acá
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:100]); s = s.replace(a, b)
assert 'Olumi web v7' not in s, 'la base ya es la v7: usar BASE=<copia de la v6>'
# cabeza: la página sabe que hay guion (lo que aterriza arranca escondido solo si el guion corre; si a los 5 s no corrió, se muestra todo)
rep("<meta name=\"viewport\"", "<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.__olumiOk)document.documentElement.classList.remove('js')},5000)</script>\n<meta name=\"viewport\"")
if previa: rep('<link rel="canonical" href="https://unitytech.uy/olumi/">', '<meta name="robots" content="noindex">\n<link rel="canonical" href="https://unitytech.uy/olumi/">')
rep("/* Olumi web v6 (pública desde el 23/11; vista previa del 22/11)", "/* Olumi web v7 (26/11): el camino del pedido en la maqueta, la cámara con pausas, las horas que funden y lo demás que aterriza (ver el bloque v7 al final).\n   Olumi web v6 (pública desde el 23/11; vista previa del 22/11)")
rep('.vprev{position:fixed;', rd('v7.css').strip() + '\n.vprev{position:fixed;')
if previa: rep('</style>', 'p.vprev.gl{left:24px;transform:none}@media (max-width:860px){p.vprev.gl{position:absolute;top:calc(84px + env(safe-area-inset-top,0px));bottom:auto;left:16px;font-size:11.5px;padding:6px 11px}}\n</style>')   # la chapita de vista previa, a la izquierda: abajo a la derecha va el riel del día
# la historia
a = s.index('<section class="cine" id="cine"'); b = s.index('<section id="crm" class="crm">'); s = s[:a] + rd('historia.html').strip() + '\n\n' + s[b:]
# lo que aterriza: cabezas de sección, grillas, capturas
s, n = re.subn(r'<div class="head">', '<div class="head" data-a>', s); assert n == 6, n
rep('<div class="grid">\n    <article class="big gl">', '<div class="grid" data-a>\n    <article class="big gl">')
rep('<img src="/olumi/img/escritorio-crm.webp" data-claro="/olumi/img/escritorio-crm-claro.webp" width="1280" height="800" loading="lazy" alt="El CRM en tablero: oportunidades con número, servicio, prioridad, cliente, obra, monto y próxima actividad, en columnas por etapa">',
    '<span class="shot"><img src="/olumi/img/escritorio-crm.webp" data-claro="/olumi/img/escritorio-crm-claro.webp" width="1280" height="800" loading="lazy" alt="El CRM en tablero: oportunidades con número, servicio, prioridad, cliente, obra, monto y próxima actividad, en columnas por etapa"></span>')
rep('<figure class="desk">', '<figure class="desk" data-a="solo">')
rep('<div class="phones">', '<div class="phones" data-a>')
rep('<div class="grid3">', '<div class="grid3" data-a>', 2)
rep('<ul class="feat">', '<ul class="feat" data-a>')
rep('<div class="plans">', '<div class="plans" data-a>')
# los precios cuentan al aparecer: cada número de plan pago lleva su data-cuenta (el que sea: los precios cambian en base-v6.html)
s, n = re.subn(r'<div class="num">([1-9]\d*)<small>US\$', r'<div class="num" data-cuenta="\1">\1<small>US$', s); assert n == 2, n
# el cierre, antes del pie
rep('</main>', rd('cierre.html').strip() + '\n</main>')
if previa: rep('<footer>', '<p class="vprev gl" aria-hidden="true">Vista previa · todavía no es la página pública</p>\n<footer>')
# el guion
a = s.index('<script>\n(function(){'); b = s.index('</script>', a) + 9
js = rd('v7.js').strip(); assert js.endswith('})();')
# el guion se revisa antes de armar (un «//» en el medio de un renglón ya se comió el resto una vez: no se arma una página rota)
import shutil, subprocess, tempfile
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t: t.write(js)
    r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True); os.unlink(t.name)
    assert r.returncode == 0, 'v7.js no pasa la revisión:\n' + r.stderr[:600]
else: print('aviso: no hay node, el guion sale sin revisar')
s = s[:a] + '<script>\n' + js[:-5] + '  window.__olumiOk=1;\n})();\n</script>' + s[b:]
AVISO = '<!-- Esta página se arma con servidor/web/olumi-v7/construir.py: no se edita a mano (lo de abajo de la historia sale de base-v6.html; la historia, el cierre, el estilo y el guion, de historia.html, cierre.html, v7.css y v7.js). -->'
assert s.lstrip().lower().startswith('<!doctype html>') and AVISO not in s; i = s.lower().index('<!doctype html>') + len('<!doctype html>'); s = s[:i] + '\n' + AVISO + s[i:]
tmp = sys.argv[1] + '.tmp'; open(tmp, 'w', encoding='utf-8').write(s); os.replace(tmp, sys.argv[1])   # de una: nadie lee la página a medio escribir
print('v7 armada en', sys.argv[1], len(s), 'bytes', '(vista previa)' if previa else '')
