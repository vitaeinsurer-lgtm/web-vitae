// Intermediario del asistente con IA de VITAE (Cloudflare Worker).
// - Guarda la clave de Anthropic como secreto: nunca llega al navegador.
// - Solo acepta peticiones del sitio de VITAE, con tamaño y frecuencia limitados.
// - Usa Claude Opus 5.5 con una herramienta "cotizar" que corre el mismo motor del
//   cotizador del sitio (validado contra el Excel interno), para no inventar primas.
import Anthropic from '@anthropic-ai/sdk';
import C from '../../js/cotizador.js';
import { SYSTEM_PROMPT } from './prompt.js';

const MODEL = 'claude-opus-5-5';
// Si el modelo rechaza una pregunta por sus filtros de seguridad, la API la reintenta sola con el modelo de respaldo adecuado
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MAX_MESSAGES = 20;      // historial que se envía al modelo
const MAX_CHARS = 1200;       // por mensaje del visitante
const MAX_TOOL_ROUNDS = 3;    // vueltas de herramienta por respuesta
const RATE = { windowMs: 60_000, max: 12 }; // por IP y por instancia (límite de mejor esfuerzo)

const NOMBRE = { temporal: 'VITAE Protege', vitalicio: 'VITAE Siempre', dotal: 'VITAE Tranquilidad' };

const COTIZAR_TOOL = {
  name: 'cotizar',
  description:
    'Calcula la prima neta ilustrativa de un seguro de VITAE con la tarifa técnica del proyecto ' +
    '(tabla CNSF M 2013, interés técnico 6%). Úsala para cualquier cifra de prima. ' +
    'Devuelve prima anual, pago único equivalente y número de pagos, o un error si los datos están fuera de los límites.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      producto: { type: 'string', enum: ['temporal', 'vitalicio', 'dotal'], description: 'Seguro a cotizar' },
      edad: { type: 'integer', description: 'Edad actual del asegurado en años' },
      sexo: { type: 'string', enum: ['F', 'M'], description: 'F = mujer, M = hombre' },
      fumador: { type: 'boolean', description: 'true si fuma' },
      deportista: { type: 'boolean', description: 'true si hace deporte con regularidad (reduce 1 año la edad de cálculo). Si no lo dice, false.' },
      suma: { type: 'number', description: 'Suma asegurada en la moneda indicada' },
      moneda: { type: 'string', enum: ['MXN', 'USD', 'EUR'] },
      plazo: {
        type: 'integer',
        description: 'VITAE Protege y VITAE Tranquilidad: años de protección (5 a 40, múltiplos de 5). VITAE Siempre: no aplica, envía 0.'
      },
      pagos: {
        type: 'integer',
        description: 'Años de pago de primas, cualquier entero desde 1. VITAE Protege y VITAE Tranquilidad: no puede pasar del plazo; si no lo dicen, igual al plazo. ' +
          'VITAE Siempre: los pagos terminan a más tardar a los 85 años de edad; si no lo dicen, 20 (o el máximo posible si es menor).'
      },
      padecimiento: {
        type: 'string',
        enum: ['ninguno', 'E000001', 'E000002', 'E000003', 'E000004', 'E000005', 'E000006', 'E000007', 'E000008'],
        description: 'ninguno, E000001 hipotiroidismo, E000002 asma crónica, E000003 dislipidemia, E000004 diabetes tipo 2, ' +
          'E000005 obesidad, E000006 cardiopatía controlada, E000007 enfermedad renal crónica, E000008 hipertensión'
      }
    },
    required: ['producto', 'edad', 'sexo', 'fumador', 'deportista', 'suma', 'moneda', 'plazo', 'pagos', 'padecimiento'],
    additionalProperties: false
  }
};

/* ---------- Herramienta: mismas reglas que el cotizador de la página ---------- */
export function ejecutarCotizar(i) {
  const L = C.LIMITES[i.producto];
  if (!L) return { error: 'Seguro desconocido.' };
  if (!Number.isInteger(i.edad) || i.edad < L.edadMin || i.edad > L.edadMax) {
    return { error: `${NOMBRE[i.producto]} se cotiza de ${L.edadMin} a ${L.edadMax} años.` };
  }
  const rango = L.suma[i.moneda];
  if (!rango) return { error: 'Moneda no disponible. Usa MXN, USD o EUR.' };
  if (!(i.suma >= rango[0] && i.suma <= rango[1])) {
    return { error: `La suma asegurada en ${i.moneda} para ${NOMBRE[i.producto]} va de ${rango[0]} a ${rango[1]}.` };
  }
  let plazo = 0;
  if (i.producto !== 'vitalicio') {
    const validos = C.plazosValidos(i.producto, i.edad);
    if (!validos.includes(i.plazo)) {
      return { error: `Para ${NOMBRE[i.producto]} a los ${i.edad} años los plazos posibles son: ${validos.join(', ')} años (la protección termina a más tardar a los ${L.finMax}).` };
    }
    plazo = i.plazo;
  }
  const maxP = C.maxPagos(i.producto, i.edad, plazo);
  if (!Number.isInteger(i.pagos) || i.pagos < 1 || i.pagos > maxP) {
    return {
      error: i.producto === 'vitalicio'
        ? `En VITAE Siempre a los ${i.edad} años se puede pagar de 1 a ${maxP} años (los pagos terminan a más tardar a los ${L.finMax}).`
        : `Los años de pago van de 1 al plazo de protección: de 1 a ${maxP} años.`
    };
  }
  const r = C.cotizar({ producto: i.producto, edad: i.edad, sexo: i.sexo, fumador: i.fumador, deportista: i.deportista, suma: i.suma, moneda: i.moneda, plazo, pagos: i.pagos, padecimiento: i.padecimiento });
  const redondeo = (v) => Math.round(v);
  return {
    seguro: NOMBRE[i.producto],
    moneda: i.moneda,
    prima_anual: redondeo(r.primaAnual),
    pago_unico_equivalente: redondeo(r.pnu),
    pagos_anuales: r.pagos,
    proteccion: i.producto === 'vitalicio' ? 'toda la vida' : `hasta los ${i.edad + plazo} años`,
    recibe_al_vencimiento: i.producto === 'dotal' ? i.suma : null,
    extraprima_porcentaje: Math.round(r.extraprima * 100),
    ajuste_deportista: i.deportista ? 'Se redujo 1 año la edad de cálculo por condición deportiva.' : null,
    prima_anual_mxn: i.moneda === 'MXN' ? null : redondeo(r.primaAnualMXN),
    nota: 'Prima neta ilustrativa de un proyecto académico; no incluye gastos de adquisición y administración.'
  };
}

