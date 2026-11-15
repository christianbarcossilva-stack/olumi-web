# Le pone a una persona 3D sin esqueleto (de un generador con IA, un escaneo o un pack) el esqueleto tipo Mixamo que usa
# avatar-core.js, con pesos automáticos, y la deja lista para la oficina. Christian, 15/11: «quiero que aprendas a hacer esto,
# porque los clientes nos pueden pedir avatares».
# uso: blender -b --python autoesqueleto.py -- entrada.(glb|gltf|fbx|obj) salida.glb [alto_m=1.75] [quitar_esqueleto=0|1]
# La persona tiene que estar parada, de frente, con los brazos abiertos (en T o en A). Si mira para otro lado, se gira sola
# (la nariz y la punta de los pies van hacia adelante).
import bpy, bmesh, sys, os, math
from mathutils import Vector
A = sys.argv[sys.argv.index('--') + 1:]
src, out = A[0], A[1]; ALTO = float(A[2]) if len(A) > 2 else 1.75; QUITAR = len(A) > 3 and A[3] == '1'
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=src)
elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
elif ext == '.obj': bpy.ops.wm.obj_import(filepath=src)
sc = bpy.context.scene
mallas = [o for o in sc.objects if o.type == 'MESH' and not o.name.lower().startswith('icosphere')]
for o in [o for o in sc.objects if o.type == 'MESH' and o not in mallas]: bpy.data.objects.remove(o, do_unlink=True)
# si ya traía esqueleto y se pide sacarlo: la malla queda en su pose de reposo
for o in mallas:
    for m in list(o.modifiers):
        if m.type == 'ARMATURE': o.modifiers.remove(m)
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    o.vertex_groups.clear()
for o in [o for o in sc.objects if o.type in ('ARMATURE', 'EMPTY')]: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in mallas: o.select_set(True)
bpy.context.view_layer.objects.active = mallas[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
V = [v.co.copy() for o in mallas for v in o.data.vertices]
mn = Vector((min(v.x for v in V), min(v.y for v in V), min(v.z for v in V))); mx = Vector((max(v.x for v in V), max(v.y for v in V), max(v.z for v in V)))
# escala a la altura pedida y pies en el piso, centrado
H0 = mx.z - mn.z; k = ALTO / H0; c = (mn + mx) / 2
for o in mallas:
    for v in o.data.vertices: v.co = Vector(((v.co.x - c.x) * k, (v.co.y - c.y) * k, (v.co.z - mn.z) * k))
V = [v.co.copy() for o in mallas for v in o.data.vertices]; H = ALTO
# hacia dónde mira: los pies sobresalen hacia adelante (en Blender, adelante es -Y)
pies = [v for v in V if v.z < .04 * H]
tob = [v.y for v in V if .05 * H < v.z < .09 * H]; tobillo = sum(tob) / len(tob) if tob else 0
punta = min(v.y for v in pies) if pies else 0; talon = max(v.y for v in pies) if pies else 0
print('mira: punta', round(punta, 3), 'talon', round(talon, 3), 'tobillo', round(tobillo, 3))
if abs(talon - tobillo) > abs(punta - tobillo):   # el pie sobresale hacia +Y: mira para atrás, se gira media vuelta
    for o in mallas:
        for v in o.data.vertices: v.co.x, v.co.y = -v.co.x, -v.co.y
    V = [v.co.copy() for o in mallas for v in o.data.vertices]
def medio_y(z0, z1, xmax=None):
    l = [v.y for v in V if z0 < v.z < z1 and (xmax is None or abs(v.x) < xmax)]
    return sum(l) / len(l) if l else 0
yT = medio_y(.45 * H, .75 * H, .12 * H)
P = {}
P['Hips'] = Vector((0, yT, .53 * H)); P['Spine'] = Vector((0, yT, .60 * H)); P['Spine1'] = Vector((0, yT, .67 * H)); P['Spine2'] = Vector((0, yT, .74 * H))
P['Neck'] = Vector((0, medio_y(.80 * H, .86 * H, .06 * H), .835 * H)); P['Head'] = Vector((0, P['Neck'].y, .875 * H)); P['HeadTop'] = Vector((0, P['Neck'].y, 1.0 * H))
for S, sg in (('Left', 1), ('Right', -1)):
    # Blender: la izquierda de la persona que mira a -Y es +X
    yl = medio_y(.0, .5 * H, .25 * H)
    P[S + 'UpLeg'] = Vector((sg * .052 * H, yT, .515 * H)); P[S + 'Leg'] = Vector((sg * .055 * H, yl - .01 * H, .285 * H))
    P[S + 'Foot'] = Vector((sg * .058 * H, yl + .01 * H, .048 * H))
    pie = [v for v in V if v.z < .05 * H and sg * v.x > 0]
    P[S + 'ToeBase'] = Vector((sg * .065 * H, (min(v.y for v in pie) * .55 + P[S + 'Foot'].y * .45) if pie else P[S + 'Foot'].y - .07 * H, .012 * H))
    P[S + 'Shoulder'] = Vector((sg * .02 * H, yT, .815 * H)); hombro = Vector((sg * .105 * H, yT, .815 * H)); P[S + 'Arm'] = hombro
    brazo = [v for v in V if .45 * H < v.z < .9 * H and sg * v.x > .16 * H]
    if brazo:
        punta_dedos = max(brazo, key=lambda v: (v - hombro).length)
    else:
        punta_dedos = hombro + Vector((sg * .2 * H, 0, -.42 * H))
    d = (punta_dedos - hombro); L = d.length; d.normalize()
    P[S + 'ForeArm'] = hombro + d * L * .425; P[S + 'Hand'] = hombro + d * L * .755; P[S + 'HandEnd'] = punta_dedos
# esqueleto
arm_d = bpy.data.armatures.new('Esqueleto'); arm = bpy.data.objects.new('Esqueleto', arm_d); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
E = arm_d.edit_bones
def hueso(n, cabeza, cola, padre=None):
    b = E.new(n); b.head = P[cabeza] if isinstance(cabeza, str) else cabeza; b.tail = P[cola] if isinstance(cola, str) else cola
    if padre: b.parent = E[padre]; b.use_connect = False
    return b
hueso('Hips', 'Hips', 'Spine'); hueso('Spine', 'Spine', 'Spine1', 'Hips'); hueso('Spine1', 'Spine1', 'Spine2', 'Spine'); hueso('Spine2', 'Spine2', 'Neck', 'Spine1')
hueso('Neck', 'Neck', 'Head', 'Spine2'); hueso('Head', 'Head', 'HeadTop', 'Neck')
for S in ('Left', 'Right'):
    hueso(S + 'Shoulder', S + 'Shoulder', S + 'Arm', 'Spine2'); hueso(S + 'Arm', S + 'Arm', S + 'ForeArm', S + 'Shoulder')
    hueso(S + 'ForeArm', S + 'ForeArm', S + 'Hand', S + 'Arm'); hueso(S + 'Hand', S + 'Hand', S + 'HandEnd', S + 'ForeArm')
    hueso(S + 'UpLeg', S + 'UpLeg', S + 'Leg', 'Hips'); hueso(S + 'Leg', S + 'Leg', S + 'Foot', S + 'UpLeg')
    hueso(S + 'Foot', S + 'Foot', S + 'ToeBase', S + 'Leg'); hueso(S + 'ToeBase', S + 'ToeBase', P[S + 'ToeBase'] + Vector((0, -.04 * H, 0)), S + 'Foot')
# rodilla un poco hacia adelante para que doble hacia el lado correcto
for S in ('Left', 'Right'):
    E[S + 'Leg'].head.y -= .006 * H; E[S + 'UpLeg'].tail.y -= .006 * H
    E[S + 'ForeArm'].head.y += .004 * H; E[S + 'Arm'].tail.y += .004 * H
bpy.ops.object.mode_set(mode='OBJECT')
# pesos automáticos (calor). El calor falla con mallas de varias piezas o con vértices repetidos (lo normal en modelos generados):
# se calcula sobre una copia soldada y se pasa a la malla real por cercanía de superficie.
def pesos(o):
    cp = o.copy(); cp.data = o.data.copy(); sc.collection.objects.link(cp)
    bm = bmesh.new(); bm.from_mesh(cp.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.002 * H); bm.to_mesh(cp.data); bm.free()
    bpy.ops.object.select_all(action='DESELECT'); cp.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    sin = sum(1 for v in cp.data.vertices if not v.groups); print('calor', o.name, 'sin peso', sin, 'de', len(cp.data.vertices))
    for n in [g.name for g in cp.vertex_groups]:
        if not o.vertex_groups.get(n): o.vertex_groups.new(name=n)
    dt = o.modifiers.new('pasa', 'DATA_TRANSFER'); dt.object = cp; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=dt.name)
    bpy.data.objects.remove(cp, do_unlink=True)
    am = o.modifiers.new('Esqueleto', 'ARMATURE'); am.object = arm; o.parent = arm; o.matrix_parent_inverse.identity()
    # lo que haya quedado sin peso, al hueso más cercano
    medios = [(b.name, (b.head_local + b.tail_local) / 2) for b in arm.data.bones]; n0 = 0
    for v in o.data.vertices:
        if any(g.weight > 1e-4 for g in v.groups): continue
        nm = min(medios, key=lambda t: (t[1] - v.co).length)[0]; (o.vertex_groups.get(nm) or o.vertex_groups.new(name=nm)).add([v.index], 1.0, 'REPLACE'); n0 += 1
    print('malla', o.name, 'vértices', len(o.data.vertices), 'completados a mano', n0)
for o in mallas: pesos(o)
bpy.ops.object.select_all(action='DESELECT')
for o in [arm] + mallas: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='AUTO', export_animations=False, export_skins=True, export_yup=True)
print('ok', out, 'alto', ALTO, 'huesos', len(arm_d.bones))
