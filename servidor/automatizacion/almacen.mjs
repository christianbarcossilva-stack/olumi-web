// Dónde guarda el motor sus datos. Dos versiones con la misma forma:
//   supabase(url, clave) → producción (tablas auto_* de esquema.sql, solo con la clave de servicio)
//   memoria()            → pruebas, sin red
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const cifrar = (texto, llave) => {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', llave, iv);
  const ct = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
};
export const descifrar = (b64, llave) => {
  const b = Buffer.from(b64, 'base64'), d = createDecipheriv('aes-256-gcm', llave, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
};
const iso = (ms) => new Date(ms).toISOString();

export function supabase(url, clave, llave) {
  const h = { apikey: clave, authorization: 'Bearer ' + clave, 'content-type': 'application/json' };
  const rest = async (ruta, { metodo = 'GET', cuerpo, pref } = {}) => {
    const r = await fetch(url + '/rest/v1/' + ruta, { method: metodo, headers: pref ? { ...h, prefer: pref } : h, body: cuerpo && JSON.stringify(cuerpo), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`supabase ${metodo} ${ruta.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? null : r.json();
  };
  const uno = async (ruta) => (await rest(ruta))[0] || null;
  return {
    flujoPorToken: (t) => uno(`auto_flujos?token=eq.${encodeURIComponent(t)}&prendido=is.true&limit=1`),
    flujo: (id) => uno(`auto_flujos?id=eq.${id}&limit=1`),
    encolar: (t) => rest('auto_trabajos', { metodo: 'POST', cuerpo: { flujo_id: t.flujo, org_id: t.org, paso: t.paso, datos: t.datos, correr_en: iso(t.en) }, pref: 'return=minimal' }),
    tomar: (n, porEmpresa) => rest('rpc/auto_tomar', { metodo: 'POST', cuerpo: { n, por_empresa: porEmpresa } }),
    // al cerrar se borran los datos (mensajes, audios): lo que importa queda en auto_ejecuciones
    cerrar: (id, estado, error = null) => rest(`auto_trabajos?id=eq.${id}`, { metodo: 'PATCH', cuerpo: { estado, error, datos: {} }, pref: 'return=minimal' }),
    reintentar: (id, en, error) => rest(`auto_trabajos?id=eq.${id}`, { metodo: 'PATCH', cuerpo: { estado: 'pendiente', correr_en: iso(en), error }, pref: 'return=minimal' }),
    leer: async (flujo, k) => (await uno(`auto_estado?flujo_id=eq.${flujo}&clave=eq.${encodeURIComponent(k)}&select=valor`))?.valor,
    guardar: (flujo, k, valor) => rest('auto_estado', { metodo: 'POST', cuerpo: { flujo_id: flujo, clave: k, valor, actualizado: iso(Date.now()) }, pref: 'resolution=merge-duplicates,return=minimal' }),
    registrar: (e) => rest('auto_ejecuciones', { metodo: 'POST', cuerpo: e, pref: 'return=minimal' }),
    claves: async (org) => Object.fromEntries((await rest(`auto_claves?org_id=eq.${org}&select=nombre,valor`)).map((c) => [c.nombre, descifrar(c.valor, llave)])),
    ponerClave: (org, nombre, valor) => rest('auto_claves', { metodo: 'POST', cuerpo: { org_id: org, nombre, valor: cifrar(valor, llave) }, pref: 'resolution=merge-duplicates,return=minimal' }),
    sumarGasto: (org, usd) => rest('rpc/auto_sumar_gasto', { metodo: 'POST', cuerpo: { org, usd } }),
    latido: (version) => rest('auto_motor', { metodo: 'POST', cuerpo: { id: 1, visto: iso(Date.now()), version }, pref: 'resolution=merge-duplicates,return=minimal' }),
    limpiar: async () => {
      await rest(`auto_ejecuciones?creado=lt.${iso(Date.now() - 30 * 864e5)}`, { metodo: 'DELETE', pref: 'return=minimal' });
      await rest(`auto_trabajos?estado=in.(listo,error)&creado=lt.${iso(Date.now() - 7 * 864e5)}`, { metodo: 'DELETE', pref: 'return=minimal' });
    },
  };
}

export function memoria({ flujos = [], claves = {}, tope = 20, ahora = Date.now } = {}) {
  const T = [], E = new Map(), G = new Map(), R = [];
  let sig = 1;
  return {
    T, R, G,
    flujoPorToken: async (t) => flujos.find((f) => f.token === t && f.prendido) || null,
    flujo: async (id) => flujos.find((f) => f.id === id) || null,
    encolar: async (t) => { T.push({ id: sig++, flujo_id: t.flujo, org_id: t.org, paso: t.paso, datos: structuredClone(t.datos), correr_en: t.en, intentos: 0, estado: 'pendiente' }); },
    tomar: async (n, porEmpresa) => {
      const t0 = ahora(), ocup = {};
      T.filter((t) => t.estado === 'corriendo').forEach((t) => (ocup[t.org_id] = (ocup[t.org_id] || 0) + 1));
      const out = [];
      for (const t of T.filter((t) => t.estado === 'pendiente' && t.correr_en <= t0).sort((a, b) => a.correr_en - b.correr_en)) {
        if (out.length >= n || (ocup[t.org_id] || 0) >= porEmpresa) continue;
        ocup[t.org_id] = (ocup[t.org_id] || 0) + 1; t.estado = 'corriendo'; t.intentos++; out.push(structuredClone(t));
      }
      return out;
    },
    cerrar: async (id, estado, error = null) => Object.assign(T.find((t) => t.id === id), { estado, error, datos: {} }),
    reintentar: async (id, en, error) => Object.assign(T.find((t) => t.id === id), { estado: 'pendiente', correr_en: en, error }),
    leer: async (f, k) => structuredClone(E.get(f + '|' + k)),
    guardar: async (f, k, v) => void E.set(f + '|' + k, structuredClone(v)),
    registrar: async (e) => void R.push(e),
    claves: async (org) => ({ ...(claves[org] || {}) }),
    sumarGasto: async (org, usd) => { const v = (G.get(org) || 0) + usd; G.set(org, v); return v < tope; },
    latido: async () => {},
    limpiar: async () => {},
  };
}
