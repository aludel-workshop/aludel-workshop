import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AgentConnection, AgentProvider } from './onboarding-model';

// DEC-034: every project, Aludel's own included, connects its agent through this one component and endpoint.
@Component({
  selector: 'aludel-agent-connection', standalone: true,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
  <section class="agent-connection" [attr.aria-labelledby]="headingId()">
    <div class="agent-connection-icon" aria-hidden="true"><mat-icon>smart_toy</mat-icon></div>
    <div class="agent-connection-body">
      <h2 [id]="headingId()">{{ heading() }}</h2>
      @if (connection(); as current) {
        <p class="agent-connected"><mat-icon aria-hidden="true">check_circle</mat-icon>
          <span><strong>{{ current.label }}</strong>@if (current.hint) { · key ending {{ current.hint }} } · saved, not yet used by a run</span></p>
        <p class="field-hint">{{ current.hint ? 'Aludel stores the key encrypted and never shows it again. ' : '' }}Nothing is sent to the provider until you authorize work.</p>
        <div class="agent-actions">
          <button mat-stroked-button type="button" (click)="editing.set(true)" [disabled]="busy()">Replace</button>
          <button mat-button type="button" (click)="remove()" [disabled]="busy()">Disconnect</button>
        </div>
      } @else if (!editing()) {
        <p>{{ description() }}</p>
        <button mat-flat-button type="button" (click)="editing.set(true)">Connect an agent</button>
      }
      @if (editing()) {
        <fieldset class="provider-choice">
          <legend>Agent provider</legend>
          @for (entry of providerList(); track entry.id) {
            <label class="choice-row" [class.selected]="provider === entry.id">
              <input type="radio" name="{{ headingId() }}-provider" [value]="entry.id" [(ngModel)]="provider">
              <span><strong>{{ entry.label }}</strong><small>{{ entry.secret ? 'Uses your own ' + entry.secret : 'Uses the Codex sign-in on this computer; nothing is stored' }}</small></span>
            </label>
          }
        </fieldset>
        @if (providers()[provider]?.secret) {
          <mat-form-field appearance="outline" class="wide-field">
            <mat-label>{{ providers()[provider].label }} {{ providers()[provider].secret }}</mat-label>
            <input matInput type="password" [(ngModel)]="secret" autocomplete="off" spellcheck="false">
          </mat-form-field>
        }
        <div class="agent-actions">
          <button mat-flat-button type="button" (click)="save()" [disabled]="busy() || (!!providers()[provider]?.secret && !secret.trim())">Save connection</button>
          <button mat-button type="button" (click)="editing.set(false); secret = ''">Cancel</button>
        </div>
      }
      @if (error()) { <p class="error-message" role="alert">{{ error() }}</p> }
      @if (message()) { <p class="success-message" role="status">{{ message() }}</p> }
    </div>
  </section>`
})
export class AgentConnectionComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly heading = input('Agent connection');
  readonly description = input('Connect an agent so Aludel can carry out work you authorize.');
  readonly changed = output<AgentConnection | null>();
  readonly connection = signal<AgentConnection | null>(null);
  readonly providers = signal<Record<string, AgentProvider>>({});
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  provider = 'anthropic';
  secret = '';

  headingId() { return `agent-${this.projectId()}`; }
  providerList() { return Object.entries(this.providers()).map(([id, value]) => ({ id, ...value })); }

  async ngOnInit() { await this.call('GET'); }

  async save() {
    this.message.set('');
    if (await this.call('PUT', { provider: this.provider, secret: this.secret })) {
      this.secret = ''; this.editing.set(false); this.message.set('Agent connection saved.');
    }
  }

  async remove() {
    this.message.set('');
    if (await this.call('DELETE')) this.message.set('Agent disconnected.');
  }

  private async call(method: string, body?: unknown) {
    this.busy.set(true); this.error.set('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(this.projectId())}/connections/agent`, {
        method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
      });
      const value = await response.json();
      if (!response.ok) { this.error.set(value.error || 'The agent connection could not be saved.'); return false; }
      this.connection.set(value.connection); this.providers.set(value.providers);
      if (method !== 'GET') this.changed.emit(value.connection);
      return true;
    } catch { this.error.set('Aludel could not be reached.'); return false; }
    finally { this.busy.set(false); }
  }
}
