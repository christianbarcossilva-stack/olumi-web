// Olumi · entrada desde n8n (WhatsApp de la empresa, audios, mails).
// Dos modos:
//   modo "contexto": { modo:"contexto", org, de?, email?, nombre? } → qué sabe Olumi de quien escribe (cliente, tickets abiertos y
//     próxima visita, presupuestos, proyectos y planos con link firmado, última respuesta automática). No escribe nada.
//   modo "registrar" (por defecto): deja el mensaje en la BANDEJA DE ENTRADA (colección "entradas") y, si es una falla/emergencia
//     (destino "ticket"), también crea el ticket o lo suma al ticket abierto del mismo número. Si viene "respuestaAuto", la guarda
//     como mensaje saliente en la conversación.
//   modo "registrar" con soloGuardar:true: NO crea nada en la bandeja; solo guarda el mensaje en la conversación del contacto
//     (colección "conversaciones", un documento por número o casilla). Sirve para las respuestas que manda Christian a mano
//     (autor "christian") y para mensajes del cliente que no son un pedido. Así el asistente puede mirar para atrás.
// Seguridad: header "x-entrada-key" igual al secreto ENTRADA_KEY. Sin sesión de usuario ("Verify JWT" apagado).
// Cuerpo (registrar): { org, de, nombre?, empresa?, email?, texto, resumen?, titulo?, intencion?, tipoEntrada?, tipo?, destino?, canal?, origen?, msgId?, esAudio?, respuestaAuto? }
// Respuesta: { ok, entrada, ticket?, nuevo, cliente, posible, respuesta }
// Contexto devuelve además "historial" (últimos mensajes del chat: cliente, Christian y asistente) y minutosDesdeMiUltimaRespuesta.
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(Deno.env.get('SUPABASE_URL'), SERVICE_KEY);

