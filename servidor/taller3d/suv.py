# SUV eléctrico mediano (proporciones del Chery eQ7: 4,675 × 1,91 × 1,66 m, entre ejes 2,83) modelado por secciones.
# uso: blender -b --python suv.py -- salida.blend
# La carrocería es una "piel" tendida entre secciones a lo largo del auto (silueta de costado + ancho en planta + forma de cada sección),
# suavizada; después se abren los pasarruedas y se suman vidrios, luces, ruedas y espejos. La pintura queda en un material aparte
# ("pintura") para que la app le ponga el color de la ficha del vehículo.
import bpy, bmesh, sys, math, os
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
L, W, H, EJ = 4.675, 1.91, 1.66, 2.83
XF = L / 2; XR = -L / 2; AXF = XF - .905; AXR = AXF - EJ; RR = .365      # ejes y radio de rueda
def curva(pts):
    """interpola suave (Catmull-Rom) por los puntos (x, valor), x creciente"""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = max(k for k in range(len(xs) - 1) if xs[k] <= x); t = (x - xs[i]) / (xs[i + 1] - xs[i])
        p0 = ys[max(0, i - 1)]; p1 = ys[i]; p2 = ys[i + 1]; p3 = ys[min(len(ys) - 1, i + 2)]
        return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    return f
# silueta de costado (de atrás hacia adelante): línea de arriba, cintura (base de los vidrios) y piso
COWL = 1.13; ROOF0 = .30; ROOF1 = -1.52; TAIL = -2.12       # base del parabrisas, donde empieza y termina el techo, base de la luneta
z_top = curva([(XR, 1.02), (XR + .06, 1.08), (TAIL, 1.14), (TAIL + .28, 1.40), (ROOF1, 1.585), (-1.0, 1.635), (-.2, 1.66), (ROOF0, 1.63), (.62, 1.44), (.92, 1.22), (COWL, 1.075), (1.5, 1.01), (1.95, .93), (XF - .12, .84), (XF, .76)])
z_cin = curva([(XR, .98), (TAIL, 1.08), (-1.3, 1.07), (-.2, 1.035), (.75, 1.01), (COWL, 1.0), (1.6, .95), (XF - .1, .82), (XF, .74)])
z_pis = curva([(XR, .40), (XR + .25, .27), (AXR, .20), (0, .19), (AXF, .20), (XF - .25, .24), (XF, .36)])
# ancho en planta (medio ancho): máximo en el medio, se cierra hacia la trompa y la cola, con las esquinas redondeadas
def medio(x):
    b = curva([(XR, .80), (XR + .25, .90), (AXR, .945), (-.3, .955), (AXF, .94), (XF - .3, .88), (XF, .76)])(x)
    for xe, r in ((XF, .42), (XR, .36)):
        d = abs(xe - x)
        if d < r: b *= .78 + .22 * math.sqrt(max(0, 1 - ((r - d) / r) ** 2))
    return b
def cabina(x):      # 0 fuera de la cabina, 1 donde hay vidrios laterales (se desvanece en los parantes)
    return max(0, min(1, (x - (TAIL + .05)) / .3)) * max(0, min(1, (COWL - .02 - x) / .3))
NS = 46; xs = [XR + (L) * i / (NS - 1) for i in range(NS)]
def seccion(x):
    w = medio(x); zb = z_pis(x); zt = z_top(x); zc = min(z_cin(x), zt - .02); cb = cabina(x); mete = .16 * cb      # el techo es más angosto que la cintura
    wt = w - .03 - mete
    return [(0, zb), (w * .55, zb), (w - .1, zb + .015), (w - .015, zb + .12), (w, zb + .36), (w, .5 * (zb + .36) + .5 * (zc - .08)), (w - .012, zc - .07), (w - .03, zc),
            (w - .03 - mete * .55, zc + (zt - zc) * .55), (wt + .012, zt - .075 * cb - .02), (wt - .07, zt - .012), (wt * .55, zt + .012), (0, zt + .02)]
