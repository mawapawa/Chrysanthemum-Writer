-- 004_ui.sql
-- UI layout documents and elements (V2 editor).

CREATE TABLE public.ui_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  screen_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, screen_id)
);

CREATE TABLE public.ui_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.ui_documents(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INT DEFAULT 0,
  UNIQUE(document_id, element_id)
);
