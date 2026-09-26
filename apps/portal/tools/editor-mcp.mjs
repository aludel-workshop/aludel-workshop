// A small stdio MCP adapter. It only calls Aludel's read-only editor API.
import { readFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline';

const configPath = process.env.ALUDEL_EDITOR_CONFIG || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'aludel', 'editor.json');
const names = {
  assigned_tasks: { description: 'List work assigned to you in this Aludel project.', schema: { type: 'object', properties: {} }, path: () => '/tasks' },
  task_context: { description: 'Read a task and save its versioned context bundle.', schema: { type: 'object', properties: { workId: { type: 'string' } }, required: ['workId'] }, path: a => '/tasks/' + encodeURIComponent(a.workId) },
  saved_context: { description: 'Read a previously saved task context by digest.', schema: { type: 'object', properties: { digest: { type: 'string' } }, required: ['digest'] }, path: a => '/bundles/' + encodeURIComponent(a.digest) },
  read_record: { description: 'Read a live or pinned project knowledge record.', schema: { type: 'object', properties: { recordId: { type: 'string' }, revision: { type: 'integer', minimum: 1 } }, required: ['recordId'] },
    path: a => '/records/' + encodeURIComponent(a.recordId) + (a.revision ? '?revision=' + encodeURIComponent(a.revision) : '') },
  search_knowledge: { description: 'Search this project’s live knowledge by text.', schema: { type: 'object', properties: { query: { type: 'string', minLength: 2 } }, required: ['query'] }, path: a => '/search?q=' + encodeURIComponent(a.query) },
  environment_status: { description: 'Inspect the project preview and source commit.', schema: { type: 'object', properties: {} }, path: () => '/environment' }
};
function validateUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS or a loopback SSH tunnel.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Use the Aludel portal origin only.');
  return url.origin;
}
async function readToken() {
  if (!process.stdin.isTTY) return (await new Promise(resolve => {
    let value = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { value += chunk; }); process.stdin.on('end', () => resolve(value));
  })).trim();
  process.stderr.write('Paste the editor token from Work > Team, then press Enter: ');
  const input = process.stdin;
  input.setRawMode(true); input.resume(); input.setEncoding('utf8');
  return new Promise(resolve => {
    let value = '';
    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') { input.off('data', onData); input.setRawMode(false); input.pause(); process.stderr.write('\n'); resolve(value.trim()); return; }
        if (char === '\u0003') process.exit(130);
        if (char === '\u007f') value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on('data', onData);
  });
}
async function request(config, path) {
  const response = await fetch(config.url + '/api/editor' + path, { headers: { authorization: 'Bearer ' + config.token }, signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Aludel returned ' + response.status);
  return body;
}
if (process.argv[2] === 'pair') {
  try {
    const url = validateUrl(process.argv[3] || 'http://127.0.0.1:4310');
    const token = await readToken();
    if (!token) throw new Error('No token supplied.');
    const config = { url, token };
    const me = await request(config, '/me');
    mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
    writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
    chmodSync(configPath, 0o600);
    process.stdout.write('Connected to ' + me.projectId + '. Credential stored outside the repository at ' + configPath + '.\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
} else {
  let config;
  try { config = JSON.parse(readFileSync(configPath, 'utf8')); config.url = validateUrl(config.url); }
  catch (error) { process.stderr.write('Pair Aludel first: ' + error.message + '\n'); process.exit(1); }
  const respond = object => process.stdout.write(JSON.stringify(object) + '\n');
  const rpcError = (id, code, message) => respond({ jsonrpc: '2.0', id, error: { code, message } });
  const handle = async msg => {
    if (msg.id === undefined) return;
    if (msg.method === 'initialize') return respond({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: msg.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'aludel-editor', version: '0.1.0' }, instructions: 'Read your assigned task context before editing. Project records are live; saved task bundles are immutable. These tools are read only.' } });
    if (msg.method === 'ping') return respond({ jsonrpc: '2.0', id: msg.id, result: {} });
    if (msg.method === 'tools/list') return respond({ jsonrpc: '2.0', id: msg.id, result: { tools: Object.entries(names).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.schema })) } });
    if (msg.method === 'tools/call') {
      const tool = names[msg.params?.name];
      if (!tool) return rpcError(msg.id, -32602, 'Unknown tool.');
      try {
        const args = msg.params?.arguments || {};
        for (const key of tool.schema.required || []) if (typeof args[key] !== 'string' || !args[key]) throw new Error('Missing ' + key + '.');
        const result = await request(config, tool.path(args));
        return respond({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } });
      } catch (error) { return respond({ jsonrpc: '2.0', id: msg.id, result: { isError: true, content: [{ type: 'text', text: error.message }] } }); }
    }
    rpcError(msg.id, -32601, 'Method not found.');
  };
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try { await handle(JSON.parse(line)); }
    catch (error) { process.stderr.write('Invalid MCP request: ' + error.message + '\n'); }
  }
}
