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

// Permit types issued by a private carrier or certifying body rather
// than a government jurisdiction directly — these show an "issuer"
// field instead of city/county/state. Staff certifications go here
// too: some are state-issued (e.g. a state food handler card) and
// some are private (e.g. ServSafe), so a free-text issuer field
// covers both without forcing a choice.
const ISSUER_BASED_TYPES = ["insurance", "staff_certification"];

const ISSUER_LABELS = {
  insurance: "Insurance carrier",
  staff_certification: "Issuing organization",
};

// Permit types that belong to a specific truck rather than the
// business as a whole — the truck selector becomes required for these,
// since "which truck is this registration for" isn't optional.
const TRUCK_REQUIRED_TYPES = ["vehicle_registration"];

// Staff certifications belong to a specific person, not a truck.
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

      // Only fill fields we're reasonably confident about, and only
      // fields the model actually found — never overwrite something
      // the user already typed with a null.
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
    e.prevent
