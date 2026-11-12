#!/usr/bin/env python3
"""Aliviana las texturas de un GLB: las que no tienen transparencia pasan a JPEG y todas se achican.
uso: glb_liviano.py entrada.glb salida.glb [lado_piel=1024] [lado_resto=512] [lado_ropa=1024] [lado_pelo=1024]"""
import sys, json, struct, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; LP = int(sys.argv[3]) if len(sys.argv) > 3 else 1024; LR = int(sys.argv[4]) if len(sys.argv) > 4 else 512; LC = int(sys.argv[5]) if len(sys.argv) > 5 else 1024; LH = int(sys.argv[6]) if len(sys.argv) > 6 else 1024; conalfa = {}
d = open(src, 'rb').read(); assert d[:4] == b'glTF'
jl = struct.unpack('<I', d[12:16])[0]; J = json.loads(d[20:20 + jl]); b0 = 20 + jl; bl = struct.unpack('<I', d[b0:b0 + 4])[0]; BIN = d[b0 + 8:b0 + 8 + bl]
vistas = J['bufferViews']; datos = [BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in vistas]
# qué imagen usa cada material (para saber cuál es la piel)
piel = set()
for m in J.get('materials', []):
    t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if t is not None and m.get('name', '').endswith('.body'): piel.add(J['textures'][t['index']]['source'])
for i, im in enumerate(J.get('images', [])):
    if 'bufferView' not in im: continue
    p = Image.open(io.BytesIO(datos[im['bufferView']])); lado = LP if i in piel else LR
    alfa = p.mode in ('RGBA', 'LA', 'P') and p.convert('RGBA').getchannel('A').getextrema()[0] < 250
    conalfa[i] = alfa; nom = im.get('name', '')
    if not alfa and i not in piel and 'shoe' not in nom and 'boot' not in nom: lado = LC      # ropa: se ve de cerca
    if alfa and max(p.size) > 1024 and not ('brow' in nom or 'lash' in nom or 'eye' in nom): lado = LH   # pelo: el borde contra la frente necesita resolución
    if max(p.size) > lado: k = lado / max(p.size); p = p.resize((max(1, round(p.size[0] * k)), max(1, round(p.size[1] * k))), Image.LANCZOS)
    o = io.BytesIO()
    if alfa:
        q = p.convert('RGBA')
        if max(q.size) > 512: q = q.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)   # paleta de 256 colores con transparencia: pesa un tercio
        q.save(o, 'PNG', optimize=True); im['mimeType'] = 'image/png'
    else: p.convert('RGB').save(o, 'JPEG', quality=87, optimize=True); im['mimeType'] = 'image/jpeg'
    datos[im['bufferView']] = o.getvalue()
# cada material dice cómo va su transparencia: sin ella (piel, ropa), recortada (pelo, ojos) o suave (cejas y pestañas)
for m in J.get('materials', []):
    t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture'); src = J['textures'][t['index']]['source'] if t is not None else None
    m.pop('alphaMode', None); m.pop('alphaCutoff', None); n = m.get('name', '')
    if src is not None and conalfa.get(src):
        if 'brow' in n or 'lash' in n: m['alphaMode'] = 'BLEND'
        else: m['alphaMode'] = 'MASK'; m['alphaCutoff'] = .35
# rearmar el binario con los tamaños nuevos (cada vista alineada a 4 bytes)
out = bytearray()
for v, x in zip(vistas, datos):
    while len(out) % 4: out.append(0)
    v['byteOffset'] = len(out); v['byteLength'] = len(x); out += x
while len(out) % 4: out.append(0)
J['buffers'][0]['byteLength'] = len(out)
js = json.dumps(J, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
tot = 12 + 8 + len(js) + 8 + len(out)
open(dst, 'wb').write(b'glTF' + struct.pack('<II', 2, tot) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(out)) + b'BIN\x00' + bytes(out))
print('LIVIANO', dst, round(tot / 1024), 'KB (antes', round(len(d) / 1024), 'KB)')
