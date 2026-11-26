#!/usr/bin/env python3
"""Arma la escena de la web de Ondi v7: «Parque Logístico Norte», un parque logístico INVENTADO (ningún cliente real: regla de privacidad).
uso: python3 escena.py  → motor/escenas/ondi-web.json
Ejes: la ruta corre a lo largo de x (z = -70); el camino de acceso sube por x = 0 hacia +z; la sala técnica (rack) está al este del acceso."""
import json, math, os
P = []
def add(t, **k):
    k['t'] = t; k.setdefault('id', f"{t[:3]}{len(P)+1}"); P.append(k); return k
PI = math.pi
# suelo
add('terreno', nombre='Campo', mat='pasto', pts=[[-420, -320], [420, -320], [420, 320], [-420, 320]], id='ter1')
add('terreno', nombre='Monte', mat='monte', pts=[[-420, 140], [420, 140], [420, 320], [-420, 320]], id='ter2')
add('bosque', nombre='Monte', tipo='mixto', densidad=40, pts=[[-420, 150], [420, 150], [420, 320], [-420, 320]], id='bos1')
add('terreno', nombre='Patio', mat='hormigon', orden=1, pts=[[-84, -52], [84, -52], [84, 96], [-84, 96]], id='ter3')
# ruta y accesos
add('calle', nombre='Ruta 8', tipo='ruta', ancho=12, linea='discontinua', pts=[[-460, -78], [460, -78]], id='ruta')
add('calle', nombre='Acceso', tipo='asfalto', ancho=9, linea='discontinua', pts=[[0, -72], [0, 46]], id='acc')
add('calle', nombre='Calle interna', tipo='asfalto', ancho=9, pts=[[-70, 46], [70, 46]], id='cint')
add('cerco', nombre='Cerco perimetral', tipo='hormigon', alto=2.4, pts=[[-8, -52], [-84, -52], [-84, 96], [84, 96], [84, -52], [8, -52]], id='cerco')
add('arboles', nombre='Cortina', tipo='pino', paso=7, alto=1, pts=[[-84, -58], [-14, -58]], id='arb1')
add('arboles', nombre='Cortina', tipo='pino', paso=7, alto=1, pts=[[14, -58], [84, -58]], id='arb2')
add('arboles', nombre='Cortina', tipo='fronda', paso=9, alto=1, pts=[[-90, -50], [-90, 96]], id='arb3')
add('arboles', nombre='Cortina', tipo='fronda', paso=9, alto=1, pts=[[90, -50], [90, 96]], id='arb4')
add('postes', nombre='Línea de UTE', paso=40, alto=10, pts=[[-460, -88], [460, -88]], id='ute')
add('cartel', texto='Parque Logístico Norte', ancho=7, alto=1.6, x=-15, z=-63, r=0, id='cartel')
# portería y barreras
add('modulo', nombre='Portería', ancho=5, fondo=4, pisos=1, color='#f5f6f7', x=9, z=-44, id='port')
add('barrera', nombre='Barrera de entrada', ancho=4.4, x=2.3, z=-47, r=PI, id='bar1')
add('barrera', nombre='Barrera de salida', ancho=4.4, x=-2.3, z=-44, id='bar2')
add('modulo', nombre='Oficinas', ancho=18, fondo=9, pisos=2, color='#f5f6f7', x=-26, z=-36, id='ofi')
add('estacionamiento', nombre='', columnas=8, filas=1, ocupacion=60, lugar=2.6, x=-26, z=-24, r=0, id='est1')
# galpones
add('galpon', nombre='Galpón N1', estilo='logistico', ancho=52, fondo=30, alto=11, x=48, z=14, r=-PI / 2, id='gN1')
add('galpon', nombre='Galpón N2', ancho=52, fondo=30, alto=10, portones=5, x=-48, z=14, r=-PI / 2, id='gN2')
add('galpon', nombre='Galpón S1', estilo='logistico', ancho=96, fondo=26, alto=11, x=0, z=74, r=PI, id='gS1')
# sala técnica: un techado chico al lado del acceso, con el rack a la vista
add('alero', nombre='Sala técnica', ancho=6, fondo=5, alto=3, color='#2a2c31', x=14, z=-26, r=0, id='sala')
add('rack', nombre='Rack N1', clase='piso', alto=2, x=14, z=-26.6, r=PI, y=0, estado='ok', id='rack')
# columnas de luz del acceso
for i, (x, z) in enumerate([(6, -34), (6, -6), (6, 22), (-6, -20), (-6, 8), (-6, 36)]):
    add('columna', nombre='', alto=12, focos=2, x=x, z=z, id=f'col{i}')
