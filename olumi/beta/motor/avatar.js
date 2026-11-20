// Motor común · personas: el mismo núcleo de Olumi (reposo natural, caminar con pisada, gestos) y la misma variedad de piel, pelo y ropa.
// ARCHIVO ARMADO: no se edita a mano. Fuente: olumi/beta/avatares.html y olumi/beta/oficina.html; se rearma con servidor/taller3d/motor_avatar.py
import { THREE } from './nucleo.js?v=8d9e6df2';
export const {avatarGLB,avPose,avGesto,AV_GES,avMat}=(function(THREE){
// ---------- avatares 3D · núcleo (sin nada propio de la oficina: lo usan la oficina y el visor del taller) ----------
// avatarGLB(escena, alto): prepara un modelo GLB con esqueleto (nombres tipo Mixamo o "game_engine" de MakeHuman) y devuelve la persona:
//   .g (grupo que se ubica y gira; mira hacia +x como el muñeco), las articulaciones que se pueden mover (hip, chest, head, lL/lR, aL/aR),
//   .an (medidas del cuerpo, en metros) y .sync() (pasa las articulaciones a los huesos).
// avPose(o, modo, dt, c): mueve esas articulaciones con anatomía: al caminar los pies siguen una pisada (apoyan planos, no patinan) y las
//   rodillas salen de la geometría de la pierna; sentado, la cadera queda sobre el asiento, los pies en el piso y las manos llegan al teclado.
const avatarGLB=(()=>{const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),q=()=>new THREE.Quaternion(),aa=(ax,a)=>q().setFromAxisAngle(ax,a),J=()=>({rotation:new THREE.Euler(),position:new THREE.Vector3()}),fx=a=>aa(X,-a);
  const ALIAS={pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',neck_01:'Neck',head:'Head'};for(const [s,S] of [['l','Left'],['r','Right']])Object.assign(ALIAS,{['clavicle_'+s]:S+'Shoulder',['upperarm_'+s]:S+'Arm',['lowerarm_'+s]:S+'ForeArm',['hand_'+s]:S+'Hand',['thigh_'+s]:S+'UpLeg',['calf_'+s]:S+'Leg',['foot_'+s]:S+'Foot',['ball_'+s]:S+'ToeBase'});
  return function(scene,alto){const g=new THREE.Group(),inner=new THREE.Group();inner.add(scene);g.add(inner);inner.rotation.y=Math.PI/2;scene.updateMatrixWorld(true);
    const B={};scene.traverse(o=>{if(o.isBone){const n=o.name.replace(/^mixamorig:?/,'');B[ALIAS[n]||n]=o}});if(!B.Hips||!B.LeftUpLeg||!B.LeftLeg||!B.LeftFoot||!B.LeftArm||!B.LeftForeArm||!B.LeftHand)return null;
    const box=new THREE.Box3(),bb=new THREE.Box3();scene.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();box.union(bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld))}});
    const k=alto/(box.max.y-box.min.y);scene.scale.setScalar(k);scene.position.y=-box.min.y*k;scene.updateMatrixWorld(true);
    // todo lo que sigue se mide en el "espacio del modelo": x = su izquierda, y = arriba, z = adelante, en metros
    const inv=scene.getWorldQuaternion(q()).invert(),rest={},restL={},pm=n=>B[n].getWorldPosition(new THREE.Vector3()).applyQuaternion(inv);
    for(const n in B){rest[n]=inv.clone().multiply(B[n].getWorldQuaternion(q()));restL[n]=B[n].quaternion.clone()}
    const hipRest=B.Hips.position.clone(),sg=S=>S==='Left'?1:-1;
    // piernas: el molde viene parado con las piernas abiertas y los pies hacia afuera; se llevan a caer derechas, con la punta apenas abierta
    const LG={},AN={alto};
    for(const S of ['Left','Right']){const h=pm(S+'UpLeg'),a=pm(S+'Foot'),t=B[S+'ToeBase']?pm(S+'ToeBase'):a.clone().add(Z),f=t.clone().sub(a),l=a.clone().sub(h);
      const yaw=sg(S)*.07-Math.atan2(f.x,f.z),lat=Math.atan2(sg(S)*.085*alto/1.75-h.x,-l.y)-Math.atan2(l.x,-l.y);LG[S]=aa(Z,lat).multiply(aa(Y,yaw))}
    // el molde puede traer la rodilla algo doblada (MakeHuman, unos 6°): cuánto va hacia adelante el muslo y hacia atrás la pierna en el reposo,
    // para que «recta» sea recta (si no, esos grados se suman a cada pose: parado quedaba con las rodillas flojas, unos 13°)
    const LS={};for(const S of ['Left','Right']){const sa=d=>{d.applyQuaternion(LG[S]);return Math.atan2(d.z,-d.y)};LS[S]=[sa(pm(S+'Leg').sub(pm(S+'UpLeg'))),sa(pm(S+'Foot').sub(pm(S+'Leg')))]}
    {const h=pm('LeftUpLeg'),kn=pm('LeftLeg'),a=pm('LeftFoot'),s=pm('LeftArm'),e=pm('LeftForeArm'),w=pm('LeftHand'),t=B.LeftToeBase?pm('LeftToeBase'):a;
      Object.assign(AN,{hipW:Math.abs(h.x),lat0:.085*alto/1.75,Lt:h.distanceTo(kn),Ls:kn.distanceTo(a),hipH:h.y,footH:a.y,toe:Math.hypot(t.z-a.z,t.x-a.x),La:s.distanceTo(e),Lf:e.distanceTo(w),shY:s.y-h.y,shZ:s.z-h.z,shX:Math.abs(s.x),hand:B.LeftHandMiddle1?pm('LeftHandMiddle1').distanceTo(w)*2.1:.17})}
    // brazos y antebrazos: del reposo (en A, con el codo algo doblado) a colgar rectos al costado
    const down=(S,a,b)=>q().setFromUnitVectors(pm(S+b).sub(pm(S+a)).normalize(),new THREE.Vector3(sg(S)*.135,-1,.02).normalize());
    const R0={Left:down('Left','Arm','ForeArm'),Right:down('Right','Arm','ForeArm')},R1={Left:down('Left','ForeArm','Hand'),Right:down('Right','ForeArm','Hand')};
    // manos: normal de la palma en reposo (para girar la muñeca) y dedos relajados, cada uno curvado un poco hacia la palma
    const C={},mano={},PAL={},TH={},PUNO=[0,1.3,2.85,3.7],PULG=[.6,.0];
    for(const S of ['Left','Right']){if(!B[S+'HandIndex1']||!B[S+'HandPinky1']||!B[S+'HandMiddle1'])continue;const n=pm(S+'HandIndex1').sub(pm(S+'HandPinky1')).cross(pm(S+'HandMiddle1').sub(pm(S+'Hand'))).normalize();{const ac=new THREE.Vector3();for(const F of ['Index','Middle','Ring','Pinky']){const a1=B[S+'Hand'+F+'1'],a2=B[S+'Hand'+F+'2'],a3=B[S+'Hand'+F+'3'];if(a1&&a2&&a3){const d1=pm(S+'Hand'+F+'2').sub(pm(S+'Hand'+F+'1')),d2=pm(S+'Hand'+F+'3').sub(pm(S+'Hand'+F+'2'));ac.add(d1.clone().cross(d2).cross(d1).normalize().multiplyScalar(d1.clone().normalize().cross(d2.clone().normalize()).length()))}}
        AN['curva'+S]=+ac.length().toFixed(3);if(ac.length()>.05?n.dot(ac)<0:n.y>0)n.negate()}PAL[S]=n;
      for(const F of ['Index','Middle','Ring','Pinky']){let d=null;for(let j=1;j<=3;j++){const nm=S+'Hand'+F+j,nx=S+'Hand'+F+(j+1);if(!B[nm])continue;if(B[nx])d=pm(nx).sub(pm(nm)).normalize();if(!d)continue;C[nm]={ax:d.clone().cross(n).normalize(),a:[0,.3,.52,.3][j]+{Index:0,Middle:.05,Ring:.1,Pinky:.16}[F]*(j<3?1:.5),j,S};mano[nm]=S+'Hand'}}
      // dedos: el molde los trae abiertos en abanico (parecían garras); quietos quedan casi juntos, con un 30 % de esa abertura
      const dir=F=>B[S+'Hand'+F+'2']?pm(S+'Hand'+F+'2').sub(pm(S+'Hand'+F+'1')):null,dM=dir('Middle'),ang=(a,b)=>{const pa=a.clone().addScaledVector(n,-a.dot(n)),pb=b.clone().addScaledVector(n,-b.dot(n));return Math.atan2(pa.clone().cross(pb).dot(n),pa.dot(pb))};
      for(const F of ['Index','Ring','Pinky']){const d=dir(F);if(!d||!dM)continue;const ad=-.7*ang(dM,d);for(let j=1;j<=3;j++)if(C[S+'Hand'+F+j])C[S+'Hand'+F+j].ad=ad}
      /* pulgar: se abre girando en el plano de la palma, alejándose de los otros dedos (para el "me gusta"); quieto se apoya cerca del índice */
      if(B[S+'HandThumb1']&&B[S+'HandThumb2']){const dT=pm(S+'HandThumb2').sub(pm(S+'HandThumb1')),dF=pm(S+'HandMiddle1').sub(pm(S+'Hand')),sgn=Math.sign(dF.clone().cross(dT).dot(n))||1;const dI=dir('Index'),abre=dI?Math.abs(ang(dI,dT)):0,cz=Math.max(0,(abre-.4)*.75);AN['pulgar'+S]=+abre.toFixed(2);for(let j=1;j<=3;j++)if(B[S+'HandThumb'+j]){TH[S+'HandThumb'+j]={ax:n.clone(),sg:sgn,ej:dT.clone().normalize().cross(n).normalize(),j,S,cz};mano[S+'HandThumb'+j]=S+'Hand'}}}
    const o={g,an:AN,bones:B,hip:J(),chest:J(),head:J(),lL:{th:J(),kn:J(),an:J(),ab:0,yw:0},lR:{th:J(),kn:J(),an:J(),ab:0,yw:0},hipS:0,roll:0,aL:{sh:J(),el:J(),in:0,palma:0},aR:{sh:J(),el:J(),in:0,palma:0},hipY:null,hipX:0};o.hip.position.y=.95;
    let top=B.Hips;while(top.parent&&top.parent.isBone)top=top.parent;const order=[];(function walk(b){if(b.isBone)order.push(b);b.children.forEach(walk)})(top);
    const nameOf=new Map(Object.entries(B).map(([n,b])=>[b,n])),W={},DN=new THREE.Vector3(0,-1,0),v1=new THREE.Vector3(),v2=new THREE.Vector3(),v3=new THREE.Vector3(),v4=new THREE.Vector3();
    o.sync=()=>{const D={},sp=aa(Y,o.chest.rotation.y).multiply(aa(Z,o.chest.rotation.x||0)).multiply(fx(o.chest.rotation.z));D.Hips=aa(Z,o.roll||0);D.Spine1=sp;D.Spine2=sp;D.Neck=sp;D.Head=sp.clone().multiply(aa(Y,o.head.rotation.y)).multiply(aa(Z,o.head.rotation.x||0)).multiply(fx(o.head.rotation.z));
      for(const [S,l,a] of [['Left',o.lL,o.aL],['Right',o.lR,o.aR]]){const t=l.th.rotation.z,kn=t+l.kn.rotation.z,yq=aa(Y,sg(S)*(l.yw||0)),lq=yq.clone().multiply(aa(Z,l.ab||0));     // ab: la pierna se abre o se cierra desde la cadera; yw: la punta del pie gira hacia afuera
        D[S+'UpLeg']=lq.clone().multiply(fx(t-LS[S][0])).multiply(LG[S]);D[S+'Leg']=lq.multiply(fx(kn-LS[S][1])).multiply(LG[S]);D[S+'Foot']=yq.multiply(fx(kn+l.an.rotation.z)).multiply(LG[S]);D[S+'ToeBase']=D[S+'Foot'];
        // brazo: abre o cierra (in > 0 lo trae hacia el centro), sube hacia adelante y dobla el codo; la muñeca gira para dejar la palma hacia el cuerpo (0) o hacia abajo (1)
        const up=sp.clone().multiply(aa(Y,sg(S)*((a.sh.rotation.x||0)-(a.in||0)))).multiply(fx(a.sh.rotation.z));/* ritmo del hombro: cuando el brazo sube, la clavícula sube con él (un tercio del camino); si no, el brazo parece salirse del hombro */
        const cla=Math.min(.42,Math.max(0,Math.abs(a.sh.rotation.z)-.7)*.2);D[S+'Shoulder']=cla>.001?sp.clone().multiply(aa(Z,sg(S)*cla)):sp;D[S+'Arm']=up.clone().multiply(R0[S]);
        let fo=up.clone().multiply(fx(a.el.rotation.z)).multiply(R1[S]);
        if(PAL[S]){const f=v1.copy(pm0[S]).applyQuaternion(fo).normalize(),n=v2.copy(PAL[S]).applyQuaternion(fo),pf=a.pf||0,want=v3.set(-sg(S)*(1-(a.palma||0))*(1-pf),-(a.palma||0),pf-.15*(1-(a.palma||0))*(1-pf)).normalize();      // pf: palma hacia adelante (saludar)
          n.addScaledVector(f,-n.dot(f)).normalize();want.addScaledVector(f,-want.dot(f));if(want.lengthSq()>1e-4){want.normalize();const ang=Math.atan2(v4.crossVectors(n,want).dot(f),n.dot(want));fo=aa(f,ang).multiply(fo)}}
        D[S+'ForeArm']=fo}
      for(const b of order){const n=nameOf.get(b),p=b.parent&&b.parent.isBone?nameOf.get(b.parent):null;if(!D[n]){const c=C[n],th=TH[n];
          if(c){const pu=(c.S==='Left'?o.aL:o.aR).puno||0;D[n]=D[mano[n]].clone();if(c.ad)D[n].multiply(aa(PAL[c.S],c.ad));D[n].multiply(aa(c.ax,c.a+(PUNO[c.j]-c.a)*pu))}
          else if(th){const pg=(th.S==='Left'?o.aL:o.aR).pulgar||0;D[n]=D[mano[n]].clone().multiply(aa(th.ax,th.sg*(pg*PULG[0]-(th.cz||0)*(1-pg)))).multiply(aa(th.ej,pg*PULG[1]*(th.j-1)))}
          else D[n]=p?D[p]:q()}const w=D[n].clone().multiply(rest[n]);W[n]=w;
        if(p)b.quaternion.copy(W[p].clone().invert().multiply(w));else b.quaternion.copy(restL[n]).multiply(rest[n].clone().invert()).multiply(w)}
      // cadera: altura de la articulación (hipY, en metros desde el piso) o, si no se dio, la del muñeco; y corrimiento hacia adelante (hipX)
      B.Hips.position.copy(hipRest);B.Hips.position.y+=(o.hipY!=null?o.hipY-AN.hipH:(o.hip.position.y-.95)*(alto/1.75))/k;B.Hips.position.z+=(o.hipX||0)/k;B.Hips.position.x+=(o.hipS||0)/k};
    const pm0={Left:pm('LeftHand').sub(pm('LeftForeArm')).normalize(),Right:pm('RightHand').sub(pm('RightForeArm')).normalize()};
    return o}})();

