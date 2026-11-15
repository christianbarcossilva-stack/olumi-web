# Persona de Microsoft Rocketbox (licencia MIT) a GLB para la oficina (15/11, Christian eligió avatares realistas).
# uso: blender -b --python rocketbox.py -- <carpeta del avatar con Export/ y Textures/> <salida.glb> [lod=hipoly|midpoly|lowpoly] [foto.png]
# - Se queda con un solo nivel de detalle (el FBX trae cuatro).
# - Renombra el esqueleto Biped ("Bip01 L Thigh"…) a nombres tipo Mixamo (LeftUpLeg…), los que usa avatar-core.js.
# - Texturas: color + normal; la de transparencia (pelo, pestañas) con recorte.
import bpy, sys, os, re, math
A = sys.argv[sys.argv.index('--') + 1:]
src, out = A[0], A[1]
lod = A[2] if len(A) > 2 else 'hipoly'
foto = A[3] if len(A) > 3 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
fbx = [f for f in os.listdir(os.path.join(src, 'Export')) if f.lower().endswith('.fbx') and '_facial' not in f][0]
bpy.ops.import_scene.fbx(filepath=os.path.join(src, 'Export', fbx), ignore_leaf_bones=True, use_image_search=True)
sc = bpy.context.scene
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
mallas = [o for o in sc.objects if o.type == 'MESH']
print('mallas:', [(o.name, len(o.data.polygons)) for o in mallas])
# un solo nivel de detalle
quedan = [o for o in mallas if lod in o.name.lower()] or mallas
for o in mallas:
    if o not in quedan: bpy.data.objects.remove(o, do_unlink=True)
mallas = quedan
# esqueleto Biped -> nombres tipo Mixamo
LADO = {'L': 'Left', 'R': 'Right'}
DED = {'0': 'Thumb', '1': 'Index', '2': 'Middle', '3': 'Ring', '4': 'Pinky'}
def nuevo(n):
    m = re.match(r'^Bip01 (.+)$', n)
    if not m: return None
    r = m.group(1)
    fijo = {'Pelvis': 'Hips', 'Spine': 'Spine', 'Spine1': 'Spine1', 'Spine2': 'Spine2', 'Spine3': 'Spine3', 'Neck': 'Neck', 'Head': 'Head'}
    if r in fijo: return fijo[r]
    m = re.match(r'^([LR]) (Clavicle|UpperArm|Forearm|Hand|Thigh|Calf|Foot|Toe0)$', r)
    if m:
        return LADO[m.group(1)] + {'Clavicle': 'Shoulder', 'UpperArm': 'Arm', 'Forearm': 'ForeArm', 'Hand': 'Hand', 'Thigh': 'UpLeg', 'Calf': 'Leg', 'Foot': 'Foot', 'Toe0': 'ToeBase'}[m.group(2)]
    m = re.match(r'^([LR]) Finger(\d)(\d?)$', r)
    if m: return LADO[m.group(1)] + 'Hand' + DED[m.group(2)] + str(int(m.group(3) or 0) + 1)
    return None
cambios = 0
for b in arm.data.bones:
    n = nuevo(b.name)
    if n:
        viejo = b.name; b.name = n; cambios += 1
        for o in mallas:
            vg = o.vertex_groups.get(viejo)
            if vg: vg.name = n
print('huesos renombrados:', cambios, sorted(b.name for b in arm.data.bones)[:60])
# materiales: se arman de nuevo desde las texturas de la carpeta (el FBX las nombra por ruta de 3ds Max y no las encuentra)
TX = os.path.join(src, 'Textures')
def img(nombre, datos=False):
    r = os.path.join(TX, nombre)
    if not os.path.exists(r): return None
    i = bpy.data.images.load(r, check_existing=True)
    if datos: i.colorspace_settings.name = 'Non-Color'
    return i
for o in mallas:
    for s in o.material_slots:
        m = s.material
        if not m: continue
        base = m.name.split('.')[0]
        m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        sal = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bs.outputs['BSDF'], sal.inputs['Surface'])
        bs.inputs['Roughness'].default_value = 0.6
        if 'Specular IOR Level' in bs.inputs: bs.inputs['Specular IOR Level'].default_value = 0.3
        c = img(base + '_color.tga')
        if c:
            tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = c; nt.links.new(tc.outputs['Color'], bs.inputs['Base Color'])
            if base.endswith('_opacity'):
                nt.links.new(tc.outputs['Alpha'], bs.inputs['Alpha']); m.blend_method = 'CLIP'
        n = img(base + '_normal.tga', True)
        if n:
            tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = n; nm = nt.nodes.new('ShaderNodeNormalMap')
            nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
        print('material', m.name, 'color' if c else '-', 'normal' if n else '-')
# en metros, pies en el piso, mirando a +Z de glTF (el exportador convierte -Y de Blender)
# sin la animación que trae el FBX y con el esqueleto en reposo (si no, el GLB sale con la malla encogida)
for o in [arm] + mallas: o.animation_data_clear()
for pb in arm.pose.bones: pb.matrix_basis.identity()
# el FBX viene en centímetros con el esqueleto a escala 0,01: se pasa todo a metros reales (si no, el GLB queda con la malla aplastada)
for o in mallas:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.ops.object.select_all(action='DESELECT')
for o in [arm] + mallas: o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in mallas:
    o.parent = arm; o.matrix_parent_inverse.identity()
    for md in o.modifiers:
        if md.type == 'ARMATURE': md.object = arm
for o in [c for c in arm.children if c.type == 'EMPTY']: bpy.data.objects.remove(o, do_unlink=True)
mn = min((o.matrix_world @ v.co).z for o in mallas for v in o.data.vertices)
mx = max((o.matrix_world @ v.co).z for o in mallas for v in o.data.vertices)
print('alto', round(mx - mn, 3), 'piso', round(mn, 3), 'triangulos', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in mallas))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='AUTO', export_animations=False, export_skins=True, export_yup=True)
print('ok', out)
