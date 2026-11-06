#!/usr/bin/env python3
# Flujo SEPARADO: "Tickets · WhatsApp (número de soporte)". QUEDA APAGADO hasta que avisen a los clientes del número nuevo.
#   · Es para un número de WhatsApp aparte (instancia "tickets" en Evolution), no para el de Christian.
#   · Espera a que el cliente termine de escribir (4 min; 1 min si suena urgente), lee TODA la charla y lo que sabe Olumi,
#     y crea el ticket (o suma el mensaje al ticket abierto). Le contesta UNA vez con el número de pedido y, si hace falta,
#     un solo dato que falte. Nunca repite preguntas, nunca inventa fechas ni precios.
#   · Si el cliente pide que no le escriban, deja de contestar a ese número (se sigue anotando en Olumi).
#   · Bloqueados: familia, pareja y equipo de Phitel (ni se anotan ni se contestan). Grupos y estados: no.
# Uso: python3 n8n/tickets.py credenciales.json > tickets.json
import json, sys, os

CR = json.load(open(sys.argv[1])) if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else {}
def cred(k, t):
    c = CR.get(k) or {"id": "", "name": k}
    return {t: {"id": c["id"], "name": c["name"]}}

ORG = "2c84e6c2-5507-4aa6-9f6d-3b66060739c3"
EVO = "http://evolution:8080"
INST = "tickets"
OLUMI = "https://pgriavmcmscchxdnfglv.supabase.co/functions/v1/entrada"
GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions"
GROQ_AUDIO = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = "openai/gpt-oss-120b"
GEMINI_CHAT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMINI_MODEL = "gemini-3.8-flash"
BLOQUEADOS = {"59899119340": "Mamá", "59896700019": "Sofía", "59899240460": "Giancarlo (Phitel)", "59892179190": "Victor (Phitel)"}

nodes, conns, ENTRY = [], {}, {}
def node(name, typ, ver, params, pos, **extra):
    n = {"parameters": params, "name": name, "type": typ, "typeVersion": ver, "position": list(pos)}
    n.update(extra); nodes.append(n); return name
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
def cerebro(name, pos, system, user_expr):
    x, y = pos
    body = lambda model, extra: "={{ JSON.stringify({ model: '%s', temperature: 0.2, %s response_format: { type: 'json_object' }, messages: [ { role: 'system', content: %s }, { role: 'user', content: %s } ] }) }}" % (model, extra, json.dumps(system, ensure_ascii=False), user_expr)
    gem = http(name + " (Gemini)", (x, y), GEMINI_CHAT, body=body(GEMINI_MODEL, ""), credkey="gemini", soft=True)
    for n in nodes:
        if n["name"] == gem: n["retryOnFail"] = True; n["maxTries"] = 2; n["waitBetweenTries"] = 3000
    ok = iff(name + " · ¿respondió Gemini?", (x + 220, y), "={{ !!($json.choices && $json.choices[0] && $json.choices[0].message && $json.choices[0].message.content) }}")
    gq = http(name + " (Groq)", (x + 440, y + 180), GROQ_CHAT, body=body(GROQ_MODEL, "reasoning_effort: 'medium',"), credkey="groq", soft=True)
    out = code(name, (x + 660, y), "return $input.all();")
    link(gem, ok); link(ok, out, 0); link(ok, gq, 1); link(gq, out)
    ENTRY[name] = gem
    return name

