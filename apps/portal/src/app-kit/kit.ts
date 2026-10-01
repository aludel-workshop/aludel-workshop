import { Tokens } from '../design-tokens';

// The app kit (T03-DESIGN): the shape the host renderer draws — a token set, component contracts and brand assets. It is a
// rendering contract, not a requirement on any layer: a consumer (Pages' spec preview, say) reads whatever a source
// publishes in the Library through its own adapter and maps it into this shape (T03-ADAPT). With no source, the kit is
// empty and a preview falls back to plain placeholders.
export interface KitPropSpec { key: string; kind: 'variant' | 'boolean' | 'text' | 'swap'; options: string[]; default: string | boolean; }
export interface KitSlot { name: string; accepts: string[]; anything?: boolean; min: number; max: number | null; }
export interface KitComponent { id: string; parentId: string | null; revision: number; name: string; group: string; purpose: string; props: KitPropSpec[]; slots: KitSlot[];
  anatomy: { part: string; tokens: string[]; note: string }[]; binding: { library: string; selector: string } | null; preview: string | null; status: 'needed' | 'specified' | 'built'; }
export interface KitBrandAsset { id: string; revision: number; name: string; type: 'image' | 'text' | 'mark' | 'banner'; key: string | null; text: string; assetId: string | null;
  mark: { text: string; background: string; foreground: string } | null; }
export interface Kit { tokens: (Tokens & { id: string; revision: number }) | null; components: KitComponent[]; brand: KitBrandAsset[]; }
export const emptyKit: Kit = Object.freeze({ tokens: null, components: [], brand: [] }) as Kit;

// needed (a name) → specified (a contract) → built (a binding to the stack).
export const kitComponentStatus = (component: Pick<KitComponent, 'binding' | 'props' | 'anatomy' | 'slots'>): KitComponent['status'] =>
  component.binding ? 'built' : component.props?.length || component.anatomy?.length || component.slots?.length ? 'specified' : 'needed';
