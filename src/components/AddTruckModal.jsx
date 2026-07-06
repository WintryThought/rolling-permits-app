import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AddTruckModal({ vendorId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const { error: insertError } = await supabase
      .from("trucks")
      .insert({ vendor_id: vendorId, name: name.trim() });

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
        <h2 className="modal-title">Add a truck</h2>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="truckName">Truck name</label>
            <input
              id="truckName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="El Camion Loco"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving..." : "Save truck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
