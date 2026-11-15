# Postura de reposo natural (Christian, 15/11 11:51: «los brazos están flacos y caídos, la posición de reposo no es la mejor»).
# MakeHuman entrega la persona con los brazos en A. La oficina los bajaba al costado girando los huesos con «piel lineal» (la de la web):
# el hombro se hundía, la manga se inflaba arriba y el brazo quedaba fino. Acá se bajan en Blender con «conservar volumen»
# (cuaterniones duales) y esa forma queda como el nuevo reposo: en la oficina, parado, casi no hay que girar nada.
# uso: blender -b persona.blend --python reposo.py -- salida.blend [abre=0.12] [codo=0.22]
import bpy, sys, math
from mathutils import Vector, Matrix
A = sys.argv[sys.argv.index('--') + 1:]
out = A[0]; ABRE = float(A[1]) if len(A) > 1 else .12; CODO = float(A[2]) if len(A) > 2 else .22; MODO = A[3] if len(A) > 3 else 'suave'; CLAV = float(A[4]) if len(A) > 4 else .2
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
try:
    from bl_ext.user_default.mpfb.services.targetservice import TargetService
    bm = next((o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'Human'), None)
    if bm and bm.data.shape_keys: TargetService.bake_targets(bm)
except Exception as e: print('sin MPFB', e)
mallas = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
for o in mallas:
    if o.data.shape_keys:   # lo que quede como forma se fija (no se puede aplicar el esqueleto sobre formas)
        bpy.context.view_layer.objects.active = o
        for sk in list(o.data.shape_keys.key_blocks)[::-1]: o.shape_key_remove(sk) if sk.name != 'Basis' else None
        if o.data.shape_keys: o.shape_key_remove(o.data.shape_keys.key_blocks[0])
def pb(n): return arm.pose.bones.get('mixamorig:' + n) or arm.pose.bones.get(n)
def apuntar(b, d):
    M = arm.matrix_world @ b.matrix; cab = M.translation.copy(); act = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    R = act.rotation_difference(d.normalized()).to_matrix().to_4x4(); N = R @ M; N.translation = cab
    b.matrix = arm.matrix_world.inverted() @ N; bpy.context.view_layer.update()
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
for S, sg in (('Left', 1), ('Right', -1)):
    # Blender: la persona mira a -Y, su izquierda es +X, arriba +Z
    brazo = Vector((sg * ABRE, .02, -1)); antebrazo = Vector((sg * ABRE * .8, -math.sin(CODO), -math.cos(CODO)))
    # hombros caídos y relajados: la clavícula baja un poco (si no, el hombro queda cuadrado, como con hombreras)
    cl = pb(S + 'Shoulder')
    if cl and CLAV:
        M = arm.matrix_world @ cl.matrix; cab = M.translation.copy(); R = Matrix.Rotation(sg * CLAV, 4, 'Y'); N = R @ M; N.translation = cab
        cl.matrix = arm.matrix_world.inverted() @ N; bpy.context.view_layer.update()
    b = pb(S + 'Arm'); f = pb(S + 'ForeArm'); h = pb(S + 'Hand')
    if b: apuntar(b, brazo)
    if f: apuntar(f, antebrazo)
    if h: apuntar(h, antebrazo)
bpy.ops.object.mode_set(mode='OBJECT')
for o in mallas:
    bpy.context.view_layer.objects.active = o
    for m in o.modifiers:
        if m.type == 'ARMATURE':
            m.use_deform_preserve_volume = MODO == 'volumen'
            cs = None
            if MODO == 'suave':   # piel lineal + suavizado correctivo: alisa lo que se arruga o se hunde sin perder el dibujo
                cs = o.modifiers.new('suave', 'CORRECTIVE_SMOOTH'); cs.factor = .5; cs.iterations = 8; cs.smooth_type = 'LENGTH_WEIGHTED'; cs.rest_source = 'ORCO'; cs.use_pin_boundary = True
                # solo hombros y brazos (donde gira): grupo de vértices con el peso de esos huesos
                g = o.vertex_groups.get('_suave') or o.vertex_groups.new(name='_suave')
                zona = [o.vertex_groups.get(x) for x in [p + n for p in ('mixamorig:', '') for n in ('LeftArm', 'RightArm', 'LeftShoulder', 'RightShoulder', 'LeftForeArm', 'RightForeArm', 'Spine2', 'Neck')]]
                idx = {z.index for z in zona if z}
                for v in o.data.vertices:
                    w = sum(gg.weight for gg in v.groups if gg.group in idx)
                    if w > .01: g.add([v.index], min(1, w * 1.5), 'REPLACE')
                cs.vertex_group = g.name
                bpy.ops.object.modifier_move_to_index(modifier=cs.name, index=list(o.modifiers).index(m) + 1)
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
                if cs: bpy.ops.object.modifier_apply(modifier=cs.name)
                print('fijado', o.name)
            except Exception as e: print('no se pudo', o.name, e)
            break
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
for o in mallas:
    m = o.modifiers.new('Armature', 'ARMATURE'); m.object = arm; m.use_deform_preserve_volume = False
bpy.ops.wm.save_as_mainfile(filepath=out); print('ok', out)
