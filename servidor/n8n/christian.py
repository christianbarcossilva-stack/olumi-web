#!/usr/bin/env python3
# Flujo NUEVO y separado: "Christian · WhatsApp" (reemplaza al asistente viejo).
#   · Lo que le escriben a Christian va a la BANDEJA de Olumi, marcado con de dónde vino y qué tan urgente es.
#     Nunca pasa a ticket solo (Christian lo pasa con el botón) y NUNCA le contesta a un cliente: no hay camino para eso.
#   · Modo prueba: en su chat con él mismo, Christian le escribe como si fuera un cliente y el asistente le contesta ahí
#     (con 🤖 adelante), leyendo la charla real, armando la ficha y pasando los frenos en código.
#   · Bloqueados en el código (ni se anotan ni se contestan): familia, pareja, equipo de Phitel y grupos.
#   · Sin correo: el mail va en otro flujo (el disparador de correo trababa el prender/apagar de n8n).
# Uso: python3 n8n/christian.py credenciales.json > christian.json
import json, sys

CR = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
def cred(k, t):
    c = CR.get(k) or {"id": "", "name": k}
    return {t: {"id": c["id"], "name": c["name"]}}

ORG = "2c84e6c2-5507-4aa6-9f6d-3b66060739c3"
EVO = "http://evolution:8080"
INST = "christian"
OLUMI = "https://pgriavmcmscchxdnfglv.supabase.co/functions/v1/entrada"
GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions"
GROQ_AUDIO = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = "openai/gpt-oss-120b"
GEMINI_CHAT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMINI_MODEL = "gemini-3.8-flash"

# nunca se anotan ni se contestan (además de los que se sumen con "bloquear 09…")
BLOQUEADOS = {
    "59899119340": "Mamá", "59896700019": "Sofía",
    "59899240460": "Giancarlo (Phitel)", "59892179190": "Victor (Phitel)",
}
BLOQ_NOMBRES = r"^(sof[ií]a|sofi|mam[aá]|mami|pap[aá]|papi|amor|mi amor|bebe|hermana?o?|abuel[ao]|t[ií][ao]|prim[ao]|cu[ñn]ad[ao]|suegr[ao]|giancarlo|v[ií]ctor m[aá]rquez)\b"

nodes, conns = [], {}
def node(name, typ, ver, params, pos, **extra):
    n = {"parameters": params, "name": name, "type": typ, "typeVersion": ver, "position": list(pos)}
    n.update(extra); nodes.append(n); return name
ENTRY = {}
def link(a, b, out=0, inp=0):
    b = ENTRY.get(b, b)
    conns.setdefault(a, {"main": []})
    while len(conns[a]["main"]) <= out: conns[a]["main"].append([])
    conns[a]["main"][out].append({"node": b, "type": "main", "index": inp})
def code(name, pos, js): return node(name, "n8n-nodes-base.code", 2, {"jsCode": js}, pos)
def iff(name, pos, left):
    c = {"id": "c1", "leftValue": left, "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}
    return node(name, "n8n-nodes-base.if", 2.2, {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2}, "conditions": [c], "combinator": "and"}, "options": {}}, pos)
def http(name, pos, url, body=None, credkey=None, credtype="httpHeaderAuth", extra=None, soft=False):
    p = {"method": "POST", "url": url, "options": {"timeout": 60000}}
    if credkey == "groq": credtype = "groqApi"; p["authentication"] = "predefinedCredentialType"; p["nodeCredentialType"] = "groqApi"
    elif credkey: p["authentication"] = "genericCredentialType"; p["genericAuthType"] = credtype
    if body is not None: p["sendBody"] = True; p["specifyBody"] = "json"; p["jsonBody"] = body
    if extra: p.update(extra)
    kw = {"credentials": cred(credkey, credtype)} if credkey else {}
    if soft: kw.update({"onError": "continueRegularOutput", "alwaysOutputData": True})
    return node(name, "n8n-nodes-base.httpRequest", 4.2, p, pos, **kw)
