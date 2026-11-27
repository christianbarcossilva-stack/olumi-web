// Tickets · WhatsApp de soporte. Pasado de n8n (servidor/n8n/tickets.py) con el mismo comportamiento:
//   · Espera a que el cliente termine de escribir (4 min; 1 min si suena urgente), lee toda la charla y lo que sabe Olumi.
//   · Crea el ticket solo si sabe de qué cliente es; si no, va a la bandeja y se le pregunta la empresa una vez.
//   · Contesta una sola vez por pedido nuevo (como mucho un aviso cada 2 h si se suma a uno abierto); nada si pidió parar.
//   · La respuesta la escribe la IA como una persona; si suena a robot, es larga o tiene más de una pregunta, va la de la función.
// Ajustes del flujo: instancia, bloqueados { numero: 'quién' }, empresa, rubro, origen.
const URG = /(urgente|no anda|no funciona|se cay|caid|sin (internet|señal|camaras|imagen)|no graba|alarma sonando|no abre|robo|incendio|ya mismo)/i;
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const CARRILES = ['soporte', 'comercial', 'administrativo', 'coordinar', 'personal', 'spam'];
const TIPO = { soporte: 'falla', comercial: 'presupuesto', administrativo: 'consulta', coordinar: 'trabajo', personal: 'consulta' };

const sistema = ({ empresa = 'Phitel', rubro = 'instalaciones en Uruguay: fibra, CCTV, cableado, control de acceso, porteros, redes, alarmas' }) =>
  `Leés una charla de WhatsApp que entró al número de soporte de ${empresa} (${rubro}). Este número es para clientes registrados que tienen soporte. Usá TODA la charla y lo que sabe Olumi (QUIÉN ES: nombre, empresa, cliente, rol y lo que ya dijo). No inventes nada. Devolvé SOLO JSON: { "carril": "soporte" | "comercial" | "administrativo" | "coordinar" | "personal" | "spam", "urgencia": "alta" | "media" | "baja", "cliente": "el nombre EXACTO de la lista CLIENTES si sabés de cuál es (por QUIÉN ES o porque lo dijo), o ''", "nombre": "", "empresa": "como la dijo", "rol": "qué hace en su empresa o ''", "direccion": "si la dijo o ''", "datos": { "dato": "valor" } (solo lo que dijo y sirve la próxima vez: galpón, sector, equipo), "titulo": "máx 60 letras", "resumen": "1-2 frases: lugar, equipo, desde cuándo, lo acordado", "yaSabemos": ["datos que ya dio o que están en Olumi"], "falta": "UN solo dato imprescindible para ir, o ''", "pidioQueNoEscriba": true|false, "respuesta": "lo que le contestaría una persona del equipo" }. alta = algo dejó de funcionar y afecta la operación. falta: nunca algo que ya esté en la charla, en QUIÉN ES o en Olumi (dirección, contacto, equipo, empresa). Si no sabemos de qué cliente es, falta = 'de qué empresa' (nada más). RESPUESTA (reglas de Christian): como en WhatsApp, 1 o 2 renglones, voseo, tono del cliente, sin listas ni menús, sin '¡Hola! Gracias por comunicarte', sin 'a la brevedad', 'estimado', 'su solicitud', sin firma. Usá su nombre de pila si lo sabés. Si es un pedido nuevo de un cliente conocido, decí que ya lo anotaste y poné {pedido} donde va el número (ej. 'Hola Ana! Ya lo anoté, es el pedido {pedido}. Lo vemos y te escribo.'). Si es urgente, decí que lo marcaste urgente y que lo llaman enseguida, sin prometer hora. Si falta un dato, terminá con UNA pregunta natural para ese dato. Nunca inventes precios, fechas ni horarios. Si pregunta si es un bot, decí la verdad: 'Soy el asistente de ${empresa}, si querés te escribe alguien del equipo ya'.`;

const textoDe = (m = {}) => m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || '';
const tsDe = (r) => { const t = Number(r.messageTimestamp?.low ?? r.messageTimestamp ?? 0); return t > 1e12 ? t : t * 1000; };
const hora = (t) => new Date(t).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Montevideo' });

