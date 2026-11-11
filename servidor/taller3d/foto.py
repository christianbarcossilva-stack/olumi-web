# Foto de control con Cycles (sin pantalla). uso: blender -b archivo.blend --python foto.py -- salida.png [cara]
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; cara = len(a) > 1 and a[1] == 'cara'
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32 if not cara else 48; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = (700, 900) if not cara else (700, 700)
ms = [o for o in sc.objects if o.type == 'MESH']
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in ms:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
h = mx.z - mn.z; cx = (mn.x + mx.x) / 2
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
if cara: tgt = Vector((cx, 0, mn.z + h * .93)); co.location = (cx + h * .12, -h * .62, mn.z + h * .95); cam.lens = 85
else: tgt = Vector((cx, 0, mn.z + h * .5)); co.location = (cx + h * .55, -h * 1.9, mn.z + h * .62); cam.lens = 50
d = tgt - Vector(co.location); co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
def luz(n, loc, e, s):
    l = bpy.data.lights.new(n, 'AREA'); l.energy = e; l.size = s; o = bpy.data.objects.new(n, l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (tgt - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
luz('k', (h * 1.2, -h * 1.6, mn.z + h * 1.5), 330 * h * h / 3, h); luz('f', (-h * 1.5, -h * 1.0, mn.z + h * .8), 110 * h * h / 3, h * 1.5); luz('r', (0, h * 1.6, mn.z + h * 1.4), 200 * h * h / 3, h)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.82, .84, .87, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .45
bpy.ops.mesh.primitive_plane_add(size=h * 12, location=(cx, 0, mn.z))
sc.render.filepath = out; bpy.ops.render.render(write_still=True); print('FOTO', out)
