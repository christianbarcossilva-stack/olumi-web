# Exporta la persona del .blend a GLB para la web. uso: blender -b x.blend --python exportar.py -- salida.glb [tri_max=14000]
# Saca los ayudantes y lo que tapa la ropa, baja triángulos donde sobran y deja materiales simples (color + transparencia).
import bpy, sys, os
from bl_ext.user_default.mpfb.services.targetservice import TargetService
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; TRI = int(a[1]) if len(a) > 1 else 14000; RELIEVE = 'relieve' in a[2:]   # relieve: la ropa conserva su mapa de relieve (pliegues con volumen)
bm = [o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'Human'][0]
if bm.data.shape_keys: TargetService.bake_targets(bm)
ms = [o for o in bpy.data.objects if o.type == 'MESH']
def aplicar(o, tipos):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        if m.type in tipos:
            try: bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception as e: print('no se pudo aplicar', o.name, m.type, e)
for o in ms: aplicar(o, ('MASK', 'SUBSURF'))
# El cuerpo que queda debajo de la ropa se saca: si no, al bajar triángulos la piel asoma por la tela (pasaba en el pecho y los hombros de la camisa).
# Se mira desde cada punto de la piel hacia afuera: si a menos de 2 cm hay tela, está tapado. Se deja un margen de dos anillos en los bordes
# (cuello, puños, escote) y ese margen se hunde unos milímetros para que tampoco asome ahí.
import bmesh
from mathutils.bvhtree import BVHTree
# ropa = todo lo que se viste (también lo que no trae su grupo «Delete.…»: el suéter y el pantalón de lana no lo traen y la piel asomaba)
NO_ROPA = ('hair', 'brow', 'lash', 'high-poly', 'low-poly', 'eye', 'teeth', 'tongue', 'bob', 'ponytail', 'short0', 'braid', 'bun', 'long0', 'afro')
ropa = [o for o in ms if o is not bm and (('Delete.' + o.name.split('.', 1)[-1]) in bm.vertex_groups or not any(x in o.name.lower() for x in NO_ROPA))]
# Zonas: con los brazos ya bajados (reposo horneado) las mangas quedan pegadas a la cadera y las manos a los muslos. Para decidir qué tapa
# qué, cada punto solo mira la tela de su misma zona: antebrazo y mano, o el resto del cuerpo. Si no, la manga «tapaba» la cadera del
# pantalón y al mover los brazos aparecía un agujero.
HUESOS = {b.name for o in bpy.data.objects if o.type == 'ARMATURE' for b in o.data.bones}
def zonas(o):
    nom = {g.index: g.name for g in o.vertex_groups if g.name in HUESOS}; z = []
    for v in o.data.vertices:
        gs = [g for g in v.groups if g.group in nom]; nm = nom[max(gs, key=lambda g: g.weight).group] if gs else ''
        z.append('b' if ('ForeArm' in nm or 'Hand' in nm) else 'c')   # el brazo de arriba va con el cuerpo (hombro y axila se tapan con la camisa)
    return z
def arboles(telas):
    A = {'b': [], 'c': []}
    for o in telas:
        z = zonas(o)
        for zona in 'bc':
            b2 = bmesh.new(); b2.from_mesh(o.data); b2.verts.ensure_lookup_table()
            bmesh.ops.delete(b2, geom=[f for f in b2.faces if sum(z[v.index] == zona for v in f.verts) * 2 < len(f.verts)], context='FACES')
            b2.transform(o.matrix_world); A[zona].append(BVHTree.FromBMesh(b2)); b2.free()
    return A
