// Avatar a partir de un modelo GLB con esqueleto (nombres tipo Mixamo). Expone las mismas articulaciones que el muñeco de la oficina
// (hip, chest, head, lL/lR{th,kn,an}, aL/aR{sh,el}) como objetos livianos; sync() pasa esos ángulos a los huesos.
// Convención del muñeco: mira hacia +x, rotation.z positiva = flexión hacia adelante. El modelo GLB mira hacia +z.
import * as THREE from './three.module.min.js';
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const q = () => new THREE.Quaternion(), aa = (ax, a) => q().setFromAxisAngle(ax, a);
const J = () => ({ rotation: new THREE.Euler(), position: new THREE.Vector3() });
export function avatarGLB(scene, { alto = 1.75 } = {}) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(scene); g.add(inner); inner.rotation.y = Math.PI / 2;
  scene.updateMatrixWorld(true);
  // nombres de hueso: admite el esqueleto "game_engine" de MakeHuman (pelvis, thigh_l, upperarm_l…) y el tipo Mixamo (Hips, LeftUpLeg, LeftArm…)
  const ALIAS = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', head: 'Head' };
  for (const [s, S] of [['l', 'Left'], ['r', 'Right']]) Object.assign(ALIAS, { ['clavicle_' + s]: S + 'Shoulder', ['upperarm_' + s]: S + 'Arm', ['lowerarm_' + s]: S + 'ForeArm', ['hand_' + s]: S + 'Hand', ['thigh_' + s]: S + 'UpLeg', ['calf_' + s]: S + 'Leg', ['foot_' + s]: S + 'Foot', ['ball_' + s]: S + 'ToeBase' });
  const B = {}; scene.traverse(o => { if (o.isBone) { const n = o.name.replace(/^mixamorig:?/, ''); B[ALIAS[n] || n] = o } });
  const box = new THREE.Box3(), bb = new THREE.Box3(); scene.traverse(o => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; const m = o.material; if (m && m.transparent) { m.transparent = false; m.alphaTest = .32; m.depthWrite = true; m.side = THREE.DoubleSide; o.castShadow = false } if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)) } });
  const h0 = box.max.y - box.min.y, k = alto / h0; scene.scale.setScalar(k); scene.position.y = -box.min.y * k; scene.updateMatrixWorld(true);
  // reposo: orientación de cada hueso en el espacio del modelo
  const inv = q().copy(scene.getWorldQuaternion(q())).invert(), rest = {}, restL = {}, wpos = n => B[n].getWorldPosition(new THREE.Vector3());
  for (const n in B) { rest[n] = inv.clone().multiply(B[n].getWorldQuaternion(q())); restL[n] = B[n].quaternion.clone() }
  const hipRest = B.Hips.position.clone(), hipY = wpos('Hips').y;
  // brazos: del reposo (en A o en T) a colgar al costado, apenas abiertos
  const down = (s, A = 'Arm', Bn = 'ForeArm') => { const a = wpos(s + A), b = wpos(s + Bn), d = b.sub(a).normalize(); d.applyQuaternion(q().copy(inner.getWorldQuaternion(q())).invert()); const sg = s === 'Left' ? 1 : -1; return q().setFromUnitVectors(d, new THREE.Vector3(sg * .16, -1, .02).normalize()) };
  const R0 = { Left: down('Left'), Right: down('Right') };
  const R1 = { Left: down('Left', 'ForeArm', 'Hand'), Right: down('Right', 'ForeArm', 'Hand') };   // el antebrazo en reposo suele venir doblado: se lleva a recto
  // manos relajadas: cada dedo se curva un poco hacia la palma (en reposo la palma mira hacia abajo)
  const C = {}, mano = {}, pm = n => wpos(n).applyQuaternion(q().copy(inner.getWorldQuaternion(q())).invert());
  for (const S of ['Left', 'Right']) { if (!B[S + 'HandIndex1'] || !B[S + 'HandPinky1'] || !B[S + 'HandMiddle1']) continue;
    const n = pm(S + 'HandIndex1').sub(pm(S + 'HandPinky1')).cross(pm(S + 'HandMiddle1').sub(pm(S + 'Hand'))).normalize(); if (n.y > 0) n.negate();
    for (const F of ['Index', 'Middle', 'Ring', 'Pinky']) { let d = null; for (let j = 1; j <= 3; j++) { const nm = S + 'Hand' + F + j, nx = S + 'Hand' + F + (j + 1); if (!B[nm]) continue;
        if (B[nx]) d = pm(nx).sub(pm(nm)).normalize(); if (!d) continue; C[nm] = aa(d.clone().cross(n).normalize(), .3 * j + (F === 'Pinky' ? .1 : 0)); mano[nm] = S + 'Hand' } } }
  const o = { g, hip: J(), chest: J(), head: J(), lL: { th: J(), kn: J(), an: J() }, lR: { th: J(), kn: J(), an: J() }, aL: { sh: J(), el: J() }, aR: { sh: J(), el: J() }, bones: B, alto };
  o.hip.position.y = .95;
  const W = {}, order = []; let top = B.Hips; while (top.parent && top.parent.isBone) top = top.parent; (function walk(b) { if (b.isBone) order.push(b); b.children.forEach(walk) })(top);
  const nameOf = new Map(Object.entries(B).map(([n, b]) => [b, n]));
  const fx = a => aa(X, -a);   // flexión sagital
  o.sync = () => {
    const D = {};   // giro pedido para cada hueso, en el espacio del modelo
    const th = s => fx(s.th.rotation.z), sp = fx(o.chest.rotation.z).premultiply(aa(Y, o.chest.rotation.y));
    D.Spine1 = sp; D.Spine2 = sp; D.Neck = sp.clone(); D.Head = sp.clone().multiply(aa(Y, o.head.rotation.y)).multiply(fx(o.head.rotation.z));
    for (const [S, l, a] of [['Left', o.lL, o.aL], ['Right', o.lR, o.aR]]) {
      D[S + 'UpLeg'] = th(l); D[S + 'Leg'] = fx(l.th.rotation.z + l.kn.rotation.z); D[S + 'Foot'] = fx(l.th.rotation.z + l.kn.rotation.z + l.an.rotation.z); D[S + 'ToeBase'] = D[S + 'Foot'];
      const up = sp.clone().multiply(aa(Y, (S === 'Left' ? 1 : -1) * (a.sh.rotation.x || 0))).multiply(fx(a.sh.rotation.z)), ar = up.clone().multiply(R0[S]);
      D[S + 'Shoulder'] = sp; D[S + 'Arm'] = ar; D[S + 'ForeArm'] = up.clone().multiply(fx(a.el.rotation.z)).multiply(R1[S]);
    }
    for (const b of order) { const n = nameOf.get(b), p = b.parent && b.parent.isBone ? nameOf.get(b.parent) : null;
      // sin giro propio: hereda el del padre (manos, dedos, columna baja)
      if (!D[n]) D[n] = C[n] ? D[mano[n]].clone().multiply(C[n]) : p ? D[p] : q();
      const w = D[n].clone().multiply(rest[n]); W[n] = w;
      if (p) b.quaternion.copy(W[p].clone().invert().multiply(w)); else b.quaternion.copy(restL[n]).multiply(rest[n].clone().invert().multiply(D[n]).multiply(rest[n])) }
    B.Hips.position.copy(hipRest); B.Hips.position.y += (o.hip.position.y - .95) * (alto / 1.75) / k;
  };
  return o }
