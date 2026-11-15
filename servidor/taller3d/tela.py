# Reposo con tela de verdad (prueba, 15/11 tarde). Christian: «la ropa va mejorando muy de a poco, metele más tiempo y detallá más».
# reposo.py baja los brazos girando huesos: la manga sigue al brazo como un tubo rígido (de ahí el aire de hombreras). Acá los brazos bajan
# en una animación y la camisa se simula como tela (peso, gravedad, choque con el cuerpo): el torso queda sujeto al cuerpo y la manga cae
# sobre el brazo. La forma del último cuadro queda como el nuevo reposo, igual que en reposo.py.
# uso: blender -b persona.blend --python tela.py -- salida.blend [abre=0.07] [codo=0.22] [clav=0.35] [cuadros=40]
import bpy, sys, math
from mathutils import Vector, Matrix
A = sys.argv[sys.argv.index('--') + 1:]
out = A[0]; ABRE = float(A[1]) if len(A) > 1 else .07; CODO = float(A[2]) if len(A) > 2 else .22; CLAV = float(A[3]) if len(A) > 3 else .35; N = int(A[4]) if len(A) > 4 else 40
sc = bpy.context.scene
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
try:
    from bl_ext.user_default.mpfb.services.targetservice import TargetService
    bm = next((o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'Human'), None)
    if bm and bm.data.shape_keys: TargetService.bake_targets(bm)
except Exception as e: print('sin MPFB', e)
bm = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'Human')
mallas = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
for o in mallas:
    if o.data.shape_keys:
        bpy.context.view_layer.objects.active = o
        for sk in list(o.data.shape_keys.key_blocks)[::-1]: o.shape_key_remove(sk) if sk.name != 'Basis' else None
        if o.data.shape_keys: o.shape_key_remove(o.data.shape_keys.key_blocks[0])
NO_ROPA = ('hair', 'brow', 'lash', 'high-poly', 'low-poly', 'eye', 'teeth', 'tongue', 'bob', 'ponytail', 'short0', 'braid', 'bun', 'long0', 'afro', 'beard', 'moustache')
def grupos(o, nombres):
    idx = {g.index for g in o.vertex_groups if any(g.name in (p + n) for p in ('mixamorig:', '') for n in nombres)}
    return [sum(gg.weight for gg in v.groups if gg.group in idx) for v in o.data.vertices]
BRAZO = [s + n for s in ('Left', 'Right') for n in ('Arm', 'ForeArm', 'Hand')]
telas = [o for o in mallas if o is not bm and not any(x in o.name.lower() for x in NO_ROPA) and max(grupos(o, BRAZO) or [0]) > .3]
print('TELAS', [o.name for o in telas])
def pb(n): return arm.pose.bones.get('mixamorig:' + n) or arm.pose.bones.get(n)
def apuntar(b, d):
    M = arm.matrix_world @ b.matrix; cab = M.translation.copy(); act = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    R = act.rotation_difference(d.normalized()).to_matrix().to_4x4(); Nn = R @ M; Nn.translation = cab
    b.matrix = arm.matrix_world.inverted() @ Nn; bpy.context.view_layer.update()
# animación: cuadro 1 en A; a los dos tercios, los brazos abajo; el resto, quieto para que la tela se asiente
T = max(2, int(N * .6)); sc.frame_start = 1; sc.frame_end = N; sc.frame_set(1)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
huesos = [pb(S + n) for S in ('Left', 'Right') for n in ('Shoulder', 'Arm', 'ForeArm', 'Hand')]
for b in huesos:
    if b: b.rotation_mode = 'QUATERNION'; b.keyframe_insert('rotation_quaternion', frame=1)
for S, sg in (('Left', 1), ('Right', -1)):
    brazo = Vector((sg * ABRE, .02, -1)); antebrazo = Vector((sg * ABRE * .8, -math.sin(CODO), -math.cos(CODO)))
    cl = pb(S + 'Shoulder')
    if cl and CLAV:
        M = arm.matrix_world @ cl.matrix; cab = M.translation.copy(); R = Matrix.Rotation(sg * CLAV, 4, 'Y'); Nn = R @ M; Nn.translation = cab
        cl.matrix = arm.matrix_world.inverted() @ Nn; bpy.context.view_layer.update()
    b = pb(S + 'Arm'); f = pb(S + 'ForeArm'); h = pb(S + 'Hand')
    if b: apuntar(b, brazo)
    if f: apuntar(f, antebrazo)
    if h: apuntar(h, antebrazo)
