import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import AuthScreen from "./components/AuthScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import PublicCompliance from "./components/PublicCompliance.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading

  // Simple path check for the public share link — deliberately not
  // pulling in a full router library for just one public route.
  // Matches /proof/<token> and renders it before any auth check runs,
  // since this page is explicitly meant to work without logging in.
  const proofMatch = window.location.pathname.match(/^\/proof\/([^/]+)\/?$/);

  useEffect(() => {
    if (proofMatch) return; // no need to check auth on the public page
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [proofMatch]);

  if (proofMatch) {
    return <PublicCompliance token={proofMatch[1]} />;
  }

  if (session === undefined) {
    return null; // brief loading flash, avoid UI jump
  }

  return session ? <Dashboard session={session} /> : <AuthScreen />;
}
