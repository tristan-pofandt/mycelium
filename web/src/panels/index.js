// Panel registry: each feature is one module here. The sidebar and command palette list these automatically and hide a panel
// whose `requires` capabilities the current app lacks (see docs/architecture.md, "Adding a feature").
import Overview from "./Overview.jsx";

export const panels = [
  { id: "overview", title: "Overview", requires: [], component: Overview },
];

export const panelsFor = (capabilities = []) => panels.filter((p) => p.requires.every((c) => capabilities.includes(c)));
