// jsdom has no matchMedia; reduced.js (shared with Reroute) reads it at import.
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// Unmount what each test rendered, so one test never sees another's output.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
