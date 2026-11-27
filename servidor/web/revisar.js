// Revisión de las páginas públicas (27/11): abre cada página en compu y teléfono y anota
//  · errores de consola y del programa · archivos que no cargan · imágenes rotas · enlaces internos y anclas que no llevan a nada
//  · si se corre de costado · título, descripción, imagen para compartir y dirección canónica
// uso: node servidor/web/revisar.js [/olumi/ /olumi/terminos.html …]     (sin argumentos: las de Olumi y la portada)
const path=require('path'),fs=require('fs');const RAIZ=path.resolve(__dirname,'../..');
const srv=require('./olumi-v7/prueba/srv.js');const {chromium}=require('playwright');
const PAGS=process.argv.slice(2).length?process.argv.slice(2):['/','/olumi/','/olumi/terminos.html','/olumi/privacidad.html','/nuevo/olumi/'];
const existe=u=>{let f=path.join(RAIZ,decodeURIComponent(u.split('#')[0].split('?')[0]));try{const s=fs.statSync(f);if(s.isDirectory())return fs.existsSync(path.join(f,'index.html'));return true}catch(e){return false}};
let mal=0;const dice=(ok,t)=>{if(!ok)mal++;console.log((ok?'  ✓ ':'  ✗ ')+t)};
(async()=>{const s=await srv([RAIZ],0),puerto=s.address().port,O='http://127.0.0.1:'+puerto;const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist']});
for(const pg of PAGS)for(const [nom,vp,movil] of [['compu',{width:1440,height:900},false],['teléfono',{width:390,height:844},true]]){
  const c=await b.newContext({viewport:vp,isMobile:movil,hasTouch:movil,deviceScaleFactor:1,colorScheme:'dark',locale:'es-UY'});const p=await c.newPage();const errs=[],faltan=[];
  p.on('pageerror',e=>errs.push(e.message.slice(0,160)));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebGL|GPU|THREE|net::ERR/i.test(m.text()))errs.push('consola: '+m.text().slice(0,160))});
  p.on('response',r=>{const u=r.url();if(u.startsWith(O)&&r.status()>=400)faltan.push(r.status()+' '+u.slice(O.length))});
  p.on('requestfailed',r=>{const u=r.url();if(u.startsWith(O)&&!/\.glb|\.gltf|escenas\//.test(u)&&!/ERR_ABORTED/.test((r.failure()||{}).errorText||''))faltan.push('falló '+u.slice(O.length))});
  await c.route(u=>!u.href.startsWith(O),r=>r.abort());   // nada de afuera: acá se mira lo propio
  await p.goto(O+pg,{waitUntil:'domcontentloaded',timeout:45000}).catch(e=>errs.push('no abrió: '+e.message.slice(0,80)));await p.waitForTimeout(2500);
  // bajar hasta el final para que cargue todo lo que espera a verse
  await p.evaluate(async()=>{const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=innerHeight*.9){scrollTo({top:y,behavior:'instant'});await new Promise(r=>setTimeout(r,90))}scrollTo({top:0,behavior:'instant'})}).catch(()=>{});await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{const q=s=>document.querySelector(s),m=n=>(q(`meta[name="${n}"],meta[property="${n}"]`)||{}).content||'';
    return{url:location.pathname,titulo:document.title,desc:m('description'),og:m('og:image'),canon:(q('link[rel=canonical]')||{}).href||'',lang:document.documentElement.lang,robots:m('robots'),
      ov:document.documentElement.scrollWidth-innerWidth,
      imgs:[...document.images].filter(i=>i.complete&&!i.naturalWidth&&i.getAttribute('src')).map(i=>i.getAttribute('src').slice(0,80)),
      sinAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,
      links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),ids:[...document.querySelectorAll('[id]')].map(e=>e.id),
      botonesSinNombre:[...document.querySelectorAll('button,a[href]')].filter(e=>!(e.textContent||'').trim()&&!e.getAttribute('aria-label')&&!e.title&&!e.querySelector('img[alt]:not([alt=""])')).length}}).catch(e=>null);
  console.log(`\n${pg} · ${nom}`+(r&&r.url!==pg?`  (lleva a ${r.url})`:''));
  if(!r){dice(false,'la página no respondió');await c.close();continue}
  dice(!errs.length,'sin errores'+(errs.length?': '+[...new Set(errs)].slice(0,4).join(' | '):''));
  dice(!faltan.length,'todo carga'+(faltan.length?': '+[...new Set(faltan)].slice(0,6).join(' | '):''));
  dice(!r.imgs.length,'imágenes bien'+(r.imgs.length?': rotas '+r.imgs.slice(0,4).join(', '):''));
  dice(r.ov<=2,'no se corre de costado'+(r.ov>2?': '+r.ov+' px':''));
  const ids=new Set(r.ids),rotos=[],afuera=new Set();
  for(const h of new Set(r.links)){if(/^(mailto:|tel:|javascript:)/.test(h))continue;if(/^https?:/.test(h)){if(/^https?:\/\/(www\.)?unitytech\.uy/.test(h)){const u=h.replace(/^https?:\/\/(www\.)?unitytech\.uy/,'')||'/';if(!existe(u))rotos.push(h)}else afuera.add(h.split('?')[0]);continue}
    if(h.startsWith('#')){if(h.length>1&&!ids.has(decodeURIComponent(h.slice(1))))rotos.push(h);continue}
    const u=new URL(h,O+r.url).pathname;if(!existe(u))rotos.push(h);else{const a=h.split('#')[1];if(a&&u===r.url&&!ids.has(a))rotos.push(h)}}
  dice(!rotos.length,'enlaces internos y anclas bien'+(rotos.length?': '+rotos.slice(0,8).join(', '):''));
  if(nom==='compu'){dice(r.titulo.length>=10&&r.titulo.length<=70,'título: '+r.titulo);if(!/noindex/.test(r.robots)){dice(r.desc.length>=50&&r.desc.length<=160,`descripción (${r.desc.length} letras)`);dice(!!r.og&&existe(r.og.replace(/^https?:\/\/[^/]+/,'')),'imagen para compartir: '+(r.og||'falta'));dice(/^https:\/\/unitytech\.uy\//.test(r.canon),'dirección canónica: '+(r.canon||'falta'))}
    dice(/^es(-|$)/.test(r.lang),'idioma de la página: '+r.lang);dice(!r.botonesSinNombre,'botones y enlaces con nombre'+(r.botonesSinNombre?': '+r.botonesSinNombre+' sin nombre':''));
    if(r.sinAlt)console.log('  · '+r.sinAlt+' imágenes sin texto alternativo');if(afuera.size)console.log('  · enlaces hacia afuera (no se comprueban desde acá): '+[...afuera].join('  '))}
  await c.close()}
await b.close();s.close();console.log(mal?`\nrevisar: ${mal} cosas para mirar`:'\nrevisar: todo bien');process.exit(mal?1:0)})();
