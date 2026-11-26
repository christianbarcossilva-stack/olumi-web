// la lógica de la historia, con números (sin mirar capturas): estados del pedido, la camioneta, el técnico que se sube, la foto que funde las horas, la pausa fuera de pantalla
const {chromium}=require('playwright');const srv=require('./srv.js');const RAICES=[...(process.env.SITIO?[process.env.SITIO]:[]),require('path').resolve(__dirname,'../../../..')];
let mal=0;const T=(n,ok,x)=>{if(!ok)mal++;console.log((ok?'✓ ':'✗ ')+n+(!ok&&x!==undefined?'  → '+JSON.stringify(x).slice(0,400):''))};
(async()=>{const s=await srv(RAICES,8776);
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
 const c=await b.newContext({viewport:{width:1100,height:700},deviceScaleFactor:1,colorScheme:'dark'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,200)));
 await p.route('**/fonts.googleapis.com/**',r=>r.abort());await p.route('**/fonts.gstatic.com/**',r=>r.abort());
 await p.goto('http://localhost:8776'+(process.env.PAG||'/olumi/')+'?post=0',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.getElementById('cine').classList.contains('ready'),null,{timeout:120000});
 const quieta=async()=>{let n=0;for(let i=0;i<360;i++){await p.waitForTimeout(250);const a=await p.evaluate(()=>{const m=document.getElementById('ofi').contentWindow.__maqueta.motor;return __olumiHist.anda||m.dirty});if(!a){if(++n>=3)return}else n=0}console.log('(no se aquietó)')};
 await quieta();
 const chs=await p.evaluate(()=>[...document.querySelectorAll('.ch')].map((e,i)=>{if(window.__olumiHist&&__olumiHist.y)return Math.max(0,Math.round(__olumiHist.y(i)));const r=e.getBoundingClientRect();return Math.round(r.top+scrollY+r.height/2-innerHeight/2)}));
 const dieQuieto=()=>p.waitForFunction(()=>{const d=document.getElementById('ofi').contentWindow.__maqueta.objs.get('w26');return d.scale.x===1||!d.visible},null,{timeout:60000}).catch(()=>console.log('(el técnico no terminó de subir o bajar)'));
 const ir=async q=>{const i=Math.floor(q),u=q-i;await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),chs[i]+((chs[i+1]||chs[i])-chs[i])*u);
   await p.waitForFunction(q=>Math.abs(__olumiHist.S-q)<.03,q,{timeout:90000}).catch(()=>console.log('(el scroll no llegó a',q,')'));   // el aviso de scroll llega con el cuadro siguiente
   await quieta();await dieQuieto()};
 const est=()=>p.evaluate(()=>{const mq=document.getElementById('ofi').contentWindow.__maqueta,m=mq.motor,v=mq.objs.get('veh_v1qk61'),d=mq.objs.get('w26'),sen=mq.objs.get('per_p9kwpc'),t=document.getElementById('tk3');
   return{S:+__olumiHist.S.toFixed(2),r:+__olumiHist.r.toFixed(4),hora:m.hora,tk:document.getElementById('tk3t').textContent,ok:t.classList.contains('ok'),tkV:t.classList.contains('v'),van:[+v.position.x.toFixed(2),+v.position.z.toFixed(2),+v.rotation.y.toFixed(2)],die:[+d.position.x.toFixed(2),+d.scale.x.toFixed(2),d.visible],sen:!!(sen&&sen.visible),
     riel:document.getElementById('dia').classList.contains('v'),pins:document.querySelectorAll('.pin.v').length,cam:[m.C.tx,m.C.tz,m.C.d].map(x=>+x.toFixed(1))}});
 let e=await est();T('portada: de noche, sin camino, sin riel ni chapitas',e.hora==='noche'&&e.r===0&&!e.riel&&!e.tkV&&e.pins===0,e);
 T('la camioneta espera de culata en su lugar y el técnico está al lado',e.van[0]===8.7&&e.van[1]===21.6&&e.van[2]===-1.57&&e.die[1]===1&&e.die[2],e);
 // la foto que funde: al pasar de noche a mañana la foto queda arriba y se va
 await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),chs[1]);
 await p.waitForFunction(()=>document.getElementById('ofi').contentWindow.__maqueta.motor.hora==='manana',null,{timeout:60000}).catch(()=>{});
 const f0=await p.evaluate(()=>{const f=document.getElementById('fund');let a=-1;try{a=f.getContext('2d').getImageData(f.width>>1,f.height>>1,1,1).data[3]}catch(e){a=-2}return{w:f.width,h:f.height,a}});   // la foto queda dibujada en el lienzo aunque ya se haya desvanecido
 await quieta();e=await est();T('escena 1: amanece (la foto de la hora anterior quedó dibujada para fundir) y aparecen las tres chapitas',e.hora==='manana'&&f0.w>100&&f0.a===255&&e.pins===3,{f0,e});
 const op=await p.evaluate(()=>getComputedStyle(document.getElementById('fund')).opacity);T('la foto termina transparente',+op<.02,op);
 await ir(2);e=await est();T('7:42 · «Ticket nuevo», el riel aparece',/Ticket nuevo/.test(e.tk)&&!e.ok&&e.tkV&&e.riel&&e.r>0&&e.r<.01,e);
 await ir(3);e=await est();T('7:43 · «Lo toma Diego», Diego está en su escritorio',/Lo toma Diego/.test(e.tk)&&e.sen,e);
 await ir(3.5);e=await est();T('camino al depósito · «Retira los materiales», su silla quedó vacía',/Retira los materiales/.test(e.tk)&&!e.sen,e);
 await ir(4);e=await est();T('9:58 · «Cargado en la camioneta», la camioneta sigue en su lugar con el técnico al lado, es de día',/Cargado en la camioneta/.test(e.tk)&&e.van[0]===8.7&&e.die[2]&&e.hora==='dia',e);
 await ir(4.45);e=await est();T('en viaje · «En camino», la camioneta salió y el técnico va adentro',/En camino/.test(e.tk)&&!e.ok&&(e.van[0]!==8.7||e.van[1]!==21.6)&&!e.die[2],e);
 await ir(5);e=await est();T('10:42 · «Firmado» en verde, la camioneta frente al cliente mirando al oeste',/Firmado/.test(e.tk)&&e.ok&&e.van[0]===-19.5&&e.van[1]===33.3&&Math.abs(Math.abs(e.van[2])-3.14)<.02,e);
 await ir(6);e=await est();T('19:30 · «Resuelto», hora azul',/Resuelto/.test(e.tk)&&e.ok&&e.hora==='azul',e);
 await ir(7);e=await est();T('cierre: de noche, sin chapita ni riel, el camino completo',e.hora==='noche'&&!e.tkV&&!e.riel&&e.r===1,e);
 await ir(4);e=await est();T('volver atrás: la camioneta vuelve a su lugar y el técnico baja',e.van[0]===8.7&&e.van[1]===21.6&&e.die[2]&&e.die[1]===1&&/Cargado en la camioneta/.test(e.tk),e);
 await ir(2);e=await est();T('y más atrás, Diego vuelve a estar en su escritorio',e.sen&&/Ticket nuevo/.test(e.tk),e);
 // el riel lleva a la escena
 await p.evaluate(()=>document.querySelector('#dia button[data-ir="5"]').click());await p.waitForFunction(()=>Math.abs(__olumiHist.S-5)<.08,null,{timeout:60000}).catch(()=>{});await quieta();e=await est();T('tocar 10:42 en el riel lleva a esa escena',Math.abs(e.S-5)<.08,e);
 // fuera de pantalla la maqueta no dibuja
 await p.evaluate(()=>{const s=document.getElementById('planes');scrollTo({top:s.getBoundingClientRect().top+scrollY,behavior:'instant'})});await p.waitForTimeout(2500);
 const n=await p.evaluate(async()=>{const m=document.getElementById('ofi').contentWindow.__maqueta.motor;let k=0;m.despues.push(()=>k++);await new Promise(r=>setTimeout(r,3000));return k});T('con la historia fuera de la pantalla, la maqueta no dibuja ni un cuadro en 3 s',n===0,n);
 const sc=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);T('nada se sale del costado',sc<=0,sc);
 T('sin errores',!errs.length,errs);await b.close();s.close();console.log(mal?`logica: ${mal} MAL`:'logica: todo bien');process.exit(mal?1:0)})();
