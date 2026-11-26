// servidor estático mínimo para probar la web: busca cada archivo en varias raíces, en orden (primero la copia de trabajo, después el sitio)
const http=require('http'),fs=require('fs'),path=require('path');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.wasm':'application/wasm','.woff2':'font/woff2','.ico':'image/x-icon','.hdr':'application/octet-stream','.ktx2':'image/ktx2'};
module.exports=function(roots,port){roots=[].concat(roots);return new Promise(ok=>{const s=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';
  for(const root of roots){const f=path.join(root,u);if(!f.startsWith(root))continue;let st=null;try{st=fs.statSync(f)}catch(e){}if(!st)continue;
    if(st.isDirectory()){r.writeHead(302,{Location:q.url.split('?')[0]+'/'});return r.end()}
    r.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});return fs.createReadStream(f).pipe(r)}
  r.writeHead(404);r.end('no')});s.listen(port,()=>ok(s))})};
