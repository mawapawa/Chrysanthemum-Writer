-- 003_story.sql
-- Story nodes, dialogue, choices, scenes, variables, inventory.

CREATE TABLE public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT,
  sort_order INT DEFAULT 0,
  parent_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.story_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  node_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  speaker TEXT DEFAULT '',
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  is_ending BOOLEAN DEFAULT false,
  ending_type TEXT,
  ending_name TEXT,
  node_type TEXT DEFAULT 'story',
  continue_to_node_id TEXT,
  blocks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, node_id)
);

CREATE TABLE public.dialogue_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.story_nodes(id) ON DELETE CASCADE,
  line_id TEXT NOT NULL,
  speaker TEXT DEFAULT '',
  text TEXT NOT NULL,
  expression TEXT,
  formatted_text TEXT,
  sort_order INT DEFAULT 0,
  UNIQUE(node_id, line_id)
);

CREATE TABLE public.choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.story_nodes(id) ON DELETE CASCADE,
  choice_id TEXT NOT NULL,
  text TEXT NOT NULL,
  target_node_id TEXT,
  condition JSONB,
  requirement JSONB,
  effects JSONB DEFAULT '[]',
  sort_order INT DEFAULT 0,
  UNIQUE(node_id, choice_id)
);

CREATE TABLE public.stat_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.story_nodes(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT '+',
  value FLOAT NOT NULL DEFAULT 0
);

CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  description TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  hp INT,
  attack INT,
  defense INT,
  expressions JSONB DEFAULT '[]',
  UNIQUE(project_id, entity_id)
);

CREATE TABLE public.trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tracker_id TEXT NOT NULL,
  name TEXT NOT NULL,
  default_value FLOAT DEFAULT 0,
  description TEXT DEFAULT '',
  UNIQUE(project_id, tracker_id)
);

CREATE TABLE public.flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flag_id TEXT NOT NULL,
  name TEXT NOT NULL,
  default_value BOOLEAN DEFAULT false,
  description TEXT DEFAULT '',
  UNIQUE(project_id, flag_id)
);

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  UNIQUE(project_id, item_id)
);
