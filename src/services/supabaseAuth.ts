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

  // Checkpoint 2: validate JWT before calling signInWithIdToken
  console.log("[AUTH:2] ID token exists:", true, "length:", googleIdToken.length);
  const parts = googleIdToken.split(".");
  console.log("[AUTH:2] JWT segments:", parts.length);
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1]));
      console.log("[AUTH:2] JWT claims — iss:", payload.iss, "aud:", payload.aud, "sub:", payload.sub);
    } catch {}
  } else {
    console.error("[AUTH:2] Invalid JWT — expected 3 segments, got", parts.length);
    return;
  }

  try {
    // Checkpoint 3: signInWithIdToken
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: googleIdToken,
    });

    if (error) {
      console.error("[AUTH:3] signInWithIdToken failed:", error.message);
      return;
    }
    console.log("[AUTH:3] signInWithIdToken succeeded — session exists:", !!data?.session, "user exists:", !!data?.user);
    if (data?.user) {
      console.log("[AUTH:3] Supabase user ID:", data.user.id, "email:", data.user.email);
    }

    // Confirm auth.getUser() returns the authenticated user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    console.log("[AUTH:3] auth.getUser() — success:", !!userData?.user, "error:", userError?.message ?? "none");
    if (userData?.user) {
      console.log("[AUTH:3] Authenticated Supabase user ID:", userData.user.id, "email:", userData.user.email);
    }

    // Checkpoint 4: upsert profile
    const sbUser = data?.user;
    if (sbUser) {
      const meta = sbUser.user_metadata ?? {};
      console.log("[AUTH:4] Upserting profile with id:", sbUser.id);
      const { error: upsertErr } = await supabase.from("profiles").upsert(
        {
          id: sbUser.id,
          display_name: meta.full_name ?? meta.name ?? sbUser.email ?? "User",
          email: sbUser.email ?? meta.email,
          avatar_url: meta.avatar_url ?? meta.picture,
        },
        { onConflict: "id" }
      );
      if (upsertErr) {
        console.error("[AUTH:4] Profile upsert failed:", upsertErr.message);
      } else {
        console.log("[AUTH:4] Profile upsert succeeded for id:", sbUser.id);
      }
    }
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