// dos huesos en un plano (muslo–pierna o brazo–antebrazo): ángulos para que la punta llegue a (dx hacia adelante, dy hacia abajo)
// devuelve [a, b]: a = giro del primer hueso desde colgar (adelante +), b = flexión del segundo; dobla = +1 la articulación va hacia adelante (rodilla), -1 hacia atrás (codo)
function av2(L1,L2,dx,dy,dobla){let d=Math.hypot(dx,dy);const m=(L1+L2)*.999,n=Math.abs(L1-L2)*1.02+.001;if(d>m){dx*=m/d;dy*=m/d;d=m}if(d<n){d=n}
  const a1=Math.atan2(dx,dy),al=Math.acos(Math.max(-1,Math.min(1,(L1*L1+d*d-L2*L2)/(2*L1*d)))),be=Math.acos(Math.max(-1,Math.min(1,(L1*L1+L2*L2-d*d)/(2*L1*L2))));return[a1+dobla*al,-dobla*(Math.PI-be)]}
const avSm=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)};
function avPose(o,mode,dt,c){c=c||{};const A=o.an,k=Math.min(1,dt*9),t=(c.t||0)+(o.seed||0),br=Math.sin(t*1.6),L=A.Lt+A.Ls,to=(j,v,kk)=>{j.rotation.z+=(v-j.rotation.z)*(kk==null?k:kk)};
  // distancia caminada → fase del paso (los pies no patinan: un paso mide lo que se avanzó)
  if(c.x!=null){if(o.lx!=null&&mode==='walk'){const d=Math.hypot(c.x-o.lx,c.y-o.ly);if(d<.3)o.gd=(o.gd||0)+d}o.lx=c.x;o.ly=c.y}else if(mode==='walk')o.gd=(o.gd||0)+(c.v||1.2)*dt;
  const paso=.33*A.alto,TR=1.24*paso,mix=o.mix=(o.mix||0)+((mode==='walk'?1:0)-(o.mix||0))*Math.min(1,dt*7);
  if(mode==='sit'){const asiento=c.asiento==null?.47:c.asiento,hy=asiento+.088*A.alto/1.75;o.hipY=o.hipY==null?hy:o.hipY+(hy-o.hipY)*k;o.hipX+=(-.03-o.hipX)*k;o.roll+=(0-o.roll)*k;o.hipS+=(0-o.hipS)*k;o.chest.rotation.x=-o.roll*.7;o.head.rotation.x=o.roll*.35;o.ges=null;
    // piernas: muslos sobre el asiento y pies apoyados en el piso, un poco adelante de la rodilla
    for(const [l,s] of [[o.lL,1],[o.lR,-1]]){const [th,kn]=av2(A.Lt,A.Ls,A.Lt*.94+.05+s*.012,o.hipY-A.footH,1);to(l.th,th);to(l.kn,kn);to(l.an,-(th+kn));l.ab+=(0-l.ab)*k;l.yw+=(0-l.yw)*k}
    o.chest.rotation.z+=(-.03+br*.006-o.chest.rotation.z)*k;o.chest.rotation.y+=(0-o.chest.rotation.y)*k;
    // brazos: al teclado (si hay) con las palmas hacia abajo; si no, las manos descansan sobre los muslos
    const shy=o.hipY+A.shY,ms=!!c.teclado&&Math.sin(t*.37)>.6;
    for(const [a,s] of [[o.aL,1],[o.aR,-1]]){let wx,wy,inn,pal;
      if(c.teclado){const ty=Math.sin(t*(s>0?3.1:2.7)+s)*.008,mouse=ms&&s<0;wx=c.teclado.d-A.hand*.62+(mouse?.03:0)-A.shZ-o.hipX;wy=shy-(c.teclado.h+.045+ty);inn=mouse?-.22:(A.shX-.105)/Math.max(.2,wx);pal=1}
      else{wx=A.Lt*.5-A.shZ-o.hipX;wy=shy-(o.hipY+.105*A.alto/1.75);inn=(A.shX-.1)/Math.max(.2,wx)*.6;pal=.9}
      const [sh,el]=av2(A.La,A.Lf,wx,wy,-1);to(a.sh,sh);to(a.el,el);a.in+=(inn-a.in)*k;a.palma+=(pal-a.palma)*k;a.sh.rotation.x=0;a.pf=0;a.puno=0;a.pulgar=0}
    o.head.rotation.z+=((c.teclado?.1:.02)+Math.sin(t*.5)*.03-o.head.rotation.z)*k;o.head.rotation.y+=((ms?-.14:Math.sin(t*.23)*.08)-o.head.rotation.y)*k;return}
  // de pie: la postura de descanso y el paso se mezclan (mix), así arrancar y frenar no da saltos y al parar se vuelve sola al reposo
  const a175=A.alto/1.75,sd=o.seed||0,fr=x=>x-Math.floor(x),ph=(o.gd||0)/(2*paso),s2=Math.sin(ph*2*Math.PI)*mix,cL=Math.cos(ph*2*Math.PI)*mix,q=1-mix,k2=Math.min(1,dt*10);
  // reposo: el peso va sobre una pierna (la otra afloja la rodilla y esa cadera baja) y cada tanto cambia de lado; cada persona se para un poco distinto
  const per=10+fr(sd*.61)*8,lado=(Math.floor(t/per+fr(sd*.37))%2?1:-1)*(fr(sd*.83)>.5?1:-1);o.pw=o.pw==null?lado:o.pw+(lado-o.pw)*Math.min(1,dt*1.5);
  const ancho=(.078+.02*fr(sd*2.3))*a175,adel=(.012+.03*fr(sd*1.7))*(fr(sd*3.3)>.5?1:-1),punta=.05+.08*fr(sd*5.1);
  const rollQ=q*o.pw*.075+s2*.035,hsQ=(q*o.pw*.034+s2*.014)*a175;o.roll+=(rollQ-o.roll)*k2;o.hipS+=(hsQ-o.hipS)*k2;
  let hy=A.hipH+.03*q-.022*mix+br*.002;const pie=[],yFin=.55*A.toe*.8;
  for(const [l,s,off] of [[o.lL,1,0],[o.lR,-1,.5]]){const u=((ph+off)%1+1)%1;let x,y=0,psi=0;
    if(u<.62){const w=u/.62;x=TR*(.46-w);psi=.24*(1-avSm(0,.14,w))-.55*avSm(.72,1,w)**1.5;y=Math.max(0,-psi)*A.toe*.8}      // apoyo: el pie va hacia atrás; al final levanta el talón
    else{const w=(u-.62)/.38,e=avSm(0,1,w);x=TR*(-.54+e);y=yFin*(1-e)+.07*Math.sin(Math.PI*w)**.9;psi=-.55+.79*avSm(.15,1,w)}   // vuelo: el pie pasa despegado del piso
    // caminando los pies caen casi en una línea (unos 8 cm entre uno y otro); quieto, al ancho de la cadera y con la punta algo abierta
    const libre=Math.max(0,-s*o.pw)*q;pie.push([l,s,x*mix+s*adel*q,y*mix+libre*.012,psi*mix-libre*.1,s*(.05*a175*mix+ancho*q),punta*q])}
  // la cadera baja lo justo para que ninguna pierna tenga que estirarse del todo (cada cadera sube o baja con el ladeo de la pelvis)
  const cad=s=>s*o.roll*A.hipW,dl=(s,lat)=>lat-(s*A.hipW+o.hipS);
  for(const [l,s,x,y,psi,lat] of pie){const m=Math.sqrt(Math.max(.01,(L*(.9985+.0009*q))**2-x*x-dl(s,lat)**2))+A.footH+y-cad(s);if(m<hy)hy=m}
  o.hipY=o.hipY==null?hy:o.hipY+(hy-o.hipY)*Math.min(1,dt*18);o.hipX+=(0-o.hipX)*k;
  const ab0=Math.atan2(A.lat0-A.hipW,A.hipH-A.footH);
  for(const [l,s,x,y,psi,lat,yw] of pie){const dy=o.hipY+cad(s)-A.footH-y,d=dl(s,lat),[th,kn]=av2(A.Lt,A.Ls,x,Math.hypot(dy,d),1);
    l.th.rotation.z=th;l.kn.rotation.z=Math.min(kn,-.04);l.an.rotation.z=psi-(th+l.kn.rotation.z);l.ab=Math.atan2(d,dy)-s*ab0;l.yw=yw}
  o.chest.rotation.z+=((-.035*mix+br*.008)-o.chest.rotation.z)*k;o.chest.rotation.y=cL*.09;o.chest.rotation.x=-o.roll*.7;o.head.rotation.x=o.roll*.35;
  // gesto en curso (saludar, hablar, pensar, mirar la hora, me gusta): entra y sale suave, y al terminar el cuerpo vuelve a lo que estaba haciendo
  let G=null,ge=0,gt=0;if(o.ges){const g=o.ges;if(g.t0==null)g.t0=c.t||0;gt=(c.t||0)-g.t0;if(gt>=g.dur||!AV_GES[g.id])o.ges=null;else{G=AV_GES[g.id];ge=avSm(0,.32,gt)*(1-avSm(g.dur-.4,g.dur,gt))}}
  const gh=G&&G.cabeza?G.cabeza(gt):null,hy0=mix>.3?-cL*.07:Math.sin(t*.3)*.22+Math.sin(t*.071+sd)*.12,hz0=mix>.3?.02:Math.sin(t*.21)*.04;
  o.head.rotation.y+=((gh?hy0+(gh[0]-hy0)*ge:hy0)-o.head.rotation.y)*k;o.head.rotation.z+=((gh?hz0+(gh[1]-hz0)*ge:hz0)-o.head.rotation.z)*k;
  if(G&&G.pecho)o.chest.rotation.z+=G.pecho*ge*k;
  for(const [a,s] of [[o.aL,1],[o.aR,-1]]){
    if(o.carry){a.sh.rotation.x=0;to(a.sh,.5);to(a.el,1.2);a.in+=(.25-a.in)*k;a.palma+=(.2-a.palma)*k;a.pf=0;a.puno=0;a.pulgar=0;continue}
    // brazos: al caminar acompañan el paso; quietos cuelgan sueltos, el del lado del peso apenas más atrás
    const sw=-s*cL;let v=[mix*(sw*.3-.03)+q*(-.06-s*o.pw*.03+br*.006),0,mix*(.44+Math.max(0,sw)*.42)+q*(.16-s*o.pw*.04+.06*fr(sd*(s>0?4.1:6.7))),0,0,0,0,0],kk=.5;
    const gv=G&&G.brazo?G.brazo(gt,s):null;if(gv){v=v.map((x,i)=>x+((gv[i]||0)-x)*ge);kk=Math.min(1,dt*12)}
    to(a.sh,v[0],kk);a.sh.rotation.x+=(v[1]-a.sh.rotation.x)*kk;to(a.el,v[2],kk);a.in+=(v[3]-a.in)*k;a.palma+=(v[4]-a.palma)*k;a.pf=(a.pf||0)+(v[5]-(a.pf||0))*k;a.puno=(a.puno||0)+(v[6]-(a.puno||0))*kk;a.pulgar=(a.pulgar||0)+(v[7]-(a.pulgar||0))*kk}}
