// API de Anthropic simulada para probar el intermediario sin gastar saldo.
// Guarda cada petición recibida para que la prueba revise su forma.
import { createServer } from 'node:http';

export function startMock(port = 0) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ url: req.url, headers: req.headers, body });
    const send = (content, stop_reason) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_mock_' + requests.length, type: 'message', role: 'assistant', model: body.model,
        content, stop_reason, stop_sequence: null, stop_details: null,
        usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
      }));
    };
    if (req.url !== '/v1/messages') { res.writeHead(404); return res.end('{}'); }
    const last = body.messages[body.messages.length - 1];
    const toolResult = Array.isArray(last.content) && last.content.find((b) => b.type === 'tool_result');
    const text = typeof last.content === 'string' ? last.content : '';
    const thinking = { type: 'thinking', thinking: '', signature: 'sig_mock' };

    if (toolResult) {
      const data = JSON.parse(toolResult.content);
      if (data.error) return send([{ type: 'text', text: 'No se pudo: ' + data.error }], 'end_turn');
      return send([{ type: 'text', text: `Tu prima anual estimada es de **$${data.prima_anual.toLocaleString('en-US')} ${data.moneda}** (${data.pagos_anuales} pagos).` }], 'end_turn');
    }
    if (/RECHAZA/.test(text)) return send([], 'refusal');
    if (/cotiza/i.test(text)) {
      const edad = /edad (\d+)/.exec(text) ? Number(/edad (\d+)/.exec(text)[1]) : 35;
      return send([thinking, { type: 'tool_use', id: 'toolu_mock', name: 'cotizar', input: {
        producto: 'temporal', edad, sexo: 'F', fumador: false, suma: 1000000, moneda: 'MXN', plazo: 20, padecimiento: 'ninguno'
      } }], 'tool_use');
    }
    return send([thinking, { type: 'text', text: 'Hola, soy el asistente de VITAE.' }], 'end_turn');
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, requests, url: `http://127.0.0.1:${server.address().port}` })));
}
