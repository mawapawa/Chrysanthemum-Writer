import { useState, useEffect } from "react";
import { AuthUser, getCurrentUser, onAuthChange, signIn, signOut } from "../services/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());

  useEffect(() => {
    return onAuthChange(setUser);
  }, []);

  return { user, signIn, signOut };
}