NP = len(seccion(0))
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
def mat(n, col, rug, met=0, emis=None, coat=0, alpha=1):
    m = bpy.data.materials.new(n); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rug; b.inputs['Metallic'].default_value = met
    if emis: b.inputs['Emission Color'].default_value = (*emis[:3], 1); b.inputs['Emission Strength'].default_value = emis[3]
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .06
    return m
M = {'pintura': mat('pintura', (.86, .87, .88), .34, .55, coat=1), 'vidrio': mat('vidrio', (.02, .026, .032), .06, .25), 'negro': mat('negro', (.035, .037, .04), .62),
     'faro': mat('faro', (1, .98, .92), .2, 0, (1, .97, .88, 2.2)), 'stop': mat('stop', (.75, .03, .03), .3, 0, (1, .05, .04, 1.6)), 'llanta': mat('llanta', (.62, .64, .66), .28, .9),
     'goma': mat('goma', (.02, .02, .022), .88), 'cromo': mat('cromo', (.8, .82, .84), .16, 1), 'patente': mat('patente', (.93, .93, .9), .5)}
for k in ('pintura', 'vidrio', 'negro'): me.materials.append(M[k])
# materiales por zona de la piel (sobre la jaula, antes de suavizar)
SIDE_GLASS = (7, 8)                     # tramos de la sección entre la cintura y el borde del techo
me.update()
for p in me.polygons:
    c = p.center; x = c.x; ay = abs(c.y); n = p.normal; mi = 0
    zc = z_cin(x); zt = z_top(x); w = medio(x)
    lateral = abs(n.y) > .45
    if c.z < z_pis(x) + .14 and abs(n.x) < .9: mi = 2                                                  # zócalo y piso: plástico negro
    elif lateral and TAIL + .34 < x < COWL - .34 and zc + .015 < c.z < zt - .10:                       # vidrios laterales, con parantes
        mi = 2 if (-.16 < x < -.07 or -1.2 < x < -1.12) else 1                                        # parantes del medio en negro: se lee como un solo vidrio
    elif not lateral and n.z > .25 and ay < w - .22:
        if ROOF0 + .04 < x < COWL - .03 and ay < w - .25: mi = 1                                       # parabrisas
        elif TAIL + .03 < x < ROOF1 - .05 and ay < w - .25: mi = 1                                     # luneta
    p.material_index = mi; p.use_smooth = True
sub = car.modifiers.new('suave', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
bpy.context.view_layer.objects.active = car; bpy.ops.object.modifier_apply(modifier='suave')
# pasarruedas: se abren de verdad (queda el hueco negro) y llevan un arco de plástico apenas salido
from mathutils.bvhtree import BVHTree
ARC = RR + .078
for ax in (AXF, AXR):
    for s in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=ARC, depth=.62, location=(ax, s * (W / 2 - .2), RR + .02), rotation=(math.pi / 2, 0, 0)); c = bpy.context.active_object; c.data.materials.append(M['negro'])
        b = car.modifiers.new('rueda', 'BOOLEAN'); b.operation = 'DIFFERENCE'; b.object = c; b.solver = 'EXACT'
        bpy.context.view_layer.objects.active = car; bpy.ops.object.modifier_apply(modifier='rueda'); bpy.data.objects.remove(c, do_unlink=True)
for p in car.data.polygons: p.use_smooth = True
piezas = [car]
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
        for i in range(len(G[0]) - 1):
            f = (G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]); bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    mm = bpy.data.meshes.new(n); bm.to_mesh(mm); bm.free(); o = bpy.data.objects.new(n, mm); bpy.context.scene.collection.objects.link(o); mm.materials.append(m)
    # las caras tienen que mirar hacia afuera
    mm.update(); k = sum(p.normal[eje] for p in mm.polygons) * s
    if k < 0:
        bm = bmesh.new(); bm.from_mesh(mm); bmesh.ops.reverse_faces(bm, faces=bm.faces[:]); bm.to_mesh(mm); bm.free()
    for p in mm.polygons: p.use_smooth = True
    piezas.append(o); return o