def tapar(ob, telas, margen=2, hunde=.006, ambos=False):
    A = arboles(telas); Z = zonas(ob)
    b = bmesh.new(); b.from_mesh(ob.data); b.verts.ensure_lookup_table(); b.normal_update()
    M = ob.matrix_world; N = M.to_3x3().inverted().transposed()
    def tapado(v):
        p = M @ v.co; n = (N @ v.normal).normalized()
        # ambos: también si la tela quedó adentro (lo de abajo la atraviesa: se busca la tela desde 2,5 cm afuera hacia adentro)
        return any(t.ray_cast(p - n * .008, n, .028)[0] is not None or (ambos and t.ray_cast(p + n * .025, -n, .033)[0] is not None) for t in A[Z[v.index]])
    tap = {v.index for v in b.verts if tapado(v)}
    dentro = set(tap)
    for _ in range(margen): dentro = {i for i in dentro if all(e.other_vert(b.verts[i]).index in dentro for e in b.verts[i].link_edges)}
    fuera = [f for f in b.faces if all(v.index in dentro for v in f.verts)]
    borde = {v.index for f in b.faces if not all(v.index in dentro for v in f.verts) for v in f.verts}
    for v in b.verts:
        if v.index in tap and (v.index not in dentro or v.index in borde): v.co -= v.normal * hunde
    n0 = len(b.faces); bmesh.ops.delete(b, geom=fuera, context='FACES')
    sueltos = [v for v in b.verts if not v.link_faces]; bmesh.ops.delete(b, geom=sueltos, context='VERTS')
    b.to_mesh(ob.data); ob.data.update(); print('TAPADO', ob.name, len(tap), 'puntos · caras', n0, '→', len(b.faces)); b.free()
def meter(ob, telas, dentro=.012):
    # lo de abajo que asoma por la tela de arriba (bolsillos, botones, la caña del zapato) se mete 1,2 cm adentro de ella, siguiendo la
    # normal de la tela de arriba (la de cada punto puede apuntar a cualquier lado en un bolsillo); solo donde la tela de arriba de verdad tapa
    A = arboles(telas); Z = zonas(ob)
    M = ob.matrix_world; Mi = M.inverted(); n = 0
    for v in ob.data.vertices:
        p = M @ v.co
        for t in A[Z[v.index]]:
            q, nq, i, d = t.find_nearest(p, .04)
            if q is None or (p - q).dot(nq) < -dentro: continue
            hit = t.ray_cast(p + nq * .05, -nq, .1)[0]
            if hit is None: continue
            v.co = Mi @ (hit - nq * dentro); n += 1; break
    ob.data.update(); print('METIDO', ob.name, n, 'puntos')
if ropa: tapar(bm, ropa)
# Lo mismo con los zapatos: la parte de arriba (la caña) quedaba dentro del pantalón y en algunos puntos lo atravesaba (manchas claras en el jean)
ZAP = ('shoe', 'flats', 'boot', 'sneaker', 'zapat')
for o in ms:
    if o is not bm and any(x in o.name.lower() for x in ZAP):
        telas = [t for t in ropa if t is not o and not any(x in t.name.lower() for x in ZAP)]
        if telas: meter(o, telas); tapar(o, telas, 1, .015, True)
# Capas de ropa sueltas: el pantalón queda debajo de un suéter o una camisa por fuera (se veían manchas del pantalón atravesando el suéter en la
# cintura); una remera «tucked» va al revés, adentro del pantalón.
PANT = ('pants', 'jeans', 'trouser', 'pantal', 'shorts'); ARRIBA = ('sweater', 'shirt', 'polo', 'top', 'blouse', 'remera', 'camis')
pants = [o for o in ropa if any(x in o.name.lower() for x in PANT)]; tops = [o for o in ropa if any(x in o.name.lower() for x in ARRIBA)]
for t in tops:
    for pa in pants:
        if 'tucked' in t.name.lower(): meter(t, [pa]); tapar(t, [pa], 0, .025, True)
        else: meter(pa, [t]); tapar(pa, [t], 0, .025, True)
