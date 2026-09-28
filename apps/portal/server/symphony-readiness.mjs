// LAY-05: Aludel -> Symphony's normalized issue boundary. This is a pure projection;
// tracker writes and agent dispatch belong to a separate gateway after Go authorization.
const priority = { highest: 1, high: 2, medium: 3, low: 4, lowest: 5 };
const safe = value => String(value || '').replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 70);

export function symphonyIssue({ project, item, batch, action, bundle, repositoryCommit }) {
  if (!project?.id || !project?.slug || !item?.id || !batch?.id || !action || !bundle?.digest || !/^[a-f0-9]{40}$/.test(repositoryCommit || '')) return null;
  // Only the items captured by Go are eligible. Staging into a live batch is not a new authorization.
  if (batch.state !== 'running' || !batch.snapshot?.includes(item.id) || item.context?.batch !== batch.id || item.state !== 'claimed' || item.context?.skip) return null;
  if (item.blockedBy?.length || item.question && !item.question.answer && item.action !== 'product.clarify' || item.assignee?.kind !== 'agent' || item.assignee.id !== batch.profileId) return null;
  const coding = action.id === 'platform.implement' && action.tools?.includes('code') && action.changes?.some(change => change.startsWith('Code › '));
  const audit = action.id === 'platform.security' && action.tools?.includes('read') && !action.changes?.length;
  const proposal = ['product.define', 'product.clarify', 'product.brief', 'data.contract'].includes(action.id) && action.tools?.includes('read');
  const pagesFlow = action.id === 'pages.flows' && action.tools?.includes('read') && action.tools?.includes('revise');
  const assessment = ['design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(action.id) && action.tools?.includes('read') && !action.changes?.length;
  if (action.id !== item.action || action.elevated && !['product.brief', 'deploy.review', 'work.review'].includes(action.id) || !(coding || audit || proposal || assessment || pagesFlow)) return null;
  if (bundle.work?.id !== item.id || bundle.project?.id !== project.id || bundle.repository?.commit !== repositoryCommit) return null;
  if (bundle.guidance?.action?.id !== action.id || !bundle.guidance.action.revision) return null;
  const identifier = `${safe(project.slug).toUpperCase()}-${safe(item.ref)}`;
  return {
    id: `${project.id}:${item.id}`, identifier, title: item.title,
    description: `Aludel work ${item.ref}. Authorized batch ${batch.ref}. Context digest ${bundle.digest}. Repository base ${repositoryCommit}. ${audit ? 'Open the task card before auditing. Submit a findings report; do not change files.' : coding ? 'Read the pinned Aludel task bundle before changing files.' : 'Open the task card. Submit a review proposal; do not change project records or files.'}`,
    priority: priority[item.priority] ?? 3, state: 'Ready', dispatchable: true,
    url: null, branch_name: null, labels: ['aludel-ready', `profile-${safe(batch.profileId)}`],
    native_ref: { project_id: project.id, work_id: item.id, batch_id: batch.id, bundle_digest: bundle.digest, repository_commit: repositoryCommit,
      codex_model: bundle.guidance?.profile?.model || null, codex_effort: bundle.guidance?.profile?.effort || 'medium' },
    blocked_by: [], created_at: item.createdAt || batch.startedAt || null, updated_at: item.updatedAt || batch.startedAt || null
  };
}
