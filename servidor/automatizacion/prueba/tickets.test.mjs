// Pruebas del motor y de la receta de Tickets, sin red: todo lo de afuera (IA, Evolution, Olumi) está simulado.
// Correr: node --test servidor/automatizacion/prueba/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMotor, cargarRecetas } from '../motor.mjs';
import { memoria, cifrar, descifrar } from '../almacen.mjs';
import { randomBytes } from 'node:crypto';

const recetas = await cargarRecetas();
const ORG = 'org-phitel', TOK = 'a'.repeat(32), CLIENTE = '59891111111';
const CLAVES = { evolution: 'evo', entrada: 'ent', gemini: 'gem', groq: 'grq' };

function armar({ modo = 'real', ajustes = {}, ia = {}, olumi = {}, charla, geminiCae = false, evoFalla = 0, tope = 20, flujos, claves } = {}) {
  let T = Date.UTC(2026, 10, 27, 15, 0, 0);
  const ahora = () => T, llamadas = [];
  const charlaActual = () => charla ?? [];   // sin charla guardada: el motor usa el mensaje que llegó
  const red = async (url, o = {}) => {
    const cuerpo = o.body && typeof o.body === 'string' ? JSON.parse(o.body) : o.body;
    llamadas.push({ url, cuerpo, headers: o.headers });
    const ok = (j) => ({ ok: true, status: 200, text: async () => JSON.stringify(j) });
    if (url.includes('generativelanguage')) return geminiCae ? { ok: false, status: 401, text: async () => 'Missing or invalid Authorization header' } : ok({ choices: [{ message: { content: JSON.stringify({ carril: 'soporte', urgencia: 'alta', cliente: 'Doraline', respuesta: 'Hola Ana! Ya lo anoté, es el pedido {pedido}. Lo marqué urgente y te llaman enseguida.', ...ia }) } }], usage: { prompt_tokens: 2000, completion_tokens: 300 } });
    if (url.includes('api.groq.com/openai/v1/chat')) return ok({ choices: [{ message: { content: JSON.stringify({ carril: 'soporte', urgencia: 'media', cliente: 'Doraline', respuesta: 'Hola Ana! Ya lo anoté, es el pedido {pedido}. Lo vemos y te escribo.', ...ia }) } }], usage: { prompt_tokens: 2000, completion_tokens: 300 } });
    if (url.includes('audio/transcriptions')) return ok({ text: 'urgente, no anda el portón' });
    if (url.includes('/chat/findMessages/')) { if (evoFalla-- > 0) return { ok: false, status: 502, text: async () => 'bad gateway' }; return ok({ messages: { records: charlaActual() } }); }
    if (url.includes('/message/sendText/')) return ok({ key: { id: 'enviado' } });
    if (url.includes('/functions/v1/entrada')) return cuerpo.modo === 'contexto'
      ? ok({ quienEs: { nombre: 'Ana', cliente: 'Doraline' }, clientesNombres: ['Doraline', 'Maosol'], ticketsAbiertos: [], ...olumi.contexto })
      : ok({ ok: true, nuevo: true, ticket: 'T-0045', respuesta: 'Hola Ana! Ya lo anoté, es el pedido T-0045. Lo vemos y te escribo.', ...olumi.registrar });
    throw new Error('url inesperada ' + url);
  };
  const almacen = memoria({ ahora, tope, flujos: flujos || [{ id: 'f1', org_id: ORG, receta: 'tickets', prendido: true, modo, token: TOK, ajustes: { instancia: 'tickets', bloqueados: { '59899999999': 'Familia' }, ...ajustes } }], claves: claves || { [ORG]: CLAVES } });
  const motor = crearMotor({ almacen, recetas, ahora, red, log: () => {} });
  const correrTodo = async () => { for (let i = 0; i < 40; i++) { if (!(await motor.vuelta())) { const p = almacen.T.filter((t) => t.estado === 'pendiente'); if (!p.length) return; T = Math.max(T, Math.min(...p.map((t) => t.correr_en))); } } };
  const llegada = (msg, extra = {}) => motor.webhook(TOK, { event: 'messages.upsert', data: { key: { id: 'm1', fromMe: false, remoteJid: CLIENTE + '@s.whatsapp.net', ...extra.key }, pushName: 'Ana', message: msg, ...extra.data } });
  const enviados = () => llamadas.filter((l) => l.url.includes('/message/sendText/'));
  const registros = () => llamadas.filter((l) => l.url.includes('/entrada') && l.cuerpo.modo === 'registrar');
  return { motor, almacen, llamadas, llegada, correrTodo, enviados, registros, avanzar: (s) => (T += s * 1000), ahora };
}

