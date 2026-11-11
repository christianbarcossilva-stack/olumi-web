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
    {const h=pm('LeftUpLeg'),kn=pm('LeftLeg'),a=pm('LeftFoot'),s=pm('LeftArm'),e=pm('LeftForeArm'),w=pm('LeftHand'),t=B.LeftToeBase?pm('LeftToeBase'):a;
      Object.assign(AN,{hipW:Math.abs(h.x),lat0:.085*alto/1.75,Lt:h.distanceTo(kn),Ls:kn.distanceTo(a),hipH:h.y,footH:a.y,toe:Math.hypot(t.z-a.z,t.x-a.x),La:s.distanceTo(e),Lf:e.distanceTo(w),shY:s.y-h.y,shZ:s.z-h.z,shX:Math.abs(s.x),hand:B.LeftHandMiddle1?pm('LeftHandMiddle1').distanceTo(w)*2.1:.17})}
    // brazos y antebrazos: del reposo (en A, con el codo algo doblado) a colgar rectos al costado
    const down=(S,a,b)=>q().setFromUnitVectors(pm(S+b).sub(pm(S+a)).normalize(),new THREE.Vector3(sg(S)*.1,-1,.02).normalize());
    const R0={Left:down('Left','Arm','ForeArm'),Right:down('Right','Arm','ForeArm')},R1={Left:down('Left','ForeArm','Hand'),Right:down('Right','ForeArm','Hand')};
    // manos: normal de la palma en reposo (para girar la muñeca) y dedos relajados, cada uno curvado un poco hacia la palma
    const C={},mano={},PAL={};
    for(const S of ['Left','Right']){if(!B[S+'HandIndex1']||!B[S+'HandPinky1']||!B[S+'HandMiddle1'])continue;const n=pm(S+'HandIndex1').sub(pm(S+'HandPinky1')).cross(pm(S+'HandMiddle1').sub(pm(S+'Hand'))).normalize();{const ac=new THREE.Vector3();for(const F of ['Index','Middle','Ring','Pinky']){const a1=B[S+'Hand'+F+'1'],a2=B[S+'Hand'+F+'2'],a3=B[S+'Hand'+F+'3'];if(a1&&a2&&a3){const d1=pm(S+'Hand'+F+'2').sub(pm(S+'Hand'+F+'1')),d2=pm(S+'Hand'+F+'3').sub(pm(S+'Hand'+F+'2'));ac.add(d1.clone().cross(d2).cross(d1).normalize().multiplyScalar(d1.clone().normalize().cross(d2.clone().normalize()).length()))}}
        AN['curva'+S]=+ac.length().toFixed(3);if(ac.length()>.05?n.dot(ac)<0:n.y>0)n.negate()}PAL[S]=n;
      for(const F of ['Index','Middle','Ring','Pinky']){let d=null;for(let j=1;j<=3;j++){const nm=S+'Hand'+F+j,nx=S+'Hand'+F+(j+1);if(!B[nm])continue;if(B[nx])d=pm(nx).sub(pm(nm)).normalize();if(!d)continue;C[nm]=aa(d.clone().cross(n).normalize(),.2*j+(F==='Pinky'?.08:0));mano[nm]=S+'Hand'}}}
    const o={g,an:AN,bones:B,hip:J(),chest:J(),head:J(),lL:{th:J(),kn:J(),an:J(),ab:0,yw:0},lR:{th:J(),kn:J(),an:J(),ab:0,yw:0},hipS:0,roll:0,aL:{sh:J(),el:J(),in:0,palma:0},aR:{sh:J(),el:J(),in:0,palma:0},hipY:null,hipX:0};o.hip.position.y=.95;
    let top=B.Hips;while(top.parent&&top.parent.isBone)top=top.parent;const order=[];(function walk(b){if(b.isBone)order.push(b);b.children.forEach(walk)})(top);
    const nameOf=new Map(Object.entries(B).map(([n,b])=>[b,n])),W={},DN=new THREE.Vector3(0,-1,0),v1=new THREE.Vector3(),v2=new THREE.Vector3(),v3=new THREE.Vector3(),v4=new THREE.Vector3();
    o.sync=()=>{const D={},sp=aa(Y,o.chest.rotation.y).multiply(aa(Z,o.chest.rotation.x||0)).multiply(fx(o.chest.rotation.z));D.Hips=aa(Z,o.roll||0);D.Spine1=sp;D.Spine2=sp;D.Neck=sp;D.Head=sp.clone().multiply(aa(Y,o.head.rotation.y)).multiply(aa(Z,o.head.rotation.x||0)).multiply(fx(o.head.rotation.z));
      for(const [S,l,a] of [['Left',o.lL,o.aL],['Right',o.lR,o.aR]]){const t=l.th.rotation.z,kn=t+l.kn.rotation.z,yq=aa(Y,sg(S)*(l.yw||0)),lq=yq.clone().multiply(aa(Z,l.ab||0));     // ab: la pierna se abre o se cierra desde la cadera; yw: la punta del pie gira hacia afuera
        D[S+'UpLeg']=lq.clone().multiply(fx(t)).multiply(LG[S]);D[S+'Leg']=lq.multiply(fx(kn)).multiply(LG[S]);D[S+'Foot']=yq.multiply(fx(kn+l.an.rotation.z)).multiply(LG[S]);D[S+'ToeBase']=D[S+'Foot'];
        // brazo: abre o cierra (in > 0 lo trae hacia el centro), sube hacia adelante y dobla el codo; la muñeca gira para dejar la palma hacia el cuerpo (0) o hacia abajo (1)
        const up=sp.clone().multiply(aa(Y,sg(S)*((a.sh.rotation.x||0)-(a.in||0)))).multiply(fx(a.sh.rotation.z));D[S+'Shoulder']=sp;D[S+'Arm']=up.clone().multiply(R0[S]);
        let fo=up.clone().multiply(fx(a.el.rotation.z)).multiply(R1[S]);
        if(PAL[S]){const f=v1.copy(pm0[S]).applyQuaternion(fo).normalize(),n=v2.copy(PAL[S]).applyQuaternion(fo),pf=a.pf||0,want=v3.set(-sg(S)*(1-(a.palma||0))*(1-pf),-(a.palma||0),pf-.15*(1-(a.palma||0))*(1-pf)).normalize();      // pf: palma hacia adelante (saludar)
          n.addScaledVector(f,-n.dot(f)).normalize();want.addScaledVector(f,-want.dot(f));if(want.lengthSq()>1e-4){want.normalize();const ang=Math.atan2(v4.crossVectors(n,want).dot(f),n.dot(want));fo=aa(f,ang).multiply(fo)}}
        D[S+'ForeArm']=fo}
      for(const b of order){const n=nameOf.get(b),p=b.parent&&b.parent.isBone?nameOf.get(b.parent):null;if(!D[n])D[n]=C[n]?D[mano[n]].clone().multiply(C[n]):p?D[p]:q();const w=D[n].clone().multiply(rest[n]);W[n]=w;
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
      const [sh,el]=av2(A.La,A.Lf,wx,wy,-1);to(a.sh,sh);to(a.el,el);a.in+=(inn-a.in)*k;a.palma+=(pal-a.palma)*k;a.sh.rotation.x=0;a.pf=0}
    o.head.rotation.z+=((c.teclado?.1:.02)+Math.sin(t*.5)*.03-o.head.rotation.z)*k;o.head.rotation.y+=((ms?-.14:Math.sin(t*.23)*.08)-o.head.rotation.y)*k;return}
  // de pie: la postura de descanso y el paso se mezclan (mix), así arrancar y frenar no da saltos y al parar se vuelve sola al reposo
  const a175=A.alto/1.75,sd=o.seed||0,fr=x=>x-Math.floor(x),ph=(o.gd||0)/(2*paso),s2=Math.sin(ph*2*Math.PI)*mix,cL=Math.cos(ph*2*Math.PI)*mix,q=1-mix,k2=Math.min(1,dt*10);
  // reposo: el peso va sobre una pierna (la otra afloja la rodilla y esa cadera baja) y cada tanto cambia de lado; cada persona se para un poco distinto
  const per=10+fr(sd*.61)*8,lado=(Math.floor(t/per+fr(sd*.37))%2?1:-1)*(fr(sd*.83)>.5?1:-1);o.pw=o.pw==null?lado:o.pw+(lado-o.pw)*Math.min(1,dt*1.5);
  const ancho=(.078+.02*fr(sd*2.3))*a175,adel=(.012+.03*fr(sd*1.7))*(fr(sd*3.3)>.5?1:-1),punta=.05+.08*fr(sd*5.1);
  const rollQ=q*o.pw*.075+s2*.035,hsQ=(q*o.pw*.034+s2*.014)*a175;o.roll+=(rollQ-o.roll)*k2;o.hipS+=(hsQ-o.hipS)*k2;
  let hy=A.hipH-.0075*q-.022*mix+br*.002;const pie=[],yFin=.55*A.toe*.8;
  for(const [l,s,off] of [[o.lL,1,0],[o.lR,-1,.5]]){const u=((ph+off)%1+1)%1;let x,y=0,psi=0;
    if(u<.62){const w=u/.62;x=TR*(.46-w);psi=.24*(1-avSm(0,.14,w))-.55*avSm(.72,1,w)**1.5;y=Math.max(0,-psi)*A.toe*.8}      // apoyo: el pie va hacia atrás; al final levanta el talón
    else{const w=(u-.62)/.38,e=avSm(0,1,w);x=TR*(-.54+e);y=yFin*(1-e)+.07*Math.sin(Math.PI*w)**.9;psi=-.55+.79*avSm(.15,1,w)}   // vuelo: el pie pasa despegado del piso
    // caminando los pies caen casi en una línea (unos 8 cm entre uno y otro); quieto, al ancho de la cadera y con la punta algo abierta
    const libre=Math.max(0,-s*o.pw)*q;pie.push([l,s,x*mix+s*adel*q,y*mix+libre*.012,psi*mix-libre*.1,s*(.05*a175*mix+ancho*q),punta*q])}
  // la cadera baja lo justo para que ninguna pierna tenga que estirarse del todo (cada cadera sube o baja con el ladeo de la pelvis)
  const cad=s=>s*o.roll*A.hipW,dl=(s,lat)=>lat-(s*A.hipW+o.hipS);
  for(const [l,s,x,y,psi,lat] of pie){const m=Math.sqrt(Math.max(.01,(L*.9985)**2-x*x-dl(s,lat)**2))+A.footH+y-cad(s);if(m<hy)hy=m}
  o.hipY=o.hipY==null?hy:o.hipY+(hy-o.hipY)*Math.min(1,dt*18);o.hipX+=(0-o.hipX)*k;
  const ab0=Math.atan2(A.lat0-A.hipW,A.hipH-A.footH);
  for(const [l,s,x,y,psi,lat,yw] of pie){const dy=o.hipY+cad(s)-A.footH-y,d=dl(s,lat),[th,kn]=av2(A.Lt,A.Ls,x,Math.hypot(dy,d),1);
    l.th.rotation.z=th;l.kn.rotation.z=Math.min(kn,-.04);l.an.rotation.z=psi-(th+l.kn.rotation.z);l.ab=Math.atan2(d,dy)-s*ab0;l.yw=yw}
  o.chest.rotation.z+=((-.035*mix+br*.008)-o.chest.rotation.z)*k;o.chest.rotation.y=cL*.09;o.chest.rotation.x=-o.roll*.7;o.head.rotation.x=o.roll*.35;
  // gesto en curso (saludar, hablar, pensar, mirar la hora, estirarse): entra y sale suave, y al terminar el cuerpo vuelve a lo que estaba haciendo
  let G=null,ge=0,gt=0;if(o.ges){const g=o.ges;if(g.t0==null)g.t0=c.t||0;gt=(c.t||0)-g.t0;if(gt>=g.dur||!AV_GES[g.id])o.ges=null;else{G=AV_GES[g.id];ge=avSm(0,.32,gt)*(1-avSm(g.dur-.4,g.dur,gt))}}
  const gh=G&&G.cabeza?G.cabeza(gt):null,hy0=mix>.3?-cL*.07:Math.sin(t*.3)*.22+Math.sin(t*.071+sd)*.12,hz0=mix>.3?.02:Math.sin(t*.21)*.04;
  o.head.rotation.y+=((gh?hy0+(gh[0]-hy0)*ge:hy0)-o.head.rotation.y)*k;o.head.rotation.z+=((gh?hz0+(gh[1]-hz0)*ge:hz0)-o.head.rotation.z)*k;
  if(G&&G.pecho)o.chest.rotation.z+=G.pecho*ge*k;
  for(const [a,s] of [[o.aL,1],[o.aR,-1]]){
    if(o.carry){a.sh.rotation.x=0;to(a.sh,.5);to(a.el,1.2);a.in+=(.25-a.in)*k;a.palma+=(.2-a.palma)*k;a.pf=0;continue}
    // brazos: al caminar acompañan el paso; quietos cuelgan sueltos, el del lado del peso apenas más atrás
    const sw=-s*cL;let v=[mix*(sw*.3-.03)+q*(-.015-s*o.pw*.03+br*.006),0,mix*(.44+Math.max(0,sw)*.42)+q*(.3-s*o.pw*.04+.06*fr(sd*(s>0?4.1:6.7))),0,0,0],kk=.5;
    const gv=G&&G.brazo?G.brazo(gt,s):null;if(gv){v=v.map((x,i)=>x+((gv[i]||0)-x)*ge);kk=Math.min(1,dt*12)}
    to(a.sh,v[0],kk);a.sh.rotation.x+=(v[1]-a.sh.rotation.x)*kk;to(a.el,v[2],kk);a.in+=(v[3]-a.in)*k;a.palma+=(v[4]-a.palma)*k;a.pf=(a.pf||0)+(v[5]-(a.pf||0))*k}}
