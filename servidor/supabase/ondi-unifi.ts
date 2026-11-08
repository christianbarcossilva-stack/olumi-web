// Ondi · conexión con las nubes de las marcas: UniFi (Site Manager API, https://api.ui.com) y Cisco Meraki (Dashboard API, https://api.meraki.com).
// Todas las acciones aceptan marca: 'unifi' (si no se manda) o 'meraki'.
// La app nunca ve la clave: la guarda ondi_set_unifi() en la tabla ondi_secretos y solo esta función la lee, del lado del servidor.
// Acciones (POST JSON):
//   { accion: 'probar', org, alcance? }   → prueba la clave guardada ('' = la de la empresa, o el id de un cliente)
//   { accion: 'sitios', org, alcance? }   → lista los sitios UniFi que ve esa clave, para enlazar un cliente
//   { accion: 'equipos', org, site }      → equipos del cliente enlazado (también lo puede pedir el IT del cliente); registra caídas
//   { accion: 'revisar' } + header x-ondi-cron → revisión automática de todos los clientes (cada 5 minutos, desde pg_cron)
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

// Meraki: Dashboard API v1 con la clave en X-Cisco-Meraki-API-Key.
const MK = 'https://api.meraki.com/api/v1';
async function mk(key: string, path: string) {
  const r = await fetch(MK + path, { headers: { 'X-Cisco-Meraki-API-Key': key, Accept: 'application/json' } }).catch(() => null);
  if (!r) throw new Error('unifi_sin_conexion');
  if (r.status === 401 || r.status === 403) throw new Error('clave_rechazada');
  if (r.status === 429) throw new Error('muchos_pedidos');
  if (!r.ok) throw new Error('unifi_' + r.status);
  return await r.json().catch(() => []);
}
async function mkSitios(key: string) {
  const orgs = await mk(key, '/organizations'); const out: any[] = [];
  for (const o of orgs.slice(0, 20)) { const nets = await mk(key, `/organizations/${o.id}/networks?perPage=1000`).catch(() => []);
    for (const n of nets) out.push({ siteId: n.id, hostId: o.id, nombre: `${o.name} · ${n.name}`, zona: n.timeZone || '', equipos: null, caidos: null, isp: (n.productTypes || []).join(', ') }); }
  return { orgs: orgs.length, sitios: out };
}
const mkDev = (d: any) => ({ id: d.serial, nombre: d.name || d.model || d.serial, modelo: d.model || '', linea: d.productType || '', mac: d.mac || '', ip: d.lanIp || d.publicIp || '',
  estado: d.status === 'online' ? 'online' : d.status === 'offline' ? 'offline' : d.status || '', version: '', firmware: '', actualizar: null, consola: d.productType === 'appliance', desde: d.lastReportedAt || null });

// Network de la consola, a través de la nube (necesita una clave con alcance "UniFi Applications" → Network)
async function conn(key: string, hostId: string, path: string) {
  const r = await fetch(`${UI}/v1/connector/consoles/${encodeURIComponent(hostId)}/proxy/network/integration/v1/${path}`, { headers: { 'X-API-KEY': key, Accept: 'application/json' } }).catch(() => null);
  if (!r) throw new Error('sin conexión'); if (!r.ok) throw new Error(String(r.status));
  return await r.json().catch(() => null);
}
const macN = (m: string) => String(m || '').toLowerCase().replace(/[^0-9a-f]/g, '');
const intOut = (d: any) => ({ id: d.id, nombre: d.name || d.model || d.macAddress, modelo: d.model || '', linea: 'network', mac: d.macAddress || '', ip: d.ipAddress || '',
  estado: d.state === 'ONLINE' ? 'online' : d.state === 'OFFLINE' ? 'offline' : String(d.state || '').toLowerCase(), version: d.firmwareVersion || '', firmware: '', actualizar: d.firmwareUpdatable || null, consola: false, desde: null });
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

