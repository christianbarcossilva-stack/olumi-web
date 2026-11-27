// Unity Tech · cobro diario para Olumi, Ondi y Kliva. La corre la base una vez por día.
// 1. Toma el dólar BROU (billete, venta) y pone al día el monto en pesos de las suscripciones
//    que Mercado Pago cobra en pesos (el precio se publica en dólares).
// 2. Mira cada empresa con un plan pago vencido y:
//  · el día 1, 5 y 10 de atraso deja un aviso (cobro_ajustes.avisos_dias);
//  · el día de la gracia (cobro_ajustes.gracia_dias, 14) anota la suspensión.
// En Olumi y Kliva la suspensión es automática (la app queda «solo para mirar»; no se borra nada).
// En Ondi NO: las alertas de seguridad no se cortan solas; queda anotado para que decida Christian.
//
// Mientras cobro_ajustes.avisos_activos sea false, los avisos solo quedan en el registro
// (para el panel de Unity Tech) y no le llegan a ningún cliente.
// Con avisos_activos = true y el secreto AVISOS_WEBHOOK cargado, cada aviso se le pasa
// a esa dirección (Girvo o n8n), que manda el mail y el WhatsApp.
// Se puede llamar varias veces: cada aviso sale una sola vez por cada fecha de pago.
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(Deno.env.get('SUPABASE_URL'), SERVICE_KEY);
const DIA = 86400e3;
const APPS = { olumi: 'Olumi', ondi: 'Ondi', kliva: 'Kliva' };

const MP = 'https://api.mercadopago.com';
const token = Deno.env.get('MP_ACCESS_TOKEN');

// Cotización del dólar: BROU, dólar billete, venta (la de la pizarra)
async function brou() {
  const r = await fetch('https://www.brou.com.uy/cotizaciones', { headers: { 'user-agent': 'Mozilla/5.0' } }).catch(() => null);
  if (!r || !r.ok) return null;
  const t = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&oacute;/g, 'ó').replace(/\s+/g, ' ');
  const m = t.match(/Dólar\s+([\d.]+,\d+)\s+([\d.]+,\d+)/);
  const n = m ? Number(m[2].replace(/\./g, '').replace(',', '.')) : NaN;
  return n > 10 && n < 200 ? n : null;
}

// Las suscripciones que se cobran en pesos: se pone al día el monto con el dólar de hoy
async function ponerAlDia(tc) {
  const subs = [];
  const { data: os } = await db.from('orgs').select('id,plan,billing_cycle,extra_users,mp_preapproval_id').eq('mp_status', 'authorized').not('mp_preapproval_id', 'is', null);
  for (const o of os || []) subs.push({ org: o.id, app: 'olumi', plan: o.plan, ciclo: o.billing_cycle, extra: o.extra_users, cantidad: 1, pre: o.mp_preapproval_id });
  const { data: ss } = await db.from('suscripciones').select('org_id,app,plan,ciclo,extra,cantidad,mp_preapproval_id').eq('mp_status', 'authorized').not('mp_preapproval_id', 'is', null);
  for (const s of ss || []) subs.push({ org: s.org_id, app: s.app, plan: s.plan, ciclo: s.ciclo, extra: s.extra, cantidad: s.cantidad, pre: s.mp_preapproval_id });
  const hechos = [];
  for (const s of subs) {
    const r = await fetch(`${MP}/preapproval/${s.pre}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) continue;
    const p = await r.json();
    if (p.auto_recurring?.currency_id !== 'UYU' || p.status !== 'authorized') continue;
    // el plan que pagó (en Olumi, si todavía no entró el primer cobro, el de la suscripción)
    const ref = String(p.external_reference || '').split('|');
    const [plan, ciclo, extra, cant] = ref[0] === 'v2' ? [ref[3], ref[4], ref[5], ref[6]] : [s.plan, s.ciclo, s.extra, s.cantidad];
    const { data: usd } = await db.rpc('cobro_monto_usd', { a: s.app, p: plan, ciclo, extra: Number(extra) || 0, cantidad: Number(cant) || 1 });
    if (!usd) continue;
    const nuevo = Math.round(Number(usd) * tc);
    if (Math.abs(nuevo - Number(p.auto_recurring.transaction_amount)) < 1) continue;
    const u = await fetch(`${MP}/preapproval/${s.pre}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_recurring: { transaction_amount: nuevo, currency_id: 'UYU' } }) });
    await db.from('billing_events').insert({ org_id: s.org, app: s.app, kind: 'monto', mp_id: s.pre, status: u.ok ? 'actualizado' : `error ${u.status}`,
      amount: nuevo, currency: 'UYU', raw: { usd: Number(usd), dolar_brou: tc, antes: p.auto_recurring.transaction_amount } });
    hechos.push({ app: s.app, antes: p.auto_recurring.transaction_amount, ahora: nuevo, ok: u.ok });
  }
  return hechos;
}

