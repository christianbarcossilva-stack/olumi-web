// sin maqueta (teléfono con poca memoria, navegador sin 3D o no cargó): a los 14 s tiene que quedar la foto de la oficina y no el cartel «Armando la oficina».
// uso: node sin3d.js   (con la vista previa armada en nuevo/olumi/; deja las capturas en /tmp/sin3d-*.png)
const {chromium}=require('playwright');const srv=require('./srv.js');const path=require('path');
const RAICES=[...(process.env.SITIO?[process.env.SITIO]:[]),path.resolve(__dirname,'../../../..')];
let mal=0;const T=(n,ok,x)=>{if(!ok)mal++;console.log((ok?'✓ ':'✗ ')+n+(!ok&&x!==undefined?'  → '+JSON.stringify(x).slice(0,300):''))};
(async()=>{const s=await srv(RAICES,8779);const b=await chromium.launch();
 for(const [n,vp,mov,tema,foto] of [['teléfono oscuro',{width:390,height:844},true,'noche','oficina-noche-m.webp'],['teléfono claro',{width:390,height:844},true,'dia','oficina-dia-m.webp'],['compu oscuro',{width:1440,height:900},false,'noche','oficina-noche.webp'],['tablet claro',{width:820,height:1180},true,'dia','oficina-dia-m.webp']]){
  const c=await b.newContext({viewport:vp,deviceScaleFactor:1,isMobile:mov,hasTouch:mov,colorScheme:'dark'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,200)));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());await p.route('**/fonts.gstatic.com/**',r=>r.abort());await p.route('**/motor/beta/**',r=>r.abort());   /* la maqueta no llega nunca */
  await p.addInitScript(t=>{try{localStorage.setItem('olumi.web.tema',t)}catch(_){}},tema);
  await p.goto('http://localhost:8779'+(process.env.PAG||'/nuevo/olumi/'),{waitUntil:'domcontentloaded'});await p.waitForTimeout(15500);
  const e=await p.evaluate(()=>({sin3d:document.getElementById('cine').classList.contains('sin3d'),bg:getComputedStyle(document.querySelector('.cine .bg'),'::before').backgroundImage,carga:getComputedStyle(document.querySelector('.cine .carga')).display,h1:document.querySelector('.ch.hero h1').getBoundingClientRect().top<innerHeight,sw:document.documentElement.scrollWidth-innerWidth}));
  await p.screenshot({path:`/tmp/sin3d-${n.replace(/[^a-z]+/gi,'-')}.png`});
  T(n+': queda la foto, sin el cartel de carga, con el título a la vista y sin errores',e.sin3d&&e.bg.includes(foto)&&e.carga==='none'&&e.h1&&e.sw<=0&&!errs.length,{e,errs});await c.close()}
 await b.close();s.close();console.log(mal?`sin3d: ${mal} MAL`:'sin3d: todo bien');process.exit(mal?1:0)})();
