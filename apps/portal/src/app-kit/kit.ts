import { Tokens } from '../design-tokens';

// The app kit (T03-DESIGN): the token set, component contracts and brand assets of the app being built. These are record
// kinds, not a layer: whichever installed layer publishes them, a reader finds them in the Library (DEC-059 (1)). With
// none published, the kit is empty and a preview falls back to plain placeholders.
export interface KitPropSpec { key: string; kind: 'variant' | 'boolean' | 'text' | 'swap'; options: string[]; default: string | boolean; }
export interface KitSlot { name: string; accepts: string[]; anything?: boolean; min: number; max: number | null; }
export interface KitComponent { id: string; parentId: string | null; revision: number; name: string; group: string; purpose: string; props: KitPropSpec[]; slots: KitSlot[];
  anatomy: { part: string; tokens: string[]; note: string }[]; binding: { library: string; selector: string } | null; preview: string | null; status: 'needed' | 'specified' | 'built'; }
export interface KitBrandAsset { id: string; revision: number; name: string; type: 'image' | 'text' | 'mark' | 'banner'; key: string | null; text: string; assetId: string | null;
  mark: { text: string; background: string; foreground: string } | null; }
export interface Kit { tokens: (Tokens & { id: string; revision: number }) | null; components: KitComponent[]; brand: KitBrandAsset[]; }
export const kitKinds = { tokens: 'design_tokens', component: 'component', brand: 'brand_asset' } as const;
export const emptyKit: Kit = Object.freeze({ tokens: null, components: [], brand: [] }) as Kit;

// needed (a name) → specified (a contract) → built (a binding to the stack).
export const kitComponentStatus = (component: Pick<KitComponent, 'binding' | 'props' | 'anatomy' | 'slots'>): KitComponent['status'] =>
  component.binding ? 'built' : component.props?.length || component.anatomy?.length || component.slots?.length ? 'specified' : 'needed';

type Entry = { ref: string; revision: number; data?: Record<string, unknown> };
type Page = { results: Entry[]; nextCursor: number | null };
// Reads the kit from the Library: every output entry of the three kit kinds, with its data.
export async function loadKit(api: <T>(path: string) => Promise<T>, projectId: string): Promise<Kit> {
  const all = async (kind: string) => {
    const entries: Entry[] = [];
    for (let cursor: number | null = 0; cursor !== null && entries.length < 500;) {
      const page: Page = await api<Page>(`/api/projects/${encodeURIComponent(projectId)}/library?source=output&kind=${kind}&data=1&limit=100&cursor=${cursor}`);
      entries.push(...page.results); cursor = page.nextCursor;
    }
    return entries.map(entry => ({ ...(entry.data || {}), id: entry.ref, revision: entry.revision }) as Record<string, unknown> & { id: string; revision: number });
  };
  const [tokens, components, brand] = await Promise.all([all(kitKinds.tokens), all(kitKinds.component), all(kitKinds.brand)]);
  return {
    tokens: (tokens[0] as unknown as Kit['tokens']) || null,
    components: components.map(component => ({ ...component, parentId: (component['parentId'] as string | null) ?? null }) as unknown as KitComponent)
      .map(component => ({ ...component, status: kitComponentStatus(component) })),
    brand: brand as unknown as KitBrandAsset[]
  };
}
