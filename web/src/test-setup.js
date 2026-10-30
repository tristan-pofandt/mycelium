// jsdom has no matchMedia; reduced.js (shared with Reroute) reads it at import.
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