test('texto de un cliente conocido: espera, crea el ticket y contesta una vez con el número', async () => {
  const k = armar();
  assert.equal((await k.llegada({ conversation: 'Hola, se cayó la cámara del galpón 3' })).tomado, true);
  await k.motor.vuelta();
  assert.equal(k.almacen.T.at(-1).paso, 'entender');
  assert.equal(k.almacen.T.at(-1).correr_en - k.ahora(), 60e3, 'suena urgente: espera 1 minuto');
  await k.correrTodo();
  assert.equal(k.registros().length, 1);
  const p = k.registros()[0].cuerpo;
  assert.equal(p.org, ORG); assert.equal(p.destino, 'ticket'); assert.equal(p.urgente, true); assert.equal(p.empresa, 'Doraline');
  assert.equal(k.registros()[0].headers['x-entrada-key'], 'ent', 'usa la clave de esa empresa');
  assert.equal(k.enviados().length, 1);
  assert.match(k.enviados()[0].cuerpo.text, /T-0045/);
  assert.equal(k.almacen.T.every((t) => t.estado === 'listo' && !Object.keys(t.datos).length), true, 'la cola queda limpia, sin mensajes guardados');
});

test('mensaje sin urgencia espera 4 minutos', async () => {
  const k = armar();
  await k.llegada({ conversation: 'Hola, quería consultar por el mantenimiento' });
  await k.motor.vuelta();
  assert.equal(k.almacen.T.at(-1).correr_en - k.ahora(), 240e3);
});

test('no se toman: bloqueados, grupos, lo que manda el propio número, eventos que no son mensajes', async () => {
  const k = armar();
  assert.equal((await k.motor.webhook(TOK, { event: 'messages.upsert', data: { key: { remoteJid: '59899999999@s.whatsapp.net' }, message: { conversation: 'hola' } } })).tomado, false);
  assert.equal((await k.motor.webhook(TOK, { event: 'messages.upsert', data: { key: { remoteJid: '1203@g.us' }, message: { conversation: 'hola' } } })).tomado, false);
  assert.equal((await k.llegada({ conversation: 'hola' }, { key: { fromMe: true } })).tomado, false);
  assert.equal((await k.motor.webhook(TOK, { event: 'connection.update' })).tomado, false);
  assert.equal((await k.motor.webhook('b'.repeat(32), {})).status, 404, 'token desconocido');
  assert.equal(k.almacen.T.length, 0);
});

test('si el cliente siguió escribiendo, este mensaje no hace nada (lo toma el último)', async () => {
  const t = Date.UTC(2026, 10, 27, 15, 0, 0) / 1000;
  const k = armar({ charla: [
    { key: { id: 'm1', fromMe: false }, message: { conversation: 'Hola' }, messageTimestamp: t },
    { key: { id: 'm2', fromMe: false }, message: { conversation: 'se cortó internet' }, messageTimestamp: t + 30 },
  ] });
  await k.llegada({ conversation: 'Hola' }); await k.correrTodo();
  assert.equal(k.registros().length, 0, 'm1 no registra');
  await k.llegada({ conversation: 'se cortó internet' }, { key: { id: 'm2' } }); await k.correrTodo();
  assert.equal(k.registros().length, 1, 'm2 registra una vez');
  assert.equal(k.registros()[0].cuerpo.texto, 'Hola\nse cortó internet', 'con los dos mensajes juntos');
});

test('spam: no se registra ni se contesta', async () => {
  const k = armar({ ia: { carril: 'spam' } });
  await k.llegada({ conversation: 'Ganá dinero fácil' }); await k.correrTodo();
  assert.equal(k.registros().length, 0); assert.equal(k.enviados().length, 0);
});

test('audio: se transcribe y, si suena urgente, espera 1 minuto', async () => {
  const k = armar();
  await k.llegada({ audioMessage: { mimetype: 'audio/ogg' }, base64: Buffer.from('ogg').toString('base64') });
  await k.motor.vuelta();
  assert.ok(k.llamadas.some((l) => l.url.includes('audio/transcriptions')));
  assert.equal(k.almacen.T.at(-1).correr_en - k.ahora(), 60e3);
  await k.correrTodo();
  assert.match(k.registros()[0].cuerpo.texto, /^🎤 /);
});

test('modo sombra: hace todo menos registrar y mandar, y deja anotado qué habría mandado', async () => {
  const k = armar({ modo: 'sombra' });
  await k.llegada({ conversation: 'Hola, se cayó la cámara' }); await k.correrTodo();
  assert.equal(k.registros().length, 0); assert.equal(k.enviados().length, 0);
  const ef = k.almacen.R.flatMap((e) => e.detalle.efectos || []);
  assert.ok(ef.includes('olumi:registrar'));
  assert.match(ef.find((e) => e.nombre === 'whatsapp').texto, /T-SOMBRA/);
});

test('si la IA contesta como robot, va la respuesta de la función y la pregunta del dato que falta', async () => {
  const k = armar({ ia: { respuesta: 'Estimado cliente, hemos recibido su solicitud.', falta: 'la dirección' } });
  await k.llegada({ conversation: 'Hola' }); await k.correrTodo();
  assert.equal(k.enviados()[0].cuerpo.text, 'Hola Ana! Ya lo anoté, es el pedido T-0045. Lo vemos y te escribo.\n¿Me pasás la dirección?');
});

