# BORRADOR (lo corre christian.py con --clientes). El asistente también le contesta a CLIENTES, con frenos:
#   · Nace APAGADO. Se prende y se apaga desde el chat de Christian consigo mismo: «clientes si» / «clientes no».
#   · El estado y la plata gastada viven en la tabla de n8n «agente_christian» (no en la memoria del flujo,
#     que se pisa cuando corren dos mensajes a la vez).
#   · Tope por mes (tope_usd, 20 por defecto): aviso al llegar a aviso_usd y se apaga solo al llegar al tope.
#   · Solo contesta si: es cliente conocido de Olumi, el clasificador está SEGURO, es soporte/comercial/coordinar,
#     no es urgente (lo urgente te lo avisa a vos), Christian no escribió en esa charla en las últimas 2 horas,
#     no se la pasó a Christian en las últimas 24 horas y no mandó ya 6 respuestas hoy en esa charla.
#   · Espera 4 minutos a que el cliente termine de escribir. Pasa los MISMOS frenos en código que el modo prueba.
#   · Lo que manda al cliente termina con una marca invisible (U+2063; U+2064 si se lo pasó a Christian):
#     así, leyendo la charla real, se sabe qué escribió el asistente y qué escribió Christian, sin memoria compartida.
#   · Todo lo que contesta te lo avisa en tu chat («🤖 Le contesté a …»).
# Cerebro: el mismo del modo prueba (Gemini y, si no responde, Groq). Cuando haya clave de Claude se cambia acá.
DT = {"__rl": True, "mode": "id", "value": "Wpi0MlXsbweJMwTr", "cachedResultName": "agente_christian"}
MARCA, MARCA_PASE = "⁣", "⁤"
# precio por millón de tokens, contado de más a propósito (así el tope nunca se pasa por cuenta corta)
USD_ENTRA, USD_SALE = 0.30, 2.50

def tabla_leer(name, pos):
    return node(name, "n8n-nodes-base.dataTable", 1.1, {"resource": "row", "operation": "get", "dataTableId": DT, "returnAll": True},
                pos, executeOnce=True, alwaysOutputData=True)
def tabla_cambiar(name, pos):
    return node(name, "n8n-nodes-base.dataTable", 1.1, {"resource": "row", "operation": "update", "dataTableId": DT, "matchType": "allConditions",
        "filters": {"conditions": [{"keyName": "clave", "condition": "eq", "keyValue": "={{ $json.clave }}"}]},
        "columns": {"mappingMode": "defineBelow", "value": {"valor": "={{ $json.valor }}"}, "matchingColumns": [],
                    "schema": [{"id": "valor", "displayName": "valor", "required": False, "defaultMatch": False, "display": True, "type": "string", "canBeUsedToMatch": True}],
                    "attemptToConvertTypes": False, "convertFieldsToString": False}, "options": {}}, pos)
def js_de(name): return next(n for n in nodes if n["name"] == name)["parameters"]

# ---- 0) lo que manda el asistente a un cliente vuelve como "mío": se guarda en Olumi con 🤖 adelante ----
p = js_de("Leer mensaje")
p["jsCode"] = p["jsCode"].replace(
    "const tipo = self ? 'prueba' : fromMe ? 'mio' : 'cliente';",
    "const tipo = self ? 'prueba' : fromMe ? 'mio' : 'cliente';\nconst deBot = fromMe && !self && /[\\u2063\\u2064]$/.test(text);"
).replace("ownerNum: owner.replace(/@.*/, ''), text,", "ownerNum: owner.replace(/@.*/, ''), text: deBot ? '🤖 ' + text.replace(/[\\u2063\\u2064]+$/, '') : text,")
assert "deBot ?" in p["jsCode"]

