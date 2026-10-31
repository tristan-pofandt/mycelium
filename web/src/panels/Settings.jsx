import { fmt, send, useApi } from "../api.js";
import { Table } from "../charts.jsx";

const METHOD = { tailscale: "Tailscale", password: "password", local: "this computer (no sign-in set up)" };

export default function Settings({ apps }) {
  const { data: me } = useApi("/api/me", "all");
  const signOut = async () => { await send("POST", "/api/logout"); location.reload(); };
  return (
    <>
      <section className="card" aria-labelledby="who-h">
        <h2 id="who-h">You</h2>
        <p>{me ? <>Signed in as <strong>{me.owner}</strong> through {METHOD[me.method] || me.method}.</> : "…"}</p>
        {me?.method === "password" && <button type="button" className="button" onClick={signOut}>Sign out</button>}
      </section>
      <section className="card" aria-labelledby="apps-set-h">
        <h2 id="apps-set-h">Apps</h2>
        <p className="muted">Add an app with <code>python manage.py add-app</code> in <code>server/</code>. Admin tokens are set on the server as{" "}
          <code>MYCELIUM_ADMIN_TOKEN_&lt;SLUG&gt;</code> and never shown here.</p>
        <Table caption="Registered apps" head={["App", "Slug", "Address", "Admin API", "Last check"]}
          rows={apps.map((a) => [a.name, a.slug, a.base_url || "–", a.capabilities.includes("admin") ? "Set up" : "Not set up",
            a.checked ? fmt.ago(a.checked) : "–"])} />
      </section>
    </>
  );
}