def cerebro(name, pos, system, user):
    """Gemini primero; si no responde, Groq. Devuelve el nombre del nodo final (salida = respuesta del modelo)."""
    u = user[3:-2].strip() if user.startswith("={{") else user
    x, y = pos
    body = lambda model, extra: "={{ JSON.stringify({ model: '%s', temperature: 0.3, %s response_format: { type: 'json_object' }, messages: [ { role: 'system', content: %s }, { role: 'user', content: %s } ] }) }}" % (model, extra, json.dumps(system, ensure_ascii=False), u)
    gem = http(name + " (Gemini)", (x, y), GEMINI_CHAT, body=body(GEMINI_MODEL, ""), credkey="gemini", soft=True)
    for n in nodes:
        if n["name"] == gem: n["retryOnFail"] = True; n["maxTries"] = 2; n["waitBetweenTries"] = 3000
    ok = iff(name + " · ¿respondió Gemini?", (x + 200, y), "={{ !!($json.choices && $json.choices[0] && $json.choices[0].message && $json.choices[0].message.content) }}")
    gq = http(name + " (Groq)", (x + 200, y + 160), GROQ_CHAT, body=body(GROQ_MODEL, "reasoning_effort: 'high',"), credkey="groq", soft=True)
    out = code(name, (x + 420, y), "return $input.all();")
    link(gem, ok); link(ok, out, 0); link(ok, gq, 1); link(gq, out)
    ENTRY[name] = gem
    return name

# ============ entrada ============
wh = node("WhatsApp entrante", "n8n-nodes-base.webhook", 2, {"httpMethod": "POST", "path": "wa-christian", "responseMode": "onReceived", "options": {}}, (0, 400), webhookId="olumi-wa-christian")
leer = code("Leer mensaje", (220, 400), r"""
// Evolution → algo simple. Devuelve vacío si no hay que hacer nada.
const BLOQ = %s, BLOQN = new RegExp(%s, 'i');
const b = $json.body || $json; const ev = String(b.event || '').toLowerCase().replace('_', '.');
if (!ev.includes('messages.upsert')) return [];
const d = b.data || {}, key = d.key || {}, jid = String(key.remoteJid || '');
if (!/@s\.whatsapp\.net$/.test(jid)) return [];                       // grupos, estados, canales: no
const m = d.message || {}, owner = String(b.sender || '').replace(/:\d+@/, '@'), num = jid.replace(/@.*/, '');
const text = (m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || '').trim();
const audioB64 = m.audioMessage ? (m.base64 || d.base64 || '') : '';
const fromMe = !!key.fromMe, self = fromMe && jid === owner;
const sd = $getWorkflowStaticData('global'); sd.auto = sd.auto || {}; sd.bloq = sd.bloq || {};
if (self && (sd.auto[key.id] || /^(🤖|🧠|🚨|📥|✅)/.test(text))) return [];      // lo que escribió el propio asistente
const pn = String(d.pushName || '').trim();
if (!self && (BLOQ[num] || sd.bloq[num] || (!fromMe && BLOQN.test(pn)))) return [];   // familia, pareja, equipo: ni se anota
if (!text && !audioB64) return [];
const tipo = self ? 'prueba' : fromMe ? 'mio' : 'cliente';
return [{ json: { tipo, jid, from: num, owner, ownerNum: owner.replace(/@.*/, ''), text, audioB64, mime: m.audioMessage?.mimetype || 'audio/ogg', msgId: key.id || '', nombre: fromMe ? 'Christian' : pn, ts: Date.now() } }];
""" % (json.dumps(BLOQUEADOS), json.dumps(BLOQ_NOMBRES)))
link(wh, leer)
es_audio = iff("¿Es audio?", (440, 400), "={{ !!$json.audioB64 }}")
link(leer, es_audio)
tofile = node("Audio a archivo", "n8n-nodes-base.convertToFile", 1.1, {"operation": "toBinary", "sourceProperty": "audioB64", "options": {"fileName": "audio.ogg", "mimeType": "audio/ogg"}}, (660, 300))
link(es_audio, tofile, 0)
trans = http("Transcribir audio", (880, 300), GROQ_AUDIO, credkey="groq", soft=True, extra={
    "sendBody": True, "contentType": "multipart-form-data",
    "bodyParameters": {"parameters": [{"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"},
        {"name": "model", "value": "whisper-large-v3-turbo"}, {"name": "language", "value": "es"}, {"name": "response_format", "value": "json"}]}})
