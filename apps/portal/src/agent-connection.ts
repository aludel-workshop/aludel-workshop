import { Component, OnInit, input, output, signal } from '@angular/core';
// LAY-04D: pasted API keys with in-place guidance (config/agent-providers.json, docs/guides/connect-an-agent.md).
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
        <p class="agent-connected"><mat-icon aria-hidden="true">{{ current.status === 'verified' ? 'check_circle' : 'error' }}</mat-icon>
          <span><strong>{{ current.label }}</strong>@if (current.hint) { · key ending {{ current.hint }} } · {{ statusText(current.status) }}</span></p>
        @if (current.retired) { <p class="field-hint">{{ current.retired }} Connect an Anthropic or OpenAI key to replace it.</p> }
        @else { <p class="field-hint">Stored encrypted and never shown again. Agents use it only for work you've approved.@if (current.keyUrl) { <a [href]="current.keyUrl" target="_blank" rel="noopener"> Manage this key at the provider</a> }</p> }
        <div class="agent-actions">
          @if (current.hint) { <button mat-stroked-button type="button" (click)="check()" [disabled]="busy()">Check again</button> }
          <button mat-stroked-button type="button" (click)="editing.set(true)" [disabled]="busy()">Replace</button>
          <button mat-button type="button" (click)="remove()" [disabled]="busy()">Disconnect</button>
        </div>
      } @else if (!editing()) {
        <p>{{ description() }}</p>
        <button mat-flat-button type="button" (click)="editing.set(true)">Connect an agent</button>
      }
      @if (editing()) {
        <fieldset class="provider-choice">
          <legend>Your AI provider</legend>
          @for (entry of providerList(); track entry.id) {
            <label class="choice-row" [class.selected]="provider === entry.id">
              <input type="radio" name="{{ headingId() }}-provider" [value]="entry.id" [(ngModel)]="provider">
              <span><strong>{{ entry.label }}</strong><small>Paste an API key from your {{ entry.label }} account. You pay the provider for what agents use.</small></span>
            </label>
          }
        </fieldset>
        @if (providers()[provider]; as chosen) {
          <div class="agent-guide">
            <h3>Create a key at {{ chosen.label }}</h3>
            <ol>@for (step of chosen.steps; track $index) { <li>{{ fill(step) }}</li> }</ol>
            <p><a mat-stroked-button [href]="chosen.keyUrl" target="_blank" rel="noopener"><mat-icon aria-hidden="true">open_in_new</mat-icon>Open {{ chosen.label }} API keys</a></p>
            <p class="field-hint"><strong>Set a spend limit:</strong> {{ chosen.limits }} <a [href]="chosen.limitsUrl" target="_blank" rel="noopener">Limits</a></p>
          </div>
          <mat-form-field appearance="outline" class="wide-field">
            <mat-label>{{ chosen.label }} {{ chosen.secret }}</mat-label>
            <input matInput type="password" [(ngModel)]="secret" autocomplete="off" spellcheck="false">
          </mat-form-field>
          <p class="field-hint">Aludel checks the key by asking {{ chosen.label }} for its list of models, which costs nothing, then stores it encrypted.</p>
        }
        <div class="agent-actions">
          <button mat-flat-button type="button" (click)="save()" [disabled]="busy() || !secret.trim()">{{ busy() ? 'Checking…' : 'Check and save' }}</button>
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
  readonly projectName = input('');
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
      this.secret = ''; this.editing.set(false); this.message.set(`Checked with ${this.connection()?.label}: the key works. Agent connection saved.`);
    }
  }

  async check() {
    this.message.set('');
    const value = await this.call('POST') as { check?: string | null } | false;
    if (value && !value.check) this.message.set('The key still works.');
    else if (value && value.check) this.error.set(value.check);
  }

  statusText(status: string) { return status === 'verified' ? 'checked, works' : status === 'rejected' ? 'rejected by the provider: replace it' : status === 'unchecked' ? "couldn't be checked just now" : 'saved'; }
  fill(step: string) { return step.replace('{project}', this.projectName() || 'your project'); }

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
      if (!this.providers()[this.provider]) this.provider = Object.keys(this.providers())[0] || '';
      if (method !== 'GET') this.changed.emit(value.connection);
      return value;
    } catch { this.error.set('Aludel could not be reached.'); return false; }
    finally { this.busy.set(false); }
  }
}
