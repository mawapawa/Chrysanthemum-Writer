import { useState, useEffect } from "react";
import { AuthUser, getCurrentUser, onAuthChange, signIn, signOut, refreshCurrentUser, listenToSupabaseAuth, unlistenToSupabaseAuth } from "../services/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());

  useEffect(() => {
    // Refresh from Supabase session on mount (async)
    refreshCurrentUser().then(setUser);
    // Listen for legacy Google auth changes
    const unsub = onAuthChange(setUser);
    // Listen for Supabase auth state changes
    listenToSupabaseAuth();
    return () => {
      unsub();
      unlistenToSupabaseAuth();
    };
  }, []);

  return { user, signIn, signOut };
}
