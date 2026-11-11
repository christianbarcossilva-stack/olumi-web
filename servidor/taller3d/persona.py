# Genera una persona a partir de una ficha (JSON) y guarda el .blend. uso: blender -b --python persona.py -- ficha.json salida.blend
import bpy, os, sys, json, traceback
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
a = sys.argv[sys.argv.index('--') + 1:]; F = json.load(open(a[0])); OUT = a[1]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
UD = LocationService.get_user_data()
def mhclo(kind, name):
    d = os.path.join(UD, kind, name); f = [x for x in os.listdir(d) if x.lower().endswith('.mhclo')]
    return os.path.join(d, f[0])
macro = TargetService.get_default_macro_info_dict(); macro.update({k: v for k, v in F.get('macro', {}).items() if k != 'race'}); macro['race'] = F.get('macro', {}).get('race', macro['race'])
bm = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
# rasgos finos (targets sueltos): {"nose/nose-scale-horiz-incr": 0.3, ...}
for t, w in (F.get('rasgos') or {}).items():
    p = TargetService.target_full_path(t.split('/')[-1])
    if p: TargetService.load_target(bm, p, weight=w, name=t.split('/')[-1])
    else: print('SIN TARGET', t)
rig = HumanService.add_builtin_rig(bm, F.get('rig', 'mixamo'), import_weights=True)
MT = 'GAMEENGINE'
def pone(kind, name, tipo):
    if not name: return None
    try:
        o = HumanService.add_mhclo_asset(mhclo(kind, name), bm, asset_type=tipo, subdiv_levels=0, material_type=MT); print('OK', kind, name); return o
    except Exception as e: print('FALLA', kind, name, e); traceback.print_exc()
sk = F.get('piel')
if sk:
    d = os.path.join(UD, 'skins', sk); m = [x for x in os.listdir(d) if x.endswith('.mhmat')][0]
    HumanService.set_character_skin(os.path.join(d, m), bm, skin_type=MT, material_instances=False); print('OK piel', sk)
pone('eyes', F.get('ojos_malla', 'low-poly'), 'Eyes')
pone('eyebrows', F.get('cejas'), 'Eyebrows'); pone('eyelashes', F.get('pestanas'), 'Eyelashes'); pone('hair', F.get('pelo'), 'Hair'); pone('teeth', F.get('dientes'), 'Teeth')
for c in F.get('ropa', []): pone('clothes', c, 'Clothes')
for o in bpy.data.objects: print('OBJ', o.type, o.name, len(o.data.vertices) if o.type == 'MESH' else '', [m.type for m in o.modifiers] if o.type == 'MESH' else '')
for m in bpy.data.materials: print('MAT', m.name, [n.bl_idname.replace('ShaderNode', '') for n in m.node_tree.nodes] if m.use_nodes else '')
bpy.ops.wm.save_as_mainfile(filepath=OUT)
