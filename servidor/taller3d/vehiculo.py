# Vehículos modelados por secciones. uso: blender -b --python vehiculo.py -- <modelo> salida.blend [salida.glb]
#   modelos: suv (SUV mediano genérico) · eq7 (Chery eQ7, ajustado con fotos) · toro (pickup doble cabina, Fiat Toro) · bipper (furgoneta chica, Peugeot Bipper) · fiorino (furgón, Fiat Fiorino 2025)
# La carrocería es una "piel" tendida entre secciones a lo largo del vehículo (silueta de costado + ancho en planta + forma de cada sección),
# suavizada; después se abren los pasarruedas (y la caja, en la pickup) y se suman vidrios, luces, juntas, espejos y ruedas.
# La pintura queda en un material aparte ("pintura") para que la app le ponga el color de la ficha del vehículo.
# Para sumar un modelo: una ficha nueva en MODELOS (medidas de fábrica, tres curvas de costado, planta y la lista de detalles).
import bpy, bmesh, sys, math, os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ARG = sys.argv[sys.argv.index('--') + 1:]; TIPO = ARG[0]; OUT = ARG[1]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)

def suv():
    L, W, EJ, vF = 4.675, 1.91, 2.83, .905; XF = L / 2; XR = -XF; AXF = XF - vF; AXR = AXF - EJ; COWL = 1.13; ROOF0 = .30; ROOF1 = -1.52; TAIL = -2.12
    return dict(L=L, W=W, EJ=EJ, vF=vF, RR=.365, RL=.27, tw=.12, arc=.078, arco='negro', espejo='pintura',
        top=[(XR, 1.08), (XR + .06, 1.14), (TAIL, 1.19), (TAIL + .28, 1.42), (ROOF1, 1.59), (-1.0, 1.64), (-.2, 1.66), (ROOF0, 1.635), (.62, 1.47), (.92, 1.27), (COWL, 1.13), (1.5, 1.10), (1.95, 1.06), (XF - .12, 1.02), (XF, .97)],
        cin=[(XR, 1.05), (TAIL, 1.15), (-1.3, 1.14), (-.2, 1.11), (.75, 1.09), (COWL, 1.085), (1.6, 1.05), (XF - .1, .99), (XF, .94)],
        pis=[(XR, .40), (XR + .25, .27), (AXR, .20), (0, .19), (AXF, .20), (XF - .25, .24), (XF, .34)],
        planta=[(XR, .80), (XR + .25, .90), (AXR, .945), (-.3, .955), (AXF, .945), (XF - .3, .90), (XF, .81)], esquinas=((XF, .36, .19), (XR, .36, .22)),
        cab=(TAIL + .05, COWL - .02, .16, .3, .3, 0), vid=(TAIL + .34, COWL - .34), parantes=[(-.16, -.07), (-1.2, -1.12)], parabrisas=(ROOF0 + .04, COWL - .03), luneta=(TAIL + .03, ROOF1 - .05),
        frente=[('luz', 'faro', -.62, .62, .955, .975, 30, 1, .009, 0), ('faro', 'faro', .56, .86, .93, 1.0, 10, 3, .011, 1), ('toma', 'negro', -.70, .70, .28, .60, 28, 5, .009, 0), ('patente', 'patente', -.2, .2, .40, .50, 6, 2, .014, 0)],
        cola=[('luz', 'stop', -.74, .74, 1.04, 1.075, 30, 2, .009, 0), ('stop', 'stop', .56, .86, 1.01, 1.10, 10, 3, .011, 1), ('paragolpes', 'negro', -.74, .74, .36, .58, 28, 4, .009, 0), ('patente', 'patente', -.2, .2, .74, .84, 6, 2, .012, 0)],
        juntas=[(.86, .36, 1.08), (-.115, .36, 1.10), (-1.13, 'arco', 1.13)], junta_baja=(-1.0, .86, .361), manijas=[(.42, .62, 1.0, 1.025, 'cromo'), (-.52, -.32, 1.02, 1.045, 'cromo')], molduras=[], espejo_en=(.86, 1.10))

