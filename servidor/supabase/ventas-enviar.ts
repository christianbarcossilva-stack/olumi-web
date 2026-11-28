// Unity Tech · el agente de ventas manda sus correos desde ventas@unitytech.uy (Titan, de HostGator).
// Pedido de Christian (27/11 y 28/11): que el agente haga la venta por correo, con tope de 15 por día.
//
// Cómo funciona:
// - Un prospecto se manda cuando su fila de ventas_prospectos tiene envio_estado = 'en_cola'.
//   Lo pone el agente (o Christian) recién cuando Christian dijo que el agente mande solo.
// - La base llama a esta función cada 20 minutos, de lunes a viernes de 9 a 18 (Uruguay).
//   Manda hasta completar 15 por día; al mandar, la empresa pasa sola a «contactado».
// - Prueba: un administrador de la plataforma la llama con { "prueba": "su@correo" } y le llega
//   el mensaje del primer prospecto en cola (o de { "id": … }), con «[PRUEBA]» en el asunto. No cambia nada.
//
// Secretos: SMTP_PASS (la contraseña de ventas@, la carga Christian). El resto tiene valores fijos
// y se puede cambiar con SMTP_HOST, SMTP_PORT, SMTP_USER. Supabase no deja salir por los puertos 25 y 587: se usa el 465.
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const ANON_KEY = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const URL_ = Deno.env.get('SUPABASE_URL');
const db = createClient(URL_, SERVICE_KEY);

const TOPE_DIA = 15;
const USER = Deno.env.get('SMTP_USER') || 'ventas@unitytech.uy';
const DE = `Christian Barcos · Unity Tech <${USER}>`;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());

function transporte() {
  const pass = Deno.env.get('SMTP_PASS');
  if (!pass) return null;
  return nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST') || 'smtp.titan.email',
    port: Number(Deno.env.get('SMTP_PORT') || 465),
    secure: true,
    auth: { user: USER, pass },
  });
}
// Firma (pedido de Christian, 28/11). El agente a veces deja su propia línea de firma y la de «baja»:
// se sacan del cuerpo y se ponen abajo, siempre iguales.
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const linkear = (x) => esc(x).replace(/(?<![@\w.\/])(unitytech\.uy(?:\/[\w\-\/]*)?)/g, '<a href="https://$1" style="color:#E85D04;text-decoration:none">$1</a>');
function partes(msg, idioma) {
  const lineas = String(msg || '').replace(/\r/g, '').split('\n');
  const cuerpo = lineas.filter((l) => !/^\s*Christian Barcos\s*[·|-]/i.test(l) && !/«?baja»?|descadastr|não (te )?escrev/i.test(l)).join('\n').trim();
  const baja = idioma === 'pt' ? 'Se preferir não receber mais mensagens, responda «baixa».'
    : 'Si preferís que no te escribamos más, respondé «baja» y listo.';
  return { cuerpo, baja };
}
const FIRMA_TXT = '--\nChristian Barcos\nUnity Tech · Montevideo, Uruguay\nventas@unitytech.uy · unitytech.uy\nKliva · Olumi · Ondi';
const FIRMA_HTML = `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;border-top:1px solid #e5e5e5;padding-top:14px;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td style="vertical-align:top;padding-right:12px"><img src="https://unitytech.uy/img/firma/unitytech.png" width="44" height="44" alt="Unity Tech" style="display:block;border-radius:9px"></td>
    <td style="vertical-align:top;font-size:13px;line-height:1.5;color:#444">
      <div style="font-size:15px;font-weight:bold;color:#111">Christian Barcos</div>
      <div>Unity Tech · Montevideo, Uruguay</div>
      <div><a href="mailto:ventas@unitytech.uy" style="color:#E85D04;text-decoration:none">ventas@unitytech.uy</a> · <a href="https://unitytech.uy" style="color:#E85D04;text-decoration:none">unitytech.uy</a></div>
      <div style="color:#777"><a href="https://unitytech.uy/kliva" style="color:#777;text-decoration:none">Kliva</a> · <a href="https://unitytech.uy/olumi" style="color:#777;text-decoration:none">Olumi</a> · <a href="https://unitytech.uy/ondi" style="color:#777;text-decoration:none">Ondi</a></div>
    </td>
  </tr>
</table>`;
function armar(p, para, prueba) {
  const { cuerpo, baja } = partes(p.mensaje, p.idioma);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222;max-width:600px">`
    + cuerpo.split(/\n{2,}/).map((par) => `<p style="margin:0 0 12px">${linkear(par).replace(/\n/g, '<br>')}</p>`).join('')
    + FIRMA_HTML
    + `<p style="margin:14px 0 0;font-size:11px;color:#999">${esc(baja)}</p></div>`;
  return {
    from: DE,
    to: para,
    replyTo: USER,
    subject: (prueba ? '[PRUEBA] ' : '') + String(p.asunto || 'Kliva · Unity Tech').slice(0, 150),
    text: `${cuerpo}\n\n${FIRMA_TXT}\n\n${baja}`,
    html,
    headers: { 'List-Unsubscribe': `<mailto:${USER}?subject=baja>` },
  };
}