def rect(eje, s, a0, a1, b0, b1, na, nb):
    """grilla rectangular en el plano perpendicular al eje: frente/cola (eje x): a = y, b = z; costado (eje y): a = x, b = z"""
    g = []
    for j in range(nb + 1):
        f = []
        for i in range(na + 1):
            a = a0 + (a1 - a0) * i / na; b = b0 + (b1 - b0) * j / nb
            f.append((s * 3, a, b) if eje == 0 else (a, s * 3, b))
        g.append(f)
    return g
# trompa: tira de luz de lado a lado con los faros finos en las puntas, toma de aire negra abajo y patente
lamina('luz_frente', M['faro'], rect(0, 1, -.60, .60, .772, .792, 30, 1), 0, 1)
for s in (-1, 1): lamina('faro', M['faro'], rect(0, 1, s * .54, s * .84, .755, .825, 10, 3), 0, 1, .011)
lamina('toma', M['negro'], [[(3, y, z0 + (z1 - z0) * j / 4) for y in [-(.70 - .10 * j / 4) + 2 * (.70 - .10 * j / 4) * i / 28 for i in range(29)]] for j, (z0, z1) in enumerate([(.30, .50)] * 5)], 0, 1)
lamina('pat_f', M['patente'], rect(0, 1, -.2, .2, .345, .445, 6, 2), 0, 1, .014)
# cola: tira roja de lado a lado, paragolpes negro, patente
lamina('luz_cola', M['stop'], rect(0, -1, -.74, .74, .965, 1.0, 30, 2), 0, -1)
for s in (-1, 1): lamina('stop', M['stop'], rect(0, -1, s * .56, s * .86, .94, 1.03, 10, 3), 0, -1, .011)
lamina('paragolpes', M['negro'], rect(0, -1, -.74, .74, .36, .56, 28, 4), 0, -1); lamina('pat_t', M['patente'], rect(0, -1, -.2, .2, .70, .80, 6, 2), 0, -1, .012)
# costados: arcos de plástico en los pasarruedas, juntas de las puertas y manijas
for s in (-1, 1):
    for ax in (AXF, AXR):
        bm = bmesh.new(); A = []
        for i in range(31):
            a = math.radians(-13 + 206 * i / 30); ca, sa = math.cos(a), math.sin(a); zc = RR + .02
            h = hacia((ax + (ARC + .035) * ca, 0, max(.3, zc + (ARC + .035) * sa)), 1, s); y = (h.y if h is not None else s * (medio(ax) - .02)) + s * .014
            A.append([bm.verts.new((ax + r * ca, yy, zc + r * sa)) for r, yy in ((ARC - .012, y - s * .06), (ARC - .012, y), (ARC + .012, y + s * .004), (ARC + .058, y), (ARC + .07, y - s * .012))])
        for i in range(30):
            for j in range(4):
                f = (A[i][j], A[i][j + 1], A[i + 1][j + 1], A[i + 1][j]); bm.faces.new(f if s > 0 else f[::-1])
        mm = bpy.data.meshes.new('arco'); bm.to_mesh(mm); bm.free(); o = bpy.data.objects.new('arco', mm); bpy.context.scene.collection.objects.link(o); mm.materials.append(M['negro'])
        for p in mm.polygons: p.use_smooth = True
        piezas.append(o)
    zar = lambda x: RR + .02 + math.sqrt(max(0, (ARC + .07) ** 2 - (x - AXR) ** 2))            # hasta dónde baja una junta que cae sobre el arco de atrás
    for x, z0, z1 in ((.86, .36, 1.0), (-.115, .36, 1.03), (-1.13, zar(-1.13), 1.06)):
        lamina('junta', M['negro'], rect(1, s, x - .006, x + .006, z0, z1, 1, 12), 1, s, .003)
    lamina('junta_baja', M['negro'], rect(1, s, -1.0, .86, .355, .367, 16, 1), 1, s, .003)
    for x in (.42, -.52): lamina('manija', M['cromo'], rect(1, s, x, x + .2, .925, .95, 3, 1), 1, s, .008)
    # espejo, sobre un pie negro en la base del vidrio
    h = hacia((.86, 0, 1.03), 1, s); ye = h.y if h is not None else s * .9
    for nm, m_, x0, x1, y0, y1, z0, z1, bis in (('espejo', M['pintura'], .80, .93, ye + s * .05, ye + s * .22, 1.035, 1.13, .035), ('espejo_pie', M['negro'], .84, .91, ye - s * .02, ye + s * .08, 1.03, 1.065, .01)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); o = bpy.context.active_object; o.name = nm; o.scale = (x1 - x0, abs(y1 - y0), z1 - z0); bpy.ops.object.transform_apply(scale=True)
        b = o.modifiers.new('b', 'BEVEL'); b.width = bis; b.segments = 3; bpy.ops.object.modifier_apply(modifier='b'); o.data.materials.append(m_); [setattr(p, 'use_smooth', True) for p in o.data.polygons]; piezas.append(o)
