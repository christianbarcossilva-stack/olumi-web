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
# Islas de la textura: dónde cae cada triángulo en la imagen. Afuera de las islas la textura suele ser negra y las caras que tocan el borde
# de una isla tomaban ese negro (rayitas oscuras en la cintura del suéter): el color de cada isla se corre unos píxeles hacia afuera.
import numpy as np
from PIL import ImageDraw
def acc(i):
    a = J['accessors'][i]; bv = vistas[a['bufferView']]; n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    ct = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
    x = np.frombuffer(BIN, dtype=ct, count=a['count'] * n, offset=bv.get('byteOffset', 0) + a.get('byteOffset', 0))
    return x.reshape(a['count'], n) if n > 1 else x
usos = {}
for me in J.get('meshes', []):
    for pr in me['primitives']:
        if pr.get('material') is None or 'TEXCOORD_0' not in pr['attributes'] or pr.get('indices') is None: continue
        ma = J['materials'][pr['material']]
        for t in (ma.get('pbrMetallicRoughness', {}).get('baseColorTexture'), ma.get('normalTexture')):
            if t is not None: usos.setdefault(J['textures'][t['index']]['source'], []).append((pr['attributes']['TEXCOORD_0'], pr['indices']))
def sangrar(p, i, n=10):
    w, h = p.size; m = Image.new('L', (w, h), 0); dr = ImageDraw.Draw(m)
    for uv, ix in usos.get(i, []):
        U = acc(uv); T = acc(ix).reshape(-1, 3)
        for t in T: dr.polygon([(float(U[k][0]) * w, float(U[k][1]) * h) for k in t], fill=255, outline=255)
    M = np.asarray(m) > 0
    if not M.any() or M.all(): return p
    A = np.asarray(p.convert('RGB'), np.float32).copy()
    for _ in range(n):
        S = np.zeros_like(A); C = np.zeros(M.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx or dy: mm = np.roll(np.roll(M, dy, 0), dx, 1); S += np.roll(np.roll(A, dy, 0), dx, 1) * mm[..., None]; C += mm
        nu = (~M) & (C > 0)
        if not nu.any(): break
        A[nu] = S[nu] / C[nu][:, None]; M = M | nu
    return Image.fromarray(A.clip(0, 255).astype(np.uint8))
relieve = {J['textures'][m['normalTexture']['index']]['source'] for m in J.get('materials', []) if 'normalTexture' in m}
for i, im in enumerate(J.get('images', [])):
    if 'bufferView' not in im: continue
    p = Image.open(io.BytesIO(datos[im['bufferView']])); lado = LP if i in piel else LR
    alfa = p.mode in ('RGBA', 'LA', 'P') and p.convert('RGBA').getchannel('A').getextrema()[0] < 250
    conalfa[i] = alfa; nom = im.get('name', ''); nl = nom.lower()
    if not alfa and i not in piel and not any(x in nl for x in ('shoe', 'boot', 'flat')): lado = LC      # ropa: se ve de cerca (los zapatos no)
    if i in relieve: lado = min(lado, 512)   # el relieve de la tela no necesita más: así cada persona ocupa menos memoria en el teléfono
    if alfa and max(p.size) > 1024 and not ('brow' in nom or 'lash' in nom or 'eye' in nom): lado = LH   # pelo: el borde contra la frente necesita resolución
    if max(p.size) > lado: k = lado / max(p.size); p = p.resize((max(1, round(p.size[0] * k)), max(1, round(p.size[1] * k))), Image.LANCZOS)
    if not alfa and i in usos: p = sangrar(p, i)
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
