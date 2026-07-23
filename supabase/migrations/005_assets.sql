-- 005_assets.sql
-- Asset metadata (files stored in Supabase Storage).

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT DEFAULT 'image',
  mime_type TEXT,
  storage_path TEXT,
  width INT,
  height INT,
  file_size INT,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, asset_id)
);
