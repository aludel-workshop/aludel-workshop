export interface SessionUser { id: string; email: string | null; name: string; owner: boolean; }
export interface ProjectSummary { id: string; slug: string; name: string; description: string; accent_color: string; role: string; updated_at: string; }
export interface Draft { profile: string | null; name: string; pitch: string; claimedProjectId: string | null; }
export interface Session { authenticated: boolean; user: SessionUser | null; setupRequired: boolean; aludelMember: boolean; githubSignIn: boolean; projects: ProjectSummary[]; draft: Draft | null; }

export interface PreferenceDefinition { label: string; values: Record<string, string>; }
export interface Profile { label: string; summary: string; detail: string; icon: string; defaults: Record<string, string>; }
export interface RouteSeed { label: string; icon: string; pageType: string; }
export interface Feel { label: string; summary: string; accent: string; theme: 'light' | 'dark'; font: string; radius: number; density: number; navigation: 'sidebar' | 'top'; samplePage: string; seedRoutes: RouteSeed[]; surface: string; surfaceDark: string; }
export interface PageRoute { id: string; label: string; icon: string; pageType: string; description: string; }
export interface PageBlockSpec { t: string; w?: number; n?: number; }
export interface PageType { label: string; summary: string; blocks: PageBlockSpec[]; }
export interface FeaturePick { label: string; summary: string; icon: string; }
export interface StackPreset { label: string; summary: string; available: boolean; recommended?: boolean; unavailableReason?: string; layers?: Record<string, string>; options?: Record<string, { label: string; default: boolean }>; }
export interface AgentProvider { label: string; secret: string | null; }
export interface Catalog {
  preferences: Record<string, PreferenceDefinition>;
  profiles: Record<string, Profile>;
  feels: Record<string, Feel>;
  features: Record<string, FeaturePick>;
  stacks: { default: string; presets: Record<string, StackPreset> };
  pageTypes: Record<string, PageType>;
  routeIcons: string[];
  agentProviders: Record<string, AgentProvider>;
}

export interface AgentConnection { provider: string; label: string; hint: string | null; status: string; updatedAt: string; }
export interface ProjectAsset { id: string; kind: 'image' | 'document'; filename: string; mime: string; size: number; notes: string; url: string; }
export interface GitHubInstallationSummary { installation_id: number; account_login: string; target_type: string; eligible: boolean; }
export interface GitHubStatus {
  configured: boolean; connected: boolean; login: string | null; installations: GitHubInstallationSummary[];
  repository: { owner: string; name: string; html_url: string; status: string; last_error: string | null } | null;
  local: { initialized: boolean; committed: boolean; remote: string | null; branch: string | null } | null;
}
export interface PreviewStatus { status: string; commit?: string | null; builtAt?: string | null; error?: string | null; running: boolean; log?: string; }

export interface ProjectSetup {
  project: { id: string; slug: string; name: string; description: string; accent_color: string };
  profile: string; overrides: Record<string, string>; preferences: Record<string, string>;
  design: { feel: string | null; theme: 'light' | 'dark' | 'system'; accent: string; notes: string; navigation: 'sidebar' | 'top' };
  pages: { routes: PageRoute[]; seeded: boolean };
  stack: { preset: string | null; options: Record<string, boolean> };
  features: { picks: string[]; records: { id: string; title: string; summary: string; status: string }[] };
  direction: { title: string; summary: string; revision: number } | null;
  completedSteps: string[];
  assets: ProjectAsset[];
  agentConnection: AgentConnection | null;
  urls: { portal: string; app: string };
  github: GitHubStatus;
  preview: PreviewStatus;
}
