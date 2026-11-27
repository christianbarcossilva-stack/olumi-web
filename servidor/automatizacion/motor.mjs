// Motor de automatización de Unity Tech (reemplazo de n8n). Sin dependencias: Node 22.
// Cada flujo es una receta (recetas/*.mjs) con pasos. Un paso devuelve el siguiente ({ paso, datos, esperar }) o null para terminar.
// Los pasos se guardan en una cola durable: si el motor se reinicia en medio de una espera, sigue donde estaba.
// Multiempresa: cada flujo es de una org, con sus ajustes, sus claves y su tope de gasto; una empresa no frena a las otras.
import { createServer } from 'node:http';
import { readdirSync } from 'node:fs';
import { piezas } from './piezas.mjs';

const REINTENTOS = [30e3, 120e3, 600e3];   // 30 s, 2 min, 10 min; después queda en error

export async function cargarRecetas(dir = new URL('./recetas/', import.meta.url)) {
  const R = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) R[f.slice(0, -4)] = (await import(new URL(f, dir))).default;
  return R;
}

export function crearMotor({ almacen, recetas, porEmpresa = 3, ahora = Date.now, red = fetch, log = console.log }) {
  // Lo que ve un paso: datos, ajustes de la empresa, sus claves, memoria del flujo y las piezas (IA, WhatsApp, Olumi).
  async function contexto(flujo) {
    const claves = await almacen.claves(flujo.org_id), sombra = flujo.modo !== 'real';
    const ctx = {
      org: flujo.org_id, flujo: flujo.id, ajustes: flujo.ajustes || {}, sombra, ahora, gasto: 0, efectos: [],
      clave: (n) => { if (!claves[n]) throw new Error(`falta la clave "${n}" de esta empresa`); return claves[n]; },
      leer: async (k, def) => (await almacen.leer(flujo.id, k)) ?? def,
      guardar: (k, v) => almacen.guardar(flujo.id, k, v),
      // Todo lo que cambia algo afuera (mandar un WhatsApp, crear un ticket) pasa por acá: en modo sombra se anota y no se hace.
      efecto: async (nombre, hacer, simulado = {}, detalle) => { ctx.efectos.push(detalle ? { nombre, ...detalle } : nombre); return sombra ? { ...simulado, _sombra: true } : hacer(); },
      sumarGasto: async (usd) => { ctx.gasto += usd; return almacen.sumarGasto(flujo.org_id, usd); },
    };
    ctx.p = piezas(ctx, red);
    return ctx;
  }

  async function correr(t) {
    const t0 = ahora(), flujo = await almacen.flujo(t.flujo_id), receta = flujo && recetas[flujo.receta];
    if (!flujo?.prendido || !receta?.pasos?.[t.paso]) return almacen.cerrar(t.id, 'listo', flujo?.prendido ? 'paso desconocido' : 'flujo apagado');
    let ctx;
    try {
      ctx = await contexto(flujo);
      const sig = await receta.pasos[t.paso](ctx, t.datos);
      if (sig) await almacen.encolar({ flujo: flujo.id, org: flujo.org_id, paso: sig.paso, datos: sig.datos ?? t.datos, en: ahora() + (sig.esperar || 0) * 1000 });
      await almacen.cerrar(t.id, 'listo');
      await almacen.registrar({ flujo_id: flujo.id, org_id: flujo.org_id, trabajo_id: t.id, paso: t.paso, estado: sig ? 'ok' : 'fin', ms: ahora() - t0, gasto_usd: ctx.gasto, detalle: { siguiente: sig?.paso || null, efectos: ctx.efectos, sombra: ctx.sombra } });
    } catch (e) {
      const espera = REINTENTOS[t.intentos - 1], msg = String(e?.message || e).slice(0, 500);
      if (espera !== undefined && !e?.sinReintento) await almacen.reintentar(t.id, ahora() + espera, msg); else await almacen.cerrar(t.id, 'error', msg);
      await almacen.registrar({ flujo_id: flujo.id, org_id: flujo.org_id, trabajo_id: t.id, paso: t.paso, estado: 'error', ms: ahora() - t0, gasto_usd: ctx?.gasto || 0, detalle: { error: msg, intento: t.intentos } });
      log(`[${flujo.receta}/${t.paso}] error (intento ${t.intentos}): ${msg}`);
    }
  }

  // Una vuelta de la cola: toma lo vencido y lo corre en paralelo (con el tope por empresa que pone almacen.tomar).
  const vuelta = async (n = 10) => { const ts = await almacen.tomar(n, porEmpresa); await Promise.all(ts.map(correr)); return ts.length; };

  // Entrada de un webhook: la receta decide si le interesa y con qué paso empieza. Se contesta enseguida.
  async function webhook(token, cuerpo) {
    const flujo = await almacen.flujoPorToken(token), receta = flujo && recetas[flujo.receta];
    if (!receta?.webhook) return { status: 404 };
    const inicio = receta.webhook(cuerpo, flujo.ajustes || {}, ahora());
    if (inicio) await almacen.encolar({ flujo: flujo.id, org: flujo.org_id, paso: inicio.paso, datos: inicio.datos, en: ahora() });
    return { status: 200, tomado: !!inicio };
  }

  return { vuelta, webhook, correr };
}