test('cliente desconocido: va a la bandeja y se pregunta la empresa', async () => {
  const k = armar({ olumi: { contexto: { quienEs: {} } }, ia: { cliente: '', respuesta: 'Hola! Ya lo anoté, es el pedido {pedido}.' } });
  await k.llegada({ conversation: 'Hola' }); await k.correrTodo();
  assert.equal(k.registros()[0].cuerpo.destino, 'bandeja');
  assert.match(k.enviados()[0].cuerpo.text, /¿De qué empresa me escribís\?$/);
});

test('Gemini caído: usa Groq', async () => {
  const k = armar({ geminiCae: true });
  await k.llegada({ conversation: 'Hola' }); await k.correrTodo();
  assert.ok(k.llamadas.some((l) => l.url.includes('api.groq.com/openai/v1/chat')));
  assert.equal(k.enviados().length, 1);
});

test('tope de gasto: pasado el tope no llama a la IA, pero el pedido igual entra', async () => {
  const k = armar({ tope: 0.001 });
  await k.llegada({ conversation: 'Hola' }); await k.correrTodo();   // el primero gasta y pasa el tope
  const antes = k.llamadas.filter((l) => /generativelanguage|groq.com\/openai\/v1\/chat/.test(l.url)).length;
  await k.llegada({ conversation: 'Otra cosa' }, { key: { id: 'm9' } }); await k.correrTodo();
  assert.equal(k.llamadas.filter((l) => /generativelanguage|groq.com\/openai\/v1\/chat/.test(l.url)).length, antes);
  assert.equal(k.registros().length, 2);
  assert.ok(k.almacen.G.get(ORG) > 0.001);
});

test('Evolution falla una vez: reintenta a los 30 segundos y sigue', async () => {
  const k = armar({ evoFalla: 1 });
  await k.llegada({ conversation: 'Hola' }); await k.correrTodo();
  assert.equal(k.almacen.R.filter((e) => e.estado === 'error').length, 1);
  assert.equal(k.enviados().length, 1);
});

test('pidió que no le escriban: se anota en Olumi pero no se contesta', async () => {
  const k = armar({ ia: { pidioQueNoEscriba: true } });
  await k.llegada({ conversation: 'no me escriban más' }); await k.correrTodo();
  assert.equal(k.registros().length, 1); assert.equal(k.enviados().length, 0);
});

test('sumado a un pedido abierto: como mucho un aviso cada 2 horas', async () => {
  const k = armar({ olumi: { registrar: { nuevo: false } }, ia: { respuesta: 'Dale, lo sumo.' } });
  await k.llegada({ conversation: 'Hola' }); await k.correrTodo();
  await k.llegada({ conversation: 'Otra cosa' }, { key: { id: 'm2' } }); await k.correrTodo();
  assert.equal(k.enviados().length, 1);
});

test('multiempresa: una empresa con mucha carga no frena a la otra, y cada una usa sus claves', async () => {
  const flujos = [
    { id: 'fa', org_id: 'A', receta: 'tickets', prendido: true, modo: 'real', token: '1'.repeat(32), ajustes: {} },
    { id: 'fb', org_id: 'B', receta: 'tickets', prendido: true, modo: 'real', token: '2'.repeat(32), ajustes: {} },
  ];
  const k = armar({ flujos, claves: { A: { ...CLAVES, entrada: 'clave-A' }, B: { ...CLAVES, entrada: 'clave-B' } } });
  for (let i = 0; i < 6; i++) await k.motor.webhook('1'.repeat(32), { event: 'messages.upsert', data: { key: { id: 'a' + i, remoteJid: `5989${i}@s.whatsapp.net` }, message: { conversation: 'hola' } } });
  await k.motor.webhook('2'.repeat(32), { event: 'messages.upsert', data: { key: { id: 'b1', remoteJid: '59880@s.whatsapp.net' }, message: { conversation: 'hola' } } });
  const tomados = await k.almacen.tomar(10, 3);
  assert.equal(tomados.filter((t) => t.org_id === 'A').length, 3);
  assert.equal(tomados.filter((t) => t.org_id === 'B').length, 1);
  tomados.forEach((t) => (k.almacen.T.find((x) => x.id === t.id).estado = 'pendiente'));
  await k.correrTodo();
  const porClave = (c) => k.registros().filter((r) => r.headers['x-entrada-key'] === c);
  assert.equal(porClave('clave-A').length, 6); assert.equal(porClave('clave-B').length, 1);
  assert.ok(porClave('clave-A').every((r) => r.cuerpo.org === 'A'));
});

test('flujo apagado a mitad de la espera: no sigue', async () => {
  const k = armar();
  await k.llegada({ conversation: 'Hola' }); await k.motor.vuelta();
  (await k.almacen.flujo('f1')).prendido = false;
  await k.correrTodo();
  assert.equal(k.registros().length, 0);
});

test('claves: se guardan cifradas y solo se leen con la llave del servidor', () => {
  const llave = randomBytes(32), c = cifrar('secreto', llave);
  assert.notEqual(c, 'secreto'); assert.equal(descifrar(c, llave), 'secreto');
  assert.throws(() => descifrar(c, randomBytes(32)));
});