link(tofile, trans)
t_audio = code("Texto del audio", (1100, 300), "const m = $('Leer mensaje').item.json; return [{ json: { ...m, audioB64: undefined, texto: String($json.text || '').trim() || '(audio que no se pudo leer)', esAudio: true } }];")
link(trans, t_audio)
t_texto = code("Texto escrito", (660, 500), "return [{ json: { ...$json, texto: $json.text, esAudio: false } }];")
link(es_audio, t_texto, 1)
ruta = node("¿Quién escribe?", "n8n-nodes-base.switch", 3.2, {"rules": {"values": [
    {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "={{ $json.tipo }}", "rightValue": "cliente", "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"}, "renameOutput": True, "outputKey": "cliente"},
    {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "={{ $json.tipo }}", "rightValue": "mio", "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"}, "renameOutput": True, "outputKey": "yo a un cliente"},
    {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "={{ $json.tipo }}", "rightValue": "prueba", "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"}, "renameOutput": True, "outputKey": "mi chat (prueba)"}]}, "options": {}}, (1320, 400))
link(t_audio, ruta); link(t_texto, ruta)

# ============ 1) cliente → bandeja de Olumi (nunca ticket solo, nunca respuesta) ============
ctx1 = http("Contexto en Olumi", (1560, 160), OLUMI, credkey="olumi", soft=True,
    body="={{ JSON.stringify({ modo: 'contexto', org: '%s', de: '+' + $json.from, nombre: $json.nombre }) }}" % ORG)
link(ruta, ctx1, 0)
CLASIF = (
    "Clasificás un mensaje de WhatsApp que le llegó a Christian, jefe de operaciones de Phitel (instalaciones en Uruguay: fibra óptica, CCTV, cableado estructurado, control de acceso, porteros, redes, alarmas). "
    "No escribís respuesta. Usá el MENSAJE y el CONTEXTO de Olumi (cliente, tickets, historial). Devolvé SOLO JSON: "
    "{ \"carril\": \"soporte\" | \"comercial\" | \"administrativo\" | \"coordinar\" | \"personal\" | \"proveedor\" | \"spam\", "
    "\"urgencia\": \"alta\" | \"media\" | \"baja\" (alta solo si algo dejó de funcionar y afecta la operación), "
    "\"nombre\": \"de la persona o ''\", \"empresa\": \"empresa o lugar o ''\", \"titulo\": \"máximo 60 letras\", \"resumen\": \"1 o 2 frases con lugar, equipo, desde cuándo y lo ya acordado\" }. "
    "soporte = algo no anda o hay que reparar; comercial = pide precio, presupuesto o un trabajo nuevo; administrativo = piden documentos, facturas, carnés, datos de la empresa; coordinar = fechas, horarios, confirmar una visita; "
    "personal = no tiene que ver con el trabajo."
)
cla = cerebro("Clasificar", (1780, 160), CLASIF,
    "={{ 'MENSAJE: ' + $('¿Quién escribe?').item.json.texto + '\\nDE: ' + ($('¿Quién escribe?').item.json.nombre || '') + ' (+' + $('¿Quién escribe?').item.json.from + ')\\nCONTEXTO OLUMI: ' + JSON.stringify({ cliente: $json.cliente || null, ticketsAbiertos: $json.ticketsAbiertos || [], historial: ($json.historial || []).slice(-8) }) }}")
link(ctx1, cla)
reg = code("Armar entrada de bandeja", (2420, 160), r"""
const m = $('¿Quién escribe?').item.json; let j = {}; try { j = JSON.parse(String($json.choices[0].message.content).replace(/^```(json)?|```$/g, '').trim()); } catch (e) {}
const carril = ['soporte','comercial','administrativo','coordinar','personal','proveedor','spam'].includes(j.carril) ? j.carril : 'soporte';
if (carril === 'personal') return [];                                     // no es trabajo: no se anota
const urg = ['alta','media','baja'].includes(j.urgencia) ? j.urgencia : 'media';
const tipoEntrada = { soporte: 'falla', comercial: 'presupuesto', administrativo: 'consulta', coordinar: 'trabajo', proveedor: 'proveedor', spam: 'spam' }[carril] || 'consulta';
return [{ json: { modo: 'registrar', registrar: true, soloGuardar: false, autor: 'cliente', org: '%s', de: '+' + m.from, nombre: j.nombre || m.nombre, empresa: j.empresa || '',
  texto: (m.esAudio ? '🎤 ' : '') + m.texto, resumen: j.resumen || '', titulo: j.titulo || '', intencion: carril, tema: carril, tipoEntrada, tipo: urg === 'alta' ? 'emergencia' : 'consulta',
  destino: 'bandeja', urgente: urg === 'alta', canal: 'whatsapp', origen: 'WhatsApp de Christian', carril, urgencia: urg, msgId: m.msgId, esAudio: m.esAudio, respuestaAuto: '' } }];
""" % ORG)
link(cla, reg)
olumi_in = http("A la bandeja de Olumi", (2640, 160), OLUMI, credkey="olumi", soft=True, body="={{ JSON.stringify($json) }}")
link(reg, olumi_in)
urg_if = iff("¿Urgente?", (2860, 160), "={{ $('Armar entrada de bandeja').item.json.urgente && !$json.repetido }}")
link(olumi_in, urg_if)
avisar = http("Avisarme (urgente)", (3080, 100), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $('¿Quién escribe?').item.json.ownerNum, text: '🚨 Urgente en la bandeja · ' + ($('Armar entrada de bandeja').item.json.nombre || '+' + $('¿Quién escribe?').item.json.from) + ($('Armar entrada de bandeja').item.json.empresa ? ' (' + $('Armar entrada de bandeja').item.json.empresa + ')' : '') + '\\n' + ($('Armar entrada de bandeja').item.json.titulo || $('¿Quién escribe?').item.json.texto.slice(0, 120)) }) }}")
link(urg_if, avisar, 0)

