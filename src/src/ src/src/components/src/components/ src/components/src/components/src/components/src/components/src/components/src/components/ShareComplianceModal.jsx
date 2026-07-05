import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function ShareComplianceModal({ vendor, onClose, onRegenerated }) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  const shareUrl = `${window.location.origin}/proof/${vendor.share_token}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail on some mobile browsers without a
      // permissions prompt — the link is still selectable/visible below.
      setError("Couldn't copy automatically — long-press the link below to copy it.");
    }
  }

  async function handleRegenerate() {
    if (
      !confirm(
        "This creates a new link and immediately breaks the old one. Anyone still using the old link will get an error page. Continue?"
      )
    ) {
      return;
    }
    setRegenerating(true);
    setError("");

    const newToken = crypto.randomUUID();
    const { error: updateError } = await supabase
      .from("vendors")
      .update({ share_token: newToken })
      .eq("id", vendor.id);

    setRegenerating(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    onRegenerated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Share compliance status</h2>

        <p style={{ fontSize: 13.5, color: "var(--steel)", lineHeight: 1.6, marginBottom: 18 }}>
          Anyone with this link can see a live, read-only status page — which permits are
          current, which aren't, and expiration dates. No documents, permit numbers, or
          contact info are shown. Good for a commissary, festival organizer, or anyone else
          who needs proof you're current.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <div className="field">
          <label htmlFor="shareLink">Your link</label>
          <input id="shareLink" value={shareUrl} readOnly onClick={(e) => e.target.select()} />
        </div>

        <div className="modal-actions" style={{ justifyContent: "space-between" }}>
          <button
            type="button"
            className="btn-text"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? "Regenerating..." : "Regenerate link (revokes old one)"}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
