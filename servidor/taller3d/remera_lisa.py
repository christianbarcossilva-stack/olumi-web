#!/usr/bin/env python3
"""Saca el logo y los vivos naranjas de la remera de female_casualsuit01 (MakeHuman trae una remera azul con su logo: no va en una oficina).
La remera queda gris claro con la trama de la tela, para que la oficina la tiña con un color propio por persona (AVV.ROPA.mujer, máscara
vMapUv.y<.5: la remera es la mitad de arriba de la textura). El jean queda como está.
uso: remera_lisa.py entrada.glb salida.glb   (antes de glb_liviano.py)"""
import sys, json, struct, io
import numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]; J = json.loads(d[20:20 + jl]); b0 = 20 + jl; bl = struct.unpack('<I', d[b0:b0 + 4])[0]; BIN = bytearray(d[b0 + 8:b0 + 8 + bl])
V = J['bufferViews']; hecho = 0
for m in J['materials']:
    if 'casualsuit01' not in m.get('name', '') or 'female' not in m.get('name', ''): continue
    t = m['pbrMetallicRoughness']['baseColorTexture']['index']; im = J['images'][J['textures'][t]['source']]; v = V[im['bufferView']]
    o, n = v.get('byteOffset', 0), v['byteLength']; img = Image.open(io.BytesIO(bytes(BIN[o:o + n]))).convert('RGB'); W, H = img.size
    a = np.asarray(img).astype(np.float32); yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W])[:, None, None]
    zona = (yy < .44) | ((xx > .72) & (yy > .55) & (yy < .83))                # remera: piezas de arriba y las dos mangas (abajo a la derecha)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fondo = (np.abs(r - g) < 14) & (np.abs(g - b) < 14) & (r > 150)
    tela = zona & ~fondo; azul = tela & (b > r + 35)
    L = .2126 * r + .7152 * g + .0722 * b
    def caja(x, r=7):
        for ax in (0, 1):
            c = np.cumsum(np.pad(x, [(r + 1, r) if k == ax else (0, 0) for k in (0, 1)], mode='edge'), axis=ax)
            x = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
        return x
    bl = lambda x: caja(caja(x.astype(np.float32)))
    media = bl(L * azul) / np.maximum(bl(azul.astype(np.float32)), 1e-3)     # promedio de la tela azul alrededor (sin el logo ni los vivos)
    det = np.where(azul, np.clip((L - media) / np.maximum(media, 1), -.25, .25), 0.)
    nuevo = np.clip(205.0 * (1 + det * 1.6), 0, 255)
    for c in range(3): a[..., c] = np.where(tela, nuevo, a[..., c])
    LOGO = tela & ~azul                                                         # para alisar el relieve del logo en el mapa normal
    bio = io.BytesIO(); Image.fromarray(a.astype(np.uint8)).save(bio, 'PNG'); nb = bio.getvalue()
    # reemplaza la imagen al final del buffer
    pad = (-len(BIN)) % 4; BIN += b'\0' * pad; v['byteOffset'] = len(BIN); v['byteLength'] = len(nb); BIN += nb; im['mimeType'] = 'image/png'; hecho += 1
    nt = m.get('normalTexture')
    if nt is not None:
        im2 = J['images'][J['textures'][nt['index']]['source']]; v2 = V[im2['bufferView']]; o2, n2 = v2.get('byteOffset', 0), v2['byteLength']
        nimg = Image.open(io.BytesIO(bytes(BIN[o2:o2 + n2]))).convert('RGB')
        if nimg.size != (W, H): Lg = np.asarray(Image.fromarray(LOGO.astype(np.uint8) * 255).resize(nimg.size)) > 127
        else: Lg = LOGO
        Lg = np.asarray(Image.fromarray(Lg.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 127
        na = np.asarray(nimg).copy(); na[Lg] = (128, 128, 255); bio2 = io.BytesIO(); Image.fromarray(na).save(bio2, 'PNG'); nb2 = bio2.getvalue()
        pad = (-len(BIN)) % 4; BIN += b'\0' * pad; v2['byteOffset'] = len(BIN); v2['byteLength'] = len(nb2); BIN += nb2; im2['mimeType'] = 'image/png'
    m['name'] = m['name'] + '.lisa'
assert hecho, 'no hay remera female_casualsuit01'
J['buffers'][0]['byteLength'] = len(BIN)
js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4); BIN += b'\0' * ((-len(BIN)) % 4)
out = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(BIN)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(BIN)) + b'BIN\0' + bytes(BIN)
open(dst, 'wb').write(out); print('remera lisa:', hecho, dst)
