/**
 * ProjectService — thin facade between React and ProjectRepository.
 *
 * React components should never import supabaseProjectRepository directly.
 * This service is the only allowed caller of the repository.
 * Swap implementations here when the backend changes.
 */

import type { VNProject } from "../types";
import type { ProjectRepository, ProjectSummary, CreateProjectInput } from "./projectRepository";
import { SupabaseProjectRepository } from "./supabaseProjectRepository";

let _repository: ProjectRepository | null = null;

function getRepository(): ProjectRepository {
  if (!_repository) {
    _repository = new SupabaseProjectRepository();
  }
  return _repository;
}

export async function createProject(input: CreateProjectInput): Promise<VNProject> {
  return getRepository().createProject(input);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return getRepository().listProjects();
}

export async function getProject(projectId: string): Promise<VNProject> {
  return getRepository().getProject(projectId);
}
