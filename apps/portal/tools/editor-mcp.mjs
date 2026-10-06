// A small stdio MCP adapter for Aludel's editor API. It reads project context, and (AGENT-WORK-01) lets your local agent work a
// goal item you have claimed: define it, add and move actions, talk in its thread, and stage changes through each layer's API.
import readline from 'node:readline';
import { branchItem, checkoutInfo, configPath, inContainer, loadConfig, pair, pushReport, request, startBranch } from './aludel-client.mjs';

let config;
const names = {
  assigned_tasks: { description: 'List work assigned to you in this Aludel project.', schema: { type: 'object', properties: {} }, path: () => '/tasks' },
  task_context: { description: 'Read a task and save its versioned context bundle.', schema: { type: 'object', properties: { workId: { type: 'string' } }, required: ['workId'] }, path: a => '/tasks/' + encodeURIComponent(a.workId) },
  saved_context: { description: 'Read a previously saved task context by digest.', schema: { type: 'object', properties: { digest: { type: 'string' } }, required: ['digest'] }, path: a => '/bundles/' + encodeURIComponent(a.digest) },
  read_record: { description: 'Read anything search_knowledge finds, by its id: a record (live or at a revision), a Knowledge or repository doc (k:…), or a work item with its thread.', schema: { type: 'object', properties: { recordId: { type: 'string' }, revision: { type: 'integer', minimum: 1 } }, required: ['recordId'] },
    path: a => '/records/' + encodeURIComponent(a.recordId) + (a.revision ? '?revision=' + encodeURIComponent(a.revision) : '') },
  search_knowledge: { description: 'Search everything in this project’s Library by text: every layer’s records and Knowledge (repository docs such as AGENTS.md and docs/ included), research, and work items with their actions and threads. Best match first, with the matching section and an excerpt; read one with read_record.', schema: { type: 'object', properties: { query: { type: 'string', minLength: 2 } }, required: ['query'] }, path: a => '/search?q=' + encodeURIComponent(a.query) },
  environment_status: { description: 'Inspect the project preview and source commit.', schema: { type: 'object', properties: {} }, path: () => '/environment' },
  work_list: { description: 'List the goal work items you have claimed, with their board column, action counts and open needs.', schema: { type: 'object', properties: {} }, path: () => '/goals' },
  start_work: { description: 'Start on a goal item assigned to your person: checks out its branch (aludel/w-n) in this checkout, from the latest main, and returns the item. Call it first when asked to work on an item. Without workId, the item is the one this checkout\u2019s branch is for (an item container opens on it).',
    schema: { type: 'object', properties: { workId: { type: 'string', description: 'The item id, or its number such as W-12.' } } },
    run: async a => {
      a = { ...a, workId: a.workId || branchItem(process.cwd()) };
      if (!a.workId) throw new Error('Name the item, for example W-12: this checkout is not on an item\u2019s branch.');
      const id = /^w-\d+$/i.test(a.workId) ? ((await request(config, '/goals')).goals.find(item => item.ref.toLowerCase() === a.workId.toLowerCase())?.id) : a.workId;
      if (!id) throw new Error(`${a.workId} isn't assigned to your person.`);
      const view = await request(config, goal({ workId: id }));
      return { started: startBranch(process.cwd(), view.item.ref), item: view };
    } },
  work_view: { description: 'Read a goal item (by id or number, such as W-12): its brief, phases, actions (with what blocks each), open needs, recent thread and staged changeset.',
    schema: { type: 'object', properties: { workId: { type: 'string' } }, required: ['workId'] }, path: a => goal(a) },
  stack_map: { description: 'List the project\u2019s layers: what each owns, its charter and the operations its API offers.', schema: { type: 'object', properties: {} }, path: () => '/stack' },
  describe_operation: { description: 'Describe one operation of a layer\u2019s API before calling it: its request body schema (and the schemas it refers to) and the host catalogs its values are checked against, such as page types and icons.',
    schema: { type: 'object', properties: { layer: { type: 'string' }, operationId: { type: 'string' } }, required: ['layer', 'operationId'] },
    path: a => '/stack/' + encodeURIComponent(a.layer) + '/' + encodeURIComponent(a.operationId) },
  read_layer: { description: 'Call a read operation of a layer\u2019s API. Reads include the item\u2019s own staged changes.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, layer: { type: 'string' }, operationId: { type: 'string' }, id: { type: 'string' } }, required: ['workId', 'layer', 'operationId'] },
    path: a => goal(a, '/read?' + new URLSearchParams({ layer: a.layer, operationId: a.operationId, ...(a.id ? { id: a.id } : {}) })) },
  define_work: { description: 'Define a Draft or Ready item: its brief, phases (a gated phase holds later phases until its actions are reviewed) and actions, each naming a layer.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, brief: { type: 'string' },
      phases: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, gated: { type: 'boolean' } }, required: ['title'] } },
      actions: { type: 'array', items: { type: 'object', properties: { phase: { type: 'integer', minimum: 1 }, layer: { type: 'string' }, goal: { type: 'string' }, after: { type: 'array', items: { type: 'integer' } } }, required: ['goal'] } } },
      required: ['workId', 'brief', 'actions'] }, post: a => [goal(a, '/define'), { brief: a.brief, phases: a.phases, actions: a.actions }] },
  add_action: { description: 'Add an action. Once work has started, a new action waits for your person\u2019s approval; say why. With wrapUp, it is the action that ends the item as not done: use it when an action has failed and you judge the item can\u2019t be finished this time (rather than fixed and finished); the reason says why.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, goal: { type: 'string' }, layer: { type: 'string' }, phase: { type: 'integer', minimum: 1 }, after: { type: 'array', items: { type: 'integer' } }, reason: { type: 'string' }, wrapUp: { type: 'boolean' } }, required: ['workId', 'goal'] },
    post: a => [goal(a, '/actions'), pick(a, ['goal', 'layer', 'phase', 'after', 'reason', 'wrapUp'])] },
  propose_items: { description: 'Propose work items from a working action: follow-ups it found, or (from a wrap-up action) what has to happen before the item is tried again, ending with the retry itself. Each says why; `after` lists the indexes (from 0) of items in this list that must be done first. Your person edits, creates or dismisses each. A new list replaces this action\u2019s undecided proposals.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, action: { type: 'integer', minimum: 1 }, items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, brief: { type: 'string' }, why: { type: 'string' }, after: { type: 'array', items: { type: 'integer', minimum: 0 } } }, required: ['title', 'why'] } } }, required: ['workId', 'action', 'items'] },
    post: a => [goal(a, '/actions/' + a.action + '/proposals'), { items: a.items }] },
  update_action: { description: 'Move an action (todo, working, review) or change its goal, summary, layer or order, or hand over its preview. Only people mark actions done.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, number: { type: 'integer', minimum: 1 }, state: { type: 'string', enum: ['todo', 'working', 'review'] }, summary: { type: 'string' }, goal: { type: 'string' }, layer: { type: 'string' }, after: { type: 'array', items: { type: 'integer' } },
      preview: { type: ['object', 'null'], description: 'What your person opens to see the change: { url, commit (defaults to the reported code), try (what to do there) }, or { none: why there is no preview }; null removes it. `npm run preview -- <journey>` in apps/portal keeps a seeded portal running and prints its link.',
        properties: { url: { type: 'string' }, commit: { type: 'string' }, try: { type: 'string' }, none: { type: 'string' } } } }, required: ['workId', 'number'] },
    post: a => [goal(a, '/actions/' + a.number), pick(a, ['state', 'summary', 'goal', 'layer', 'after', 'preview'])] },
  post_message: { description: 'Write in the item\u2019s thread: a message to your person, or a log line of what you did.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, text: { type: 'string' }, action: { type: 'integer', minimum: 1 }, log: { type: 'boolean' } }, required: ['workId', 'text'] },
    post: a => [goal(a, '/events'), { kind: a.log ? 'log' : 'message', text: a.text, action: a.action ?? null }] },
  ask: { description: 'Ask your person a question on an action. The item waits on them until it is answered; keep working on other actions meanwhile.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, action: { type: 'integer', minimum: 1 }, text: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }, required: ['workId', 'action', 'text'] },
    post: a => [goal(a, '/events'), { kind: 'question', action: a.action, text: a.text, options: a.options }] },
  request_allow: { description: 'Ask your person to allow something outside the action\u2019s scope (a command, a dependency, an external call) before doing it.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, action: { type: 'integer', minimum: 1 }, text: { type: 'string' } }, required: ['workId', 'action', 'text'] },
    post: a => [goal(a, '/events'), { kind: 'allow', action: a.action, text: a.text }] },
  stage_change: { description: 'Stage a write through a layer\u2019s API under a working action. The layer checks it now; nothing applies until your person closes the item.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, action: { type: 'integer', minimum: 1 }, layer: { type: 'string' }, operationId: { type: 'string' }, id: { type: 'string' }, body: { type: 'object' } }, required: ['workId', 'action', 'operationId'] },
    post: a => [goal(a, '/stage'), pick(a, ['action', 'layer', 'operationId', 'id', 'body'])] },
  report_code: { description: 'After committing code for the item on a branch in this checkout, push the branch to origin and report the branch, commit and changed files (read from git here) so your person can review them. Commit first; uncommitted changes are not reported, and main is refused.',
    schema: { type: 'object', properties: { workId: { type: 'string' }, base: { type: 'string', description: 'Commit the work started from; defaults to the merge base with main.' } }, required: ['workId'] },
    post: a => [goal(a, '/code'), pushReport(process.cwd(), a.base || null)] },
  changeset: { description: 'List the item\u2019s staged changes, grouped by layer.', schema: { type: 'object', properties: { workId: { type: 'string' } }, required: ['workId'] }, path: a => goal(a, '/changeset') }
};
function goal(args, rest = '') { return '/goals/' + encodeURIComponent(args.workId) + rest; }
function pick(args, keys) { return Object.fromEntries(keys.filter(key => args[key] !== undefined).map(key => [key, args[key]])); }
if (process.argv[2] === 'pair') {
  try {
    const me = await pair(process.argv[3]);
    process.stdout.write('Connected to ' + me.projectId + '. Credential stored outside the repository at ' + configPath + '.\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
} else {
  try { config = loadConfig(); }
  catch (error) { process.stderr.write('Pair Aludel first: ' + error.message + '\n'); process.exit(1); }
  // Tell Aludel where this checkout is, so the item page can open it. Best effort: the tools work without it.
  if (!inContainer()) try { request(config, '/checkout', checkoutInfo(process.cwd())).catch(() => {}); } catch { /* not a git checkout */ }
  const respond = object => process.stdout.write(JSON.stringify(object) + '\n');
  const rpcError = (id, code, message) => respond({ jsonrpc: '2.0', id, error: { code, message } });
  const handle = async msg => {
    if (msg.id === undefined) return;
    if (msg.method === 'initialize') return respond({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: msg.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'aludel-editor', version: '0.1.0' }, instructions: 'Read your assigned task context before editing. Project records are live; saved task bundles are immutable. For a goal item assigned to your person, you are its orchestrator: call start_work first (it checks out the item\'s branch; in an item container, with no workId, it finds the item from the branch), then read work_view and stack_map (describe_operation gives an operation\'s body schema before you stage it). If it has no actions yet, define_work it in phases (a review gate after spec work) with one action per layer change; that moves it to Ready, so post_message a short summary and stop: your person checks it and starts it on its page, and actions can\'t start before that. Work only on actions that are not blocked: move one to working, do it, post_message what you did, then update_action to review with a summary. An action that changes what people see hands over a preview with its review (update_action preview: a link your person can open, the commit it shows and what to try there), or says why there is none. After a break (your session, the container or the portal restarted), read work_view again before acting: your person may have moved the item, and the previews you handed over stopped with the container, so run them again and hand them over afresh. Records change only through stage_change on that layer\'s API; code changes go on the item\'s branch (start_work checked it out), committed, then report_code (it pushes the branch to origin). If close-out finds your branch conflicts with main, your person\'s note says so: fetch origin, rebase onto origin/main, resolve, commit and report_code again. Check work_view between actions: a flag on an action you handed to review moves it back to working with your person\'s note; address the note, post_message what changed, and hand it back. When you need your person, ask on the action (or request_allow before anything outside its scope) and continue other unblocked actions meanwhile. Propose new actions with add_action and a reason. When an action fails, decide whether it can be fixed and the item still finished; if not, add_action with wrapUp and the reason, and once your person approves it, work it: propose_items for what has to happen first (with after for their order, and the retry last), post_message the account, and hand it to review. Propose follow-ups you find on any action the same way. Never mark actions done or close the item; your person reviews.' } });
    if (msg.method === 'ping') return respond({ jsonrpc: '2.0', id: msg.id, result: {} });
    if (msg.method === 'tools/list') return respond({ jsonrpc: '2.0', id: msg.id, result: { tools: Object.entries(names).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.schema })) } });
    if (msg.method === 'tools/call') {
      const tool = names[msg.params?.name];
      if (!tool) return rpcError(msg.id, -32602, 'Unknown tool.');
      try {
        const args = msg.params?.arguments || {};
        for (const key of tool.schema.required || []) if (args[key] === undefined || args[key] === null || args[key] === '') throw new Error('Missing ' + key + '.');
        const result = tool.run ? await tool.run(args) : tool.post ? await request(config, ...tool.post(args)) : await request(config, tool.path(args));
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
