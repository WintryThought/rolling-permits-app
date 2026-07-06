import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import AuthScreen from "./components/AuthScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import PublicCompliance from "./components/PublicCompliance.jsx";

export default function App() {
  const [session, setSession] = useState(undefined);

  const proofMatch = window.location.pathname.match(/^\/proof\/([^/]+)\/?$/);

  useEffect(() => {
    if (proofMatch) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [proofMatch]);

  if (proofMatch) {
    return <PublicCompliance token={proofMatch[1]} />;
  }

  if (session === undefined) {
    return null;
  }

  return session ? <Dashboard session={session} /> : <AuthScreen />;
}
