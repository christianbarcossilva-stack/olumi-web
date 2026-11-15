# Lámina de referencia: la persona de frente, tres cuartos, costado y espalda, fondo gris de estudio, brazos al costado.
# uso: blender -b archivo.blend --python vueltas.py -- salida.png [alto_px=900] [muestras=24]
import bpy, sys, math
from mathutils import Vector, Euler
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; num = [x for x in a[1:] if x.isdigit()]; H = int(num[0]) if num else 900; S = int(num[1]) if len(num) > 1 else 24
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.use_denoising = True
try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
# tinte=parte:#hex,parte:#hex  (tiñe la textura de la ropa cuyo nombre contiene "parte", multiplicando)
for arg in a:
    if arg.startswith('tinte='):
        for par in arg[6:].split(','):
            k, hx = par.split(':'); hx = hx.lstrip('#'); col = [((int(hx[i:i+2], 16) / 255) ** 2.2) for i in (0, 2, 4)] + [1]
            for o in sc.objects:
                if o.type != 'MESH' or k.lower() not in o.name.lower(): continue
                for sl in o.material_slots:
                    m = sl.material; nt = m.node_tree; bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
                    src = bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].is_linked else None
                    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
                    gris = nt.nodes.new('ShaderNodeRGBToBW') if src else None
                    if src:
                        nt.links.new(src, gris.inputs[0]); bri = nt.nodes.new('ShaderNodeMath'); bri.operation = 'MULTIPLY'; bri.inputs[1].default_value = 2.2
                        nt.links.new(gris.outputs[0], bri.inputs[0]); comb = nt.nodes.new('ShaderNodeCombineColor')
                        for ch in range(3): nt.links.new(bri.outputs[0], comb.inputs[ch])
                        nt.links.new(comb.outputs[0], mix.inputs[6])
                    mix.inputs[7].default_value = col; nt.links.new(mix.outputs[2], bs.inputs['Base Color'])
                print('tinte', o.name, hx)
# brazos al costado, codos apenas doblados (como la referencia)
if arm:
    for lado, sg in (('Left', 1), ('Right', -1)):
        for n, ang in ((lado + 'Arm', 48), (lado + 'ForeArm', 6)):
            b = arm.pose.bones.get('mixamorig:' + n) or arm.pose.bones.get(n)
            if not b: continue
            b.rotation_mode = 'XYZ'
            # gira hacia abajo en el plano frontal del mundo
            mw = arm.matrix_world @ b.bone.matrix_local
            eje = mw.to_3x3().inverted() @ Vector((0, 1, 0))
            from mathutils import Quaternion
            b.rotation_mode = 'QUATERNION'; b.rotation_quaternion = Quaternion(eje, math.radians(ang * sg))
bpy.context.view_layer.update()
ms = [o for o in sc.objects if o.type == 'MESH' and not o.hide_render]
dg = bpy.context.evaluated_depsgraph_get()
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in ms:
    e = o.evaluated_get(dg)
    for v in e.to_mesh().vertices:
        w = o.matrix_world @ v.co
        for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    e.to_mesh_clear()
h = mx.z - mn.z; c = (mn + mx) / 2
# fondo y piso gris claro
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.62, 0.64, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
bpy.ops.mesh.primitive_plane_add(size=40, location=(c.x, c.y, mn.z)); piso = bpy.context.object
mp = bpy.data.materials.new('piso'); mp.use_nodes = True; mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.7, 0.7, 0.72, 1); piso.data.materials.append(mp)
def luz(n, loc, e, s):
    l = bpy.data.lights.new(n, 'AREA'); l.energy = e; l.size = s; o = bpy.data.objects.new(n, l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((c.x, c.y, mn.z + h * .6)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
luz('k', (c.x - 2.2, -3.0, mn.z + h * 1.6), 900, 2.5); luz('f', (c.x + 3.0, -2.0, mn.z + h * .9), 350, 3); luz('r', (c.x + .5, 3.2, mn.z + h * 1.4), 500, 2)
cam = bpy.data.cameras.new('c'); cam.lens = 70; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
sc.render.resolution_x, sc.render.resolution_y = int(H * .5), H
import os, tempfile
partes = []
for i, ang in enumerate((0, 30, 90, 180)):
    r = math.radians(ang); dist = h * 3.1
    co.location = (c.x + math.sin(r) * dist, c.y - math.cos(r) * dist, mn.z + h * .55)
    co.rotation_euler = (Vector((c.x, c.y, mn.z + h * .5)) - Vector(co.location)).to_track_quat('-Z', 'Y').to_euler()
    f = os.path.join(tempfile.gettempdir(), 'vuelta%d.png' % i); sc.render.filepath = f; bpy.ops.render.render(write_still=True); partes.append(f)
# las cuatro en una tira
imgs = [bpy.data.images.load(f) for f in partes]
W = sum(i.size[0] for i in imgs); Hh = imgs[0].size[1]
tira = bpy.data.images.new('tira', W, Hh); px = [0.0] * (W * Hh * 4); x0 = 0
for im in imgs:
    w_, h_ = im.size; src = list(im.pixels)
    for y in range(h_):
        px[(y * W + x0) * 4:(y * W + x0 + w_) * 4] = src[y * w_ * 4:(y + 1) * w_ * 4]
    x0 += w_
tira.pixels = px; tira.filepath_raw = out; tira.file_format = 'PNG'; tira.save()
print('ok', out)
