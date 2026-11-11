# Suma casco de obra y chaleco reflectivo a una persona ya armada. uso: blender -b persona.blend --python epp.py -- salida.blend [casco=blanco|amarillo] [chaleco=1]
# El chaleco sale del torso del cuerpo (se copia, se separa unos centímetros y se abre el cuello); el casco es una cúpula con visera, pegada a la cabeza.
import bpy, bmesh, sys, math, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; OUT = a[0]; COL = a[1] if len(a) > 1 else 'blanco'
body = bpy.data.objects['Human']; rig = bpy.data.objects['Human.rig']
# las medidas se toman del cuerpo ya formado (con sus rasgos aplicados), no del molde base
from bl_ext.user_default.mpfb.services.targetservice import TargetService
if body.data.shape_keys: TargetService.bake_targets(body)
G = {g.index: g.name.replace('mixamorig:', '') for g in body.vertex_groups}
def pesos(v):
    d = {}
    for g in v.groups: d[G[g.group]] = d.get(G[g.group], 0) + g.weight
    return d
me = body.data; PW = [pesos(v) for v in me.vertices]
cuerpo = {v.index for v in me.vertices if PW[v.index].get('body', 0) > 0 or not any(k.startswith(('helper-', 'joint-')) for k in PW[v.index])}
hueso = lambda n: rig.data.bones['mixamorig:' + n].head_local
def enlazar(o, grupos=None):
    o.parent = rig; m = o.modifiers.new('esqueleto', 'ARMATURE'); m.object = rig
    for p in o.data.polygons: p.use_smooth = True
def material(nombre, color, rug, imagen=None):
    m = bpy.data.materials.new('Human.' + nombre); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rug; m.use_backface_culling = False
    if imagen:
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = imagen; m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    return m

