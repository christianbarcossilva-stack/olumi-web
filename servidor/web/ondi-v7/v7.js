(function(){
  // Ondi web v7: la historia sobre el motor común (escena «ondi-web», un parque inventado). Reemplaza al guion de la maqueta vieja; el resto de la página
  // (tema, marcas, traza, el rack que se toca, el rack 3D de la tapa) sigue en el guion de siempre.
  var D=document,H=D.documentElement,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(q,r){return(r||D).querySelector(q)}function $$(q,r){return[].slice.call((r||D).querySelectorAll(q))}
  function dia(){return H.dataset.tema==='dia'}
  var cine=$('#cine'),f=$('#maq'),chs=$$('.ch',cine),N=chs.length,riel=$('#dia'),fund=$('#fund'),pins=$$('.pin',cine),tk3=$('#tk3'),tk3t=$('#tk3t'),tk3s=$('#tk3s'),top=$('#top');
  var M=null,MQ=null,vis=true,raf=0,tAnt=0,S=0,act=-1,hora='',intro=0,px=0,py=0,k=[0,0,0,0,0],kOn=false,rk=0,rv=0,CAB=null,VAN=null,ox=0,oy=0,V3=null;
  // una toma por escena: [centro x, centro z, giro, inclinación, distancia, corrimiento a la derecha en la compu]
  // escena «ondi-web»: la ruta corre a lo largo de x (z = −78), el acceso sube por x = 0; el galpón N1 al este (x 33 a 63) con sus andenes mirando al acceso;
  // la sala técnica (rack N1) en x 14, z −26; el AP-13 en la pared del galpón N1, x 32,4, z 6
  var TOMA=[[6,4,.78,.92,250,.16],[10,-4,.95,.82,175,.18],[30,6,-1.42,.36,30,.1],[19,-10,-1.05,.74,68,.2],[-2,-50,-.78,.66,110,0],[12,-27,-.5,.42,26,0],[8,8,.85,.96,205,.18]];
  var ANG={0:{4:300},1:{4:215},3:{4:80},4:{4:175},6:{4:240}};   // en pantalla angosta, las vistas enteras un poco más lejos (la ventana de la maqueta es chica)
  // el aviso recorre el cable de vuelta: del AP-13 hasta el switch del rack N1
  var CABLE=[[32.4,6],[10.5,6,2],[10.5,-16,2],[14,-20,1.5],[14,-24.5]];
  // el furgón: viene por la ruta, entra por la barrera y estaciona frente a la sala técnica
  var RUTA=[[-200,-80.5],[-14,-80.5,6],[2.3,-70,6],[2.3,-38,4],[6.8,-31.5,3],[7.2,-27.5]],FUR='van',TEC='tec';
  var EQ_CAE=['ap13','ap14','c07','c08'];
  function ease(u){var h=.2,v=Math.max(0,Math.min(1,(u-h)/(1-2*h)));return v*v*v*(v*(v*6-15)+10)}
  function tramo(s){var i=Math.max(0,Math.min(N-2,Math.floor(s)));return[i,ease(s-i)]}
  function tomaDe(i){var a=TOMA[i],q=!ancha&&ANG[i],o,j;if(!q)return a;o=a.slice();for(j in q)o[j]=q[j];return o}
  function toma(s){var t=tramo(s),a=tomaDe(t[0]),b=tomaDe(t[0]+1),e=t[1],o=[],j;for(j=0;j<6;j++)o[j]=a[j]+(b[j]-a[j])*e;
    var dist=Math.hypot(b[0]-a[0],b[1]-a[1]),arco=Math.sin(Math.PI*e),cerca=Math.max(a[4],b[4])<90;
    if(cerca){o[4]+=arco*Math.min(60,dist*.7);o[3]+=arco*Math.min(.2,dist*.006)}   // entre dos escenas de cerca, la cámara se levanta, viaja y vuelve a bajar
    return o}
  // cuánto del cable y cuánto del viaje del furgón van dibujados, según por dónde va la historia
  function lin(a,b,s){return Math.max(0,Math.min(1,(s-a)/(b-a)))}
  function cableDe(s){return ease(lin(2.35,3,s))}
  function vanDe(s){return lin(3.15,4.1,s)}
  // las líneas: esquinas redondeadas y un punto cada «paso» metros, con su largo acumulado
  function redondear(P,rad,paso){var Q=[P[0]],i,j,k2;
    for(i=1;i<P.length-1;i++){var A=Q[Q.length-1],B=P[i],C=P[i+1],ux=A[0]-B[0],uz=A[1]-B[1],lu=Math.hypot(ux,uz),vx=C[0]-B[0],vz=C[1]-B[1],lv=Math.hypot(vx,vz);
      if(lu<1e-6||lv<1e-6)continue;ux/=lu;uz/=lu;vx/=lv;vz/=lv;var r=B[2]!==undefined?B[2]:rad,t=Math.min(r,lu*.5,lv*.5);
      if(ux*vx+uz*vz<-.9995||t<.02){Q.push([B[0],B[1]]);continue}
      var p1=[B[0]+ux*t,B[1]+uz*t],p2=[B[0]+vx*t,B[1]+vz*t],n=Math.max(4,Math.ceil(t/paso*2));
      for(k2=0;k2<=n;k2++){var q=k2/n,a=(1-q)*(1-q),b=2*q*(1-q),c=q*q;Q.push([a*p1[0]+b*B[0]+c*p2[0],a*p1[1]+b*B[1]+c*p2[1]])}}
    Q.push(P[P.length-1].slice(0,2));var out=[[Q[0][0],Q[0][1],0]],tot=0,resto=paso;
    for(j=1;j<Q.length;j++){var x0=Q[j-1][0],z0=Q[j-1][1],dx=Q[j][0]-x0,dz=Q[j][1]-z0,L=Math.hypot(dx,dz),d=0;while(L-d>=resto){d+=resto;out.push([x0+dx*d/L,z0+dz*d/L,tot+d]);resto=paso}resto-=L-d;tot+=L}
    var u=Q[Q.length-1],ult=out[out.length-1];if(Math.hypot(u[0]-ult[0],u[1]-ult[1])>1e-3)out.push([u[0],u[1],tot]);return out}
  // una cinta en el piso de la maqueta. Los números los arma el motor en su ventana (un arreglo de esta ventana no le sirve) y lleva un corrimiento
  // de profundidad mayor que el de los pisos y calles del motor, así queda siempre encima
  function cinta(P,rad,color,y){var T=M.THREE,R=redondear(P,rad,.3),n=R.length,L=R[n-1][2],i,idx=[],cero=[];for(i=0;i<n*6;i++)cero.push(0);for(i=0;i<n-1;i++){var v=i*2;idx.push(v,v+2,v+1,v+1,v+2,v+3)}
    var g=new T.BufferGeometry(),at=new T.Float32BufferAttribute(cero,3);g.setAttribute('position',at);g.setIndex(idx);g.setDrawRange(0,0);
    var mat=new T.MeshBasicMaterial({color:color,toneMapped:false,side:T.DoubleSide,transparent:true,opacity:.97,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-20,polygonOffsetUnits:-18});
    var m=new T.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=4;M.scene.add(m);
    var disco=new T.CircleGeometry(1,30);disco.rotateX(-Math.PI/2);var ini=new T.Mesh(disco,mat),fin=new T.Mesh(disco,mat);ini.renderOrder=fin.renderOrder=4;ini.visible=fin.visible=false;M.scene.add(ini);M.scene.add(fin);
    return{R:R,n:n,L:L,g:g,pos:at.array,mat:mat,ini:ini,fin:fin,w:0,y:y,x:0,z:0}}
  function ancho(C,w){var R=C.R,n=C.n,p=C.pos,i;C.w=w;
    for(i=0;i<n;i++){var a=R[Math.max(0,i-1)],b=R[Math.min(n-1,i+1)],tx=b[0]-a[0],tz=b[1]-a[1],l=Math.hypot(tx,tz)||1,nx=-tz/l*w*.5,nz=tx/l*w*.5,o=i*6;
      p[o]=R[i][0]+nx;p[o+1]=C.y;p[o+2]=R[i][1]+nz;p[o+3]=R[i][0]-nx;p[o+4]=C.y;p[o+5]=R[i][1]-nz}
    C.g.attributes.position.needsUpdate=true}
  function enLinea(C,fr){var R=C.R,s=Math.max(0,Math.min(1,fr))*C.L,a=0,b=C.n-1;while(b-a>1){var m=(a+b)>>1;if(R[m][2]<=s)a=m;else b=m}
    var A=R[a],B=R[b],q=(s-A[2])/Math.max(1e-6,B[2]-A[2]),c=R[Math.min(C.n-1,a+4)],p=R[Math.max(0,a-1)];return{x:A[0]+(B[0]-A[0])*q,z:A[1]+(B[1]-A[1])*q,dx:c[0]-p[0],dz:c[1]-p[1],i:a+q}}
  function dibujar(C,r,d,ver){var w=Math.max(.16,Math.min(1.6,d*.0085));if(Math.abs(w-C.w)>C.w*.04)ancho(C,w);
    var e=enLinea(C,r),n=Math.floor(e.i);C.g.setDrawRange(0,ver?Math.max(0,n)*6:0);ver=ver&&r>.002;
    C.ini.visible=C.fin.visible=ver;C.ini.scale.setScalar(C.w*.95);C.ini.position.set(C.R[0][0],C.y+.004,C.R[0][1]);
    C.fin.scale.setScalar(C.w*1.3);C.fin.position.set(e.x,C.y+.006,e.z);C.x=e.x;C.z=e.z;return e}
  var ROJO=0xE5383B,AZUL=0x2f7bff,VERDE=0x18A957,colCab=ROJO;
  function armar(){var T=M.THREE;CAB=cinta(CABLE,1.2,ROJO,.11);VAN=cinta(RUTA,3,AZUL,.1);V3=new T.Vector3()}
  var cab={x:0,z:0,y:.3},vanP=null;
  function lineas(s,d){if(!CAB)return;var c=cableDe(s),ok=s>=5.55;
    var col=ok?VERDE:ROJO;if(col!==colCab){colCab=col;CAB.mat.color.setHex(col)}
    dibujar(CAB,c,d,s>2.3);
    var v=vanDe(s),e=dibujar(VAN,v,d,s>3.1&&s<5.6);
    // el furgón va adelante de su línea; antes de salir espera lejos, en la ruta
    vanP={x:e.x,z:e.z,r:Math.atan2(-e.dz,e.dx)};
    // la chapita: en el AP mientras se cae, en la punta del cable cuando encuentra la causa, en el furgón mientras viaja, en el rack cuando llega
    if(s<2.35){cab.x=32.4;cab.z=6;cab.y=7.4}else if(s<3.15){cab.x=CAB.x;cab.z=CAB.z;cab.y=s<2.6?3:.4+2.2*c}else if(s<4.4&&v<1){cab.x=e.x;cab.z=e.z;cab.y=2.4}else{cab.x=14;cab.z=-26.6;cab.y=2.5}}
  function ponVan(){if(!vanP||!MQ)return false;var g=MQ.objs.get(FUR),anda=false;
    if(g&&(g.position.x!==vanP.x||g.position.z!==vanP.z||g.rotation.y!==vanP.r)){g.position.x=vanP.x;g.position.z=vanP.z;g.rotation.y=vanP.r;g.updateMatrixWorld(true);anda=true}
    var t=MQ.objs.get(TEC),tv=S>=4.35&&S<6.4;if(t&&t.visible!==tv){t.visible=tv;anda=true}   // el técnico aparece en la sala técnica cuando llega el furgón
    return anda}
  // el estado de los equipos en la maqueta, según la historia: el AP se cae, después el switch y lo que cuelga, al final todo verde
  var estEq='';
  function equipos(){if(!MQ)return;var e=S<1.6||S>=5.55?'ok':S<2.6?'ap':'sw';if(e===estEq)return;estEq=e;
    MQ.E.piezas.forEach(function(p){var n=null;if(p.id==='ap13')n=e==='ok'?'ok':'crit';else if(p.id==='rack')n=e==='sw'?'crit':'ok';else if(EQ_CAE.indexOf(p.id)>=0)n=e==='sw'?'off':'ok';
      if(n&&p.estado!==n){p.estado=n;try{MQ.rehacerId(p.id)}catch(x){}}});M.dirty=true}
  // la chapita cuenta por dónde va la noche: [etiqueta, texto, color]
  var EST=[['AP-13','Sin señal · andén 3','ro'],['SW-N1','La causa · 4 sin acceso','ro'],['T-0143','Martín lo tomó','az'],['T-0143','En camino','az'],['T-0143','Entró al parque','az'],['T-0143','En la sala técnica','az'],['T-0143','Resuelto · todo en línea','ok']],estA=-1;
  function estado(){var v=vanDe(S);return S>=5.55?6:S>=4.35?5:v>=.62?4:v>0?3:S>=3.05?2:S>=2.5?1:0}
  function ponEstado(){var e=estado();if(e===estA)return;var antes=estA;estA=e;tk3t.textContent=EST[e][0];tk3s.textContent=EST[e][1];tk3.classList.toggle('az',EST[e][2]==='az');tk3.classList.toggle('ok',EST[e][2]==='ok');medirTk();
    if(antes>=0&&tkV&&!reduce){tk3.classList.remove('pum');void tk3.offsetWidth;tk3.classList.add('pum')}}
  var pinV=false,tkV=false,tkAba=false,ancha=false,asp=1.6,bw=0,tk3b=$('b',tk3),tkW=200,DEV=$$('.ch .dev',cine),devs=[],TXT=chs.map(function(c){return $('.txt',c)}),txtR=null;
  function sobre(){if(!M||!V3||(!pinV&&!tkV))return;var i,s;
    if(pinV)for(i=0;i<pins.length;i++){var p=pins[i];V3.set(+p.dataset.x,+p.dataset.y,+p.dataset.z);s=M.aPantalla(V3);p.style.transform='translate('+(ox+s.x).toFixed(1)+'px,'+(oy+s.y).toFixed(1)+'px)'}
    if(tkV){V3.set(cab.x,cab.y,cab.z);s=M.aPantalla(V3);var X=ox+s.x,Y=oy+s.y,lo=10,hi=bw-10,j,q;for(j=0;j<devs.length;j++){q=devs[j];if(X<q[0]-24&&Y-54<q[2]&&Y-8>q[1])hi=Math.min(hi,q[0]-14)}
      var edge=0;if(txtR)for(j=0;j<txtR.length;j++){q=txtR[j];if(Y-56<q[2]&&Y-6>q[1]&&q[0]>edge)edge=q[0]}
      if(edge&&X>edge-90)lo=edge+12;
      var aba=Y-56<(ancha?84:riel.classList.contains('v')?132:84);if(aba!==tkAba){tkAba=aba;tk3.classList.toggle('aba',aba)}
      var izq=Math.max(10,Math.min(hi-tkW,Math.max(lo,X-tkW/2)));
      tk3.style.transform='translate('+X.toFixed(1)+'px,'+Y.toFixed(1)+'px)';tk3b.style.transform='translateX('+(izq-X).toFixed(1)+'px)'}}
  function medir(){ox=f.offsetLeft;oy=f.offsetTop;ancha=innerWidth>900;asp=f.clientWidth/Math.max(1,f.clientHeight);bw=f.clientWidth;medirTk();winB=BG.offsetHeight;ZONA=Math.min(.84,winB/Math.max(1,innerHeight)+.14)}
  function medirTk(){tkW=tk3b.offsetWidth||200}
  // cambiar de hora fundiendo: una foto de lo que se ve queda encima y se desvanece sobre la hora nueva
  function ponHora(h){if(!M||!h||h===hora)return;var antes=hora;hora=h;
    if(antes&&!reduce&&cine.classList.contains('ready')&&vis){try{var cv=M.canvas;if(M.post)M.post.dibujar(M.scene,M.cam);else M.renderer.render(M.scene,M.cam);
      if(fund.width!==cv.width||fund.height!==cv.height){fund.width=cv.width;fund.height=cv.height}fund.getContext('2d').drawImage(cv,0,0);
      fund.style.transition='none';fund.style.opacity='1';void fund.offsetWidth;requestAnimationFrame(function(){requestAnimationFrame(function(){fund.style.transition='opacity 1.1s cubic-bezier(.22,1,.36,1)';fund.style.opacity='0'})})}catch(e){fund.style.opacity='0'}}
    try{M.ponerHora(h)}catch(e){}M.dirty=true}
  function horaDe(i){var c=chs[i];return(dia()&&c.dataset.horaDia)||c.dataset.hora||''}
  function alCapitulo(i){ponHora(horaDe(i));
    pinV=i===1;pins.forEach(function(p){p.classList.toggle('v',pinV&&!!M)});
    tkV=i>=2&&i<=6&&!!CAB;tk3.classList.toggle('v',tkV);medirTk();ponEstado();
    cine.dataset.ch=i===0?'0':i===N-1?'todo':'x';
    if(M)M.dirty=true}
  // el riel de la noche
  var rB=$$('button',riel),rF=$('#diaF'),rP=$('#diaP'),rL=$('.l',riel);
  function rielUpd(){var p=Math.max(0,Math.min(1,(S-2)/4)),v=S>1.5&&cine.getBoundingClientRect().bottom>innerHeight*.72;riel.classList.toggle('v',v);if(!v)return;
    rF.style.transform='scaleX('+p.toFixed(4)+')';rP.style.transform='translateX('+(p*rL.offsetWidth).toFixed(1)+'px)';
    rB.forEach(function(b){var q=+b.dataset.ir;b.classList.toggle('hecho',S>=q-.02);b.classList.toggle('on',Math.abs(S-q)<.3);if(Math.abs(S-q)<.3)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')})}
  riel.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;scrollTo({top:yDe(+b.dataset.ir),behavior:reduce?'auto':'smooth'})});
  // cuadro a cuadro: la cámara y las líneas siguen al scroll con suavidad; quieta la cámara, el motor deja de dibujar
  var EPS=[.01,.01,.0006,.0006,.02];
  function paso(now){raf=0;if(!M||!vis)return;var dt=Math.min(.2,Math.max(.001,(now-tAnt)/1000));tAnt=now;
    var c=toma(S),a=reduce?1:1-Math.exp(-dt/.17),quieto=true,j;
    if(intro>0){intro=Math.max(0,intro-dt/2.8);var q=intro*intro*(3-2*intro);c[4]*=1+.5*q;c[3]=Math.min(1.42,c[3]+.3*q);c[2]-=.55*q;quieto=false}
    c[2]+=px*.05;c[3]=Math.max(.2,Math.min(1.44,c[3]-py*.028));
    correr(c);
    if(!kOn){k=c.slice();rk=S;kOn=true}
    for(j=0;j<5;j++){k[j]+=(c[j]-k[j])*a;if(Math.abs(c[j]-k[j])>EPS[j])quieto=false}
    rk+=(S-rk)*a;if(Math.abs(S-rk)>.0006)quieto=false;else rk=S;
    var C=M.C;C.tx=k[0];C.tz=k[1];C.yaw=k[2];C.pitch=k[3];C.d=k[4];try{lineas(rk,k[4])}catch(e){}M.dirty=true;
    if(!quieto)raf=requestAnimationFrame(paso)}
  function correr(c){if(ancha){var sh=-(c[5]+Math.max(0,Math.min(.3,(1280-bw)/1280))*.2)*2*c[4]*.3443*asp;c[0]+=Math.cos(c[2])*sh;c[1]-=Math.sin(c[2])*sh}
    else{var cerca=c[4]<90;var sv=(cerca?.2:.12)*2*.3443*c[4]/Math.sin(c[3]);c[0]-=Math.sin(c[2])*sv;c[1]-=Math.cos(c[2])*sv}
    return c}
  function renglones(el){var o=[],k=el.children,i,j,c,q,rg;for(i=0;i<k.length;i++){c=k[i];
      if(c.classList.contains('cifras')||c.classList.contains('acc'))q=[].map.call(c.children,function(x){return x.getBoundingClientRect()});
      else{rg=D.createRange();rg.selectNodeContents(c);q=rg.getClientRects()}
      for(j=0;j<q.length;j++)if(q[j].width>1)o.push([q[j].right,q[j].top,q[j].bottom])}return o}
  function mover(){if(M&&vis&&!raf){tAnt=performance.now()-16;raf=requestAnimationFrame(paso)}}
  var TIT=chs.map(function(c){var t=$('.txt',c);return(t&&t.firstElementChild)||$('h1,h2',c)}),CUE=chs.map(function(c){return $('.dev',c)||$('.txt',c)}),BG=$('.bg',cine),ZONA=.62,winB=0;
  function anclas(){var z=innerHeight*(ancha?.5:ZONA),Y=[],i,r;for(i=0;i<N;i++){r=(ancha?chs[i]:TIT[i]).getBoundingClientRect();Y[i]=scrollY+r.top+r.height/2-z}Y[0]=Math.max(0,Y[0]);return Y}
  function yDe(i){return anclas()[i]}
  function upd(){var vh=innerHeight,Y=anclas(),y=scrollY,on=-1,i;
    if(y<=Y[0])S=0;else if(y>=Y[N-1])S=N-1;else for(i=0;i<N-1;i++)if(y>=Y[i]&&y<Y[i+1]){S=i+(y-Y[i])/Math.max(1,Y[i+1]-Y[i]);break}
    for(i=0;i<N;i++){var q=(ancha?chs[i]:CUE[i]).getBoundingClientRect(),v=ancha?q.top<vh*.62&&q.bottom>vh*.38:q.top<vh*.88&&q.bottom>winB;chs[i].classList.toggle('on',v);if(v)on=i}
    if(!ancha)on=Math.round(S);
    devs=ancha?DEV.map(function(e){var r=e.getBoundingClientRect();return[r.left,r.top,r.bottom]}):[];
    txtR=ancha&&on>=0?renglones(TXT[on]):null;
    if(on>=0&&on!==act){act=on;alCapitulo(on)}
    equipos();ponEstado();
    top.classList.toggle('sc',scrollY>20);cine.classList.toggle('bajo',S>.05);rielUpd();mover()}
  var ESC='ondi-web';
  var src='/motor/beta/index.html?app=ondi&escena='+ESC+'&nuevo=1&ver=1&embebida=1&solo=1&tema=claro'+(/[?&]post=0/.test(location.search)?'&post=0':'');
  var lento=matchMedia('(max-width:700px)').matches&&(navigator.deviceMemory||4)<4;
  function abrir(){if(f.getAttribute('src'))return;f.src=src;setTimeout(function(){if(!M)cine.classList.add('sin3d')},14000)}
  if(lento)cine.classList.add('sin3d');
  if(!lento){setTimeout(abrir,1200);try{fetch('/motor/escenas/'+ESC+'.json',{cache:'no-cache'}).then(abrir,abrir)}catch(e){abrir()}}   // la escena se revalida: el motor la pide sin versión
  f.addEventListener('load',function(){var n=0,tk=setInterval(function(){var mq=null;try{mq=f.contentWindow.__maqueta}catch(e){}if(mq&&mq.motor){clearInterval(tk);listo(mq)}else if(++n>240)clearInterval(tk)},250)});
  function listo(mq){MQ=mq;M=mq.motor;try{var d=f.contentDocument,s=d.createElement('style');s.textContent='body>*:not(#m3d){display:none!important}html,body{cursor:default!important;background:transparent!important}';d.head.appendChild(s)}catch(e){}
    try{mq.XT&&mq.XT.presentar&&mq.XT.presentar(false)}catch(e){}
    try{armar();M.cada.push(function(){try{return ponVan()}catch(e){return false}})}catch(e){CAB=VAN=null}
    try{M.despues.push(function(){try{sobre()}catch(e){}})}catch(e){}
    try{M.cada.forEach(function(g,i){M.cada[i]=function(dt,t){return vis?g(dt,t):false}})}catch(e){}   // fuera de la pantalla la maqueta no dibuja
    medir();kOn=false;rk=S;estEq='';equipos();var c0=correr(toma(S));try{lineas(rk,c0[4]);ponVan()}catch(e){}
    try{M.ir({tx:c0[0],tz:c0[1],yaw:c0[2],pitch:c0[3],d:c0[4]},.001)}catch(e){}   // el motor arranca con su vuelo de presentación: se corta, si no pelea con la historia
    var hs=['azul','dia','manana','noche'],i=0;(function sig(){if(i<hs.length){try{M.ponerHora(hs[i++]);M.dirty=true}catch(e){}setTimeout(sig,260);return}
      hora='';var h0=horaDe(act<0?0:act);try{M.ponerHora(h0)}catch(e){}hora=h0;M.dirty=true;
      mover();setTimeout(function(){if(!reduce&&S<.5){intro=1;kOn=false}cine.classList.add('ready');alCapitulo(act<0?0:act);mover();
        setTimeout(function(){cine.classList.remove('sin3d')},1800)},300)})()}
  addEventListener('scroll',upd,{passive:true});addEventListener('resize',function(){medir();upd()});
  // el día y la noche de la página cambian la hora de la maqueta
  new MutationObserver(function(){if(act>=0)alCapitulo(act)}).observe(H,{attributes:true,attributeFilter:['data-tema']});
  if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduce)addEventListener('pointermove',function(e){if(!vis||!M)return;px=e.clientX/innerWidth*2-1;py=e.clientY/innerHeight*2-1;mover()},{passive:true});
  if('IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting;if(vis)mover()}).observe(cine);
  // ---- el resto aterriza: lo que entra a la pantalla aparece de a uno, en orden de lectura; las cifras cuentan ----
  var A=$$('[data-a]');A.forEach(function(el){if(el.dataset.a!=='solo')[].forEach.call(el.children,function(c,i){c.style.setProperty('--i',i)})});
  function cuenta(el){var fin=+el.dataset.cuenta,t0=0;if(!fin||reduce)return;(function p(t){if(!t0)t0=t;var u=Math.min(1,(t-t0)/1100),e=1-Math.pow(1-u,4);el.firstChild.nodeValue=Math.round(fin*e);if(u<1)requestAnimationFrame(p)})(performance.now())}
  function vio(el){el.classList.add('vio');$$('[data-cuenta]',el).forEach(cuenta)}
  if('IntersectionObserver' in window&&!reduce){var ia=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){vio(e.target);ia.unobserve(e.target)}})},{rootMargin:'0px 0px -10% 0px',threshold:.08});A.forEach(function(el){ia.observe(el)})}else A.forEach(function(el){el.classList.add('vio')});
  var cif=$('.ch.todo .cifras');if(cif&&'IntersectionObserver' in window&&!reduce){var ic=new IntersectionObserver(function(es){if(es[0].isIntersecting){$$('[data-cuenta]',cif).forEach(cuenta);ic.disconnect()}},{threshold:.5});ic.observe(cif)}
  window.__ondiHist={get anda(){return!!raf||intro>0},get S(){return S},get est(){return[estA,estEq,+rk.toFixed(3)]},y:function(i){return yDe(i)}};   // para las pruebas
  void D.body.offsetWidth;cine.classList.add('entra');medir();upd();
})();