export default {
  // Aviso de Evolution → mensaje que nos interesa, o nada.
  webhook(b, ajustes, ahora) {
    const ev = String(b.event || '').toLowerCase().replace('_', '.');
    if (!ev.includes('messages.upsert')) return null;
    const d = b.data || {}, key = d.key || {}, jid = String(key.remoteJid || '');
    if (!/@s\.whatsapp\.net$/.test(jid) || key.fromMe) return null;          // grupos y estados no; lo que manda el número tampoco
    const from = jid.replace(/@.*/, ''), m = d.message || {};
    if ((ajustes.bloqueados || {})[from]) return null;
    const text = textoDe(m).trim(), audio = m.audioMessage ? (m.base64 || d.base64 || '') : '';
    const foto = !!m.imageMessage, doc = !!m.documentMessage;
    if (!text && !audio && !foto && !doc) return null;
    return { paso: 'preparar', datos: { jid, from, texto: text || (foto ? '📷 (mandó una foto)' : doc ? '📎 (mandó un archivo)' : ''), audio, mime: m.audioMessage?.mimetype || 'audio/ogg', msgId: key.id || '', nombre: String(d.pushName || '').trim(), ts: ahora, urgPrevia: URG.test(text) } };
  },

  pasos: {
    async preparar(ctx, { audio, mime, ...a }) {
      if (await ctx.leer('bloq:' + a.from)) return null;
      a.esAudio = !!audio;
      if (audio) {
        const t = await ctx.p.transcribir(audio, mime);
        a.texto = t || '(audio que no se pudo leer)';
        a.urgPrevia ||= /(urgente|no anda|no funciona|se cay|sin internet)/i.test(t);
      }
      return { paso: 'entender', datos: a, esperar: a.urgPrevia ? 60 : 240 };   // que termine de escribir
    },

    async entender(ctx, a) {
      const r = await ctx.p.wa.charla(ctx.ajustes.instancia || 'tickets', a.jid);
      const recs = [r?.messages?.records, r?.records, r?.messages, Array.isArray(r) ? r : null].find(Array.isArray) || [];
      const vistos = new Set();
      let L = recs.filter((x) => x?.key && !vistos.has(x.key.id) && vistos.add(x.key.id)).sort((x, y) => tsDe(x) - tsDe(y))
        .map((x) => ({ id: x.key.id, ts: tsDe(x), quien: x.key.fromMe ? 'Nosotros' : 'Cliente', texto: String(textoDe(x.message) || (x.message?.audioMessage ? '🎤 audio' : '') || (x.message?.imageMessage ? '📷 foto' : '')).slice(0, 600) }))
        .filter((l) => l.texto);
      const yo = L.find((l) => l.id === a.msgId);
      if (yo && a.esAudio) yo.texto = a.texto;
      if (!L.length) L = [{ id: a.msgId, ts: a.ts, quien: 'Cliente', texto: a.texto }];
      const ref = yo ? yo.ts : a.ts - 60000;
      if (L.some((l) => l.quien === 'Cliente' && l.ts > ref + 500 && l.id !== a.msgId)) return null;   // siguió escribiendo: lo toma ese otro mensaje
      let k = L.length - 1; while (k >= 0 && L[k].quien === 'Cliente') k--;
      const nuevos = L.slice(k + 1).map((l) => l.texto).join('\n') || a.texto;
      if (/(no (me )?(escriban|manden|mandes|escribas|contesten) mas|dejen de (escribir|mandar)|no quiero (mas )?mensajes|stop|basta)/.test(norm(nuevos))) await ctx.guardar('parar:' + a.from, ctx.ahora());
      const charla = L.slice(-40).map((l) => `[${hora(l.ts)}] ${l.quien}: ${l.texto}`).join('\n');

      const c = (await ctx.p.olumi({ modo: 'contexto', de: '+' + a.from, nombre: a.nombre, conClientes: true })) || {};
      const lista = c.clientesNombres || [];
      const j = (await ctx.p.ia({ sistema: sistema(ctx.ajustes), usuario: 'CHARLA:\n' + charla + '\n\nLO NUEVO:\n' + nuevos + '\n\nQUIÉN ES: ' + JSON.stringify(c.quienEs || {}) + '\n\nOLUMI: ' + JSON.stringify({ cliente: c.cliente || null, soporte: c.soporte || null, ticketsAbiertos: c.ticketsAbiertos || [], historial: (c.historial || []).slice(-8) }) + '\n\nCLIENTES: ' + JSON.stringify(lista) })) || {};

      const carril = CARRILES.includes(j.carril) ? j.carril : 'soporte';
      if (carril === 'spam') return null;
      const urg = ['alta', 'media', 'baja'].includes(j.urgencia) ? j.urgencia : a.urgPrevia ? 'alta' : 'media';
      const cliente = c.quienEs?.cliente || (lista.includes(j.cliente) ? j.cliente : '');     // solo un nombre que exista tal cual
      const aTicket = !!cliente && (carril === 'soporte' || carril === 'coordinar');
      const parar = !!(await ctx.leer('parar:' + a.from)) || !!j.pidioQueNoEscriba;
      if (j.pidioQueNoEscriba) await ctx.guardar('parar:' + a.from, ctx.ahora());
      return { paso: 'registrar', datos: {
        pedido: { modo: 'registrar', registrar: true, autor: 'cliente', de: '+' + a.from, nombre: j.nombre || c.quienEs?.nombre || a.nombre, empresa: cliente || j.empresa || '',
          rol: j.rol || '', direccion: j.direccion || '', datos: j.datos && typeof j.datos === 'object' ? j.datos : {}, texto: (a.esAudio ? '🎤 ' : '') + nuevos,
          resumen: j.resumen || '', titulo: j.titulo || '', intencion: carril, tema: carril, tipoEntrada: TIPO[carril], tipo: urg === 'alta' ? 'emergencia' : 'consulta',
          destino: aTicket ? 'ticket' : 'bandeja', urgente: urg === 'alta', canal: 'whatsapp', origen: ctx.ajustes.origen || 'WhatsApp de soporte', carril, urgencia: urg, msgId: a.msgId, esAudio: a.esAudio },
        from: a.from, resp: String(j.respuesta || '').trim().slice(0, 400), cliente, falta: cliente ? String(j.falta || '').slice(0, 120) : 'de qué empresa me escribís', parar } };
    },

    async registrar(ctx, t) {
      const r = (await ctx.p.olumi(t.pedido)) || {};
      return r.ok && !r.repetido && !t.parar ? { paso: 'contestar', datos: { ...t, pedido: undefined, r: { nuevo: !!r.nuevo, ticket: r.ticket || '', respuesta: r.respuesta || '' } } } : null;
    },

    // Frenos en código antes de mandar nada.
    async contestar(ctx, { from, resp, cliente, falta, r }) {
      const ult = (await ctx.leer('ult:' + from)) || 0;
      if (!r.nuevo && ctx.ahora() - ult < 2 * 3600e3) return null;
      const ia = resp.replace(/\{pedido\}/g, r.ticket).trim();
      const robot = /a la brevedad|estimad|su solicitud|hemos recibido|gracias por (comunicarte|escribir|contactarte)|marca (1|uno)|asistente virtual/.test(norm(ia));
      const malo = !ia || robot || (ia.match(/\?/g) || []).length > 1 || ia.length > 320 || /^\s*([-•*]|\d+[).])\s/m.test(ia)
        || (/\{pedido\}/.test(resp) && !r.ticket) || (r.ticket && r.nuevo && !ia.includes(r.ticket));
      let texto = malo ? r.respuesta : ia;
      if (!malo && r.nuevo && !cliente && !/empresa/.test(norm(ia))) texto += /\?/.test(ia) ? '' : ' ¿De qué empresa me escribís?';
      if (malo && r.nuevo && falta) texto += '\n¿Me pasás ' + falta.replace(/^(el|la|los|las)\s+/i, (x) => x.toLowerCase()).replace(/[?.]+$/, '') + '?';
      if (!texto) return null;
      await ctx.guardar('ult:' + from, ctx.ahora());
      await ctx.p.wa.enviar(ctx.ajustes.instancia || 'tickets', from, texto);
      return null;
    },
  },
};