def eq7():
    # medidas tomadas de la foto de costado de Christian con la rueda como regla (73 cm de diámetro): capó a 1 m sobre la rueda delantera,
    # base del parabrisas a 1,13, cintura a 1,12 en la puerta de adelante y 1,28 en el vidrio chico, cola a 1,22: trompa alta y vidrios bajos
    L, W, EJ, vF = 4.675, 1.91, 2.83, .905; XF = L / 2; XR = -XF; AXF = XF - vF; AXR = AXF - EJ; COWL = 1.10; ROOF0 = .28; TAIL = -2.20
    return dict(L=L, W=W, EJ=EJ, vF=vF, RR=.365, RL=.262, tw=.12, arc=.078, arco='negro', espejo='negro', rayos=((0,), .30, .17),
        top=[(XR, 1.14), (XR + .06, 1.19), (TAIL, 1.22), (-2.05, 1.32), (-1.80, 1.47), (-1.42, 1.585), (-.85, 1.64), (-.1, 1.66), (ROOF0, 1.635), (.60, 1.47), (.90, 1.26), (COWL, 1.13), (1.5, 1.10), (1.95, 1.065), (XF - .12, 1.03), (XF, .98)],
        cin=[(XR, 1.12), (TAIL, 1.20), (-1.75, 1.28), (-1.25, 1.17), (-.2, 1.12), (.75, 1.10), (COWL, 1.09), (1.6, 1.06), (XF - .1, 1.0), (XF, .95)],
        pis=[(XR, .42), (XR + .25, .28), (AXR, .20), (0, .19), (AXF, .20), (XF - .25, .24), (XF, .34)],
        planta=[(XR, .82), (XR + .25, .91), (AXR, .945), (-.3, .955), (AXF, .945), (XF - .3, .905), (XF, .82)], esquinas=((XF, .34, .18), (XR, .32, .20)),
        cab=(TAIL + .1, COWL - .02, .17, .45, .3, 0), vid=(-1.74, COWL - .34), parantes=[(-.16, -.07), (-1.22, -1.13)], parabrisas=(ROOF0 + .04, COWL - .03), luneta=(TAIL + .04, -1.56),
        frente=[('diurna', 'faro', .22, .78, .925, .955, 14, 2, .012, 1), ('optica', 'negro', .46, .87, .70, .86, 8, 3, .008, 1), ('faro', 'faro', .52, .81, .745, .815, 8, 2, .014, 1),
                ('parrilla', 'negro', -.72, .72, .28, .62, 28, 5, .009, 0), ('patente', 'patente', -.2, .2, .40, .50, 6, 2, .016, 0)],
        cola=[('luz', 'stop', -.74, .74, 1.10, 1.13, 30, 2, .009, 0), ('stop', 'stop', .56, .86, 1.06, 1.155, 10, 3, .011, 1), ('paragolpes', 'negro', -.76, .76, .38, .62, 28, 4, .009, 0), ('patente', 'patente', -.2, .2, .78, .88, 6, 2, .012, 0)],
        juntas=[(.86, .36, 1.09), (-.115, .36, 1.11), (-1.13, 'arco', 1.17)], junta_baja=None, manijas=[(.40, .60, 1.03, 1.055, 'negro'), (-.56, -.36, 1.06, 1.085, 'negro')],
        molduras=[(-.93, .86, .345, .50, 'negro')], espejo_en=(.86, 1.11))

