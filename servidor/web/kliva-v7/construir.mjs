#!/usr/bin/env node
// Arma la web de Kliva v7 (una semana en la planta, sobre la maqueta 3D) a partir de la página pública de hoy (kliva/index.html, v6) y de las piezas de esta carpeta.
// Christian 26/11 08:12: «hay que actualizar la web como la de olumi».
// uso: node construir.mjs SALIDA [previa]   · con «previa» sale sin indexar y con la chapita «Vista previa» (para /nuevo/kliva/)
// Piezas: historia.html (la historia con la maqueta), v7.css, v7.js. Todo lo demás sale de la v6 tal cual (marcas, familia, datos, preguntas, pie).
// La planta es motor/escenas/kliva-web-v7.json: la escribe escena.mjs.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url)), rd = n => readFileSync(join(AQUI, n), 'utf8');
const WEB = process.env.WEB || resolve(AQUI, '..', '..', '..'), BASE = process.env.BASE || join(WEB, 'kliva', 'index.html');
const [, , SALIDA, modo] = process.argv, previa = modo === 'previa';
if (!SALIDA) { console.error('uso: node construir.mjs SALIDA [previa]'); process.exit(2); }
let s = readFileSync(BASE, 'utf8');
if (s.includes('Kliva web v7') && !process.env.BASE) s = rd('base-v6.html');   // la pública ya es la v7: se parte de la copia de la v6 que quedó guardada acá
if (s.includes('Kliva web v7')) throw new Error('la base ya es la v7: usar BASE=<copia de la v6>');
const rep = (a, b, n = 1) => { const c = s.split(a).length - 1; if (c !== n) throw new Error(`se esperaba ${n} vez y hay ${c}: ${a.slice(0, 90)}`); s = s.split(a).join(b); };
const entre = (a, b, nuevo) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error(`no está el tramo: ${a.slice(0, 60)} … ${b.slice(0, 60)}`); s = s.slice(0, i) + nuevo + s.slice(j); };

// cabeza: la página sabe que hay guion (lo que aterriza arranca escondido solo si el guion corre; si a los 5 s no corrió, se muestra todo)
rep('<meta name="viewport"', "<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.__klivaOk)document.documentElement.classList.remove('js')},5000)</script>\n<meta name=\"viewport\"");
if (previa) rep('<link rel="canonical" href="https://unitytech.uy/kliva/">', '<meta name="robots" content="noindex">\n<link rel="canonical" href="https://unitytech.uy/kliva/">');
// la página puede vivir en /kliva/ o en /nuevo/kliva/: sus enlaces dejan de ser relativos
rep('<link rel="icon" href="icono.svg">', '<link rel="icon" href="/kliva/icono.svg">');
rep('href="./"', 'href="/kliva/"'); rep('href="beta/"', 'href="/kliva/beta/"', 4); rep('href="privacidad/"', 'href="/kliva/privacidad/"'); rep('href="soporte/"', 'href="/kliva/soporte/"');
// estilos: la historia vieja (la app en una ventana) sale entera y entra la v7
rep('/* Web de Kliva · la identidad de la app (negro, vidrio y el violeta del punto), de noche por defecto.\n   La historia corre sobre la app real en modo cine: cada capítulo le pide una escena a /kliva/beta/. */',
  '/* Kliva web v7 (26/11): una semana en la planta, sobre la maqueta 3D (ver el bloque v7).\n   La identidad de la app (negro, vidrio y el violeta del punto), de noche por defecto. */');
entre('/* la historia */', '/* secciones */', rd('v7.css').trim() + '\n\n');
rep('  .cine .wrap { display: block; }\n', '');
entre('  .stage { top: 64px;', '  .brand { grid-template-columns: 1fr; padding: 18px; }', '');
rep('@media (min-width: 900px) { .cine .chs { order: 0; } .cine .stage { order: 1; } }\n', '');
rep('@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .ch { transition: none; } }', '@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }');
// la historia
entre('<section class="cine" id="historia"', '<section class="blk" id="marcas">', rd('historia.html').trim() + '\n\n');
// lo que aterriza: cabezas de sección y grillas
rep('<div class="head">', '<div class="head" data-a>', 4);
rep('<div class="brands">', '<div class="brands" data-a>'); rep('<div class="cards">', '<div class="cards" data-a>', 2); rep('<div class="faq">', '<div class="faq" data-a>');
if (previa) rep('<footer>', '<p class="vprev" aria-hidden="true">Vista previa · todavía no es la página pública</p>\n<footer>');
// el guion: se revisa antes de armar (no se arma una página rota)
const js = rd('v7.js').trim(); if (!js.endsWith('})();')) throw new Error('v7.js no termina como se espera');
const tmp = join(tmpdir(), `kliva-v7-${process.pid}.js`); writeFileSync(tmp, js); execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
entre('<script>\n(() => {', '</body>', '<script>\n' + js.slice(0, -5) + '  window.__klivaOk=1;\n})();\n</script>\n');
for (const viejo of ['class="stage"', 'id="win"', "frame.src = 'beta/?cine=1'", 'href="beta/"']) if (s.includes(viejo)) throw new Error('quedó algo de la v6: ' + viejo);
mkdirSync(dirname(resolve(SALIDA)), { recursive: true });
writeFileSync(SALIDA + '.tmp', s); renameSync(SALIDA + '.tmp', SALIDA);   // de una: nadie lee la página a medio escribir
console.log('v7 armada en', SALIDA, s.length, 'bytes', previa ? '(vista previa)' : '');
