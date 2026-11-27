// Unity Tech · avisos de pago atrasado para Olumi, Ondi y Kliva.
// La corre la base una vez por día. Mira cada empresa con un plan pago vencido y:
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
  return new Response(JSON.stringify({ ok: true, revisadas: lista.length, hechos }), { headers: { 'content-type': 'application/json' } });
});
