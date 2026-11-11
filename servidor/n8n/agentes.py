#!/usr/bin/env python3
# Dos flujos SEPARADOS, uno por empleada virtual (cada uno se cambia sin tocar el otro):
#   · "Carolina · atención comercial" (antes Lumi) → webhook /webhook/lumi
#   · "Gabriela · administración" (antes Ada)    → webhook /webhook/ada
# Los llama la app (Menú → Lumi y Ada). Cada pedido trae el token de la sesión de Olumi:
#   1) se verifica el token con Supabase (quién es) y 2) que sea de esa empresa y con un rol que pueda usarla.
#   Sin eso, no se piensa nada (responde 401/403).
# Cerebro: Gemini (gratis) y, si no responde, Groq. Nunca manda nada para afuera: solo contesta a la app.
# Uso: python3 n8n/agentes.py credenciales.json lumi > lumi.json   (o "ada")
import json, sys, re, os

CR = json.load(open(sys.argv[1])) if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else {}
QUIEN = sys.argv[2] if len(sys.argv) > 2 else "lumi"
def cred(k, t):
    c = CR.get(k) or {"id": "", "name": k}
    return {t: {"id": c["id"], "name": c["name"]}}

H = os.path.dirname(os.path.abspath(__file__))
cfg = open(os.path.join(H, "..", "..", "olumi-web", "olumi", "app", "config.js"), encoding="utf-8").read()
SUPA = re.search(r"supabaseUrl:\s*'([^']+)'", cfg).group(1)
PUB = re.search(r"supabaseAnonKey:\s*'([^']+)'", cfg).group(1)       # clave publicable (pública, va en la app)
GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"
GEMINI_CHAT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMINI_MODEL = "gemini-3.8-flash"

ROLES = {"lumi": ["owner", "admin", "encargado", "ventas"], "ada": ["owner", "admin", "encargado", "administracion"]}

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
def http(name, pos, url, body=None, credkey=None, credtype="httpHeaderAuth", soft=False, method="POST", headers=None):
    p = {"method": method, "url": url, "options": {"timeout": 60000}}
    if credkey == "groq": credtype = "groqApi"; p["authentication"] = "predefinedCredentialType"; p["nodeCredentialType"] = "groqApi"
    elif credkey: p["authentication"] = "genericCredentialType"; p["genericAuthType"] = credtype
    if headers: p["sendHeaders"] = True; p["headerParameters"] = {"parameters": [{"name": k, "value": v} for k, v in headers]}
    if body is not None: p["sendBody"] = True; p["specifyBody"] = "json"; p["jsonBody"] = body
    kw = {"credentials": cred(credkey, credtype)} if credkey else {}
    if soft: kw.update({"onError": "continueRegularOutput", "alwaysOutputData": True})
    return node(name, "n8n-nodes-base.httpRequest", 4.2, p, pos, **kw)
def cerebro(name, pos, system_expr):
    """Gemini primero; si no responde, Groq. system/user salen de $json.system / $json.user."""
    x, y = pos
    body = lambda model, extra: "={{ JSON.stringify({ model: '%s', temperature: 0.3, %s response_format: { type: 'json_object' }, messages: [ { role: 'system', content: $json.system }, { role: 'user', content: $json.user } ] }) }}" % (model, extra)
    gem = http(name + " (Gemini)", (x, y), GEMINI_CHAT, body=body(GEMINI_MODEL, ""), credkey="gemini", soft=True)
    for n in nodes:
        if n["name"] == gem: n["retryOnFail"] = True; n["maxTries"] = 2; n["waitBetweenTries"] = 2000
    ok = iff(name + " · ¿respondió Gemini?", (x + 220, y), "={{ !!($json.choices && $json.choices[0] && $json.choices[0].message && $json.choices[0].message.content) }}")
    gq_in = code(name + " · pasar a Groq", (x + 440, y + 180), "return [{ json: $('Armar el pedido').item.json }];")
    gq = http(name + " (Groq)", (x + 660, y + 180), GROQ_CHAT, body=body(GROQ_MODEL, "reasoning_effort: 'medium',"), credkey="groq", soft=True)
    out = code(name, (x + 880, y), "return $input.all();")
    link(gem, ok); link(ok, out, 0); link(ok, gq_in, 1); link(gq_in, gq); link(gq, out)
    ENTRY[name] = gem
    return name
