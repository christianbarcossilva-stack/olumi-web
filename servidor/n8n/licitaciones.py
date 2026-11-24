#!/usr/bin/env python3
# Flujo NUEVO y separado: "Ventas · Licitaciones (prueba)". Primer paso del vendedor externo.
#   · Cada mañana de semana lee los llamados nuevos de Compras Estatales (datos abiertos, formato OCDS) y se queda con los del rubro
#     (cámaras, cableado, fibra, redes, control de acceso, porteros, alarmas, telefonía IP).
#   · Te manda el resumen a tu propio chat de WhatsApp: organismo, qué piden, cuándo cierra y el enlace. No le escribe a nadie más.
#   · No usa IA todavía: el nodo «Resumir el pliego (Claude)» queda apagado hasta que haya clave y tope en la consola de Claude.
#   · Recuerda lo que ya mandó (memoria del flujo), así no repite. La memoria solo se guarda en las corridas automáticas, no al probar a mano.
# Uso: python3 n8n/licitaciones.py credenciales.json > licitaciones.json
import json, sys, os

CR = json.load(open(sys.argv[1])) if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else {}
def cred(k, t):
    c = CR.get(k) or {"id": "", "name": k}
    return {t: {"id": c["id"], "name": c["name"]}}

EVO = "http://evolution:8080"
INST = "christian"
FEED = "http://www.comprasestatales.gub.uy/ocds/rss"

nodes, conns = [], {}
def node(name, typ, ver, params, pos, **extra):
    n = {"parameters": params, "name": name, "type": typ, "typeVersion": ver, "position": list(pos)}
    n.update(extra); nodes.append(n); return name
def link(a, b, out=0, inp=0):
    conns.setdefault(a, {"main": []})
    while len(conns[a]["main"]) <= out: conns[a]["main"].append([])
    conns[a]["main"][out].append({"node": b, "type": "main", "index": inp})
def code(name, pos, js, todos=True): return node(name, "n8n-nodes-base.code", 2, {"jsCode": js, **({} if todos else {"mode": "runOnceForEachItem"})}, pos)
def iff(name, pos, left):
    c = {"id": "c1", "leftValue": left, "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}
    return node(name, "n8n-nodes-base.if", 2.2, {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2}, "conditions": [c], "combinator": "and"}, "options": {}}, pos)
def get(name, pos, url, texto=False, credkey=None):
    p = {"url": url, "options": {"timeout": 60000, **({"response": {"response": {"responseFormat": "text"}}} if texto else {})}}
    kw = {"onError": "continueRegularOutput", "alwaysOutputData": True}
    if credkey: p["authentication"] = "genericCredentialType"; p["genericAuthType"] = "httpHeaderAuth"; kw["credentials"] = cred(credkey, "httpHeaderAuth")
    return node(name, "n8n-nodes-base.httpRequest", 4.2, p, pos, **kw)

# ============ disparadores ============
cada = node("Cada mañana (lunes a viernes, 7:40)", "n8n-nodes-base.scheduleTrigger", 1.2, {"rule": {"interval": [{"field": "cronExpression", "expression": "40 7 * * 1-5"}]}}, (0, 200))
probar = node("Probar ahora", "n8n-nodes-base.manualTrigger", 1, {}, (0, 400))

leer = get("Leer llamados (Compras Estatales)", (240, 300), FEED, texto=True)
link(cada, leer); link(probar, leer)

# ============ quedarse con los del rubro ============
RUBROS = r"""
const FUERTES = ['videovigilancia', 'cctv', 'cámaras de seguridad', 'camaras de seguridad', 'cámaras ip', 'camaras ip', 'nvr', 'dvr', 'cableado estructurado',
  'fibra óptica', 'fibra optica', 'red de datos', 'redes de datos', 'access point', 'puntos de acceso', 'wifi', 'wi-fi', 'control de acceso', 'molinete',
  'portero eléctrico', 'portero electrico', 'videoportero', 'intercomunicador', 'alarma', 'telefonía ip', 'telefonia ip', 'central telefónica', 'central telefonica',
  'rack', 'switch', 'utp', 'cat 6', 'cat6', 'patchera', 'sistema de seguridad electrónica', 'seguridad electronica'];
const DEBILES = ['cámaras', 'camaras', 'cableado', 'fibra', 'redes', 'telefonía', 'telefonia', 'datos', 'seguridad'];
const FUERA = ['fibra de vidrio', 'alimento', 'fibra textil', 'cámara frigorífica', 'camara frigorifica', 'neumático', 'neumatico', 'cámara de aire'];
"""
elegir = code("Elegir los del rubro", (480, 300), RUBROS + r"""
// el canal trae los últimos llamados como RSS: cada <item> con título, enlace y descripción
const xml = String(($input.first().json.data ?? $input.first().json.body ?? '') || '');
const tag = (s, t) => { const m = s.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>', 'i')); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').trim() : ''; };
const items = (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).map(s => ({ titulo: tag(s, 'title'), enlace: tag(s, 'link'), texto: tag(s, 'description'), fecha: tag(s, 'pubDate'), id: tag(s, 'guid') || tag(s, 'link') }));
const memo = $getWorkflowStaticData('global'); memo.vistos = memo.vistos || {};
const hoy = Date.now(), out = [];
for (const it of items) {
  if (!it.id || memo.vistos[it.id]) continue;
  const t = (it.titulo + ' ' + it.texto).toLowerCase();
  if (FUERA.some(k => t.includes(k))) continue;
  const fuertes = FUERTES.filter(k => t.includes(k)), debiles = DEBILES.filter(k => t.includes(k)), puntos = fuertes.length * 3 + debiles.length;
  if (puntos < 3) continue;
  out.push({ json: { ...it, puntos, porque: [...fuertes, ...debiles].slice(0, 5).join(', ') } });
}
// lo que se revisó queda anotado (también lo que no servía), y la memoria se limpia a los 60 días
for (const it of items) if (it.id && !memo.vistos[it.id]) memo.vistos[it.id] = hoy;
for (const k in memo.vistos) if (hoy - memo.vistos[k] > 60 * 864e5) delete memo.vistos[k];
out.sort((a, b) => b.json.puntos - a.json.puntos);
return out.length ? out.slice(0, 15) : [{ json: { nada: true, revisados: items.length } }];
""")
link(leer, elegir)
hay = iff("¿Hay alguno del rubro?", (720, 300), "={{ !$json.nada }}")
link(elegir, hay)

