CREATE TABLE public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX project_members_user_id_idx ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_project_owner_or_member(project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_id
      AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_id
      AND pm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage stages of their projects" ON public.project_stages;
DROP POLICY IF EXISTS "Users can manage tasks of their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can view attachments of accessible tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can insert attachments for accessible tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete attachments of accessible tasks" ON public.task_attachments;

CREATE POLICY "Users can view projects they own or are members of"
ON public.projects FOR SELECT
USING (public.is_project_owner_or_member(id));

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can view project members"
ON public.project_members FOR SELECT
USING (
  public.is_project_owner(project_id)
  OR user_id = auth.uid()
);

CREATE POLICY "Owners can add project members"
ON public.project_members FOR INSERT
WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY "Owners can remove project members"
ON public.project_members FOR DELETE
USING (public.is_project_owner(project_id));

CREATE POLICY "Users can manage stages of owned or member projects"
ON public.project_stages FOR ALL
USING (public.is_project_owner_or_member(project_id))
WITH CHECK (public.is_project_owner_or_member(project_id));

CREATE OR REPLACE FUNCTION public.can_access_task(task_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND public.is_project_owner_or_member(t.project_id)
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can manage tasks of owned or member projects"
ON public.tasks FOR ALL
USING (public.is_project_owner_or_member(project_id))
WITH CHECK (public.is_project_owner_or_member(project_id));

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
