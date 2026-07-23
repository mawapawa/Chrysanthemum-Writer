import { supabase } from "./supabase";
import type { VNProject } from "../types";
import type { ProjectRepository, ProjectSummary, CreateProjectInput } from "./projectRepository";

function projectToSummary(row: any): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function rowToProject(row: any): VNProject {
  return {
    id: row.id,
    schemaVersion: row.schema_version ?? 2,
    name: row.name,
    description: row.description ?? "",
    startNodeId: row.start_node_id ?? "",
    lastModified: new Date(row.updated_at ?? row.created_at).getTime(),
    nodes: {},
    entities: [],
    trackers: [],
    flags: [],
    inventory: [],
    scenes: [],
    uiLayouts: { screens: {}, activeScreen: "dialogue" },
    assets: [],
  };
}

export class SupabaseProjectRepository implements ProjectRepository {
  async createProject(input: CreateProjectInput): Promise<VNProject> {
    const { data: { user }, error: userError } = await supabase!.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");
    if (!supabase) throw new Error("Supabase not configured");

    // Ensure profile exists
    const { error: profileError } = await supabase.from("profiles").upsert(
      { id: user.id, display_name: user.user_metadata?.full_name ?? user.email ?? "User", email: user.email },
      { onConflict: "id" }
    );
    if (profileError) console.warn("[PROJECT REPO] Profile upsert failed:", profileError.message);

    const { data, error } = await supabase
      .from("projects")
      .insert({ owner_id: user.id, name: input.name, description: input.description ?? "" })
      .select()
      .single();

    if (error) throw new Error(`Failed to create project: ${error.message}`);
    return rowToProject(data);
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const { data: { user }, error: userError } = await supabase!.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, updated_at, created_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(`Failed to list projects: ${error.message}`);
    return (data ?? []).map(projectToSummary);
  }

  async getProject(projectId: string): Promise<VNProject> {
    const { data: { user }, error: userError } = await supabase!.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) throw new Error(`Failed to load project: ${error.message}`);
    return rowToProject(data);
  }
}
