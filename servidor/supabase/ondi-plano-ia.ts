// Ondi · leer un plano con IA: recibe la imagen del plano (la misma que queda de fondo en la maqueta) y devuelve
// los galpones, oficinas y calles que encuentra, con sus esquinas en coordenadas de la imagen (0 a 1). La maqueta
// los muestra como propuesta y la instaladora elige cuáles crear. No guarda nada.
// Solo para la instaladora (miembros de la empresa que no son del cliente).
// Publicar: Supabase → Edge Functions → «ondi-plano-ia» → pegar este archivo (verify_jwt desactivado: valida la sesión adentro).
// Necesita el secreto ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets). La clave la crea el dueño de la cuenta en console.anthropic.com.
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict: string, legacy: string) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const ANON_KEY = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY') as string;
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY') as string;
const MODELO = Deno.env.get('ONDI_PLANO_MODELO') || 'claude-sonnet-5-5';
const STAFF_OUT = ['cliente', 'pendiente'];
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const PT = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 };
const HERRAMIENTA = {
  name: 'plano',
  description: 'Lo que se ve en el plano: edificios, calles internas, el giro de los edificios y una medida escrita que sirva de escala.',
  input_schema: {
    type: 'object',
    properties: {
      giro: { type: 'number', description: 'Grados que están girados los edificios principales respecto de la horizontal de la imagen, entre -45 y 45 (positivo = sentido de las agujas del reloj). 0 si están derechos.' },
      galpones: { type: 'array', description: 'Cada edificio techado: galpones, naves, oficinas, porterías, depósitos.', items: { type: 'object', properties: {
        nombre: { type: 'string', description: 'El nombre o número que tiene escrito en el plano, si lo tiene (ej.: «Nave 3», «E5», «Oficinas»).' },
        tipo: { type: 'string', enum: ['galpon', 'oficina', 'porteria', 'otro'] },
        esquinas: { type: 'array', description: 'Las 4 esquinas en orden, cada una [x, y]: x de 0 (borde izquierdo) a 1 (borde derecho) e y de 0 (borde de arriba) a 1 (borde de abajo) de la imagen.', items: PT, minItems: 4, maxItems: 4 },
        alto_m: { type: 'number', description: 'Altura en metros si el plano la indica.' } }, required: ['esquinas'] } },
      calles: { type: 'array', description: 'Calles, caminos internos, playas de maniobra largas. El eje de cada una, punto por punto.', items: { type: 'object', properties: {
        nombre: { type: 'string' }, ancho_m: { type: 'number' },
        puntos: { type: 'array', items: PT, minItems: 2, description: 'Puntos del eje, cada uno [x, y] como en las esquinas.' } }, required: ['puntos'] } },
      medida: { type: 'object', description: 'Una cota o medida escrita en el plano que sirva para la escala (por ejemplo el largo de un galpón). Omitir si no hay ninguna.', properties: { desde: PT, hasta: PT, metros: { type: 'number' } }, required: ['desde', 'hasta', 'metros'] },
      nota: { type: 'string', description: 'Una frase corta, en español rioplatense, con lo que no se pudo leer bien.' } },
    required: ['galpones', 'calles', 'giro'] } };

const PROMPT = `Este es el plano de un predio (un parque logístico, un depósito, una planta o una oficina) que una empresa de instalaciones va a pasar a una maqueta 3D.
Encontrá cada edificio techado (galpones, naves, oficinas, porterías) y las calles o caminos internos.
- Las coordenadas son relativas a la imagen: x de 0 (izquierda) a 1 (derecha), y de 0 (arriba) a 1 (abajo). Sé preciso con las esquinas: seguí el borde exterior de cada edificio.
- Si un edificio tiene nombre o número escrito, ponelo.
- Ignorá textos, rótulos, carátula, norte, árboles, autos y mobiliario.
- Si hay una cota escrita (una medida con su línea), devolvé una en «medida».
Usá la herramienta «plano» para responder.`;

const n01 = (v: unknown) => Math.min(1, Math.max(0, Number(v) || 0));
const pt = (p: unknown) => Array.isArray(p) && p.length >= 2 ? [n01(p[0]), n01(p[1])] : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL') as string;
  const body = await req.json().catch(() => ({}));
  const userDb = createClient(url, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const { org } = body;
  if (!org || !/^[0-9a-f-]{36}$/i.test(String(org))) return json({ error: 'Falta la empresa.' }, 400);
  const db = createClient(url, SERVICE_KEY);
  const { data: mem } = await db.from('members').select('role').eq('org_id', org).eq('user_id', user.id).maybeSingle();
  if (!mem || STAFF_OUT.includes(mem.role)) return json({ error: 'Solo la instaladora puede leer planos.' }, 403);

  const KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!KEY) return json({ error: 'Falta cargar la clave de la IA en el servidor (ANTHROPIC_API_KEY).' }, 503);
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.imagen || ''));
  if (!m) return json({ error: 'El plano tiene que ser una imagen JPG o PNG.' }, 400);
  if (m[3].length > 7_000_000) return json({ error: 'El plano es muy pesado: achicalo a menos de 5 MB.' }, 413);

  let r: Response;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELO, max_tokens: 8000, tools: [HERRAMIENTA], tool_choice: { type: 'tool', name: 'plano' },
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[3] } }, { type: 'text', text: PROMPT }] }] }) });
  } catch (_) { return json({ error: 'No se pudo llegar a la IA. Probá de nuevo en un rato.' }, 502); }
  const out = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: r.status === 401 ? 'La clave de la IA no es válida.' : r.status === 429 ? 'La IA está ocupada: probá en un minuto.' : 'La IA no pudo leer el plano (' + r.status + ').' }, 502);
  const uso = (out.content || []).find((c: { type: string }) => c.type === 'tool_use');
  const x = (uso && uso.input) || {};

  const galpones = (Array.isArray(x.galpones) ? x.galpones : []).slice(0, 80).map((g: Record<string, unknown>) => {
    const es = (Array.isArray(g.esquinas) ? g.esquinas : []).map(pt).filter(Boolean); if (es.length < 3) return null;
    return { nombre: String(g.nombre || '').slice(0, 40), tipo: ['galpon', 'oficina', 'porteria', 'otro'].includes(String(g.tipo)) ? g.tipo : 'galpon', esquinas: es, alto: Number(g.alto_m) > 2 && Number(g.alto_m) < 40 ? Number(g.alto_m) : null };
  }).filter(Boolean);
  const calles = (Array.isArray(x.calles) ? x.calles : []).slice(0, 40).map((c: Record<string, unknown>) => {
    const ps = (Array.isArray(c.puntos) ? c.puntos : []).slice(0, 60).map(pt).filter(Boolean); if (ps.length < 2) return null;
    return { nombre: String(c.nombre || '').slice(0, 40), ancho: Number(c.ancho_m) > 2 && Number(c.ancho_m) < 40 ? Number(c.ancho_m) : null, puntos: ps };
  }).filter(Boolean);
  const md = x.medida && pt(x.medida.desde) && pt(x.medida.hasta) && Number(x.medida.metros) > 0 ? { desde: pt(x.medida.desde), hasta: pt(x.medida.hasta), metros: Number(x.medida.metros) } : null;
  const giro = Math.max(-45, Math.min(45, Number(x.giro) || 0));
  return json({ galpones, calles, giro, medida: md, nota: String(x.nota || '').slice(0, 300) });
});