def toro():
    L, W, EJ, vF = 4.944, 1.844, 2.99, .92; XF = L / 2; XR = -XF; AXF = XF - vF; AXR = AXF - EJ; COWL = 1.02; ROOF0 = .30
    return dict(L=L, W=W, EJ=EJ, vF=vF, RR=.364, RL=.24, tw=.115, arc=.078, arco='negro', espejo='pintura',
        top=[(XR, 1.26), (XR + .08, 1.29), (-1.78, 1.295), (-1.55, 1.37), (-1.29, 1.58), (-1.12, 1.69), (-.4, 1.72), (ROOF0, 1.69), (.58, 1.50), (.84, 1.29), (COWL, 1.17), (1.6, 1.12), (2.1, 1.06), (XF - .1, 1.04), (XF, .98)],
        cin=[(XR, 1.24), (-1.6, 1.27), (-1.1, 1.16), (-.2, 1.13), (.8, 1.11), (COWL, 1.10), (1.7, 1.04), (XF - .1, .96), (XF, .90)],
        pis=[(XR, .46), (XR + .25, .32), (AXR, .26), (0, .25), (AXF, .26), (XF - .25, .30), (XF, .42)],
        planta=[(XR, .86), (XR + .25, .905), (AXR, .918), (-.3, .922), (AXF, .915), (XF - .3, .87), (XF, .78)], esquinas=((XF, .34, .20), (XR, .16, .10)),
        cab=(-1.25, COWL - .02, .13, .3, .3, 0), vid=(-1.0, COWL - .34), parantes=[(-.2, -.1)], parabrisas=(ROOF0 + .04, COWL - .03), luneta=None,
        caja=(XR + .09, -1.29, .76, .80), luneta_plana=(-1.29, .52, 1.31, 1.54),
        frente=[('parrilla', 'negro', -.50, .50, .70, .90, 20, 4, .009, 0), ('luz', 'faro', .50, .86, .925, .96, 10, 1, .011, 1), ('faro', 'faro', .56, .84, .70, .81, 8, 3, .012, 1), ('toma', 'negro', -.80, .80, .44, .60, 28, 3, .009, 0), ('patente', 'patente', -.2, .2, .62, .72, 6, 2, .016, 0)],
        cola=[('stop', 'stop', .66, .86, .92, 1.22, 6, 6, .011, 1), ('porton', 'negro', -.005, .005, .70, 1.25, 1, 10, .004, 0), ('paragolpes', 'negro', -.84, .84, .46, .64, 28, 3, .009, 0), ('patente', 'patente', -.2, .2, .50, .60, 6, 2, .016, 0)],
        juntas=[(.84, .40, 1.10), (-.15, .40, 1.12), (-1.02, 'arco', 1.14)], junta_baja=(-.95, .84, .405), manijas=[(.36, .56, 1.0, 1.025, 'cromo'), (-.62, -.42, 1.02, 1.045, 'cromo')], molduras=[], espejo_en=(.86, 1.13))

def bipper():
    L, W, EJ, vF = 3.864, 1.716, 2.513, .80; XF = L / 2; XR = -XF; AXF = XF - vF; AXR = AXF - EJ; COWL = 1.22; ROOF0 = .60
    return dict(L=L, W=W, EJ=EJ, vF=vF, RR=.30, RL=.19, tw=.09, arc=.065, arco=None, espejo='negro',
        top=[(XR, 1.60), (XR + .05, 1.68), (XR + .25, 1.70), (-.6, 1.70), (.35, 1.67), (ROOF0, 1.61), (.95, 1.33), (COWL, 1.10), (1.5, 1.02), (1.8, .90), (XF, .74)],
        cin=[(XR, 1.06), (-.5, 1.05), (.6, 1.03), (COWL, 1.02), (1.6, .95), (XF, .72)],
        pis=[(XR, .40), (XR + .2, .30), (AXR, .24), (0, .23), (AXF, .24), (XF - .2, .28), (XF, .36)],
        planta=[(XR, .80), (XR + .2, .845), (AXR, .858), (0, .858), (AXF, .85), (XF - .3, .80), (XF, .66)], esquinas=((XF, .40, .24), (XR, .14, .10)),
        cab=(-.05, COWL - .02, .08, .25, .3, .045), vid=(.14, COWL - .32), parantes=[], parabrisas=(ROOF0 + .04, COWL - .03), luneta=None,
        frente=[('faro', 'faro', .44, .76, .78, .92, 8, 4, .011, 1), ('ranura', 'negro', -.30, .30, .70, .74, 14, 1, .009, 0), ('paragolpes', 'negro', -.80, .80, .34, .64, 28, 5, .009, 0), ('patente', 'patente', -.2, .2, .44, .54, 6, 2, .016, 0)],
        cola=[('stop', 'stop', .56, .69, .95, 1.40, 4, 8, .011, 1), ('puertas', 'negro', .115, .125, .50, 1.62, 1, 14, .004, 0), ('manija', 'negro', .0, .10, 1.0, 1.03, 2, 1, .010, 0), ('paragolpes', 'negro', -.80, .80, .36, .52, 28, 3, .009, 0), ('patente', 'patente', -.5, -.1, .80, .90, 6, 2, .012, 0)],
        juntas=[(1.02, 'arcoF', 1.02), (.10, .32, 1.58), (-.72, .32, 1.60)], junta_baja=None, manijas=[(.16, .30, .98, 1.01, 'negro'), (-.68, -.56, .98, 1.01, 'negro')],
        molduras=[(-.95, .70, .56, .63, 'negro'), (-1.70, -.72, 1.045, 1.06, 'negro')], espejo_en=(.98, 1.06), cartel=(-1.22, 1.32))

