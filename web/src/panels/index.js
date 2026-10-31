// Panel registry: each feature is one module here. The sidebar and command palette list these automatically and hide a panel
// whose `requires` capabilities the current app lacks (see docs/architecture.md, "Adding a feature").
import Overview from "./Overview.jsx";
import Status from "./Status.jsx";
import Costs from "./Costs.jsx";
import Usage, { Apis } from "./Usage.jsx";
import Events, { Transactions } from "./Events.jsx";
import MapPanel from "./Map.jsx";
import Access from "./Access.jsx";
import Settings from "./Settings.jsx";

export const panels = [
  { id: "overview", title: "Overview", requires: [], component: Overview },
  { id: "map", title: "Live map", requires: ["map"], component: MapPanel },
  { id: "status", title: "Status and uptime", requires: ["probes"], component: Status },
  { id: "costs", title: "Costs", requires: [], component: Costs },
  { id: "usage", title: "Usage", requires: ["events"], component: Usage },
  { id: "apis", title: "API details", requires: ["events"], component: Apis },
  { id: "transactions", title: "Transactions", requires: [], component: Transactions },
  { id: "events", title: "Event log", requires: ["events"], component: Events },
  { id: "access", title: "Access", requires: ["admin"], component: Access },
  { id: "settings", title: "Settings", requires: [], component: Settings },
];

export const panelsFor = (capabilities = []) => panels.filter((p) => p.requires.every((c) => capabilities.includes(c)));
