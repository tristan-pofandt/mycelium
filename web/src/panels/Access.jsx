// Access: switch an app's features, change its daily caps, work its moderation queue and sign users out, through the app's own
// admin API (relayed by server/api/admin.py with the token held on the server). Every change lands in the audit log below.
// Each action reports through a task chip (tasks.jsx); destructive ones are hold-to-confirm (ui.jsx).
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fmt, send, useApi } from "../api.js";
import { Table } from "../charts.jsx";
import { Icon } from "../icons.jsx";
import { TaskChip, useTask } from "../tasks.jsx";
import { EmptyState, HoldButton, Skeleton, Switch } from "../ui.jsx";

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

// One admin call as a task: throws on failure so the chip shows Failed with the app's reason and offers Retry.
async function call(path, body) {
  const r = await send("POST", path, body);
  if (!r.ok) throw new Error(r.data.error || `The app answered ${r.status}.`);
  return r.data;
}

function Switches({ app, onDone }) {
  const { data, error, reload } = useApi(`/api/admin/${app}/settings`, app);
  const [form, setForm] = useState(null);
  const [task, run, retry] = useTask();
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => { if (data) setForm({ rides: data.rides, signin: data.signin, caps: Object.fromEntries(Object.entries(data.caps).map(([k, v]) => [k, v.limit])) }); }, [data]);
  if (error && !data) return <section className="card"><h2>Switches and caps</h2><EmptyState title="Couldn't reach the app's admin API.">Check that its admin token is set on both servers.</EmptyState></section>;
  if (!form) return <section className="card"><h2>Switches and caps</h2><Skeleton height={120} lines={2} /></section>;

  const changes = {};
  if (form.rides !== data.rides) changes.rides = form.rides;
  if (data.accounts && form.signin !== data.signin) changes.signin = form.signin;
  const caps = Object.fromEntries(Object.entries(form.caps).filter(([k, v]) => v !== data.caps[k].limit));
  if (Object.keys(caps).length) changes.caps = caps;
  const valid = Object.values(form.caps).every((v) => Number.isInteger(v) && v >= 0 && v <= 100000);
  const busy = task?.state === "running";
  const summary = [
    "rides" in changes && `ride board ${changes.rides ? "on" : "off"}`,
    "signin" in changes && `new sign-ins ${changes.signin ? "on" : "off"}`,
    ...Object.entries(caps).map(([k, v]) => `${k} cap ${v}`),
  ].filter(Boolean).join(", ");

  const save = async (e) => {
    e.preventDefault();
    if ((changes.rides === false || changes.signin === false) && !confirm("Switch this off for everyone using the app now?")) return;
    const ok = await run({ name: "Save settings", arg: summary, expectedMs: 900, action: () => call(`/api/admin/${app}/settings`, changes) });
    if (ok) { reload(); setJustSaved(true); setTimeout(() => setJustSaved(false), 1200); }
    onDone();
  };
  return (
    <section className="card" aria-labelledby="sw-h">
      <h2 id="sw-h">Switches and caps</h2>
      <form onSubmit={save} className="form-grid">
        <Switch checked={form.rides} onChange={(v) => setForm({ ...form, rides: v })} label="Ride board on" />
        <Switch checked={form.signin} disabled={!data.accounts} onChange={(v) => setForm({ ...form, signin: v })} label="New sign-ins allowed"
          hint={!data.accounts ? "(accounts are off on this server)" : null} />
        {Object.entries(form.caps).map(([name, value]) => (
          <label key={name} className="field">
            <span>Daily cap: {name} <span className="muted">({fmt.n(data.caps[name].used_today)} used today; 0 means no cap)</span></span>
            <input type="number" className="select" min="0" max="100000" step="1" value={Number.isNaN(value) ? "" : value}
              onChange={(e) => setForm({ ...form, caps: { ...form.caps, [name]: e.target.valueAsNumber } })} />
          </label>
        ))}
        <div className="actions">
          <button className={`button button-primary ${justSaved ? "is-saved" : ""}`} aria-busy={busy} disabled={busy || !valid || !Object.keys(changes).length}>
            {busy ? <span className="spinner" aria-hidden="true" /> : justSaved ? <Icon name="check" size={15} /> : null}
            {busy ? "Saving" : justSaved ? "Saved" : "Save changes"}
          </button>
        </div>
      </form>
      {task && <TaskChip task={task} onRetry={retry} />}
      {task?.state === "done" && <p className="muted small">This lasts until the app restarts; its environment settings stay the default.</p>}
    </section>
  );
}