# ---------- chaleco ----------
def chaleco():
    TOR = ('Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'Hips'); BRA = ('LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'); CAB = ('Neck', 'Head')
    zc = hueso('Hips').z + .035; zn = hueso('Neck').z
    def torso(o, solo=None):
        g = {x.index: x.name.replace('mixamorig:', '') for x in o.vertex_groups}; r = set()
        for v in o.data.vertices:
            if solo is not None and v.index not in solo: continue
            w = {}
            for x in v.groups: w[g[x.group]] = w.get(g[x.group], 0) + x.weight
            if sum(w.get(k, 0) for k in TOR) > (.5 if solo is None else .3) and sum(w.get(k, 0) for k in BRA) < (.28 if solo is None else .62) and sum(w.get(k, 0) for k in CAB) < (.22 if solo is None else .55) and zc - (.09 if solo is None else .14) < v.co.z < zn + (.02 if solo is None else .06) and w.get('LeftUpLeg', 0) + w.get('RightUpLeg', 0) < .45: r.add(v.index)
        return r
    # el molde es el torso del cuerpo (malla pareja); cada punto se separa lo necesario para quedar por fuera de la ropa que haya
    ropa = [o for o in bpy.data.objects if o.type == 'MESH' and o is not body and o.name.split('.')[-1] not in ('casco', 'chaleco') and not o.name.split('.')[-1].startswith(('eye', 'low-poly', 'high-poly', 'short', 'bob', 'long', 'ponytail', 'afro', 'braid', 'teeth', 'tongue', 'shoes'))]
    src = body; sm = src.data; sel = torso(src, cuerpo)
    zv = zn - .2   # donde empieza el escote en V
    caras = []
    for p in sm.polygons:
        if not all(i in sel for i in p.vertices): continue
        c = p.center
        caras.append(p)
    idx = sorted({i for p in caras for i in p.vertices}); mapa = {i: k for k, i in enumerate(idx)}
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); arboles = [BVHTree.FromObject(o, dg) for o in ropa]
    sep = {}
    for i in idx:
        v = sm.vertices[i]; d = 0
        for t in arboles:
            h = t.ray_cast(v.co - v.normal * .01, v.normal, .1)
            if h[0] is not None: d = max(d, h[3] - .01)
        sep[i] = min(.09, max(.022, d + .02))
    vec = {i: set() for i in idx}
    for p in caras:
        vs = list(p.vertices)
        for k in range(len(vs)): vec[vs[k]].add(vs[k - 1]); vec[vs[k - 1]].add(vs[k])
    for _ in range(6): sep = {i: max(sep[i], .5 * sep[i] + .5 * sum(sep[j] for j in vec[i]) / max(1, len(vec[i]))) for i in idx}    # pareja y nunca más adentro que la ropa
    co = [sm.vertices[i].co + sm.vertices[i].normal * sep[i] for i in idx]
    nm = bpy.data.meshes.new('chaleco'); nm.from_pydata([tuple(c) for c in co], [], [tuple(mapa[i] for i in p.vertices) for p in caras]); nm.update()
    o = bpy.data.objects.new('Human.chaleco', nm); bpy.context.scene.collection.objects.link(o)
    vg = {}
    for k, i in enumerate(idx):
        for g in sm.vertices[i].groups:
            n = src.vertex_groups[g.group].name
            if n in rig.data.bones:
                if n not in vg: vg[n] = o.vertex_groups.new(name=n)
                vg[n].add([k], g.weight, 'REPLACE')
    bm = bmesh.new(); bm.from_mesh(nm)
    bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=18)     # agujeritos sueltos (no el cuello, las sisas ni el borde de abajo)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    for _ in range(2): bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # bordes: se cortan por curvas limpias (abajo recto, sisas por un plano inclinado desde el hombro, cuello redondo con escote en V adelante)
    # y los puntos del borde se llevan justo a esa curva, así no queda el dentado de la malla
    sh = hueso('LeftArm'); xs = abs(sh.x); zs = sh.z + .03; yn = hueso('Neck').y; zb = zc - .075; NA = Vector((1, 0, .45)).normalized()
    def F(p):
        f = p.z - zb
        for sx in (-1, 1): f = min(f, -(Vector((sx * p.x, 0, p.z)) - Vector((xs - .04, 0, zs))).dot(NA))
        if p.z > zn - .09: f = min(f, math.hypot(p.x, p.y - yn) - .082)
        if p.y < yn + .02 and p.z > zv: f = min(f, abs(p.x) - (p.z - zv) * .5)
        return f
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(F(v.co) < 0 for v in f.verts)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS'); bm.normal_update()
    for _ in range(3):
        for v in [v for v in bm.verts if v.is_boundary]:
            f = F(v.co)
            if f > .045: continue                      # borde que no es de estas curvas (no debería quedar ninguno)
            e = .004; g = Vector(((F(v.co + Vector((e, 0, 0))) - f) / e, (F(v.co + Vector((0, e, 0))) - f) / e, (F(v.co + Vector((0, 0, e))) - f) / e)); g -= v.normal * g.dot(v.normal)
            if g.length > .2: v.co -= g * (f / g.length_squared) * .8
    for _ in range(2): bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary and any(w.is_boundary for e in v.link_edges for w in e.verts)], factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(nm); bm.free()
    # mapa: alrededor del torso (u) y altura (v); la costura queda en la espalda
    zs = [v.co.z for v in nm.vertices]; z0, z1 = min(zs), max(zs); cx = sum(v.co.x for v in nm.vertices) / len(nm.vertices); cy = sum(v.co.y for v in nm.vertices) / len(nm.vertices)
    uv = nm.uv_layers.new(name='UVMap')
    for p in nm.polygons:
        us = []
        for li in p.loop_indices:
            c = nm.vertices[nm.loops[li].vertex_index].co; us.append(math.atan2(c.x - cx, -(c.y - cy)) / (2 * math.pi) + .5)
        if max(us) - min(us) > .5: us = [u + 1 if u < .5 else u for u in us]     # cara que cruza la costura
        for li, u in zip(p.loop_indices, us):
            c = nm.vertices[nm.loops[li].vertex_index].co; uv.data[li].uv = (u, (c.z - z0) / (z1 - z0))
    # textura: amarillo flúo con dos bandas grises horizontales y dos tiradores
    N = 512; im = bpy.data.images.new('chaleco_color', N, N); px = [0.0] * (N * N * 4)
    AM = (.78, .93, .05); GR = (.80, .82, .84); BO = (.60, .72, .03)
    for y in range(N):
        v = y / N
        for x in range(N):
            u = (x / N) % 1; c = AM
            if .16 < v < .24 or .34 < v < .42: c = GR
            elif v >= .42 and (abs(u - .39) < .028 or abs(u - .61) < .028 or abs(u - .11) < .028 or abs(u - .89) < .028): c = GR
            elif v < .025 or v > .975: c = BO
            k = (y * N + x) * 4; px[k:k + 4] = (*c, 1)
    im.pixels = px; im.filepath_raw = os.path.join(os.path.dirname(OUT), 'chaleco_color.png'); im.file_format = 'PNG'; im.save(); im.pack()
    nm.materials.append(material('chaleco', (1, 1, 1), .78, im)); enlazar(o); print('CHALECO', len(nm.vertices), 'v', len(nm.polygons), 'caras')
    # lo que queda tapado por el chaleco se saca de la ropa de abajo: así, al moverse, la remera no puede asomar a través del chaleco
    bv = bmesh.new(); bv.from_mesh(nm); arbol = BVHTree.FromBMesh(bv)
    for r in ropa:
        if len(torso(r)) < 150 or sum(v.co.z for v in r.data.vertices) / len(r.data.vertices) < hueso('Hips').z + .1: continue    # solo prendas de arriba: el pantalón queda entero
        b2 = bmesh.new(); b2.from_mesh(r.data); b2.normal_update(); tap = []
        for f in b2.faces:
            c = f.calc_center_median(); h = arbol.ray_cast(c + f.normal * .002, f.normal, .09)
            if h[0] is not None and all(arbol.ray_cast(v.co + f.normal * .002, f.normal, .11)[0] is not None for v in f.verts): tap.append(f)
        bmesh.ops.delete(b2, geom=tap, context='FACES'); b2.to_mesh(r.data); b2.free(); print('TAPADO', r.name, len(tap), 'caras fuera')
    bv.free()