# ---- 1) comandos nuevos en mi chat ----
p = js_de("Comandos y prueba")
p["jsCode"] = p["jsCode"].replace("return [{ json: { ...m, comando: false,", r"""const cam = (clave, valor, t) => [{ json: { ...m, respuesta: '🤖 ' + t, comando: true, cambio: { clave, valor } } }];
if (/^(clientes si|encender clientes|prender clientes)$/.test(low)) return cam('encendido', 'si', 'Prendido: ahora le contesto solo a clientes conocidos cuando estoy seguro. Para apagar: «clientes no».');
if (/^(clientes no|apagar clientes)$/.test(low)) return cam('encendido', 'no', 'Apagado: a los clientes no les contesto nada; todo sigue yendo a la bandeja.');
const tp = low.match(/^tope (\d{1,3})$/); if (tp) return cam('tope_usd', tp[1], 'Tope del mes: US$ ' + tp[1] + '. Al llegar, me apago solo y te aviso.');
if (/^(estado|gasto)$/.test(low)) return [{ json: { ...m, comando: true, consulta: true } }];
return [{ json: { ...m, comando: false,""", 1)
assert "clientes si" in p["jsCode"]
# «estado» no contesta en el nodo de siempre: lee la tabla primero
p = js_de("Contestar el comando")
p["jsonBody"] = "={{ $json.consulta ? JSON.stringify({}) : JSON.stringify({ number: $json.ownerNum, text: $json.respuesta }) }}"
cmd_cambia = iff("¿Cambia algo del agente?", (2000, 460), "={{ !!$json.cambio }}")
link("¿Es un comando?", cmd_cambia, 0)
cmd_guardar = code("Separar el cambio", (2220, 400), "return $input.all().map(i => ({ json: i.json.cambio }));")
link(cmd_cambia, cmd_guardar, 0)
link(cmd_guardar, tabla_cambiar("Guardar el cambio", (2440, 400)))
cmd_consulta = iff("¿Pide el estado?", (2220, 520), "={{ !!$json.consulta }}")
link(cmd_cambia, cmd_consulta, 1)
link(cmd_consulta, tabla_leer("Leer el estado (comando)", (2440, 520)), 0)
cmd_est = code("Armar el estado", (2660, 520), r"""
const e = Object.fromEntries($input.all().map(i => [i.json.clave, i.json.valor])); const mes = new Date().toISOString().slice(0, 7);
const g = e.mes === mes ? Number(e.gasto_usd || 0) : 0;
return [{ json: { ownerNum: $('Comandos y prueba').item.json.ownerNum, texto: '🤖 Contestar a clientes: ' + (e.encendido === 'si' ? 'PRENDIDO' : 'apagado') + '. Gasto de este mes: US$ ' + g.toFixed(2) + ' de ' + (e.tope_usd || 20) + ' (aviso en ' + (e.aviso_usd || 15) + '). Comandos: «clientes si», «clientes no», «tope 20».' } }];
""")
link("Leer el estado (comando)", cmd_est)
link(cmd_est, http("Mandarme el estado", (2880, 520), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $json.ownerNum, text: $json.texto }) }}"))