# equipos (los que cuelgan del switch del rack N1 se caen juntos en la historia)
add('camara', nombre='C-01 · Portería', clase='lpr', modelo='LPR 4 MP', y=5, x=6.2, z=-48, r=2.6, alcance=24, apertura=40, estado='ok', id='c01')
add('camara', nombre='C-07 · Andén norte', clase='domo', modelo='Domo 4 MP', y=8, x=6, z=-6, r=0, alcance=30, apertura=90, estado='ok', id='c07')
add('camara', nombre='C-08 · Acceso', clase='bullet', modelo='Bullet 8 MP', y=8, x=6, z=22, r=PI / 2, alcance=40, apertura=70, estado='ok', id='c08')
add('camara', nombre='C-12 · Patio oeste', clase='bullet', modelo='Bullet 8 MP', y=8, x=-6, z=8, r=PI, alcance=40, apertura=70, estado='ok', id='c12')
add('ap', nombre='AP-13 · Andén 3', modelo='U7 Outdoor', y=7, x=32.4, z=6, estado='ok', id='ap13')
add('ap', nombre='AP-14 · Andén 6', modelo='U7 Outdoor', y=7, x=32.4, z=24, estado='ok', id='ap14')
add('ap', nombre='AP-21 · Galpón N2', modelo='U7 Outdoor', y=7, x=-32.4, z=14, estado='ok', id='ap21')
# el cable del switch del rack N1 hasta el AP-13 (la historia lo recorre)
add('fibra', nombre='UTP rack N1 → AP-13', hilos=1, y=0, color='#8D979F', pts=[[14, -24.5], [14, -20], [10.5, -16], [10.5, 6], [32.4, 6]], id='cab13')
add('fibra', nombre='Fibra rack N1 → Galpón N2', hilos=12, y=0, color='#ff8a00', pts=[[14, -24.5], [-10.5, -16], [-10.5, 14], [-32.4, 14]], id='fib2')
# logística
for i in range(4):
    add('chasis', nombre='Semirremolque', x=-30 + i * 4.2, z=54, r=PI / 2, id=f'sem{i}')
add('camion', nombre='Camión', carga='#c2415b', x=-12, z=38, r=PI / 2, id='cam1')
add('camion', nombre='Camión', carga='#2f6fd6', x=30, z=46, r=0, id='cam2')
add('vehiculo', nombre='Auto', modelo='suv', color='#c9ced2', x=-31, z=-24, r=PI / 2, id='aut1')
add('vehiculo', nombre='Auto', modelo='toro', color='#2f5da8', x=-23, z=-24, r=PI / 2, id='aut2')
add('persona', nombre='Guardia', modelo='tec-h-epp', x=11.6, z=-46.5, r=PI, id='guardia')
# el furgón de la instaladora: arranca lejos por la ruta (la historia lo trae)
add('vehiculo', nombre='Furgón de la instaladora', modelo='fiorino', color='#f2f4f5', x=-180, z=-80.5, r=0, id='van')
add('persona', nombre='Martín · técnico', modelo='tec-h-epp', cartel=False, x=11.5, z=-21, r=PI, id='tec')
esc = {'v': 1, 'nombre': 'Parque Logístico Norte', 'inicio': {'tx': 0, 'tz': 4, 'yaw': .72, 'pitch': .78, 'd': 230}, 'piezas': P}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'motor', 'escenas', 'ondi-web.json')
json.dump(esc, open(out, 'w'), ensure_ascii=False, separators=(',', ':')); print(out, len(P), 'piezas')