// Comienzo del día en Uruguay (UTC-3, sin horario de verano)
function hoyUY() { const d = new Date(Date.now() - 3 * 3600e3); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + 3 * 3600e3).toISOString(); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));
  const t = transporte();
  if (!t) return json({ error: 'Falta cargar SMTP_PASS en el servidor.' }, 500);

  // Prueba: solo un administrador de la plataforma, y solo le llega a él
  if (body.prueba) {
    const userDb = createClient(URL_, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user } } = await userDb.auth.getUser();
    const { data: adm } = user ? await db.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle() : { data: null };
    if (!adm) return json({ error: 'Solo un administrador de la plataforma puede mandar pruebas.' }, 403);
    if (!emailOk(body.prueba)) return json({ error: 'Correo de prueba inválido.' }, 400);
    let q = db.from('ventas_prospectos').select('id,empresa,asunto,mensaje,idioma');
    q = body.id ? q.eq('id', String(body.id)) : q.eq('envio_estado', 'en_cola').order('puntaje', { ascending: false });
    let { data: p } = await q.limit(1).maybeSingle();
    if (!p) ({ data: p } = await db.from('ventas_prospectos').select('id,empresa,asunto,mensaje,idioma').order('puntaje', { ascending: false }).limit(1).maybeSingle());
    if (!p) return json({ error: 'No hay prospectos.' }, 404);
    try { const r = await t.sendMail(armar(p, String(body.prueba).trim(), true)); return json({ ok: true, prueba: true, empresa: p.empresa, id: r.messageId }); }
    catch (e) { return json({ error: String(e?.message || e) }, 502); }
  }

  // Cola: hasta 15 por día
  const { count } = await db.from('ventas_prospectos').select('id', { count: 'exact', head: true }).eq('envio_estado', 'enviado').gte('enviado_en', hoyUY());
  const quedan = Math.max(0, TOPE_DIA - (count || 0));
  if (!quedan) return json({ ok: true, enviados: 0, motivo: 'tope del día' });
  const { data: cola } = await db.from('ventas_prospectos').select('id,empresa,email,asunto,mensaje,estado,idioma')
    .eq('envio_estado', 'en_cola').order('puntaje', { ascending: false }).order('creado', { ascending: true }).limit(quedan);
  const hechos = [];
  for (const p of cola || []) {
    const ahora = new Date().toISOString();
    if (!emailOk(p.email) || !p.mensaje) {
      await db.from('ventas_prospectos').update({ envio_estado: 'error', envio_error: 'sin email válido o sin mensaje' }).eq('id', p.id);
      hechos.push({ empresa: p.empresa, ok: false }); continue;
    }
    if (p.estado === 'descartado') { await db.from('ventas_prospectos').update({ envio_estado: null }).eq('id', p.id); continue; }
    try {
      await t.sendMail(armar(p, p.email.trim(), false));
      await db.from('ventas_prospectos').update({ envio_estado: 'enviado', enviado_en: ahora, envio_error: null,
        estado: p.estado === 'nuevo' ? 'contactado' : p.estado, contactado_en: ahora }).eq('id', p.id);
      hechos.push({ empresa: p.empresa, ok: true });
    } catch (e) {
      await db.from('ventas_prospectos').update({ envio_estado: 'error', envio_error: String(e?.message || e).slice(0, 300) }).eq('id', p.id);
      hechos.push({ empresa: p.empresa, ok: false });
    }
    await new Promise((r) => setTimeout(r, 4000));   // de a uno, sin ráfagas
  }
  return json({ ok: true, enviados: hechos.filter((h) => h.ok).length, hechos });
});