const URGENTE = /urgen|emergenc|robo|incendio|se cort[oó]|sin internet|no anda nada|no funciona nada|ya mismo|cuanto antes|ca[ií]da/i;
const TIPOS = ['emergencia', 'reclamo', 'instalacion', 'relevamiento', 'mantenimiento', 'consulta'];
const ETIPOS = ['trabajo', 'falla', 'presupuesto', 'consulta', 'otro', 'charla', 'proveedor', 'spam', 'informe'];
const b64bytes = (b64) => Uint8Array.from(atob(String(b64).replace(/^data:[^,]*,/, '')), (c) => c.charCodeAt(0));
const digits = (s) => String(s || '').replace(/\D/g, '');
const last8 = (s) => digits(s).slice(-8);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const s = (x, max = 300) => String(x ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const n0 = (x) => Number(x) || 0;
const QEST = { borrador: 'en preparación', enviado: 'enviado', aceptado: 'aceptado', rechazado: 'rechazado', vencido: 'vencido' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405);
  const key = Deno.env.get('ENTRADA_KEY');
  if (!key) return json({ error: 'Falta el secreto ENTRADA_KEY' }, 500);
  if ((req.headers.get('x-entrada-key') || '') !== key) return json({ error: 'Clave inválida' }, 401);
  const b = await req.json().catch(() => ({}));
  const org = s(b.org, 40), texto = s(b.texto, 4000), from = digits(b.de), email = s(b.email, 120).toLowerCase();
  const modo = b.modo === 'contexto' ? 'contexto' : 'registrar';
  if (!org || (modo === 'registrar' && !texto)) return json({ error: 'Faltan org o texto' }, 400);
  const { data: o } = await db.from('orgs').select('id').eq('id', org).maybeSingle();
  if (!o) return json({ error: 'Empresa desconocida' }, 404);

  const ts = Date.now();
  const { data: rows } = await db.from('docs').select('col,id,data').eq('org_id', org).in('col', ['clientes', 'tickets', 'entradas', 'config', 'trabajos', 'presupuestos', 'proyectos', 'planos', 'conversaciones']);
  const col = (c) => (rows || []).filter((r) => r.col === c);
  const clientes = col('clientes'), tickets = col('tickets'), entradas = col('entradas');
  // conversación del contacto (un documento por número o casilla)
  const convId = from ? 'wa:' + from : email ? 'mail:' + email : '';
  const conv = convId ? col('conversaciones').find((r) => r.id === convId) : null;
  const convMsgs = (conv?.data.mensajes || []);
  const saveConv = async (lines, extra = {}) => {
    if (!convId) return;
    const prev = conv?.data || { canal: email && !from ? 'mail' : 'whatsapp', de: from ? '+' + from : email, creado: ts };
    const ids = new Set(prev.mensajes?.map((m) => m.id) || []);
    const mensajes = [...(prev.mensajes || []), ...lines.filter((l) => !ids.has(l.id))].slice(-80);
    const data = { ...prev, ...extra, mensajes, actualizado: ts };
    if (conv) await db.from('docs').update({ data, updated_at: nowIso() }).match({ org_id: org, col: 'conversaciones', id: convId });
    else await db.from('docs').insert({ org_id: org, col: 'conversaciones', id: convId, data });
  };
  const cfg = col('config').find((r) => r.id === 'empresa')?.data || {};
  const co = cfg.nombre || 'nuestro equipo';

  // ¿Es un cliente registrado? Por teléfono, email o nombre exacto de la empresa.
  // (el teléfono o el email principal, o cualquiera de las "personas de contacto" del cliente)
  const tels = (c) => [c.data.telefono, ...(c.data.contactos || []).map((x) => x.telefono)].filter(Boolean);
  const mails = (c) => [c.data.email, ...(c.data.contactos || []).map((x) => x.email)].filter(Boolean).map((x) => String(x).toLowerCase());
  let cli = from ? clientes.find((c) => tels(c).some((t) => last8(t) && last8(t) === last8(from))) : null;
  if (!cli && email) cli = clientes.find((c) => mails(c).includes(email)) || null;
  if (!cli && b.empresa) { const n = s(b.empresa).toLowerCase(); cli = clientes.find((c) => String(c.data.nombre || '').toLowerCase() === n) || null; }
  const persona = cli ? ((cli.data.contactos || []).find((x) => (from && last8(x.telefono) === last8(from)) || (email && String(x.email || '').toLowerCase() === email)) || null) : null;
  const mismo = (x) => (from && digits(x.data.waFrom || x.data.contacto?.telefono || '') === from) || (email && String(x.data.contacto?.email || '').toLowerCase() === email) || (cli && x.data.clienteId === cli.id);
  const reciente = (x) => ts - Number(x.data.actualizado || x.data.creado || 0) < 3 * 864e5;
  const abiertosDe = tickets.filter((t) => !['resuelto', 'cerrado'].includes(t.data.estado || 'nuevo')).filter(mismo)
    .sort((a, c) => Number(c.data.actualizado || c.data.creado) - Number(a.data.actualizado || a.data.creado));
  const pendientesDe = entradas.filter((e) => ['nuevo', 'seguimiento'].includes(e.data.estado || 'nuevo')).filter(mismo)
    .sort((a, c) => Number(c.data.actualizado || c.data.creado) - Number(a.data.actualizado || a.data.creado));

  // ---------- modo contexto ----------
  if (modo === 'contexto') {
    const trabajos = col('trabajos'), pres = col('presupuestos'), pry = col('proyectos'), planos = col('planos');
    const hoy = new Date().toISOString().slice(0, 10);
    const visitaDe = (tid) => trabajos.filter((j) => j.data.ticketId === tid && j.data.estado !== 'terminado' && (j.data.fecha || '') >= hoy)
      .sort((a, c) => ((a.data.fecha || '') + (a.data.hora || '')).localeCompare((c.data.fecha || '') + (c.data.hora || '')))[0];
    const ticketsCtx = abiertosDe.slice(0, 5).map((t) => { const v = visitaDe(t.id); return { numero: t.data.numero, titulo: t.data.titulo, tipo: t.data.tipo, estado: t.data.estado || 'nuevo', creado: new Date(Number(t.data.creado || 0)).toISOString().slice(0, 10), visita: v ? { fecha: v.data.fecha, hora: v.data.hora || '' } : null }; });
    const presCtx = cli ? pres.filter((p) => p.data.clienteId === cli.id).sort((a, c) => (c.data.fecha || '').localeCompare(a.data.fecha || '')).slice(0, 5)
      .map((p) => ({ numero: p.data.numero, fecha: p.data.fecha, estado: QEST[p.data.estado] || p.data.estado || '', moneda: p.data.moneda || '', total: (p.data.lineas || []).reduce((a, l) => a + n0(l.cant) * n0(l.precio), 0) })) : [];
    const pryCtx = cli ? pry.filter((p) => p.data.clienteId === cli.id).slice(0, 5) : [];
    const planosCtx = [];
    for (const p of pryCtx) for (const pl of planos.filter((x) => x.data.proyectoId === p.id).slice(0, 3)) {
      const path = pl.data.img?.id; if (!path) continue;
      const { data: su } = await db.storage.from('archivos').createSignedUrl(path, 24 * 3600).catch(() => ({ data: null }));
      if (su?.signedUrl) planosCtx.push({ nombre: pl.data.nombre || 'Plano', proyecto: p.data.nombre || '', url: su.signedUrl });
      if (planosCtx.length >= 4) break;
    }
    // última respuesta automática a este número (para no repetir acuses)
    let ultOut = 0;
    for (const x of [...abiertosDe, ...pendientesDe]) for (const m of (x.data.chat || x.data.mensajes || [])) if (m.dir === 'out' && m.auto && Number(m.ts) > ultOut) ultOut = Number(m.ts);
    let ultMio = 0; for (const m of convMsgs) if (m.autor === 'christian' && Number(m.ts) > ultMio) ultMio = Number(m.ts);
    for (const m of convMsgs) if (m.autor === 'asistente' && Number(m.ts) > ultOut) ultOut = Number(m.ts);
    const quien = (m) => m.autor === 'interno' ? ('Interno: ' + (m.quien || 'equipo')) : m.autor === 'christian' ? 'Christian' : m.autor === 'asistente' ? 'Asistente' : (m.dir === 'out' ? 'Phitel' : 'Cliente');
    // cómo escribe Christian: sus últimas respuestas a clientes (de cualquier chat), para que el asistente copie el estilo
    const estilo = col('conversaciones').flatMap((r) => (r.data.mensajes || []).filter((m) => m.autor === 'christian' && !m.audio && m.text && m.text.length > 12 && m.text.length < 500))
      .sort((a, c) => Number(c.ts) - Number(a.ts)).slice(0, 10).map((m) => s(m.text, 400));
    const historial = convMsgs.slice(-20).map((m) => ({ quien: quien(m), hace: Math.round((ts - Number(m.ts)) / 60000), texto: s(m.text, 400) + (m.audio ? ' (audio)' : '') }));
    // lo que el equipo habló entre sí sobre este cliente (chat Christian ↔ Giancarlo / técnicos), últimos 3 días
    const notasInternas = convMsgs.filter((m) => m.autor === 'interno' && ts - Number(m.ts) < 3 * 864e5).slice(-8).map((m) => ({ quien: m.quien || 'equipo', hace: Math.round((ts - Number(m.ts)) / 60000), texto: s(m.text, 400) }));
    // mails de la misma persona (cliente registrado, o mismo nombre / empresa): para no pedir por WhatsApp lo que ya mandó por mail
    const nrm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const nmB = nrm(b.nombre), emB = nrm(b.empresa);
    const mailConvs = col('conversaciones').filter((r) => r.id.startsWith('mail:') && r.id !== convId && (
      (cli && (r.data.clienteId === cli.id || mails(cli).includes(r.id.slice(5)))) ||
      (nmB.length >= 6 && nmB.includes(' ') && nrm(r.data.nombre) === nmB) || (emB.length >= 4 && (nrm(r.data.empresa) === emB || nrm(r.data.nombre) === emB))))
      .sort((x, y) => Number(y.data.actualizado || 0) - Number(x.data.actualizado || 0)).slice(0, 2);
    const mailsCtx = mailConvs.flatMap((r) => (r.data.mensajes || []).filter((m) => m.dir !== 'nota').slice(-6).map((m) => ({ casilla: r.id.slice(5), quien: quien(m), hace: Math.round((ts - Number(m.ts)) / 60000), texto: s(m.text, 600) })));
    const ultimoIn = [...abiertosDe, ...pendientesDe].flatMap((x) => (x.data.chat || x.data.mensajes || []).filter((m) => m.dir === 'in')).sort((a, c) => Number(c.ts) - Number(a.ts)).slice(0, 4).map((m) => s(m.text, 200));
    return json({ ok: true, registrado: !!cli, cliente: cli ? { nombre: cli.data.nombre, contacto: cli.data.contacto || '', abonado: !!cli.data.abonado, direccion: cli.data.direccion || '', personaQueEscribe: persona ? { nombre: persona.nombre || '', area: persona.area || '' } : null } : null,
      ticketsAbiertos: ticketsCtx, pedidosPendientes: pendientesDe.slice(0, 3).map((e) => ({ titulo: e.data.titulo, tipo: e.data.tipo, estado: e.data.estado, fecha: new Date(Number(e.data.creado || 0)).toISOString().slice(0, 10) })),
      presupuestos: presCtx, proyectos: pryCtx.map((p) => ({ nombre: p.data.nombre, estado: p.data.estado || '' })), planos: planosCtx,
      mensajesAnteriores: ultimoIn, historial, notasInternas, mails: mailsCtx, ctxV: 2, comoEscribeChristian: estilo, minutosDesdeUltimaRespuesta: ultOut ? Math.round((ts - ultOut) / 60000) : null,
      minutosDesdeMiUltimaRespuesta: ultMio ? Math.round((ts - ultMio) / 60000) : null, empresa: { nombre: co, telefono: cfg.telefono || '' } });
  }

  // ---------- modo registrar ----------
  const msgId = s(b.msgId, 80);
  const line = { id: msgId || uid(), dir: 'in', text: texto, ts, name: s(b.nombre, 80), audio: !!b.esAudio, autor: 'cliente' };
  const outLine = b.respuestaAuto ? { id: uid(), dir: 'out', text: s(b.respuestaAuto, 1500), ts: ts + 1, auto: true, autor: 'asistente' } : null;
  const lines = outLine ? [line, outLine] : [line];
  // ---- solo guardar en la conversación (respuestas mías a mano, o mensajes del cliente que no son un pedido) ----
  // ---- nota interna: algo que Christian o Giancarlo se dijeron sobre un cliente → se cuelga en la conversación de ese cliente ----
  if (b.soloGuardar && b.autor === 'interno') {
    const words = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !['para', 'como', 'esta', 'este', 'esto', 'pero', 'hola', 'bien', 'todo', 'tiene', 'tengo', 'vamos', 'hoy', 'manana', 'ahora', 'desde', 'hasta', 'cuando', 'donde', 'sobre', 'tambien', 'porque', 'cliente', 'obra', 'trabajo', 'phitel'].includes(w));
    const tw = new Set(words(texto)); const low = texto.toLowerCase();
    const convs = col('conversaciones'); const hits = [];
    const score = (names) => { let n = 0; for (const nm of names) { const nl = String(nm || '').toLowerCase().trim(); if (nl.length >= 4 && low.includes(nl)) return 3; for (const w of words(nm)) if (tw.has(w)) n = Math.max(n, 1); } return n; };
    for (const c of clientes) { const sc = score([c.data.nombre, c.data.contacto, c.data.obra, ...(c.data.contactos || []).map((x) => x.nombre)]); if (sc) hits.push({ sc, tel: tels(c)[0], mail: mails(c)[0], nombre: c.data.nombre }); }
    for (const p of col('proyectos')) { const sc = score([p.data.nombre, p.data.obra, p.data.contactoLugar]); if (sc) { const c = clientes.find((x) => x.id === p.data.clienteId); hits.push({ sc, tel: c ? tels(c)[0] : '', mail: c ? mails(c)[0] : '', nombre: p.data.nombre }); } }
    for (const cv of convs) { const sc = score([cv.data.nombre, cv.data.empresa]); if (sc) hits.push({ sc, conv: cv.id, nombre: cv.data.nombre }); }
    for (const m of (String(texto).match(/\b0?9\d[\s.-]?\d{3}[\s.-]?\d{3}\b/g) || [])) hits.push({ sc: 3, tel: m, nombre: m });
    const best = Math.max(0, ...hits.map((h) => h.sc)); const sel = hits.filter((h) => h.sc === best && best > 0).slice(0, 3);
    const ids = new Set(); for (const h of sel) { const id = h.conv || (h.tel ? 'wa:' + (digits(h.tel).length === 8 ? '598' + digits(h.tel) : digits(h.tel).replace(/^0/, '598')) : h.mail ? 'mail:' + h.mail : ''); if (id) ids.add(id); }
    const line = { id: msgId || uid(), dir: 'nota', autor: 'interno', quien: s(b.quien, 40) || 'equipo', text: texto, ts };
    for (const id of ids) { const cv = convs.find((r) => r.id === id); const prev = cv?.data || { canal: id.startsWith('mail:') ? 'mail' : 'whatsapp', de: id.startsWith('wa:') ? '+' + id.slice(3) : id.slice(5), creado: ts, nombre: sel.find((h) => (h.conv || '') === id)?.nombre || sel[0]?.nombre || '' };
      if ((prev.mensajes || []).some((m) => m.id === line.id)) continue;
      const data = { ...prev, mensajes: [...(prev.mensajes || []), line].slice(-80), actualizado: ts };
      if (cv) await db.from('docs').update({ data, updated_at: nowIso() }).match({ org_id: org, col: 'conversaciones', id }); else await db.from('docs').insert({ org_id: org, col: 'conversaciones', id, data }); }
    return json({ ok: true, nota: true, clientes: sel.map((h) => h.nombre), vinculados: [...ids] });
  }
  if (b.soloGuardar) {
    const mio = b.autor === 'christian', asis = b.autor === 'asistente';
    if (mio && !cli && !conv) return json({ ok: true, ignorado: true });   // chats personales: no se guardan
    if (msgId && convMsgs.some((m) => m.id === msgId)) return json({ ok: true, repetido: true });
    const l = asis ? { id: msgId || uid(), dir: 'out', text: texto, ts, auto: true, autor: 'asistente' } : mio ? { id: msgId || uid(), dir: 'out', text: texto, ts, autor: 'christian', audio: !!b.esAudio } : line;
    await saveConv([l], { nombre: s(b.nombre, 80) || conv?.data.nombre || '', clienteId: cli ? cli.id : (conv?.data.clienteId || '') });
    // también en el ticket abierto o el pedido pendiente, para verlo en la ficha
    const ab = abiertosDe.filter(reciente)[0], pe = pendientesDe.filter(reciente)[0];
    if (ab) await db.from('docs').update({ data: { ...ab.data, chat: [...(ab.data.chat || []), l], actualizado: ts }, updated_at: nowIso() }).match({ org_id: org, col: 'tickets', id: ab.id });
    const pe2 = pe || (ab ? entradas.find((e) => e.data.ticketId === ab.id) : null);
    if (pe2) await db.from('docs').update({ data: { ...pe2.data, mensajes: [...(pe2.data.mensajes || []), l], actualizado: ts }, updated_at: nowIso() }).match({ org_id: org, col: 'entradas', id: pe2.id });
    return json({ ok: true, guardado: true, cliente: cli ? cli.data.nombre : '' });
  }
  // Ya procesado (n8n puede reintentar)
  if (msgId && (entradas.some((e) => e.data.msgId === msgId || (e.data.mensajes || []).some((m) => m.id === msgId)) || tickets.some((t) => (t.data.chat || []).some((c) => c.id === msgId)))) return json({ ok: true, repetido: true });

  await saveConv(lines, { nombre: s(b.nombre, 80) || conv?.data.nombre || '', clienteId: cli ? cli.id : (conv?.data.clienteId || '') });
  const contacto = cli ? null : { nombre: s(b.nombre, 80), telefono: from ? '+' + from : '', empresa: s(b.empresa, 80), email };
  const quien = cli ? cli.data.nombre : (contacto.empresa || contacto.nombre || contacto.telefono || email || 'Sin nombre');
  const nm = (s(b.nombre, 80) || '').split(' ')[0];
  const tipoE = ETIPOS.includes(b.tipoEntrada) ? b.tipoEntrada : (URGENTE.test(texto) ? 'falla' : 'consulta');
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : (URGENTE.test(texto) ? 'emergencia' : tipoE === 'falla' ? 'reclamo' : tipoE === 'trabajo' ? 'instalacion' : tipoE === 'presupuesto' ? 'relevamiento' : 'consulta');
  const informe = tipoE === 'informe';                                // reporte de un técnico (grupo de WhatsApp): bandeja, nunca ticket
  const charla = ['charla', 'proveedor', 'spam'].includes(tipoE) || informe;   // va a la bandeja para que Christian lo mire o lo borre; nunca a un ticket
  const aTicket = !charla && (b.destino === 'ticket' || (b.destino !== 'bandeja' && (tipo === 'emergencia' || tipoE === 'falla')));
  // foto del reporte (base64) → almacenamiento
  const fotos = [];
  if (b.fotoB64) { try { const bytes = b64bytes(b.fotoB64); const mime = /^image\//.test(b.fotoMime || '') ? b.fotoMime : 'image/jpeg'; const path = `${org}/${uid()}.${mime === 'image/png' ? 'png' : 'jpg'}`;
    const { error } = await db.storage.from('archivos').upload(path, bytes, { contentType: mime, upsert: false }); if (!error) fotos.push({ id: path, name: 'foto.jpg', type: mime, at: ts, by: s(b.tecnico, 60) || 'técnico' }); } catch (_) {} }
  const canal = b.canal === 'mail' ? 'mail' : 'whatsapp';
  const origen = s(b.origen, 30) || (canal === 'mail' ? 'Email' : 'WhatsApp');
  const titulo = s(b.titulo, 80) || texto.split('\n')[0].slice(0, 80) || 'Mensaje';
  const resumen = s(b.resumen, 400), intencion = s(b.intencion, 30);

  // 1) ¿Ticket abierto del mismo número o cliente en los últimos 3 días? Se suma ahí (y a su pedido en la bandeja).
  const abierto = charla ? null : abiertosDe.filter(reciente)[0];
  if (abierto) {
    const d = { ...abierto.data, chat: [...(abierto.data.chat || []), ...lines], mensaje: [abierto.data.mensaje, texto].filter(Boolean).join('\n'), actualizado: ts };
    if (URGENTE.test(texto) && d.tipo !== 'emergencia') d.tipo = 'emergencia';
    await db.from('docs').update({ data: d, updated_at: nowIso() }).match({ org_id: org, col: 'tickets', id: abierto.id });
    const ent = entradas.find((e) => e.data.ticketId === abierto.id);
    if (ent) await db.from('docs').update({ data: { ...ent.data, texto: [ent.data.texto, texto].filter(Boolean).join('\n\n'), mensajes: [...(ent.data.mensajes || []), ...lines], actualizado: ts }, updated_at: nowIso() }).match({ org_id: org, col: 'entradas', id: ent.id });
    return json({ ok: true, entrada: ent?.id || '', ticket: d.numero, nuevo: false, cliente: quien, posible: !cli,
      respuesta: `Sumamos tu mensaje al pedido ${d.numero}. ${d.tipo === 'emergencia' ? 'Lo tomamos como urgente.' : 'Te respondemos a la brevedad.'}` });
  }
  // 2) ¿Pedido pendiente en la bandeja del mismo número? Se suma ahí.
  const pend = informe
    ? entradas.filter((e) => e.data.tipo === 'informe' && (e.data.estado || 'nuevo') === 'nuevo' && e.data.tecnicoTel === s(b.tecnicoTel, 30) && ts - Number(e.data.actualizado || 0) < 45 * 60000 && (!b.clienteNombre || !e.data.clienteNombre || e.data.clienteNombre === s(b.clienteNombre, 80)))[0]
    : pendientesDe.filter(reciente).filter((e) => charla === ['charla', 'proveedor', 'spam'].includes(e.data.tipo))[0];
  if (pend && !aTicket) {
    const d = { ...pend.data, texto: [pend.data.texto, texto].filter(Boolean).join('\n\n'), mensajes: [...(pend.data.mensajes || []), ...lines], actualizado: ts, intencion: intencion || pend.data.intencion || '',
      fotos: [...(pend.data.fotos || []), ...fotos], materiales: [...(pend.data.materiales || []), ...(Array.isArray(b.materiales) ? b.materiales : [])], pendientes: [pend.data.pendientes, s(b.pendientes, 400)].filter(Boolean).join(' · '), clienteNombre: pend.data.clienteNombre || s(b.clienteNombre, 80) };
    await db.from('docs').update({ data: d, updated_at: nowIso() }).match({ org_id: org, col: 'entradas', id: pend.id });
    return json({ ok: true, entrada: pend.id, nuevo: false, cliente: quien, posible: !cli, respuesta: `Sumamos tu mensaje al pedido anterior. Te respondemos a la brevedad.` });
  }

  // 3) Nuevo: siempre en la bandeja; además ticket si es una falla o emergencia (o si n8n lo pidió).
  let ticketId = '', numero = '';
  if (aTicket) {
    const max = Math.max(0, ...tickets.map((t) => parseInt(String(t.data.numero || '').replace(/\D/g, ''), 10) || 0));
    numero = 'T-' + String(max + 1).padStart(4, '0');
    ticketId = uid();
    const ticket = { numero, titulo, descripcion: (resumen ? resumen + '\n\n' : '') + texto, mensaje: texto, origen, tipo, estado: 'nuevo', clienteId: cli ? cli.id : '', contacto, responsable: '',
      creado: ts, actualizado: ts, waFrom: from, waNombre: line.name, chat: lines };
    await db.from('docs').insert({ org_id: org, col: 'tickets', id: ticketId, data: ticket });
  }
  const entId = uid();
  const entrada = { canal, de: from ? '+' + from : email, nombre: s(b.nombre, 80), contacto, clienteId: cli ? cli.id : '', titulo, resumen, texto, tipo: tipoE, intencion,
    estado: aTicket ? 'ticket' : 'nuevo', ticketId, origen, msgId, mensajes: lines, esAudio: !!b.esAudio, tema: s(b.tema, 20), carril: s(b.carril, 20), urgente: !!b.urgente || tipo === 'emergencia', creado: ts, actualizado: ts,
    ...(informe ? { tecnico: s(b.tecnico, 60), tecnicoTel: s(b.tecnicoTel, 30), clienteNombre: s(b.clienteNombre, 80), materiales: Array.isArray(b.materiales) ? b.materiales.slice(0, 40) : [], pendientes: s(b.pendientes, 400), estadoObra: s(b.estadoObra, 20), fotos } : (fotos.length ? { fotos } : {})) };
  await db.from('docs').insert({ org_id: org, col: 'entradas', id: entId, data: entrada });
  const respuesta = aTicket
    ? `Hola${nm ? ' ' + nm : ''}, recibimos tu mensaje en ${co}. Tu número de pedido es ${numero}. ${tipo === 'emergencia' ? 'Lo tomamos como urgente y te contactamos enseguida.' : 'Te respondemos a la brevedad.'}`
    : `Hola${nm ? ' ' + nm : ''}, recibimos tu mensaje en ${co}. Te respondemos a la brevedad.`;
  return json({ ok: true, entrada: entId, ticket: numero, nuevo: true, cliente: quien, posible: !cli, tipoEntrada: tipoE, aTicket, respuesta });
});