# ============ 2) yo a un cliente → queda en la conversación de Olumi ============
mio = http("Guardar lo que escribí", (1560, 400), OLUMI, credkey="olumi", soft=True,
    body="={{ JSON.stringify({ modo: 'registrar', soloGuardar: true, autor: 'christian', org: '%s', de: '+' + $json.from, texto: ($json.esAudio ? '🎤 ' : '') + $json.texto, msgId: $json.msgId, esAudio: $json.esAudio }) }}" % ORG)
link(ruta, mio, 1)

# ============ 3) mi chat: modo prueba (le escribo como si fuera un cliente) ============
cmd = code("Comandos y prueba", (1560, 680), r"""
const m = $json, sd = $getWorkflowStaticData('global'); sd.prueba = sd.prueba || { desde: 0, soy: '' }; sd.bloq = sd.bloq || {};
const low = m.texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const out = t => [{ json: { ...m, respuesta: '🤖 ' + t, comando: true } }];
if (/^(ayuda|comandos)$/.test(low)) return out('Modo prueba. Escribime como si fueras un cliente y te contesto acá. Comandos:\n• reiniciar prueba → empiezo una charla nueva\n• prueba soy Nombre de Empresa → hago de cuenta que escribe ese cliente de Olumi\n• bloquear 099123456 → ese número nunca se anota ni se contesta');
if (/^reiniciar( prueba)?$/.test(low)) { sd.prueba = { desde: Date.now(), soy: '' }; return out('Listo, charla nueva. Escribime como cliente.'); }
const soy = m.texto.match(/^prueba soy (.+)$/i); if (soy) { sd.prueba.soy = soy[1].trim(); sd.prueba.desde = Date.now(); return out('Ok, ahora sos ' + sd.prueba.soy + '. Charla nueva: escribime como ese cliente.'); }
const bl = low.match(/^bloquear\s+\+?(\d[\d ]{6,})$/); if (bl) { let n = bl[1].replace(/\D/g, ''); if (n.startsWith('0')) n = '598' + n.slice(1); sd.bloq[n] = Date.now(); return out('Bloqueado +' + n + ': nunca se anota ni se contesta.'); }
return [{ json: { ...m, comando: false, desde: sd.prueba.desde || 0, soy: sd.prueba.soy || '' } }];
""")
link(ruta, cmd, 2)
es_cmd = iff("¿Es un comando?", (1780, 680), "={{ $json.comando }}")
link(cmd, es_cmd)
resp_cmd = http("Contestar el comando", (2000, 600), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $json.ownerNum, text: $json.respuesta }) }}")
link(es_cmd, resp_cmd, 0)
anot_cmd = code("Anotar mensaje del asistente", (2220, 600), "const sd = $getWorkflowStaticData('global'); sd.auto = sd.auto || {}; const id = $json.key?.id; if (id) sd.auto[id] = Date.now(); for (const k of Object.keys(sd.auto)) if (Date.now() - sd.auto[k] > 3 * 864e5) delete sd.auto[k]; return [];")
link(resp_cmd, anot_cmd)
# espera corta para juntar varios mensajes seguidos (en la versión para clientes serán 4 min, 1 si es urgente)
espera = node("Esperar a que termine de escribir", "n8n-nodes-base.wait", 1.1, {"amount": 15, "unit": "seconds"}, (2000, 780), webhookId="olumi-espera-christian")
link(es_cmd, espera, 1)
charla = http("Leer mi chat (Evolution)", (2220, 780), f"{EVO}/chat/findMessages/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ where: { key: { remoteJid: $('Comandos y prueba').item.json.owner } }, page: 1, offset: 40, limit: 40 }) }}")
link(espera, charla)
leer_charla = code("Armar la charla de prueba", (2440, 780), r"""
// En mi chat: lo que escribo yo = "Cliente"; lo que empieza con 🤖 = "Asistente". Solo desde el último "reiniciar".
const a = $('Comandos y prueba').item.json, sd = $getWorkflowStaticData('global'); sd.auto = sd.auto || {};
let recs = []; for (const r of $input.all().map(i => i.json)) { const x = r.messages?.records || r.records || r.messages || (Array.isArray(r) ? r : []); if (Array.isArray(x)) recs.push(...x); }
const txt = mm => { const m = mm.message || {}; return m.conversation || m.extendedTextMessage?.text || (m.audioMessage ? '🎤 audio' : '') || (m.imageMessage ? '📷 foto' : '') || ''; };
const tsOf = mm => { const t = Number(mm.messageTimestamp?.low ?? mm.messageTimestamp ?? 0); return t > 1e12 ? t : t * 1000; };
const seen = new Set(); recs = recs.filter(r => r && r.key && !seen.has(r.key.id) && seen.add(r.key.id)).sort((x, y) => tsOf(x) - tsOf(y));
const hora = t => new Date(t).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Montevideo' });
let L = recs.map(r => { const t = String(txt(r) || ''); const asis = !!sd.auto[r.key.id] || /^🤖/.test(t); return { id: r.key.id, ts: tsOf(r), quien: asis ? 'Asistente' : 'Cliente', texto: t.replace(/^🤖\s*/, '').slice(0, 600) }; })
  .filter(l => l.texto && l.ts >= (a.desde || 0) && !/^(🧠|🚨|📥|✅)/.test(l.texto) && !/^(ayuda|comandos|reiniciar|prueba soy|bloquear)\b/i.test(l.texto));
const yo = L.find(l => l.id === a.msgId); if (yo && a.esAudio) yo.texto = a.texto;
if (!yo && !L.length) L = [{ id: a.msgId, ts: a.ts, quien: 'Cliente', texto: a.texto }];
const ref = yo ? yo.ts : a.ts - 60000;
if (L.some(l => l.ts > ref + 500 && l.id !== a.msgId)) return [];          // mandé algo más: contesta esa otra ejecución
let k = L.length - 1; while (k >= 0 && L[k].quien === 'Cliente') k--; const nuevos = L.slice(k + 1).map(l => l.texto);
return [{ json: { charla: L.slice(-40).map(l => '[' + hora(l.ts) + '] ' + l.quien + ': ' + l.texto).join('\n'), lineas: L.slice(-40), nuevos: nuevos.length ? nuevos : [a.texto], soy: a.soy } }];
""")
link(charla, leer_charla)
ctx2 = http("Olumi (cliente de la prueba)", (2660, 780), OLUMI, credkey="olumi", soft=True,
    body="={{ JSON.stringify({ modo: 'contexto', org: '%s', de: '+00000000', nombre: ($json.soy || '').split(/ de /i)[0] || '', empresa: ($json.soy || '').split(/ de /i).slice(1).join(' de ') }) }}" % ORG)
