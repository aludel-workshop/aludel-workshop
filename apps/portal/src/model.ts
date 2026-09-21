export interface ImportRun {
  id: number;
  started_at: string;
  completed_at: string;
  status: string;
  documents_seen: number;
  documents_created: number;
  revisions_created: number;
  unchanged: number;
  links_seen: number;
  unresolved_links: number;
}

export interface SourceRecord {
  id: string;
  title: string;
  path: string;
  kind: string;
  status: string;
  current_hash?: string;
  imported_at: string;
}

export interface Overview {
  project: ProjectBrand;
  counts: { records: number; revisions: number; requests: number; proposals: number; decisions: number; stale: number; unresolvedLinks: number };
  latestImport: ImportRun;
  recentRecords: SourceRecord[];
  recentRequests: Array<{ id: string; body: string; status: string; created_at: string }>;
}

export interface ProjectBrand {
  id: string; slug: string; name: string; description: string; tagline: string;
  accent_color: string; hero_image_path?: string | null; updated_at: string;
}

export interface GitHubIntegration {
  provider: 'github';
  configured: boolean;
  configurationIssues: string[];
  appSlug?: string | null;
  callbackUrl: string;
  setupUrl: string;
  connected: boolean;
  login?: string | null;
  permissions: string;
  installations: Array<{
    installation_id: number; account_login: string; account_id: string; target_type: 'User'|'Organization';
    repository_selection: 'all'|'selected'; permissions: Record<string, string>; status: string; eligible: boolean;
  }>;
  local: { initialized: boolean; committed: boolean; remote?: string | null; branch?: string | null };
  repository?: {
    provider: 'github'; owner: string; name: string; html_url: string; clone_url: string;
    default_branch: string; private: number; status: 'remote-created'|'local-setup-needed'|'ready';
    commit_sha?: string; tracked_files?: number; last_error?: string; installation_id: number; account_type: string;
  } | null;
}

export interface Proposal {
  id: string; status: string; source_request_id?: string; revision: number; title: string; intent: string;
  acceptance?: string[]; assumptions?: string[]; exclusions?: string[]; created_at: string;
  revisions?: Array<{ revision: number; title: string; intent: string; created_at: string }>;
  decisions?: Array<{ id: string; status: string; revision: number; question: string; answer?: string }>;
}

export interface Decision {
  id: string; status: string; proposal_id?: string; revision: number; question: string; context: string;
  options: string[]; recommendation?: string; answer?: string; rationale?: string; author: string; created_at: string;
  affected_count?: number;
  revisions?: Array<{ revision: number; question: string; recommendation?: string; answer?: string; rationale?: string; author: string; created_at: string }>;
  affected?: DownstreamRecord[];
}

export interface DownstreamRecord {
  id: string; project_id: string; proposal_id?: string; kind: 'plan'|'build'; title: string; revision: number;
  status: string; currency: 'current'|'stale'; stale_reason?: string; dependency_count?: number;
  required?: number; consumed_decision_revision?: number;
}

export interface RecordDetail extends SourceRecord {
  revision: number;
  raw_content: string;
  metadata: Record<string, string>;
  links: Array<{ raw_target: string; target_path: string; target_exists: number; resolved_document_id?: string }>;
  revisions: Array<{ revision: number; content_hash: string; imported_at: string }>;
}

export interface WorkTask {
  id: string; version: number; state: string; title: string; scope: string; acceptance: string; boundary: string;
  proposal: Proposal; worker?: string | null; question?: string | null; answer?: string; evidence?: string; failure?: string;
  input_status: 'current'|'changed'|'open'; input_message?: string;
  events: Array<{ sequence: number; actor: string; action: string; created_at: string; payload: { text?: string } }>;
}

export interface OwnerRequest {
  id: string; body: string; status: 'new'|'deferred'|'linked'; created_at: string; updated_at?: string;
}
