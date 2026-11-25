// Pruebas del intermediario contra la API simulada. Ejecutar: npm test
import worker, { ejecutarCotizar, validarMensajes } from '../src/worker.js';
import { startMock } from './mock-anthropic.mjs';
import C from '../../js/cotizador.js';

const results = [];
const check = (name, ok, detail = '') => results.push({ ok: !!ok, name, detail });
const ORIGIN = 'https://vitaeinsurer-lgtm.github.io';

const mock = await startMock();
const env = { ANTHROPIC_API_KEY: 'sk-ant-prueba', ANTHROPIC_BASE_URL: mock.url, ALLOWED_ORIGINS: `${ORIGIN},http://127.0.0.1:5190` };
let ipN = 0;
const call = (body, { origin = ORIGIN, method = 'POST', path = '/chat', ip } = {}) =>
  worker.fetch(new Request('https://vitae-chatbot.example/' + path.replace(/^\//, ''), {
    method, headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': ip || `10.0.0.${++ipN}` },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  }), env);

try {
  // Herramienta: mismas cifras que el motor validado contra el Excel
  const r = ejecutarCotizar({ producto: 'temporal', edad: 35, sexo: 'F', fumador: false, deportista: false, pagos: 20, suma: 1000000, moneda: 'MXN', plazo: 20, padecimiento: 'ninguno' });
  const ref = C.cotizar({ producto: 'temporal', edad: 35, sexo: 'F', fumador: false, deportista: false, pagos: 20, suma: 1000000, moneda: 'MXN', plazo: 20, padecimiento: 'ninguno' });
  check('cotizar: prima igual al motor del sitio', r.prima_anual === Math.round(ref.primaAnual), `${r.prima_anual} vs ${Math.round(ref.primaAnual)}`);
  check('cotizar: rechaza Temporal a los 71', /18 a 70/.test(ejecutarCotizar({ producto: 'temporal', edad: 71, sexo: 'M', fumador: false, deportista: false, pagos: 20, suma: 500000, moneda: 'MXN', plazo: 10, padecimiento: 'ninguno' }).error || ''));
  check('cotizar: rechaza plazo que pasa de los 85', /5, 10, 15/.test(ejecutarCotizar({ producto: 'temporal', edad: 70, sexo: 'M', fumador: false, deportista: false, pagos: 20, suma: 500000, moneda: 'MXN', plazo: 20, padecimiento: 'ninguno' }).error || ''));
  check('cotizar: rechaza suma fuera de rango', /100000/.test(ejecutarCotizar({ producto: 'dotal', edad: 30, sexo: 'F', fumador: false, deportista: false, pagos: 20, suma: 50000, moneda: 'MXN', plazo: 10, padecimiento: 'ninguno' }).error || ''));
  check('cotizar: Vitalicio a los 75 solo hasta 10 años de pago', /de 1 a 10/.test(ejecutarCotizar({ producto: 'vitalicio', edad: 75, sexo: 'F', fumador: false, deportista: false, pagos: 20, suma: 500000, moneda: 'MXN', plazo: 20, padecimiento: 'ninguno' }).error || ''));

  const base = { producto: 'temporal', edad: 40, sexo: 'F', fumador: false, deportista: false, suma: 1000000, moneda: 'MXN', plazo: 20, pagos: 20, padecimiento: 'ninguno' };
  const p7 = ejecutarCotizar({ ...base, pagos: 7 });
  check('cotizar: acepta años de pago libres (7) y coincide con el motor', p7.pagos_anuales === 7 && p7.prima_anual === Math.round(C.cotizar({ ...base, pagos: 7 }).primaAnual), JSON.stringify(p7));
  check('cotizar: rechaza más años de pago que el plazo', /de 1 a 20/.test(ejecutarCotizar({ ...base, pagos: 21 }).error || ''));
  check('cotizar: rechaza 0 años de pago', !!ejecutarCotizar({ ...base, pagos: 0 }).error);
  const dep = ejecutarCotizar({ ...base, deportista: true });
  check('cotizar: deportista baja la prima y lo explica', dep.prima_anual < ejecutarCotizar(base).prima_anual && /1 año/.test(dep.ajuste_deportista || ''));
  check('cotizar: VITAE Siempre a los 70 permite hasta 15 años de pago', !ejecutarCotizar({ ...base, producto: 'vitalicio', edad: 70, plazo: 0, pagos: 15 }).error && /1 a 15/.test(ejecutarCotizar({ ...base, producto: 'vitalicio', edad: 70, plazo: 0, pagos: 16 }).error || ''));

  // Validación de mensajes
  check('mensajes: rechaza vacío', validarMensajes([]) === null);
  check('mensajes: rechaza muy largo', validarMensajes([{ role: 'user', content: 'x'.repeat(1300) }]) === null);
  check('mensajes: rechaza roles extraños', validarMensajes([{ role: 'system', content: 'hola' }]) === null);
  check('mensajes: limita a 20', validarMensajes(Array.from({ length: 31 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i }))).length <= 20);

  // HTTP: origen, método, CORS
  check('HTTP: origen ajeno → 403', (await call({ messages: [{ role: 'user', content: 'hola' }] }, { origin: 'https://otro-sitio.com' })).status === 403);
  const pre = await worker.fetch(new Request('https://x/chat', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  check('HTTP: preflight CORS permitido', pre.status === 204 && pre.headers.get('Access-Control-Allow-Origin') === ORIGIN);
  check('HTTP: JSON inválido → 400', (await call('{no-json')).status === 400);
  const sinClave = await worker.fetch(new Request('https://x/chat', { method: 'POST', headers: { Origin: ORIGIN }, body: '{}' }), { ...env, ANTHROPIC_API_KEY: '' });
  check('HTTP: sin clave configurada → 503', sinClave.status === 503);

  // Conversación normal
  const n0 = mock.requests.length;
  const hola = await call({ messages: [{ role: 'user', content: 'Hola' }] });
  const holaBody = await hola.json();
  check('chat: responde texto (ignora bloques de razonamiento)', hola.status === 200 && holaBody.reply === 'Hola, soy el asistente de VITAE.', JSON.stringify(holaBody));
  check('chat: la respuesta trae CORS', hola.headers.get('Access-Control-Allow-Origin') === ORIGIN);
  const req0 = mock.requests[n0].body;
  check('API: usa claude-opus-5-5', req0.model === 'claude-opus-5-5', req0.model);
  check('API: respaldo automático ante rechazos (fallbacks default + beta)', req0.fallbacks === 'default' && String(mock.requests[n0].headers['anthropic-beta'] || '').includes('server-side-fallback-2026-07-01'), String(mock.requests[n0].headers['anthropic-beta']));
  check('API: esfuerzo low y max_tokens con margen', req0.output_config && req0.output_config.effort === 'low' && req0.max_tokens >= 1024);
  check('API: prompt del sistema en caché', Array.isArray(req0.system) && req0.system[0].cache_control && req0.system[0].cache_control.type === 'ephemeral');
  check('API: herramienta cotizar estricta', req0.tools && req0.tools[0].name === 'cotizar' && req0.tools[0].strict === true && req0.tools[0].input_schema.additionalProperties === false);
  check('API: la herramienta pide deportista y años de pago', ['deportista', 'pagos'].every((k) => req0.tools[0].input_schema.required.includes(k)));
  check('API: no envía temperature ni prefill', !('temperature' in req0) && req0.messages[req0.messages.length - 1].role === 'user');
  const hdr = mock.requests[n0].headers;
  const enCabecera = hdr['x-api-key'] === 'sk-ant-prueba' || hdr.authorization === 'Bearer sk-ant-prueba';
  check('API: la clave va en la cabecera, no en el cuerpo', enCabecera && !JSON.stringify(req0).includes('sk-ant'));

  // Cotización con herramienta
  const n1 = mock.requests.length;
  const cot = await (await call({ messages: [{ role: 'user', content: 'Hola' }, { role: 'assistant', content: 'Hola, soy el asistente.' }, { role: 'user', content: 'Cotiza un Temporal edad 35' }] })).json();
  check('chat: cotiza con la herramienta y da la prima del motor', cot.reply && cot.reply.includes(Math.round(ref.primaAnual).toLocaleString('en-US')), cot.reply);
  const segunda = mock.requests[n1 + 1] && mock.requests[n1 + 1].body;
  const asist = segunda && segunda.messages[segunda.messages.length - 2];
  check('API: devuelve el turno completo (con razonamiento) junto al resultado', asist && Array.isArray(asist.content) && asist.content.some((b) => b.type === 'thinking') && asist.content.some((b) => b.type === 'tool_use'));
  const err = await (await call({ messages: [{ role: 'user', content: 'Cotiza un Temporal edad 80' }] })).json();
  check('chat: un error de límites llega como texto explicado', /18 a 70/.test(err.reply || ''), err.reply);

  // Rechazo de seguridad
  const ref2 = await (await call({ messages: [{ role: 'user', content: 'RECHAZA esto' }] })).json();
  check('chat: un rechazo devuelve un mensaje amable', /no la puedo responder/.test(ref2.reply || ''), ref2.reply);

  // Límite de frecuencia por IP
  let ultimo;
  for (let i = 0; i < 14; i++) ultimo = await call({ messages: [{ role: 'user', content: 'Hola' }] }, { ip: '10.9.9.9' });
  check('HTTP: más de 12 mensajes por minuto → 429', ultimo.status === 429);
} finally {
  mock.server.close();
}

for (const r of results) console.log(`${r.ok ? 'OK   ' : 'FALLA'} ${r.name}${!r.ok && r.detail ? '  →  ' + r.detail : ''}`);
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} pruebas correctas`);
process.exit(fails ? 1 : 0);