link(leer_charla, ctx2)
PENSAR = (
    "Sos Christian Barcos, jefe de operaciones de Phitel (instalaciones en Uruguay: fibra óptica, CCTV, cableado estructurado, control de acceso, porteros, redes, alarmas). "
    "Alguien te escribió por WhatsApp. Decidí si conviene responderle ahora y qué. Primero pensá, después escribí. "
    "Te paso la CHARLA REAL (en orden, con hora: Cliente o Asistente), LO NUEVO que dijo el cliente y lo que sabe OLUMI (cliente, tickets, visitas, presupuestos, notas internas, mails, cómo escribe Christian). "
    "Devolvé SOLO JSON: { \"ficha\": { \"quePide\": \"...\", \"carril\": \"soporte|comercial|administrativo|coordinar\", \"yaSabemos\": [ { \"dato\": \"direccion|fecha|hora|equipo|contacto|otro\", \"valor\": \"...\", \"fuente\": \"whatsapp 10:32 | mail | olumi\" } ], \"yaAcordado\": \"\", \"falta\": [\"solo lo imprescindible\"], \"pidioQueNoEscriba\": true|false }, "
    "\"responder\": true|false, \"porque\": \"una frase\", \"respuesta\": \"el texto exacto o ''\" }. "
    "REGLAS: "
    "1) Leé TODO antes de escribir. Lo que ya se dijo en cualquier lado (dirección, día, hora, equipo, qué pasó) va en yaSabemos y NO se vuelve a preguntar. Si ya quedó acordado ('vengan el jueves a las 11'), confirmalo, no lo preguntes. "
    "2) Si el cliente pidió que no le escriban más, o dijo que ya está, o que lo habla con otra persona: pidioQueNoEscriba=true y responder=false. "
    "3) Respondé solo si le sirve: una pregunta sin contestar, un pedido nuevo o algo urgente. Si lo último es 'ok', 'gracias', 'dale', un saludo de cierre o un dato que ya confirmamos: responder=false. "
    "4) Como mucho un dato por mensaje, y solo si sin eso no se puede avanzar. Si el Asistente ya lo pidió y no lo dio, no lo pidas de nuevo. "
    "5) Nunca inventes precios, fechas, horarios ni disponibilidad. Si no lo sabés: 'lo veo y te confirmo'. "
    "6) Escribí como Christian: rioplatense con voseo, 1 a 3 frases cortas, cálido y directo. Sin firma, sin 'a la brevedad', 'estimado', 'su solicitud', 'hemos recibido', sin números de ticket, sin decir que sos un asistente. "
    "7) Urgencias: decí que ya lo marcaste urgente y que lo llamás enseguida, sin prometer hora. "
    "8) Pedidos administrativos (carné de salud, facturas, documentos): decí que se lo pasás en un rato; nunca mandes documentos vos."
)
pensar = cerebro("Pensar la respuesta", (2880, 780), PENSAR,
    "={{ (($('Armar la charla de prueba').item.json.soy) ? 'QUIÉN ESCRIBE: ' + $('Armar la charla de prueba').item.json.soy + '\\n\\n' : '') + 'LO NUEVO QUE DIJO:\\n' + $('Armar la charla de prueba').item.json.nuevos.map(t => '- ' + t).join('\\n') + '\\n\\nCHARLA REAL (de la más vieja a la más nueva):\\n' + ($('Armar la charla de prueba').item.json.charla || '(sin mensajes anteriores)') + '\\n\\nOLUMI: ' + JSON.stringify($('Olumi (cliente de la prueba)').item.json.ok ? { ...$('Olumi (cliente de la prueba)').item.json, historial: undefined } : {}) }}")