def tris(o): o.data.calc_loop_triangles(); return len(o.data.loop_triangles)
tot = sum(tris(o) for o in ms)
if tot > TRI:
    # se achica más lo que más pesa (cuerpo y ropa); pelo, cejas, pestañas y ojos quedan como están
    gr = [o for o in ms if tris(o) > 2500 and 'chaleco' not in o.name];      # el chaleco no se achica: se le desarman los bordes
    fijo = tot - sum(tris(o) for o in gr); k = max(.18, (TRI - fijo) / max(1, sum(tris(o) for o in gr)))
    for o in gr:
        d = o.modifiers.new('liviano', 'DECIMATE'); d.ratio = min(1, k * (1.25 if o is bm else 1)); d.use_collapse_triangulate = True
        # el esqueleto tiene que quedar último
        bpy.context.view_layer.objects.active = o
        while o.modifiers[0].name != 'liviano': bpy.ops.object.modifier_move_up(modifier='liviano')
        aplicar(o, ('DECIMATE',))
for m in bpy.data.materials:
    if not m.use_nodes: continue
    if not m.name.endswith('.body'): m.use_backface_culling = False
    # sin relieve ni oclusión: en la web pesan y casi no se notan a este tamaño
    ropa = not any(x in m.name.lower() for x in ('body', 'hair', 'brow', 'lash', 'eye', 'teeth', 'tongue', 'bob', 'ponytail', 'short0'))
    for n in list(m.node_tree.nodes):
        if n.bl_idname == 'ShaderNodeNormalMap' and not (RELIEVE and ropa): m.node_tree.nodes.remove(n)
    bs = [n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled']
    for b in bs:
        # lo que llega al material, directo o a través de otro nodo (el relieve pasa por el nodo «mapa de normales»)
        usados, cola = set(), [b]
        while cola:
            x = cola.pop()
            for l in m.node_tree.links:
                if l.to_node == x and l.from_node not in usados: usados.add(l.from_node); cola.append(l.from_node)
        for n in list(m.node_tree.nodes):
            if n.bl_idname == 'ShaderNodeTexImage' and n not in usados: m.node_tree.nodes.remove(n)
        b.inputs['Roughness'].default_value = max(.55, b.inputs['Roughness'].default_value); b.inputs['Metallic'].default_value = 0
if RELIEVE:
    # sombras de los pliegues: la ropa de MakeHuman trae su mapa de oclusión (_ao.png: axilas, codos, entrepierna, cintura) y no se usaba.
    # Se oscurece la textura de color con él (70 %), así los pliegues tienen profundidad también de lejos y en teléfonos.
    import numpy as np, tempfile
    tmp = tempfile.mkdtemp(); hechas = {}
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.bl_idname != 'ShaderNodeTexImage' or not n.image: continue
            im = n.image; fp = bpy.path.abspath(im.filepath); base = os.path.basename(fp)
            if '_diffuse' not in base: continue
            if fp in hechas: n.image = hechas[fp]; continue
            ao = os.path.join(os.path.dirname(fp), base.replace('_diffuse', '_ao'))
            if not os.path.exists(ao): continue
            a2 = bpy.data.images.load(ao); w, h = im.size
            if tuple(a2.size) != (w, h): a2.scale(w, h)
            P = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(P); P = P.reshape(-1, 4)
            Q = np.empty(w * h * 4, np.float32); a2.pixels.foreach_get(Q); Q = Q.reshape(-1, 4)
            P[:, :3] *= (1 - .7 * (1 - Q[:, 0:1]))
            nv = bpy.data.images.new(base.replace('_diffuse', '_diffuse_ao').rsplit('.', 1)[0], w, h, alpha=True)
            nv.pixels.foreach_set(P.ravel()); nv.filepath_raw = os.path.join(tmp, base.replace('_diffuse', '_diffuse_ao')); nv.file_format = 'PNG'; nv.save()
            n.image = nv; hechas[fp] = nv; print('SOMBRAS', os.path.basename(ao))
tot = 0
for o in ms: t = tris(o); tot += t; print('MALLA', o.name, len(o.data.vertices), 'v', t, 't')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=False, export_skins=True, export_animations=False, export_morph=False,
                          export_yup=True, export_image_format='AUTO', export_tangents=False, export_def_bones=False)
print('GLB', out, round(os.path.getsize(out) / 1024), 'KB', tot, 'triangulos')
