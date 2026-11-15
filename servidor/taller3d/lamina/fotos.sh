# fotos de la lámina de cada hora: antes (modelos y núcleo publicados) y ahora (los nuevos). uso: SALIDA=/tmp/lamina ANTES=nucleo-viejo.js bash fotos.sh
set -e
V=/home/claude/olumi-web/servidor/taller3d/visor; L=${SALIDA:-/tmp/lamina}; mkdir -p $L; ANTES=${ANTES:-$L/nucleo-antes.js}   # ANTES: el avatar-core.js publicado
cd $V; export NODE_PATH=$(npm root -g); cp avatar-core.js $L/nucleo-nuevo.js
f(){ timeout 300 node foto.js "$@" | tail -1; }
cp $ANTES avatar-core.js
f $L/a-frente.png "m=v2/of-h3.glb&p=idle&h=1.5708&recto=1&fov=24&mira=0.95" 560 1000
f $L/a-lado.png "m=v2/of-h3.glb&p=idle&h=0.0001&recto=1&fov=24&mira=0.95" 560 1000
f $L/a-mano.png "m=v2/of-h3.glb&p=idle&h=1.9&recto=1&fov=4.5&mira=0.8&cx=0.24" 560 560
cp $L/nucleo-nuevo.js avatar-core.js
f $L/b-frente.png "m=v2/of-h3-v4.glb&p=idle&h=1.5708&recto=1&fov=24&mira=0.95" 560 1000
f $L/b-lado.png "m=v2/of-h3-v4.glb&p=idle&h=0.0001&recto=1&fov=24&mira=0.95" 560 1000
f $L/b-mano.png "m=v2/of-h3-v4.glb&p=idle&h=1.9&recto=1&fov=4.5&mira=0.8&cx=0.24" 560 560
f $L/mujeres.png "m=v2/of-m3c-v4.glb,v2/of-m4-v4.glb&p=idle&h=1.35&gap=0.8&recto=1&fov=24&mira=0.9" 1120 1000
f $L/tecnicos.png "m=v2/tec-h3-v4.glb,v2/tec-h-epp3-v4.glb&p=idle&h=1.35&gap=0.8&recto=1&fov=24&mira=0.95" 1120 1000
f $L/poses.png "m=v2/of-m4-v4.glb&p=idle,walk0.3,sit,tecla&h=0.0001&gap=1.1&recto=1&fov=26&mira=0.9" 2240 900
echo FOTOS
