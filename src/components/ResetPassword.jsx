import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="auth-wrap">
        <div className="logo" style={{ marginBottom: 28, justifyContent: "center" }}>
          <span className="logo-badge"></span>Rolling Permits
        </div>
        <div className="auth-card">
          <h1 className="auth-title">Password updated</h1>
          <p className="auth-sub">
            You're all set — head back to the app and log in with your new password.
          </p>
          <a
            className="btn"
            href="/"
            style={{
              display: "block",
              textAlign: "center",
              textDecoration: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            Go to app
          </a>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="auth-wrap">
        <div className="logo" style={{ marginBottom: 28, justifyContent: "center" }}>
          <span className="logo-badge"></span>Rolling Permits
        </div>
        <div className="auth-card">
          <p className="mono" style={{ color: "var(--steel)" }}>
            Verifying reset link…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="logo" style={{ marginBottom: 28, justifyContent: "center" }}>
        <span className="logo-badge"></span>Rolling Permits
      </div>
      <div className="auth-card">
        <h1 className="auth-title">Set a new password</h1>
        <p className="auth-sub">Choose a new password for your account.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