// gestos: brazo(t, lado) devuelve [subir adelante, abrir al costado, doblar el codo, cerrar al centro, palma abajo, palma al frente, cerrar el puño, abrir el pulgar] (lado +1 izquierdo, −1 derecho; null = ese brazo sigue en lo suyo)
// y cabeza(t) = [girar, bajar]. Para sumar uno alcanza con agregarlo acá.
const AV_GES={
  saludo:{dur:2.4,brazo:(t,s)=>s<0?[1.5,1.05+Math.sin(t*9)*.16,1.55+Math.sin(t*9)*.22,0,0,1]:null,cabeza:t=>[0,-.03]},
  hablar:{dur:2.8,brazo:(t,s)=>[.36+Math.sin(t*3.7+s)*.07,.12,1.2+Math.sin(t*5.1+s*1.4)*.2,.1,.35,0],cabeza:t=>[Math.sin(t*2.1)*.06,.03+Math.sin(t*4.3)*.03]},
  pensar:{dur:3.6,brazo:(t,s)=>s<0?[.5,0,2.22,.62,0,0]:[.3,0,1.5,.75,.6,0],cabeza:t=>[.12,.1]},
  hora:{dur:2.8,brazo:(t,s)=>s>0?[.42,0,1.42,.78,1,0]:null,cabeza:t=>[.32,.36]},
  like:{dur:2.6,brazo:(t,s)=>s<0?[.5+Math.sin(t*7)*.04*Math.exp(-t*1.2),.1,1.5,.32,0,0,1,1]:null,cabeza:t=>[-.1,.03+Math.sin(t*6)*.03*Math.exp(-t)]}};
