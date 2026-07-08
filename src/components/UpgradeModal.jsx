import React, { useState } from "react";
import { supabase } from "../supabaseClient";

const PLANS = [
  {
    key: "pro",
    name: "Pro",
    monthlyKey: "pro_monthly",
    annualKey: "pro_annual",
    monthlyPrice: 12,
    annualPrice: 120,
    features: [
      "Unlimited permits, all 8 types",
      "OCR auto-fill from photos",
      "Document vault",
      "COI recipient tracking",
      "Public proof-of-compliance link",
      "1 truck",
    ],
  },
  {
    key: "multi",
    name: "Multi",
    monthlyKey: "multi_monthly",
    annualKey: "multi_annual",
    monthlyPrice: 20,
    annualPrice: 200,
    features: ["Everything in Pro", "Up to 3 trucks", "Employee certification tracking"],
  },
];

export default function UpgradeModal({ onClose }) {
  const [billing, setBilling] = useState("monthly"); // "monthly" | "annual"
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");

  async function handleUpgrade(plan) {
    setError("");
    const planKey = billing === "monthly" ? plan.monthlyKey : plan.annualKey;
    setLoadingPlan(plan.key);

    const { data, error: fnError } = await supabase.functions.invoke("create-checkout-session", {
      body: { planKey },
    });

    if (fnError || data?.error) {
      setLoadingPlan(null);
      setError(data?.error || fnError?.message || "Something went wrong starting checkout.");
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    } else {
      setLoadingPlan(null);
      setError("Checkout session created, but no redirect URL was returned.");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2 className="modal-title">Upgrade your plan</h2>

        {error && <div className="auth-error">{error}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className={billing === "monthly" ? "btn" : "btn-secondary"}
            onClick={() => setBilling("monthly")}
            style={{ flex: 1 }}
          >
            Monthly
          </button>
          <button
            type="button"
            className={billing === "annual" ? "btn" : "btn-secondary"}
            onClick={() => setBilling("annual")}
            style={{ flex: 1 }}
          >
            Annual (2 months free)
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PLANS.map((plan) => {
            const price = billing === "monthly" ? plan.monthlyPrice : plan.annualPrice;
            const period = billing === "monthly" ? "/mo" : "/yr";
            return (
              <div
                key={plan.key}
                style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 18 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 8,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "'Oswald',sans-serif",
                      textTransform: "uppercase",
                      fontSize: 17,
                    }}
                  >
                    {plan.name}
                  </h3>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                    ${price}
                    {period}
                  </span>
                </div>
                <ul
                  style={{
                    margin: "0 0 14px",
                    paddingLeft: 18,
                    fontSize: 13,
                    color: "var(--steel)",
                    lineHeight: 1.6,
                  }}
                >
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn"
                  style={{ width: "100%" }}
                  onClick={() => handleUpgrade(plan)}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.key ? "Redirecting..." : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="modal-actions" style={{ justifyContent: "center" }}>
          <button type="button" className="btn-text" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