type Db = ReturnType<typeof createClient>;
const ERR_TXT = (marca: string): Record<string, string> => ({
  clave_rechazada: marca === 'meraki' ? 'Meraki rechazó la clave. Revisá que esté bien copiada y que tenga acceso a la organización.' : 'UniFi rechazó la clave. Revisá que esté bien copiada y que no la hayan borrado en unifi.ui.com.',
  muchos_pedidos: 'UniFi pidió esperar un poco: probá de nuevo en un minuto.',
});
const errTxt = (marca: string, m: string) => ERR_TXT(marca)[m] || (m.startsWith('unifi_') ? 'UniFi no respondió (' + m.slice(6) + '). Probá de nuevo.' : m.startsWith('Falta') || m.startsWith('No encontré') || m.startsWith('Este cliente') ? m : 'Algo salió mal.');

// clave guardada de una empresa ('' = la de la empresa; si no, la propia del cliente)
async function claveDe(db: Db, org: string, marca: string, scope: string) {
  // ojo: .in('scope', ['']) arma "in.()" y no encuentra la clave de la empresa (scope vacío); se traen todas y se elige acá
  const { data, error } = await db.from('ondi_secretos').select('scope,value').eq('org_id', org).eq('kind', marca);
  if (error) throw new Error('No se pudo leer la clave guardada.');
  const row = (data || []).find((r: any) => r.scope === scope) || (data || []).find((r: any) => r.scope === '');
  return row ? row.value as string : null;
}

// lecturas de UniFi que se reusan dentro de una misma revisión (varios clientes con la misma clave)
const memo = (cache: Map<string, Promise<any>>, key: string, f: () => Promise<any>) => { if (!cache.has(key)) cache.set(key, f()); return cache.get(key)!; };

// equipos de un cliente: resuelve el enlace por nombre, toma la clave y trae solo los equipos de su sitio
async function leerEquipos(db: Db, org: string, s: any, marca: string, cache: Map<string, Promise<any>>) {
  let link = (s.data && s.data[marca]) || null;
  if (link && link.porNombre && marca === 'unifi') {
    const k0 = await claveDe(db, org, marca, link.propia ? s.id : '');
    if (!k0) throw new Error('Falta la clave de UniFi.');
    const [hs, ss] = await Promise.all([memo(cache, k0 + '|hosts', () => ui(k0, 'hosts')), memo(cache, k0 + '|sites', () => ui(k0, 'sites'))]);
    const n = String(link.nombre || '').trim().toLowerCase(), hn = (h: any) => String(h.reportedState?.hostname || h.reportedState?.name || h.name || '').toLowerCase();
    const hit = ss.find((x: any) => siteOut(x).nombre.toLowerCase() === n) || ss.find((x: any) => { const h = hs.find((y: any) => y.id === x.hostId); return h && hn(h).includes(n); }) || ss.find((x: any) => siteOut(x).nombre.toLowerCase().includes(n));
    if (!hit) throw new Error(`No encontré un sitio de UniFi llamado "${link.nombre}". Elegilo en la lista de sitios.`);
    link = { hostId: hit.hostId, siteId: hit.siteId, nombre: siteOut(hit).nombre, propia: !!link.propia, at: new Date().toISOString() };
    const { data: cur } = await db.from('ondi_sites').select('data').eq('org_id', org).eq('id', s.id).maybeSingle();
    await db.from('ondi_sites').update({ data: { ...((cur && cur.data) || s.data || {}), [marca]: link } }).eq('org_id', org).eq('id', s.id);
  }
  if (!link || !link.hostId) throw new Error(marca === 'meraki' ? 'Este cliente todavía no está enlazado con Meraki.' : 'Este cliente todavía no está enlazado con UniFi.');
  const k = await claveDe(db, org, marca, link.propia ? s.id : '');
  if (!k) throw new Error(marca === 'meraki' ? 'Falta la clave de Meraki.' : 'Falta la clave de UniFi.');
  if (marca === 'meraki') { const devs = await mk(k, `/organizations/${link.hostId}/devices/statuses?perPage=1000&networkIds[]=${encodeURIComponent(link.siteId)}`);
    return { consola: link.nombre || 'Meraki', actualizado: new Date().toISOString(), sitio: null, equipos: devs.map(mkDev), aviso: '' }; }
  const [groups, sites] = await Promise.all([memo(cache, k + '|dev|' + link.hostId, () => ui(k, 'devices', '?hostIds[]=' + encodeURIComponent(link.hostId))), memo(cache, k + '|sites', () => ui(k, 'sites'))]);
  const g = groups.find((x: any) => x.hostId === link.hostId) || groups[0] || { devices: [] };
  const st = sites.find((x: any) => x.siteId === link.siteId) || sites.find((x: any) => x.hostId === link.hostId) || null;
  // la consola puede tener varios sitios (varios clientes): se dejan solo los equipos de este sitio
  let equipos = (g.devices || []).map(devOut), aviso = '';
  const nSites = sites.filter((x: any) => x.hostId === link.hostId).length;
  if (nSites > 1) {
    try {
      const ns = ((await memo(cache, k + '|nsites|' + link.hostId, () => conn(k, link.hostId, 'sites?limit=200'))) || {}).data || [];
      const ref = st && st.meta ? String(st.meta.name || '') : '', nom = st ? siteOut(st).nombre.toLowerCase() : '';
      const hit = ns.find((x: any) => x.internalReference && x.internalReference === ref) || ns.find((x: any) => String(x.name || '').toLowerCase() === nom);
      if (!hit) throw new Error('no encontré el sitio en la consola');
      const dv = ((await conn(k, link.hostId, `sites/${hit.id}/devices?limit=500`)) || {}).data || [];
      const byMac = new Map(equipos.map((e: any) => [macN(e.mac), e]));
      equipos = dv.map((d: any) => byMac.get(macN(d.macAddress)) || intOut(d));
    } catch (e) { aviso = `La consola tiene ${nSites} sitios y no pude separar los de este (${(e as Error).message}). Se ven todos los equipos de la consola: revisá que la clave tenga también el alcance "UniFi Applications → Network".`; }
  }
  return { consola: g.hostName || '', actualizado: g.updatedAt || null, sitio: st ? siteOut(st) : null, equipos, aviso };
}

