// Olumi · el calendario de cada persona, para leer desde el calendario del teléfono (iPhone, Google Calendar, Outlook).
// Dirección: https://<proyecto>.supabase.co/functions/v1/agenda?t=<llave>
// La llave es larga y propia de cada persona (tabla cal_tokens): quien la tiene puede LEER ese calendario y nada más.
// Al publicar: apagar "Verify JWT" (el calendario del teléfono no manda sesión; la función revisa la llave).
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const APP = 'https://unitytech.uy/olumi/app/';
const nada = () => new Response('No encontrado', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

const p2 = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
// renglones de hasta 75 bytes, como pide el formato
const enc = new TextEncoder();
const fold = (l) => { const out = []; let cur = '', n = 0; for (const ch of l) { const b = enc.encode(ch).length; if (n + b > 73) { out.push(cur); cur = ' '; n = 1; } cur += ch; n += b; } out.push(cur); return out.join('\r\n'); };
const dia = (f) => f.replace(/-/g, '');
const masDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// hora "de pared" (sin zona): el teléfono la muestra tal cual, a la misma hora que en Olumi
const pared = (f, hm, masMin = 0) => { const [h, m] = hm.split(':').map(Number); const d = new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10), h, m + masMin)); return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00`; };
const okF = (f) => /^\d{4}-\d{2}-\d{2}/.test(f || ''), okH = (h) => /^\d{1,2}:\d{2}/.test(h || '');

Deno.serve(async (req) => {
  try {
    const t = (new URL(req.url).searchParams.get('t') || '').trim();
    if (!/^[A-Za-z0-9_-]{32,80}$/.test(t)) return nada();
    const db = createClient(Deno.env.get('SUPABASE_URL'), SERVICE_KEY, { auth: { persistSession: false } });
    const tk = await db.from('cal_tokens').select('user_id,org_id,alcance').eq('token', t).maybeSingle();
    if (!tk.data) return nada();
    const uid = tk.data.user_id, org = tk.data.org_id;
    const mb = await db.from('members').select('role').eq('org_id', org).eq('user_id', uid).maybeSingle();
    if (!mb.data) return nada();                                   // ya no es de la empresa: la dirección deja de andar
    const equipo = tk.data.alcance === 'equipo' && ['owner', 'admin', 'encargado'].includes(mb.data.role);
    const og = await db.from('orgs').select('name').eq('id', org).maybeSingle();

    const hoy = new Date().toISOString().slice(0, 10), desde = masDias(hoy, -60), hasta = masDias(hoy, 400);
    const leer = async (col, desdeFecha) => {
      const out = [];
      for (let i = 0; i < 20000; i += 1000) {
        let q = db.from('docs').select('id,data').eq('org_id', org).eq('col', col);
        if (desdeFecha) q = q.gte('data->>fecha', desdeFecha);
        const r = await q.order('id').range(i, i + 999);
        if (r.error) throw r.error;
        out.push(...r.data); if (r.data.length < 1000) break;
      }
      return out;
    };
    const [trab, act, ev] = await Promise.all([leer('trabajos', desde), leer('actividades', desde), leer('eventos', null)]);

    const mios = trab.filter((r) => okF(r.data.fecha) && r.data.fecha <= hasta && (equipo || (r.data.tecnicos || []).includes(uid)));
    // nombres de los clientes de esos trabajos
    const ids = [...new Set(mios.map((r) => r.data.clienteId).filter(Boolean))], cli = {};
    for (let i = 0; i < ids.length; i += 150) {
      const r = await db.from('docs').select('id,data').eq('org_id', org).eq('col', 'clientes').in('id', ids.slice(i, i + 150));
      (r.data || []).forEach((c) => { cli[c.id] = c.data || {}; });
    }

    const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Unity Tech//Olumi//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + esc('Olumi' + (og.data?.name ? ' · ' + og.data.name : '')), 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M'];
    const pone = (uidEv, tit, f, hm, horas, o: { fin?: string; lugar?: string; nota?: string; tent?: boolean; hecho?: boolean } = {}) => {
      L.push('BEGIN:VEVENT', 'UID:' + uidEv + '@olumi.unitytech.uy', 'DTSTAMP:' + sello);
      if (okH(hm)) { const min = Math.max(15, Math.round((Number(horas) || 1) * 60)); L.push('DTSTART:' + pared(f, hm), 'DTEND:' + pared(f, hm, min)); }
      else { const fin = o.fin && o.fin > f ? o.fin : f; L.push('DTSTART;VALUE=DATE:' + dia(f), 'DTEND;VALUE=DATE:' + dia(masDias(fin, 1))); }
      L.push('SUMMARY:' + esc((o.tent ? 'Tentativo: ' : '') + (o.hecho ? '✓ ' : '') + tit));
      if (o.lugar) L.push('LOCATION:' + esc(o.lugar));
      if (o.nota) L.push('DESCRIPTION:' + esc(o.nota));
      if (o.tent) L.push('STATUS:TENTATIVE');
      L.push('END:VEVENT');
    };
    for (const r of mios) {
      const j = r.data, c = cli[j.clienteId] || {};
      const tit = [c.nombre || j.clienteNombre, j.titulo].filter(Boolean).join(' · ') || 'Trabajo';
      pone('trab-' + r.id, tit, j.fecha.slice(0, 10), j.hora || '', j.duracion, { lugar: j.obra || c.direccion || '', nota: [j.notas, 'Abrir en Olumi: ' + APP].filter(Boolean).join('\n\n'), tent: !!j.tentativo, hecho: j.estado === 'terminado' });
    }
    for (const r of act) {
      const a = r.data; if (a.hecha || !okF(a.fecha) || a.fecha.slice(0, 10) > hasta || !(equipo || a.responsable === uid)) continue;
      pone('act-' + r.id, a.titulo || 'Seguimiento', a.fecha.slice(0, 10), a.fecha.slice(11, 16), a.duracion || 0.5, { nota: 'Seguimiento de Olumi' });
    }
    for (const r of ev) {
      const e = r.data; if (!okF(e.fecha)) continue;
      const fin = e.hasta && e.hasta > e.fecha ? e.hasta : e.fecha; if (fin < desde || e.fecha > hasta) continue;
      if (e.origen === 'google') continue;                          // lo que vino de Google ya está en el calendario del teléfono: no se repite
      if (e.privado ? e.de !== uid : !(equipo || e.de === uid || !e.de)) continue;
      pone('ev-' + r.id, e.titulo || 'Evento', e.fecha, e.hora || '', e.duracion, { fin, lugar: e.lugar || '', nota: e.notas || '', tent: !!e.tentativo });
    }
    L.push('END:VCALENDAR');
    db.from('cal_tokens').update({ usado: new Date().toISOString() }).eq('token', t).then(() => {}, () => {});
    return new Response(L.map(fold).join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline; filename="olumi.ics"' } });
  } catch (_) {
    return new Response('No se pudo armar el calendario', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
});