wh = node("WhatsApp del número de tickets", "n8n-nodes-base.webhook", 2, {"httpMethod": "POST", "path": "wa-tickets", "responseMode": "onReceived", "options": {}}, (0, 300), webhookId="olumi-wa-tickets")
leer = code("Leer mensaje", (220, 300), r"""
const BLOQ = %s;
const b = $json.body || $json; const ev = String(b.event || '').toLowerCase().replace('_', '.');
if (!ev.includes('messages.upsert')) return [];
const d = b.data || {}, key = d.key || {}, jid = String(key.remoteJid || '');
if (!/@s\.whatsapp\.net$/.test(jid) || key.fromMe) return [];            // grupos/estados no; lo que manda el número tampoco
const num = jid.replace(/@.*/, ''), m = d.message || {};
const sd = $getWorkflowStaticData('global'); sd.bloq = sd.bloq || {};
if (BLOQ[num] || sd.bloq[num]) return [];
const text = (m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || '').trim();
const audioB64 = m.audioMessage ? (m.base64 || d.base64 || '') : '';
const foto = !!m.imageMessage, doc = !!m.documentMessage;
if (!text && !audioB64 && !foto && !doc) return [];
const urg = /(urgente|no anda|no funciona|se cay|caid|sin (internet|señal|camaras|imagen)|no graba|alarma sonando|no abre|robo|incendio|ya mismo)/i.test(text);
return [{ json: { jid, from: num, text: text || (foto ? '📷 (mandó una foto)' : doc ? '📎 (mandó un archivo)' : ''), audioB64, msgId: key.id || '', nombre: String(d.pushName || '').trim(), ts: Date.now(), urgPrevia: urg } }];
""" % json.dumps(BLOQUEADOS))
link(wh, leer)
es_audio = iff("¿Es audio?", (440, 300), "={{ !!$json.audioB64 }}")
link(leer, es_audio)
tofile = node("Audio a archivo", "n8n-nodes-base.convertToFile", 1.1, {"operation": "toBinary", "sourceProperty": "audioB64", "options": {"fileName": "audio.ogg", "mimeType": "audio/ogg"}}, (660, 200))
link(es_audio, tofile, 0)
trans = http("Transcribir audio", (880, 200), GROQ_AUDIO, credkey="groq", soft=True, extra={
    "sendBody": True, "contentType": "multipart-form-data",
    "bodyParameters": {"parameters": [{"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"},
        {"name": "model", "value": "whisper-large-v3-turbo"}, {"name": "language", "value": "es"}, {"name": "response_format", "value": "json"}]}})