const tipoDe = (d: any) => { const t = [d.linea, d.modelo, d.nombre].join(' ').toLowerCase();
  if (/protect|camera|cámara|camara|bullet|dome|domo|turret|\bg[345]\b|^mv\d|nvr/.test(t)) return 'cam';
  if (/usw|switch|^ms\d|flex mini|\bus-?\d/.test(t)) return 'sw';
  if (/udm|uxg|usg|ucg|gateway|dream|^mx\d|router|cloud key/.test(t)) return 'gw';
  if (/\bu[67]\b|uap|\bap\b|mesh|nanohd|access point|^mr\d|wi-?fi/.test(t)) return 'ap';
  return 'otro'; };
const caido = (e: string) => e === 'offline' || e === 'caido';

// registra cada caída una sola vez: abre la alerta al pasar a caído y, si vuelve sola antes de levantar el ticket, la cierra
async function procesar(db: Db, org: string, sid: string, marca: string, equipos: any[]) {
  const now = new Date().toISOString();
  const [{ data: prev }, { data: abiertas }] = await Promise.all([
    db.from('ondi_equipos_estado').select('uid,estado,desde,silenciado').eq('org_id', org).eq('site_id', sid),
    db.from('ondi_alertas').select('id,uid,estado').eq('org_id', org).eq('site_id', sid).in('estado', ['nueva', 'notificada'])]);
  if (prev === null) return; // todavía no se corrió ondi-1.3.sql
  const P = new Map((prev || []).map((p: any) => [p.uid, p])), A = new Map((abiertas || []).map((a: any) => [a.uid, a])), primera = !(prev || []).some((p: any) => p.estado);
  const filas: any[] = [], nuevas: any[] = [], cerrar: number[] = [], volvio: number[] = [];
  for (const d of equipos) {
    const uid = marca + ':' + (d.mac || d.id), off = caido(d.estado), p: any = P.get(uid), a: any = A.get(uid), est = off ? 'offline' : (d.estado || 'online');
    filas.push({ org_id: org, site_id: sid, uid, nombre: d.nombre, tipo: tipoDe(d), modelo: d.modelo || '', ip: d.ip || '', estado: est, desde: p && p.estado === est ? p.desde : now, visto: now, silenciado: p ? !!p.silenciado : false });
    if (off && !a && !(p && p.silenciado) && (!p || !caido(p.estado))) nuevas.push({ org_id: org, site_id: sid, uid, equipo: d.nombre || uid, tipo: tipoDe(d), modelo: d.modelo || '', ip: d.ip || '',
      desde: now, avisada: primera ? now : null, avisos: primera ? [{ at: now, nota: 'Ya estaba caído cuando empezó el monitoreo: no se avisó.' }] : [] });
    if (!off && a) { if (a.estado === 'nueva') cerrar.push(a.id); else volvio.push(a.id); }
  }
  if (filas.length) await db.from('ondi_equipos_estado').upsert(filas, { onConflict: 'org_id,site_id,uid' });
  for (const n of nuevas) await db.from('ondi_alertas').insert(n); // si ya hay una abierta, el índice único la frena
  if (cerrar.length) await db.from('ondi_alertas').update({ estado: 'cerrada', cerrada: now, volvio: now, nota: 'Volvió solo', actualizado: now }).in('id', cerrar);
  if (volvio.length) await db.from('ondi_alertas').update({ volvio: now, actualizado: now }).in('id', volvio).is('volvio', null);
  const res = { total: equipos.length, caidos: equipos.filter((d: any) => caido(d.estado)).length, at: now };
  await db.rpc('ondi_set_resumen', { o: org, s: sid, res });
  return { nuevas: nuevas.length, cerradas: cerrar.length };
}