function Moderation({ app, onDone }) {
  const { data, error, reload } = useApi(`/api/admin/${app}/moderation`, app);
  const [task, run, retry] = useTask();
  const NAMES = { approve: "Approve post", remove: "Remove post", ban: "Remove and ban", unban: "Unban poster" };
  const act = async (action, ids) => {
    const ok = await run({ name: NAMES[action], arg: ids.id || ids.poster, expectedMs: 800,
      action: () => call(`/api/admin/${app}/moderation`, { action, ...ids }) });
    if (ok) reload();
    onDone();
  };
  return (
    <section className="card" aria-labelledby="mod-h">
      <h2 id="mod-h">Moderation queue</h2>
      {error && !data && <EmptyState title="Couldn't load the queue." />}
      {!data && !error && <Skeleton height={90} />}
      {data && (data.items?.length ? (
        <ul className="queue" role="list">
          {data.items.map((item) => (
            <li key={item.id} className="queue-item">
              <p><strong>{item.nickname}</strong> <span className="muted">({item.kind})</span>{item.status === "flagged" && <span className="badge badge-bad"><Icon name="down" />Hidden from the board</span>}</p>
              <p>{item.origin_label} to {item.destination_label}. Meet: {item.meet_point}. Note: {item.note || "–"}</p>
              <ul className="muted">{item.reports.map((rep, i) => <li key={i}>{rep.reason}: {rep.note || "(no note)"}</li>)}</ul>
              <div className="actions">
                <button type="button" className="button" onClick={() => act("approve", { id: item.id })}>Approve</button>
                <HoldButton className="button-danger" onConfirm={() => act("remove", { id: item.id })}>Hold to remove</HoldButton>
                <HoldButton className="button-danger" onConfirm={() => act("ban", { id: item.id })}>Hold to remove and ban</HoldButton>
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="Nothing to review.">Reported posts appear here.</EmptyState>)}
      {data?.bans?.length > 0 && (
        <>
          <h3>Banned posters</h3>
          <Table caption="Banned posters" head={["Poster", "Since", ""]} keys={data.bans.map((b) => [b.poster, b.at, null])}
            rows={data.bans.map((b) => [<code key="p">{b.poster}</code>, b.at,
              <HoldButton key="u" onConfirm={() => act("unban", { poster: b.poster })}>Hold to unban</HoldButton>])} />
        </>
      )}
      {task && <TaskChip task={task} onRetry={retry} />}
    </section>
  );
}

function Sessions({ app, onDone }) {
  const [userId, setUserId] = useState("");
  const [task, run, retry] = useTask();
  const revoke = async (one) => {
    await run({ name: one ? "Sign out user" : "Sign out everyone", arg: one ? userId.trim() : "every device", expectedMs: 900,
      action: () => call(`/api/admin/${app}/sessions/revoke`, one ? { user_id: userId.trim() } : {}),
      done: (d) => `${d.revoked ?? 0} session(s) ended` });
    onDone();
  };
  return (
    <section className="card" aria-labelledby="ses-h">
      <h2 id="ses-h">Sign users out</h2>
      <div className="form-grid">
        <label className="field"><span>User id <span className="muted">(starts with u_)</span></span>
          <input className="select" value={userId} onChange={(e) => setUserId(e.target.value)} pattern="u_.*" /></label>
        <div className="actions">
          <HoldButton disabled={!/^u_\S+$/.test(userId.trim())} onConfirm={() => revoke(true)}>Hold to sign out this user</HoldButton>
          <HoldButton className="button-danger" onConfirm={() => revoke(false)}>Hold to sign out everyone</HoldButton>
        </div>
      </div>
      {task && <TaskChip task={task} onRetry={retry} />}
      {task?.state === "done" && task.detail && <p className="muted small">{task.detail}.</p>}
    </section>
  );
}

function AuditLog({ data }) {
  return (
    <section className="card" aria-labelledby="aud-h">
      <h2 id="aud-h">Audit log</h2>
      {!data ? <Skeleton height={120} /> : (
        <Table caption="Owner actions, newest first" head={["When", "Who", "Action", "Details"]} empty="No actions yet."
          emptyText="Changes you make here are recorded with who, what and the result."
          keys={data.map((r) => [r.ts, r.actor, r.action, null])}
          rows={data.map((r) => [fmt.time(r.ts), r.actor, r.action,
            <span key="d" className="mono">{Object.entries(r.detail).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")}</span>])} />
      )}
    </section>
  );
}
