// Host-owned record snapshot for the reviewed Pages semantic rule. Callers supply
// only IDs and proposed fields; the database supplies scope, data and revisions.
import { layerInstanceId } from './layer-contract.mjs';

const fail = message => { throw Object.assign(new Error(message), { status: 409 }); };
const pageKinds = new Set(['page']);

export function pagesFlowSnapshot(db, know, projectId, flowId, next = null) {
  const instanceId = layerInstanceId(db, projectId, 'pages');
  const row = db.prepare(`SELECT id, revision, data_json FROM knowledge_records
    WHERE id = ? AND project_id = ? AND layer_instance_id = ? AND kind = 'flow'`).get(flowId, projectId, instanceId);
  if (!row) fail('The target flow is missing or belongs to another Pages instance.');
  const data = JSON.parse(row.data_json);
  const current = { projectId, layerInstanceId: instanceId, kind:'flow', id:row.id, revision:row.revision, data };
  const ids = { page:new Set(), story:new Set(), persona:new Set(), activity:new Set() };
  for (const value of [data, next].filter(Boolean)) {
    if (value.activity) ids.activity.add(value.activity);
    if (value.persona) ids.persona.add(value.persona);
    for (const step of value.steps || []) {
      if (step?.page) ids.page.add(step.page);
      if (step?.story) ids.story.add(step.story);
      if (step?.persona) ids.persona.add(step.persona);
    }
  }
  const pins = kind => [...ids[kind]].map(id => {
    const record = know.get(projectId, id);
    if (!record || record.kind !== kind) fail(`The referenced ${kind} is missing or outside this project or instance.`);
    return { projectId, layerInstanceId:pageKinds.has(kind) ? instanceId : null,
      kind, id:record.id, revision:record.revision };
  }).filter(Boolean);
  return { current, pages:pins('page'), stories:pins('story'), personas:pins('persona'), activities:pins('activity') };
}

export function pagesFlowBaseInputs(snapshot) {
  return [...snapshot.pages, ...snapshot.stories, ...snapshot.personas, ...snapshot.activities]
    .map(({id,kind,revision}) => ({id,kind,revision}));
}
