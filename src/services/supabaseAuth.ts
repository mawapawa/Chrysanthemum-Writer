/**
 * Supabase Auth bridge — syncs Google-authenticated users into Supabase.
 *
 * Called after successful Google OAuth to ensure the user exists in
 * Supabase Auth and public.profiles. Does not replace or modify the
 * existing Google OAuth flow.
 *
 * Requires the Google ID token (JWT) from Google's token endpoint,
 * NOT the access token, refresh token, or numeric user ID.
 */

import { supabase } from "./supabase";
import type { AuthUser } from "./auth";

function validateIdToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) {
    console.error("[SUPABASE AUTH] ID token is not a valid JWT — expected 3 segments, got", parts.length);
    return false;
  }
  try {
    const payload = JSON.parse(atob(parts[1]));
    console.log("[SUPABASE AUTH] ID token valid. iss:", payload.iss, "aud:", payload.aud, "sub:", payload.sub);
    return true;
  } catch {
    console.error("[SUPABASE AUTH] ID token payload is not valid JSON");
    return false;
  }
}

export async function syncGoogleUserToSupabase(googleIdToken?: string): Promise<void> {
  if (!supabase) {
    console.warn("[SUPABASE AUTH] Supabase client not configured — skipping user sync.");
    return;
  }

  if (!googleIdToken) {
    console.warn("[SUPABASE AUTH] No Google ID token provided — skipping Supabase auth sync.");
    return;
  }

  if (!validateIdToken(googleIdToken)) {
    console.error("[SUPABASE AUTH] Invalid Google ID token — skipping Supabase auth sync.");
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: googleIdToken,
    });

    if (error) {
      console.error("[SUPABASE AUTH] signInWithIdToken failed:", error.message);
      return;
    }

    // Upsert profile using the Supabase session user ID (UUID), not the Google user ID
    const sbUser = data?.user;
    if (sbUser) {
      const meta = sbUser.user_metadata ?? {};
      await upsertProfile({
        id: sbUser.id,
        name: meta.full_name ?? meta.name ?? sbUser.email ?? "User",
        email: sbUser.email ?? meta.email,
        avatarUrl: meta.avatar_url ?? meta.picture,
      });
    }

    console.log("[SUPABASE AUTH] Google user synced to Supabase.");
  } catch (err) {
    console.warn("[SUPABASE AUTH] Sync failed (non-blocking):", err);
  }
}

async function upsertProfile(user: AuthUser): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: user.name,
      email: user.email ?? null,
      avatar_url: user.avatarUrl ?? null,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("[SUPABASE AUTH] Profile upsert failed:", error.message);
  }
}
