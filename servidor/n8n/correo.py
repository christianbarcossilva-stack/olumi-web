#!/usr/bin/env python3
# Flujo NUEVO y separado: "Christian · Correo" (la parte de mail del asistente viejo, ahora sola).
#   · Cada mail real va a la BANDEJA de Olumi con carril y urgencia; te avisa por WhatsApp. No contesta mails solo ni crea tickets solo.
# (cabecera común con christian.py)
#   · Lo que le escriben a Christian va a la BANDEJA de Olumi, marcado con de dónde vino y qué tan urgente es.
#     Nunca pasa a ticket solo (Christian lo pasa con el botón) y NUNCA le contesta a un cliente: no hay camino para eso.
#   · Modo prueba: en su chat con él mismo, Christian le escribe como si fuera un cliente y el asistente le contesta ahí
#     (con 🤖 adelante), leyendo la charla real, armando la ficha y pasando los frenos en código.
#   · Bloqueados en el código (ni se anotan ni se contestan): familia, pareja, equipo de Phitel y grupos.
#   · Sin correo: el mail va en otro flujo (el disparador de correo trababa el prender/apagar de n8n).
# Uso: python3 n8n/correo.py credenciales.json > correo.json
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


# ============ correo → bandeja de Olumi (nunca contesta solo, nunca ticket solo) ============
imap = node("Mail nuevo", "n8n-nodes-base.emailReadImap", 2, {"mailbox": "INBOX", "postProcessAction": "read", "options": {"forceReconnect": 60}}, (0, 400), credentials=cred("imap", "imap"))
filtro = code("Filtrar mails", (240, 800), r"""
// Deja pasar solo mails de personas (no avisos automáticos ni publicidad)
const j = $json; const from = String(j.from || '').toLowerCase(); const subj = String(j.subject || '');
const h = j.headers || {};
if (/no-?reply|noreply|notificacion|notification|newsletter|mailer|daemon|bounce|facebook|instagram|mercadolibre|mercadopago/.test(from)) return [];
if (h['list-unsubscribe'] || h['precedence'] === 'bulk' || /^(auto|out of office|fuera de la oficina)/i.test(subj)) return [];
const crudo = (j.textPlain || j.text || String(j.textHtml || j.html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' '));
// separa lo nuevo (arriba) del historial citado (abajo): "El ... escribió:", "De:", "From:", "-------- Mensaje Original", líneas con ">"
const corte = crudo.search(/(^|\n)\s*(El .{3,80} escribi[oó]:|On .{3,80} wrote:|-{3,} ?(Mensaje original|Original Message|Forwarded message|Mensaje reenviado).*|De: .+\n|From: .+\n|>\s)/i);
const ultimo = (corte > 40 ? crudo.slice(0, corte) : crudo).replace(/\s+/g, ' ').trim();
const historial = (corte > 40 ? crudo.slice(corte) : '').replace(/^>+\s?/gm, '').replace(/\s+/g, ' ').trim();
const texto = (ultimo + (historial ? '\n\n[Historial del hilo] ' + historial : '')).trim();
const fromMail = (String(j.from || '').match(/<([^>]+)>/) || [])[1] || String(j.from || '');
const interno = /@phi\.com\.uy$/i.test(fromMail) || /@unitytech\.uy$/i.test(fromMail);   // mails propios o de compañeros: se registran, nunca se contestan solos
const reenvio = /^(fwd?|rv|tr):/i.test(subj);
const to = String(j.to || h['to'] || ''), cc = String(j.cc || h['cc'] || '');
const paraMi = /cbarcos@phi\.com\.uy/i.test(to) || (!to && !cc);           // en "Para:"; si no hay cabeceras, se asume que sí
const enCopia = !paraMi && /cbarcos@phi\.com\.uy/i.test(cc);
const meNombran = /\b(christian|cristian|cbarcos)\b/i.test(ultimo);
const giancarloRespondio = /giancarlo|@phi\.com\.uy/i.test(historial);
const otroDePhitel = /@phi\.com\.uy/i.test(to + ' ' + cc) && !/cbarcos@phi\.com\.uy/i.test(to);
return [{ json: { paraMi, enCopia, meNombran, giancarloRespondio, otroDePhitel, from: fromMail, fromName: String(j.from || '').replace(/<.*/, '').replace(/"/g, '').trim(), replyTo: (String(j.replyTo || '').match(/<([^>]+)>/) || [])[1] || '', subject: subj, texto: texto.slice(0, 6000), ultimo: ultimo.slice(0, 3000), historial: historial.slice(0, 5000), messageId: h['message-id'] || j.messageId || '', interno, reenvio } }];
""")
link(imap, filtro)
ctx = http("Contexto en Olumi", (480, 400), OLUMI, credkey="olumi", soft=True,
    body="={{ JSON.stringify({ modo: 'contexto', org: '%s', email: $json.from, nombre: $json.fromName }) }}" % ORG)