def fiorino():
    L, W, EJ, vF = 4.407, 1.643, 2.716, .80; XF = L / 2; XR = -XF; AXF = XF - vF; AXR = AXF - EJ; COWL = 1.30; ROOF0 = .75
    return dict(L=L, W=W, EJ=EJ, vF=vF, RR=.30, RL=.19, tw=.09, arc=.065, arco=None, espejo='negro',
        top=[(XR, 1.80), (XR + .05, 1.865), (XR + .3, 1.875), (-.3, 1.875), (.02, 1.86), (.22, 1.63), (.45, 1.555), (ROOF0, 1.53), (1.05, 1.30), (COWL, 1.08), (1.65, 1.00), (2.0, .90), (XF, .76)],
        cin=[(XR, 1.02), (.0, 1.02), (.75, 1.00), (COWL, .99), (1.7, .93), (XF, .74)],
        pis=[(XR, .40), (XR + .2, .30), (AXR, .25), (0, .24), (AXF, .25), (XF - .2, .28), (XF, .36)],
        planta=[(XR, .79), (XR + .15, .815), (AXR, .8215), (.0, .8215), (.3, .81), (AXF, .80), (XF - .3, .76), (XF, .62)], esquinas=((XF, .38, .24), (XR, .10, .06)),
        cab=(.05, COWL - .02, .12, .2, .3, 0), vid=(.24, COWL - .32), parantes=[], parabrisas=(ROOF0 + .04, COWL - .03), luneta=None,
        frente=[('faro', 'faro', .42, .72, .76, .90, 8, 4, .011, 1), ('parrilla', 'negro', -.36, .36, .78, .86, 14, 2, .009, 0), ('paragolpes', 'negro', -.76, .76, .34, .62, 28, 5, .009, 0), ('patente', 'patente', -.2, .2, .44, .54, 6, 2, .016, 0)],
        cola=[('stop', 'stop', .54, .67, .52, .88, 4, 6, .011, 1), ('puertas', 'negro', -.005, .005, .48, 1.80, 1, 16, .004, 0), ('manija', 'negro', .02, .14, 1.0, 1.03, 2, 1, .010, 0), ('paragolpes', 'negro', -.76, .76, .34, .46, 28, 2, .009, 0), ('patente', 'patente', -.6, -.2, .60, .70, 6, 2, .012, 0)],
        juntas=[(1.10, 'arcoF', 1.0), (.12, .32, 1.50)], junta_baja=None, manijas=[(.18, .32, .96, .99, 'negro')], molduras=[], espejo_en=(1.06, 1.04), cartel=(-1.0, 1.28))

MODELOS = dict(suv=suv, eq7=eq7, toro=toro, bipper=bipper, fiorino=fiorino); C = MODELOS[TIPO]()
L, W, EJ = C['L'], C['W'], C['EJ']; XF = L / 2; XR = -L / 2; AXF = XF - C['vF']; AXR = AXF - EJ; RR = C['RR']      # ejes y radio de rueda
def curva(pts):
    """interpola suave (Catmull-Rom) por los puntos (x, valor); se ordenan de atrás hacia adelante"""
    pts = sorted(pts); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = max(k for k in range(len(xs) - 1) if xs[k] <= x); t = (x - xs[i]) / (xs[i + 1] - xs[i])
        p0 = ys[max(0, i - 1)]; p1 = ys[i]; p2 = ys[i + 1]; p3 = ys[min(len(ys) - 1, i + 2)]
        return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    return f
# silueta de costado: línea de arriba, cintura (base de los vidrios) y piso; ancho en planta con las esquinas redondeadas
z_top = curva(C['top']); z_cin = curva(C['cin']); z_pis = curva(C['pis']); _pl = curva(C['planta'])
def medio(x):
    b = _pl(x)
    for xe, r, k in C['esquinas']:
        d = abs(xe - x)
        if d < r: b *= 1 - k + k * math.sqrt(max(0, 1 - ((r - d) / r) ** 2))
    return b
CA0, CA1, METE, FA0, FA1, METE0 = C['cab']
def cabina(x):      # 0 fuera de la cabina, 1 donde hay vidrios laterales (se desvanece en los parantes)
    return max(0, min(1, (x - CA0) / FA0)) * max(0, min(1, (CA1 - x) / FA1))
