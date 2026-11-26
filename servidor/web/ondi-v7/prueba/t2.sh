#!/bin/sh
# todas las plataformas (regla de Christian): compu, compu chica, iPad, iPhone y Android; claro y oscuro; sin movimiento. Capturas en /tmp/ondi-tanda/<caso>/
cd "$(dirname "$0")"; B=/tmp/ondi-tanda
PUERTO=8801 OUT=$B/compu-osc W=1440 H=900 node web.js
PUERTO=8803 OUT=$B/compu-chica-claro W=1280 H=800 TEMA=dia node web.js
PUERTO=8804 OUT=$B/ipad-claro DEV='iPad (gen 7)' TEMA=dia SECC='#planes,#probar' node web.js
PUERTO=8805 OUT=$B/android-claro DEV='Pixel 7' TEMA=dia SECC='#probar' node web.js
PUERTO=8806 OUT=$B/compu-quieto W=1440 H=900 QUIETO=1 SECC='#probar' node web.js
