// Ondi · integrador: el programa que corre en una máquina virtual del cliente (ondi/integrador) habla solo con esta función.
// No usa cuentas de Supabase: se enlaza una vez con un código de un solo uso y después se identifica con su token
// (acá se guarda solo el sha256). Sin "Verify JWT". Acciones (POST JSON):
//   { accion: 'enlazar', codigo }                    → { token, id, cliente }  (el código lo crea ondi_integrador_codigo())
//   { accion: 'config' }   + Authorization: Bearer   → equipos cargados a mano con IP, cada cuánto revisar
//   { accion: 'reporte', estados, cola } + Bearer    → estado de cada equipo; abre y cierra alertas como ondi-unifi
// Publicar: Supabase → Edge Functions → nombre "ondi-integrador", con Verify JWT apagado.
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict: string, legacy: string) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const db = createClient(Deno.env.get('SUPABASE_URL') as string, pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY') as string);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha = async (t: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
const txt = (v: unknown, n = 120) => String(v ?? '').slice(0, n);
const fecha = (v: unknown, def: string) => { const t = Date.parse(String(v || '')); return t && t <= Date.now() + 60e3 && t > Date.now() - 2 * 864e5 ? new Date(t).toISOString() : def; };

async function equiposDe(o: string, s: string) {
  const { data } = await db.from('ondi_equipos').select('id,nombre,tipo,modelo,ip,puerto').eq('org_id', o).eq('site_id', s).not('ip', 'is', null).neq('ip', '').order('id');
  return data || [];
}
const firma = async (eqs: any[]) => (await sha(JSON.stringify(eqs.map((e) => [e.id, e.ip, e.puerto || 0])))).slice(0, 16);

// la misma regla que ondi-unifi: cada caída abre una sola alerta; si vuelve antes del ticket, se cierra sola
async function procesar(o: string, s: string, eqs: any[], estados: Map<string, any>) {
  const now = new Date().toISOString();
  const [{ data: prev }, { data: abiertas }] = await Promise.all([
    db.from('ondi_equipos_estado').select('uid,estado,desde,silenciado').eq('org_id', o).eq('site_id', s).like('uid', 'man:%'),
    db.from('ondi_alertas').select('id,uid,estado').eq('org_id', o).eq('site_id', s).like('uid', 'man:%').in('estado', ['nueva', 'notificada'])]);
  const P = new Map((prev || []).map((p: any) => [p.uid, p])), A = new Map((abiertas || []).map((a: any) => [a.uid, a])), primera = !(prev || []).length;
  const filas: any[] = [], nuevas: any[] = [], cerrar: number[] = [], volvio: number[] = [], on: string[] = [], off: string[] = [];
  for (const e of eqs) {
    const r = estados.get(e.id); if (!r) continue;
    const uid = 'man:' + e.id, est = r.ok ? 'online' : 'offline', p: any = P.get(uid), a: any = A.get(uid), desde = p && p.estado === est ? p.desde : fecha(r.desde, now);
    (r.ok ? on : off).push(e.id);
    filas.push({ org_id: o, site_id: s, uid, nombre: e.nombre, tipo: e.tipo, modelo: e.modelo || '', ip: e.ip, estado: est, desde, visto: now, silenciado: p ? !!p.silenciado : false });
    if (!r.ok && !a && !(p && p.silenciado) && !(p && p.estado === 'offline')) nuevas.push({ org_id: o, site_id: s, uid, equipo: e.nombre || e.ip, tipo: e.tipo, modelo: e.modelo || '', ip: e.ip,
      desde, avisada: primera ? now : null, avisos: primera ? [{ at: now, nota: 'Ya estaba caído cuando empezó el monitoreo: no se avisó.' }] : [] });
    if (r.ok && a) (a.estado === 'nueva' ? cerrar : volvio).push(a.id);
  }
  if (filas.length) await db.from('ondi_equipos_estado').upsert(filas, { onConflict: 'org_id,site_id,uid' });
  for (const n of nuevas) await db.from('ondi_alertas').insert(n); // si ya hay una abierta, el índice único la frena
  if (cerrar.length) await db.from('ondi_alertas').update({ estado: 'cerrada', cerrada: now, volvio: now, nota: 'Volvió solo', actualizado: now }).in('id', cerrar);
  if (volvio.length) await db.from('ondi_alertas').update({ volvio: now, actualizado: now }).in('id', volvio).is('volvio', null);
  if (on.length) await db.from('ondi_equipos').update({ estado: 'online', visto: now }).eq('org_id', o).eq('site_id', s).in('id', on);
  if (off.length) await db.from('ondi_equipos').update({ estado: 'offline' }).eq('org_id', o).eq('site_id', s).in('id', off);
  return { revisados: on.length + off.length, caidos: off.length };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usá POST.' }, 405);
  const b = await req.json().catch(() => ({}));
  const quien = { host: txt(b.host, 80), so: txt(b.so, 120), version: txt(b.version, 20), ip: txt(b.ip, 45) };
  try {
    if (b.accion === 'enlazar') {
      const code = txt(b.codigo, 9).toUpperCase();
      const { data: c } = await db.from('ondi_integrador_codigos').select('*').eq('code', code).gt('creado', new Date(Date.now() - 864e5).toISOString()).maybeSingle();
      if (!c) { await new Promise((r) => setTimeout(r, 800)); return json({ error: 'Ese código no existe o ya venció. Pedí uno nuevo en Ondi: Cliente → Integraciones.' }, 400); }
      const { data: s } = await db.from('ondi_sites').select('name').eq('org_id', c.org_id).eq('id', c.site_id).maybeSingle();
      const { data: act } = await db.from('ondi_integradores').select('id').eq('org_id', c.org_id).eq('site_id', c.site_id).eq('estado', 'activo').maybeSingle();
      if (act && act.id !== c.reemplaza) return json({ error: 'Este cliente ya tiene un integrador. En Ondi tocá «Pasar a otra máquina» para cambiarlo por este.' }, 409);
      if (act) {
        await db.from('ondi_integradores').update({ estado: 'reemplazado' }).eq('id', act.id);
        await db.from('ondi_alertas').update({ estado: 'cerrada', cerrada: new Date().toISOString(), nota: 'Se pasó el integrador a otra máquina', actualizado: new Date().toISOString() }).eq('org_id', c.org_id).eq('site_id', c.site_id).eq('uid', 'int:' + act.id).in('estado', ['nueva', 'notificada']);
      }
      const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/[+/=]/g, (x) => ({ '+': '-', '/': '_', '=': '' } as any)[x]);
      const { data: n, error } = await db.from('ondi_integradores').insert({ org_id: c.org_id, site_id: c.site_id, token_hash: await sha(token), reemplaza: c.reemplaza, por: c.por, ...quien }).select('id').single();
      if (error) throw error;
      await db.from('ondi_integrador_codigos').delete().eq('code', code);
      return json({ token, id: n.id, cliente: s ? s.name : c.site_id });
    }

    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (tok.length < 30) return json({ error: 'Falta el enlace.' }, 401);
    const { data: it } = await db.from('ondi_integradores').select('*').eq('token_hash', await sha(tok)).maybeSingle();
    if (!it || it.estado !== 'activo') return json({ error: it ? 'Este integrador fue dado de baja o pasado a otra máquina.' : 'Enlace desconocido.' }, it ? 410 : 401);
    const eqs = await equiposDe(it.org_id, it.site_id), cfg = await firma(eqs), now = new Date().toISOString();

    if (b.accion === 'config') {
      await db.from('ondi_integradores').update({ visto: now, ...quien }).eq('id', it.id);
      return json({ equipos: eqs.map((e: any) => ({ id: e.id, nombre: e.nombre, ip: e.ip, puerto: e.puerto || 0 })), intervalo: 60, cfg });
    }

    if (b.accion === 'reporte') {
      const est = new Map((Array.isArray(b.estados) ? b.estados.slice(0, 3000) : []).filter((x: any) => x && typeof x.id === 'string').map((x: any) => [x.id, { ok: !!x.ok, desde: x.desde }]));
      const r = await procesar(it.org_id, it.site_id, eqs, est);
      const cola = Array.isArray(b.cola) ? b.cola : [];
      const reporte: any = { at: now, ...r };
      if (cola.length) reporte.sinInternet = { desde: fecha(cola[0].at, now), hasta: fecha(cola[cola.length - 1].at, now), reportes: cola.length };
      else if (it.reporte && it.reporte.sinInternet) reporte.sinInternet = it.reporte.sinInternet; // queda a la vista hasta el próximo corte
      await db.from('ondi_integradores').update({ visto: now, reporte, ...quien }).eq('id', it.id);
      const { data: a } = await db.from('ondi_alertas').select('id,estado').eq('org_id', it.org_id).eq('site_id', it.site_id).eq('uid', 'int:' + it.id).in('estado', ['nueva', 'notificada']).maybeSingle();
      if (a) await db.from('ondi_alertas').update(a.estado === 'nueva' ? { estado: 'cerrada', cerrada: now, volvio: now, nota: 'El integrador volvió a reportar', actualizado: now } : { volvio: now, actualizado: now }).eq('id', a.id);
      const { data: s } = await db.from('ondi_sites').select('data').eq('org_id', it.org_id).eq('id', it.site_id).maybeSingle();
      const d = (s && s.data) || {};
      if (!(d.unifi && d.unifi.hostId) && !(d.meraki && d.meraki.hostId)) await db.rpc('ondi_set_resumen', { o: it.org_id, s: it.site_id, res: { total: r.revisados, caidos: r.caidos, at: now } });
      return json({ ok: true, cfg });
    }
    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    console.error('ondi-integrador', b.accion, String((e as Error).message || e));
    return json({ error: 'Ondi no pudo procesarlo. Se reintenta solo.' }, 500);
  }
});
