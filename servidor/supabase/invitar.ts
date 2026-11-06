// Olumi · invitar a alguien del equipo por email.
// El permiso y el límite de usuarios los revisa la base (invite_member).
// La invitación lleva siempre a https://unitytech.uy/olumi/app/ (ya no usa el secreto SITE_URL).
import { createClient } from 'npm:@supabase/supabase-js@2';

// Claves del proyecto: sirve tanto con las claves nuevas (sb_publishable / sb_secret) como con las viejas
const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const ANON_KEY = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const ERR = {
  sin_permiso: 'Solo el dueño o un administrador puede invitar.',
  limite_usuarios: 'La empresa llegó al máximo de usuarios de su plan.',
  rol_invalido: 'Rol inválido.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL');
  // La invitación siempre lleva a la app de Olumi (antes dependía del secreto SITE_URL y podía mandar a otro lado)
  const APP = 'https://unitytech.uy/olumi/app/';
  const userDb = createClient(url, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Iniciá sesión de nuevo.' }, 401);

  const { org, email, rol, nombre } = await req.json().catch(() => ({}));
  const mail = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return json({ error: 'Revisá el email.' }, 400);

  // 1) Registrar la invitación con los permisos de quien invita
  const r = await userDb.rpc('invite_member', { o: org, mail, r: rol || 'tecnico', nombre: String(nombre || '') });
  if (r.error) {
    const k = Object.keys(ERR).find((x) => (r.error.message || '').includes(x));
    return json({ error: k ? ERR[k] : 'No se pudo invitar.' }, 400);
  }
  // 2) Mandar el email (si ya tiene cuenta, alcanza con que entre: queda sumado solo)
  const admin = createClient(url, SERVICE_KEY);
  const { error } = await admin.auth.admin.inviteUserByEmail(mail, { redirectTo: APP, data: { name: String(nombre || '') } });
  if (error) {
    if (/already|registered|exists/i.test(error.message || '')) return json({ ok: true, existente: true });
    console.error('invitación', error.message);
    return json({ error: 'La invitación quedó guardada, pero no se pudo mandar el email. Pedile que cree su cuenta con ese email.' }, 502);
  }
  return json({ ok: true });
});
