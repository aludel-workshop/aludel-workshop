// A stand-in for the Anthropic and OpenAI APIs, so tests and browser scripts can connect an agent and run batches
// without a real key, network or spending. Keys ending in "-good" work; "-limit" hits a spend limit on model calls;
// anything else is rejected. Start: node tests/provider-stub.mjs <port>   (or import startProviderStub)
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

// Canned drafts, chosen by the shape of the requested schema.
function draftFor(schema) {
  const fields = Object.keys(schema?.properties || {});
  if (fields.includes('scenarios')) return { scenarios: [{ given: 'a signed-in neighbour', when: 'they do the thing this story describes', then: 'they see it worked' }], edges: ['They lose their connection halfway'], questions: [] };
  if (fields.includes('options')) return { options: ['A tool listing', 'A person\'s profile', 'A borrow request'], recommendation: 'A tool listing', reasoning: 'Most conversations are about one tool.' };
  if (fields.includes('fields')) return { description: 'Drafted by the stand-in.', fields: [{ name: 'title', type: 'string', format: '', required: true, description: 'What it is called' }, { name: 'createdAt', type: 'string', format: 'date-time', required: true, description: '' }], states: [] };
  return {};
}

export function startProviderStub(port = 0) {
  const calls = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const key = request.headers['x-api-key'] || String(request.headers.authorization || '').replace(/^Bearer /, '');
      const input = body ? JSON.parse(body) : {};
      calls.push({ method: request.method, url: request.url, body: input });
      const send = (status, value) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
      if (!key.endsWith('-good') && !key.endsWith('-limit')) return send(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      if (request.method === 'GET' && request.url.startsWith('/v1/models')) return send(200, { data: [{ id: 'stub-model' }] });
      if (key.endsWith('-limit')) return send(429, { type: 'error', error: { type: 'rate_limit_error', message: 'spend limit reached' } });
      if (request.method === 'POST' && request.url === '/v1/responses') {
        const text = JSON.stringify(draftFor(input.text?.format?.schema));
        return send(200, { id: 'resp_stub', model: input.model, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }], usage: { input_tokens: 900, output_tokens: 150, total_tokens: 1050 } });
      }
      if (request.method === 'POST' && request.url.startsWith('/v1/messages')) {
        const text = JSON.stringify(draftFor(input.output_config?.format?.schema));
        return send(200, { id: 'msg_stub', type: 'message', role: 'assistant', model: input.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 900, output_tokens: 150 } });
      }
      send(404, { error: { message: 'not found' } });
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` })));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { url } = await startProviderStub(Number(process.argv[2] || 4399));
  console.log(`provider stub on ${url}`);
}
