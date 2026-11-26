#!/bin/bash
# tanda de pruebas de la web v7 en todas las plataformas (una atrás de otra: sin placa de video el 3D se lleva la máquina).
# Deja cada una en /tmp/w7-<nombre>/ y el registro en /tmp/w7-tanda.log. Después hay que mirar las capturas.
cd "$(dirname "$0")"; L=/tmp/w7-tanda.log; : > $L
corre(){ n=$1; shift; echo "== $n" >> $L; rm -rf /tmp/w7-$n; env OUT=/tmp/w7-$n ESPERA_S=3600 "$@" timeout 900 node web.js >> $L 2>&1; echo "   fin $n $?" >> $L; }
corre tel      MOVIL=1 W=390 H=844 ESPERA=2600 MID=2.45,4.5 SECC='#crm,#seguridad,#app,#funciones,#planes,#probar'
corre tel-dia  MOVIL=1 W=390 H=844 TEMA=dia ESPERA=2600 SOLO=0,1,3,5,7 SECC='#crm,#probar'
corre tab      MOVIL=1 W=820 H=1180 ESPERA=2600 SOLO=0,1,3,4,5,7
corre tab-h    MOVIL=1 W=1180 H=820 ESPERA=2600 SOLO=0,1,3,4,6
corre dia      W=1440 H=900 TEMA=dia ESPERA=2700 SECC='#crm,#app,#planes,#probar'
corre c1280    W=1280 H=800 ESPERA=2700 SOLO=0,2,3,4,5 MID=3.5,4.45
corre noche    W=1440 H=900 ESPERA=2700 MID=4.45 SECC='#crm,#seguridad,#app,#rubros,#funciones,#planes,#descargas,#probar'
corre quieto   W=1440 H=900 REDUCE=1 ESPERA=900 SOLO=0,4,6 SECC='#crm,#probar'
echo TANDA LISTA >> $L
