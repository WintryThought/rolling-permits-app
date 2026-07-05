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
      <div className={`ticket-tab ${tabClass}`}></div>
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