link(ctx2, pensar)
control = code("Control antes de mandar", (3520, 780), r"""
// Frenos en código, iguales a los de la versión para clientes. En la prueba siempre te muestro qué haría y por qué.
const ch = $('Armar la charla de prueba').item.json, ctx = $('Olumi (cliente de la prueba)').item.json || {};
let j = {}; try { j = JSON.parse(String($json.choices[0].message.content).replace(/^```(json)?|```$/g, '').trim()); } catch (e) {}
const f = j.ficha || {}, r = String(j.respuesta || '').trim();
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const todo = norm((ch.charla || '') + ' ' + JSON.stringify(ctx.mails || []) + ' ' + JSON.stringify(ctx.notasInternas || []) + ' ' + (ctx.cliente?.direccion || ''));
const sabe = d => (f.yaSabemos || []).some(x => norm(x.dato).includes(d) && String(x.valor || '').trim());
const asis = (ch.lineas || []).filter(l => l.quien === 'Asistente').map(l => norm(l.texto));
const rn = norm(r), preg = /\?/.test(r), mot = [];
if (!j.responder || !r) mot.push(j.porque || 'no hace falta responder');
if (f.pidioQueNoEscriba) mot.push('el cliente pidió que no le escriban');
if (/(no (me )?(escriban|manden|mandes|escribas) mas|ya (esta|lo hable)|lo hablo con|deja(lo)? as[ií])/.test(norm(ch.nuevos.join(' ')))) mot.push('el cliente pidió parar');
const hayDir = sabe('direc') || !!ctx.cliente?.direccion || /\b(calle|avenida|av\.|bvar|bulevar|ruta|camino|esquina|esq\.)\b|\b[a-z]{4,} \d{3,4}\b/.test(todo);
const hayFecha = sabe('fecha') || sabe('hora') || /(nos vemos|quedamos|vengan|venite|pasen|paso|pasamos|vamos|voy)[^.\n]{0,40}\b(hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|\d{1,2}(:\d{2})? ?(hs|h|horas)?)\b/.test(todo);
if (preg && /(direccion|donde (queda|es|estan)|ubicacion|zona|barrio)/.test(rn) && (hayDir || asis.some(t => /direccion/.test(t)))) mot.push('iba a pedir la dirección y ya está');
if (preg && /(que dia|cuando|que hora|horario|a que hora|fecha)/.test(rn) && (hayFecha || asis.some(t => /(que dia|que hora|horario)/.test(t)))) mot.push('iba a preguntar día u hora y ya está hablado');
if (/a la brevedad|estimad|su solicitud|hemos recibido|ticket|\bt-\d+|numero de pedido|asistente virtual|inteligencia artificial|\bia\b/.test(rn)) mot.push('frase de robot');
const pal = t => new Set(norm(t).split(/[^a-z0-9]+/).filter(w => w.length > 3));
const par = (x, y) => { const A = pal(x), B = pal(y); if (!A.size || !B.size) return 0; let n = 0; A.forEach(w => { if (B.has(w)) n++ }); return n / Math.min(A.size, B.size) };
if (r && asis.some(t => par(t, r) > 0.45)) mot.push('se parece a algo que ya dijo');
const sabeTxt = (f.yaSabemos || []).map(x => x.dato + ': ' + x.valor).join(' · ');
const manda = mot.length === 0;
const texto = manda ? '🤖 ' + r : '🤖 (No le respondería: ' + mot.join('; ') + '.' + (r ? ' Había pensado: “' + r + '”' : '') + ')';
return [{ json: { ownerNum: $('Comandos y prueba').item.json.ownerNum, texto, nota: '🧠 ' + (f.quePide ? 'Pide: ' + f.quePide + '. ' : '') + (f.carril ? 'Carril: ' + f.carril + '. ' : '') + (sabeTxt ? 'Ya sé: ' + sabeTxt + '. ' : '') + ((f.falta || []).length ? 'Falta: ' + f.falta.join(', ') + '.' : '') } }];
""")
link(pensar, control)
mandar = http("Contestarme en mi chat", (3740, 780), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $json.ownerNum, text: $json.texto }) }}")
link(control, mandar)
anot = code("Anotar respuesta del asistente", (3960, 780), "const sd = $getWorkflowStaticData('global'); sd.auto = sd.auto || {}; const id = $json.key?.id; if (id) sd.auto[id] = Date.now(); return [{ json: { ownerNum: $('Control antes de mandar').item.json.ownerNum, nota: $('Control antes de mandar').item.json.nota } }];")
link(mandar, anot)
nota = http("Mostrarme cómo pensó", (4180, 780), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $json.ownerNum, text: $json.nota }) }}")
link(anot, nota)
anot2 = code("Anotar nota del asistente", (4400, 780), "const sd = $getWorkflowStaticData('global'); sd.auto = sd.auto || {}; const id = $json.key?.id; if (id) sd.auto[id] = Date.now(); return [];")
link(nota, anot2)

# ============ conectar WhatsApp a ESTE flujo (se corre una vez a mano: "Execute workflow" desde "Conectar WhatsApp") ============
man = node("Conectar WhatsApp a este flujo", "n8n-nodes-base.manualTrigger", 1, {}, (0, 1100))
setw = http("Evolution → mandar a este flujo", (240, 1100), f"{EVO}/webhook/set/{INST}", credkey="evo",
    body="={{ JSON.stringify({ webhook: { enabled: true, url: 'https://n8n.unitytech.uy/webhook/wa-christian', byEvents: false, base64: true, events: ['MESSAGES_UPSERT'] } }) }}")
link(man, setw)
findw = node("Ver a dónde manda Evolution", "n8n-nodes-base.httpRequest", 4.2, {"method": "GET", "url": f"{EVO}/webhook/find/{INST}", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "options": {}}, (480, 1100), credentials=cred("evo", "httpHeaderAuth"))
link(setw, findw)

wf = {"name": "Christian · WhatsApp (nuevo)", "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all", "timezone": "America/Montevideo"}}
print(json.dumps(wf, ensure_ascii=False, indent=1))
