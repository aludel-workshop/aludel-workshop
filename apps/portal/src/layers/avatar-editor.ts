import { Component, computed, inject, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { avatarCredits, bigSmileChoices, optionLabel, personAvatar } from '../avatars';
import { SessionUser } from '../onboarding-model';
import { PersonAvatar, ProjectContext } from './context';

type Part = 'skinColor' | 'hair' | 'hairColor' | 'eyes' | 'mouth' | 'accessories' | 'backgroundColor';
const parts: { key: Part; label: string; colour?: boolean }[] = [
  { key: 'skinColor', label: 'Skin', colour: true }, { key: 'hair', label: 'Hair' }, { key: 'hairColor', label: 'Hair colour', colour: true },
  { key: 'eyes', label: 'Eyes' }, { key: 'mouth', label: 'Mouth' }, { key: 'accessories', label: 'Extras' }, { key: 'backgroundColor', label: 'Background', colour: true }
];

// Your avatar, shown wherever work is assigned to you (C2): a Big Smile face built part by part, not just randomised.
@Component({
  selector: 'aludel-avatar-editor', standalone: true, imports: [MatIconModule],
  template: `
  <section class="lay-card lay-avatar-editor" aria-labelledby="avatar-heading">
    <h2 id="avatar-heading">Your avatar</h2>
    <div class="lay-ae">
      <div class="lay-ae-preview"><img [src]="preview()" alt="Your avatar preview" class="lay-av lay-av-xl">
        <div class="lay-row lay-wrap"><button type="button" class="lay-button ghost small" (click)="shuffle()"><mat-icon aria-hidden="true">casino</mat-icon>Surprise me</button>
          <button type="button" class="lay-button ghost small" (click)="reset()" [disabled]="!dirty()">Undo changes</button></div>
        <button type="button" class="lay-button small" (click)="save()" [disabled]="!dirty() || saving()">Save avatar</button>
      </div>
      <div class="lay-ae-parts">
        <div class="lay-subtabs" role="tablist" aria-label="Avatar parts">
          @for (part of parts; track part.key) { <button type="button" role="tab" [id]="'ae-' + part.key" [attr.aria-selected]="tab() === part.key" [attr.aria-controls]="'ae-panel'" (click)="tab.set(part.key)">{{ part.label }}</button> }
        </div>
        <div class="lay-ae-options" id="ae-panel" role="tabpanel" [attr.aria-labelledby]="'ae-' + tab()">
          @if (current().colour) {
            @for (value of choices(); track value) { <button type="button" class="lay-ae-colour" [style.background]="'#' + value" [attr.aria-pressed]="draft()[tab()] === value" [attr.aria-label]="current().label + ' ' + ($index + 1)" (click)="set(value)"></button> }
          } @else {
            @if (tab() === 'accessories') { <button type="button" class="lay-ae-option lay-ae-none" [attr.aria-pressed]="!draft().accessories" (click)="set(null)">None</button> }
            @for (value of choices(); track value) {
              <button type="button" class="lay-ae-option" [attr.aria-pressed]="draft()[tab()] === value" (click)="set(value)" [attr.aria-label]="optionLabel(value)">
                <img [src]="thumb(value)" alt="" aria-hidden="true"><span>{{ optionLabel(value) }}</span></button>
            }
          }
        </div>
      </div>
    </div>
    <p class="lay-credit">Faces: <a [href]="credit.source" target="_blank" rel="noopener">{{ credit.title }}</a> by {{ credit.creator }}, <a [href]="credit.licenseUrl" target="_blank" rel="noopener">{{ credit.license }}</a>. Drawn in your browser; nothing is sent anywhere.</p>
  </section>`
})
export class AvatarEditorComponent {
  private readonly ctx = inject(ProjectContext);
  private readonly sanitizer = inject(DomSanitizer);
  readonly saved = output<void>();
  readonly parts = parts;
  readonly credit = avatarCredits.person;
  readonly optionLabel = optionLabel;
  readonly tab = signal<Part>('hair');
  readonly saving = signal(false);
  private readonly name = computed(() => this.ctx.session()?.user?.name || 'you');
  private readonly start = computed<PersonAvatar>(() => (this.ctx.session()?.user?.avatar as PersonAvatar | null | undefined) || { seed: this.name() });
  readonly draft = signal<PersonAvatar>({});
  readonly current = computed(() => parts.find(part => part.key === this.tab())!);
  readonly choices = computed(() => bigSmileChoices[this.tab()] as string[]);
  readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.start()));
  readonly preview = computed(() => this.sanitizer.bypassSecurityTrustUrl(personAvatar(this.draft(), this.name())));

  constructor() { queueMicrotask(() => this.draft.set({ ...this.start() })); }
  thumb(value: string) { return this.sanitizer.bypassSecurityTrustUrl(personAvatar({ ...this.draft(), [this.tab()]: value, ...(this.tab() === 'accessories' ? { accessoriesProbability: 100 } : {}) }, this.name())); }
  set(value: string | null) {
    const next: PersonAvatar = { ...this.draft() };
    if (this.tab() === 'accessories') { if (value) { next.accessories = value; next.accessoriesProbability = 100; } else { delete next.accessories; next.accessoriesProbability = 0; } }
    else (next as Record<string, string>)[this.tab()] = value || '';
    this.draft.set(next);
  }
  shuffle() {
    const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
    const accessory = Math.random() < 0.3 ? pick(bigSmileChoices.accessories) : undefined;
    this.draft.set({ seed: this.name(), skinColor: pick(bigSmileChoices.skinColor), hair: pick(bigSmileChoices.hair), hairColor: pick(bigSmileChoices.hairColor), eyes: pick(bigSmileChoices.eyes),
      mouth: pick(bigSmileChoices.mouth), backgroundColor: pick(bigSmileChoices.backgroundColor), ...(accessory ? { accessories: accessory, accessoriesProbability: 100 } : { accessoriesProbability: 0 }) });
  }
  reset() { this.draft.set({ ...this.start() }); }
  async save() {
    this.saving.set(true);
    const clean = Object.fromEntries(Object.entries(this.draft()).filter(([, value]) => value !== '' && value !== undefined));
    const ok = await this.ctx.write(async () => {
      const result = await this.ctx.api<{ user: SessionUser }>('/api/account/avatar', 'PUT', { avatar: clean });
      const session = this.ctx.session();
      if (session && result.user) this.ctx.session.set({ ...session, user: result.user });
    }, 'Avatar saved. It shows wherever work is assigned to you.');
    this.saving.set(false);
    if (ok) this.saved.emit();
  }
}