link(tofile, trans)
t_audio = code("Texto del audio", (1100, 200), "const m = $('Leer mensaje').item.json; const t = String($json.text || '').trim(); return [{ json: { ...m, audioB64: undefined, texto: t || '(audio que no se pudo leer)', esAudio: true, urgPrevia: m.urgPrevia || /(urgente|no anda|no funciona|se cay|sin internet)/i.test(t) } }];")
link(trans, t_audio)
t_texto = code("Texto escrito", (660, 400), "return [{ json: { ...$json, texto: $json.text, esAudio: false } }];")
link(es_audio, t_texto, 1)
cuanto = code("Cuánto esperar", (1320, 300), "return [{ json: { ...$json, espera: $json.urgPrevia ? 60 : 240 } }];")
link(t_audio, cuanto); link(t_texto, cuanto)
espera = node("Esperar a que termine de escribir", "n8n-nodes-base.wait", 1.1, {"amount": "={{ $json.espera }}", "unit": "seconds"}, (1540, 300), webhookId="olumi-espera-tickets")
link(cuanto, espera)
charla = http("Leer la charla (Evolution)", (1760, 300), f"{EVO}/chat/findMessages/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ where: { key: { remoteJid: $('Cuánto esperar').item.json.jid } }, page: 1, offset: 60, limit: 60 }) }}")
link(espera, charla)
armar = code("Armar la charla", (1980, 300), r"""
const a = $('Cuánto esperar').item.json, sd = $getWorkflowStaticData('global'); sd.auto = sd.auto || {}; sd.parar = sd.parar || {};
let recs = []; for (const r of $input.all().map(i => i.json)) { const x = r.messages?.records || r.records || r.messages || (Array.isArray(r) ? r : []); if (Array.isArray(x)) recs.push(...x); }
const txt = mm => { const m = mm.message || {}; return m.conversation || m.extendedTextMessage?.text || (m.audioMessage ? '🎤 audio' : '') || (m.imageMessage ? '📷 foto' : '') || ''; };
const tsOf = mm => { const t = Number(mm.messageTimestamp?.low ?? mm.messageTimestamp ?? 0); return t > 1e12 ? t : t * 1000; };
const seen = new Set(); recs = recs.filter(r => r && r.key && !seen.has(r.key.id) && seen.add(r.key.id)).sort((x, y) => tsOf(x) - tsOf(y));
const hora = t => new Date(t).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Montevideo' });
let L = recs.map(r => ({ id: r.key.id, ts: tsOf(r), quien: r.key.fromMe ? 'Nosotros' : 'Cliente', texto: String(txt(r) || '').slice(0, 600) })).filter(l => l.texto);
const yo = L.find(l => l.id === a.msgId); if (yo && a.esAudio) yo.texto = a.texto;
if (!L.length) L = [{ id: a.msgId, ts: a.ts, quien: 'Cliente', texto: a.texto }];
const ref = yo ? yo.ts : a.ts - 60000;
if (L.some(l => l.quien === 'Cliente' && l.ts > ref + 500 && l.id !== a.msgId)) return [];   // escribió algo más: lo toma esa otra ejecución
let k = L.length - 1; while (k >= 0 && L[k].quien === 'Cliente') k--; const nuevos = L.slice(k + 1).map(l => l.texto);
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
if (/(no (me )?(escriban|manden|mandes|escribas|contesten) mas|dejen de (escribir|mandar)|no quiero (mas )?mensajes|stop|basta)/.test(norm(nuevos.join(' ')))) sd.parar[a.from] = Date.now();
return [{ json: { ...a, texto: nuevos.join('\n') || a.texto, charla: L.slice(-40).map(l => '[' + hora(l.ts) + '] ' + l.quien + ': ' + l.texto).join('\n'), parar: !!sd.parar[a.from] } }];
""")
link(charla, armar)
ctx = http("Contexto en Olumi", (2200, 300), OLUMI, credkey="olumi", soft=True,
    body="={{ JSON.stringify({ modo: 'contexto', org: '%s', de: '+' + $json.from, nombre: $json.nombre }) }}" % ORG)
link(armar, ctx)
CLASIF = (
    "Leés una charla de WhatsApp que entró al número de soporte de Phitel (instalaciones en Uruguay: fibra, CCTV, cableado, control de acceso, porteros, redes, alarmas). "
    "Usá TODA la charla y lo que sabe Olumi. No inventes nada. Devolvé SOLO JSON: "
    "{ \"carril\": \"soporte\" | \"comercial\" | \"administrativo\" | \"coordinar\" | \"personal\" | \"spam\", \"urgencia\": \"alta\" | \"media\" | \"baja\", "
    "\"nombre\": \"\", \"empresa\": \"\", \"titulo\": \"máx 60 letras\", \"resumen\": \"1-2 frases: lugar, equipo, desde cuándo, lo acordado\", "
    "\"yaSabemos\": [\"datos que ya dio o que están en Olumi\"], \"falta\": \"UN solo dato imprescindible para ir, o ''\", \"pidioQueNoEscriba\": true|false }. "
    "alta = algo dejó de funcionar y afecta la operación. falta: nunca algo que ya esté en la charla o en Olumi (dirección, contacto, equipo)."
)
cla = cerebro("Entender el pedido", (2420, 300), CLASIF,
    "'CHARLA:\\n' + $('Armar la charla').item.json.charla + '\\n\\nLO NUEVO:\\n' + $('Armar la charla').item.json.texto + '\\n\\nOLUMI: ' + JSON.stringify({ cliente: $('Contexto en Olumi').item.json.cliente || null, ticketsAbiertos: $('Contexto en Olumi').item.json.ticketsAbiertos || [], historial: ($('Contexto en Olumi').item.json.historial || []).slice(-8) })")
