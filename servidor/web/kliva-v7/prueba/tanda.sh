#!/bin/bash
# tanda de pruebas de la web v7 de Kliva en todas las plataformas (una atrás de otra: sin placa de video el 3D se lleva la máquina).
# Deja cada una en /tmp/k7-<nombre>/ y el registro en /tmp/k7-tanda.log. Después hay que mirar las capturas.
# SITIO=/carpeta pone por delante una copia de trabajo (ver web.mjs).
cd "$(dirname "$0")"; L=/tmp/k7-tanda.log; : > $L
corre(){ n=$1; shift; echo "== $n" >> $L; rm -rf /tmp/k7-$n; env OUT=/tmp/k7-$n "$@" timeout 900 node web.mjs >> $L 2>&1; echo "   fin $n $?" >> $L; }
corre tel      MOVIL=1 W=390 H=844 ESPERA=3200 MID=1.5,5.6 SECC='#marcas,#familia,#datos,#preguntas'
corre tel-dia  MOVIL=1 W=390 H=844 TEMA=dia ESPERA=3200 SOLO=0,1,3,6
corre tab      MOVIL=1 W=820 H=1180 ESPERA=3200 SOLO=0,1,2,4,6
corre tab-h    MOVIL=1 W=1180 H=820 ESPERA=3200 SOLO=0,1,3,5
corre dia      W=1440 H=900 TEMA=dia ESPERA=3200 SECC='#marcas,#datos'
corre c1280    W=1280 H=720 ESPERA=3200 SOLO=0,1,2,4,6
corre c1024    W=1024 H=768 ESPERA=3200 SOLO=0,2,4
corre noche    W=1440 H=900 ESPERA=3200 MID=1.5,2.55,5.6 SECC='#marcas,#familia,#datos,#preguntas'
echo "== resto" >> $L; OUT=/tmp/k7-resto timeout 900 node resto.mjs >> $L 2>&1
echo TANDA LISTA >> $L
