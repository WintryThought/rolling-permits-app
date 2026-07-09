import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import StatusBadge from "./StatusBadge.jsx";
import CoiRecipients from "./CoiRecipients.jsx";

const TYPE_LABELS = {
  health: "Health Permit",
  fire: "Fire Inspection",
  business_license: "Business License",
  commissary: "Commissary Agreement",
  propane: "Propane/LP-Gas Certification",
  insurance: "Insurance (COI)",
  vehicle_registration: "Vehicle Registration",
  staff_certification: "Staff Certification",
};

// Small line icons per permit type — gives each ticket a distinct
// visual identity at a glance instead of relying on the color bar alone.
const PERMIT_ICONS = {
  health: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M12 2c1 4-3 5-3 9a3 3 0 006 0c0-2-1-3-1-3s2 1 2 4a5 5 0 01-10 0c0-5 4-6 6-10z" />
    </svg>
  ),
  propane: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M8 8h8v11a1 1 0 01-1 1H9a1 1 0 01-1-1V8z" />
      <path d="M10 8V5a1 1 0 011-1h2a1 1 0 011 1v3" />
      <path d="M11 3V2h2v1" />
    </svg>
  ),
  business_license: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M7 3h8l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
  commissary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M5 11h14v2a6 6 0 01-6 6h-2a6 6 0 01-6-6v-2z" />
      <path d="M4 11h16" />
      <path d="M9 7c0-1 1-1 1-2M13 7c0-1 1-1 1-2" />
    </svg>
  ),
  insurance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" />
    </svg>
  ),
  vehicle_registration: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M3 13l1.5-5A2 2 0 016.4 6.5h11.2A2 2 0 0119.5 8L21 13v5a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" />
      <circle cx="7" cy="17" r="1.4" />
      <circle cx="17" cy="17" r="1.4" />
    </svg>
  ),
  staff_certification: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
    </svg>
  ),
};

export default function PermitRow({ permit, onDeleted, isPaidTier }) {
  const [docUrl, setDocUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSignedUrl() {
      if (!permit.document_url) return;
      const { data } = await supabase.storage
        .from("permit-documents")
        .createSignedUrl(permit.document_url, 60 * 5); // 5 min link
      if (!cancelled && data) setDocUrl(data.signedUrl);
    }
    loadSignedUrl();
    return () => {
      cancelled = true;
    };
  }, [permit.document_url]);

  async function handleDelete() {
    if (!confirm("Remove this permit?")) return;
    const { error } = await supabase.from("permits").delete().eq("id", permit.id);
    if (!error) onDeleted(permit.id);
  }

  const truckName = permit.trucks?.name;
  const employeeName = permit.employees?.name;
  const jurisdiction = permit.jurisdictions
    ? `${permit.jurisdictions.name}, ${permit.jurisdictions.state}`
    : permit.issuer_name || "";
  const isInsurance = permit.permit_type === "insurance";
  const tabClass = `tab-${permit.permit_type}`;

  return (
    <div className="ticket">
      <div className={`ticket-tab ${tabClass}`}>{PERMIT_ICONS[permit.permit_type]}</div>
      <div className="ticket-body">
        <div className="ticket-perf"></div>
        <div className="ticket-top">
          <div className="permit-main">
            <div className="ticket-type">
              {TYPE_LABELS[permit.permit_type] || permit.permit_type}
              {truckName ? ` — ${truckName}` : ""}
              {employeeName ? ` — ${employeeName}` : ""}
            </div>
            <div className="ticket-meta">
              {jurisdiction} &middot; expires {permit.expiration_date}
              {docUrl && (
                <>
                  {" "}
                  &middot;{" "}
                  <a className="ticket-doc" href={docUrl} target="_blank" rel="noreferrer">
                    view doc
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="permit-right">
            <StatusBadge status={permit.status} />
            <button className="btn-text" onClick={handleDelete} title="Remove permit">
              &times;
            </button>
          </div>
        </div>

        {isInsurance && (
          <CoiRecipients permitId={permit.id} initialRecipients={permit.coi_distributions} isPaidTier={isPaidTier} />
        )}
      </div>
    </div>
  );
}
