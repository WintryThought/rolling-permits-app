import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import AuthScreen from "./components/AuthScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import PublicCompliance from "./components/PublicCompliance.jsx";
import ResetPassword from "./components/ResetPassword.jsx";

export default function App() {
  const [session, setSession] = useState(undefined);

  const proofMatch = window.location.pathname.match(/^\/proof\/([^/]+)\/?$/);
  const isResetPassword = window.location.pathname === "/reset-password";

  useEffect(() => {
    if (proofMatch || isResetPassword) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [proofMatch, isResetPassword]);

  if (proofMatch) {
    return <PublicCompliance token={proofMatch[1]} />;
  }

  if (isResetPassword) {
    return <ResetPassword />;
  }

  if (session === undefined) {
    return null;
  }

  return session ? <Dashboard session={session} /> : <AuthScreen />;
}
