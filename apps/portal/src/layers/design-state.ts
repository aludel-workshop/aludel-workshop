import { Directive, ElementRef, Injectable, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Tokens, bannerSvg, markSvg, roleColor, tokenVariables } from '../design-tokens';
import { ProjectContext } from './context';

export type Mode = 'light' | 'dark';
export interface TokenRecord extends Tokens { id: string; revision: number; fromLook?: boolean; history: { revision: number; author: string; rationale: string; createdAt: string }[]; }

// DESIGN-UX-01: token edits are a draft until saved as one revision of the token set, so sliders can move freely and every
// Design tab (tokens, components, brand) previews the draft.
@Injectable()
export class DesignState {
  private readonly ctx = inject(ProjectContext);
  private readonly sanitizer = inject(DomSanitizer);
  readonly saved = computed(() => (this.ctx.data() as unknown as { tokens: TokenRecord | null } | null)?.tokens || null);
  readonly draft = signal<Tokens | null>(null);
  readonly tokens = computed<Tokens | null>(() => this.draft() || this.saved());
  readonly mode = signal<Mode>('light');
  readonly width = signal<'phone' | 'desktop'>('desktop');
  readonly vars = computed(() => { const tokens = this.tokens(); return tokens ? tokenVariables(tokens, this.mode()) : {}; });
  readonly dirty = computed(() => { const draft = this.draft(), saved = this.saved(); return Boolean(draft && saved && JSON.stringify(strip(draft)) !== JSON.stringify(strip(saved))); });
  readonly note = signal('');

  edit(change: (tokens: Tokens) => void) {
    const current = this.tokens(); if (!current) return;
    const next = structuredClone(strip(current)) as Tokens;
    change(next);
    this.draft.set(next);
  }
  discard() { this.draft.set(null); this.note.set(''); }
  async save() {
    const saved = this.saved(), draft = this.draft();
    if (!saved || !draft) return;
    const ok = await this.ctx.write(() => this.ctx.change(saved.id, { ...strip(draft), fromLook: false }, saved.revision, this.note().trim() || 'Token changes'), 'Saved as a new revision of the token set.');
    if (ok) { this.draft.set(null); this.note.set(''); }
  }
  color(id: string) { const tokens = this.tokens(); return tokens ? roleColor(tokens, id, this.mode()) : '#888888'; }
  svgUrl(svg: string): SafeUrl { return this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); }
  mark(mark: { text: string; background: string; foreground: string } | null | undefined, size = 64) {
    const tokens = this.tokens(); if (!tokens) return '';
    const value = mark || { text: '?', background: 'primary', foreground: 'on-primary' };
    return markSvg({ text: value.text, background: roleColor(tokens, value.background, this.mode()), foreground: roleColor(tokens, value.foreground, this.mode()), size, font: tokens.faces.brand });
  }
  banner(banner: { width: number; height: number; headline: string; subline: string; background: string; accent: string }, mark: { text: string } | null | undefined) {
    const tokens = this.tokens(); if (!tokens) return '';
    const background = roleColor(tokens, banner.background, this.mode()), on = roleColor(tokens, `on-${banner.background}`, this.mode());
    return bannerSvg({ width: banner.width, height: banner.height, background, accent: roleColor(tokens, banner.accent, this.mode()), foreground: on, markText: mark?.text || '?', markBackground: on,
      markForeground: background, headline: banner.headline, subline: banner.subline, font: tokens.faces.plain, brandFont: tokens.faces.brand });
  }
}
// The record's bookkeeping is not part of the token set.
export function strip(tokens: Tokens) {
  const { id, kind, parentId, position, revision, updatedAt, history, fromLook, ...rest } = tokens as Tokens & Record<string, unknown>;
  void id; void kind; void parentId; void position; void revision; void updatedAt; void history; void fromLook;
  return rest as unknown as Tokens;
}

// Applies a token set's CSS variables to its host, so Angular Material components inside render in the project's theme.
@Directive({ selector: '[aludelTheme]', standalone: true })
export class ThemeScopeDirective {
  readonly aludelTheme = input<Record<string, string>>({});
  private readonly element = inject(ElementRef<HTMLElement>);
  private applied: string[] = [];
  constructor() {
    effect(() => {
      const style = this.element.nativeElement.style;
      const vars = this.aludelTheme();
      for (const name of this.applied) if (!(name in vars)) style.removeProperty(name);
      for (const [name, value] of Object.entries(vars)) style.setProperty(name, value);
      this.applied = Object.keys(vars);
    });
  }
}
