# Arma motor/avatar.js: el núcleo de avatares de Olumi (postura, caminar, gestos) y la variedad de piel, pelo y ropa, como módulo del motor común.
# Una sola fuente: el núcleo sale de olumi/beta/avatares.html (la copia de avatar-core.js que ya controla verificar.js) y la variedad de olumi/beta/oficina.html.
# Se corre cada vez que cambia el núcleo o la variedad:  python3 servidor/taller3d/motor_avatar.py
import os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
av = open(os.path.join(R, 'olumi/beta/avatares.html'), encoding='utf-8').read()
A = 'const {avatarGLB,avPose,avGesto,AV_GES,avMat}=(function(THREE){'
i = av.index(A) + len(A); j = av.index('})(THREE);', i); core = av[i:j]
assert 'return {avatarGLB' in core and '</script' not in core
of = open(os.path.join(R, 'olumi/beta/oficina.html'), encoding='utf-8').read()
i = of.index('const AVV={'); j = of.index('// La piel: la que la persona eligió', i); varia = of[i:j]
for k in ('function avvMedia', 'function avvTinte', 'BOTAS:'): assert k in varia, k
out = """// Motor común · personas: el mismo núcleo de Olumi (reposo natural, caminar con pisada, gestos) y la misma variedad de piel, pelo y ropa.
// ARCHIVO ARMADO: no se edita a mano. Fuente: olumi/beta/avatares.html y olumi/beta/oficina.html; se rearma con servidor/taller3d/motor_avatar.py
import { THREE } from './nucleo.js';
export const {avatarGLB,avPose,avGesto,AV_GES,avMat}=(function(THREE){""" + core + """})(THREE);
""" + varia + """
export function hsh(s){let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h}
// variedad de una persona del motor: piel, pelo, ropa, casco, chaleco, pantalón y botas por su id (siempre la misma para el mismo id)
export function variar(o,id){try{const h=hsh(String(id)+'·v'),piel=AVV.PIEL[h%AVV.PIEL.length],pelo=AVV.PELO[(h>>>4)%AVV.PELO.length],hecho=new Map();
  o.g.traverse(x=>{if(!x.isMesh||!x.material||Array.isArray(x.material))return;const n=(x.material.name||'')+' '+(x.name||'');
    const tipo=/body/i.test(n)?'piel':/short|ponytail|hair|pelo|bob|braid|bun/i.test(n)?'pelo':/elegantsuit/i.test(n)?'mujer':/casualsuit/i.test(n)?'casual':/worksuit/i.test(n)?'tecnico':/polo/i.test(n)?'polo':
      /casco/i.test(n)?'casco':/chaleco/i.test(n)?'chaleco':/pants/i.test(n)?'pantalon':/sweater/i.test(n)?'sueter':/boot/i.test(n)?'botas':'';
    const epp=tipo==='casco'?AVV.CASCO[(h>>>12)%AVV.CASCO.length]:tipo==='chaleco'?AVV.CHALECO[(h>>>14)%AVV.CHALECO.length]:tipo==='pantalon'?AVV.PANTALON[(h>>>16)%AVV.PANTALON.length]:tipo==='botas'?AVV.BOTAS[(h>>>18)%AVV.BOTAS.length]:undefined;
    if(!tipo||epp===null)return;let m=hecho.get(x.material);if(!m){m=x.material.clone();hecho.set(x.material,m)}x.material=m;
    if(tipo==='piel'){m.color.setRGB(piel[0],piel[1],piel[2])}else if(tipo==='casco'){m.color.set(epp)}
    else{const L=AVV.ROPA[tipo];avvTinte(m,epp||(tipo==='pelo'?pelo:L?L[(h>>>8)%L.length]:'#555'),tipo==='pelo'?.85:tipo==='chaleco'?.75:.8,AVV.MASCARA[tipo],tipo==='pelo'?1.45:2)}})}catch(e){}}
"""
open(os.path.join(R, 'motor/avatar.js'), 'w', encoding='utf-8').write(out)
print('motor/avatar.js', len(out))
