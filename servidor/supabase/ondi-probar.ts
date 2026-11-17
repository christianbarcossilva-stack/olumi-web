// Ondi · probar conexión desde afuera: el servidor intenta abrir los puertos de un equipo con IP pública o DDNS y mide cuánto tarda.
// Solo para la instaladora (miembros de la empresa que no son del cliente). Las IP privadas (10.x, 172.16-31.x, 192.168.x…) no se prueban
// desde acá: esas las ve el Agente Ondi en la red del cliente.
// Publicar: Supabase → Edge Functions → «ondi-probar» → pegar este archivo (verify_jwt desactivado: valida la sesión adentro).
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict: string, legacy: string) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const ANON_KEY = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY') as string;
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY') as string;
const STAFF_OUT = ['cliente', 'pendiente'];
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// direcciones que no se prueban desde el servidor (red privada, propia o reservada)
function privada(ip: string) {
  if (ip.includes(':')) { const l = ip.toLowerCase(); return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l === '::'; }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
async function abrir(ip: string, port: number, ms = 3000) {
  const t0 = performance.now();
  try {
    const c = await Promise.race([Deno.connect({ hostname: ip, port }), new Promise<never>((_, no) => setTimeout(() => no(new Error('tiempo')), ms))]);
    const d = Math.round(performance.now() - t0); try { (c as Deno.Conn).close(); } catch (_) { /* nada */ }
    return { puerto: port, abierto: true, ms: d };
  } catch (e) { const m = String((e as Error).message || e); return { puerto: port, abierto: false, motivo: m === 'tiempo' ? 'no responde' : /refused/i.test(m) ? 'rechazado' : 'no responde' }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL') as string;
  const body = await req.json().catch(() => ({}));
  const userDb = createClient(url, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const { org } = body;
  if (!org || !/^[0-9a-f-]{36}$/i.test(String(org))) return json({ error: 'Falta la empresa.' }, 400);
  const db = createClient(url, SERVICE_KEY);
  const { data: mem } = await db.from('members').select('role').eq('org_id', org).eq('user_id', user.id).maybeSingle();
  if (!mem || STAFF_OUT.includes(mem.role)) return json({ error: 'Solo la instaladora puede probar equipos.' }, 403);

  const host = String(body.host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return json({ error: 'Escribí una IP pública o un nombre (DDNS), por ejemplo cliente.ddns.net.' }, 400);
  const puertos = [...new Set((Array.isArray(body.puertos) ? body.puertos : [80, 443]).map(Number).filter((p: number) => p > 0 && p < 65536))].slice(0, 6) as number[];
  if (!puertos.length) return json({ error: 'Elegí al menos un puerto.' }, 400);

  let ips: string[] = [];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) ips = [host];
  else { try { ips = await Deno.resolveDns(host, 'A'); } catch (_) { return json({ host, error: 'Ese nombre no existe o no tiene dirección (revisá el DDNS).' }); } }
  if (!ips.length) return json({ host, error: 'Ese nombre no tiene dirección.' });
  const ip = ips[0];
  if (privada(ip)) return json({ host, ip, privada: true, error: 'Es una IP privada: solo se ve desde adentro de la red del cliente, con el Agente Ondi.' });
  const t0 = Date.now();
  const res = await Promise.all(puertos.map(p => abrir(ip, p)));
  return json({ host, ip, resultados: res, abiertos: res.filter(r => r.abierto).length, cuando: new Date(t0).toISOString() });
});
