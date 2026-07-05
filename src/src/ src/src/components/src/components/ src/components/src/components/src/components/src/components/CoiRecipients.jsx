import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import AddCoiRecipientModal from "./AddCoiRecipientModal.jsx";

const RECIPIENT_TYPE_LABELS = {
  festival: "Festival",
  commissary: "Commissary",
  municipality: "Municipality",
  venue: "Venue",
  other: "Other",
};

function computeUrgency(recipient) {
  if (recipient.sent_date) return "sent";
  if (!recipient.needed_by_date) return "pending";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const needed = new Date(recipient.needed_by_date + "T00:00:00");
  const days = Math.round((needed - today) / (1000 * 60 * 60 * 24));

  if (days < 0) return "overdue";
  if (days <= 7) return "urgent";
  return "pending";
}

export default function CoiRecipients({ permitId, initialRecipients, isPaidTier }) {
  const [recipients, setRecipients] = useState(initialRecipients || []);
  const [expanded, setExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  if (!isPaidTier) {
    return (
      <div className="coi-wrap">
        <p className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
          🔒 Tracking who's received your COI (festivals, commissaries, etc.) is a paid-plan feature.
        </p>
      </div>
    );
  }

  async function refresh() {
    const { data } = await supabase
      .from("coi_distributions")
      .select("*")
      .eq("permit_id", permitId)
      .order("needed_by_date", { ascending: true, nullsFirst: false });
    setRecipients(data || []);
  }

  async function markSent(recipientId) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("coi_distributions")
      .update({ sent_date: today })
      .eq("id", recipientId);
    refresh();
  }

  const notSentCount = recipients.filter((r) => !r.sent_date).length;

  return (
    <div className="coi-wrap">
      <button
        type="button"
        className="btn-text"
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: "6px 0" }}
      >
        {expanded ? "Hide" : "Show"} COI recipients ({recipients.length}
        {notSentCount > 0 ? `, ${notSentCount} not sent` : ""})
      </button>

      {expanded && (
        <div className="coi-list">
          {recipients.length === 0 && (
            <p className="mono" style={{ fontSize: 12.5, color: "var(--steel)" }}>
              No recipients tracked yet for this policy.
            </p>
          )}
          {recipients.map((r) => {
            const urgency = computeUrgency(r);
            return (
              <div className="coi-row" key={r.id}>
                <div className="coi-row-main">
                  <span className="coi-recipient-name">{r.recipient_name}</span>
                  <span className="coi-recipient-meta mono">
                    {RECIPIENT_TYPE_LABELS[r.recipient_type] || r.recipient_type}
                    {r.needed_by_date ? ` · needed by ${r.needed_by_date}` : ""}
                    {r.additional_insured_required ? " · additional insured required" : ""}
                  </span>
                </div>
                {r.sent_date ? (
                  <span className="status-badge status-active">Sent {r.sent_date}</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className={`status-badge status-${
                        urgency === "overdue" ? "expired" : urgency === "urgent" ? "urgent" : "due_soon"
                      }`}
                    >
                      Not sent
                    </span>
                    <button className="btn-text" onClick={() => markSent(r.id)}>
                      Mark sent
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="btn-secondary"
            style={{
              marginTop: 8,
              padding: "8px 14px",
              borderRadius: 4,
              fontFamily: "'Oswald',sans-serif",
              textTransform: "uppercase",
              fontWeight: 600,
              letterSpacing: "0.02em",
              fontSize: 12.5,
            }}
            onClick={() => setShowAddModal(true)}
          >
            + Add recipient
          </button>
        </div>
      )}

      {showAddModal && (
        <AddCoiRecipientModal
          permitId={permitId}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