NS = 46; xs = [XR + .045 + (L - .09) * i / (NS - 1) for i in range(NS)]      # las tapas de trompa y cola suman lo que falta para el largo de fábrica
def seccion(x):
    w = medio(x); zb = z_pis(x); zt = z_top(x); zc = min(z_cin(x), zt - .02); cb = cabina(x); mete = METE * cb + METE0 * min(1, max(0, (zt - zc) / .4))      # el techo es más angosto que la cintura
    wt = w - .03 - mete
    return [(0, zb), (w * .55, zb), (w - .1, zb + .015), (w - .015, zb + .12), (w, zb + .36), (w, .5 * (zb + .36) + .5 * (zc - .08)), (w - .012, zc - .07), (w - .03, zc),
            (w - .03 - mete * .55, zc + (zt - zc) * .55), (wt + .012, zt - .075 * cb - .02), (wt - .07, zt - .012), (wt * .55, zt + .012), (0, zt + .02)]
bm = bmesh.new(); V = []
for x in xs:
    s = seccion(x); V.append([bm.verts.new((x, y, z)) for y, z in s] + [bm.verts.new((x, -y, z)) for y, z in s[-2:0:-1]])
NR = len(V[0])
for i in range(NS - 1):
    for j in range(NR): bm.faces.new((V[i][j], V[i][(j + 1) % NR], V[i + 1][(j + 1) % NR], V[i + 1][j]))
# tapas de trompa y cola: una sección más chica, hacia afuera, y se cierra
for ring, sx in ((V[0], -1), (V[-1], 1)):
    cx = ring[0].co.x; zc = sum(v.co.z for v in ring) / NR; inner = [bm.verts.new((cx + sx * .035, v.co.y * .86, zc + (v.co.z - zc) * .82)) for v in ring]
    for j in range(NR):
        f = (ring[j], ring[(j + 1) % NR], inner[(j + 1) % NR], inner[j]); bm.faces.new(f if sx > 0 else f[::-1])
    bm.faces.new(inner if sx < 0 else inner[::-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
if bm.calc_volume(signed=True) < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces[:])      # las caras miran hacia afuera
me = bpy.data.meshes.new('carroceria'); bm.to_mesh(me); bm.free()
car = bpy.data.objects.new('carroceria', me); bpy.context.scene.collection.objects.link(car)
def mat(n, col, rug, met=0, emis=None, coat=0):
    m = bpy.data.materials.new(n); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rug; b.inputs['Metallic'].default_value = met
    if emis: b.inputs['Emission Color'].default_value = (*emis[:3], 1); b.inputs['Emission Strength'].default_value = emis[3]
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .06
    return m
M = {'pintura': mat('pintura', (.86, .87, .88), .34, .55, coat=1), 'vidrio': mat('vidrio', (.02, .026, .032), .06, .25), 'negro': mat('negro', (.035, .037, .04), .62),
     'faro': mat('faro', (1, .98, .92), .2, 0, (1, .97, .88, 2.2)), 'stop': mat('stop', (.75, .03, .03), .3, 0, (1, .05, .04, 1.6)), 'llanta': mat('llanta', (.62, .64, .66), .28, .9),
     'goma': mat('goma', (.02, .02, .022), .88), 'cromo': mat('cromo', (.8, .82, .84), .16, 1), 'patente': mat('patente', (.93, .93, .9), .5)}
for k in ('pintura', 'vidrio', 'negro'): me.materials.append(M[k])
# materiales por zona de la piel (sobre la jaula, antes de suavizar)
me.update(); V0, V1 = C['vid']; P0, P1 = C['parabrisas']
for p in me.polygons:
    c = p.center; x = c.x; ay = abs(c.y); n = p.normal; mi = 0
    zc = z_cin(x); zt = z_top(x); w = medio(x); lateral = abs(n.y) > .45
    if c.z < z_pis(x) + .14 and abs(n.x) < .9: mi = 2                                                  # zócalo y piso: plástico negro
    elif lateral and V0 < x < V1 and zc + .015 < c.z < zt - .10:                                       # vidrios laterales
        mi = 2 if any(a < x < b for a, b in C['parantes']) else 1                                      # parantes del medio en negro: se lee como un solo vidrio
    elif not lateral and n.z > .25 and ay < w - .25:
        if P0 < x < P1: mi = 1                                                                         # parabrisas
        elif C['luneta'] and C['luneta'][0] < x < C['luneta'][1]: mi = 1                               # luneta
    p.material_index = mi; p.use_smooth = True
sub = car.modifiers.new('suave', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
bpy.context.view_layer.objects.active = car; bpy.ops.object.modifier_apply(modifier='suave')
def volumen(m):
    b = bmesh.new(); b.from_mesh(m); v = b.calc_volume(signed=True); b.free(); return v
def restar(o):
    """resta una pieza de la carrocería y comprueba que de verdad haya sacado material (si no, prueba con el otro método y avisa)"""
    antes = volumen(car.data); copia = car.data.copy()
    for metodo in ('EXACT', 'MANIFOLD', 'FLOAT'):
        b = car.modifiers.new('resta', 'BOOLEAN'); b.operation = 'DIFFERENCE'; b.object = o
        try: b.solver = metodo
        except Exception: car.modifiers.remove(b); continue
        bpy.context.view_layer.objects.active = car; bpy.ops.object.modifier_apply(modifier='resta'); v = volumen(car.data)
        if 0 < v < antes - 1e-4: break
        print('RESTA', metodo, 'no sirvió (volumen', round(antes, 3), '→', round(v, 3), '); pruebo otro'); car.data = copia.copy()
    else: print('RESTA: ningún método funcionó')
    bpy.data.objects.remove(o, do_unlink=True)
piezas = [car]
# pickup: la caja se abre de verdad (queda el piso y las paredes) y la luneta va en la pared de la cabina
if C.get('caja'):
    x0, x1, hw, zp = C['caja']; bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, 0, zp + 1)); c = bpy.context.active_object; c.scale = (x1 - x0, hw * 2, 2); bpy.ops.object.transform_apply(scale=True)
    b = c.modifiers.new('b', 'BEVEL'); b.width = .03; b.segments = 2; bpy.ops.object.modifier_apply(modifier='b'); c.data.materials.append(M['negro']); restar(c)
    lx, lh, lz0, lz1 = C['luneta_plana']; mm = bpy.data.meshes.new('luneta'); mm.from_pydata([(lx - .006, -lh, lz0), (lx - .006, lh, lz0), (lx - .006, lh, lz1), (lx - .006, -lh, lz1)], [], [(0, 1, 2, 3)]); mm.update()
    if mm.polygons[0].normal.x > 0: mm.flip_normals()
    o = bpy.data.objects.new('luneta', mm); bpy.context.scene.collection.objects.link(o); mm.materials.append(M['vidrio']); piezas.append(o)