link(filtro, ctx)
CLASIF = (
    "Clasificás un mail que le llegó a cbarcos@phi.com.uy (Christian, jefe de operaciones de Phitel: instalaciones en Uruguay, fibra óptica, CCTV, cableado, control de acceso, porteros, redes, alarmas). "
    "No escribís respuesta. Usá el ÚLTIMO MENSAJE (el historial es solo contexto) y el CONTEXTO de Olumi. Devolvé SOLO JSON: "
    "{ \"esPedido\": true|false (false si es publicidad, aviso automático, factura de un proveedor o no pide nada), \"carril\": \"soporte\" | \"comercial\" | \"administrativo\" | \"coordinar\" | \"proveedor\" | \"spam\", "
    "\"urgencia\": \"alta\" | \"media\" | \"baja\" (alta solo si algo dejó de funcionar y afecta la operación), \"nombre\": \"quien firma o ''\", \"empresa\": \"empresa o lugar o ''\", "
    "\"titulo\": \"máximo 60 letras\", \"resumen\": \"máximo 3 líneas: qué piden, lugar, fecha o monto si lo dicen, y lo ya acordado en el hilo\", \"avisarme\": true|false (true si Christian tiene que hacer algo) }."
)
cla = cerebro("Clasificar el mail", (720, 400), CLASIF,
    "={{ 'MAIL de ' + $('Filtrar mails').item.json.fromName + ' <' + $('Filtrar mails').item.json.from + '>\\nAsunto: ' + $('Filtrar mails').item.json.subject + '\\n\\nÚLTIMO MENSAJE: ' + $('Filtrar mails').item.json.ultimo + ($('Filtrar mails').item.json.historial ? '\\n\\nHISTORIAL (contexto): ' + $('Filtrar mails').item.json.historial.slice(0, 3000) : '') + '\\n\\nCONTEXTO OLUMI: ' + JSON.stringify({ cliente: $json.cliente || null, ticketsAbiertos: $json.ticketsAbiertos || [] }) + '\\nDESTINATARIOS: ' + JSON.stringify({ paraMi: $('Filtrar mails').item.json.paraMi, enCopia: $('Filtrar mails').item.json.enCopia, interno: $('Filtrar mails').item.json.interno }) }}")
link(ctx, cla)
arm = code("Armar entrada de bandeja", (1360, 400), r"""
const f = $('Filtrar mails').item.json; let j = {}; try { j = JSON.parse(String($json.choices[0].message.content).replace(/^```(json)?|```$/g, '').trim()); } catch (e) {}
if (j.esPedido === false || ['spam'].includes(j.carril)) return [];
const carril = ['soporte','comercial','administrativo','coordinar','proveedor'].includes(j.carril) ? j.carril : 'soporte';
const urg = ['alta','media','baja'].includes(j.urgencia) ? j.urgencia : 'media';
const tipoEntrada = { soporte: 'falla', comercial: 'presupuesto', administrativo: 'consulta', coordinar: 'trabajo', proveedor: 'proveedor' }[carril];
return [{ json: { modo: 'registrar', registrar: true, org: '%s', de: '', email: f.from, nombre: j.nombre || f.fromName, empresa: j.empresa || '', texto: 'Asunto: ' + f.subject + '\n\n' + f.texto.slice(0, 3500),
  resumen: j.resumen || '', titulo: j.titulo || f.subject, intencion: carril, tema: carril, tipoEntrada, tipo: urg === 'alta' ? 'emergencia' : 'consulta', destino: 'bandeja', urgente: urg === 'alta',
  canal: 'mail', origen: 'Correo de Christian', carril, urgencia: urg, msgId: f.messageId, respuestaAuto: '', avisarme: (j.avisarme !== false || urg === 'alta') && !(f.enCopia && !f.meNombran) } }];
""" % ORG)
link(cla, arm)
olumi_in = http("A la bandeja de Olumi", (1580, 400), OLUMI, credkey="olumi", soft=True, body="={{ JSON.stringify($json) }}")
link(arm, olumi_in)
av_if = iff("¿Avisarme?", (1800, 400), "={{ $('Armar entrada de bandeja').item.json.avisarme && !$json.repetido }}")
link(olumi_in, av_if)
num = node("Mi número", "n8n-nodes-base.httpRequest", 4.2, {"method": "GET", "url": f"{EVO}/instance/fetchInstances?instanceName={INST}", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "options": {}}, (2020, 340), credentials=cred("evo", "httpHeaderAuth"))
link(av_if, num, 0)
aviso = http("Avisarme por WhatsApp", (2240, 340), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ (() => { const inst = Array.isArray($json) ? $json[0] : ($json.instance || $json); const n = String(inst.ownerJid || inst.owner || '').replace(/@.*/, ''); const a = $('Armar entrada de bandeja').item.json; return JSON.stringify({ number: n, text: (a.urgente ? '🚨 ' : '📥 ') + 'Mail · ' + (a.empresa || a.nombre || a.email) + ' · ' + (a.titulo || '') + '\\n' + (a.resumen || '') + '\\nQuedó en la bandeja de Olumi.' }); })() }}")
link(num, aviso)

wf = {"name": "Christian · Correo (nuevo)", "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all", "timezone": "America/Montevideo"}}
print(json.dumps(wf, ensure_ascii=False, indent=1))
