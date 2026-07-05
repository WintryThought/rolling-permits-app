import React, { useState } from "react";
import { supabase } from "../supabaseClient";

const RECIPIENT_TYPES = [
  { value: "festival", label: "Festival / Event" },
  { value: "commissary", label: "Commissary Kitchen" },
  { value: "municipality", label: "Municipality" },
  { value: "venue", label: "Venue / Landlord" },
  { value: "other", label: "Other" },
];

export default function AddCoiRecipientModal({ permitId, onClose, onCreated }) {
  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState("festival");
  const [neededByDate, setNeededByDate] = useState("");
  const [additionalInsuredRequired, setAdditionalInsuredRequired] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const { error: insertError } = await supabase.from("coi_distributions").insert({
      permit_id: permitId,
      recipient_name: recipientName.trim(),
      recipient_type: recipientType,
      needed_by_date: neededByDate || null,
      additional_insured_required: additionalInsuredRequired,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Add a COI recipient</h2>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="recipientName">Recipient</label>
            <input
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Ballard Street Food Festival"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="recipientType">Recipient type</label>
            <select
              id="recipientType"
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value)}
            >
              {RECIPIENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="neededByDate">Needed by (optional)</label>
            <input
              id="neededByDate"
              type="date"
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
            />
          </div>

          <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="additionalInsured"
              type="checkbox"
              style={{ width: "auto" }}
              checked={additionalInsuredRequired}
              onChange={(e) => setAdditionalInsuredRequired(e.target.checked)}
            />
            <label htmlFor="additionalInsured" style={{ margin: 0 }}>
              They require "additional insured" status
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving..." : "Save recipient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
