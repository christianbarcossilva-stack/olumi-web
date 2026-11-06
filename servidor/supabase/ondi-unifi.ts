// Ondi · conexión con UniFi (Site Manager API de Ubiquiti, https://api.ui.com).
// La app nunca ve la clave: la guarda ondi_set_unifi() en la tabla ondi_secretos y solo esta función la lee, del lado del servidor.
// Acciones (POST JSON):
//   { accion: 'probar', org, alcance? }   → prueba la clave guardada ('' = la de la empresa, o el id de un cliente)
//   { accion: 'sitios', org, alcance? }   → lista los sitios UniFi que ve esa clave, para enlazar un cliente
//   { accion: 'equipos', org, site }      → equipos del cliente enlazado (también lo puede pedir el IT del cliente)
// Publicar: Supabase → Edge Functions → Deploy a new function → nombre "ondi-unifi" → pegar este archivo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict: string, legacy: string) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const ANON_KEY = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY') as string;
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY') as string;
const UI = 'https://api.ui.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const STAFF_OUT = ['cliente', 'pendiente'];

// Llama a la API de UniFi. Prueba /v1 y, si no existe, /ea (versión anterior).
async function ui(key: string, path: string, query = '') {
  let last = { status: 0, body: null as any };
  for (const ver of ['v1', 'ea']) {
    const r = await fetch(`${UI}/${ver}/${path}${query}`, { headers: { 'X-API-KEY': key, Accept: 'application/json' } }).catch(() => null);
    if (!r) { last = { status: 0, body: null }; continue; }
    const body = await r.json().catch(() => null);
    last = { status: r.status, body };
    if (r.status !== 404) break;
  }
  if (last.status === 401 || last.status === 403) throw new Error('clave_rechazada');
  if (last.status === 429) throw new Error('muchos_pedidos');
  if (last.status < 200 || last.status >= 300) throw new Error('unifi_' + (last.status || 'sin_conexion'));
  return (last.body && last.body.data) || [];
}

const siteOut = (s: any) => ({
  siteId: s.siteId, hostId: s.hostId,
  nombre: (s.meta && (s.meta.desc || s.meta.name)) || s.siteId,
  zona: s.meta && s.meta.timezone || '',
  equipos: s.statistics?.counts?.totalDevice ?? null,
  caidos: s.statistics?.counts?.offlineDevice ?? null,
  clientesWifi: s.statistics?.counts?.wifiClient ?? null,
  clientesCable: s.statistics?.counts?.wiredClient ?? null,
  isp: s.statistics?.ispInfo?.name || '',
});
const devOut = (d: any) => ({
  id: d.id, nombre: d.name || d.model || d.mac, modelo: d.model || d.shortname || '', linea: d.productLine || '',
  mac: d.mac || '', ip: d.ip || '', estado: d.status || '', version: d.version || '', firmware: d.firmwareStatus || '',
  actualizar: d.updateAvailable || null, consola: !!d.isConsole, desde: d.startupTime || null,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL') as string;
  const userDb = createClient(url, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const { accion, org, alcance, site } = await req.json().catch(() => ({}));
  if (!org || !/^[0-9a-f-]{36}$/i.test(String(org))) return json({ error: 'Falta la empresa.' }, 400);

  const db = createClient(url, SERVICE_KEY);
  const { data: mem } = await db.from('members').select('role').eq('org_id', org).eq('user_id', user.id).maybeSingle();
  const staff = !!mem && !STAFF_OUT.includes(mem.role);

  // ¿qué clave usar?
  const clave = async (scope: string) => {
    const { data } = await db.from('ondi_secretos').select('scope,value').eq('org_id', org).eq('kind', 'unifi').in('scope', scope ? [scope, ''] : ['']);
    const row = (data || []).find((r: any) => r.scope === scope) || (data || []).find((r: any) => r.scope === '');
    return row ? row.value as string : null;
  };

  try {
    if (accion === 'probar' || accion === 'sitios') {
      if (!staff) return json({ error: 'No tenés permiso en esta empresa.' }, 403);
      const sc = String(alcance || '');
      const k = await clave(sc);
      if (!k) return json({ error: 'Todavía no se cargó la clave de UniFi.' }, 400);
      if (accion === 'probar') {
        const hosts = await ui(k, 'hosts');
        const sites = await ui(k, 'sites');
        return json({ ok: true, consolas: hosts.length, sitios: sites.length });
      }
      const sites = await ui(k, 'sites');
      return json({ ok: true, sitios: sites.map(siteOut) });
    }

    if (accion === 'equipos') {
      const sid = String(site || '');
      const { data: s } = await db.from('ondi_sites').select('id,name,data').eq('org_id', org).eq('id', sid).maybeSingle();
      if (!s) return json({ error: 'No existe ese cliente.' }, 404);
      if (!staff) {
        const { data: acc } = await db.from('ondi_accesos').select('user_id').eq('org_id', org).eq('site_id', sid).eq('user_id', user.id).maybeSingle();
        if (!acc) return json({ error: 'No tenés acceso a este cliente.' }, 403);
      }
      const link = (s.data && s.data.unifi) || null;
      if (!link || !link.hostId) return json({ error: 'Este cliente todavía no está enlazado con UniFi.' }, 400);
      const k = await clave(link.propia ? sid : '');
      if (!k) return json({ error: 'Falta la clave de UniFi.' }, 400);
      const [groups, sites] = await Promise.all([ui(k, 'devices', '?hostIds[]=' + encodeURIComponent(link.hostId)), ui(k, 'sites')]);
      const g = groups.find((x: any) => x.hostId === link.hostId) || groups[0] || { devices: [] };
      const st = sites.find((x: any) => x.siteId === link.siteId) || sites.find((x: any) => x.hostId === link.hostId) || null;
      return json({ ok: true, consola: g.hostName || '', actualizado: g.updatedAt || null, sitio: st ? siteOut(st) : null, equipos: (g.devices || []).map(devOut) });
    }
    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    const m = String((e as Error).message || e);
    const txt: Record<string, string> = {
      clave_rechazada: 'UniFi rechazó la clave. Revisá que esté bien copiada y que no la hayan borrado en unifi.ui.com.',
      muchos_pedidos: 'UniFi pidió esperar un poco: probá de nuevo en un minuto.',
    };
    console.error('ondi-unifi', accion, m);
    return json({ error: txt[m] || (m.startsWith('unifi_') ? 'UniFi no respondió (' + m.slice(6) + '). Probá de nuevo.' : 'Algo salió mal.') }, 502);
  }
});
