import React, { useState } from "react";
import { supabase } from "../supabaseClient";

const PERMIT_TYPES = [
  { value: "health", label: "Health Permit" },
  { value: "fire", label: "Fire Inspection" },
  { value: "business_license", label: "Business License" },
  { value: "commissary", label: "Commissary Agreement" },
  { value: "propane", label: "Propane/LP-Gas Certification" },
  { value: "insurance", label: "Insurance (COI)" },
  { value: "vehicle_registration", label: "Vehicle Registration" },
  { value: "staff_certification", label: "Staff Certification" },
];

const ISSUER_BASED_TYPES = ["insurance", "staff_certification"];

const ISSUER_LABELS = {
  insurance: "Insurance carrier",
  staff_certification: "Issuing organization",
};

const TRUCK_REQUIRED_TYPES = ["vehicle_registration"];

const EMPLOYEE_REQUIRED_TYPES = ["staff_certification"];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function AddPermitModal({ vendorId, trucks, employees = [], isPaidTier, onClose, onCreated }) {
  const [truckId, setTruckId] = useState(trucks[0]?.id || "");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [jurisdictionName, setJurisdictionName] = useState("");
  const [jurisdictionType, setJurisdictionType] = useState("city");
  const [jurisdictionState, setJurisdictionState] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [permitType, setPermitType] = useState("health");
  const [permitNumber, setPermitNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  async function fileToBase64(f) {
    const buffer = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function handleAutoFill() {
    if (!file) return;
    setExtracting(true);
    setExtractError("");
    setAutoFilled(false);

    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error: fnError } = await supabase.functions.invoke("extract-permit", {
        body: { fileBase64, mediaType: file.type },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (data.permit_type && data.permit_type !== "unknown") {
        setPermitType(data.permit_type);
      }
      if (data.jurisdiction_name) setJurisdictionName(data.jurisdiction_name);
      if (data.jurisdiction_state) setJurisdictionState(data.jurisdiction_state);
      if (data.issuer_name) setIssuerName(data.issuer_name);
      if (data.expiration_date) setExpirationDate(data.expiration_date);
      if (data.permit_number) setPermitNumber(data.permit_number);

      setAutoFilled(true);
      if (data.confidence === "low") {
        setExtractError("Low confidence on this read — double-check the fields below before saving.");
      }
    } catch (err) {
      setExtractError(
        err.message || "Couldn't read that document automatically. You can still fill the form in by hand."
      );
    } finally {
      setExtracting(false);
    }
  }

  async function findOrCreateJurisdiction() {
    const name = jurisdictionName.trim();
    const state = jurisdictionState.trim().toUpperCase();

    const { data: existing } = await supabase
      .from("jurisdictions")
      .select("id")
      .eq("name", name)
      .eq("type", jurisdictionType)
      .eq("state", state)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error: createError } = await supabase
      .from("jurisdictions")
      .insert({ name, type: jurisdictionType, state })
      .select("id")
      .single();

    if (createError) throw createError;
    return created.id;
  }

  async function uploadDocument(permitId) {
    if (!file) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const path = `${user.id}/${permitId}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("permit-documents")
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    return path;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const isIssuerBased = ISSUER_BASED_TYPES.includes(permitType);
    const isEmployeeBased = EMPLOYEE_REQUIRED_TYPES.includes(permitType);

    try {
      const jurisdictionId = isIssuerBased ? null : await findOrCreateJurisdiction();

      const { data: permit, error: permitError } = await supabase
        .from("permits")
        .insert({
          vendor_id: vendorId,
          truck_id: isEmployeeBased ? null : truckId || null,
          employee_id: isEmployeeBased ? employeeId || null : null,
          jurisdiction_id: jurisdictionId,
          issuer_name: isIssuerBased ? issuerName.trim() : null,
          permit_type: permitType,
          permit_number: permitNumber || null,
          issued_date: issuedDate || null,
          expiration_date: expirationDate,
        })
        .select()
        .single();

      if (permitError) throw permitError;

      if (file) {
        const path = await uploadDocument(permit.id);
        if (path) {
          await supabase
            .from("permits")
            .update({ document_url: path })
            .eq("id", permit.id);
        }
      }

      onCreated();
    } catch (err) {
      setError(err.message || "Something went wrong saving the permit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Add a permit</h2>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isPaidTier ? (
            <div className="field">
              <label htmlFor="document">Have the document? Upload it and we'll fill in the rest</label>
              <input
                id="document"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setAutoFilled(false);
                  setExtractError("");
                }}
              />
              {file && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 4,
                      fontFamily: "'Oswald',sans-serif",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      fontSize: 12.5,
                    }}
                    onClick={handleAutoFill}
                    disabled={extracting}
                  >
                    {extracting ? "Reading document..." : "✨ Auto-fill from photo"}
                  </button>
                  {autoFilled && !extractError && (
                    <span className="mono" style={{ fontSize: 12, color: "var(--green)" }}>
                      Auto-filled — please review below
                    </span>
                  )}
                </div>
              )}
              {extractError && (
                <p className="mono" style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>
                  {extractError}
                </p>
              )}
            </div>
          ) : (
            <div className="field">
              <p className="mono" style={{ fontSize: 12, color: "var(--steel)" }}>
                🔒 Document upload and auto-fill are paid-plan features. Free plan is manual-entry only.
              </p>
            </div>
          )}

          <div style={{ borderTop: "1px dashed var(--line)", margin: "20px 0 18px" }}></div>

          {trucks.length === 0 && TRUCK_REQUIRED_TYPES.includes(permitType) && (
            <p className="mono" style={{ fontSize: 12, color: "var(--red)", marginBottom: 16 }}>
              Vehicle registration needs a truck on file first — cancel and add one with "+ Truck," then come back.
            </p>
          )}

          {trucks.length > 0 && !EMPLOYEE_REQUIRED_TYPES.includes(permitType) && (
            <div className="field">
              <label htmlFor="truck">
                {TRUCK_REQUIRED_TYPES.includes(permitType) ? "Truck" : "Truck (optional)"}
              </label>
              <select
                id="truck"
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                required={TRUCK_REQUIRED_TYPES.includes(permitType)}
              >
                {!TRUCK_REQUIRED_TYPES.includes(permitType) && (
                  <option value="">— Not truck-specific —</option>
                )}
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {EMPLOYEE_REQUIRED_TYPES.includes(permitType) && (
            <>
              {employees.length === 0 ? (
                <p className="mono" style={{ fontSize: 12, color: "var(--red)", marginBottom: 16 }}>
                  Staff certifications need an employee on file first — cancel and add one with "+ Employee," then come back.
                </p>
              ) : (
                <div className="field">
                  <label htmlFor="employee">Employee</label>
                  <select
                    id="employee"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                        {emp.role ? ` — ${emp.role}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="field">
            <label htmlFor="permitType">Permit type</label>
            <select
              id="permitType"
              value={permitType}
              onChange={(e) => setPermitType(e.target.value)}
            >
              {PERMIT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {ISSUER_BASED_TYPES.includes(permitType) ? (
            <div className="field">
              <label htmlFor="issuerName">{ISSUER_LABELS[permitType] || "Issuer"}</label>
              <input
                id="issuerName"
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                placeholder={
                  permitType === "staff_certification" ? "ServSafe" : "Progressive Commercial"
                }
                required
              />
            </div>
          ) : (
            <>
              <div className="row-2">
                <div className="field">
                  <label htmlFor="jurisdictionName">City / county</label>
                  <input
                    id="jurisdictionName"
                    value={jurisdictionName}
                    onChange={(e) => setJurisdictionName(e.target.value)}
                    placeholder="King County"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="jurisdictionState">State</label>
                  <select
                    id="jurisdictionState"
                    value={jurisdictionState}
                    onChange={(e) => setJurisdictionState(e.target.value)}
                    required
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="jurisdictionType">Jurisdiction type</label>
                <select
                  id="jurisdictionType"
                  value={jurisdictionType}
                  onChange={(e) => setJurisdictionType(e.target.value)}
                >
                  <option value="city">City</option>
                  <option value="county">County</option>
                  <option value="state">State</option>
                </select>
              </div>
            </>
          )}

          <div className="row-2">
            <div className="field">
              <label htmlFor="issuedDate">Issued date</label>
              <input
                id="issuedDate"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="expirationDate">Expiration date</label>
              <input
                id="expirationDate"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="permitNumber">
              {permitType === "vehicle_registration"
                ? "License plate number (optional)"
                : permitType === "insurance"
                ? "Policy number (optional)"
                : "Permit number (optional)"}
            </label>
            <input
              id="permitNumber"
              value={permitNumber}
              onChange={(e) => setPermitNumber(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving..." : "Save permit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
