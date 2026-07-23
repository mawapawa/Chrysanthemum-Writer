# Chrysanthemum Supabase Schema

## Design Decisions

- **UUIDs everywhere** — `id` is the database identity. Short IDs (`node_id`, `choice_id`, etc.) are the scripting/story identity. Both are kept.
- **`config JSONB` for flexible entities** — UI elements and scene blocks are naturally schema-fluid. JSONB avoids constant migrations.
- **`updated_at` trigger** — single trigger reused across all tables.
- **RLS via helper function** — ownership logic centralized in `can_access_project()`.
- **`project_members` table** — added now even if unused, makes RLS dramatically simpler later.
- **Checksum on assets** — enables duplicate detection.
- **Schema + engine versioning** — `schema_version` for DB migrations, `engine_version` for the app version that wrote the data.

## Tables

### profiles
Extends `auth.users`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References `auth.users(id)` ON DELETE CASCADE |
| display_name | TEXT | |
| email | TEXT | |
| avatar_url | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### projects

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| owner_id | UUID NOT NULL | References `profiles(id)` |
| name | TEXT NOT NULL | |
| description | TEXT | |
| start_node_id | TEXT | References `story_nodes.node_id` within project |
| schema_version | INT | Database migration version |
| engine_version | TEXT | Chrysanthemum version that wrote the project |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### project_members
Added now — RLS and future collaboration.

| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID | References `projects(id)` ON DELETE CASCADE |
| user_id | UUID | References `profiles(id)` ON DELETE CASCADE |
| role | TEXT | `owner`, `editor`, `viewer` |
| PRIMARY KEY | (project_id, user_id) | |

### scenes

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| name | TEXT | |
| description | TEXT | |
| color | TEXT | |
| sort_order | INT | |
| parent_id | UUID? | FK → scenes (nesting) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### story_nodes

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| scene_id | UUID? | FK → scenes |
| node_id | TEXT | Short ID like `"node-start"` — UNIQUE(project_id, node_id) |
| title | TEXT | |
| description | TEXT | |
| speaker | TEXT | Default speaker |
| position_x | FLOAT | Canvas position |
| position_y | FLOAT | |
| is_ending | BOOLEAN | |
| ending_type | TEXT | |
| ending_name | TEXT | |
| node_type | TEXT | `story`, `location`, `encounter` |
| continue_to_node_id | TEXT | References `node_id` within project — NOT a FK |
| blocks | JSONB | `SceneBlock[]` — discriminated union, kept as JSONB |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### dialogue_lines

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| node_id | UUID | FK → story_nodes |
| line_id | TEXT | Short ID — UNIQUE(node_id, line_id) |
| speaker | TEXT | |
| text | TEXT | |
| expression | TEXT | |
| formatted_text | TEXT | |
| sort_order | INT | |

### choices

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| node_id | UUID | FK → story_nodes |
| choice_id | TEXT | Short ID — UNIQUE(node_id, choice_id) |
| text | TEXT | |
| target_node_id | TEXT | References `node_id` within project |
| condition | JSONB | |
| requirement | JSONB | |
| effects | JSONB | `InlineEffect[]` |
| sort_order | INT | |

### stat_changes

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| node_id | UUID | FK → story_nodes |
| variable_name | TEXT | |
| operation | TEXT | `+`, `-`, `=` |
| value | FLOAT | |

### entities

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| entity_id | TEXT | Short ID — UNIQUE(project_id, entity_id) |
| name | TEXT | |
| color | TEXT | |
| description | TEXT | |
| tags | TEXT[] | |
| hp, attack, defense | INT? | |
| expressions | JSONB | |

### trackers

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| tracker_id | TEXT | Short ID — UNIQUE(project_id, tracker_id) |
| name | TEXT | |
| default_value | FLOAT | |
| description | TEXT | |

### flags

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| flag_id | TEXT | Short ID — UNIQUE(project_id, flag_id) |
| name | TEXT | |
| default_value | BOOLEAN | |
| description | TEXT | |

### inventory_items

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| item_id | TEXT | Short ID — UNIQUE(project_id, item_id) |
| name | TEXT | |
| description | TEXT | |
| tags | TEXT[] | |

### ui_documents

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| screen_id | TEXT | `"dialogue"`, `"menu"`, `"custom"` — UNIQUE(project_id, screen_id) |

### ui_elements

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| document_id | UUID | FK → ui_documents |
| element_id | TEXT | Original `UIElementV2.id` — UNIQUE(document_id, element_id) |
| type | TEXT | Widget type |
| parent_id | TEXT | References `element_id` within document |
| config | JSONB | All widget properties, layout, style, bindings, etc. |
| sort_order | INT | |

### assets

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID | FK → projects |
| asset_id | TEXT | Short ID — UNIQUE(project_id, asset_id) |
| name | TEXT | |
| asset_type | TEXT | |
| mime_type | TEXT | |
| storage_path | TEXT | Supabase Storage path |
| width | INT? | |
| height | INT? | |
| file_size | INT? | |
| checksum | TEXT | Enables duplicate detection |
| created_at | TIMESTAMPTZ | |

## RLS

Centralized helper:

```sql
CREATE FUNCTION can_access_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    LEFT JOIN public.project_members pm ON pm.project_id = p.id
    WHERE p.id = project_uuid
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
  );
$$ LANGUAGE sql STABLE;
```

All child table policies:

```sql
CREATE POLICY "owner_access" ON public.scenes FOR ALL
USING (can_access_project(project_id));
```

## Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to every table with updated_at
CREATE TRIGGER scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Repository Interface

```ts
interface ProjectRepository {
  load(projectId: string): Promise<Project>;
  save(project: Project): Promise<void>;
  delete(projectId: string): Promise<void>;
  listByUser(userId: string): Promise<ProjectSummary[]>;
}
```
