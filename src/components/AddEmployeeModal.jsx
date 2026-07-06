import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AddEmployeeModal({ vendorId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const { error: insertError } = await supabase
      .from("employees")
      .insert({ vendor_id: vendorId, name: name.trim(), role: role.trim() || null });

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
        <h2 className="modal-title">Add an employee</h2>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="employeeName">Name</label>
            <input
              id="employeeName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="employeeRole">Role (optional)</label>
            <input
              id="employeeRole"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Line cook"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving..." : "Save employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
