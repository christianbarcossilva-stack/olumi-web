(function(){
  var D=document,H=D.documentElement,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(q,r){return(r||D).querySelector(q)}function $$(q,r){return[].slice.call((r||D).querySelectorAll(q))}
  // ---- día o noche (uno solo para toda la página, queda guardado) ----
  var mb=$('#modo');function modo(n){H.classList.toggle('n',n);mb.setAttribute('aria-label',n?'Cambiar a modo día':'Cambiar a modo noche');try{localStorage.setItem('olumi.web.tema',n?'noche':'dia')}catch(e){}capturas(n);if(act===0)alCapitulo(0)}
  function capturas(n){$$('img[data-claro]').forEach(function(i){if(!i.dataset.noche)i.dataset.noche=i.getAttribute('src');var u=n?i.dataset.noche:i.dataset.claro;if(i.getAttribute('src')!==u)i.setAttribute('src',u)})}
  if(!H.classList.contains('n')){capturas(false);mb.setAttribute('aria-label','Cambiar a modo noche')}
  mb.addEventListener('click',function(){modo(!H.classList.contains('n'))});
  // ---- barra: la pastilla que sigue la sección ----
  var top=$('#top'),tabs=$$('.tabs a'),pill=$('.tabs .pill');
  function pon(a){tabs.forEach(function(x){x.classList.toggle('on',x===a)});if(!a){pill.style.width='0';return}pill.style.left=a.offsetLeft+'px';pill.style.width=a.offsetWidth+'px'}
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var a=tabs.filter(function(x){return x.getAttribute('href')==='#'+e.target.id})[0];if(a)pon(a)}})},{rootMargin:'-45% 0px -50% 0px'});
    tabs.forEach(function(a){var s=$(a.getAttribute('href'));if(s)io.observe(s)})}
  addEventListener('load',function(){pon($('.tabs a.on'))});

  // ---- la historia: el motor común con la oficina de ejemplo. El scroll lleva la cámara de escena en escena (con pausa en cada una), dibuja el camino
  //      del pedido en el piso de la maqueta, saca la camioneta y pasa las horas del día fundiendo una en otra ----
  var cine=$('#cine'),f=$('#ofi'),chs=$$('.ch',cine),N=chs.length,dia=$('#dia'),fund=$('#fund'),pins=$$('.pin',cine),tk3=$('#tk3'),tk3t=$('#tk3t');
  var M=null,MQ=null,vis=true,raf=0,tAnt=0,S=0,act=-1,hora='',intro=0,px=0,py=0,k=[0,0,0,0,0],kOn=false,rk=0,CAM=null,ox=0,oy=0,V3=null;
  // una toma por escena: [centro x, centro z, giro, inclinación, distancia] sobre la escena «olumi-web-v7» (oficina de 26 × 18 m; al sur el estacionamiento y la calle; al oeste, el galpón del cliente)
  // el sexto número: cuánto se corre la escena hacia la derecha de la pantalla en la compu (fracción del ancho), para que quede en el hueco entre el texto y el teléfono
  var TOMA=[[13,13,.22,.95,66,.2],[13,11.5,.62,.84,46,.2],[3.6,13.6,.95,.72,15,.1],[15.4,12.6,.34,.68,15.5,.1],[9.4,21.9,-.52,.5,16.5,.1],[-15.5,31,1.22,.44,29,.14],[3,23,.5,.93,104,.22],[6,21,1.12,1.02,90,.2]];
  // el camino del pedido, en metros de la maqueta: nace en la recepción, pasillo, el escritorio del técnico, el depósito, sale por el portón, la camioneta y la calle hasta lo del cliente
  var PIE=[[3.4,12.7],[2,12.2],[1.7,10.6],[1.7,9.25],[12.45,9.25],[12.45,10.2],[12.1,11],[12.1,13.25],[16.2,13.25],[18.9,13.1],[18.9,10.75],[21.2,10.75],[21.2,13.6],[22.5,15.2],[22.5,19.05],[8.7,19.05],[8.7,21.6]],
      VAN=[[8.7,21.6],[8.7,25.85,2.3],[.2,25.85,2.5],[.2,33.3,2.4],[-19.5,33.3]],FIO='veh_v1qk61',DIE='w26',SEN='per_p9kwpc';   // sale por la entrada de vehículos y toma la calle por su mano
  var RUTA=[0,0,.004,0,0,1,1,1];   // cuánto del camino va dibujado al llegar a cada escena (los del medio se completan al armar el camino)
  function ease(u){var h=.2,v=Math.max(0,Math.min(1,(u-h)/(1-2*h)));return v*v*v*(v*(v*6-15)+10)}
  function tramo(s){var i=Math.max(0,Math.min(N-2,Math.floor(s)));return[i,ease(s-i)]}
  // en pantalla angosta (la maqueta es una ventana chica y no hay corrimiento) algunas tomas cambian: {número de la toma: {qué valor: cuánto}}
  var ANG={0:{4:56},1:{4:41},4:{0:8.3,1:22.5},5:{0:-18.4,1:32.6},6:{4:98}};   // la portada y las vistas enteras, más cerca; la camioneta con el técnico al lado; la del cliente, centrada en la camioneta
  function tomaDe(i){var a=TOMA[i],q=!ancha&&ANG[i],o,j;if(!q)return a;o=a.slice();for(j in q)o[j]=q[j];return o}
  function toma(s){var t=tramo(s),a=tomaDe(t[0]),b=tomaDe(t[0]+1),e=t[1],o=[],j;for(j=0;j<6;j++)o[j]=a[j]+(b[j]-a[j])*e;
    // entre dos escenas de cerca la cámara se levanta, viaja y vuelve a bajar
    var dist=Math.hypot(b[0]-a[0],b[1]-a[1]),arco=Math.sin(Math.PI*e),cerca=Math.max(a[4],b[4])<34;
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
  function alto(){return .095}   // el camino va siempre sobre piso, estacionamiento o calle (la vereda se abre en la entrada de vehículos)
  function armarCamino(){var T=M.THREE,a=redondear(PIE,.45,.25),b=redondear(VAN,2.4,.25),La=a[a.length-1][2],R=a.concat(b.slice(1).map(function(p){return[p[0],p[1],p[2]+La]})),n=R.length,L=R[n-1][2],i;
    var idx=[],cero=[];for(i=0;i<n*6;i++)cero.push(0);for(i=0;i<n-1;i++){var v=i*2;idx.push(v,v+2,v+1,v+1,v+2,v+3)}
    var g=new T.BufferGeometry(),at=new T.Float32BufferAttribute(cero,3),pos=at.array;g.setAttribute('position',at);g.setIndex(idx);g.setDrawRange(0,0);   // los números los arma el motor en su ventana (un arreglo de esta ventana no le sirve)
    // los pisos, las calles y sus líneas pintadas del motor llevan corrimiento de profundidad para no titilar entre sí: la línea del pedido lleva uno mayor, así queda siempre encima del piso
    var mat=new T.MeshBasicMaterial({color:0xFF7A1A,toneMapped:false,side:T.DoubleSide,transparent:true,opacity:.96,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-20,polygonOffsetUnits:-18});
    var m=new T.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=4;M.scene.add(m);
    var disco=new T.CircleGeometry(1,30);disco.rotateX(-Math.PI/2);var ini=new T.Mesh(disco,mat),fin=new T.Mesh(disco,mat);ini.renderOrder=fin.renderOrder=4;ini.visible=fin.visible=false;M.scene.add(ini);M.scene.add(fin);
    function marca(x,z){var mj=0,md=1e9;for(var q=0;q<n;q++){var d=Math.hypot(R[q][0]-x,R[q][1]-z);if(d<md){md=d;mj=q}}return R[mj][2]/L}
    CAM={R:R,n:n,L:L,g:g,pos:pos,ini:ini,fin:fin,w:0,van:La/L,tec:marca(16.2,13.25),dep:marca(21.2,11.6)};
    RUTA[3]=CAM.tec;RUTA[4]=CAM.van;V3=new T.Vector3()}
  function ancho(w){var R=CAM.R,n=CAM.n,p=CAM.pos,i;CAM.w=w;
    for(i=0;i<n;i++){var a=R[Math.max(0,i-1)],b=R[Math.min(n-1,i+1)],tx=b[0]-a[0],tz=b[1]-a[1],l=Math.hypot(tx,tz)||1,nx=-tz/l*w*.5,nz=tx/l*w*.5,y=alto(R[i][0],R[i][1]),o=i*6;
      p[o]=R[i][0]+nx;p[o+1]=y;p[o+2]=R[i][1]+nz;p[o+3]=R[i][0]-nx;p[o+4]=y;p[o+5]=R[i][1]-nz}
    CAM.g.attributes.position.needsUpdate=true}
  function enRuta(fr){var R=CAM.R,s=Math.max(0,Math.min(1,fr))*CAM.L,a=0,b=CAM.n-1;while(b-a>1){var m=(a+b)>>1;if(R[m][2]<=s)a=m;else b=m}
    var A=R[a],B=R[b],q=(s-A[2])/Math.max(1e-6,B[2]-A[2]),c=R[Math.min(CAM.n-1,a+4)],p=R[Math.max(0,a-1)];return{x:A[0]+(B[0]-A[0])*q,z:A[1]+(B[1]-A[1])*q,dx:c[0]-p[0],dz:c[1]-p[1],i:a+q}}
  var cab={x:0,z:0,y:.1,ver:false},vanP=null;
  function camino(r,d){if(!CAM)return;var w=Math.max(.11,Math.min(1.1,d*.0085));if(Math.abs(w-CAM.w)>CAM.w*.04)ancho(w);
    var e=enRuta(r),n=Math.floor(e.i),ver=r>.0015;CAM.g.setDrawRange(0,Math.max(0,n)*6);
    CAM.ini.visible=CAM.fin.visible=ver;CAM.ini.scale.setScalar(CAM.w*.95);CAM.ini.position.set(CAM.R[0][0],alto(CAM.R[0][0],CAM.R[0][1])+.004,CAM.R[0][1]);
    CAM.fin.scale.setScalar(CAM.w*1.25);CAM.fin.position.set(e.x,alto(e.x,e.z)+.006,e.z);cab.x=e.x;cab.z=e.z;cab.ver=ver;
    // la camioneta: estacionada de culata (lista para salir) hasta que el pedido llega; después lo lleva
    var v=r>CAM.van?e:enRuta(CAM.van);vanP={x:v.x,z:v.z,r:Math.atan2(-v.dz,v.dx)};
    var lv=1.5/CAM.L,u=Math.max(0,Math.min(1,(r-(CAM.van-lv))/lv));cab.y=.1+1.85*u*u*(3-2*u)}   // al llegar a la camioneta, el punto se sube al techo y viaja ahí
  var sube=0;
  function ponVan(dt){if(!vanP||!MQ||!CAM)return false;var g=MQ.objs.get(FIO),anda=false;
    if(g&&(g.position.x!==vanP.x||g.position.z!==vanP.z||g.rotation.y!==vanP.r)){g.position.x=vanP.x;g.position.z=vanP.z;g.rotation.y=vanP.r;g.updateMatrixWorld(true)}
    // el técnico: parado junto a su camioneta mientras carga; cuando arranca, se sube (camina a la puerta y entra)
    var d=MQ.objs.get(DIE);if(d){var q=rk>CAM.van+.0008?1:0;if(sube!==q){var st=Math.min(Math.abs(q-sube),reduce?1:Math.max(.004,dt||.016)/.46);sube+=q>sube?st:-st;anda=true}
      var e=sube*sube*(3-2*sube),x=6.6+1.2*e,z=23.6-1.05*e,sc=Math.max(.001,1-e*e);if(d.position.x!==x||d.scale.x!==sc||d.visible!==(e<.995)){d.position.x=x;d.position.z=z;d.scale.setScalar(sc);d.visible=e<.995;d.updateMatrixWorld(true);anda=true}}
    // y su silla queda vacía cuando el pedido sale del escritorio: el punto que va al depósito y a la camioneta es él, llevándolo
    var sd=MQ.objs.get(SEN);if(sd){var sv=!(rk>CAM.tec+.004);if(sd.visible!==sv){sd.visible=sv;anda=true}}
    return anda}
  // lo que va encima de la maqueta (las chapitas de cada área y el pedido) sigue a la cámara: se ubica después de cada dibujo
  var pinV=false,tkV=false,tkAba=false;
  // el estado del pedido según por dónde va su camino: [texto, resuelto]
  var EST=[['Ticket nuevo',0],['Lo toma Diego',0],['Retira los materiales',0],['Cargado en la camioneta',0],['En camino',0],['Firmado',1],['Resuelto',1]],estA=-1;
  function estado(){if(!CAM)return 0;return S>=5.5?6:rk>=.9985?5:rk>CAM.van+.0008?4:rk>CAM.van-.003?3:rk>=CAM.dep?2:rk>=CAM.tec-.003?1:0}
  function ponEstado(){var e=estado();if(e===estA)return;var antes=estA;estA=e;tk3t.textContent='T‑0152 · '+EST[e][0];tk3.classList.toggle('ok',!!EST[e][1]);medirTk();
    if(antes>=0&&tkV&&!reduce){tk3.classList.remove('pum');void tk3.offsetWidth;tk3.classList.add('pum')}}
  function sobre(){if(!M||!V3||(!pinV&&!tkV))return;var i,s;
    if(pinV)for(i=0;i<pins.length;i++){var p=pins[i];V3.set(+p.dataset.x,+p.dataset.y,+p.dataset.z);s=M.aPantalla(V3);p.style.transform='translate('+(ox+s.x).toFixed(1)+'px,'+(oy+s.y).toFixed(1)+'px)'}
    if(tkV){V3.set(cab.x,cab.y,cab.z);s=M.aPantalla(V3);var X=ox+s.x,Y=oy+s.y,lo=10,hi=bw-10,j,q;for(j=0;j<devs.length;j++){q=devs[j];if(X<q[0]-24&&Y-54<q[2]&&Y-8>q[1])hi=Math.min(hi,q[0]-14)}
      var edge=0;if(txtR)for(j=0;j<txtR.length;j++){q=txtR[j];if(Y-56<q[2]&&Y-6>q[1]&&q[0]>edge)edge=q[0]}
      if(edge&&X>edge-90)lo=edge+12;   // al borde de un renglón del texto de la escena: la chapita va del lado libre
      var aba=Y-56<(ancha?84:dia.classList.contains('v')?138:84);if(aba!==tkAba){tkAba=aba;tk3.classList.toggle('aba',aba)}
      var izq=Math.max(10,Math.min(hi-tkW,Math.max(lo,X-tkW/2)));   /* si no hay lugar entre el texto y el teléfono, queda del lado del teléfono sin meterse abajo */
      tk3.style.transform='translate('+X.toFixed(1)+'px,'+Y.toFixed(1)+'px)';tk3b.style.transform='translateX('+(izq-X).toFixed(1)+'px)'}}
  var ancha=false,asp=1.6,bw=0,tk3b=$('b',tk3),tkW=180,DEV=$$('.ch .dev',cine),devs=[],TXT=chs.map(function(c){return $('.txt',c)}),txtR=null;
  function medir(){ox=f.offsetLeft;oy=f.offsetTop;ancha=innerWidth>860;asp=f.clientWidth/Math.max(1,f.clientHeight);bw=f.clientWidth;medirTk();
    winB=BG.offsetHeight;ZONA=Math.min(.84,winB/Math.max(1,innerHeight)+.14)}   // en pantalla angosta: dónde termina la ventana de la maqueta y a qué altura se lee el título de cada escena
  function medirTk(){tkW=tk3b.offsetWidth||180}
  // cambiar de hora fundiendo: una foto de lo que se ve queda encima y se desvanece sobre la hora nueva
  function ponHora(h){if(!M||!h||h===hora)return;var antes=hora;hora=h;
    if(antes&&!reduce&&cine.classList.contains('ready')&&vis){try{var cv=M.canvas;if(M.post)M.post.dibujar(M.scene,M.cam);else M.renderer.render(M.scene,M.cam);
      if(fund.width!==cv.width||fund.height!==cv.height){fund.width=cv.width;fund.height=cv.height}fund.getContext('2d').drawImage(cv,0,0);
      fund.style.transition='none';fund.style.opacity='1';void fund.offsetWidth;requestAnimationFrame(function(){requestAnimationFrame(function(){fund.style.transition='opacity 1.1s cubic-bezier(.22,1,.36,1)';fund.style.opacity='0'})})}catch(e){fund.style.opacity='0'}}
    try{M.ponerHora(h)}catch(e){}M.dirty=true}
  function horaDe(i){var c=chs[i];return(!H.classList.contains('n')&&c.dataset.horaDia)||c.dataset.hora||''}
  function alCapitulo(i){var c=chs[i];ponHora(horaDe(i));
    pinV=i===1;pins.forEach(function(p){p.classList.toggle('v',pinV&&!!M)});
    tkV=i>=2&&i<=6&&!!CAM;tk3.classList.toggle('v',tkV);medirTk();ponEstado();
    if(M){M.dirty=true}}
  // el riel del día
  var diaB=$$('button',dia),diaF=$('#diaF'),diaP=$('#diaP'),diaL=$('.l',dia);
  function riel(){var p=Math.max(0,Math.min(1,(S-2)/4)),v=S>1.5&&S<6.55;dia.classList.toggle('v',v);if(!v)return;
    diaF.style.transform='scaleX('+p.toFixed(4)+')';diaP.style.transform='translateX('+(p*diaL.offsetWidth).toFixed(1)+'px)';
    diaB.forEach(function(b){var q=+b.dataset.ir;b.classList.toggle('hecho',S>=q-.02);b.classList.toggle('on',Math.abs(S-q)<.3);if(Math.abs(S-q)<.3)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')})}
  dia.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;scrollTo({top:yDe(+b.dataset.ir),behavior:reduce?'auto':'smooth'})});
  // cuadro a cuadro: la cámara, el camino y la camioneta siguen al scroll con suavidad; quieta la cámara, el motor deja de dibujar (no gasta batería)
  var EPS=[.004,.004,.0006,.0006,.012];
  function paso(now){raf=0;if(!M||!vis)return;var dt=Math.min(.2,Math.max(.001,(now-tAnt)/1000));tAnt=now;   // en un equipo lento el tiempo sigue siendo el del reloj (no en cámara lenta)
    var c=toma(S),a=reduce?1:1-Math.exp(-dt/.17),quieto=true,j;
    if(intro>0){intro=Math.max(0,intro-dt/2.8);var q=intro*intro*(3-2*intro);c[4]*=1+.55*q;c[3]=Math.min(1.42,c[3]+.34*q);c[2]-=.6*q;quieto=false}
    c[2]+=px*.05;c[3]=Math.max(.2,Math.min(1.44,c[3]-py*.028));
    correr(c);
    if(!kOn){k=c.slice();rk=ruta(S);kOn=true}
    for(j=0;j<5;j++){k[j]+=(c[j]-k[j])*a;if(Math.abs(c[j]-k[j])>EPS[j])quieto=false}
    var rt=ruta(S);rk+=(rt-rk)*a;if(Math.abs(rt-rk)>.0003)quieto=false;else rk=rt;ponEstado();
    var C=M.C;C.tx=k[0];C.tz=k[1];C.yaw=k[2];C.pitch=k[3];C.d=k[4];try{camino(rk,k[4])}catch(e){}M.dirty=true;
    if(!quieto)raf=requestAnimationFrame(paso)}
  function correr(c){if(ancha){var sh=-(c[5]+Math.max(0,Math.min(.3,(1280-bw)/1280))*.2)*2*c[4]*.3443*asp;c[0]+=Math.cos(c[2])*sh;c[1]-=Math.sin(c[2])*sh}else{var cerca=c[4]<34;if(asp<1.3&&cerca)c[4]*=.84;   // en el teléfono, de cerca, un poco más cerca (la ventana de la maqueta es chica)
      var sv=(cerca?.2:.12)*2*.3443*c[4]/Math.sin(c[3]);c[0]-=Math.sin(c[2])*sv;c[1]-=Math.cos(c[2])*sv}   // y la escena baja: arriba la tapan la barra y el riel
    return c}   // en la compu, la escena va al hueco libre de la pantalla
  // dónde termina cada renglón de un bloque de texto: [derecha, arriba, abajo] (los títulos son cajas del ancho de la columna; sus renglones, no)
  function renglones(el){var o=[],k=el.children,i,j,c,q,rg;for(i=0;i<k.length;i++){c=k[i];
      if(c.classList.contains('stats')||c.classList.contains('cta'))q=[].map.call(c.children,function(x){return x.getBoundingClientRect()});
      else{rg=D.createRange();rg.selectNodeContents(c);q=rg.getClientRects()}
      for(j=0;j<q.length;j++)if(q[j].width>1)o.push([q[j].right,q[j].top,q[j].bottom])}return o}
  function mover(){if(M&&vis&&!raf){tAnt=performance.now()-16;raf=requestAnimationFrame(paso)}}
  // dónde manda el scroll: en la compu, el centro de cada escena al centro de la pantalla; en el teléfono (la maqueta es una ventana arriba y la historia pasa
  // por debajo), el título de cada escena en la zona de lectura. Cada escena se enciende cuando lo suyo se ve: en el teléfono, su aparato (o su texto si no tiene)
  var TIT=chs.map(function(c){return $('h1,h2',c)}),CUE=chs.map(function(c){return $('.dev',c)||$('.txt',c)}),BG=$('.bg',cine),ZONA=.62,winB=0;
  // el scroll que deja cada escena en su lugar (la portada, arriba de todo: con la página sin bajar la historia está en 0)
  function anclas(){var z=innerHeight*(ancha?.5:ZONA),Y=[],i,r;for(i=0;i<N;i++){r=(ancha?chs[i]:TIT[i]).getBoundingClientRect();Y[i]=scrollY+r.top+r.height/2-z}Y[0]=Math.max(0,Y[0]);return Y}
  function yDe(i){return anclas()[i]}
  function upd(){var vh=innerHeight,Y=anclas(),y=scrollY,on=-1,i;
    if(y<=Y[0])S=0;else if(y>=Y[N-1])S=N-1;else for(i=0;i<N-1;i++)if(y>=Y[i]&&y<Y[i+1]){S=i+(y-Y[i])/Math.max(1,Y[i+1]-Y[i]);break}
    for(i=0;i<N;i++){var q=(ancha?chs[i]:CUE[i]).getBoundingClientRect(),v=ancha?q.top<vh*.62&&q.bottom>vh*.38:q.top<vh*.88&&q.bottom>winB;chs[i].classList.toggle('on',v);if(v)on=i}
    if(!ancha)on=Math.round(S);
    devs=ancha?DEV.map(function(e){var r=e.getBoundingClientRect();return[r.left,r.top,r.bottom]}):[];   // dónde están los teléfonos y tarjetas: la chapita del pedido no se mete debajo
    txtR=ancha&&on>=0?renglones(TXT[on]):null;   // y dónde termina cada renglón del texto de la escena que se lee
    if(on>=0&&on!==act){act=on;alCapitulo(on)}
    top.classList.toggle('sc',scrollY>20);cine.classList.toggle('bajo',S>.05);riel();mover()}
  var ESC='olumi-web-v7';   // la escena de esta página (la de la v6 y la portada de unitytech.uy, «olumi-web», no tiene la entrada de vehículos)
  var src='/motor/beta/index.html?app=olumi&escena='+ESC+'&nuevo=1&ver=1&embebida=1&tema=claro'+(/[?&]post=0/.test(location.search)?'&post=0':'');
  var lento=matchMedia('(max-width:700px)').matches&&(navigator.deviceMemory||4)<4;
  function abrir(){if(f.getAttribute('src'))return;f.src=src;setTimeout(function(){if(!M)cine.classList.add('sin3d')},14000)}   // si a los 14 s no hay maqueta, queda la foto (si llega después, entra igual)
  if(lento)cine.classList.add('sin3d');   // sin maqueta (teléfono con poca memoria, o no cargó): en su lugar va una foto de la oficina y el cartel «Armando la oficina» no queda para siempre
  // la escena se revalida antes de abrir la maqueta: el motor la pide sin versión y el navegador podía quedarse horas con la de antes
  if(!lento){setTimeout(abrir,1200);try{fetch('/motor/escenas/'+ESC+'.json',{cache:'no-cache'}).then(abrir,abrir)}catch(e){abrir()}}
  f.addEventListener('load',function(){var n=0,tk=setInterval(function(){var mq=null;try{mq=f.contentWindow.__maqueta}catch(e){}if(mq&&mq.motor){clearInterval(tk);listo(mq)}else if(++n>240)clearInterval(tk)},250)});
  function listo(mq){MQ=mq;M=mq.motor;try{var d=f.contentDocument,s=d.createElement('style');s.textContent='body>*:not(#m3d){display:none!important}html,body{cursor:default!important;background:transparent!important}';d.head.appendChild(s)}catch(e){}
    try{mq.XT&&mq.XT.presentar&&mq.XT.presentar(false)}catch(e){}
    try{armarCamino();M.cada.push(function(dt){try{return ponVan(dt)}catch(e){return false}})}catch(e){CAM=null}
    try{M.despues.push(function(){try{sobre()}catch(e){}})}catch(e){}
    // fuera de la pantalla la maqueta no dibuja: su gente se sigue moviendo sola y gastaba placa y batería mientras se lee el resto de la página
    try{M.cada.forEach(function(g,i){M.cada[i]=function(dt,t){return vis?g(dt,t):false}})}catch(e){}
    medir();kOn=false;rk=ruta(S);var c0=correr(toma(S));try{camino(rk,c0[4])}catch(e){}
    try{M.ir({tx:c0[0],tz:c0[1],yaw:c0[2],pitch:c0[3],d:c0[4]},.001)}catch(e){}   // el motor arranca con su propio vuelo de presentación: acá se corta (si no, pelea con la cámara de la historia)
    // antes de mostrarla, la oficina pasa una vez por cada hora (sin esto, la primera vez que llega la noche la placa arma sus luces y se ve un cuadro gris)
    var hs=['azul','dia','manana','noche'],i=0;(function sig(){if(i<hs.length){try{M.ponerHora(hs[i++]);M.dirty=true}catch(e){}setTimeout(sig,260);return}
      hora='';var h0=horaDe(act<0?0:act);try{M.ponerHora(h0)}catch(e){}hora=h0;M.dirty=true;
      mover();setTimeout(function(){if(!reduce&&S<.5){intro=1;kOn=false}cine.classList.add('ready');alCapitulo(act<0?0:act);mover();
        setTimeout(function(){cine.classList.remove('sin3d')},1800)},300)})()}   // si había quedado la foto, se va cuando la maqueta ya terminó de aparecer encima
  addEventListener('scroll',function(){upd();segUpd()},{passive:true});addEventListener('resize',function(){medir();upd();segUpd();pon($('.tabs a.on'))});
  if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduce)addEventListener('pointermove',function(e){if(!vis||!M)return;px=e.clientX/innerWidth*2-1;py=e.clientY/innerHeight*2-1;mover()},{passive:true});
  if('IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting;if(vis)mover()}).observe(cine);
  // la tarjeta de la portada late con el día: cada tanto se cierra una visita más
  var miniN=$('#miniN'),miniB=$('#miniB'),miniV=$('#miniV'),mini=$('#mini'),VIVO=['Diego cerró la visita en Barraca Norte','Martín cerró el mantenimiento del edificio','Lucía pasó un WhatsApp a ticket'],nv=24,iv=0;
  if(miniN&&!reduce)setInterval(function(){if(!vis||S>.4||nv>=27||D.hidden)return;var t=VIVO[iv++%VIVO.length];miniV.textContent=t;miniV.classList.add('v');
    if(iv%3!==0){nv++;miniN.textContent=nv;miniB.style.setProperty('--w',(nv/38*100).toFixed(1)+'%');mini.classList.remove('pum');void mini.offsetWidth;mini.classList.add('pum')}
    setTimeout(function(){miniV.classList.remove('v')},3600)},5200);

  // ---- Seguridad: cada capítulo prende su dibujo ----
  var caps=$$('.sg .cap'),lays=$$('.sg .lay'),capOn='';
  function segUpd(){var vh=innerHeight,mob=innerWidth<=860,lin=mob?vh*.78:vh*.55,ac=null;
    caps.forEach(function(c){var r=c.getBoundingClientRect();if(r.top<lin)ac=c});if(!ac)ac=caps[0];
    caps.forEach(function(c){c.classList.toggle('on',c===ac)});
    if(ac.dataset.l!==capOn){capOn=ac.dataset.l;lays.forEach(function(l){l.classList.toggle('on',l.dataset.l===capOn)})}}
  // celular: una copia de cada dibujo arriba de su capítulo (se anima cuando aparece)
  caps.forEach(function(c){var l=lays.filter(function(x){return x.dataset.l===c.dataset.l})[0];if(!l)return;var m=D.createElement('div');m.className='mvis';m.setAttribute('aria-hidden','true');var q=l.cloneNode(true);q.classList.remove('on');m.appendChild(q);c.insertBefore(m,c.firstChild)});
  if('IntersectionObserver' in window){var mio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.firstChild.classList.add('on')})},{threshold:.35});$$('.mvis').forEach(function(m){mio.observe(m)})}

  // ---- el resto aterriza: lo que entra a la pantalla aparece de a uno, en orden de lectura; los precios cuentan ----
  var A=$$('[data-a]');A.forEach(function(el){if(el.dataset.a!=='solo')[].forEach.call(el.children,function(c,i){c.style.setProperty('--i',i)})});
  function cuenta(el){var fin=+el.dataset.cuenta,t0=0;if(!fin||reduce){return}(function p(t){if(!t0)t0=t;var u=Math.min(1,(t-t0)/1100),e=1-Math.pow(1-u,4);el.firstChild.nodeValue=Math.round(fin*e);if(u<1)requestAnimationFrame(p)})(performance.now())}
  function vio(el){el.classList.add('vio');$$('[data-cuenta]',el).forEach(cuenta)}
  if('IntersectionObserver' in window&&!reduce){var ia=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){vio(e.target);ia.unobserve(e.target)}})},{rootMargin:'0px 0px -10% 0px',threshold:.08});A.forEach(function(el){ia.observe(el)})}else A.forEach(function(el){el.classList.add('vio')});

  window.__olumiHist={get anda(){return!!raf||intro>0},get S(){return S},get r(){return rk},y:function(i){return yDe(i)},get est(){return[raf?1:0,+intro.toFixed(3),vis?1:0,kOn?1:0,k.map(function(v){return+v.toFixed(3)}),toma(S).map(function(v){return+v.toFixed(3)})]}};   // para las pruebas
  void D.body.offsetWidth;cine.classList.add('entra');medir();upd();segUpd();
})();
