// Piezas que usan las recetas: IA (con respaldo y tope de gasto), audio a texto, WhatsApp (Evolution) y Olumi.
// Las claves salen de la empresa dueña del flujo (ctx.clave), nunca del código.
const OLUMI = 'https://pgriavmcmscchxdnfglv.supabase.co/functions/v1/entrada';
const PRECIO = { entrada: 0.3, salida: 2.5 };   // US$ por millón de tokens, redondeado para arriba a propósito
const IA = {
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', modelo: 'gemini-3.8-flash' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', modelo: 'openai/gpt-oss-120b', extra: { reasoning_effort: 'medium' } },
};

export function piezas(ctx, red = fetch) {
  const http = async (url, { metodo = 'POST', json, form, headers = {}, tiempo = 60 } = {}) => {
    const r = await red(url, { method: metodo, headers: json ? { 'content-type': 'application/json', ...headers } : headers, body: json ? JSON.stringify(json) : form, signal: AbortSignal.timeout(tiempo * 1000) });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${new URL(url).host} respondió ${r.status}: ${txt.slice(0, 200)}`);
    try { return JSON.parse(txt); } catch { return txt; }
  };
  const tiene = (n) => { try { return !!ctx.clave(n); } catch { return false; } };
  const evo = (ruta, json) => http((ctx.ajustes.evolution || 'http://evolution:8080') + ruta, { json, headers: { apikey: ctx.clave('evolution') } });

  return {
    http,
    // Pide JSON a la IA: primero Gemini, si falla Groq. Si la empresa pasó su tope del mes, devuelve null (la receta sigue sin IA).
    async ia({ sistema, usuario, temperatura = 0.2 }) {
      if (!(await ctx.sumarGasto(0))) return null;
      for (const nombre of ['gemini', 'groq'].filter(tiene)) {
        const p = IA[nombre];
        try {
          const r = await http(p.url, { headers: { authorization: 'Bearer ' + ctx.clave(nombre) }, json: { model: p.modelo, temperature: temperatura, ...p.extra, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }] } });
          const txt = r?.choices?.[0]?.message?.content;
          if (!txt) continue;
          const u = r.usage || {};
          await ctx.sumarGasto(((u.prompt_tokens || 0) * PRECIO.entrada + (u.completion_tokens || 0) * PRECIO.salida) / 1e6);
          try { return JSON.parse(String(txt).replace(/^```(json)?|```$/g, '').trim()); } catch { return {}; }
        } catch { /* probar con la siguiente */ }
      }
      return null;
    },
    async transcribir(b64, mime = 'audio/ogg') {
      const f = new FormData();
      f.append('file', new Blob([Buffer.from(b64, 'base64')], { type: mime }), 'audio.ogg');
      f.append('model', 'whisper-large-v3-turbo'); f.append('language', 'es'); f.append('response_format', 'json');
      const r = await http('https://api.groq.com/openai/v1/audio/transcriptions', { form: f, headers: { authorization: 'Bearer ' + ctx.clave('groq') } });
      return String(r?.text || '').trim();
    },
    wa: {
      charla: (inst, jid) => evo(`/chat/findMessages/${inst}`, { where: { key: { remoteJid: jid } }, page: 1, offset: 60, limit: 60 }),
      enviar: (inst, number, text) => ctx.efecto('whatsapp', () => evo(`/message/sendText/${inst}`, { number, text }), {}, { a: number, texto: text.slice(0, 400) }),
    },
    // Función "entrada" de Olumi: "contexto" solo lee; "registrar" crea o suma al pedido (es un efecto).
    olumi: (cuerpo) => {
      const hacer = () => http(ctx.ajustes.entrada || OLUMI, { json: { org: ctx.org, ...cuerpo }, headers: { 'x-entrada-key': ctx.clave('entrada') } });
      return cuerpo.modo === 'contexto' ? hacer() : ctx.efecto('olumi:' + cuerpo.modo, hacer, { ok: true, nuevo: true, ticket: 'T-SOMBRA', respuesta: '' });
    },
  };
}
