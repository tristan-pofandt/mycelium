// Access: switch an app's features, change its daily caps, work its moderation queue and sign users out, through the app's own
// admin API (relayed by server/api/admin.py with the token held on the server). Every change lands in the audit log below.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fmt, send, useApi } from "../api.js";
import { Table } from "../charts.jsx";
import { Icon } from "../icons.jsx";

export default function Access({ app, apps }) {
  if (app === "all") {
    const admins = apps.filter((a) => a.capabilities.includes("admin"));
    return (
      <section className="card">
        <p className="lead">Access is managed one app at a time. Choose an app:</p>
        <ul className="app-list" role="list">
          {admins.map((a) => <li key={a.slug} className="app-row"><Link className="app-name" to={`/${a.slug}/access`}>{a.name}</Link></li>)}
        </ul>
      </section>
    );
  }
  return <Managed app={app} />;
}

function Managed({ app }) {
  const audit = useApi("/api/audit", app, { refresh: 15 });
  return (
    <>
      <Switches app={app} onDone={audit.reload} />
      <Moderation app={app} onDone={audit.reload} />
      <Sessions app={app} onDone={audit.reload} />
      <AuditLog data={audit.data} />
    </>
  );
}

function Result({ result }) {
  if (!result) return <p className="sr-only" role="status" />;
  return <p className={result.ok ? "ok-text" : "error-text"} role="status">{result.message}</p>;
}
const outcome = (r, done) => ({ ok: r.ok, message: r.ok ? done : r.data.error || `The app answered ${r.status}.` });

function Switches({ app, onDone }) {
  const { data, error, reload } = useApi(`/api/admin/${app}/settings`, app);
  const [form, setForm] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setForm({ rides: data.rides, signin: data.signin, caps: Object.fromEntries(Object.entries(data.caps).map(([k, v]) => [k, v.limit])) }); }, [data]);
  if (error && !data) return <section className="card"><h2>Switches and caps</h2><p className="error-text">Couldn't reach the app's admin API.</p></section>;
  if (!form) return <section className="card"><h2>Switches and caps</h2><p className="muted" role="status">Loading…</p></section>;

  const changes = {};
  if (form.rides !== data.rides) changes.rides = form.rides;
  if (data.accounts && form.signin !== data.signin) changes.signin = form.signin;
  const caps = Object.fromEntries(Object.entries(form.caps).filter(([k, v]) => v !== data.caps[k].limit));
  if (Object.keys(caps).length) changes.caps = caps;
  const valid = Object.values(form.caps).every((v) => Number.isInteger(v) && v >= 0 && v <= 100000);

  const save = async (e) => {
    e.preventDefault();
    if ((changes.rides === false || changes.signin === false) && !confirm("Switch this off for everyone using the app now?")) return;
    setBusy(true);
    const r = await send("POST", `/api/admin/${app}/settings`, changes);
    setBusy(false);
    setResult(outcome(r, "Saved. This lasts until the app restarts; its environment settings stay the default."));
    if (r.ok) reload();
    onDone();
  };
  return (
    <section className="card" aria-labelledby="sw-h">
      <h2 id="sw-h">Switches and caps</h2>
      <form onSubmit={save} className="form-grid">
        <label className="check"><input type="checkbox" checked={form.rides} onChange={(e) => setForm({ ...form, rides: e.target.checked })} />
          Ride board on</label>
        <label className="check"><input type="checkbox" checked={form.signin} disabled={!data.accounts}
          onChange={(e) => setForm({ ...form, signin: e.target.checked })} />
          New sign-ins allowed{!data.accounts && <span className="muted"> (accounts are off on this server)</span>}</label>
        {Object.entries(form.caps).map(([name, value]) => (
          <label key={name} className="field">
            <span>Daily cap: {name} <span className="muted">({fmt.n(data.caps[name].used_today)} used today; 0 means no cap)</span></span>
            <input type="number" className="select" min="0" max="100000" step="1" value={Number.isNaN(value) ? "" : value}
              onChange={(e) => setForm({ ...form, caps: { ...form.caps, [name]: e.target.valueAsNumber } })} />
          </label>
        ))}
        <div><button className="button button-primary" disabled={busy || !valid || !Object.keys(changes).length}>{busy ? "Saving…" : "Save changes"}</button></div>
      </form>
      <Result result={result} />
    </section>
  );
}

