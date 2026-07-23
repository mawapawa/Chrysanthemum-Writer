-- 006_indexes.sql
-- Performance indexes for common query patterns.

CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);

CREATE INDEX idx_scenes_project ON public.scenes(project_id);
CREATE INDEX idx_story_nodes_project ON public.story_nodes(project_id);
CREATE INDEX idx_story_nodes_scene ON public.story_nodes(scene_id);
CREATE INDEX idx_dialogue_lines_node ON public.dialogue_lines(node_id);
CREATE INDEX idx_choices_node ON public.choices(node_id);
CREATE INDEX idx_stat_changes_node ON public.stat_changes(node_id);

CREATE INDEX idx_entities_project ON public.entities(project_id);
CREATE INDEX idx_trackers_project ON public.trackers(project_id);
CREATE INDEX idx_flags_project ON public.flags(project_id);
CREATE INDEX idx_inventory_items_project ON public.inventory_items(project_id);

CREATE INDEX idx_ui_documents_project ON public.ui_documents(project_id);
CREATE INDEX idx_ui_elements_document ON public.ui_elements(document_id);

CREATE INDEX idx_assets_project ON public.assets(project_id);
