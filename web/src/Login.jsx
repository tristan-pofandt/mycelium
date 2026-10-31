import { useState } from "react";
import { send } from "./api.js";

export default function Login({ password, onDone }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await send("POST", "/api/login", { password: value });
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.data.error || "Sign-in failed.");
  };
  return (
    <main className="login">
      <h1>Mycelium</h1>
      {password ? (
        <form onSubmit={submit} className="card login-card">
          <label className="field-label" htmlFor="pw">Owner password</label>
          <input id="pw" type="password" className="select" autoComplete="current-password" autoFocus required
            value={value} onChange={(e) => setValue(e.target.value)} aria-describedby={error ? "pw-error" : undefined} />
          {error && <p id="pw-error" className="error-text" role="alert">{error}</p>}
          <button className="button button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      ) : (
        <p className="card login-card">This Mycelium only answers its owner. Open it through Tailscale signed in as the owner, or set
          <code>MYCELIUM_PASSWORD</code> on the server.</p>
      )}
    </main>
  );
}
