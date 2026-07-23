import type { VNProject } from "../types";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface ProjectRepository {
  createProject(input: CreateProjectInput): Promise<VNProject>;
  listProjects(): Promise<ProjectSummary[]>;
  getProject(projectId: string): Promise<VNProject>;
}
