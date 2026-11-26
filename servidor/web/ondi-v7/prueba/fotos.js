// las fotos del parque para cuando no hay maqueta (ondi/img/parque-{noche,dia}{,-m}.webp): salen de la portada de la misma página, de noche y de día, en compu y en teléfono.
// uso: node fotos.js   (con la vista previa armada en nuevo/ondi/). Si cambia la toma de la portada o la escena, se vuelven a sacar.
const {chromium}=require('playwright');const srv=require('./srv.js');const fs=require('fs'),path=require('path');
const RAIZ=path.resolve(__dirname,'../../../..'),RAICES=[...(process.env.SITIO?[process.env.SITIO]:[]),RAIZ],IMG=path.join(RAIZ,'ondi','img');fs.mkdirSync(IMG,{recursive:true});
(async()=>{const s=await srv(RAICES,8778);const b=await chromium.launch({args:['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
 for(const [suf,vp,dpr] of [['',{width:1440,height:900},1],['-m',{width:800,height:1700},1.5]])for(const tema of ['noche','dia']){
  const c=await b.newContext({viewport:vp,deviceScaleFactor:dpr,colorScheme:'dark'});const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message.slice(0,200)));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());await p.route('**/fonts.gstatic.com/**',r=>r.abort());
  await p.addInitScript(t=>{try{localStorage.setItem('ondi.web.tema',t)}catch(_){}},tema);
  await p.goto('http://localhost:8778'+(process.env.PAG||'/nuevo/ondi/'),{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.getElementById('cine').classList.contains('ready'),null,{timeout:180000});
  let n=0;for(let i=0;i<400&&n<3;i++){await p.waitForTimeout(250);const a=await p.evaluate(()=>{const m=document.getElementById('maq').contentWindow.__maqueta.motor;return __ondiHist.anda||m.dirty});n=a?0:n+1}
  const u=await p.evaluate(()=>{const m=document.getElementById('maq').contentWindow.__maqueta.motor;if(m.post)m.post.dibujar(m.scene,m.cam);else m.renderer.render(m.scene,m.cam);return{u:m.canvas.toDataURL('image/webp',.82),w:m.canvas.width,h:m.canvas.height,hora:m.hora}});
  const f=path.join(IMG,`parque-${tema}${suf}.webp`);fs.writeFileSync(f,Buffer.from(u.u.split(',')[1],'base64'));console.log(path.basename(f),u.w+'×'+u.h,u.hora,Math.round(fs.statSync(f).size/1024)+' KB');await c.close()}
 await b.close();s.close()})();