for b in huesos:
    if b: b.keyframe_insert('rotation_quaternion', frame=T)
bpy.ops.object.mode_set(mode='OBJECT')
# cuerpo: suavizado correctivo en hombros y brazos (como reposo.py) y choque para la tela
bpy.context.view_layer.objects.active = bm
cs = bm.modifiers.new('suave', 'CORRECTIVE_SMOOTH'); cs.factor = .5; cs.iterations = 8; cs.smooth_type = 'LENGTH_WEIGHTED'; cs.rest_source = 'ORCO'; cs.use_pin_boundary = True
g = bm.vertex_groups.get('_suave') or bm.vertex_groups.new(name='_suave'); w = grupos(bm, BRAZO + ['LeftShoulder', 'RightShoulder', 'Spine2', 'Neck'])
for i, x in enumerate(w):
    if x > .01: g.add([i], min(1, x * 1.5), 'REPLACE')
cs.vertex_group = g.name
ch = bm.modifiers.new('choque', 'COLLISION'); ch.settings.thickness_outer = .004; ch.settings.cloth_friction = 8
# tela: el torso sujeto al cuerpo (sigue al esqueleto); la manga libre, con un poco de sujeción para que no se escape
for o in telas:
    # como en el cuerpo: suavizado correctivo en hombros y cuello antes de la tela (sin él, el cuello en V quedaba dentado)
    cz = o.modifiers.new('suave', 'CORRECTIVE_SMOOTH'); cz.factor = .5; cz.iterations = 8; cz.smooth_type = 'LENGTH_WEIGHTED'; cz.rest_source = 'ORCO'; cz.use_pin_boundary = True
    gz = o.vertex_groups.get('_suave') or o.vertex_groups.new(name='_suave')
    for i, x in enumerate(grupos(o, BRAZO + ['LeftShoulder', 'RightShoulder', 'Spine2', 'Neck'])):
        if x > .01: gz.add([i], min(1, x * 1.5), 'REPLACE')
    cz.vertex_group = gz.name
    wb = grupos(o, BRAZO); fx = o.vertex_groups.get('_fijo') or o.vertex_groups.new(name='_fijo')
    for i, x in enumerate(wb): fx.add([i], max(.35, 1 - min(1, x) * .65), 'REPLACE')
    t = o.modifiers.new('tela', 'CLOTH'); s = t.settings
    s.quality = 8; s.mass = .25; s.air_damping = 2; s.tension_stiffness = 30; s.compression_stiffness = 30; s.shear_stiffness = 15; s.bending_stiffness = 2
    s.vertex_group_mass = fx.name; s.pin_stiffness = 2
    t.collision_settings.use_collision = True; t.collision_settings.distance_min = .004; t.collision_settings.use_self_collision = False
    t.point_cache.frame_start = 1; t.point_cache.frame_end = N
for f in range(1, N + 1): sc.frame_set(f)
print('SIMULADO', N, 'cuadros')
# fijar el último cuadro como forma nueva
dg = bpy.context.evaluated_depsgraph_get()
for o in telas:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    vieja = o.data; o.data = me
    for m in list(o.modifiers): o.modifiers.remove(m)
    print('TELA FIJADA', o.name, len(me.vertices), 'puntos (antes', len(vieja.vertices), ')')
bm.modifiers.remove(bm.modifiers['choque'])
for o in mallas:
    if o in telas: continue
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        if m.type == 'ARMATURE':
            try:
                if o is bm: bpy.ops.object.modifier_move_to_index(modifier='suave', index=list(o.modifiers).index(m) + 1)
                bpy.ops.object.modifier_apply(modifier=m.name)
                if o is bm: bpy.ops.object.modifier_apply(modifier='suave')
                print('fijado', o.name)
            except Exception as e: print('no se pudo', o.name, e)
            break
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
arm.animation_data_clear(); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
for o in mallas:
    m = o.modifiers.new('Armature', 'ARMATURE'); m.object = arm; m.use_deform_preserve_volume = False
sc.frame_set(1); bpy.ops.wm.save_as_mainfile(filepath=out); print('ok', out)