function Moderation({ app, onDone }) {
  const { data, error, reload } = useApi(`/api/admin/${app}/moderation`, app);
  const [result, setResult] = useState(null);
  const act = async (action, ids, question) => {
    if (question && !confirm(question)) return;
    const r = await send("POST", `/api/admin/${app}/moderation`, { action, ...ids });
    setResult(outcome(r, { approve: "Approved.", remove: "Post removed.", ban: "Post removed and poster banned.", unban: "Poster unbanned." }[action]));
    if (r.ok) reload();
    onDone();
  };
  return (
    <section className="card" aria-labelledby="mod-h">
      <h2 id="mod-h">Moderation queue</h2>
      {error && !data && <p className="error-text">Couldn't load the queue.</p>}
      {data && (data.items?.length ? (
        <ul className="queue" role="list">
          {data.items.map((item) => (
            <li key={item.id} className="queue-item">
              <p><strong>{item.nickname}</strong> <span className="muted">({item.kind})</span>{item.status === "flagged" && <span className="badge badge-bad"><Icon name="down" />Hidden from the board</span>}</p>
              <p>{item.origin_label} to {item.destination_label}. Meet: {item.meet_point}. Note: {item.note || "–"}</p>
              <ul className="muted">{item.reports.map((rep, i) => <li key={i}>{rep.reason}: {rep.note || "(no note)"}</li>)}</ul>
              <div className="actions">
                <button type="button" className="button" onClick={() => act("approve", { id: item.id })}>Approve</button>
                <button type="button" className="button button-danger" onClick={() => act("remove", { id: item.id }, "Remove this post?")}>Remove post</button>
                <button type="button" className="button button-danger" onClick={() => act("ban", { id: item.id }, "Remove this post and ban its poster?")}>Remove and ban</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="muted">Nothing to review.</p>)}
      {data?.bans?.length > 0 && (
        <>
          <h3>Banned posters</h3>
          <Table caption="Banned posters" head={["Poster", "Since", ""]}
            rows={data.bans.map((b) => [<code key="p">{b.poster}</code>, b.at,
              <button key="u" type="button" className="button" onClick={() => act("unban", { poster: b.poster }, "Unban this poster?")}>Unban</button>])} />
        </>
      )}
      <Result result={result} />
    </section>
  );
}

function Sessions({ app, onDone }) {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState(null);
  const revoke = async (one) => {
    if (!confirm(one ? "Sign this user out on every device?" : "Sign out every user on every device?")) return;
    const r = await send("POST", `/api/admin/${app}/sessions/revoke`, one ? { user_id: userId.trim() } : {});
    setResult(outcome(r, `Signed out ${r.data.revoked ?? 0} session(s).`));
    onDone();
  };
  return (
    <section className="card" aria-labelledby="ses-h">
      <h2 id="ses-h">Sign users out</h2>
      <div className="form-grid">
        <label className="field"><span>User id <span className="muted">(starts with u_)</span></span>
          <input className="select" value={userId} onChange={(e) => setUserId(e.target.value)} pattern="u_.*" /></label>
        <div className="actions">
          <button type="button" className="button" disabled={!/^u_\S+$/.test(userId.trim())} onClick={() => revoke(true)}>Sign out this user</button>
          <button type="button" className="button button-danger" onClick={() => revoke(false)}>Sign out everyone</button>
        </div>
      </div>
      <Result result={result} />
    </section>
  );
}

function AuditLog({ data }) {
  return (
    <section className="card" aria-labelledby="aud-h">
      <h2 id="aud-h">Audit log</h2>
      <Table caption="Owner actions, newest first" head={["When", "Who", "Action", "Details"]} empty="No actions yet."
        rows={(data || []).map((r) => [fmt.time(r.ts), r.actor, r.action,
          <span key="d" className="mono">{Object.entries(r.detail).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")}</span>])} />
    </section>
  );
}
