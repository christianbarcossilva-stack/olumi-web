// Olumi · quitar la doble verificación a una persona que perdió el teléfono.
// Lo pide el dueño o un administrador de la empresa desde Ajustes → Seguridad.
// POST {org, user} con la sesión de quien pide (Authorization: Bearer ...). "Verify JWT" queda PRENDIDO.
// Reglas: quien pide es owner/admin de esa empresa (no soporte), la persona es de la misma empresa y no es la misma,
// y un administrador no se la puede quitar al dueño. Si quien pide tiene doble verificación, su sesión tiene que estar verificada (aal2).
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const ORIGENES = ['https://unitytech.uy', 'capacitor://localhost'];   // la web y la app del iPhone
let CORS = { 'Access-Control-Allow-Origin': ORIGENES[0], 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
const res = (s, o) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const o = req.headers.get('Origin') || '';
  CORS = { ...CORS, 'Access-Control-Allow-Origin': ORIGENES.includes(o) ? o : ORIGENES[0] };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return res(405, { error: 'Método no permitido.' });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { org, user } = await req.json().catch(() => ({}));
    if (!jwt || !UUID.test(org || '') || !UUID.test(user || '')) return res(400, { error: 'Pedido incompleto.' });
    const db = createClient(Deno.env.get('SUPABASE_URL'), SERVICE_KEY, { auth: { persistSession: false } });
    const { data: who, error: e1 } = await db.auth.getUser(jwt);
    if (e1 || !who?.user) return res(401, { error: 'Volvé a entrar a Olumi.' });
    const me = who.user.id;
    if (me === user) return res(400, { error: 'Para quitarte la tuya usá «Desactivar».' });
    let aal = 'aal1'; try { aal = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal || 'aal1'; } catch (_) { /* */ }
    const mine = await db.auth.admin.mfa.listFactors({ userId: me });
    if ((mine.data?.factors || []).some((f) => f.status === 'verified') && aal !== 'aal2') return res(403, { error: 'Volvé a entrar con tu código y probá de nuevo.' });
    const { data: rows } = await db.from('members').select('user_id,role').eq('org_id', org).in('user_id', [me, user]);
    const yo = rows?.find((r) => r.user_id === me), el = rows?.find((r) => r.user_id === user);
    if (!yo || !['owner', 'admin'].includes(yo.role)) return res(403, { error: 'Solo el dueño o un administrador puede hacerlo.' });
    if (!el || ['cliente', 'pendiente'].includes(el.role)) return res(404, { error: 'Esa persona no es del equipo.' });
    if (el.role === 'owner' && yo.role !== 'owner') return res(403, { error: 'Al dueño solo se la puede quitar el dueño.' });
    const { data: fs, error: e2 } = await db.auth.admin.mfa.listFactors({ userId: user });
    if (e2) return res(500, { error: 'No se pudo leer.' });
    let quitados = 0;
    for (const f of fs?.factors || []) { const { error } = await db.auth.admin.mfa.deleteFactor({ id: f.id, userId: user }); if (!error) quitados++; }
    try { await db.from('docs').insert({ org_id: org, col: 'registro', id: crypto.randomUUID(), data: { que: 'mfa-reset', por: me, a: user, quitados, en: new Date().toISOString() } }); } catch (_) { /* opcional */ }
    return res(200, { ok: true, quitados });
  } catch (_) { return res(500, { error: 'No se pudo.' }); }
});
