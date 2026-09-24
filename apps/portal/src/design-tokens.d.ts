export interface ToneRef { palette: string; tone: number; }
export interface Palette { key: string; name: string; seed: string; seedTone: number; pins: Record<string, string>; }
export interface ColorRole { id: string; light: ToneRef; dark: ToneRef; }
export interface TypeRole { id: string; face: 'brand' | 'plain'; size: number; line: number; weight: number; tracking: number; }
export interface ElevationLevel { level: number; fill: string; y: number; blur: number; opacity: number; }
export interface Tokens {
  base: string; palettes: Palette[]; roles: ColorRole[]; faces: { brand: string; plain: string }; type: TypeRole[];
  corners: Record<string, number>; spacing: Record<string, number>; elevation: ElevationLevel[]; elevationRule: 'fixed' | 'relative';
  motion: { easing: Record<string, number[]>; durations: Record<string, number>; spring: { stiffness: number; damping: number } };
  behaviours: { drag: { lift: number; scale: number; touchDelay: number; indicator: 'placeholder' | 'line' }; stateLayers: Record<string, number> };
}
export declare const standardTones: number[];
export declare const colorRoles: [string, string, number, number][];
export declare const typeRoles: [string, string, number, number, number, number][];
export declare const contrastPairs: Record<string, string>;
export declare const cornerKeys: string[];
export declare const easingKeys: string[];
export declare const durationKeys: string[];
export declare const stateKeys: string[];
export declare const faceStacks: string[];
export declare function hexChannels(hex: string): number[];
export declare function toneOf(hex: string): number;
export declare function toneFromSeed(seed: string, tone: number): string;
export declare function paletteTone(palette: Palette | undefined, tone: number): string;
export declare function nearestTone(hex: string): number;
export declare function defaultTokens(options?: { accent?: string; font?: string; radius?: number }): Tokens;
export declare function paletteOf(tokens: Tokens, key: string): Palette | undefined;
export declare function roleColor(tokens: Tokens, id: string, mode?: 'light' | 'dark'): string;
export declare function roleContrast(tokens: Tokens, id: string, mode?: 'light' | 'dark'): number | null;
export declare function shadow(level: { y: number; blur: number; opacity: number }): string;
export declare function levelShadow(tokens: Tokens, level: number, base?: number): string;
export declare function tokenVariables(tokens: Tokens, mode?: 'light' | 'dark', pick?: ((light: string, dark: string) => string) | null): Record<string, string>;
export declare function toDtcg(tokens: Tokens, name?: string): Record<string, unknown>;
export declare const initials: (name: string) => string;
export declare function markSvg(options: { text: string; background: string; foreground: string; radius?: number; size?: number; font?: string }): string;
export declare function bannerSvg(options: { width: number; height: number; background: string; accent: string; foreground: string; markText: string; markBackground: string; markForeground: string; headline: string; subline?: string; font?: string; brandFont?: string }): string;