def responder(name, pos, code_expr="={{ $json.status || 200 }}"):
    return node(name, "n8n-nodes-base.respondToWebhook", 1.1, {"respondWith": "json", "responseBody": "={{ JSON.stringify($json.body) }}",
        "options": {"responseCode": code_expr, "responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}}, pos)

# ===================== los cerebros =====================
LUMI = r"""Sos Carolina, de atención comercial (asistente virtual) de una empresa uruguaya de instalaciones (cámaras, alarmas, redes, Wi-Fi, fibra, control de acceso).
Hablás en español rioplatense, cálida y profesional, con mensajes cortos como de WhatsApp (máximo 4 renglones). Tuteás o voseás ("vos").
AHORA ESTÁS EN PRÁCTICA: quien te escribe es alguien del equipo haciendo de cliente. Atendelo como a un cliente real.

REGLAS (en este orden):
1. RELEVAR SIN REPETIR. Leé TODO el historial. Nunca preguntes algo que ya contestó o que se deduce. Como mucho 2 preguntas por mensaje.
   Lo que hay que saber para cotizar (usá también "preguntas" de los parámetros): qué equipos y cuántos; dónde (interior/exterior, dirección o barrio);
   altura de montaje (más de 4 m necesita medio de elevación); si el cableado va por arriba, por cañería o subterráneo; distancias aproximadas al rack o al grabador;
   si ya tiene grabador/red; horario en que se puede trabajar.
2. TRABAJO CHICO Y CONCRETO (cantidades claras, hasta ~3 días de trabajo según "rendimiento"): armá "borrador".
   - Materiales: SOLO del catálogo, con el nombre y el precio EXACTOS del catálogo. Si falta algo en el catálogo, poné precio 0 y en "nota" decí qué falta.
   - Mano de obra: líneas "Mano de obra (día técnico)" con cant = días × técnicos y precio = precioDiaTecnico; si hace falta elevación, "Medio de elevación (día)" con precioDiaElevador.
   - Calculá los días con "rendimiento"; si no está, estimá prudente y aclaralo en "nota".
   - Al cliente decile que en breve le llega el presupuesto (NO le digas el total: primero lo aprueba el equipo).
3. TRABAJO GRANDE O ABIERTO (obra, varios lugares, más de ~3 días, mucha incertidumbre, o no podés cotizar con lo que sabés): NO cotices.
   Devolvé "escalar" con pregunta "¿Relevamos o cotizo?" y un resumen de lo que sabés. Al cliente decile que lo consultás con el equipo técnico y que le proponés fechas para ir a ver el lugar.
   NUNCA propongas fechas vos: eso recién después de que el equipo diga que sí.
4. Nunca inventes precios, plazos, garantías ni stock. No prometas nada que no esté en los datos.
5. Si te preguntan si sos una persona o un bot, decí la verdad: sos la asistente virtual de la empresa y una persona del equipo revisa todo.
6. Si el mensaje no es de ventas (un reclamo, una falla), decí que lo pasás a soporte y no cotices.
7. AGENDA DE UN PROYECTO. Es un pedido interno: quien te lo pide es alguien del equipo y ahí NO está haciendo de cliente; contestale como a un compañero. Si te piden proponer la agenda, las fechas o el cronograma de un proyecto o trabajo, devolvé "agenda" (con "borrador" y "escalar" en null). A un cliente nunca le des fechas por tu cuenta.
   - Necesitás saber: qué hay que hacer, cuánta gente va y qué materiales lleva. Si falta alguno de esos tres datos, preguntalo y no armes la agenda todavía.
   - Usá "datos.agenda": "hoy" y "diaDeHoy" para ubicar las fechas; "tecnicos" (cada uno con los días que ya tiene "ocupado"); "proyectos" (los que están en curso); "stock" (materiales en depósito). Calculá cuántos días lleva con "rendimiento".
   - Solo días hábiles (lunes a viernes), empezando no antes de mañana. Nunca pongas a una persona un día que figura ocupado. Usá los nombres EXACTOS de "tecnicos". Si no te dicen quiénes van, elegí a los que estén libres.
   - Una línea por día de trabajo: fecha, hora de inicio, horas y qué se hace ese día.
   - Materiales: compará lo que te dicen que lleva el trabajo con "datos.agenda.stock" (lo que hay hoy en depósito). En "faltan" poné lo que no alcanza (con cuánto falta) y lo que no figura en el stock. No inventes existencias.
   - En "respuesta" resumí la propuesta en 2 o 3 renglones y aclará que queda en "Para aprobar": nada se agenda hasta que alguien del equipo la apruebe.

Respondé SOLO un JSON:
{"respuesta":"lo que le contestás al cliente",
 "ficha":{"quePide":"","donde":"","equipos":"","altura":"","cableado":"","distancias":"","falta":["lo que todavía no sabés"]},
 "borrador":null o {"titulo":"corto","cliente":"nombre si lo dijo","moneda":"USD o UYU","lineas":[{"desc":"","cant":1,"unidad":"unidad|día|m","precio":0}],"nota":"supuestos y lo que falta"},
 "escalar":null o {"pregunta":"¿Relevamos o cotizo?","resumen":"lo que pide y lo que sabés, en 2-3 renglones"},
 "agenda":null o {"titulo":"corto","proyecto":"nombre del proyecto si lo hay","cliente":"","dias":[{"fecha":"AAAA-MM-DD","hora":"09:00","horas":8,"tecnicos":["nombre exacto"],"tarea":"qué se hace ese día"}],"faltan":["material a confirmar o pedir"],"nota":"supuestos"}}"""

ADA = r"""Sos Gabriela, de administración (asistente virtual) de una empresa uruguaya de instalaciones. Te escribe alguien del equipo (no un cliente).
Español rioplatense, directa y cordial, respuestas cortas y concretas.
Respondé SOLO con lo que está en "datos" (personal, vencimientos de carnés, documentos cargados, facturas pendientes, gastos sin revisar). Si no está, decilo y sugerí dónde cargarlo en Olumi (Personal, Facturación o Gastos).
- Fechas: hoy es "datos.hoy". Un carné vence pronto si faltan menos de 30 días; vencido si la fecha ya pasó.
- Si te piden un documento de una persona (cédula, carné de salud, carné de altura, libreta), devolvelo en "docs" con la persona y el tipo:
  tipo = "cedula" | "salud" | "altura" | "libreta" | "otro". Solo si figura en "documentos" de esa persona; si no está cargado, decilo.
- Nunca mandás nada para afuera: si te piden enviarlo a alguien, decí que dejás el documento listo acá para que lo manden ustedes.
- No des datos de sueldos ni cuentas bancarias.
Respondé SOLO un JSON: {"respuesta":"", "docs":[{"persona":"nombre como figura","tipo":"salud"}]}"""

SYS = {"lumi": LUMI, "ada": ADA}[QUIEN]
NOMBRE = {"lumi": "Carolina · atención comercial", "ada": "Gabriela · administración"}[QUIEN]

# ===================== el flujo =====================
wh = node("Pedido desde la app", "n8n-nodes-base.webhook", 2, {"httpMethod": "POST", "path": QUIEN, "responseMode": "responseNode",
    "options": {"allowedOrigins": "*"}}, (0, 300), webhookId="olumi-ag-" + QUIEN)
leer = code("Leer el pedido", (220, 300), r"""
const b = $json.body || {};
const tok = String(b.token || ''), org = String(b.org || '');
const ok = !!(tok.length > 20 && /^[0-9a-f-]{36}$/i.test(org) && typeof b.mensaje === 'string' && b.mensaje.trim());
return [{ json: { ok, token: tok, org, mensaje: String(b.mensaje || '').slice(0, 2000), quien: String(b.quien || '').slice(0, 60),
  historial: (Array.isArray(b.historial) ? b.historial : []).slice(-16).map(m => ({ rol: m.rol === 'yo' ? 'yo' : 'agente', texto: String(m.texto || '').slice(0, 1200) })),
  datos: b.datos && typeof b.datos === 'object' ? b.datos : {} } }];
""")
link(wh, leer)
okp = iff("¿Viene bien?", (440, 300), "={{ $json.ok }}")
link(leer, okp)
bad = code("Pedido incompleto", (660, 520), "return [{ json: { status: 400, body: { respuesta: 'El pedido llegó incompleto. Cerrá y volvé a abrir Olumi.' } } }];")
link(okp, bad, 1)
r400 = responder("Responder (incompleto)", (880, 520)); link(bad, r400)

user = http("¿Quién es? (Supabase)", (660, 300), f"{SUPA}/auth/v1/user", method="GET", soft=True,
    headers=[("apikey", PUB), ("Authorization", "={{ 'Bearer ' + $json.token }}")])
link(okp, user, 0)
mem = http("¿Es de la empresa?", (880, 300), f"{SUPA}/rest/v1/members", method="GET", soft=True,
    headers=[("apikey", PUB), ("Authorization", "={{ 'Bearer ' + $('Leer el pedido').item.json.token }}")])
for n in nodes:
    if n["name"] == mem:
        n["parameters"]["url"] = "={{ '%s/rest/v1/members?select=role&org_id=eq.' + $('Leer el pedido').item.json.org + '&user_id=eq.' + ($('¿Quién es? (Supabase)').item.json.id || 'x') }}" % SUPA
link(user, mem)
puede = code("¿Puede usar a " + QUIEN.capitalize() + "?", (1100, 300), r"""
const R = %s;
const uid = $('¿Quién es? (Supabase)').item.json.id;
const rows = $input.all().map(i => i.json).filter(r => r && r.role);
const rol = rows.length ? rows[0].role : '';
return [{ json: { puede: !!uid && R.includes(rol), rol, uid: uid || '' } }];
""" % json.dumps(ROLES[QUIEN]))
link(mem, puede)
pp = iff("¿Tiene permiso?", (1320, 300), "={{ $json.puede }}")
link(puede, pp)
no = code("Sin permiso", (1540, 520), "return [{ json: { status: $('¿Quién es? (Supabase)').item.json.id ? 403 : 401, body: { respuesta: $('¿Quién es? (Supabase)').item.json.id ? 'Tu rol no puede usar a esta asistente. Pedíselo al dueño de la empresa.' : 'Tu sesión venció. Cerrá y volvé a entrar a Olumi.' } } }];")
link(pp, no, 1)
r403 = responder("Responder (sin permiso)", (1760, 520)); link(no, r403)

armar = code("Armar el pedido", (1540, 300), r"""
const p = $('Leer el pedido').item.json;
const SYS = %s;
const hist = p.historial.map(m => (m.rol === 'yo' ? 'CLIENTE/EQUIPO: ' : 'VOS: ') + m.texto).join('\n');
const user = 'DATOS DE LA EMPRESA (JSON):\n' + JSON.stringify(p.datos).slice(0, 60000) + '\n\nQUIÉN ESCRIBE: ' + (p.quien || 'alguien del equipo') +
  '\n\nCHARLA HASTA AHORA:\n' + (hist || '(empieza ahora)') + '\n\nMENSAJE NUEVO:\n' + p.mensaje;
return [{ json: { system: SYS, user } }];
""" % json.dumps(SYS, ensure_ascii=False))
link(pp, armar, 0)
cer = cerebro("Pensar", (1760, 300), None)
link(armar, cer)

if QUIEN == "lumi":
    salida_js = r"""
const raw = $json.choices?.[0]?.message?.content || '';
let r = {}; try { r = JSON.parse(String(raw).replace(/^```(json)?|```$/g, '').trim()) } catch (e) { r = {} }
if (!r.respuesta) return [{ json: { status: 200, body: { respuesta: 'Ahora no pude pensar la respuesta (los cerebros gratis están ocupados). Probá de nuevo en un minuto.' } } }];
const num = v => { const n = Number(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0 };
let b = r.borrador && Array.isArray(r.borrador.lineas) && r.borrador.lineas.length ? r.borrador : null;
if (b) b = { titulo: String(b.titulo || 'Presupuesto').slice(0, 80), cliente: String(b.cliente || '').slice(0, 80), moneda: b.moneda === 'UYU' ? 'UYU' : 'USD', nota: String(b.nota || '').slice(0, 500),
  lineas: b.lineas.slice(0, 40).map(l => ({ desc: String(l.desc || '').slice(0, 140), cant: num(l.cant) || 1, unidad: String(l.unidad || 'unidad').slice(0, 12), precio: num(l.precio) })) };
let ag = r.agenda && Array.isArray(r.agenda.dias) && r.agenda.dias.length ? r.agenda : null;
if (ag) ag = { titulo: String(ag.titulo || 'Agenda propuesta').slice(0, 80), proyecto: String(ag.proyecto || '').slice(0, 120), cliente: String(ag.cliente || '').slice(0, 80), nota: String(ag.nota || '').slice(0, 500),
  faltan: (Array.isArray(ag.faltan) ? ag.faltan : []).slice(0, 20).map(x => String(x).slice(0, 120)),
  dias: ag.dias.slice(0, 40).filter(d => d && /^\d{4}-\d\d-\d\d$/.test(String(d.fecha || ''))).map(d => ({ fecha: String(d.fecha), hora: /^\d\d:\d\d$/.test(String(d.hora || '')) ? String(d.hora) : '09:00', horas: num(d.horas) || 8,
    tecnicos: (Array.isArray(d.tecnicos) ? d.tecnicos : []).slice(0, 8).map(x => String(x).slice(0, 60)), tarea: String(d.tarea || '').slice(0, 140) })) };
if (ag && !ag.dias.length) ag = null;
const e = r.escalar && r.escalar.resumen ? { pregunta: String(r.escalar.pregunta || '¿Relevamos o cotizo?').slice(0, 80), resumen: String(r.escalar.resumen).slice(0, 600) } : null;
// freno: si escala, no cotiza
return [{ json: { status: 200, body: { respuesta: String(r.respuesta).slice(0, 1200), ficha: r.ficha || {}, borrador: e || ag ? null : b, escalar: e, agenda: e ? null : ag } } }];
"""
else:
    salida_js = r"""
const raw = $json.choices?.[0]?.message?.content || '';
let r = {}; try { r = JSON.parse(String(raw).replace(/^```(json)?|```$/g, '').trim()) } catch (e) { r = {} }
if (!r.respuesta) return [{ json: { status: 200, body: { respuesta: 'Ahora no pude pensar la respuesta (los cerebros gratis están ocupados). Probá de nuevo en un minuto.' } } }];
const T = ['cedula', 'salud', 'altura', 'libreta', 'otro'];
const docs = (Array.isArray(r.docs) ? r.docs : []).filter(d => d && d.persona && T.includes(d.tipo)).slice(0, 6).map(d => ({ persona: String(d.persona).slice(0, 80), tipo: d.tipo }));
return [{ json: { status: 200, body: { respuesta: String(r.respuesta).slice(0, 1500), docs } } }];
"""
sal = code("Armar la respuesta", (2860, 300), salida_js)
link(cer, sal)
rok = responder("Responder a la app", (3080, 300)); link(sal, rok)

wf = {"name": NOMBRE, "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all", "timezone": "America/Montevideo"}}
print(json.dumps(wf, ensure_ascii=False, indent=1))
