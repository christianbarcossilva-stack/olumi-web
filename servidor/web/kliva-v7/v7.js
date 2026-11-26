(function(){
  var D=document,H=D.documentElement,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(q,r){return(r||D).querySelector(q)}function $$(q,r){return[].slice.call((r||D).querySelectorAll(q))}
  function noche(){return H.dataset.mode!=='light'}

  // ---- la historia: el motor común con la planta de ejemplo. El scroll lleva la cámara de escena en escena (con pausa en cada una), dibuja en el piso
  //      el camino de Lucía, le abre cada puerta al pasar, mueve el camión y pasa las horas del día fundiendo una en otra ----
  var cine=$('#historia'),f=$('#pla'),chs=$$('.ch',cine),N=chs.length,dia=$('#dia'),fund=$('#fund'),pinsEl=$('#pins'),pins=$$('.pin',cine),tk=$('#tk'),tkb=$('b',tk),tkt=$('#tkt'),tks=$('#tks'),tel=$('#tel'),demo=$('#demo'),top=$('.top');
  var M=null,MQ=null,vis=true,raf=0,tAnt=0,S=0,act=-1,hora='',intro=0,px=0,py=0,k=[0,0,0,0,0],kOn=false,rk=0,rkA=-1,CAM=null,ox=0,oy=0,V3=null;
  // una toma por escena: [centro x, centro z, giro, inclinación, distancia, corrimiento] sobre la escena «kliva-web-v7» (edificio de 30 × 15 m; al sur el patio, el cerco y la calle; al este la playa de carga)
  // el sexto número: cuánto se corre la escena hacia la derecha de la pantalla en la compu (fracción del ancho), para que quede en el hueco entre el texto y el teléfono
  var TOMA=[[1,4,.5,.84,62,.13],[1,2,1.15,.98,56,.08],[-11.6,3.6,.3,.84,33,.08],[-12,1.4,.3,.9,19,.07],[18.5,16.5,.52,.8,36,.06],[17.5,9.5,-.3,.86,36,.1],[1,2,1,.92,60,.08]];
  // el camino de Lucía, en metros de la maqueta. La entrada: de la vereda a su puesto (portería, hall, molinete de entrada, vestuario, pasillo, producción).
  // La salida: del puesto a la calle por el molinete de salida. Van por carriles distintos para que las dos líneas se lean.
  var ENT=[[-24,17.4],[-11.72,17.4,.7],[-11.72,6.6],[-11.9,3.6],[-12.2,2.5],[-12.2,-.5],[-11.7,-1.5],[-11.7,-5.6,.2],[-11.3,-5.6,.2],[-11.3,-1.7],[-9.8,-1],[-6.2,-1],[-5,-2.55],[-3.4,-2.55]],
      SAL=[[-3.4,-2.55],[-4.6,-.4],[-10.4,-.4],[-11.2,.3],[-11.2,2.7],[-11.28,6.6],[-11.28,17.4,.7],[6.4,17.4]],
      CMN=[[37,20.3],[14,20.3,3.2],[14,11.2,3],[19.6,5.4,3],[19.6,-5]];   // el camión: llega por la calle, espera frente al portón, entra y va a la playa de carga
  var RUTA=[0,0,0,0,0,0,1];   // cuánto del camino va dibujado al llegar a cada escena (los del medio se completan al armar el camino)
  var QUIEN='Lucía Fernández';
  function ease(u){var h=.2,v=Math.max(0,Math.min(1,(u-h)/(1-2*h)));return v*v*v*(v*(v*6-15)+10)}
  function tramo(s){var i=Math.max(0,Math.min(N-2,Math.floor(s)));return[i,ease(s-i)]}
  // en pantalla angosta (la maqueta es una ventana chica y no hay corrimiento) algunas tomas cambian: {número de la toma: {qué valor: cuánto}}
  var ANG={0:{0:-1,1:4,4:66},1:{0:1.5,1:2,2:.35,3:.95,4:68},2:{4:36},3:{4:15},4:{0:17,1:13,4:40},5:{4:42},6:{0:1.5,1:2,2:.35,3:.95,4:68}};
  function tomaDe(i){var a=TOMA[i],q=!ancha&&ANG[i],o,j;if(!q)return a;o=a.slice();for(j in q)o[j]=q[j];return o}
  function toma(s){var t=tramo(s),a=tomaDe(t[0]),b=tomaDe(t[0]+1),e=t[1],o=[],j;for(j=0;j<6;j++)o[j]=a[j]+(b[j]-a[j])*e;
    // entre dos escenas de cerca la cámara se levanta, viaja y vuelve a bajar
    var dist=Math.hypot(b[0]-a[0],b[1]-a[1]),arco=Math.sin(Math.PI*e),cerca=Math.max(a[4],b[4])<42;
    if(cerca){o[4]+=arco*Math.min(17,dist*.8);o[3]+=arco*Math.min(.16,dist*.011)}
    return o}
  function ruta(s){var t=tramo(s);return RUTA[t[0]]+(RUTA[t[0]+1]-RUTA[t[0]])*t[1]}
  // camino: esquinas redondeadas y un punto cada «paso» metros, con su largo acumulado
  function redondear(P,rad,paso){var Q=[P[0]],i,j,k2;
    for(i=1;i<P.length-1;i++){var A=Q[Q.length-1],B=P[i],C=P[i+1],ux=A[0]-B[0],uz=A[1]-B[1],lu=Math.hypot(ux,uz),vx=C[0]-B[0],vz=C[1]-B[1],lv=Math.hypot(vx,vz);
      if(lu<1e-6||lv<1e-6)continue;ux/=lu;uz/=lu;vx/=lv;vz/=lv;var r=B[2]!==undefined?B[2]:rad,t=Math.min(r,lu*.5,lv*.5);
      if(ux*vx+uz*vz<-.9995||t<.02){Q.push([B[0],B[1]]);continue}
      var p1=[B[0]+ux*t,B[1]+uz*t],p2=[B[0]+vx*t,B[1]+vz*t],n=Math.max(4,Math.ceil(t/paso*2));
      for(k2=0;k2<=n;k2++){var q=k2/n,a=(1-q)*(1-q),b=2*q*(1-q),c=q*q;Q.push([a*p1[0]+b*B[0]+c*p2[0],a*p1[1]+b*B[1]+c*p2[1]])}}
    Q.push(P[P.length-1].slice(0,2));var out=[[Q[0][0],Q[0][1],0]],tot=0,resto=paso;
    for(j=1;j<Q.length;j++){var x0=Q[j-1][0],z0=Q[j-1][1],dx=Q[j][0]-x0,dz=Q[j][1]-z0,L=Math.hypot(dx,dz),d=0;while(L-d>=resto){d+=resto;out.push([x0+dx*d/L,z0+dz*d/L,tot+d]);resto=paso}resto-=L-d;tot+=L}
    var u=Q[Q.length-1],ult=out[out.length-1];if(Math.hypot(u[0]-ult[0],u[1]-ult[1])>1e-3)out.push([u[0],u[1],tot]);return out}
  var ALTO=.1;   // el camino va sobre el piso de las salas, el patio y la vereda
  // las puertas que Lucía cruza: [dónde del camino, qué puerta, si tiene hoja que abre, qué muestra la chapita]
  var PASOS=[],EST=[];
  function armarCamino(){var T=M.THREE,a=redondear(ENT,.45,.2),b=redondear(SAL,.45,.2),La=a[a.length-1][2],na=a.length,R=a.concat(b.slice(1).map(function(p){return[p[0],p[1],p[2]+La]})),n=R.length,L=R[n-1][2],i;
    var idx=[],cero=[];for(i=0;i<n*6;i++)cero.push(0);for(i=0;i<n-1;i++){var v=i*2;idx.push(v,v+2,v+1,v+1,v+2,v+3)}
    var g=new T.BufferGeometry(),at=new T.Float32BufferAttribute(cero,3),pos=at.array;g.setAttribute('position',at);g.setIndex(idx);g.setDrawRange(0,0);   // los números los arma el motor en su ventana (un arreglo de esta ventana no le sirve)
    // los pisos y sus líneas pintadas del motor llevan corrimiento de profundidad para no titilar entre sí: la línea de Lucía lleva uno mayor, así queda siempre encima del piso
    var mat=new T.MeshBasicMaterial({color:0x9D7CFF,toneMapped:false,side:T.DoubleSide,transparent:true,opacity:.96,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-20,polygonOffsetUnits:-18});
    var m=new T.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=4;M.scene.add(m);
    var disco=new T.CircleGeometry(1,30);disco.rotateX(-Math.PI/2);var ini=new T.Mesh(disco,mat),fin=new T.Mesh(disco,mat);ini.renderOrder=fin.renderOrder=4;ini.visible=fin.visible=false;M.scene.add(ini);M.scene.add(fin);
    // el primer punto del camino, desde «desde», que cumple la condición: la fracción del camino donde pasa
    function cruce(desde,si){for(var q=desde;q<n;q++)if(si(R[q]))return q;return n-1}
    var iP1=cruce(0,function(p){return p[1]<16}),iM1=cruce(iP1,function(p){return p[1]<1}),iV1=cruce(iM1,function(p){return p[1]<-3}),iV2=cruce(iV1+1,function(p){return p[1]>-3}),
        iM2=cruce(na,function(p){return p[1]>1}),iP2=cruce(iM2,function(p){return p[1]>16}),fr=function(q){return R[q][2]/L},pu=La/L,antes=.9/L;
    CAM={R:R,n:n,L:L,g:g,pos:pos,ini:ini,fin:fin,w:0,pu:pu,ves:fr(cruce(iV1,function(p){return p[1]<-5.2}))};
    RUTA[2]=CAM.ves;RUTA[3]=RUTA[4]=RUTA[5]=pu;
    PASOS=[[fr(iP1)-antes,'acc_port',1],[fr(iM1)-antes*.4,'acc_min',0],[fr(iV1)-antes,'acc_ves',1],[fr(iV2)-antes,'acc_ves',1],[fr(iM2)-antes*.4,'acc_mout',0],[fr(iP2)-antes,'acc_port',1]];
    // lo que dice la chapita mientras camina: [desde dónde del camino, renglón de abajo, tono]
    EST=[[0,'Llega a la planta',''],[fr(iP1),'Portería peatonal · tarjeta · 7:50','ok'],[fr(iM1),'Molinete de entrada · rostro · 7:51','ok'],[fr(iV1),'Vestuarios · rostro · 7:52','ok'],[fr(iV2)+1.2/L,'Va a su puesto',''],[pu-.6/L,'En Producción',''],
      [pu+.8/L,'Termina su último día',''],[fr(iM2),'Molinete de salida · rostro · 18:02','ok'],[fr(iP2),'Portería peatonal · tarjeta · 18:03','ok']];
    V3=new T.Vector3()}
  function ancho(w){var R=CAM.R,n=CAM.n,p=CAM.pos,i;CAM.w=w;
    for(i=0;i<n;i++){var a=R[Math.max(0,i-1)],b=R[Math.min(n-1,i+1)],tx=b[0]-a[0],tz=b[1]-a[1],l=Math.hypot(tx,tz)||1,nx=-tz/l*w*.5,nz=tx/l*w*.5,o=i*6;
      p[o]=R[i][0]+nx;p[o+1]=ALTO;p[o+2]=R[i][1]+nz;p[o+3]=R[i][0]-nx;p[o+4]=ALTO;p[o+5]=R[i][1]-nz}
    CAM.g.attributes.position.needsUpdate=true}
  function enRuta(fr){var R=CAM.R,s=Math.max(0,Math.min(1,fr))*CAM.L,a=0,b=CAM.n-1;while(b-a>1){var m=(a+b)>>1;if(R[m][2]<=s)a=m;else b=m}
    var A=R[a],B=R[b],q=(s-A[2])/Math.max(1e-6,B[2]-A[2]);return{x:A[0]+(B[0]-A[0])*q,z:A[1]+(B[1]-A[1])*q,i:a+q}}
  var cab={x:0,z:0,ver:false};
  function camino(r,d){if(!CAM)return;var w=Math.max(.1,Math.min(.5,d*.0072));if(Math.abs(w-CAM.w)>CAM.w*.04)ancho(w);
    var e=enRuta(r),n=Math.floor(e.i),ver=r>.0015&&r<.9985;CAM.g.setDrawRange(0,Math.max(0,n)*6);
    CAM.ini.visible=r>.0015;CAM.fin.visible=ver;CAM.ini.scale.setScalar(CAM.w*.95);CAM.ini.position.set(CAM.R[0][0],ALTO+.004,CAM.R[0][1]);
    CAM.fin.scale.setScalar(CAM.w*1.5);CAM.fin.position.set(e.x,ALTO+.006,e.z);cab.x=e.x;cab.z=e.z;cab.ver=ver}

  // ---- las puertas: cada una tiene el estado que le toca por la escena, y se abre un rato cuando Lucía la cruza ----
  var PU=['acc_port','acc_min','acc_mout','acc_ves','acc_adm','acc_dep','acc_gate','acc_carga'],puEs={},abierta={},fase=0,caida=false,tmr=[];
  function vivo(m){try{MQ&&MQ.vivo&&MQ.vivo(m)}catch(e){}}
  function debe(p){if(abierta[p]>performance.now())return'abierta';
    if(p==='acc_gate')return act===5&&caida?'caida':act===4&&fase>=2?'abierta':'cerrada';
    if(p==='acc_carga')return act===5&&caida?'caida':'cerrada';
    return'cerrada'}
  function puertas(){var i,p,e;for(i=0;i<PU.length;i++){p=PU[i];e=debe(p);if(puEs[p]!==e){puEs[p]=e;vivo({puerta:p,estado:e})}}}
  function pasa(q){var p=q[1];vivo({puerta:p,ev:'pasa',quien:QUIEN});if(q[2]){abierta[p]=performance.now()+2100;setTimeout(function(){puertas();mover()},2160)}puertas()}
  function cruces(){if(rkA<0){rkA=rk;return}if(rk===rkA)return;var a=Math.min(rk,rkA),b=Math.max(rk,rkA),i;
    if(b-a<.5)for(i=0;i<PASOS.length;i++)if(PASOS[i][0]>a&&PASOS[i][0]<=b)pasa(PASOS[i]);   // un salto grande (el riel, una recarga a mitad de página) no abre todas las puertas juntas
    rkA=rk}
  function luego(ms,fn){var c=act;tmr.push(setTimeout(function(){if(act===c){fn();mover()}},ms))}
  function limpiar(){tmr.forEach(clearTimeout);tmr=[]}

  // ---- el camión del capítulo del portón: llega por la calle, espera a que le abran y entra a la playa de carga ----
  var CM=null;
  function armarCamion(){var T=M.THREE,g=new T.Group(),R=redondear(CMN,3,.3),n=R.length,L=R[n-1][2];
    function caja(w,h,d,x,y,z,col,o){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial(Object.assign({color:col,roughness:.62,metalness:.08},o||{})));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m}
    caja(5.3,2.5,2.42,-1.05,2.2,0,'#e9ebee');caja(5.3,.14,2.44,-1.05,1.16,0,'#9D7CFF',{roughness:.4});   // la caja, con un filete violeta
    caja(1.85,1.95,2.3,2.75,1.6,0,'#2a2c31',{roughness:.45,metalness:.3});caja(.08,.8,2,3.69,2,0,'#b9cbd8',{roughness:.08,metalness:.4});   // la cabina y el parabrisas
    caja(7.3,.26,1.9,0,.74,0,'#17181c');
    var rg=new T.CylinderGeometry(.48,.48,.32,18);rg.rotateX(Math.PI/2);var rm=new T.MeshStandardMaterial({color:'#101114',roughness:.9});
    [[2.7,1.08],[2.7,-1.08],[-1.9,1.08],[-1.9,-1.08],[-3,1.08],[-3,-1.08]].forEach(function(q){var m=new T.Mesh(rg,rm);m.position.set(q[0],.48,q[1]);m.castShadow=true;g.add(m)});
    g.visible=false;M.scene.add(g);
    function marca(x,z){var mj=0,md=1e9;for(var q=0;q<n;q++){var d=Math.hypot(R[q][0]-x,R[q][1]-z);if(d<md){md=d;mj=q}}return R[mj][2]}
    CM={g:g,R:R,n:n,L:L,u:0,espera:marca(22.4,20.3)}}
  function camionEn(u){var R=CM.R,a=0,b=CM.n-1;while(b-a>1){var m=(a+b)>>1;if(R[m][2]<=u)a=m;else b=m}
    var A=R[a],B=R[b],q=(u-A[2])/Math.max(1e-6,B[2]-A[2]),c=R[Math.min(CM.n-1,a+6)],p=R[Math.max(0,a-6)],g=CM.g;
    g.position.set(A[0]+(B[0]-A[0])*q,0,A[1]+(B[1]-A[1])*q);g.rotation.y=Math.atan2(-(c[1]-p[1]),c[0]-p[0]);g.visible=u>.5;g.updateMatrixWorld(true)}
  function camionMeta(){return act===4?(fase>=3?CM.L:CM.espera):act===5?CM.L:0}
  var cmT=0;
  function ponCamion(){if(!CM)return false;var meta=camionMeta(),u=CM.u,ya=performance.now(),dt=Math.min(.25,Math.max(.001,(ya-cmT)/1000));cmT=ya;if(u===meta)return false;   // con el reloj de verdad: en un equipo lento el camión no anda en cámara lenta
    if(meta<u||reduce||!vis||act!==4)u=meta;   // solo maneja en su escena (y nunca para atrás): en las demás aparece donde le toca
    else{var falta=meta-u,v=Math.min(9,Math.max(1.2,falta*1.7));u=Math.min(meta,u+v*dt)}
    CM.u=u;camionEn(u);
    if(act===4&&fase===0&&u>=CM.espera-.02){fase=1;luego(600,function(){fase=2;puertas();chip();luego(1300,function(){fase=3})})}
    return true}

  // ---- lo que va encima de la maqueta (las chapitas de los equipos y la de lo que pasa) sigue a la cámara: se ubica después de cada dibujo ----
  var pinV=false,tkV=false,tkAba=false,tkCl='',tkAn=null,tkW=180,ancha=false,asp=1.6,bw=0,TXT=chs.map(function(c){return $('.txt',c)}),txtR=null,telR=null;
  var GATE={x:14,y:2.5,z:16},MOL={x:-12.35,y:1.25,z:1};
  // qué dice y dónde va la chapita: siguiendo a Lucía mientras camina, o en la puerta donde pasa algo
  function chipDe(){var i,e,s;
    if(!CAM||act<2)return null;
    if(act===2||act===6){if(act===6&&rk>=.985)return null;if(!cab.ver)return null;e=EST[0];for(i=0;i<EST.length;i++)if(rk>=EST[i][0])e=EST[i];return{k:'yo'+e[0],a:null,t:QUIEN,s:e[1],c:e[2]}}
    if(act===3)return{k:'rech',a:MOL,t:'Tarjeta no registrada',s:'Molinete de entrada · 9:15',c:'no'};
    if(act===4)return fase>=2?{k:'abre2',a:GATE,t:'Portón 2 · abierto',s:'Christian, desde el celular · 11:03',c:'ok'}:{k:'abre1',a:GATE,t:'Portón 2 · cerrado',s:'Un camión espera afuera',c:''};
    if(act===5)return caida?{k:'cae1',a:GATE,t:'Controladora de portones',s:'No responde desde las 14:20',c:'off'}:{k:'cae2',a:GATE,t:'Controladora de portones',s:'Volvió y se reconectó sola',c:'ok'};
    return null}
  function chip(){var c=chipDe(),cl=c?c.k:'';if(cl===tkCl)return;var antes=tkCl;tkCl=cl;
    if(!c){tkV=false;tk.classList.remove('v');return}
    var pon=function(){if(tkCl!==cl)return;tkt.textContent=c.t;tks.textContent=c.s;if(c.c)tk.dataset.t=c.c;else delete tk.dataset.t;tkAn=c.a;tkV=true;tk.classList.add('v');medirTk();
      if(antes&&!reduce){tk.classList.remove('pum');void tk.offsetWidth;tk.classList.add('pum')}mover()};
    // de una puerta a otra la chapita se apaga, salta y vuelve: no cruza la pantalla volando
    if(antes&&tkV&&(antes.slice(0,2)!==cl.slice(0,2))&&!reduce){tk.classList.remove('v');setTimeout(pon,240)}else pon()}
  function sobre(){if(!M||!V3||(!pinV&&!tkV))return;var i,s;
    if(pinV)for(i=0;i<pins.length;i++){var p=pins[i];V3.set(+p.dataset.x,+p.dataset.y,+p.dataset.z);s=M.aPantalla(V3);p.style.transform='translate('+(ox+s.x).toFixed(1)+'px,'+(oy+s.y).toFixed(1)+'px)'}
    if(tkV){if(tkAn)V3.set(tkAn.x,tkAn.y,tkAn.z);else V3.set(cab.x,ALTO,cab.z);s=M.aPantalla(V3);var X=ox+s.x,Y=oy+s.y,lo=10,hi=bw-10,j,q,edge=0;
      if(telR&&X<telR[0]-24&&Y-64<telR[2]&&Y-8>telR[1])hi=Math.min(hi,telR[0]-14);   // no se mete debajo del teléfono
      if(txtR)for(j=0;j<txtR.length;j++){q=txtR[j];if(Y-66<q[2]&&Y-6>q[1]&&q[0]>edge)edge=q[0]}
      if(edge&&X>edge-90)lo=edge+12;   // al borde de un renglón del texto de la escena: la chapita va del lado libre
      var aba=Y-70<(ancha?84:dia.classList.contains('v')?64:14);if(aba!==tkAba){tkAba=aba;tk.classList.toggle('aba',aba)}
      var izq=Math.max(10,Math.min(hi-tkW,Math.max(lo,X-tkW/2)));
      tk.style.transform='translate('+X.toFixed(1)+'px,'+Y.toFixed(1)+'px)';tkb.style.transform='translateX('+(izq-X).toFixed(1)+'px)'}}
  function medir(){ox=f.offsetLeft;oy=f.offsetTop;ancha=innerWidth>860;asp=f.clientWidth/Math.max(1,f.clientHeight);bw=f.clientWidth;medirTk();
    winB=BG.getBoundingClientRect().top+BG.offsetHeight;if(!ancha)winB=64+BG.offsetHeight;ZONA=Math.min(.84,winB/Math.max(1,innerHeight)+.13);telefono()}   // en pantalla angosta: dónde termina la ventana de la maqueta y a qué altura se lee el título de cada escena
  function medirTk(){tkW=tkb.offsetWidth||180}
  // cambiar de hora fundiendo: una foto de lo que se ve queda encima y se desvanece sobre la hora nueva
  function ponHora(h){if(!M||!h||h===hora)return;var antes=hora;hora=h;
    if(antes&&!reduce&&cine.classList.contains('ready')&&vis){try{var cv=M.canvas;if(M.post)M.post.dibujar(M.scene,M.cam);else M.renderer.render(M.scene,M.cam);
      if(fund.width!==cv.width||fund.height!==cv.height){fund.width=cv.width;fund.height=cv.height}fund.getContext('2d').drawImage(cv,0,0);
      fund.style.transition='none';fund.style.opacity='1';void fund.offsetWidth;requestAnimationFrame(function(){requestAnimationFrame(function(){fund.style.transition='opacity 1.1s cubic-bezier(.22,1,.36,1)';fund.style.opacity='0'})})}catch(e){fund.style.opacity='0'}}
    try{M.ponerHora(h)}catch(e){}puEs={};puertas();M.dirty=true}   // al cambiar la hora el motor repinta las puertas: se les vuelve a decir cómo están
  function horaDe(i){var c=chs[i];return(!noche()&&c.dataset.horaDia)||c.dataset.hora||''}
  // al llegar a cada escena: su hora, sus chapitas, sus puertas y lo que pasa en ella
  var rech=0;
  function alCapitulo(i){limpiar();ponHora(horaDe(i));clearInterval(rech);rech=0;
    pinV=(i===1||i===6)&&!!M;pinsEl.classList.toggle('fuera',i===6);pins.forEach(function(p){p.classList.toggle('v',pinV&&(i===1||rk>=.985))});
    fase=0;caida=false;
    if(i===3){var no=function(){if(act===3&&vis&&!D.hidden)vivo({puerta:'acc_min',ev:'rechazo'})};luego(reduce?0:750,no);rech=setInterval(no,5200)}
    if(i===4&&CM&&(reduce||CM.u>=CM.L-.5)){fase=3}
    if(i===5){caida=true;luego(5200,function(){caida=false;puertas();chip()})}
    puertas();chip();decir(chs[i].dataset.ev);tel.classList.toggle('v',i>=1);
    if(M){M.dirty=true}}
  // el riel de la semana
  var diaB=$$('button',dia),diaF=$('#diaF'),diaP=$('#diaP'),diaL=$('.l',dia);
  function riel(){var p=Math.max(0,Math.min(1,(S-1)/5)),v=S>.55&&S<N-1+.35&&enCine;dia.classList.toggle('v',v);if(!v)return;
    diaF.style.transform='scaleX('+p.toFixed(4)+')';diaP.style.transform='translateX('+(p*diaL.offsetWidth).toFixed(1)+'px)';
    diaB.forEach(function(b){var q=+b.dataset.ir;b.classList.toggle('hecho',S>=q-.02);b.classList.toggle('on',Math.abs(S-q)<.3);if(Math.abs(S-q)<.3)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')})}
  dia.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;scrollTo({top:yDe(+b.dataset.ir),behavior:reduce?'auto':'smooth'})});
  $('.baja',cine).addEventListener('click',function(e){e.preventDefault();scrollTo({top:yDe(1),behavior:reduce?'auto':'smooth'})});   // «Una semana con Kliva» lleva a la primera escena ya en su lugar
  // cuadro a cuadro: la cámara y el camino siguen al scroll con suavidad; quieta la cámara, el motor deja de dibujar (no gasta batería)
  var EPS=[.004,.004,.0006,.0006,.012];
  function paso(now){raf=0;if(!M||!vis)return;var dt=Math.min(.2,Math.max(.001,(now-tAnt)/1000));tAnt=now;   // en un equipo lento el tiempo sigue siendo el del reloj (no en cámara lenta)
    var c=toma(S),a=reduce?1:1-Math.exp(-dt/.17),quieto=true,j;
    if(intro>0){intro=Math.max(0,intro-dt/2.8);var q=intro*intro*(3-2*intro);c[4]*=1+.55*q;c[3]=Math.min(1.42,c[3]+.34*q);c[2]-=.6*q;quieto=false}
    c[2]+=px*.05;c[3]=Math.max(.2,Math.min(1.44,c[3]-py*.028));
    correr(c);
    if(!kOn){k=c.slice();rk=ruta(S);rkA=-1;kOn=true}
    for(j=0;j<5;j++){k[j]+=(c[j]-k[j])*a;if(Math.abs(c[j]-k[j])>EPS[j])quieto=false}
    var rt=ruta(S);rk+=(rt-rk)*a;if(Math.abs(rt-rk)>.0003)quieto=false;else rk=rt;
    try{cruces();camino(rk,k[4]);chip();if(act===6)pins.forEach(function(p){p.classList.toggle('v',pinV&&rk>=.985)})}catch(e){}
    var C=M.C;C.tx=k[0];C.tz=k[1];C.yaw=k[2];C.pitch=k[3];C.d=k[4];M.dirty=true;
    if(!quieto||(CM&&CM.u!==camionMeta()))raf=requestAnimationFrame(paso)}
  function correr(c){if(ancha){var sh=-(c[5]+Math.max(0,Math.min(.3,(1280-bw)/1280))*.2)*2*c[4]*.3443*asp;c[0]+=Math.cos(c[2])*sh;c[1]-=Math.sin(c[2])*sh}else{var cerca=c[4]<34;if(asp<1.3&&cerca)c[4]*=.86;   // en el teléfono, de cerca, un poco más cerca (la ventana de la maqueta es chica)
      var sv=(cerca?.16:.13)*2*.3443*c[4]/Math.sin(c[3]);c[0]-=Math.sin(c[2])*sv;c[1]-=Math.cos(c[2])*sv}   // y la escena baja: arriba la tapa el riel
    return c}   // en la compu, la escena va al hueco libre de la pantalla
  // dónde termina cada renglón de un bloque de texto: [derecha, arriba, abajo] (los títulos son cajas del ancho de la columna; sus renglones, no)
  function renglones(el){var o=[],kk=el.children,i,j,c,q,rg;for(i=0;i<kk.length;i++){c=kk[i];
      if(c.classList.contains('cta'))q=[].map.call(c.children,function(x){return x.getBoundingClientRect()});
      else{rg=D.createRange();rg.selectNodeContents(c);q=rg.getClientRects()}
      for(j=0;j<q.length;j++)if(q[j].width>1)o.push([q[j].right,q[j].top,q[j].bottom])}return o}
  function mover(){if(M&&vis&&!raf){tAnt=performance.now()-16;raf=requestAnimationFrame(paso)}}
  // dónde manda el scroll: en la compu, el centro de cada escena al centro de la pantalla; en el teléfono (la maqueta es una ventana arriba y la historia pasa
  // por debajo), el título de cada escena en la zona de lectura
  var TIT=chs.map(function(c){return $('h1,h2',c)}),BG=$('.bg',cine),ZONA=.62,winB=0,enCine=true;
  function anclas(){var z=innerHeight*(ancha?.5:ZONA),Y=[],i,r;for(i=0;i<N;i++){r=(ancha?chs[i]:TIT[i]).getBoundingClientRect();Y[i]=scrollY+r.top+r.height/2-z}Y[0]=Math.max(0,Math.min(Y[0],Y[1]-innerHeight*.5));return Y}
  function yDe(i){return anclas()[i]}
  function upd(){var vh=innerHeight,Y=anclas(),y=scrollY,on=-1,i;
    if(y<=Y[0])S=0;else if(y>=Y[N-1])S=N-1;else for(i=0;i<N-1;i++)if(y>=Y[i]&&y<Y[i+1]){S=i+(y-Y[i])/Math.max(1,Y[i+1]-Y[i]);break}
    for(i=0;i<N;i++){var q=(ancha?chs[i]:TXT[i]).getBoundingClientRect(),v=ancha?q.top<vh*.62&&q.bottom>vh*.38:q.top<vh*.88&&q.bottom>winB;chs[i].classList.toggle('on',v);if(v)on=i}
    if(!ancha)on=Math.round(S);
    txtR=ancha&&on>=0?renglones(TXT[on]):null;   // dónde termina cada renglón del texto de la escena que se lee: la chapita no lo pisa
    if(on>=0&&on!==act){act=on;alCapitulo(on)}
    var r=cine.getBoundingClientRect();enCine=r.bottom>vh*.55;
    top.classList.toggle('sc',scrollY>20);cine.classList.toggle('bajo',S>.05);riel();mover()}

  // ---- la app real en el teléfono del costado: la misma beta de Kliva, que muestra cada escena cuando la página se la pide ----
  var demoOk=false,demoEv='inicio';
  function decir(ev){if(ev)demoEv=ev;if(demoOk)try{demo.contentWindow.postMessage({kliva:'cine',ev:demoEv,tema:H.dataset.mode},location.origin)}catch(e){}}
  function telefono(){var cabe=innerWidth>=1100;if(!cabe){telR=null;return}
    var alto=Math.min(604,innerHeight-252),w=Math.round(alto*390/800)+18;tel.style.width=w+'px';tel.style.height=(Math.round((w-18)*800/390)+18)+'px';var esc=(w-18)/390;demo.style.transform='scale('+esc.toFixed(4)+')';
    var r=tel.getBoundingClientRect(),b=BG.getBoundingClientRect();telR=[r.left-b.left,r.top-b.top,r.bottom-b.top];
    if(!demo.getAttribute('src')&&(M||telefono.ya)){demo.src='/kliva/beta/?cine=1'}}
  demo.addEventListener('load',function(){setTimeout(function(){demoOk=true;tel.classList.add('lista');decir()},900)});
  setTimeout(function(){telefono.ya=true;telefono()},4200);   // si la maqueta tarda, la app no la espera más

  var ESC='kliva-web-v7';
  var src='/motor/beta/index.html?app=kliva&escena='+ESC+'&nuevo=1&ver=1&embebida=1&tema='+(noche()?'oscuro':'claro')+(/[?&]post=0/.test(location.search)?'&post=0':'');
  var lento=matchMedia('(max-width:700px)').matches&&(navigator.deviceMemory||4)<4;
  function abrir(){if(f.getAttribute('src'))return;f.src=src;setTimeout(function(){if(!M)cine.classList.add('sin3d')},14000)}   // si a los 14 s no hay maqueta, queda la foto (si llega después, entra igual)
  if(lento)cine.classList.add('sin3d');   // sin maqueta (teléfono con poca memoria, o no cargó): en su lugar va una foto de la planta
  // la escena se revalida antes de abrir la maqueta: el motor la pide sin versión y el navegador podía quedarse horas con la de antes
  if(!lento){setTimeout(abrir,1200);try{fetch('/motor/escenas/'+ESC+'.json',{cache:'no-cache'}).then(abrir,abrir)}catch(e){abrir()}}
  f.addEventListener('load',function(){var n=0,t=setInterval(function(){var mq=null;try{mq=f.contentWindow.__maqueta}catch(e){}if(mq&&mq.motor){clearInterval(t);listo(mq)}else if(++n>240)clearInterval(t)},250)});
  function listo(mq){MQ=mq;M=mq.motor;try{var d=f.contentDocument,s=d.createElement('style');s.textContent='body>*:not(#m3d){display:none!important}html,body{cursor:default!important;background:transparent!important}';d.head.appendChild(s)}catch(e){}
    try{mq.XT&&mq.XT.presentar&&mq.XT.presentar(false)}catch(e){}
    try{mq.paredes('corte',false)}catch(e){}   // las paredes, cortadas a media altura: la planta se ve por dentro, como una maqueta de arquitecto
    try{armarCamino()}catch(e){CAM=null}
    try{armarCamion();M.cada.push(function(dt){try{return ponCamion(dt)}catch(e){return false}})}catch(e){CM=null}
    try{M.despues.push(function(){try{sobre()}catch(e){}})}catch(e){}
    // fuera de la pantalla la maqueta no dibuja: gastaba placa y batería mientras se lee el resto de la página
    try{M.cada.forEach(function(g,i){M.cada[i]=function(dt,t){return vis?g(dt,t):false}})}catch(e){}
    medir();kOn=false;rk=ruta(S);var c0=correr(toma(S));try{camino(rk,c0[4])}catch(e){}
    try{M.ir({tx:c0[0],tz:c0[1],yaw:c0[2],pitch:c0[3],d:c0[4]},.001)}catch(e){}   // el motor arranca con su propio vuelo de presentación: acá se corta (si no, pelea con la cámara de la historia)
    // antes de mostrarla, la planta pasa una vez por cada hora (sin esto, la primera vez que llega la noche la placa arma sus luces y se ve un cuadro gris)
    var hs=['azul','dia','manana','noche'],i=0;(function sig(){if(i<hs.length){try{M.ponerHora(hs[i++]);M.dirty=true}catch(e){}setTimeout(sig,260);return}
      hora='';var h0=horaDe(act<0?0:act);try{M.ponerHora(h0)}catch(e){}hora=h0;puEs={};M.dirty=true;
      mover();setTimeout(function(){if(!reduce&&S<.5){intro=1;kOn=false}cine.classList.add('ready');alCapitulo(act<0?0:act);mover();telefono();
        setTimeout(function(){cine.classList.remove('sin3d')},1800)},300)})()}   // si había quedado la foto, se va cuando la maqueta ya terminó de aparecer encima
  addEventListener('scroll',upd,{passive:true});addEventListener('resize',function(){medir();upd()});
  if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduce)addEventListener('pointermove',function(e){if(!vis||!M)return;px=e.clientX/innerWidth*2-1;py=e.clientY/innerHeight*2-1;mover()},{passive:true});
  if('IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting;if(vis)mover()}).observe(cine);
  D.addEventListener('visibilitychange',function(){if(!D.hidden)mover()});

  // ---- día o noche (uno solo para toda la página, queda guardado): cambia la página, la hora de la maqueta y el tema de la app del teléfono ----
  $('#modo').addEventListener('click',function(){H.dataset.mode=noche()?'light':'dark';try{localStorage.setItem('kliva.web',H.dataset.mode)}catch(e){}
    $('meta[name="theme-color"]').content=noche()?'#030304':'#E3E6EA';decir();if(M)ponHora(horaDe(act<0?0:act));mover()});

  // ---- la tarjeta de la portada late con la planta: cada tanto, una pasada más ----
  var miniN=$('#miniN'),miniV=$('#miniV'),mini=$('#mini'),VIVO=['Ana Núñez · Molinete de entrada','Bruno Castro · Vestuarios','Portón 2 · abierto desde el celular','Ana Núñez · Depósito de repuestos'],nv=212,iv=0;
  if(miniN&&!reduce)setInterval(function(){if(!vis||S>.4||nv>=219||D.hidden)return;var t=VIVO[iv++%VIVO.length];miniV.textContent=t;miniV.classList.add('v');
    nv++;miniN.textContent=nv;mini.classList.remove('pum');void mini.offsetWidth;mini.classList.add('pum');
    setTimeout(function(){miniV.classList.remove('v')},3600)},5200);

  // ---- el resto aterriza: lo que entra a la pantalla aparece de a uno, en orden de lectura ----
  var A=$$('[data-a]');A.forEach(function(el){[].forEach.call(el.children,function(c,i){c.style.setProperty('--i',Math.min(i,7))})});
  if('IntersectionObserver' in window&&!reduce){var ia=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('vio');ia.unobserve(e.target)}})},{rootMargin:'0px 0px -10% 0px',threshold:.06});A.forEach(function(el){ia.observe(el)})}else A.forEach(function(el){el.classList.add('vio')});

  window.__klivaHist={T:TOMA,ANG:ANG,mover:function(){kOn=false;mover()},get anda(){return!!raf||intro>0},get S(){return S},get r(){return rk},get act(){return act},y:function(i){return yDe(i)},get camion(){return CM?[+CM.u.toFixed(1),+CM.L.toFixed(1),fase]:null},get puertas(){return puEs},get chip(){return tkCl},
    get est(){return[raf?1:0,+intro.toFixed(3),vis?1:0,kOn?1:0,k.map(function(v){return+v.toFixed(3)}),toma(S).map(function(v){return+v.toFixed(3)})]}};   // para las pruebas
  void D.body.offsetWidth;cine.classList.add('entra');medir();upd();
})();
