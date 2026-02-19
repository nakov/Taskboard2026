DO $$
BEGIN
  CREATE TYPE public.userrole AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.userrole NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles(role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_project_owner_or_member(project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = $1
      AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = $1
      AND pm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.can_access_task(task_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = $1
      AND public.is_project_owner_or_member(t.project_id)
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they own or are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = owner_id OR public.is_admin());

CREATE POLICY "Users can view projects they own or are members of"
ON public.projects FOR SELECT
USING (public.is_project_owner_or_member(id) OR public.is_admin());

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = owner_id OR public.is_admin());

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can add project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can remove project members" ON public.project_members;

CREATE POLICY "Owners can view project members"
ON public.project_members FOR SELECT
USING (
  public.is_project_owner(project_id)
  OR user_id = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "Owners can add project members"
ON public.project_members FOR INSERT
WITH CHECK (public.is_project_owner(project_id) OR public.is_admin());

CREATE POLICY "Owners can remove project members"
ON public.project_members FOR DELETE
USING (public.is_project_owner(project_id) OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage stages of owned or member projects" ON public.project_stages;

CREATE POLICY "Users can manage stages of owned or member projects"
ON public.project_stages FOR ALL
USING (public.is_project_owner_or_member(project_id) OR public.is_admin())
WITH CHECK (public.is_project_owner_or_member(project_id) OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage tasks of owned or member projects" ON public.tasks;

CREATE POLICY "Users can manage tasks of owned or member projects"
ON public.tasks FOR ALL
USING (public.is_project_owner_or_member(project_id) OR public.is_admin())
WITH CHECK (public.is_project_owner_or_member(project_id) OR public.is_admin());

DROP POLICY IF EXISTS "Users can view attachments of accessible tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can insert attachments for accessible tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete attachments of accessible tasks" ON public.task_attachments;

CREATE POLICY "Users can view attachments of accessible tasks"
ON public.task_attachments FOR SELECT
USING (public.can_access_task(task_id) OR public.is_admin());

CREATE POLICY "Users can insert attachments for accessible tasks"
ON public.task_attachments FOR INSERT
WITH CHECK (
  (public.can_access_task(task_id) AND uploaded_by = auth.uid())
  OR public.is_admin()
);

CREATE POLICY "Users can delete attachments of accessible tasks"
ON public.task_attachments FOR DELETE
USING (public.can_access_task(task_id) OR public.is_admin());

DROP POLICY IF EXISTS "Users can view accessible task attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload accessible task attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update accessible task attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete accessible task attachment objects" ON storage.objects;

CREATE POLICY "Users can view accessible task attachment objects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-attachments'
  AND (public.can_access_task_attachment_object(name) OR public.is_admin())
);

CREATE POLICY "Users can upload accessible task attachment objects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (public.can_access_task_attachment_object(name) OR public.is_admin())
);

CREATE POLICY "Users can update accessible task attachment objects"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'task-attachments'
  AND (public.can_access_task_attachment_object(name) OR public.is_admin())
)
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (public.can_access_task_attachment_object(name) OR public.is_admin())
);

CREATE POLICY "Users can delete accessible task attachment objects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-attachments'
  AND (public.can_access_task_attachment_object(name) OR public.is_admin())
);