// avisos por email y WhatsApp: se mandan a n8n (webhook guardado en ondi_config, clave 'webhook_avisos'), que reparte
async function avisarPendientes(db: Db) {
  const { data: cfg } = await db.from('ondi_config').select('k,v').in('k', ['webhook_avisos']);
  const hook = ((cfg || []).find((r: any) => r.k === 'webhook_avisos') || {}).v || '';
  const { data: pend } = await db.from('ondi_alertas').select('id,org_id,site_id,equipo,modelo,ip,desde,avisos').in('estado', ['nueva', 'notificada']).is('avisada', null).limit(200);
  let n = 0;
  for (const a of pend || []) {
    const { data: aj } = await db.from('ondi_ajustes').select('data').eq('org_id', a.org_id).maybeSingle();
    const av = (aj && aj.data && aj.data.avisos) || {}, ev = av.eventos || { caido: true }, espera = Number(av.espera || 5);
    if (Date.now() - new Date(a.desde).getTime() < espera * 60000) continue;
    const now = new Date().toISOString();
    if (ev.caido === false) { await db.from('ondi_alertas').update({ avisada: now, avisos: [...(a.avisos || []), { at: now, nota: 'Los avisos de caídas están apagados.' }] }).eq('id', a.id); continue; }
    const [{ data: s }, { data: cts }] = await Promise.all([db.from('ondi_sites').select('name').eq('org_id', a.org_id).eq('id', a.site_id).maybeSingle(),
      db.from('ondi_contactos').select('nombre,email,whatsapp').eq('org_id', a.org_id).eq('site_id', a.site_id).eq('avisar', true)]);
    const emails = [...new Set([...(av.emails || []), ...(cts || []).map((c: any) => c.email).filter(Boolean)])];
    const whatsapp = [...new Set([...(av.whatsapp || []), ...(cts || []).map((c: any) => String(c.whatsapp || '').replace(/\D/g, '')).filter(Boolean)])];
    const cliente = s ? s.name : a.site_id, texto = `Ondi · ${cliente}: ${a.equipo}${a.modelo ? ' (' + a.modelo + ')' : ''} está caído desde las ${new Date(a.desde).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Montevideo' })}.`;
    let reg: any = { at: now, emails: emails.length, whatsapp: whatsapp.length };
    if (!emails.length && !whatsapp.length) reg.nota = 'No hay a quién avisar: cargá contactos en el cliente o en Ajustes → Avisos.';
    else if (!hook) reg.nota = 'El envío por email y WhatsApp todavía no está conectado (falta el flujo de n8n).';
    else { const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'caido', cliente, equipo: a.equipo, modelo: a.modelo, ip: a.ip, desde: a.desde, texto, emails, whatsapp, alerta: a.id }) }).catch(() => null);
      reg.ok = !!(r && r.ok); if (!reg.ok) reg.nota = 'n8n no respondió.'; }
    await db.from('ondi_alertas').update({ avisada: now, avisos: [...(a.avisos || []), reg] }).eq('id', a.id); n++;
  }
  return n;
}