# ruedas torneadas: cubierta con hombro redondo, llanta hundida con cinco rayos dobles
RL = RR - .095
def rueda(x, s):
    y = s * (W / 2 - .15); bm = bmesh.new(); SEG = 36
    def torno(perfil):
        an = [[bm.verts.new((x + r * math.cos(2 * math.pi * i / SEG), y + s * off, RR + r * math.sin(2 * math.pi * i / SEG))) for i in range(SEG)] for r, off in perfil]
        fs = []
        for j in range(len(perfil) - 1):
            for i in range(SEG):
                f = (an[j][i], an[j][(i + 1) % SEG], an[j + 1][(i + 1) % SEG], an[j + 1][i]); fs.append(bm.faces.new(f if s < 0 else f[::-1]))
        return fs
    g = torno([(RL, -.12), (RR - .04, -.12), (RR - .008, -.1), (RR, -.07), (RR, .07), (RR - .008, .1), (RR - .04, .12), (RL + .004, .122)])
    l = torno([(RL + .004, .122), (RL - .012, .116), (RL - .022, .06), (RL - .03, .045)]); f = torno([(RL - .03, .045), (.001, .045)])
    def sector(r0, r1, a, da0, da1, off, seg=1):
        v0 = [bm.verts.new((x + r0 * math.cos(a + da0 * (2 * i / seg - 1)), y + s * (off + .012), RR + r0 * math.sin(a + da0 * (2 * i / seg - 1)))) for i in range(seg + 1)]
        v1 = [bm.verts.new((x + r1 * math.cos(a + da1 * (2 * i / seg - 1)), y + s * off, RR + r1 * math.sin(a + da1 * (2 * i / seg - 1)))) for i in range(seg + 1)]
        r = []
        for i in range(seg):
            q = (v0[i], v0[i + 1], v1[i + 1], v1[i]); r.append(bm.faces.new(q[::-1] if s < 0 else q))
        return r
    for k in range(5):
        a = 2 * math.pi * k / 5 + .31
        for d in (-.2, .2): l += sector(.055, RL - .014, a + d * .55, .16 / 1, .045, .1)
    l += torno([(.075, .1), (.07, .114), (.0005, .118)])
    for q in g: q.material_index = 0
    for q in l: q.material_index = 1
    for q in f: q.material_index = 2
    mm = bpy.data.meshes.new('rueda'); bm.to_mesh(mm); bm.free(); o = bpy.data.objects.new('rueda', mm); bpy.context.scene.collection.objects.link(o)
    for k in ('goma', 'llanta', 'negro'): mm.materials.append(M[k])
    for p in mm.polygons: p.use_smooth = True
    piezas.append(o)
for ax in (AXF, AXR):
    for s in (-1, 1): rueda(ax, s)
# todo junto en una sola pieza (un material por tipo de superficie)
bpy.ops.object.select_all(action='DESELECT')
for o in piezas: o.select_set(True)
bpy.context.view_layer.objects.active = car; bpy.ops.object.join(); car.name = 'suv'
car.data.calc_loop_triangles(); print('SUV', len(car.data.vertices), 'v', len(car.data.loop_triangles), 't', [m.name for m in car.data.materials])
bpy.ops.wm.save_as_mainfile(filepath=OUT)
if len(sys.argv) > sys.argv.index('--') + 2:
    bpy.ops.export_scene.gltf(filepath=sys.argv[sys.argv.index('--') + 2], export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT', export_normals=True, export_texcoords=False, export_cameras=False, export_lights=False, export_animations=False)