// materiales de una persona recién cargada: piel y ropa opacas y con sombra; pelo y ojos recortados (con borde suave si hay antialias);
// cejas y pestañas mezcladas (así se ven pelos y no un trazo negro). lado = tamaño máximo de textura (en teléfonos conviene 1024).
function avMat(scene,lado){const hecho=new Set();scene.traverse(o=>{if(!o.isMesh)return;const m=o.material;o.castShadow=true;if(!m)return;const n=(m.name||'')+' '+(o.name||'');
  if(/brow|lash/i.test(n)){m.transparent=true;m.alphaTest=.03;m.depthWrite=false;m.side=THREE.DoubleSide;m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;o.castShadow=false}
  else if(m.transparent||m.alphaTest>0){m.transparent=false;m.alphaTest=m.alphaTest>0?m.alphaTest:.32;m.alphaToCoverage=true;m.depthWrite=true;m.side=THREE.DoubleSide;o.castShadow=false}
  if(/body/i.test(n)){m.roughness=.5;m.envMapIntensity=.6}
  if(/high-poly|low-poly|eye/i.test(n)&&!/brow|lash/i.test(n)){m.roughness=.08;m.metalness=0;m.envMapIntensity=1.3}   // ojos con brillo (antes mate: mirada apagada)
  if(/hair|pelo|bob|ponytail|braid|bun|short0|long0|afro/i.test(n)&&!/brow|lash/i.test(n)){m.roughness=Math.max(m.roughness,.82);m.envMapIntensity=.28;m.alphaToCoverage=false}   // pelo sin motas ni contornos claros: los mechones reflejaban el cuarto como puntitos y el borde suavizado dejaba ver el fondo entre capas
  if(m.map&&!hecho.has(m.map)){hecho.add(m.map);m.map.anisotropy=4;const im=m.map.image;
    if(lado&&im&&Math.max(im.width,im.height)>lado&&typeof document!=='undefined'){const k=lado/Math.max(im.width,im.height),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);m.map.image=c;m.map.needsUpdate=true}}})}