# ---------- casco ----------
def casco():
    hi = {g.index for g in body.vertex_groups if g.name == 'mixamorig:Head'}
    hv = [v.co for v in me.vertices if v.index in cuerpo and sum(g.weight for g in v.groups if g.group in hi) > .9]
    top = max(c.z for c in hv); arr = [c for c in hv if c.z > top - .13]
    x0, x1 = min(c.x for c in arr), max(c.x for c in arr); y0, y1 = min(c.y for c in arr), max(c.y for c in arr)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; rx = (x1 - x0) / 2 + .024; ry = (y1 - y0) / 2 + .026; zr = top - .074; rz = top + .036 - zr
    bm = bmesh.new(); SEG, AN = 28, 9; anillos = []
    for j in range(AN + 1):      # cúpula
        t = j / AN * math.pi / 2; r = math.cos(t); z = zr + rz * math.sin(t)
        if j == AN: anillos.append([bm.verts.new((cx, cy, zr + rz))]); break
        anillos.append([bm.verts.new((cx + rx * r * math.sin(2 * math.pi * i / SEG), cy - ry * r * math.cos(2 * math.pi * i / SEG), z)) for i in range(SEG)])
    for j in range(AN - 1):
        for i in range(SEG): bm.faces.new((anillos[j][i], anillos[j][(i + 1) % SEG], anillos[j + 1][(i + 1) % SEG], anillos[j + 1][i]))
    for i in range(SEG): bm.faces.new((anillos[AN - 1][i], anillos[AN - 1][(i + 1) % SEG], anillos[AN][0]))
    # ala: un borde corto todo alrededor y visera adelante (i=0 es el frente)
    ala = []
    for i in range(SEG):
        an = 2 * math.pi * i / SEG; fr = max(0, math.cos(an)) ** 2.2; e = .012 + .05 * fr
        ala.append(bm.verts.new((cx + (rx + e) * math.sin(an), cy - (ry + e) * math.cos(an), zr - .004 - .010 * fr)))
    for i in range(SEG): bm.faces.new((ala[i], ala[(i + 1) % SEG], anillos[0][(i + 1) % SEG], anillos[0][i]))
    nm = bpy.data.meshes.new('casco'); bm.normal_update(); bm.to_mesh(nm); bm.free()
    o = bpy.data.objects.new('Human.casco', nm); bpy.context.scene.collection.objects.link(o)
    g = o.vertex_groups.new(name='mixamorig:Head'); g.add(list(range(len(nm.vertices))), 1, 'REPLACE')
    col = {'blanco': (.93, .93, .92), 'amarillo': (.96, .78, .05), 'azul': (.07, .25, .62), 'naranja': (.95, .42, .05)}.get(COL, (.93, .93, .92))
    nm.materials.append(material('casco', col, .38)); enlazar(o)
    # el pelo que queda dentro del casco se saca (lo de abajo del borde sigue)
    for h in [x for x in bpy.data.objects if x.type == 'MESH' and x.name.split('.')[-1].startswith(('short', 'bob', 'long', 'ponytail', 'afro', 'braid'))]:
        b2 = bmesh.new(); b2.from_mesh(h.data); fuera = [f for f in b2.faces if f.calc_center_median().z > zr - .012]
        bmesh.ops.delete(b2, geom=fuera, context='FACES'); b2.to_mesh(h.data); b2.free(); print('PELO recortado', h.name, len(h.data.polygons), 'caras')
    print('CASCO', len(nm.vertices), 'v', 'borde z', round(zr, 3), 'tope', round(top, 3))
if len(a) < 3 or a[2] != '0': chaleco()
casco()
bpy.ops.wm.save_as_mainfile(filepath=OUT)
