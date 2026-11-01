// Panel registry: each feature is one module here. The header nav and command palette list these automatically and hide a panel
// whose `requires` capabilities the current app lacks (see docs/architecture.md, "Adding a feature").
// `short` is the pill label, `icon` a name from icons.jsx, and `place: "tools"` puts a panel among the header's icon buttons.
import Overview from "./Overview.jsx";
import Status from "./Status.jsx";
import Costs from "./Costs.jsx";
import Usage, { Apis } from "./Usage.jsx";
import Events, { Transactions } from "./Events.jsx";
import MapPanel from "./Map.jsx";
import Access from "./Access.jsx";
import Settings from "./Settings.jsx";

export const panels = [
  { id: "overview", title: "Overview", short: "Overview", icon: "overview", requires: [], component: Overview },
  { id: "map", title: "Live map", short: "Live map", icon: "map", requires: ["map"], component: MapPanel },
  { id: "status", title: "Status and uptime", short: "Status", icon: "status", requires: ["probes"], component: Status },
  { id: "costs", title: "Costs", short: "Costs", icon: "costs", requires: [], component: Costs },
  { id: "usage", title: "Usage", short: "Usage", icon: "usage", requires: ["events"], component: Usage },
  { id: "apis", title: "API details", short: "APIs", icon: "apis", requires: ["events"], component: Apis },
  { id: "transactions", title: "Transactions", short: "Ledger", icon: "ledger", requires: [], component: Transactions },
  { id: "events", title: "Event log", short: "Events", icon: "events", requires: ["events"], component: Events },
  { id: "access", title: "Access", short: "Access", icon: "access", requires: ["admin"], component: Access, place: "tools" },
  { id: "settings", title: "Settings", short: "Settings", icon: "settings", requires: [], component: Settings, place: "tools" },
];

export const panelsFor = (capabilities = []) => panels.filter((p) => p.requires.every((c) => capabilities.includes(c)));