# ---- 2) cliente: después de anotarlo en la bandeja, ¿le contesto solo? ----
est = tabla_leer("Leer el estado del agente", (3080, 300))
link("A la bandeja de Olumi", est)
filtro = code("¿Le contesto solo?", (3300, 300), r"""
const e = Object.fromEntries($input.all().map(i => [i.json.clave, i.json.valor]));
const a = $('Armar entrada de bandeja').item.json, m = $('¿Quién escribe?').item.json, ctx = $('Contexto en Olumi').item.json || {};
let c = {}; try { c = JSON.parse(String($('Clasificar').item.json.choices[0].message.content).replace(/^```(json)?|```$/g, '').trim()); } catch (x) {}
const mes = new Date().toISOString().slice(0, 7), gasto = e.mes === mes ? Number(e.gasto_usd || 0) : 0;
const conocido = !!(ctx.registrado || (ctx.quienEs && ctx.quienEs.cliente));
if (e.encendido !== 'si') return [];                                   // apagado (así nace)
if (gasto >= Number(e.tope_usd || 20)) return [];                       // llegó al tope del mes
if (!conocido || c.seguro !== true) return [];                          // solo clientes conocidos y clasificación segura
if (!['soporte', 'comercial', 'coordinar'].includes(a.carril)) return [];  // lo administrativo lo ve Christian
if (a.urgente || $('A la bandeja de Olumi').item.json.repetido) return [];  // lo urgente te lo aviso a vos
return [{ json: { jid: m.jid, num: m.from, ownerNum: m.ownerNum, msgId: m.msgId, texto: m.texto, esAudio: m.esAudio, ts: m.ts, nombre: a.nombre || m.nombre || '' } }];
""")
link(est, filtro)
espera_c = node("Esperar 4 minutos", "n8n-nodes-base.wait", 1.1, {"amount": 4, "unit": "minutes"}, (3520, 300), webhookId="olumi-espera-clientes")
link(filtro, espera_c)
charla_c = http("Leer la charla del cliente", (3740, 300), f"{EVO}/chat/findMessages/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ where: { key: { remoteJid: $json.jid } }, page: 1, offset: 40, limit: 40 }) }}")
link(espera_c, charla_c)
armar_c = code("Armar la charla del cliente", (3960, 300), r"""
// Cliente = lo que escribe él; Asistente = lo que termina con la marca invisible; Christian = lo demás que salió de este celular.
const a = $('¿Le contesto solo?').item.json;
let recs = []; for (const r of $input.all().map(i => i.json)) { const x = r.messages?.records || r.records || r.messages || (Array.isArray(r) ? r : []); if (Array.isArray(x)) recs.push(...x); }
const txt = mm => { const m = mm.message || {}; return m.conversation || m.extendedTextMessage?.text || (m.audioMessage ? '🎤 audio' : '') || (m.imageMessage ? '📷 foto' + (m.imageMessage.caption ? ': ' + m.imageMessage.caption : '') : '') || ''; };
const tsOf = mm => { const t = Number(mm.messageTimestamp?.low ?? mm.messageTimestamp ?? 0); return t > 1e12 ? t : t * 1000; };
const seen = new Set(); recs = recs.filter(r => r && r.key && !seen.has(r.key.id) && seen.add(r.key.id)).sort((x, y) => tsOf(x) - tsOf(y));
const hora = t => new Date(t).toLocaleString('es-UY', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Montevideo' });
let L = recs.map(r => { const t = String(txt(r) || ''); const bot = r.key.fromMe && /[⁣⁤]$/.test(t);
  return { id: r.key.id, ts: tsOf(r), quien: !r.key.fromMe ? 'Cliente' : bot ? 'Asistente' : 'Christian', pase: /⁤$/.test(t), texto: t.replace(/[⁣⁤]+$/, '').slice(0, 600) }; }).filter(l => l.texto);
const yo = L.find(l => l.id === a.msgId); if (yo && a.esAudio) yo.texto = a.texto;
if (!yo) L.push({ id: a.msgId, ts: a.ts, quien: 'Cliente', texto: a.texto });
const ref = yo ? yo.ts : a.ts - 60000, ahora = Date.now();
if (L.some(l => l.quien === 'Cliente' && l.ts > ref + 500 && l.id !== a.msgId)) return [];         // escribió algo más: contesta esa otra ejecución
const ultChr = Math.max(0, ...L.filter(l => l.quien === 'Christian').map(l => l.ts));
if (ahora - ultChr < 2 * 3600e3) return [];                                                        // Christian está en la charla
const ultPase = Math.max(0, ...L.filter(l => l.pase).map(l => l.ts));
if (ultPase > ultChr && ahora - ultPase < 24 * 3600e3) return [];                                  // ya se la pasé a Christian
const hoy = new Date().toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' });
if (L.filter(l => l.quien === 'Asistente' && new Date(l.ts).toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' }) === hoy).length >= 6) return [];  // ya contestó mucho hoy
let k = L.length - 1; while (k >= 0 && L[k].quien === 'Cliente') k--; const nuevos = L.slice(k + 1).map(l => l.texto);
return [{ json: { ...a, charla: L.slice(-40).map(l => '[' + hora(l.ts) + '] ' + l.quien + ': ' + l.texto).join('\n'), lineas: L.slice(-40), nuevos: nuevos.length ? nuevos : [a.texto] } }];
""")
link(charla_c, armar_c)
PENSAR_C = PENSAR + (" ESTA CHARLA ES REAL, con un cliente: en la CHARLA, «Christian» es lo que escribió él en persona y «Asistente» lo que escribiste vos antes. "
    "Si Christian ya dijo algo, no lo contradigas ni lo repitas. Ante cualquier duda, pasarAPersona=true.")
pensar_c = cerebro("Pensar la respuesta al cliente", (4180, 300), PENSAR_C,
    "={{ 'QUIÉN ESCRIBE: ' + ($('Armar la charla del cliente').item.json.nombre || '') + ' (+' + $('Armar la charla del cliente').item.json.num + ')\\n\\nLO NUEVO QUE DIJO:\\n' + $('Armar la charla del cliente').item.json.nuevos.map(t => '- ' + t).join('\\n') + '\\n\\nCHARLA REAL (de la más vieja a la más nueva):\\n' + ($('Armar la charla del cliente').item.json.charla || '(sin mensajes anteriores)') + '\\n\\nOLUMI: ' + JSON.stringify($('Contexto en Olumi').item.json.ok ? { ...$('Contexto en Olumi').item.json, historial: undefined } : {}) }}")
