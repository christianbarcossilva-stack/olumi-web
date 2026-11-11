# Exporta la persona del .blend a GLB para la web. uso: blender -b x.blend --python exportar.py -- salida.glb [tri_max=14000]
# Saca los ayudantes y lo que tapa la ropa, baja triángulos donde sobran y deja materiales simples (color + transparencia).
import bpy, sys, os
from bl_ext.user_default.mpfb.services.targetservice import TargetService
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; TRI = int(a[1]) if len(a) > 1 else 14000
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
    for n in list(m.node_tree.nodes):
        if n.bl_idname == 'ShaderNodeNormalMap': m.node_tree.nodes.remove(n)
    bs = [n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled']
    for b in bs:
        usados = {l.from_node for l in m.node_tree.links if l.to_node == b}
        for n in list(m.node_tree.nodes):
            if n.bl_idname == 'ShaderNodeTexImage' and n not in usados: m.node_tree.nodes.remove(n)
        b.inputs['Roughness'].default_value = max(.55, b.inputs['Roughness'].default_value); b.inputs['Metallic'].default_value = 0
tot = 0
for o in ms: t = tris(o); tot += t; print('MALLA', o.name, len(o.data.vertices), 'v', t, 't')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=False, export_skins=True, export_animations=False, export_morph=False,
                          export_yup=True, export_image_format='AUTO', export_tangents=False, export_def_bones=False)
print('GLB', out, round(os.path.getsize(out) / 1024), 'KB', tot, 'triangulos')
