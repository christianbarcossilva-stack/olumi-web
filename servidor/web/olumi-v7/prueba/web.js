// prueba la web nueva: recorre la historia y saca capturas. PAG=/nuevo/olumi/ W H MOVIL=1 TEMA=dia|noche POST=0 SOLO=0,2 MID=3,4 OUT=/tmp/w7
const {chromium}=require('playwright');const srv=require('./srv.js');const RAICES=[...(process.env.SITIO?[process.env.SITIO]:[]),require('path').resolve(__dirname,'../../../..')];const fs=require('fs');
const PAG=process.env.PAG||'/nuevo/olumi/',OUT=process.env.OUT||'/tmp/w7',W=+(process.env.W||1280),HH=+(process.env.H||800),MOV=!!process.env.MOVIL;fs.mkdirSync(OUT,{recursive:true});
(async()=>{const s=await srv(RAICES,+(process.env.PUERTO||8774));
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
 const c=await b.newContext({viewport:{width:W,height:HH},deviceScaleFactor:1,isMobile:MOV,hasTouch:MOV,colorScheme:'dark',reducedMotion:process.env.REDUCE?'reduce':'no-preference'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,300)));p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g|ERR_TUNNEL|net::ERR/.test(m.text()))errs.push('C:'+m.text().slice(0,200))});
 await p.route('**/fonts.googleapis.com/**',r=>r.abort());if(process.env.SIN3D)await p.route('**/motor/**',r=>r.abort());   // sin la maqueta: para mirar el resto de la página sin que el 3D sin placa de video frene todo
await p.route('**/fonts.gstatic.com/**',r=>r.abort());
 if(process.env.TEMA)await p.addInitScript(t=>{try{localStorage.setItem('olumi.web.tema',t)}catch(_){}},process.env.TEMA);
 const t0=Date.now();await p.goto('http://localhost:'+(process.env.PUERTO||8774)+PAG+(process.env.POST==='0'?'?post=0':''),{waitUntil:'domcontentloaded'});
 if(process.env.CARGA){await p.waitForTimeout(700);await p.screenshot({path:`${OUT}/carga.png`})}
 if(process.env.SIN3D)await p.waitForTimeout(1500);else await p.waitForFunction(()=>document.getElementById('cine').classList.contains('ready'),null,{timeout:120000}).catch(e=>console.log('NO READY',e.message.slice(0,80)));
 console.log('lista en',Date.now()-t0,'ms');
 const M=()=>p.evaluate(()=>{try{const m=document.getElementById('ofi').contentWindow.__maqueta.motor;return{C:[m.C.tx,m.C.tz,m.C.yaw,m.C.pitch,m.C.d].map(v=>+v.toFixed(2)),hora:m.hora,dirty:m.dirty}}catch(e){return{err:String(e)}}});
 const quieta=async(max=240)=>{let n=0;for(let i=0;i<max;i++){await p.waitForTimeout(250);const a=await p.evaluate(()=>window.__olumiHist?window.__olumiHist.anda:false);const m=await M();if(!a&&!m.dirty){if(++n>=2)return m}else n=0}console.log('(no se aquietó)');return M()};
 if(process.env.INTRO){for(const ms of [200,900,1800]){await p.waitForTimeout(ms===200?200:ms-(ms===900?200:900));await p.screenshot({path:`${OUT}/intro${ms}.png`})}}
 await quieta();
 const chs=await p.evaluate(()=>[...document.querySelectorAll('.ch')].map((e,i)=>{if(window.__olumiHist&&__olumiHist.y)return Math.max(0,Math.round(__olumiHist.y(i)));const r=e.getBoundingClientRect();return Math.round(r.top+scrollY+r.height/2-innerHeight/2)}));
 const solo=process.env.SOLO!==undefined?(process.env.SOLO?process.env.SOLO.split(',').map(Number):[]):chs.map((_,i)=>i);
 const llego=q=>process.env.SIN3D?null:p.waitForFunction(q=>Math.abs(__olumiHist.S-q)<.08,q,{timeout:90000}).catch(()=>console.log('(el scroll no llegó a',q,')'));   // el aviso de scroll llega con el cuadro siguiente: con el 3D lento, la quietud de antes engaña
 for(const i of solo){await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),chs[i]);await llego(i);const m=await quieta();await p.waitForTimeout(+(process.env.ESPERA||3300));await p.screenshot({path:`${OUT}/ch${i}.png`});console.log('ch',i,JSON.stringify(m))}
 if(process.env.MID)for(const q of process.env.MID.split(',').map(Number)){const i=Math.floor(q),u=q-i;await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),chs[i]+(chs[i+1]-chs[i])*(u||.5));await p.waitForTimeout(700);const m=await quieta();await p.screenshot({path:`${OUT}/mid${q}.png`});console.log('mid',q,JSON.stringify(m.C))}
 if(process.env.JS)console.log('JS',JSON.stringify(await p.evaluate(process.env.JS)));
 if(process.env.SECC)for(const sel of process.env.SECC.split(',')){await p.evaluate(sel=>{const e=document.querySelector(sel);scrollTo({top:e.getBoundingClientRect().top+scrollY-90,behavior:'instant'})},sel);await p.waitForTimeout(+(process.env.ESPERA_S||1900));await p.screenshot({path:`${OUT}/s-${sel.replace(/[^a-z0-9]/gi,'')}.png`})}
 console.log('errores',JSON.stringify(errs.slice(0,8)));await b.close();s.close()})();
