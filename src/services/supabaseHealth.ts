/**
 * Supabase health check — validates auth, database, and repository end-to-end.
 * Run from the console or a debug panel.
 */

import { supabase } from "./supabase";
import { listProjects, createProject } from "./projectService";

export async function runHealthCheck(): Promise<string> {
  const lines: string[] = [];
  const out = (msg: string) => { console.log(msg); lines.push(msg); };

  out("=== Supabase Health Check ===");

  // 1. Client
  out(`[1] Supabase client: ${supabase ? "configured" : "NOT CONFIGURED"}`);
  if (!supabase) return lines.join("\n");

  // 2. Auth session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  out(`[2] Session: ${sessionData?.session ? "active" : "none"}${sessionError ? ` error: ${sessionError.message}` : ""}`);

  // 3. Authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userData?.user) {
    out(`[3] User: ${userData.user.email ?? "no email"} (${userData.user.id})`);
  } else {
    out(`[3] User: not authenticated${userError ? ` — ${userError.message}` : ""}`);
    return lines.join("\n");
  }

  // 4. Profile exists
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", userData.user.id).maybeSingle();
  out(`[4] Profile: ${profile ? "exists" : "MISSING — will be created on first project create"}`);

  // 5. List projects
  try {
    const projects = await listProjects();
    out(`[5] Projects: ${projects.length} found`);
    for (const p of projects) {
      out(`    - ${p.name} (${p.id}) updated: ${p.updatedAt}`);
    }
  } catch (e: any) {
    out(`[5] Projects: error — ${e.message}`);
  }

  out("=== Health Check Complete ===");
  return lines.join("\n");
}