function avGesto(o,id,dur){if(!o||!AV_GES[id]||o.ges&&o.ges.id===id)return;o.ges={id,dur:dur||AV_GES[id].dur,t0:null}}

;return {avatarGLB,avPose,avGesto,AV_GES,avMat}})(THREE);
const AVV={
  PIEL:[[1,1,1],[.95,.88,.82],[.84,.71,.61],[.66,.5,.4],[.48,.35,.27]],              // de más clara a más oscura (multiplica la piel del modelo)
  PELO:['#14100e','#2e211a','#5a3a24','#8a5c33','#c9a06a','#9b9ba1','#3d2b22'],      // negro, castaños, rubio, canoso
  ROPA:{casual:['#3d5d8f','#2b2d33','#a99a7e','#4f5a3a','#6e2e37','#365a6e'],
        mujer:['#6e2e37','#2f3d55','#3d5a4a','#55473e','#7a5a8a','#2b2b30'],
        tecnico:['#3c6db0','#24334f','#56595f','#b4561f','#2f5d43'],
        polo:['#d9d9dc','#FF7A1A','#203150','#3c3c42','#7a2030'],
        sueter:['#7a2e33','#2f3d55','#b9a78c','#3d5a4a','#5a4a3e','#8a8f98','#a8483a']},   // suéter tejido (mujer con pantalón, 15/11)
  // técnicos con equipo de seguridad: casco (null = el blanco del modelo), chaleco (null = el amarillo del modelo) y pantalón; sin esto
  // dos técnicos juntos parecían mellizos (el chaleco y el casco tapan casi toda la ropa)
  // en la textura de «camisa y jean» (male_casualsuit01) el jean es la columna del medio: se tiñe solo la camisa
  MASCARA:{casual:'(vMapUv.x<.34&&vMapUv.y>.30)||(vMapUv.x>.72&&vMapUv.y>.20)'},
  CASCO:[null,'#2f6fd6','#f2c200','#ff7a1a'],CHALECO:[null,'#ff6a00'],PANTALON:['#2b2f38','#3a3f4a','#4a4234','#1f2a3d'],
  BOTAS:['#2a2523','#4a3527','#1d1d20','#6a5444']};   // las botas del modelo son blancas: negras o marrones, cada una la suya