/* ---------- Utilidades HTTP ---------- */
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(origin ? corsHeaders(origin) : {}) }
  });
}

const hits = new Map();
function rateLimited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE.max;
}

/* Acepta solo [{role, content: texto}], empezando y terminando con el visitante */
export function validarMensajes(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs = raw.slice(-MAX_MESSAGES).map((m) => ({ role: m && m.role, content: typeof (m && m.content) === 'string' ? m.content.trim() : '' }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  for (const m of msgs) {
    if (m.role !== 'user' && m.role !== 'assistant') return null;
    if (!m.content) return null;
    if (m.content.length > (m.role === 'user' ? MAX_CHARS : 4000)) return null;
  }
  return msgs;
}

const SIN_RESPUESTA = 'Esa pregunta no la puedo responder. Puedo ayudarte con los seguros de VITAE y a cotizar una prima.';

/* ---------- Conversación con Claude Opus 5.5 ---------- */
export async function responder(client, mensajes) {
  const messages = mensajes.map((m) => ({ role: m.role, content: m.content }));
  for (let ronda = 0; ronda <= MAX_TOOL_ROUNDS; ronda++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      max_tokens: 2048, // deja margen al razonamiento además de la respuesta corta
      output_config: { effort: 'low' }, // en Opus 5.5 el razonamiento no se apaga; el esfuerzo bajo lo mantiene breve
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [COTIZAR_TOOL],
      messages
    });

    if (response.stop_reason === 'refusal') return { reply: SIN_RESPUESTA };

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason === 'tool_use' && toolUses.length && ronda < MAX_TOOL_ROUNDS) {
      // Se devuelve el contenido completo (incluidos los bloques de razonamiento) junto con los resultados
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: toolUses.map((t) => {
          const out = t.name === 'cotizar' ? ejecutarCotizar(t.input) : { error: 'Herramienta desconocida.' };
          return { type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(out), ...(out.error ? { is_error: true } : {}) };
        })
      });
      continue;
    }

    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { reply: text || SIN_RESPUESTA };
  }
  return { reply: 'No pude completar la cotización. Prueba con el cotizador de la página, en la sección "Calcula tu prima".' };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin) ? origin : '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: okOrigin ? corsHeaders(okOrigin) : {} });
    if (url.pathname !== '/chat') return json({ error: 'No encontrado.' }, 404, okOrigin);
    if (request.method !== 'POST') return json({ error: 'Usa POST.' }, 405, okOrigin);
    if (!okOrigin) return json({ error: 'Origen no permitido.' }, 403, '');
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'El asistente no está configurado.' }, 503, okOrigin);

    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (rateLimited(ip)) return json({ error: 'Vas muy rápido. Espera un minuto y vuelve a intentarlo.' }, 429, okOrigin);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Mensaje inválido.' }, 400, okOrigin); }
    const mensajes = validarMensajes(body && body.messages);
    if (!mensajes) return json({ error: `Mensaje inválido o demasiado largo (máximo ${MAX_CHARS} caracteres).` }, 400, okOrigin);

    const client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: 30_000,
      ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) // solo para pruebas locales
    });

    try {
      return json(await responder(client, mensajes), 200, okOrigin);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'El asistente está ocupado. Intenta en un momento.' }, 503, okOrigin);
      if (err instanceof Anthropic.AuthenticationError) { console.error('Clave de Anthropic inválida'); return json({ error: 'El asistente no está disponible.' }, 503, okOrigin); }
      if (err instanceof Anthropic.APIError) { console.error('Error de la API', err.status, err.message); return json({ error: 'El asistente no está disponible en este momento.' }, 502, okOrigin); }
      console.error('Error inesperado', err);
      return json({ error: 'El asistente no está disponible en este momento.' }, 500, okOrigin);
    }
  }
};
