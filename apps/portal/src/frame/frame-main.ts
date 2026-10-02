// The frame's bootstrap: the layer's own entry component, with the frame context in place of the portal's.
import '@angular/compiler';
import { Component, inject, reflectComponentType, Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { MatIconRegistry } from '@angular/material/icon';
import { bootstrapApplication } from '@angular/platform-browser';
import { ProjectContext } from '../layers/context';
import { EvidencePanelComponent } from '../layers/evidence';
import { FrameProjectContext } from './frame-context';
import * as entry from '@aludel/layer/entry';
import '../styles.scss';
import '../layers/host-theme.scss';
import '@aludel/layer/styles';

const layerComponent = Object.values(entry).find(value => typeof value === 'function' && reflectComponentType(value as Type<unknown>)) as Type<unknown>;

// The frame gives the layer the same surroundings it has in the portal: the project shell's theme tokens and the main
// column's typography, without the main column's padding, which the portal already applies around the frame.
@Component({
  selector: 'aludel-project-shell', standalone: true, imports: [NgComponentOutlet, EvidencePanelComponent],
  template: `<div class="lay-main lay-frame-main">@if (ctx.ready()) { <ng-container *ngComponentOutlet="layer" /><aludel-evidence-panel /> } @else { <p class="lay-muted">Loading…</p> }</div>`
})
class LayerFrameRoot {
  readonly ctx = inject(FrameProjectContext);
  readonly layer = layerComponent;
  // As in the portal's App: icons use the portal's icon font.
  constructor() { inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded'); }
}

// Browsers ignore the autofocus attribute in cross-origin frames; focus such fields as they appear, as the portal would.
new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes) {
    const field = node instanceof HTMLElement ? (node.matches('[autofocus]') ? node : node.querySelector<HTMLElement>('[autofocus]')) : null;
    if (field) setTimeout(() => field.focus());
  }
}).observe(document.body, { childList: true, subtree: true });

bootstrapApplication(LayerFrameRoot, { providers: [FrameProjectContext, { provide: ProjectContext, useExisting: FrameProjectContext }] }).catch(console.error);
