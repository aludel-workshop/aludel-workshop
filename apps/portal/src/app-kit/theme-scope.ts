import { Directive, ElementRef, effect, inject, input } from '@angular/core';

// Applies a token set's CSS variables to its host, so Angular Material components inside render in the app's theme
// rather than the portal's (DEC-059 (3): the kit is output for the app being built, never the portal's theme).
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