link(ctx, cla)
reg = code("Armar el ticket", (3300, 300), r"""
const m = $('Armar la charla').item.json; let j = {}; try { j = JSON.parse(String($json.choices[0].message.content).replace(/^```(json)?|```$/g, '').trim()); } catch (e) {}
const carril = ['soporte','comercial','administrativo','coordinar','personal','spam'].includes(j.carril) ? j.carril : 'soporte';
if (carril === 'spam') return [];
const urg = ['alta','media','baja'].includes(j.urgencia) ? j.urgencia : (m.urgPrevia ? 'alta' : 'media');
const tipoEntrada = { soporte: 'falla', comercial: 'presupuesto', administrativo: 'consulta', coordinar: 'trabajo', personal: 'consulta' }[carril];
const aTicket = carril === 'soporte' || carril === 'coordinar';                     // lo comercial y administrativo va a la bandeja
return [{ json: { modo: 'registrar', registrar: true, autor: 'cliente', org: '%s', de: '+' + m.from, nombre: j.nombre || m.nombre, empresa: j.empresa || '',
  texto: (m.esAudio ? '🎤 ' : '') + m.texto, resumen: j.resumen || '', titulo: j.titulo || '', intencion: carril, tema: carril, tipoEntrada, tipo: urg === 'alta' ? 'emergencia' : 'consulta',
  destino: aTicket ? 'ticket' : 'bandeja', urgente: urg === 'alta', canal: 'whatsapp', origen: 'WhatsApp de soporte', carril, urgencia: urg, msgId: m.msgId, esAudio: m.esAudio,
  _falta: String(j.falta || '').slice(0, 120), _parar: m.parar || !!j.pidioQueNoEscriba, _from: m.from } }];
""" % ORG)
link(cla, reg)
olumi_in = http("Crear en Olumi", (3520, 300), OLUMI, credkey="olumi", soft=True,
    body="={{ JSON.stringify(Object.fromEntries(Object.entries($json).filter(([k]) => !k.startsWith('_')))) }}")
link(reg, olumi_in)
control = code("Control antes de contestar", (3740, 300), r"""
// Frenos en código: una sola respuesta por pedido nuevo, nada si pidió parar, nada si es un mensaje repetido.
const t = $('Armar el ticket').item.json, r = $json || {}, sd = $getWorkflowStaticData('global'); sd.ult = sd.ult || {};
if (!r.ok || r.repetido || t._parar) return [];
const ahora = Date.now(), ult = sd.ult[t._from] || 0;
let texto = '';
if (r.nuevo) texto = String(r.respuesta || '');
else if (ahora - ult > 2 * 3600e3) texto = String(r.respuesta || '');            // sumado a un pedido abierto: como mucho un aviso cada 2 h
if (!texto) return [];
if (r.nuevo && t._falta) texto += '\n¿Me pasás ' + t._falta.replace(/^(el|la|los|las)\s+/i, (x) => x.toLowerCase()).replace(/[?.]+$/, '') + '?';
if (/a la brevedad/i.test(texto) && t.urgente) texto = texto.replace(/Te respondemos a la brevedad\.?/i, 'Te contactamos enseguida.');
sd.ult[t._from] = ahora;
return [{ json: { number: t._from, text: texto } }];
""")
link(olumi_in, control)
mandar = http("Contestar al cliente", (3960, 300), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $json.number, text: $json.text }) }}")
link(control, mandar)

# conectar el número a este flujo (correr a mano una vez, cuando exista la instancia "tickets")
man = node("Conectar el número de tickets a este flujo", "n8n-nodes-base.manualTrigger", 1, {}, (0, 800))
setw = http("Evolution → mandar a este flujo", (240, 800), f"{EVO}/webhook/set/{INST}", credkey="evo",
    body="={{ JSON.stringify({ webhook: { enabled: true, url: 'https://n8n.unitytech.uy/webhook/wa-tickets', byEvents: false, base64: true, events: ['MESSAGES_UPSERT'] } }) }}")
link(man, setw)

wf = {"name": "Tickets · WhatsApp de soporte (apagado)", "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all", "timezone": "America/Montevideo"}}
print(json.dumps(wf, ensure_ascii=False, indent=1))
