import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AuthScreen() {
  const [mode, setMode] = useState("signup");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: vendorError } = await supabase.from("vendors").insert({
        auth_user_id: userId,
        business_name: businessName,
        email,
        phone: phone || null,
      });
      if (vendorError) {
        setError(`Account created, but saving your business details failed: ${vendorError.message}`);
      }
    }

    setLoading(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
    }
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="logo" style={{ marginBottom: 28, justifyContent: "center" }}>
        <span className="logo-badge"></span>Rolling Permits
      </div>

      <div className="auth-card">
        <h1 className="auth-title">
          {mode === "signup" ? "Create your account" : "Log in"}
        </h1>
        <p className="auth-sub">
          {mode === "signup"
            ? "Start your 14-day free trial. Card required, you won't be charged until it ends."
            : "Welcome back."}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={mode === "signup" ? handleSignup : handleLogin}>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="businessName">Business name</label>
              <input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="El Camion Loco"
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourtruck.com"
              required
            />
          </div>

          {mode === "signup" && (
            <div className="field">
              <label htmlFor="phone">Phone (for SMS reminders)</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+14155551234"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Please wait..." : mode === "signup" ? "Start free trial" : "Log in"}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button className="btn-text" onClick={() => setMode("login")}>
                Log in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button className="btn-text" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