// gestos: brazo(t, lado) devuelve [subir adelante, abrir al costado, doblar el codo, cerrar al centro, palma abajo, palma al frente] (lado +1 izquierdo, −1 derecho; null = ese brazo sigue en lo suyo)
// y cabeza(t) = [girar, bajar]. Para sumar uno alcanza con agregarlo acá.
const AV_GES={
  saludo:{dur:2.4,brazo:(t,s)=>s<0?[1.5,1.05+Math.sin(t*9)*.16,1.55+Math.sin(t*9)*.22,0,0,1]:null,cabeza:t=>[0,-.03]},
  hablar:{dur:2.8,brazo:(t,s)=>[.36+Math.sin(t*3.7+s)*.07,.12,1.2+Math.sin(t*5.1+s*1.4)*.2,.1,.35,0],cabeza:t=>[Math.sin(t*2.1)*.06,.03+Math.sin(t*4.3)*.03]},
  pensar:{dur:3.6,brazo:(t,s)=>s<0?[.5,0,2.22,.62,0,0]:[.3,0,1.5,.75,.6,0],cabeza:t=>[.12,.1]},
  hora:{dur:2.8,brazo:(t,s)=>s>0?[.42,0,1.42,.78,1,0]:null,cabeza:t=>[.32,.36]},
  estirar:{dur:3.2,brazo:(t,s)=>[2.75,.3,.3,0,0,0],cabeza:t=>[0,-.2],pecho:.09}};
function avGesto(o,id,dur){if(!o||!AV_GES[id]||o.ges&&o.ges.id===id)return;o.ges={id,dur:dur||AV_GES[id].dur,t0:null}}
