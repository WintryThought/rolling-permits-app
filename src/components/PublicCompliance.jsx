import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import StatusBadge from "./StatusBadge.jsx";

export default function PublicCompliance({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "public-compliance",
        { body: { token } }
      );
      if (cancelled) return;
      if (fnError || result?.error) {
        setError(result?.error || fnError?.message || "Something went wrong.");
      } else {
        setData(result);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="app-shell">
        <p style={{ marginTop: 60, color: "var(--steel)" }} className="mono">
          Loading compliance status…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <div className="auth-error" style={{ marginTop: 40 }}>
          {error}
        </div>
      </div>
    );
  }

  const allCurrent = data.summary.current === data.summary.total && data.summary.total > 0;

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="logo">
          <span className="logo-badge"></span>Rolling Permits
        </div>
      </nav>

      <div className="dash-header">
        <h1 className="dash-title">{data.business_name}</h1>
      </div>

      <div
        className="empty-wrap"
        style={{ padding: "32px 28px", marginBottom: 20, textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <span
            className={`status-badge ${allCurrent ? "status-active" : "status-expired"}`}
            style={{ fontSize: 13, padding: "7px 14px" }}
          >
            {data.summary.current}/{data.summary.total} current
          </span>
          <span className="mono" style={{ fontSize: 12, color: "var(--steel)" }}>
            As of {new Date(data.generated_at).toLocaleDateString()}
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--steel)", margin: "10px 0 0" }}>
          This is a live status snapshot shared by {data.business_name} via Rolling Permits.
          Status only — no documents or ID numbers are shown on this page.
        </p>
      </div>

      <div className="permit-list">
        {data.permits.map((p, i) => (
          <div className="permit-row" key={i}>
            <div className="permit-main">
              <div className="permit-type">
                {p.type_label}
                {p.context ? ` — ${p.context}` : ""}
              </div>
              <div className="permit-meta">expires {p.expires_on}</div>
            </div>
            <div className="permit-right">
              <StatusBadge status={p.status} />
            </div>
          </div>
        ))}
      </div>

      {data.permits.length === 0 && (
        <div className="empty-wrap">
          <p className="mono" style={{ color: "var(--steel)" }}>
            No permits on file yet.
          </p>
        </div>
      )}

      <footer style={{ marginTop: 40, textAlign: "center" }}>
        <p className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
          Powered by Rolling Permits
        </p>
      </footer>
    </div>
  );
}
