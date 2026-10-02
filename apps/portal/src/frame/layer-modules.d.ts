// Resolved per layer build to that layer's own entry and styles (tools/build-layer-ui.mjs).
declare module '@aludel/layer/entry' { const entry: Record<string, unknown>; export = entry; }
declare module '@aludel/layer/styles';
