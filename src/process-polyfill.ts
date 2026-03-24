// Polyfill process pour le build browser (elkjs / mermaid-to-excalidraw)
const g = globalThis as any;
if (typeof g.process === 'undefined') {
  g.process = {
    env: { NODE_ENV: 'production' },
    argv: [],
    versions: { node: '18.0.0' },
    exit: () => {},
    on:   () => {},
  };
}
