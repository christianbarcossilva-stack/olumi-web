# Taller 3D de Olumi y Ondi

Cómo se hacen las personas (y después autos y objetos) que usan las maquetas. Decisión y plan: doc del proyecto `claude/3d-taller.md`.

## Qué hace falta (todo gratis)
- Blender 5.3 para Linux x64 (`blender-5.3.0-linux-x64.tar.xz`, blender.org; sha256 dacb8264…22e05).
- MPFB 2.0.18 (`add-on-mpfb-v2.0.18.zip`, extensions.blender.org): `blender --command extension install-file -r user_default --enable add-on-mpfb-v2.0.18.zip`
- Paquetes CC0 de MakeHuman descomprimidos en `~/.config/blender/5.3/extensions/.user/user_default/mpfb/data/`:
  makehuman_system_assets, skins01, skins02, shirts01, pants01, shoes01, bodyparts05, hats02, eyebrows01, eyelashes01 (y hair01).
  Se bajan de `files.makehumancommunity.org/asset_packs/<paquete>/<paquete>_cc0.zip` (el espejo `files2.` es muy lento).

## Pasos (sin pantalla)
1. `blender -b --python persona.py -- fichas/of-h.json salida/of-h.blend` — arma la persona desde su ficha (cuerpo, rasgos, piel, pelo, ropa, esqueleto tipo Mixamo).
1b. (opcional) `blender -b salida/tec-h.blend --python epp.py -- salida/tec-h-epp.blend blanco` — suma casco de obra (blanco, amarillo, azul o naranja) y chaleco reflectivo. El chaleco sale del torso del cuerpo y se separa lo justo para quedar por fuera de la ropa.
2. `blender -b salida/of-h.blend --python foto.py -- salida/of-h.png [cara]` — foto de control (Cycles, sin placa de video).
3. `blender -b salida/of-h.blend --python exportar.py -- salida/of-h-crudo.glb 14000` — saca ayudantes y lo que tapa la ropa, baja a ~15.000 triángulos, materiales simples.
4. `python3 glb_liviano.py salida/of-h-crudo.glb salida/of-h.glb 1024 512` — texturas a JPEG (PNG si tienen transparencia); queda en ~1,4 MB.
5. Copiar a `olumi/beta/3d/` y sumar el renglón en `catalogo.json`.
6. `node visor/foto.js salida/x.png "m=of-h.glb&p=idle,walk,sit"` — foto con el mismo motor de la oficina (three r169).

## Cosas que ya nos pasaron
- `create_human(detailed_helpers=False)` deja el esqueleto mal ubicado (brazos horizontales, cadera en el piso): **siempre `detailed_helpers=True`**; los ayudantes se sacan al exportar.
- Exportar todo a JPEG rompe pelo, cejas y pestañas (pierden la transparencia): formato AUTO y después `glb_liviano.py`.
- La ropa es de una sola cara: hay que apagar "backface culling" o los cuellos desaparecen.
- En la web, lo transparente va con recorte (`alphaTest`), no con mezcla.
- El reposo viene con brazos en A y codos doblados: el adaptador (`avatar.js` en la oficina) los lleva a colgar rectos antes de aplicar las poses.
- Para medir el cuerpo (casco, chaleco) hay que fijar antes los rasgos (`TargetService.bake_targets`): las coordenadas crudas son las del molde base, no las de la persona.
- El mameluco tiene bolsillos gruesos que atraviesan el chaleco: el técnico con chaleco va con remera polo y pantalón de trabajo.
