// ¿por qué no se aquieta al cargar? mira cada 500 ms quién sigue pidiendo cuadros
const {chromium}=require('playwright');const srv=require('./srv.js');const RAICES=[...(process.env.SITIO?[process.env.SITIO]:[]),require('path').resolve(__dirname,'../../../..')];
(async()=>{const s=await srv(RAICES,8775);
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
 const c=await b.newContext({viewport:{width:+(process.env.W||1440),height:+(process.env.H||900)},deviceScaleFactor:1,colorScheme:'dark'});const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message.slice(0,200)));
 await p.route('**/fonts.googleapis.com/**',r=>r.abort());await p.route('**/fonts.gstatic.com/**',r=>r.abort());
 await p.goto('http://localhost:8775/nuevo/olumi/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.getElementById('cine').classList.contains('ready'),null,{timeout:120000});
 await p.evaluate(()=>{const m=document.getElementById('ofi').contentWindow.__maqueta.motor;window.__n=0;window.__quien=[];m.cada.forEach((f,i)=>{const g=f;m.cada[i]=function(dt,t){const r=g(dt,t);if(r){window.__n++;if(window.__quien.length<6)window.__quien.push(i+':'+String(g).slice(0,90))}return r}})});
 for(let i=0;i<5;i++){await p.waitForTimeout(500);console.log(JSON.stringify(await p.evaluate(()=>{const mq=document.getElementById('ofi').contentWindow.__maqueta,m=mq.motor,d=mq.objs.get('w26');return{est:JSON.stringify(__olumiHist.est),anda:__olumiHist.anda,S:+__olumiHist.S.toFixed(2),dirty:m.dirty,n:window.__n,q:window.__quien.slice(0,2),die:d?[+d.position.x.toFixed(2),+d.scale.x.toFixed(3),d.visible]:null,cada:m.cada.length}})))}
 await b.close();s.close()})();
