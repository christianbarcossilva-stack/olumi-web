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
2b. `blender -b salida/of-h.blend --python reposo.py -- salida/of-h-r.blend 0.07 0.22 suave 0.35` — baja los brazos en Blender (abre, codo, suavizado, caída de la clavícula) y deja esa forma como reposo: en la web casi no se gira nada. Mujeres: `0.11 0.22 suave 0.28`.
3. `blender -b salida/of-h-r.blend --python exportar.py -- salida/of-h-crudo.glb 18000 relieve` — saca ayudantes y lo que tapa la ropa, baja triángulos, materiales simples. Con `relieve`: la ropa conserva su mapa de relieve y las sombras de los pliegues (`_ao.png`) se hornean en el color. Capas: el zapato se mete dentro del pantalón y el pantalón dentro del suéter o la camisa por fuera (`meter` + `tapar`, por zonas: antebrazo y mano solo contra mangas).
4. `python3 glb_liviano.py salida/of-h-crudo.glb salida/of-h.glb 1024 512` — texturas a JPEG (PNG si tienen transparencia), relieves y zapatos a 512, y el color de cada isla de la textura se corre unos píxeles (sin rayas negras en las costuras); queda en ~1,8 MB.
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
- **Cejas de pelos sueltos (mindfront_*) no:** pesan 14.500 triángulos y no se pueden achicar (cada pelo es una pieza), así que el recorte se lo sacaba al cuerpo y a la ropa. Van cejas de textura (`eyebrow001` a `012`, 192 triángulos).
- **Deltoides:** con `upperarm-shoulder-muscle-incr` en 0,3 la camisa parecía con hombreras; 0,1 alcanza.
- Una prenda sin grupo `Delete.…` (suéter, pantalón de lana) no saca la piel de abajo: `exportar.py` toma como ropa todo lo que no es pelo, cejas, pestañas, ojos ni dientes.
- Con los brazos ya bajados, la manga queda pegada a la cadera: decidir qué tapa qué sin zonas abría agujeros en el pantalón al mover los brazos.

## Vehículos (11/11)
- `blender -b --python vehiculo.py -- <modelo> salida/<modelo>.blend salida/<modelo>.glb` — modelos: `suv` (medidas del Chery eQ7), `toro` (Fiat Toro, con la caja abierta), `bipper` (Peugeot Bipper), `fiorino` (Fiat Fiorino 2025). Cada uno es una ficha en `MODELOS`: medidas de fábrica, tres curvas de costado, planta y la lista de detalles. La pintura queda en el material `pintura`: la app le pone el color de la ficha.
- La resta (pasarruedas, caja) se comprueba sola por volumen y, si un método falla, prueba otro (en la Bipper el exacto daba la pieza dada vuelta).
- En `catalogo.json` cada vehículo lleva `tipo` (suv, pickup, utilitario), `modelo` (expresión que se busca en el modelo o el nombre de la ficha), medidas, `adelante` (corrimiento para que la trompa quede en su lugar) y, en los furgones, `cartel` (dónde va el nombre de la empresa; el guion imprime `CARTEL … costado` con la medida).
- `blender -b salida/toro.blend --python foto_auto.py -- salida/toro.png 34` — foto de control (vistas: `34`, `lado`, `atras`, `frente`).
- Se publica copiando el GLB a `olumi/beta/3d/` y sumando el renglón en `vehiculos` de `catalogo.json`.

## Técnico con casco y chaleco
- Exportar con tope 18500 (`exportar.py -- crudo.glb 18500`): el chaleco no se achica y con menos triángulos el pantalón se abre en las rodillas al sentarse.

## Visor: poses útiles
- `idle@3.7` (otra persona, otra postura), `walk0.3` (fase del paso), `sit`, `tecla`, `g:saludo:1.2` (gesto a los 1,2 s), `para0.2` (0,2 s después de frenar). `h=1.5708&recto=1` mira de frente; `mira=1.25&fov=11` acerca al torso.
- `p=molde` (el modelo sin tocar ningún hueso), `cx=0.24` (mirar al costado: una mano), `fondo=ff0000` (fondo de color: ¿agujero o pieza?), `oculta=pants` (esconder piezas por nombre).
- `node medir.js "m=x.glb&p=idle"`: dónde queda cada articulación en metros (rodillas, hombros, manos) y las medidas del cuerpo (`AN`).
- Lámina de cada hora: `lamina/fotos.sh` (antes con el núcleo publicado, ahora con el nuevo) y `lamina/armar.py`.

## Personas de afuera a la oficina (15/11)
Christian: «quiero que aprendas a hacer esto, porque los clientes nos pueden pedir avatares». Cualquier persona 3D (generador con IA como Tripo o Hunyuan 3D, escaneo, pack comprado o libre) entra así:
1. **Sin esqueleto** (lo normal en un generador): `blender -b --python autoesqueleto.py -- entrada.glb salida-crudo.glb 1.76 [1]`
   - Parada, de frente, brazos en T o en A. Si mira para atrás se gira sola (por los pies).
   - Arma el esqueleto tipo Mixamo que usa `avatar-core.js` (cadera, columna, cuello, cabeza, hombros, brazos, manos, piernas, pies) por proporciones y por la punta de los dedos.
   - Pesos: «calor» de Blender sobre una copia soldada (los modelos generados vienen en piezas y fallan) y se pasan a la malla real por cercanía.
   - El `1` al final saca el esqueleto que traía (para rehacerlo).
   - Probado 15/11 con Male_Adult_05 de Rocketbox sin su esqueleto: parado, caminando, sentado y saludando queda igual que con el original (falta: que el chaleco no siga al brazo al saludar).
2. **Con esqueleto Biped (Rocketbox, Microsoft, MIT):** `blender -b --python rocketbox.py -- <carpeta con Export/ y Textures/> salida-crudo.glb hipoly` (renombra los huesos a Mixamo y arma los materiales).
3. `python3 glb_liviano.py crudo.glb final.glb 1024 1024 1024 1024` (texturas a 1024; queda en 1 a 2 MB).
4. Foto con el motor de la oficina: `cd visor && node foto.js salida.png "m=rb/final.glb&p=idle,walk0.3,sit,g:saludo:1.2&h=1.5708&recto=1"` (el visor tiene su copia de `avatar-core.js`: copiarla de `olumi-app/scripts/oficina-3d/` si cambió).
5. Lámina contra la referencia (pedido de Christian: comparar cada hora): `blender -b x.blend --python vueltas.py -- lamina.png 700 20 [tinte=parte:#hex,…]` saca frente, tres cuartos, costado y espalda con fondo gris de estudio.

**Lo que falta para la calidad que pide Christian:** el cuerpo y la cara de origen. MakeHuman y Rocketbox se ven viejos («parecen de los 90», «hacés chinos»). La entrada tiene que venir de un generador con IA a partir de imágenes nuestras (no de Google, por derechos) o de fotos del equipo con su permiso. Rocketbox bajado en la Mac: `Descargas/Unity Tech/3D/Olumi3D/rocketbox/` (5 personas).
