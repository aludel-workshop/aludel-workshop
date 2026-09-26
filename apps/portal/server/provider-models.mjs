import { spawn } from 'node:child_process';

const cleanError = error => String(error?.message || error || 'Model catalog unavailable.').replace(/\s+/g, ' ').slice(0, 240);

export function readCodexModels(command = 'codex', timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'] });
    let buffer = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGTERM');
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Codex model discovery timed out.')), timeoutMs);
    child.on('error', error => finish(error));
    child.on('close', code => { if (!settled) finish(new Error(`Codex model discovery exited (${code}).`)); });
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === 1) {
          child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
          child.stdin.write(JSON.stringify({ id: 2, method: 'model/list', params: { includeHidden: false, limit: 100 } }) + '\n');
        }
        if (message.id === 2) {
          if (message.error) return finish(new Error(message.error.message || 'Codex rejected model discovery.'));
          const data = message.result?.data;
          if (!Array.isArray(data)) return finish(new Error('Codex returned an invalid model catalog.'));
          return finish(null, data.filter(model => model && model.hidden !== true && typeof model.model === 'string').map(model => ({
            id: model.model, label: String(model.displayName || model.model), description: String(model.description || ''),
            efforts: (model.supportedReasoningEfforts || []).map(option => option.reasoningEffort).filter(Boolean),
            defaultEffort: model.defaultReasoningEffort || 'medium', isDefault: model.isDefault === true
          })));
        }
      }
    });
    child.stdin.write(JSON.stringify({ id: 1, method: 'initialize', params: { clientInfo: { name: 'aludel', version: '0.1.0' }, capabilities: { experimentalApi: true } } }) + '\n');
  });
}

export function providerModelCatalog({ codexCommand = 'codex', loadCodex = readCodexModels, ttlMs = 300_000 } = {}) {
  let cached = null;
  let pending = null;
  async function list(provider) {
    if (provider !== 'codex') return { models: [], fetchedAt: null, error: 'This provider has no installed runtime adapter.' };
    if (cached && Date.now() - cached.at < ttlMs) return cached.value;
    if (!pending) pending = loadCodex(codexCommand).then(models => ({ models, fetchedAt: new Date().toISOString(), error: null }))
      .catch(error => ({ models: [], fetchedAt: null, error: cleanError(error) }))
      .then(value => { cached = { at: Date.now(), value }; pending = null; return value; });
    return pending;
  }
  return { list };
}