// revisión automática: todos los clientes enlazados de todas las empresas
async function revisar(db: Db) {
  const t0 = Date.now(), cache = new Map<string, Promise<any>>();
  const { data: sites } = await db.from('ondi_sites').select('id,org_id,name,data');
  let clientes = 0, nuevas = 0, cerradas = 0; const errores: string[] = [];
  for (const s of sites || []) for (const marca of ['unifi', 'meraki']) {
    if (!(s.data && s.data[marca] && s.data[marca].hostId)) continue;
    if (Date.now() - t0 > 50000) { errores.push('Se cortó por tiempo: quedan clientes para la próxima vuelta.'); break; }
    try { const r = await leerEquipos(db, s.org_id, s, marca, cache); const p = await procesar(db, s.org_id, s.id, marca, r.equipos); clientes++; if (p) { nuevas += p.nuevas; cerradas += p.cerradas; } }
    catch (e) { errores.push(`${s.name}: ${errTxt(marca, String((e as Error).message || e))}`); }
  }
  const avisos = await avisarPendientes(db).catch(() => 0);
  return { ok: true, clientes, nuevas, cerradas, avisos, errores, ms: Date.now() - t0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL') as string;
  const body = await req.json().catch(() => ({}));
  const db = createClient(url, SERVICE_KEY);

  // revisión automática (pg_cron): no hay usuario, se valida con la clave interna guardada en ondi_config
  if (body.accion === 'revisar') {
    const { data: c } = await db.from('ondi_config').select('v').eq('k', 'cron').maybeSingle();
    if (!c || !c.v || req.headers.get('x-ondi-cron') !== c.v) return json({ error: 'No autorizado.' }, 401);
    return json(await revisar(db));
  }

  const userDb = createClient(url, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const { accion, org, alcance, site, marca: mq } = body;
  const marca = mq === 'meraki' ? 'meraki' : 'unifi';
  if (!org || !/^[0-9a-f-]{36}$/i.test(String(org))) return json({ error: 'Falta la empresa.' }, 400);

  const { data: mem } = await db.from('members').select('role').eq('org_id', org).eq('user_id', user.id).maybeSingle();
  const staff = !!mem && !STAFF_OUT.includes(mem.role);
  const clave = (scope: string) => claveDe(db, org, marca, scope);

  try {
    if (accion === 'probar' || accion === 'sitios') {
      if (!staff) return json({ error: 'No tenés permiso en esta empresa.' }, 403);
      const sc = String(alcance || '');
      const k = await clave(sc);
      if (!k) return json({ error: marca === 'meraki' ? 'Todavía no se cargó la clave de Meraki.' : 'Todavía no se cargó la clave de UniFi.' }, 400);
      if (marca === 'meraki') { const r = await mkSitios(k); return accion === 'probar' ? json({ ok: true, consolas: r.orgs, sitios: r.sitios.length }) : json({ ok: true, sitios: r.sitios }); }
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
      const r = await leerEquipos(db, org, s, marca, new Map());
      await procesar(db, org, sid, marca, r.equipos).catch(() => null);
      return json({ ok: true, ...r });
    }
    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    const m = String((e as Error).message || e);
    console.error('ondi-unifi', accion, m);
    const st = m.startsWith('Falta') || m.startsWith('Este cliente') ? 400 : m.startsWith('No encontré') ? 404 : 502;
    return json({ error: errTxt(marca, m) }, st);
  }
});
