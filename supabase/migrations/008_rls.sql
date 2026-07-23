-- 008_rls.sql
-- Row Level Security policies.
-- Helper function centralizes access checks so policies don't duplicate logic.

CREATE OR REPLACE FUNCTION can_access_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    LEFT JOIN public.project_members pm ON pm.project_id = p.id
    WHERE p.id = project_uuid
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
  );
$$ LANGUAGE sql STABLE;

-- Profiles: users manage their own

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY profiles_insert ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Projects: owner has full access, members have role-based access

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON public.projects FOR SELECT
  USING (can_access_project(id));

CREATE POLICY projects_insert ON public.projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY projects_update ON public.projects FOR UPDATE
  USING (can_access_project(id));

CREATE POLICY projects_delete ON public.projects FOR DELETE
  USING (owner_id = auth.uid());

-- Project members: visible to those who can access the project

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_members_select ON public.project_members FOR SELECT
  USING (can_access_project(project_id));

CREATE POLICY project_members_insert ON public.project_members FOR INSERT
  WITH CHECK (can_access_project(project_id));

CREATE POLICY project_members_update ON public.project_members FOR UPDATE
  USING (can_access_project(project_id));

CREATE POLICY project_members_delete ON public.project_members FOR DELETE
  USING (can_access_project(project_id));

-- All child tables: access inherits from project via can_access_project

ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY scenes_access ON public.scenes FOR ALL USING (can_access_project(project_id));

ALTER TABLE public.story_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_nodes_access ON public.story_nodes FOR ALL USING (can_access_project(project_id));

ALTER TABLE public.dialogue_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY dialogue_lines_access ON public.dialogue_lines FOR ALL
  USING (can_access_project((SELECT project_id FROM public.story_nodes WHERE id = node_id)));

ALTER TABLE public.choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY choices_access ON public.choices FOR ALL
  USING (can_access_project((SELECT project_id FROM public.story_nodes WHERE id = node_id)));

ALTER TABLE public.stat_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY stat_changes_access ON public.stat_changes FOR ALL
  USING (can_access_project((SELECT project_id FROM public.story_nodes WHERE id = node_id)));

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY entities_access ON public.entities FOR ALL USING (can_access_project(project_id));

ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY trackers_access ON public.trackers FOR ALL USING (can_access_project(project_id));

ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY flags_access ON public.flags FOR ALL USING (can_access_project(project_id));

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_access ON public.inventory_items FOR ALL USING (can_access_project(project_id));

ALTER TABLE public.ui_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY ui_documents_access ON public.ui_documents FOR ALL USING (can_access_project(project_id));

ALTER TABLE public.ui_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY ui_elements_access ON public.ui_elements FOR ALL
  USING (can_access_project((SELECT project_id FROM public.ui_documents WHERE id = document_id)));

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_access ON public.assets FOR ALL USING (can_access_project(project_id));
