import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import AddTruckModal from "./AddTruckModal.jsx";
import AddEmployeeModal from "./AddEmployeeModal.jsx";
import StatusBadge from "./StatusBadge.jsx";

// Mirrors PermitRow.jsx's own TYPE_LABELS. Kept as a separate local
// copy rather than importing from PermitRow, since PermitRow doesn't
// currently export it and this is just a small label lookup.
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

// For a staff_certification permit, issuer_name typically holds the
// specific credential (e.g. "Food Handler", "ServSafe Manager") since
// the permit_type itself is just the general category. Falls back to
// the generic type label if issuer_name wasn't given.
function permitDisplayName(permit) {
  if (permit.permit_type === "staff_certification" && permit.issuer_name) {
    return permit.issuer_name;
  }
  return TYPE_LABELS[permit.permit_type] || permit.permit_type;
}

// The only place in the app where a vendor can see their full list of
// trucks and employees, not just glimpse a name attached to a permit.
// Deleting either is allowed even if permits reference it — the DB's
// foreign keys are ON DELETE SET NULL, so the permit survives and just
// loses that truck/employee association. We warn about this rather
// than block it, since it's a safe (if surprising) outcome.
export default function ManageFleetModal({ vendorId, trucks, employees, permits, onClose, onChanged }) {
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [error, setError] = useState("");

  function permitsFor(kind, id) {
    return permits.filter((p) => (kind === "truck" ? p.truck_id === id : p.employee_id === id));
  }

  async function handleDeleteTruck(truck) {
    const count = permitsFor("truck", truck.id).length;
    const message =
      count > 0
        ? `${truck.name} is referenced by ${count} permit${count === 1 ? "" : "s"}. Deleting it will remove the truck name from those permits, but won't delete the permits themselves. Continue?`
        : `Remove ${truck.name}?`;
    if (!confirm(message)) return;

    setError("");
    const { error: deleteError } = await supabase.from("trucks").delete().eq("id", truck.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onChanged();
  }

  async function handleDeleteEmployee(employee) {
    const count = permitsFor("employee", employee.id).length;
    const message =
      count > 0
        ? `${employee.name} is referenced by ${count} permit${count === 1 ? "" : "s"}. Deleting them will remove their name from those permits, but won't delete the permits themselves. Continue?`
        : `Remove ${employee.name}?`;
    if (!confirm(message)) return;

    setError("");
    const { error: deleteError } = await supabase.from("employees").delete().eq("id", employee.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onChanged();
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <h2 className="modal-title">Trucks &amp; Staff</h2>

          {error && <div className="auth-error">{error}</div>}

          <div className="fleet-section">
            <div className="fleet-section-header">
              <span className="fleet-section-label mono">Trucks</span>
              <button className="btn-text" onClick={() => setShowAddTruck(true)}>
                + Add
              </button>
            </div>
            {trucks.length === 0 ? (
              <p className="fleet-empty">No trucks added yet.</p>
            ) : (
              <div className="fleet-list">
                {trucks.map((truck) => {
                  const truckPermits = permitsFor("truck", truck.id);
                  return (
                    <div className="fleet-row" key={truck.id}>
                      <div className="fleet-row-top">
                        <span className="fleet-row-name">{truck.name}</span>
                        <button
                          className="btn-text"
                          onClick={() => handleDeleteTruck(truck)}
                          title="Remove truck"
                        >
                          &times;
                        </button>
                      </div>
                      {truckPermits.length > 0 && (
                        <div className="fleet-permit-list">
                          {truckPermits.map((p) => (
                            <div className="fleet-permit-line" key={p.id}>
                              <span className="fleet-permit-name">
                                {permitDisplayName(p)}
                                <span className="fleet-permit-date mono">
                                  {" "}
                                  &middot; expires {p.expiration_date}
                                </span>
                              </span>
                              <StatusBadge status={p.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="fleet-section">
            <div className="fleet-section-header">
              <span className="fleet-section-label mono">Employees</span>
              <button className="btn-text" onClick={() => setShowAddEmployee(true)}>
                + Add
              </button>
            </div>
            {employees.length === 0 ? (
              <p className="fleet-empty">No employees added yet.</p>
            ) : (
              <div className="fleet-list">
                {employees.map((employee) => {
                  const employeePermits = permitsFor("employee", employee.id);
                  return (
                    <div className="fleet-row" key={employee.id}>
                      <div className="fleet-row-top">
                        <span className="fleet-row-name">{employee.name}</span>
                        <button
                          className="btn-text"
                          onClick={() => handleDeleteEmployee(employee)}
                          title="Remove employee"
                        >
                          &times;
                        </button>
                      </div>
                      {employeePermits.length > 0 ? (
                        <div className="fleet-permit-list">
                          {employeePermits.map((p) => (
                            <div className="fleet-permit-line" key={p.id}>
                              <span className="fleet-permit-name">
                                {permitDisplayName(p)}
                                <span className="fleet-permit-date mono">
                                  {" "}
                                  &middot; expires {p.expiration_date}
                                </span>
                              </span>
                              <StatusBadge status={p.status} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="fleet-permit-none">
                          No certifications on file &mdash; e.g. Food Handler, ServSafe
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {showAddTruck && (
        <AddTruckModal
          vendorId={vendorId}
          onClose={() => setShowAddTruck(false)}
          onCreated={() => {
            setShowAddTruck(false);
            onChanged();
          }}
        />
      )}

      {showAddEmployee && (
        <AddEmployeeModal
          vendorId={vendorId}
          onClose={() => setShowAddEmployee(false)}
          onCreated={() => {
            setShowAddEmployee(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}