link(armar_c, pensar_c)

# los MISMOS frenos que el modo prueba: se copian del nodo «Control antes de mandar»
base = js_de("Control antes de mandar")["jsCode"]
i0 = base.index("const norm = ")
i1 = base.index("mot.push('se parece a algo que ya dijo');") + len("mot.push('se parece a algo que ya dijo');")
FRENOS = base[i0:i1]
control_c = code("Frenos antes de contestarle", (4840, 300), r"""
const ch = $('Armar la charla del cliente').item.json, ctx = $('Contexto en Olumi').item.json || {}, raw = $json;
let j = {}; try { j = JSON.parse(String(raw.choices[0].message.content).replace(/^```(json)?|```$/g, '').trim()); } catch (e) {}
const f = j.ficha || {}, r = String(j.respuesta || '').trim();
const u = raw.usage || {}, costo = ((u.prompt_tokens || 0) * %s + (u.completion_tokens || 0) * %s) / 1e6;
""" % (USD_ENTRA, USD_SALE) + FRENOS + r"""
const manda = mot.length === 0;
const quien = (ch.nombre || 'cliente') + ' (+' + ch.num + ')';
const aviso = manda ? '🤖 Le contesté a ' + quien + ': «' + r + '»' + (j.pasarAPersona ? '\n🚨 Te lo paso a vos: ' + (j.motivoPase || 'conviene que lo veas') + '. No le escribo más en esta charla hasta que escribas vos.' : '')
  : (j.pasarAPersona ? '🚨 ' + quien + ' necesita que lo veas vos: ' + (j.motivoPase || j.porque || '') + '. No le contesté.' : '');
return [{ json: { num: ch.num, ownerNum: ch.ownerNum, manda, texto: r + (j.pasarAPersona ? '⁤' : '⁣'), aviso, costo, porque: mot.join('; ') } }];
""")
link(pensar_c, control_c)
releer = tabla_leer("Releer el estado", (5060, 300))
link(control_c, releer)
cuentas = code("Cuentas del mes", (5280, 300), r"""
// se vuelve a leer la tabla justo antes de mandar: si lo apagaste en estos 4 minutos, no sale nada
const e = Object.fromEntries($input.all().map(i => [i.json.clave, i.json.valor])), c = $('Frenos antes de contestarle').item.json;
const mes = new Date().toISOString().slice(0, 7), antes = e.mes === mes ? Number(e.gasto_usd || 0) : 0, ahora = antes + c.costo;
const tope = Number(e.tope_usd || 20), avisoUsd = Number(e.aviso_usd || 15);
const cambios = [{ clave: 'gasto_usd', valor: ahora.toFixed(4) }, { clave: 'mes', valor: mes }];
let extra = '';
if (ahora >= tope) { cambios.push({ clave: 'encendido', valor: 'no' }); extra = '\n⛔ Llegué al tope del mes (US$ ' + tope + '): me apagué solo. Para seguir: «tope 30» y «clientes si».'; }
else if (antes < avisoUsd && ahora >= avisoUsd) extra = '\n⚠️ Ya gasté US$ ' + ahora.toFixed(2) + ' este mes (tope ' + tope + ').';
const sigue = e.encendido === 'si';
return [{ json: { ...c, manda: c.manda && sigue, aviso: (sigue ? c.aviso : '') + extra, cambios } }];
""")
link(releer, cuentas)
link(code("Separar las cuentas", (5500, 460), "return $input.first().json.cambios.map(x => ({ json: x }));"), tabla_cambiar("Guardar las cuentas", (5720, 460)))
link(cuentas, "Separar las cuentas")
si_manda = iff("¿Sale la respuesta?", (5500, 240), "={{ $json.manda }}")
link(cuentas, si_manda)
al_cliente = http("Contestarle al cliente", (5720, 200), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $json.num, text: $json.texto }) }}")
link(si_manda, al_cliente, 0)
hay_aviso = iff("¿Hay algo para avisarme?", (5940, 300), "={{ !!$('Cuentas del mes').item.json.aviso }}")
link(al_cliente, hay_aviso); link(si_manda, hay_aviso, 1)
link(hay_aviso, http("Avisarme qué hizo", (6160, 260), f"{EVO}/message/sendText/{INST}", credkey="evo", soft=True,
    body="={{ JSON.stringify({ number: $('Cuentas del mes').item.json.ownerNum, text: $('Cuentas del mes').item.json.aviso }) }}"), 0)
