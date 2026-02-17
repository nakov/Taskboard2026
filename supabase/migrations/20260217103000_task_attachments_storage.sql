-- Task attachments metadata
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'task-attachments',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT task_attachments_size_non_negative CHECK (size_bytes IS NULL OR size_bytes >= 0),
  CONSTRAINT task_attachments_task_path_unique UNIQUE (task_id, storage_path)
);

CREATE INDEX task_attachments_task_id_idx ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Access helper for task-scoped data
CREATE OR REPLACE FUNCTION public.can_access_task(task_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND public.is_project_owner(t.project_id)
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view attachments of accessible tasks"
ON public.task_attachments FOR SELECT
USING (public.can_access_task(task_id));

CREATE POLICY "Users can insert attachments for accessible tasks"
ON public.task_attachments FOR INSERT
WITH CHECK (
  public.can_access_task(task_id)
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Users can delete attachments of accessible tasks"
ON public.task_attachments FOR DELETE
USING (public.can_access_task(task_id));

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Parse task UUID from "{task_id}/{file_name}" storage key
CREATE OR REPLACE FUNCTION public.task_id_from_storage_key(object_name TEXT)
RETURNS UUID AS $$
  SELECT CASE
    WHEN split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN split_part(object_name, '/', 1)::UUID
    ELSE NULL
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.can_access_task_attachment_object(object_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT public.can_access_task(public.task_id_from_storage_key(object_name));
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view accessible task attachment objects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-attachments'
  AND public.can_access_task_attachment_object(name)
);

CREATE POLICY "Users can upload accessible task attachment objects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments'
  AND public.can_access_task_attachment_object(name)
);

CREATE POLICY "Users can update accessible task attachment objects"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'task-attachments'
  AND public.can_access_task_attachment_object(name)
)
WITH CHECK (
  bucket_id = 'task-attachments'
  AND public.can_access_task_attachment_object(name)
);

CREATE POLICY "Users can delete accessible task attachment objects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-attachments'
  AND public.can_access_task_attachment_object(name)
);