# ============ detalle de cada llamado (organismo, cierre, pliego) ============
detalle = get("Leer el llamado", (960, 200), "={{ $json.enlace }}")
link(hay, detalle, 0)
armar = code("Armar el resumen", (1200, 200), r"""
const base = $('Elegir los del rubro').all().map(i => i.json), det = $input.all().map(i => i.json);
const fmt = s => { if (!s) return ''; const d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleString('es-UY', { timeZone: 'America/Montevideo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); };
const lineas = base.map((b, i) => {
  const j = det[i] || {}, r = (j.releases && j.releases[0]) || (j.records && j.records[0] && (j.records[0].compiledRelease || j.records[0])) || j, t = r.tender || {};
  const quien = (r.buyer && r.buyer.name) || (t.procuringEntity && t.procuringEntity.name) || '';
  const que = t.title || b.titulo, cierra = fmt(t.tenderPeriod && t.tenderPeriod.endDate), tipo = t.procurementMethodDetails || '';
  const pliego = ((t.documents || []).find(d => /pliego/i.test((d.title || '') + ' ' + (d.documentType || ''))) || (t.documents || [])[0] || {}).url || '';
  return `${i + 1}. ${quien ? quien + ' · ' : ''}${que}` + (tipo || cierra ? `\n   ${[tipo, cierra && 'cierra ' + cierra].filter(Boolean).join(' · ')}` : '') + `\n   ${pliego || b.enlace}` + `\n   (por: ${b.porque})`;
});
return [{ json: { text: `📋 Licitaciones nuevas que pueden servir (${base.length})\n\n` + lineas.join('\n\n') + '\n\nModo prueba: nadie más recibe esto. Decime cuáles sirven y cuáles no, así afino los rubros.' } }];
""")
link(detalle, armar)

# ============ mandármelo a mi propio chat ============
yo = get("Mi número (Evolution)", (1440, 200), f"{EVO}/instance/fetchInstances?instanceName={INST}", credkey="evo")
link(armar, yo)
mandar = node("Mandarme el resumen", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": f"{EVO}/message/sendText/{INST}", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
    "sendBody": True, "specifyBody": "json", "options": {"timeout": 60000},
    "jsonBody": "={{ JSON.stringify({ number: String((([].concat($json))[0] || {}).ownerJid || (([].concat($json))[0] || {}).owner || '').split('@')[0], text: $('Armar el resumen').first().json.text }) }}"},
    (1680, 200), credentials=cred("evo", "httpHeaderAuth"), onError="continueRegularOutput")
link(yo, mandar)

# ============ apagado hasta tener la clave de Claude con tope ============
node("Resumir el pliego (Claude)", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": "https://api.anthropic.com/v1/messages", "authentication": "predefinedCredentialType", "nodeCredentialType": "anthropicApi",
    "sendHeaders": True, "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2023-06-01"}]},
    "sendBody": True, "specifyBody": "json", "options": {"timeout": 120000},
    "jsonBody": "={{ JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1200, system: 'Sos el vendedor de una empresa uruguaya de instalaciones (cámaras, cableado, fibra, redes, control de acceso). Resumí el llamado en español rioplatense, sin tecnicismos: qué piden, cantidades, plazo, garantía, visita obligatoria, fecha de apertura y si conviene presentarse. No inventes precios.', messages: [{ role: 'user', content: JSON.stringify($json).slice(0, 60000) }] }) }}"},
    (1200, 420), credentials=cred("anthropic", "anthropicApi"), disabled=True, notes="Se prende cuando esté la clave de la consola de Claude, en su propio espacio con tope de gasto.")

print(json.dumps({"name": "Ventas · Licitaciones (prueba)", "nodes": nodes, "connections": conns,
    "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all", "timezone": "America/Montevideo"}}, ensure_ascii=False, indent=1))