async function ajuste(clave, def) {
  const { data } = await db.from('cobro_ajustes').select('valor').eq('clave', clave).maybeSingle();
  return data ? data.valor : def;
}

Deno.serve(async () => {
  const gracia = Number(await ajuste('gracia_dias', 14));
  const dias = (await ajuste('avisos_dias', [1, 5, 10])).map(Number);
  const activos = (await ajuste('avisos_activos', false)) === true;
  const hook = Deno.env.get('AVISOS_WEBHOOK');
  const ahora = Date.now();

  // 1. El dólar BROU de hoy y los montos en pesos al día
  let montos = [];
  const tc = await brou();
  if (tc) {
    const c = await ajuste('cotizacion', {});
    await db.from('cobro_ajustes').update({ valor: { ...c, usd_uyu: tc, fecha: new Date().toISOString() } }).eq('clave', 'cotizacion');
    if (token) montos = await ponerAlDia(tc);
  }

  // Empresas con plan pago vencido, de las tres apps
  const lista = [];
  const { data: os } = await db.from('orgs').select('id,name,plan,paid_until,founder').neq('plan', 'gratis').not('paid_until', 'is', null);
  for (const o of os || []) if (!o.founder) lista.push({ app: 'olumi', org: o.id, nombre: o.name, plan: o.plan, hasta: o.paid_until });
  const { data: ss } = await db.from('suscripciones').select('org_id,app,plan,pago_hasta,orgs(name,founder)').not('pago_hasta', 'is', null);
  for (const s of ss || []) if (!s.orgs?.founder) lista.push({ app: s.app, org: s.org_id, nombre: s.orgs?.name, plan: s.plan, hasta: s.pago_hasta });

  const hechos = [];
  for (const x of lista) {
    const atraso = Math.floor((ahora - Date.parse(x.hasta)) / DIA);
    if (atraso < 1) continue;
    const periodo = String(x.hasta).slice(0, 10);
    const pasos = dias.filter((d) => atraso >= d).map((d) => ({ kind: 'aviso', etapa: d }));
    if (atraso >= gracia) pasos.push({ kind: 'suspension', etapa: gracia });
    for (const p of pasos) {
      const clave = `${x.app}:${p.kind}:${p.etapa}:${periodo}`;
      const { data: ya } = await db.from('billing_events').select('id').eq('org_id', x.org).eq('kind', p.kind).eq('mp_id', clave).limit(1);
      if (ya && ya.length) continue;
      let status;
      if (p.kind === 'suspension') status = x.app === 'ondi' ? 'para_christian' : 'automatica';
      else if (!activos || !hook) status = 'para_christian';
      else {
        const { data: ms } = await db.from('members').select('email,role').eq('org_id', x.org).in('role', ['owner', 'admin']);
        const r = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          app: APPS[x.app], empresa: x.nombre, plan: x.plan, pago_hasta: periodo, dias_atraso: atraso, etapa: p.etapa,
          suspende_el: new Date(Date.parse(x.hasta) + gracia * DIA).toISOString().slice(0, 10),
          para: (ms || []).map((m) => m.email).filter(Boolean),
        }) }).catch(() => null);
        status = r && r.ok ? 'enviado' : 'fallo_envio';
      }
      await db.from('billing_events').insert({ org_id: x.org, app: x.app, kind: p.kind, mp_id: clave, status });
      hechos.push({ app: x.app, empresa: x.nombre, kind: p.kind, etapa: p.etapa, status });
    }
  }
  return new Response(JSON.stringify({ ok: true, dolar_brou: tc, montos, revisadas: lista.length, hechos }), { headers: { 'content-type': 'application/json' } });
});