function avvMedia(tex){try{const im=tex&&tex.image;if(!im)return .2;const c=document.createElement('canvas');c.width=c.height=12;const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(im,0,0,12,12);const d=g.getImageData(0,0,12,12).data;let s=0,n=0;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;const l=x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};s+=.2126*l(d[i])+.7152*l(d[i+1])+.0722*l(d[i+2]);n++}
  return n?Math.max(.01,s/n):.2}catch(e){return .2}}
const AVV_MED=new WeakMap();
// cambia el color de una tela o del pelo conservando su dibujo: el color nuevo por la luz relativa de cada punto de la textura
function avvTinte(m,hex,mezcla,mascara,tope){if(!m.map)return;let med=AVV_MED.get(m.map);if(med==null){med=avvMedia(m.map);AVV_MED.set(m.map,med)}
  // mascara: qué parte de la textura se tiñe (p. ej. solo la camisa en un conjunto camisa + jean); tope: cuánto puede aclarar un brillo (el pelo menos, si no se ve decolorado)
  const u={tinte:{value:new THREE.Color(hex)},mezcla:{value:mezcla},media:{value:med}};m.userData.avv=u;
  m.onBeforeCompile=sh=>{sh.uniforms.uAvTinte=u.tinte;sh.uniforms.uAvMezcla=u.mezcla;sh.uniforms.uAvMedia=u.media;
    sh.fragmentShader='uniform vec3 uAvTinte;uniform float uAvMezcla;uniform float uAvMedia;\n'+sh.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\n vec4 sampledDiffuseColor=texture2D(map,vMapUv);float avL=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));\n'+
      ' float avM='+(mascara?'(('+mascara+')?uAvMezcla:0.)':'uAvMezcla')+';\n'+
      ' sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,uAvTinte*clamp(avL/uAvMedia,.15,'+(tope||2).toFixed(2)+'),avM);diffuseColor*=sampledDiffuseColor;\n#endif')};
  m.customProgramCacheKey=()=>'avv'+(mascara||'')+(tope||2);m.needsUpdate=true}

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