// Arranque en el servidor: node motor.mjs   ·   guardar una clave: echo -n 'valor' | node motor.mjs clave <org> <nombre>
if (import.meta.url === `file://${process.argv[1]}`) {
  const { supabase } = await import('./almacen.mjs');
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, MOTOR_LLAVE, PUERTO = 8080 } = process.env;
  const llave = Buffer.from(MOTOR_LLAVE || '', 'hex');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || llave.length !== 32) { console.error('Faltan SUPABASE_URL, SUPABASE_SERVICE_KEY o MOTOR_LLAVE (64 letras hex).'); process.exit(1); }
  const almacen = supabase(SUPABASE_URL, SUPABASE_SERVICE_KEY, llave);

  if (process.argv[2] === 'clave') {
    const [, , , org, nombre] = process.argv; let v = ''; for await (const c of process.stdin) v += c;
    await almacen.ponerClave(org, nombre, v.trim()); console.log(`Clave "${nombre}" guardada (cifrada).`); process.exit(0);
  }

  const motor = crearMotor({ almacen, recetas: await cargarRecetas() });
  let corriendo = true, ultimaLimpieza = 0, ultimoLatido = 0;
  const VERSION = '0.1.0';
  createServer(async (req, res) => {
    const m = req.url.match(/^\/h\/([a-f0-9]{32})$/);
    if (req.method === 'GET' && req.url === '/salud') return res.end('ok');
    if (req.method !== 'POST' || !m) { res.statusCode = 404; return res.end(); }
    const partes = []; let tam = 0;
    for await (const c of req) { if ((tam += c.length) > 25e6) { res.statusCode = 413; return res.end(); } partes.push(c); }
    try { const r = await motor.webhook(m[1], JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); res.statusCode = r.status; res.end(r.status === 200 ? 'ok' : ''); }
    catch (e) { console.error('webhook:', e.message); res.statusCode = 500; res.end(); }
  }).listen(PUERTO, () => console.log(`Motor escuchando en ${PUERTO}`));
  process.on('SIGTERM', () => (corriendo = false));
  while (corriendo) {
    try {
      const n = await motor.vuelta();
      if (Date.now() - ultimoLatido > 30e3) { ultimoLatido = Date.now(); await almacen.latido(VERSION); }   // el panel muestra si el motor está en línea
      if (Date.now() - ultimaLimpieza > 36e5) { ultimaLimpieza = Date.now(); await almacen.limpiar(); }
      if (!n) await new Promise((r) => setTimeout(r, 2000));
    } catch (e) { console.error('cola:', e.message); await new Promise((r) => setTimeout(r, 5000)); }
  }
  process.exit(0);
}
