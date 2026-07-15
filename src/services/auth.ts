export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

interface TokenStore {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const CLIENT_ID = "1056893092259-lpjbsnuopvfcdkejn0h4rcvq5qfv1hbl.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = `${window.location.origin}/oauth/callback`;
const SCOPES = "openid https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
const TOKEN_KEY = "chrysanthemum_tokens";
const USER_KEY = "chrysanthemum_user";
const SCOPE_KEY = "chrysanthemum_auth_scope";
const AUTH_SCOPE_HASH = "v3";

import { isTauri, invoke } from "@tauri-apps/api/core";

const AUTH_DEBUG = true;
function log(...args: unknown[]) {
  if (AUTH_DEBUG) console.log("[AUTH]", ...args);
}

const listeners: Array<(user: AuthUser | null) => void> = [];

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}

function generateCodeVerifier(): string {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  const verifier = base64UrlEncode(arr.buffer);
  log("generateCodeVerifier() — length:", verifier.length, "preview:", verifier.substring(0, 10) + "...");
  return verifier;
}

function getStoredTokens(): TokenStore | null {
  try {
    const storedScope = localStorage.getItem(SCOPE_KEY);
    if (storedScope !== AUTH_SCOPE_HASH) {
      clearTokens();
      return null;
    }
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens: TokenStore): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  localStorage.setItem(SCOPE_KEY, AUTH_SCOPE_HASH);
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SCOPE_KEY);
}

async function refreshAccessToken(refreshToken: string): Promise<TokenStore> {
  log("refreshAccessToken()");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) {
    log("refreshAccessToken() — failed with status", resp.status);
    throw new Error("Token refresh failed");
  }
  const data = await resp.json();
  const tokens: TokenStore = {
    accessToken: data.access_token,
    refreshToken: refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  storeTokens(tokens);
  return tokens;
}

async function exchangeCode(code: string, codeVerifier: string, redirectUri?: string): Promise<TokenStore> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri ?? REDIRECT_URI,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`[AUTH] exchangeCode failed (${resp.status}): ${text}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`[AUTH] exchangeCode returned non-JSON: ${text}`);
  }
  const tokens: TokenStore = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  storeTokens(tokens);
  return tokens;
}

async function fetchUserInfo(accessToken: string): Promise<AuthUser> {
  const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`[AUTH] fetchUserInfo failed (${resp.status}): ${text}`);
  }
  const data = JSON.parse(text);
  const user: AuthUser = {
    id: data.id,
    name: data.name,
    email: data.email,
    avatarUrl: data.picture,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function notifyListeners(user: AuthUser | null): void {
  listeners.forEach((fn) => fn(user));
}

export function getCurrentUser(): AuthUser | null {
  const user = getStoredUser();
  if (user) return user;
  const tokens = getStoredTokens();
  if (tokens) {
    return { id: "google-user", name: "Google User" };
  }
  return null;
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;
  if (Date.now() >= tokens.expiresAt && tokens.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }
  return tokens.accessToken;
}

export function onAuthChange(fn: (user: AuthUser | null) => void): () => void {
  listeners.push(fn);
  const user = getCurrentUser();
  fn(user);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export async function tryHandleOAuthRedirect(): Promise<boolean> {
  log("tryHandleOAuthRedirect() — checking for auth code in URL");
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const codeVerifier = sessionStorage.getItem("pkce_verifier");
  if (code && codeVerifier) {
    log("tryHandleOAuthRedirect() — code found, exchanging");
    sessionStorage.removeItem("pkce_verifier");
    const tokens = await exchangeCode(code, codeVerifier);
    const user = await fetchUserInfo(tokens.accessToken);
    notifyListeners(user);
    window.history.replaceState({}, "", window.location.origin);
    log("tryHandleOAuthRedirect() — success");
    return true;
  }
  log("tryHandleOAuthRedirect() — no code in URL");
  return false;
}

function buildAuthUrl(redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function signInWeb(): Promise<AuthUser> {
  log("signInWeb()");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  sessionStorage.setItem("pkce_verifier", codeVerifier);

  const authUrl = await buildAuthUrl(REDIRECT_URI, codeChallenge);
  window.location.href = authUrl;
  throw new Error("Redirecting to Google sign-in");
}

async function signInTauri(): Promise<AuthUser> {
  log("signInTauri()");
  const { listen } = await import("@tauri-apps/api/event");
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

  const port = await invoke<number>("start_oauth_server");
  log("signInTauri() — server started on port", port);

  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  const authUrl = await buildAuthUrl(redirectUri, codeChallenge);

  return new Promise<AuthUser>((resolve, reject) => {
    const TIMEOUT_MS = 5 * 60 * 1000;
    let settled = false;
    let unlisten: (() => void) | null = null;
    let oauthWindow: any = null;

    const closeWindow = () => {
      try { oauthWindow?.close(); } catch { }
    };

    const timeout = setTimeout(async () => {
      if (settled) return;
      settled = true;
      log("signInTauri() — timeout reached, cleaning up");
      unlisten?.();
      closeWindow();
      try { await invoke("cancel_oauth_server", { port }); } catch { }
      reject(new Error("OAuth sign-in timed out"));
    }, TIMEOUT_MS);

    listen<string>("oauth_redirect", async (event) => {
      if (settled) return;
      clearTimeout(timeout);
      try {
        const url = new URL(event.payload);
        const code = url.searchParams.get("code");
        if (!code) {
          settled = true;
          closeWindow();
          reject(new Error("No authorization code in redirect"));
          return;
        }
        log("signInTauri() — code extracted from redirect");
        const tokens = await exchangeCode(code, codeVerifier, redirectUri);
        log("signInTauri() — token exchange succeeded");
        const user = await fetchUserInfo(tokens.accessToken);
        notifyListeners(user);
        settled = true;
        closeWindow();
        resolve(user);
      } catch (err) {
        settled = true;
        closeWindow();
        reject(err);
      }
    }).then((fn) => {
      unlisten = fn;
      log("signInTauri() — listener registered, opening webview");
      oauthWindow = new WebviewWindow("google-oauth", {
        url: authUrl,
        width: 600,
        height: 700,
        title: "Sign in with Google",
        resizable: true,
      });
      oauthWindow.once("tauri://error", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          closeWindow();
          try { invoke("cancel_oauth_server", { port }); } catch { }
          reject(new Error("Failed to open OAuth window"));
        }
      });
    }).catch((err: unknown) => {
      settled = true;
      clearTimeout(timeout);
      reject(new Error("Failed to register event listener: " + String(err)));
    });
  });
}

export async function signIn(): Promise<AuthUser> {
  const inTauri = isTauri();
  log("signIn() — isTauri:", inTauri);
  if (inTauri) {
    return signInTauri();
  }
  return signInWeb();
}

export async function signOut(): Promise<void> {
  log("signOut()");
  clearTokens();
  notifyListeners(null);
}


