import { Component, input } from '@angular/core';

// "Built by" showed a record's code links (DEC-038). Code tracing was removed on 2026-10-02
// (docs/design/code-tracing/deferred.md), so this renders nothing. It stays only so layer views forked before then, which
// still import it, compile; new views don't use it.
@Component({ selector: 'aludel-built-by', standalone: true, template: '' })
export class BuiltByComponent {
  readonly recordId = input.required<string>();
}
