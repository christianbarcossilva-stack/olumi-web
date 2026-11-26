// Sirve el sitio (olumi-web) y, por delante, carpetas extra: SITIO=/ruta pone otra copia primero.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
const TIPOS = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.html': 'text/html; charset=utf-8', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
export function servir(raices) {
  const s = http.createServer((q, r) => {
    let p = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname));
    for (const raiz of raices) {
      let f = join(raiz, p);
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
      if (existsSync(f)) return r.writeHead(200, { 'content-type': TIPOS[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(f));
    }
    r.writeHead(404).end();
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${s.address().port}`, cerrar: () => s.close() })));
}
