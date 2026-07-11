import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import PermitRow from "./PermitRow.jsx";
import AddPermitModal from "./AddPermitModal.jsx";
import AddTruckModal from "./AddTruckModal.jsx";
import AddEmployeeModal from "./AddEmployeeModal.jsx";
import ShareComplianceModal from "./ShareComplianceModal.jsx";
import UpgradeModal from "./UpgradeModal.jsx";
import TruckIllustration from "./TruckIllustration.jsx";

// Mirrors the status bucket logic in the `permit_status` SQL view,
// computed client-side here because PostgREST can't reliably embed
// foreign tables (trucks, jurisdictions) through a view the way it
// can through a base table.
function computeStatus(expirationDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate + "T00:00:00");
  const days = Math.round((exp - today) / (1000 * 60 * 60 * 24));

  let status;
  if (days < 0) status = "expired";
  else if (days <= 14) status = "urgent";
  else if (days <= 30) status = "due_soon";
  else if (days <= 60) status = "upcoming";
  else status = "active";

  return { status, days };
}

export default function Dashboard({ session }) {
  const [vendor, setVendor] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [permits, setPermits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPermit, setShowAddPermit] = useState(false);
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const { data: vendorRow, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (vendorError) {
      setLoadError(vendorError.message);
      setLoading(false);
      return;
    }

    if (!vendorRow) {
      setLoadError(
        "No business profile found for this account yet. Try logging out and signing up again."
      );
      setLoading(false);
      return;
    }

    setVendor(vendorRow);

    const [trucksRes, employeesRes, permitsRes] = await Promise.all([
      supabase.from("trucks").select("*").eq("vendor_id", vendorRow.id).order("name"),
      supabase.from("employees").select("*").eq("vendor_id", vendorRow.id).order("name"),
      supabase
        .from("permits")
        .select(
          "*, trucks(name), employees(name), jurisdictions(name, state), coi_distributions(*)"
        )
        .eq("vendor_id", vendorRow.id),
    ]);

    if (trucksRes.error) setLoadError(trucksRes.error.message);
    if (employeesRes.error) setLoadError(employeesRes.error.message);
    if (permitsRes.error) setLoadError(permitsRes.error.message);

    setTrucks(trucksRes.data || []);
    setEmployees(employeesRes.data || []);

    const withStatus = (permitsRes.data || [])
      .map((p) => ({ ...p, ...computeStatus(p.expiration_date) }))
      .sort((a, b) => a.days - b.days);

    setPermits(withStatus);
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function handlePermitDeleted(permitId) {
    setPermits((prev) => prev.filter((p) => p.id !== permitId));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="app-shell">
        <p style={{ marginTop: 60, color: "var(--steel)" }} className="mono">
          Loading your permits…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell">
        <div className="auth-error" style={{ marginTop: 40 }}>
          {loadError}
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Log out
        </button>
      </div>
    );
  }

  const isPaidTier = vendor.plan_tier === "single" || vendor.plan_tier === "multi";

  return (
    <div className="app-shell">
      <div className="clip-header">
        <div className="clip"></div>
        <div className="header-inner">
          <div className="header-top">
            <div className="logo">
              <span className="logo-badge"></span>Rolling Permits
            </div>
            <button className="logout-link" onClick={handleLogout}>
              Log out
            </button>
          </div>
          <div className="biz-row">
            <div>
              <h1 className="biz-name">{vendor.business_name}</h1>
              <span className="plan-badge">
                {isPaidTier
                  ? `★ ${vendor.plan_tier === "multi" ? "Multi" : "Pro"} plan`
                  : `Free plan · ${permits.length}/5 permits`}
              </span>
            </div>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setShowAddTruck(true)}>
                + Truck
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAddEmployee(true)}>
                + Employee
              </button>
              {isPaidTier ? (
                <button className="btn btn-secondary" onClick={() => setShowShareModal(true)}>
                  Share
                </button>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowUpgradeModal(true)}
                  title="Upgrade to unlock the public compliance link"
                >
                  Share 🔒
                </button>
              )}
              {!isPaidTier && (
                <button className="btn btn-secondary" onClick={() => setShowUpgradeModal(true)}>
                  ⭐ Upgrade
                </button>
              )}
              <button
                className="btn"
                onClick={() => {
                  if (!isPaidTier && permits.length >= 5) {
                    setShowUpgradeModal(true);
                  } else {
                    setShowAddPermit(true);
                  }
                }}
              >
                + Permit
              </button>
            </div>
          </div>

          {permits.length > 0 &&
            (() => {
              const counts = { active: 0, due_soon: 0, urgent: 0, expired: 0 };
              permits.forEach((p) => {
                if (p.status === "active" || p.status === "upcoming") counts.active++;
                else if (p.status === "due_soon") counts.due_soon++;
                else if (p.status === "urgent") counts.urgent++;
                else if (p.status === "expired") counts.expired++;
              });
              const total = permits.length;
              const circumference = 2 * Math.PI * 24;
              const activeRatio = counts.active / total;
              const offset = circumference * (1 - activeRatio);

              const lines = [
                { key: "active", label: "Active", dotClass: "dot-active", count: counts.active },
                { key: "due_soon", label: "Due soon", dotClass: "dot-due", count: counts.due_soon },
                { key: "urgent", label: "Urgent", dotClass: "dot-urgent", count: counts.urgent },
                { key: "expired", label: "Expired", dotClass: "dot-expired", count: counts.expired },
              ].filter((l) => l.count > 0);

              return (
                <div className="stat-panel">
                  <div className="ring-wrap">
                    <svg width="56" height="56" viewBox="0 0 56 56">
                      <circle className="ring-bg" cx="28" cy="28" r="24" />
                      <circle
                        className="ring-fg"
                        cx="28"
                        cy="28"
                        r="24"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <div className="ring-label">
                      {counts.active}/{total}
                    </div>
                  </div>
                  <div className="stat-breakdown">
                    {lines.map((l) => (
                      <div className="stat-line" key={l.key}>
                        <span className={`stat-dot ${l.dotClass}`}></span>
                        {l.label}
                        <span className="stat-count">{l.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
        </div>
      </div>

      {permits.length === 0 ? (
        <div className="empty-wrap">
          <TruckIllustration className="truck-illo" />
          <h2 className="empty-title">No permits tracked yet</h2>
          <p className="empty-sub">
            Add your first permit and Rolling Permits starts the clock — you'll
            get reminders at 60, 30, 14, and 3 days before it expires,
            automatically.
          </p>
          <div className="empty-actions">
            <button className="btn" onClick={() => setShowAddPermit(true)}>
              + Add your first permit
            </button>
            {trucks.length === 0 && (
              <button className="btn btn-secondary" onClick={() => setShowAddTruck(true)}>
                + Add a truck first
              </button>
            )}
          </div>

          <div className="empty-steps">
            <div className="empty-step">
              <span className="empty-step-num">01</span>
              <h4>Add a permit</h4>
              <p>
                Health, fire, business license, or commissary — pick the type
                and set the expiration date.
              </p>
            </div>
            <div className="empty-step">
              <span className="empty-step-num">02</span>
              <h4>We start the countdown</h4>
              <p>
                Reminders go out automatically — no need to check back or set
                your own calendar alerts.
              </p>
            </div>
            <div className="empty-step">
              <span className="empty-step-num">03</span>
              <h4>Upload the doc (optional)</h4>
              <p>
                Attach the PDF or a photo now so it's ready to pull up the
                moment an inspector asks.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <span className="section-label">everything, sorted by what's most urgent</span>
          <div className="permit-list">
            {permits.map((permit) => (
              <PermitRow key={permit.id} permit={permit} onDeleted={handlePermitDeleted} isPaidTier={isPaidTier} />
            ))}
          </div>
        </>
      )}

      {showAddPermit && (
        <AddPermitModal
          vendorId={vendor.id}
          trucks={trucks}
          employees={employees}
          isPaidTier={isPaidTier}
          onClose={() => setShowAddPermit(false)}
          onCreated={() => {
            setShowAddPermit(false);
            loadAll();
          }}
        />
      )}

      {showAddTruck && (
        <AddTruckModal
          vendorId={vendor.id}
          onClose={() => setShowAddTruck(false)}
          onCreated={() => {
            setShowAddTruck(false);
            loadAll();
          }}
        />
      )}

      {showAddEmployee && (
        <AddEmployeeModal
          vendorId={vendor.id}
          onClose={() => setShowAddEmployee(false)}
          onCreated={() => {
            setShowAddEmployee(false);
            loadAll();
          }}
        />
      )}

      {showShareModal && (
        <ShareComplianceModal
          vendor={vendor}
          onClose={() => setShowShareModal(false)}
          onRegenerated={() => {
            loadAll();
          }}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