# pasarruedas: se abren de verdad (queda el hueco negro) y llevan un arco apenas salido
ARC = RR + C['arc']
for ax in (AXF, AXR):
    for s in (-1, 1):
        # el cilindro va apenas corrido y girado: si un borde del corte cae justo sobre uno de la carrocería, la resta puede fallar
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=ARC, depth=.62, location=(ax + .0007, s * (W / 2 - .2), RR + .0203), rotation=(math.pi / 2, .0371, 0)); c = bpy.context.active_object; c.data.materials.append(M['negro']); restar(c)
for p in car.data.polygons: p.use_smooth = True
PIEL = BVHTree.FromObject(car, bpy.context.evaluated_depsgraph_get())
def hacia(p, eje, s):
    """punto de la piel visto desde afuera: rayo desde lejos por el eje dado (0 = x, 1 = y, 2 = z), del lado s"""
    o = Vector(p); o[eje] = s * 4; d = Vector((0, 0, 0)); d[eje] = -s; h = PIEL.ray_cast(o, d, 8)
    return h[0]
def lamina(n, m, grilla, eje, s, sale=.009):
    """lámina fina apoyada sobre la carrocería: cada punto de la grilla se proyecta sobre la piel y queda apenas salido"""
    bm = bmesh.new(); G = []
    for fila in grilla:
        F = []
        for p in fila:
            h = hacia(p, eje, s); q = Vector(p)
            if h is not None: q[eje] = h[eje] + s * sale
            F.append(bm.verts.new(q))
        G.append(F)
    for j in range(len(G) - 1):
        for i in range(len(G[0]) - 1): bm.faces.new((G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    mm = bpy.data.meshes.new(n); bm.to_mesh(mm); bm.free(); o = bpy.data.objects.new(n, mm); bpy.context.scene.collection.objects.link(o); mm.materials.append(M[m])
    mm.update()
    if sum(p.normal[eje] for p in mm.polygons) * s < 0: mm.flip_normals()       # las caras tienen que mirar hacia afuera
    for p in mm.polygons: p.use_smooth = True
    piezas.append(o); return o
def rect(eje, s, a0, a1, b0, b1, na, nb):
    """grilla rectangular en el plano perpendicular al eje: frente/cola (eje x): a = y, b = z; costado (eje y): a = x, b = z"""
    return [[((s * 3, a0 + (a1 - a0) * i / na, b0 + (b1 - b0) * j / nb) if eje == 0 else (a0 + (a1 - a0) * i / na, s * 3, b0 + (b1 - b0) * j / nb)) for i in range(na + 1)] for j in range(nb + 1)]
# trompa y cola: luces, parrilla, paragolpes y patente, según la ficha
for lista, sx in ((C['frente'], 1), (C['cola'], -1)):
    for n, m, y0, y1, z0, z1, ny, nz, sale, par in lista:
        for s in ((-1, 1) if par else (1,)): lamina(n, m, rect(0, sx, s * y0, s * y1, z0, z1, ny, nz), 0, sx, sale)
# costados: arcos en los pasarruedas, juntas de las puertas, manijas, molduras y espejos
zar = lambda x, ax: RR + .02 + math.sqrt(max(0, (ARC + .07) ** 2 - (x - ax) ** 2))            # hasta dónde baja una junta que cae sobre un arco
for s in (-1, 1):
    for ax in ((AXF, AXR) if C['arco'] else ()):
        bm = bmesh.new(); A = []
        for i in range(31):
            a = math.radians(-13 + 206 * i / 30); ca, sa = math.cos(a), math.sin(a); zc = RR + .02
            h = hacia((ax + (ARC + .035) * ca, 0, max(.3, zc + (ARC + .035) * sa)), 1, s); y = (h.y if h is not None else s * (medio(ax) - .02)) + s * .014
            A.append([bm.verts.new((ax + r * ca, yy, zc + r * sa)) for r, yy in ((ARC - .012, y - s * .06), (ARC - .012, y), (ARC + .012, y + s * .004), (ARC + .058, y), (ARC + .07, y - s * .012))])
        for i in range(30):
            for j in range(4):
                f = (A[i][j], A[i][j + 1], A[i + 1][j + 1], A[i + 1][j]); bm.faces.new(f if s > 0 else f[::-1])
        mm = bpy.data.meshes.new('arco'); bm.to_mesh(mm); bm.free(); o = bpy.data.objects.new('arco', mm); bpy.context.scene.collection.objects.link(o); mm.materials.append(M[C['arco']])
        for p in mm.polygons: p.use_smooth = True
        piezas.append(o)
    for x, z0, z1 in C['juntas']:
        z0 = zar(x, AXR) if z0 == 'arco' else zar(x, AXF) if z0 == 'arcoF' else z0
        lamina('junta', 'negro', rect(1, s, x - .006, x + .006, z0, z1, 1, 14), 1, s, .003)
    if C['junta_baja']: x0, x1, z = C['junta_baja']; lamina('junta_baja', 'negro', rect(1, s, x0, x1, z - .006, z + .006, 16, 1), 1, s, .003)
    for x0, x1, z0, z1, m in C['manijas']: lamina('manija', m, rect(1, s, x0, x1, z0, z1, 3, 1), 1, s, .008)
    for x0, x1, z0, z1, m in C['molduras']: lamina('moldura', m, rect(1, s, x0, x1, z0, z1, 24, 2), 1, s, .012)
    # espejo, sobre un pie negro en la base del vidrio
    ex, ez = C['espejo_en']; h = hacia((ex, 0, ez), 1, s); ye = h.y if h is not None else s * .9
    for nm, m_, x0, x1, y0, y1, z0, z1, bis in (('espejo', C['espejo'], ex - .06, ex + .07, ye + s * .05, ye + s * .22, ez, ez + .10, .035), ('espejo_pie', 'negro', ex - .02, ex + .05, ye - s * .02, ye + s * .08, ez - .005, ez + .03, .01)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); o = bpy.context.active_object; o.name = nm; o.scale = (x1 - x0, abs(y1 - y0), z1 - z0); bpy.ops.object.transform_apply(scale=True)
        b = o.modifiers.new('b', 'BEVEL'); b.width = bis; b.segments = 3; bpy.ops.object.modifier_apply(modifier='b'); o.data.materials.append(M[m_]); [setattr(p, 'use_smooth', True) for p in o.data.polygons]; piezas.append(o)
# ruedas torneadas: cubierta con hombro redondo, llanta hundida con cinco rayos dobles
RL = C['RL']; TW = C['tw']; RAY = C.get('rayos') or ((-.2, .2), .16, .045 * .27 / C['RL'])
def rueda(x, s):
    y = s * (W / 2 - TW - .03); bm = bmesh.new(); SEG = 32
    def torno(perfil):
        an = [[bm.verts.new((x + r * math.cos(2 * math.pi * i / SEG), y + s * off, RR + r * math.sin(2 * math.pi * i / SEG))) for i in range(SEG)] for r, off in perfil]
        fs = []
        for j in range(len(perfil) - 1):
            for i in range(SEG):
                f = (an[j][i], an[j][(i + 1) % SEG], an[j + 1][(i + 1) % SEG], an[j + 1][i]); fs.append(bm.faces.new(f if s < 0 else f[::-1]))
        return fs
    g = torno([(RL, -TW), (RR - .04, -TW), (RR - .008, -TW + .02), (RR, -TW + .05), (RR, TW - .05), (RR - .008, TW - .02), (RR - .04, TW), (RL + .004, TW + .002)])
    l = torno([(RL + .004, TW + .002), (RL - .012, TW - .004), (RL - .022, TW - .06), (RL - .03, TW - .075)]); f = torno([(RL - .03, TW - .075), (.001, TW - .075)])
    def sector(r0, r1, a, da0, da1, off):
        v0 = [bm.verts.new((x + r0 * math.cos(a + da0 * k), y + s * (off + .012), RR + r0 * math.sin(a + da0 * k))) for k in (-1, 1)]
        v1 = [bm.verts.new((x + r1 * math.cos(a + da1 * k), y + s * off, RR + r1 * math.sin(a + da1 * k))) for k in (-1, 1)]
        q = (v0[0], v0[1], v1[1], v1[0]); return [bm.faces.new(q[::-1] if s < 0 else q)]
    for k in range(5):
        a = 2 * math.pi * k / 5 + .31
        for d in RAY[0]: l += sector(.055, RL - .014, a + d * .55, RAY[1], RAY[2], TW - .02)
    l += torno([(.075, TW - .02), (.07, TW - .006), (.0005, TW - .002)])
    for q in g: q.material_index = 0
    for q in l: q.material_index = 1
    for q in f: q.material_index = 2
    mm = bpy.data.meshes.new('rueda'); bm.to_mesh(mm); bm.free(); o = bpy.data.objects.new('rueda', mm); bpy.context.scene.collection.objects.link(o)
    for k in ('goma', 'llanta', 'negro'): mm.materials.append(M[k])
    for p in mm.polygons: p.use_smooth = True
    piezas.append(o)
for ax in (AXF, AXR):
    for s in (-1, 1): rueda(ax, s)
# dónde va el cartel con el nombre de la empresa (lo pone la app): se mide hasta dónde llega el costado en esa zona
if C.get('cartel'):
    cx, cz = C['cartel']; ys = [hacia((cx + dx, 0, cz + dz), 1, 1) for dx in (-.6, 0, .6) for dz in (-.15, 0, .15)]
    print('CARTEL', TIPO, 'centro x', cx, 'alto', cz, 'costado', round(max(h.y for h in ys if h is not None), 3))
# todo junto en una sola pieza (un material por tipo de superficie)
bpy.ops.object.select_all(action='DESELECT')
for o in piezas: o.select_set(True)
bpy.context.view_layer.objects.active = car; bpy.ops.object.join(); car.name = TIPO
car.data.calc_loop_triangles(); zs = [v.co.z for v in car.data.vertices]; ys = [v.co.y for v in car.data.vertices]; xv = [v.co.x for v in car.data.vertices]
print('VEHICULO', TIPO, len(car.data.loop_triangles), 'triangulos · largo', round(max(xv) - min(xv), 3), 'ancho sin espejos', round(2 * max(medio(x) for x in xs), 3), 'alto', round(max(zs), 3))
bpy.ops.wm.save_as_mainfile(filepath=OUT)
if len(ARG) > 2:
    bpy.ops.export_scene.gltf(filepath=ARG[2], export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT', export_normals=True, export_texcoords=False, export_cameras=False, export_lights=False, export_animations=False)
