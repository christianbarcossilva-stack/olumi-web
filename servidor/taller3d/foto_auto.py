# Foto de control de un vehículo. uso: blender -b auto.blend --python foto_auto.py -- salida.png [vista: 34|lado|atras|frente|arriba]
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; vista = a[1] if len(a) > 1 else '34'
sc = bpy.context.scene
if len(a) > 2:      # tercer dato: color de la pintura (r,g,b de 0 a 1) y, opcional, 'llantas' para pintarlas igual
    rgb = [float(x) for x in a[2].split(',')]
    for m in bpy.data.materials:
        if m.name.startswith('pintura') or (len(a) > 3 and m.name.startswith('llanta')): m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
# NEGRO: para ver un auto oscuro la luz va más fuerte
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 40; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 1100, 620
P = {'34': (5.6, -5.0, 2.1), 'lado': (0, -8.5, 1.2), 'atras': (-5.6, -5.0, 2.1), 'frente': (8.5, -.6, 1.3), 'arriba': (.01, -.01, 11), 'cola': (-8.5, -.6, 1.3)}[vista]
tgt = Vector((0, 0, .75)); cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co; co.location = P; cam.lens = 55
co.rotation_euler = (tgt - Vector(P)).to_track_quat('-Z', 'Y').to_euler()
def luz(n, loc, e, s):
    l = bpy.data.lights.new(n, 'AREA'); l.energy = e; l.size = s; o = bpy.data.objects.new(n, l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (tgt - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
luz('k', (4, -6, 6), 1300, 5); luz('f', (-6, -4, 3), 450, 6); luz('r', (0, 6, 5), 800, 5); luz('t', (0, 0, 8), 500, 8)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.82, .84, .87, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .35
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
sc.render.filepath = out; bpy.ops.render.render(write_still=True); print('FOTO', out)
